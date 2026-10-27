// LUMEN LEDGER — CinematicDirector (S18, 2026-10-24). Three short camera pieces, all camera-only or `hero.inputOverride`-driven.
//
//   import { CinematicDirector, CINE } from './vfx/cinematics.js';
//   const cine = new CinematicDirector(game, { container, headless, reduceMotion: () => lg.reduceMotion });
//   cine.play('title',   { sb })                    → endless slow orbit around the island (title backdrop). stop() to end.
//   cine.play('arrival', { sb, story, onDone })     → Pip walks from the pier to the plaza, camera pulls in from a wide shot. Letterbox + SKIP.
//   cine.play('victory', { sb, story, onDone })     → camera flies to the lighthouse, lamp lights + beam sweeps, returns to Pip.
//   cine.skip()  cine.stop()  cine.update(dtReal)  cine.active ('title'|'arrival'|'victory'|null)  cine.t  cine.stats  cine.dispose()
//
// How it drives the game (hooks added in S18):
//   • GameCamera.setCine(rig, blend): rig = { pos, look } written here every frame; blend ramps 0→1 at the start and 1→0 at the end so
//     the hand-over to / from the follow camera is smooth. The follow camera keeps tracking Pip underneath.
//   • HeroController.inputOverride = { move:{x,y} } during 'arrival' (screen-relative stick, same space as game.input.move): Pip walks
//     toward `target` with his normal locomotion (hops, dust, facing), attack presses are ignored. Cleared on end/skip.
//   • StorySystem.hold(true) while 'arrival' / 'victory' run → the Season-1 opening / victory lines wait; hold(false) on end.
//   • Bus: `cine:begin {shot}` · `cine:end {shot, skipped}` (the tutorial waits for cine:end; audio may hook these).
//   • Driven by dtReal (not dt) so it runs while the game is paused (dialogue / title). Shots are time-based; `arrival` also ends
//     when Pip is within CINE.arriveDist of the target (or after CINE.arrivalMax seconds as a safety).
//   • reduceMotion → every shot is a cut: 'arrival'/'victory' collapse to a ~0.6 s hold + fade; 'title' orbit becomes a static wide shot.
//   • DOM: one `.ll-cine` layer in the container: letterbox bars + ⏭ SKIP button (tap anywhere on the bars = skip). Headless-safe.
import * as THREE from '../../vendor/three.module.js';

const hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function' && !!document.body;
export const CINE = {
  blendIn: 0.9, blendOut: 1.1,                                    // s — camera hand-over ramps
  titleRadius: 23, titleHeight: 10.5, titleSpeed: 0.11,          // orbit (S22: lower so more island shows): metres, metres, rad/s (≈ 57 s per lap)
  arrivalMax: 9, arriveDist: 1.2, arrivalWalk: 0.55,                // walk: stick magnitude during the walk-in (a stroll, not a sprint)
  arrivalWideDist: 22, arrivalWideHeight: 14, arrivalCloseDist: 9, arrivalCloseHeight: 7,   // P53: were on the comment line above → NaN camera
  victoryFly: 2.2, victoryHold: 3.2, victoryReturn: 1.6, victoryDist: 11, victoryHeight: 8,
  reduceCut: 0.6,
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);   // outCubic

export class CinematicDirector {
  constructor(game, deps = {}) {
    this.game = game; this.deps = deps; this.bus = game?.bus;
    this.active = null; this.t = 0; this.blend = 0; this.phase = 'idle';   // idle | in | run | out
    this.rig = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.stats = { played: 0, skipped: 0, ended: 0 };
    this._shot = null; this._el = null; this._wasPaused = false;
    if (hasDOM && !deps.headless) { try { this._buildDOM(deps.container || game?.container || document.body); } catch { this._el = null; } }
  }
  get reduceMotion() { return !!(this.deps.reduceMotion?.() ?? this.game?.camera?.reduceMotion); }

