// LUMEN LEDGER — CinematicDirector (S18, 2026-10-24). Three short camera pieces, all camera-only or `hero.inputOverride`-driven.
//
//   import { CinematicDirector, CINE } from './vfx/cinematics.js';
//   const cine = new CinematicDirector(game, { container, headless, reduceMotion: () => lg.reduceMotion });
//   cine.play('title',   { sb })                    → endless slow orbit around the island (title backdrop). stop() to end.
//   cine.play('arrival', { sb, story, onDone })     → Pip walks from the pier to the plaza, camera pulls in from a wide shot. Letterbox + SKIP.
//   cine.play('victory', { sb, story, onDone })     → S66-D: ~14 s. Fog gathers round the lighthouse, push-in, lamp flickers + ignites (flash), DOLLY ZOOM out,
//                                                     the beam sweeps and BURNS the fog bank away, confetti, wide reveal, return to Pip. Skippable.
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
//   • DOM: one `.ll-cine` layer in the container: letterbox bars + SKIP button (drawn 'skip' icon) (tap anywhere on the bars = skip). Headless-safe.
import * as THREE from '../../vendor/three.module.js';
import { icon } from '../../ui/icons.js';
import { G } from '../assets/geo.js';
import { toonMat } from '../core/Toon.js';   // S59: the SKIP button wears the drawn 'skip' icon (the old `typeof iconize` guard never matched → raw ⏭ glyph)

const hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function' && !!document.body;
export const CINE = {
  blendIn: 0.9, blendOut: 1.1,                                    // s — camera hand-over ramps
  titleRadius: 23, titleHeight: 10.5, titleSpeed: 0.11,          // orbit (S22: lower so more island shows): metres, metres, rad/s (≈ 57 s per lap)
  arrivalMax: 9, arriveDist: 1.2, arrivalWalk: 0.55,                // walk: stick magnitude during the walk-in (a stroll, not a sprint)
  arrivalWideDist: 22, arrivalWideHeight: 14, arrivalCloseDist: 9, arrivalCloseHeight: 7,   // P53: were on the comment line above → NaN camera
  victoryFly: 2.4, victoryLamp: 5.0, victorySweepEnd: 9.2, victoryClear: 9.6, victoryDur: 13.8, victoryReturn: 1.6, victoryHold: 9.8, victoryDist: 11, victoryHeight: 8,   // S66-D: seconds on the shot clock (hold = dur - fly - return, kept for old callers)
  beamBoost: 3.6, beamBase: 0.6,                                    // rad/s of the lamp beam: ignition spins it up to boost, after the sweep it settles back to base
  fogPuffs: 120,
  reduceCut: 0.6, skipArmMs: 900,                                  // S85: SKIP ignores taps for the first 0.9 s of a shot (a tap that ended the last scene cannot skip this one)
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);   // outCubic

// ---- S66-D helpers ------------------------------------------------------------------------------------------------
// Camera keys of the victory shot, in cylindrical coords around the lighthouse: az (rad, 0 = +z side), d (m), h (m), ly (look-at height),
// lz (lens: 1 = the game's normal 38° lens, 2.5 = telephoto). Between keys a cardinal (Hermite) spline = no stops, no snaps.
// DOLLY ZOOM: K2 → K3 pulls back from d 6.2 to 15.5 while the lens goes 1 → 2.5 (= d ratio), so the lamp keeps its size and the world stretches behind it.
export function victoryKeys(Y, C = CINE) {
  const end = C.victoryDur - C.victoryReturn;
  return [
    { t: C.victoryFly, az: 0.55, d: 19, h: 9.5, ly: 0.85 * Y, lz: 1 },       // K0 wide, fog gathering
    { t: 4.2, az: 0.30, d: 9.5, h: Y + 0.6, ly: 1.0 * Y, lz: 1 },             // K1 PUSH-IN (zoom in) while the lamp flickers
    { t: C.victoryLamp, az: 0.22, d: 6.6, h: Y + 0.3, ly: 1.08 * Y, lz: 1 }, // K2 closest: ignition + flash
    { t: C.victoryLamp + 1.5, az: -0.10, d: 16, h: Y + 1.6, ly: 1.1 * Y, lz: 2.4 },   // K3 vertigo out (lamp same size, fog stretches)
    { t: 9.0, az: -0.95, d: 14, h: Y + 3, ly: 1.0 * Y, lz: 1.35 },          // K4 lens relaxes, orbit while the beam burns the fog
    { t: 10.8, az: -1.5, d: 19, h: 12, ly: 0.62 * Y, lz: 1 },                      // K5 wide reveal (confetti)
    { t: end, az: -1.6, d: 20, h: 12.5, ly: 0.5 * Y, lz: 1 },                     // K6 hold, then the existing return-to-Pip blend
  ];
}
export function hermite(keys, prop, t) {
  const n = keys.length; if (t <= keys[0].t) return keys[0][prop]; if (t >= keys[n - 1].t) return keys[n - 1][prop];
  let i = 0; while (i < n - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], h = b.t - a.t, u = (t - a.t) / h;
  const m = (k) => { if (k <= 0 || k >= n - 1) return 0; return (keys[k + 1][prop] - keys[k - 1][prop]) / (keys[k + 1].t - keys[k - 1].t); };
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a[prop] + (u3 - 2 * u2 + u) * h * m(i) + (-2 * u3 + 3 * u2) * b[prop] + (u3 - u2) * h * m(i + 1);
}

/** The fog bank that gathers around the lighthouse (one InstancedMesh, ~120 puffs). The lamp beam burns puffs it crosses: they swell, glow warm, shrink and rise away. */
export class FogBank {
  constructor(scene, L, lampY, n = CINE.fogPuffs) {
    this.L = L; this.n = n; this.time = 0; this.alive = n;
    this.mesh = new THREE.InstancedMesh(G.sphere(0.7, 9, 6), toonMat(0xCDC2E8, { transparent: true, opacity: 0.88 }), n);
    this.mesh.name = 'cine.fogBank'; this.mesh.frustumCulled = false; this.mesh.userData.noOutline = true; this.mesh.renderOrder = 6;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    let sd = 4242; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
    this.puffs = [];
    for (let i = 0; i < n; i++) {
      const tower = i % 100 < 45;                                                // 45 %: hugging the tower (hides the lamp), 55 %: a low bank on the ground
      this.puffs.push({
        a: rnd() * Math.PI * 2, r: tower ? 0.8 + rnd() * 1.7 : 1.6 + rnd() * 6.4, y: tower ? 0.4 + rnd() * (lampY + 0.6) : 0.25 + rnd() * 1.7,
        size: tower ? 1.15 + rnd() * 0.9 : 1.4 + rnd() * 1.3, delay: 0.1 + rnd() * 2.1, ph: rnd() * Math.PI * 2, burn: 0, spark: false,
      });
    }
    this._c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, _hid); this.mesh.setColorAt(i, this._c); }
    scene.add(this.mesh);
  }
  /** o = { ang: beam angle (rad, 0 = +z), lit, dissolve, sparkle(pos) } */
  update(dt, t, o) {
    this.time += dt; const L = this.L, sa = Math.sin(o.ang), ca = Math.cos(o.ang); let alive = 0;
    for (let i = 0; i < this.n; i++) {
      const p = this.puffs[i];
      if (p.burn >= 1) continue;
      p.a += dt * 0.05;
      const x = Math.sin(p.a) * p.r, z = Math.cos(p.a) * p.r;
      if (o.lit) {
        const along = x * sa + z * ca, perp = Math.abs(x * ca - z * sa);       // the beam is a double cone through the lamp
        if (Math.abs(along) < 10 && perp < 1.5 + p.size * 0.5) p.burn = Math.min(1, p.burn + dt * 3.2);
        else if (o.dissolve) p.burn = Math.min(1, p.burn + dt * 1.1);          // after the sweep nothing is left behind
        if (p.burn > 0.25 && !p.spark) { p.spark = true; o.sparkle?.(_v.set(L.x + x, p.y + 0.6, L.z + z)); }
      }
      if (p.burn >= 1) { this.mesh.setMatrixAt(i, _hid); continue; }
      alive++;
      const b = p.burn, grow = smooth((t - p.delay) / 1.4), sc = Math.max(0.0001, p.size * grow * (1 + 0.35 * Math.sin(b * Math.PI)) * (1 - b * b));
      _v.set(L.x + x, p.y + Math.sin(this.time * 0.9 + p.ph) * 0.15 + b * 1.2, L.z + z); _w.set(sc, sc * 0.8, sc);
      this.mesh.setMatrixAt(i, _bm.compose(_v, _bq, _w));
      this._c.setRGB(1 + 0.3 * b, 1 + 0.1 * b, 1 - 0.6 * b); this.mesh.setColorAt(i, this._c);       // warm glow while burning
    }
    this.alive = alive; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.mesh.visible = alive > 0;
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.dispose?.(); }
}
const _hid = new THREE.Matrix4().makeScale(0, 0, 0), _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion();

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
    S.dur = shot === 'title' ? Infinity : rm ? CINE.reduceCut : shot === 'arrival' ? CINE.arrivalMax : CINE.victoryDur;
    S.blendIn = shot === 'title' || rm ? 0.001 : CINE.blendIn; S.blendOut = rm ? 0.001 : CINE.blendOut;
    if (shot !== 'title') S.story?.hold?.(true);
    this._setup(S);
    this._compute(S, 0);                                                                 // first frame: rig valid before camera.update
    this.game?.camera?.setCine?.(this.rig, shot === 'title' ? 1 : 0);
    if (this._el) { this._el.classList.toggle('on', shot !== 'title'); this._el.classList.toggle('letterbox', shot !== 'title'); }
    this._armedAt = Date.now();
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
    if (S.name === 'victory' && !S.rm) this._victoryTick(S, this.t, dt);
    else if (S.name === 'victory' && !S.lit && this.t > 0.2) this._victoryTick(S, CINE.victoryLamp, dt);   // reduce motion: just light the lamp
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
    if (S.name === 'victory') {
      S.heroPos = S.hero?.root.position || S.center; S.lit = false; S.keys = victoryKeys(S.lampY); S.beamAng = 0; S.flash = 0; S.burst = false; S.flick = 0; S.sweepSnd = false;
      const scene = this.game?.scene, vfx = S.sb?.vfx;
      if (!S.rm && scene && !this.deps.headless) {                      // reduce-motion = a calm cut, no fog show
        S.bank = new FogBank(scene, S.lighthouse, S.lampY);
        const bp = vfx?.lighthouseBeam; if (bp) { S.beamSpeed0 = bp.speed; S.beamMax0 = bp.maxOpacity; }
      }
      if (this._el) this._el.classList.add('victory');
    }
  }
  _release(S) {
    if (S.name === 'victory') this._cleanupVictory(S);
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
      const L = S.lighthouse, hp = S.heroPos, fly = CINE.victoryFly, end = CINE.victoryDur - CINE.victoryReturn;
      if (this.reduceMotion || S.rm) { R.pos.set(L.x + 6, S.lampY + 3, L.z + CINE.victoryDist); R.look.set(L.x, S.lampY * 0.7, L.z); R.fov = undefined; return; }
      const pos = (az, d, h) => R.pos.set(L.x + Math.sin(az) * d, h, L.z + Math.cos(az) * d);
      if (t < fly) {                                                                    // 1. fly from Pip to the first key (smooth, no stop: ends with the spline's own speed)
        const k = smooth(t / fly), K = S.keys[0];
        _v.set(hp.x, 0.8, hp.z); _w.set(L.x, K.ly, L.z); R.look.copy(_v).lerp(_w, k);
        _v.set(hp.x, 10, hp.z + 9); _w.set(L.x + Math.sin(K.az) * K.d, K.h, L.z + Math.cos(K.az) * K.d); R.pos.copy(_v).lerp(_w, k);
        R.fov = undefined; return;
      }
      const tt = Math.min(t, end);
      pos(hermite(S.keys, 'az', tt), hermite(S.keys, 'd', tt), hermite(S.keys, 'h', tt));
      R.look.set(L.x, hermite(S.keys, 'ly', tt), L.z);
      const lz = hermite(S.keys, 'lz', tt);                                             // lens factor → fov (tan(fov/2) / lz): 2.5 = telephoto
      const base = this.game?.camera?.baseFov ?? 38;
      R.fov = 2 * Math.atan(Math.tan(base * Math.PI / 360) / Math.max(0.6, lz)) * 180 / Math.PI;
      if (t > end) {                                                                    // 3. return toward Pip (the blend-out finishes the hand-over); lens relaxes
        const k = smooth((t - end) / CINE.victoryReturn);
        _w.copy(R.pos); _v.set(hp.x, 10, hp.z + 9); R.pos.copy(_w).lerp(_v, k);
        _w.copy(R.look); _v.set(hp.x, 0.8, hp.z); R.look.copy(_w).lerp(_v, k); R.fov = undefined;
      }
    }
  }

  _cleanupVictory(S) {
    if (S.vclean) return; S.vclean = true;
    if (S.bank) { S.bank.dispose(); S.bank = null; }
    const lh = S.sb?.world?.lighthouse, bm = S.sb?.vfx?.lighthouseBeam;
    if (S.sb && !S.lit && !S.rm) { /* skipped before ignition: still light the lamp so the world is left in the won state */ }
    if (!S.lit) { S.lit = true; lh?.userData?.setState?.('lit'); bm?.show?.(lh, { on: true }); this.bus?.emit('cine:lamp', {}); }
    if (bm) { if (S.beamSpeed0 != null) bm.speed = S.beamSpeed0; if (S.beamMax0 != null) bm.maxOpacity = S.beamMax0; }
    if (lh?.userData?.beamPivot) lh.userData.beamPivot.rotation.y = lh.userData.beamPivot.rotation.y;   // keep the sweep where it is (no pop)
    this.game?.camera?.setCine?.(this.rig, this.blend);
    if (this.game?.camera && this.game.camera.cam) { /* fov is restored by GameCamera when the rig is released (rig.fov = undefined) */ }
    this.rig.fov = undefined; this.rig.roll = 0;
    if (this._el) { this._el.classList.remove('victory'); this._el.style.setProperty('--flash', '0'); }
    S.sb?.fogHold && (S.sb.fogHold = false);
  }
  /** Per-frame events of the victory shot (ignition, beam spin-up, fog burn, confetti, flash). t = shot clock (s). */
  _victoryTick(S, t, dt) {
    const sb = S.sb, vfx = sb?.vfx, lh = sb?.world?.lighthouse, bm = vfx?.lighthouseBeam, C = CINE;
    // 1) the lamp: flicker (3.2 s ..) then IGNITE at victoryLamp
    if (!S.lit && t > C.victoryLamp - 1.8 && lh?.userData?.state === 'dark') lh.userData.setState?.('flicker');
    if (!S.lit && t >= C.victoryLamp) {
      S.lit = true; lh?.userData?.setState?.('lit'); bm?.show?.(lh, { on: true }); S.flash = 1; this.bus?.emit('cine:lamp', {});
      if (bm) { S.beamSpeed0 = S.beamSpeed0 ?? bm.speed; bm.maxOpacity = 0.55; }
      this.game?.camera?.shake?.(0.35);
      const p = _v.copy(S.lighthouse); p.y = S.lampY; vfx?.levelRing?.show?.(p, {}); vfx?.savingSparkle?.burst?.(p, 14, { radius: 0.9, rise: 2.4 });
    }
    // 2) the beam: spins up hard, then settles to a calm sweep
    if (S.lit) {
      const u = (t - C.victoryLamp), sp = u < 3.4 ? C.beamBase + (C.beamBoost - C.beamBase) * smooth(u / 0.8) : C.beamBase + (C.beamBoost - C.beamBase) * (1 - smooth((u - 3.4) / 1.4));
      if (bm) { bm.speed = sp; }
      if (lh?.userData?.beamPivot) { S.beamAng = lh.userData.beamPivot.rotation.y; }
    }
    // 3) the fog bank (grows from the start, is burnt after ignition)
    if (S.bank) S.bank.update(dt, t, { ang: S.beamAng, lit: S.lit && t > C.victoryLamp + 0.25, dissolve: t > C.victorySweepEnd, sparkle: (pos) => vfx?.savingSparkle?.burst?.(pos, 3, { radius: 0.5, rise: 1.6 }) });
    // 4) the world fog (the DebtFog ring) also recedes once the sweep has begun
    if (S.lit && !S.fogDone && t > C.victoryLamp + 1.0) { S.fogDone = true; /* Game.js already runs vfx.fogRecede on eco:win; nothing more to do here */ }
    // 5) confetti + coin rain at the wide reveal
    if (!S.burst && t >= 9.6) { S.burst = true; const p = _v.copy(S.lighthouse); p.y = 0; vfx?.confetti?.(p, 70, { spread: 5, up: 9 }); vfx?.coinRain?.(p, 14); this.bus?.emit('cine:reveal', {}); }
    // 6) flash overlay decays (a white-gold wash in the DOM)
    if (S.flash > 0) { S.flash = Math.max(0, S.flash - dt / 0.7); if (this._el) this._el.style.setProperty('--flash', String(+(S.flash * S.flash).toFixed(3))); }
  }

  // ---------------------------------------------------------------- DOM
  _buildDOM(container) {
    const el = document.createElement('div'); el.className = 'll-cine'; el.setAttribute('aria-hidden', 'true');
    const top = document.createElement('div'); top.className = 'll-cine-bar top';
    const bot = document.createElement('div'); bot.className = 'll-cine-bar bot';
    const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'll-cine-skip'; skip.innerHTML = '<span class="ll-cine-skip-txt">SKIP</span>' + icon('skip'); skip.setAttribute('aria-label', 'Skip cinematic');
    // S85 (user: "at the end I skipped the movie accidentally"): ONLY the SKIP button skips. A tap anywhere else, Enter, Space and Escape are swallowed (they must not
    //   reach the game underneath either). The button ignores clicks for SKIP_ARM_MS after the shot starts, so the tap that started / ended the last scene cannot land on it.
    skip.addEventListener('click', (e) => { e.stopPropagation(); if (this._armedAt && Date.now() - this._armedAt < CINE.skipArmMs) return; this.skip(); });
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); }, true);
    el.addEventListener('click', (e) => { e.stopPropagation(); });
    el.append(top, bot, skip);
    container.appendChild(el); this._el = el;
    this._onKey = (e) => { if (!this.active || this.active === 'title') return; if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') { if (e.target === skip) return; e.preventDefault(); e.stopImmediatePropagation?.(); } };   // S85: swallowed, never skips (a focused SKIP button still works natively)
    window.addEventListener('keydown', this._onKey, true);
  }
}

export default CinematicDirector;