  // ---------------------------------------------------------------- API
  /** @param {'title'|'arrival'|'victory'} shot  @param {{sb?:object, story?:object, onDone?:()=>void}} o */
  play(shot, o = {}) {
    if (this.active) this.stop(true);
    const S = this._shot = { name: shot, sb: o.sb || null, story: o.story || null, onDone: o.onDone || null, done: false, skipped: false };
    this.active = shot; this.t = 0; this.blend = 0; this.phase = 'in'; this.stats.played++;
    const rm = this.reduceMotion; S.rm = rm;
    S.dur = shot === 'title' ? Infinity : rm ? CINE.reduceCut : shot === 'arrival' ? CINE.arrivalMax : CINE.victoryFly + CINE.victoryHold + CINE.victoryReturn;
    S.blendIn = shot === 'title' || rm ? 0.001 : CINE.blendIn; S.blendOut = rm ? 0.001 : CINE.blendOut;
    if (shot !== 'title') S.story?.hold?.(true);
    this._setup(S);
    this._compute(S, 0);                                                                 // first frame: rig valid before camera.update
    this.game?.camera?.setCine?.(this.rig, shot === 'title' ? 1 : 0);
    if (this._el) { this._el.classList.toggle('on', shot !== 'title'); this._el.classList.toggle('letterbox', shot !== 'title'); }
    this.bus?.emit('cine:begin', { shot, reduceMotion: rm });
    return S;
  }
  /** Player pressed SKIP / tapped: cut to the end of the shot (hand-over blend still plays unless reduceMotion). */
  skip() { if (!this.active || this.active === 'title' || this.phase === 'out') return false; this.stats.skipped++; this._shot.skipped = true; this._end(); return true; }
  /** Immediate stop (title → PLAY, teardown). `silent` = no cine:end. */
  stop(silent = false) {
    const S = this._shot; if (!S) return;
    this._release(S);
    this.active = null; this.phase = 'idle'; this._shot = null; this.blend = 0;
    this.game?.camera?.setCine?.(null);
    if (this._el) this._el.classList.remove('on', 'letterbox');
    if (!silent) { this.stats.ended++; this.bus?.emit('cine:end', { shot: S.name, skipped: S.skipped }); S.onDone?.(); }
  }
  dispose() { this.stop(true); if (this._onKey && typeof window !== 'undefined') window.removeEventListener('keydown', this._onKey, true); this._el?.remove?.(); this._el = null; }

  // ---------------------------------------------------------------- loop (dtReal)
  update(dt) {
    const S = this._shot; if (!S || !(dt > 0)) return;
    this.t += dt;
    if (this.phase === 'in') { this.blend = Math.min(1, this.blend + dt / S.blendIn); if (this.blend >= 1) this.phase = 'run'; }
    else if (this.phase === 'out') { this.blend = Math.max(0, this.blend - dt / S.blendOut); if (this.blend <= 0) { this.stop(false); return; } }
    this._compute(S, this.t);
    this.game?.camera?.setCine?.(this.rig, this.blend);
    if (this.phase !== 'out' && S.name !== 'title') {
      if (this.t >= S.dur || (S.name === 'arrival' && S.hero && S.target && !S.rm && S.hero.root.position.distanceTo(S.target) < CINE.arriveDist)) this._end();
    }
  }
  _end() { const S = this._shot; if (!S || this.phase === 'out') return; this.phase = 'out'; this._release(S); if (S.blendOut <= 0.01) this.stop(false); }

  // ---------------------------------------------------------------- shots
  _setup(S) {
    const sb = S.sb, world = sb?.world;
    S.center = new THREE.Vector3(0, 0, -1);
    S.lighthouse = world?.lighthouse ? world.lighthouse.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0, -16);
    S.lampY = (world?.lighthouse?.userData?.lampPos?.y) ?? 6;
    S.hero = sb?.hero || null;
    if (S.name === 'arrival' && S.hero) {
      const pier = world?.pierSpawn || { x: 10, z: 0 };
      S.target = new THREE.Vector3(0, 0, 1);                                           // plaza (hero's default spawn)
      S.hero.root.position.set(pier.x, 0, pier.z); S.hero.recoverToLand?.();            // step off the pier onto the first land cell
      S.start = S.hero.root.position.clone();
      S.hero.inputOverride = { move: { x: 0, y: 0 } }; S.heroOwned = true;
      this.game.camera?.snapTo?.(S.hero.root.position);                                  // follow cam starts at Pip (avoids a swing when blending back)
      if (this.reduceMotion) S.hero.root.position.copy(S.target);
    }
    if (S.name === 'victory') { S.heroPos = S.hero?.root.position || S.center; S.lit = false; }
  }
  _release(S) {
    if (S.heroOwned && S.hero) { S.hero.inputOverride = null; S.heroOwned = false; }
    if (S.name !== 'title') S.story?.hold?.(false);
  }
  _compute(S, t) {
    const R = this.rig;
    if (S.name === 'title') {
      const a = this.reduceMotion ? 0.6 : 0.6 + t * CINE.titleSpeed;
      R.pos.set(S.center.x + Math.sin(a) * CINE.titleRadius, CINE.titleHeight + Math.sin(t * 0.23) * 0.6, S.center.z + Math.cos(a) * CINE.titleRadius);
      R.look.set(S.center.x, 1.5, S.center.z);
      return;
    }
    if (S.name === 'arrival') {
      const hero = S.hero, hp = hero ? hero.root.position : S.target;
      // walk: steer the stick toward the target (screen space: x = world x, y = −world z)
      if (S.heroOwned && this.phase !== 'out') {
        _v.copy(S.target).sub(hp); _v.y = 0; const d = _v.length();
        const sp = (d < 2.5 ? Math.max(0.25, d / 2.5) : 1) * CINE.arrivalWalk;
        if (d > 0.05) { _v.multiplyScalar(1 / d); S.hero.inputOverride.move.x = _v.x * sp; S.hero.inputOverride.move.y = -_v.z * sp; }
        else { S.hero.inputOverride.move.x = 0; S.hero.inputOverride.move.y = 0; }
      }
      const k = ease(Math.min(1, t / Math.max(0.1, S.dur * 0.85)));
      const dist = CINE.arrivalWideDist + (CINE.arrivalCloseDist - CINE.arrivalWideDist) * k;
      const h = CINE.arrivalWideHeight + (CINE.arrivalCloseHeight - CINE.arrivalWideHeight) * k;
      // from the sea side (+x, slightly −z) swinging round toward the ¾ follow angle (+z)
      const ang = 1.25 - 1.25 * k;
      R.pos.set(hp.x + Math.sin(ang) * dist, h, hp.z + Math.cos(ang) * dist);
      R.look.set(hp.x, 0.8, hp.z);
      return;
    }
    if (S.name === 'victory') {
      const L = S.lighthouse, hp = S.heroPos;
      const fly = CINE.victoryFly, hold = CINE.victoryHold;
      if (this.reduceMotion) { R.pos.set(L.x + 6, S.lampY + 3, L.z + CINE.victoryDist); R.look.set(L.x, S.lampY * 0.7, L.z); return; }
      if (t < fly) {                                                                    // fly from Pip to the lighthouse
        const k = smooth(t / fly);
        _v.set(hp.x, 0.8, hp.z); _w.set(L.x, S.lampY * 0.7, L.z); R.look.copy(_v).lerp(_w, k);
        _v.set(hp.x, 10, hp.z + 9); _w.set(L.x + 5, S.lampY + 3, L.z + CINE.victoryDist); R.pos.copy(_v).lerp(_w, k);
      } else if (t < fly + hold) {                                                      // hold: slow drift around the lamp while it lights
        const u = (t - fly) / hold, a = 0.45 - u * 0.9;
        R.pos.set(L.x + Math.sin(a) * CINE.victoryDist, S.lampY + 3 - u * 1.5, L.z + Math.cos(a) * CINE.victoryDist);
        R.look.set(L.x, S.lampY * 0.7, L.z);
        if (!S.lit && u > 0.15) { S.lit = true; S.sb?.world?.lighthouse?.userData?.setState?.('lit'); S.sb?.vfx?.lighthouseBeam?.show?.(S.sb.world?.lighthouse, { on: true }); this.bus?.emit('cine:lamp', {}); }
      } else {                                                                          // return toward Pip (the blend-out finishes the hand-over)
        const k = smooth((t - fly - hold) / CINE.victoryReturn);
        _w.set(L.x - 4, S.lampY + 1.5, L.z + CINE.victoryDist); _v.set(hp.x, 10, hp.z + 9); R.pos.copy(_w).lerp(_v, k);
        _w.set(L.x, S.lampY * 0.7, L.z); _v.set(hp.x, 0.8, hp.z); R.look.copy(_w).lerp(_v, k);
      }
    }
  }

  // ---------------------------------------------------------------- DOM
  _buildDOM(container) {
    const el = document.createElement('div'); el.className = 'll-cine'; el.setAttribute('aria-hidden', 'true');
    const top = document.createElement('div'); top.className = 'll-cine-bar top';
    const bot = document.createElement('div'); bot.className = 'll-cine-bar bot';
    const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'll-cine-skip'; skip.innerHTML = 'SKIP ' + (typeof iconize === 'function' ? iconize('⏭') : '⏭'); skip.setAttribute('aria-label', 'Skip cinematic');
    skip.addEventListener('click', (e) => { e.stopPropagation(); this.skip(); });
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); }, true);
    el.addEventListener('click', () => this.skip());
    el.append(top, bot, skip);
    container.appendChild(el); this._el = el;
    this._onKey = (e) => { if (!this.active || this.active === 'title') return; if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation?.(); this.skip(); } };
    window.addEventListener('keydown', this._onKey, true);
  }
}

export default CinematicDirector;
