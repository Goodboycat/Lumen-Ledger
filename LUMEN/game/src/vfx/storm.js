// LUMEN LEDGER — StormWeather (S17, 2026-10-23). Makes the Spark Storm LOOK like bad weather.
//
//   import { StormWeather } from './vfx/storm.js';
//   sb.storm = new StormWeather(game, { lights: game.lights, container: game.container, reduceMotion: () => sb.reduceMotion })
//   sb.storm.update(dt)           every frame (uses real-ish dt; cheap)
//   sb.storm.warn()               clouds gather (target 0.45) — called at day 0.30 when sb.nextEvent === 'storm'
//   sb.storm.hit()                full storm (target 1) + gust burst — called when the storm event lands (eco:event id storm)
//   sb.storm.clear(seconds = 3)   fade back to sunshine (target 0)
//   sb.storm.intensity            0..1 current  ·  sb.storm.target  ·  sb.storm.phase  'clear' | 'warn' | 'storm'
//
// What changes with intensity k (all lerps from the sunny baseline captured at construction):
//   • scene.background + scene.fog.color → slate (#5c6b7a), fog near/far pull in (30/70 → 14/40)
//   • key light 1.6 → 0.75, hemisphere 0.75 → 0.45 (cold tint)
//   • wind gain (nature + decor sway amplitude multiplier) 1 → 3: read by nature.js/decor.js via setWindGain()
//   • one InstancedMesh of 90 stretched slivers racing across the island (wind streaks) around the camera target — 1 draw call
//   • DOM overlay: diagonal rain streaks (repeating-linear-gradient scrolled by CSS animation) + grey vignette — 1 element
//   reduceMotion → streaks and rain-scroll off, colour shift only.
// Headless-safe: without a DOM/scene every visual call is optional.
import * as THREE from '../../vendor/three.module.js';
import { setWindGain } from '../assets/props/nature.js';
import { setDecorWindGain } from '../assets/props/decor.js';

const hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof document.getElementById === 'function' && !!document.head;
export const STORM = { warnTarget: 0.45, warnRamp: 12, hitRamp: 1.2, clearRamp: 3, windGainMax: 3, streaks: 90, streakRadius: 16, slate: 0x5c6b7a, fogNear: 14, fogFar: 40, keyDim: 0.75, hemiDim: 0.45,
  holdSeconds: 0,       // S21 (revised 2026-10-24): 0 = the storm stays for the WHOLE season (cleared by eco:season / win / shield absorb). >0 = auto-clear after that many GAME seconds (old 4 → 11 s behaviour)
  flashMs: 90 };        // S21: thunder flash on hit() — one white full-screen fade (off under reduceMotion)

export class StormWeather {
  constructor(game, deps = {}) {
    this.game = game; this.deps = deps; this.bus = game?.bus;
    this.intensity = 0; this.target = 0; this.rate = 1 / STORM.clearRamp; this.phase = 'clear';
    this.stats = { warns: 0, hits: 0, clears: 0 };
    const scene = game?.scene;
    this._base = {
      sky: scene?.background?.isColor ? scene.background.clone() : null,
      fogColor: scene?.fog?.color ? scene.fog.color.clone() : null,
      fogNear: scene?.fog?.near ?? 30, fogFar: scene?.fog?.far ?? 70,
      key: deps.lights?.key?.intensity ?? 1.6, hemi: deps.lights?.hemi?.intensity ?? 0.75,
    };
    this._slate = new THREE.Color(STORM.slate); this._tmpC = new THREE.Color();
    this._streaks = null; this._el = null; this._t = 0;
    if (scene && !deps.headless) this._buildStreaks(scene);
    const container = deps.container || game?.container || (hasDOM ? document.body : null);
    if (hasDOM && !deps.headless && container?.appendChild) { try { this._buildOverlay(container); } catch { this._el = null; } }
  }

  // ---------------------------------------------------------------- phases
  /** Clouds gather: a storm is coming (pre-rolled). Gives the player ~15 s to fill Protect. */
  warn() { if (this.phase === 'storm') return; this.phase = 'warn'; this.target = STORM.warnTarget; this.rate = STORM.warnTarget / STORM.warnRamp; this.stats.warns++; this.bus?.emit('storm:warn', {}); }
  /** The storm lands. */
  hit() { this.phase = 'storm'; this.target = 1; this.rate = (1 - this.intensity) / STORM.hitRamp || 1; this.stats.hits++; this._gust = 1.5; this._thunderFlash(); this.bus?.emit('storm:hit', {}); }
  /** S21: one white flash (90 ms) so the storm's landing reads even while a toast is on screen. Skipped under reduceMotion / headless. */
  _thunderFlash() {
    if (!this._flash || this.reduceMotion) return;
    this.stats.flashes = (this.stats.flashes || 0) + 1;
    const f = this._flash; f.style.transition = 'none'; f.style.opacity = '0.85';
    setTimeout(() => { f.style.transition = `opacity ${STORM.flashMs * 3}ms ease-out`; f.style.opacity = '0'; }, STORM.flashMs);
  }
  /** Back to sunshine over `seconds`. */
  clear(seconds = STORM.clearRamp) { if (this.phase === 'clear' && this.target === 0) return; this.phase = 'clear'; this.target = 0; this.rate = Math.max(1e-3, this.intensity) / Math.max(0.1, seconds); this.stats.clears++; this.bus?.emit('storm:clear', {}); }
  /** Snap (new run / teardown). */
  reset() { this.phase = 'clear'; this.target = 0; this.intensity = 0; this._apply(0); }

  // ---------------------------------------------------------------- loop
  update(dt) {
    if (!(dt > 0)) return;
    this._t += dt;
    if (this.intensity !== this.target) {
      const step = this.rate * dt;
      this.intensity = this.intensity < this.target ? Math.min(this.target, this.intensity + step) : Math.max(this.target, this.intensity - step);
      this._apply(this.intensity);
    }
    if (this._gust > 0) this._gust = Math.max(0, this._gust - dt);
    if (this._streaks) this._updateStreaks(dt);
  }
  get reduceMotion() { return !!(this.deps.reduceMotion?.() ?? this.game?.camera?.reduceMotion); }

  _apply(k) {
    const s = this.game?.scene, B = this._base;
    if (s?.background?.isColor && B.sky) s.background.copy(B.sky).lerp(this._slate, k);
    if (s?.fog) { if (B.fogColor) s.fog.color.copy(B.fogColor).lerp(this._slate, k); s.fog.near = B.fogNear + (STORM.fogNear - B.fogNear) * k; s.fog.far = B.fogFar + (STORM.fogFar - B.fogFar) * k; }
    const L = this.deps.lights;
    if (L?.key) L.key.intensity = B.key * (1 - k) + STORM.keyDim * k;
    if (L?.hemi) L.hemi.intensity = B.hemi * (1 - k) + STORM.hemiDim * k;
    const gain = 1 + (STORM.windGainMax - 1) * k; setWindGain(gain); setDecorWindGain(gain);
    this.windGain = gain;
    if (this._el) {
      const rm = this.reduceMotion;
      this._el.style.opacity = String(Math.min(1, k * 1.1));
      this._rain.style.opacity = rm ? '0' : String(Math.max(0, (k - 0.3) / 0.7) * 0.55);
      this._rain.style.animationPlayState = rm || k < 0.3 ? 'paused' : 'running';
    }
    if (this._streaks) this._streaks.mesh.visible = k > 0.08 && !this.reduceMotion;
  }

  // ---------------------------------------------------------------- wind streaks (1 draw call)
  _buildStreaks(scene) {
    const n = STORM.streaks;
    const geo = new THREE.BoxGeometry(1.4, 0.03, 0.03);
    const mat = new THREE.MeshBasicMaterial({ color: 0xe8f1f8, transparent: true, opacity: 0.55, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.userData.noOutline = true; mesh.userData.noShadow = true; mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    const items = Array.from({ length: n }, () => ({ pos: new THREE.Vector3(), speed: 0, len: 1, life: 0, dur: 1, y: 0 }));
    this._streaks = { mesh, geo, mat, items, m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0.35).normalize(), hidden: new THREE.Matrix4().makeScale(0, 0, 0) };
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, this._streaks.hidden);
    this._streaks.q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), this._streaks.dir);
  }
  _updateStreaks(dt) {
    const S = this._streaks; if (!S.mesh.visible) return;
    const k = this.intensity, c = this.game?.followTarget || this.game?.camera?.three?.position || { x: 0, y: 0, z: 0 };
    const R = STORM.streakRadius, gust = 1 + this._gust;
    // slow angle drift so the wind is not perfectly straight
    S.dir.set(1, 0, 0.35 + Math.sin(this._t * 0.23) * 0.2).normalize(); S.q.setFromUnitVectors(_X, S.dir);
    const want = Math.floor(S.items.length * Math.min(1, (k - 0.08) / 0.6));
    for (let i = 0; i < S.items.length; i++) {
      const it = S.items[i];
      if (it.life <= 0) {
        if (i >= want || Math.random() > 0.3) { S.mesh.setMatrixAt(i, S.hidden); continue; }
        it.life = it.dur = 0.5 + Math.random() * 0.7; it.speed = (12 + Math.random() * 10) * gust; it.len = 0.8 + Math.random() * 1.6 * k;
        it.pos.set(c.x - S.dir.x * R * 0.9 + (Math.random() - 0.5) * R * 1.2, 0.4 + Math.random() * 3.2, c.z - S.dir.z * R * 0.9 + (Math.random() - 0.5) * R * 1.6);
      }
      it.life -= dt; it.pos.addScaledVector(S.dir, it.speed * dt);
      const a = Math.sin(Math.PI * Math.max(0, it.life / it.dur));               // fade in/out via thickness
      S.s.set(it.len * (1 + (1 - a) * 0.6), Math.max(0.001, a), Math.max(0.001, a));
      S.m.compose(it.pos, S.q, S.s); S.mesh.setMatrixAt(i, S.m);
    }
    S.mesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- DOM overlay (rain streaks + grey vignette)
  _buildOverlay(container) {
    if (!document.getElementById('lumen-storm-css')) {
      const st = document.createElement('style'); st.id = 'lumen-storm-css';
      st.textContent = '@keyframes lumenRain{from{background-position:0 0}to{background-position:-160px 420px}}';
      document.head.appendChild(st);
    }
    const el = document.createElement('div'); el.id = 'storm-overlay'; el.className = 'storm-overlay';
    Object.assign(el.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 39, opacity: '0', transition: 'opacity 200ms linear',
      background: 'radial-gradient(ellipse at center, rgba(60,70,82,0) 40%, rgba(60,70,82,0.35) 80%, rgba(40,48,58,0.6) 100%)' });
    const rain = document.createElement('div'); rain.className = 'storm-rain';
    Object.assign(rain.style, { position: 'absolute', inset: '-20%', pointerEvents: 'none', opacity: '0',
      backgroundImage: 'repeating-linear-gradient(112deg, rgba(220,235,250,0) 0px, rgba(220,235,250,0) 9px, rgba(220,235,250,0.55) 10px, rgba(220,235,250,0) 12px, rgba(220,235,250,0) 23px)',
      backgroundSize: '160px 420px', animation: 'lumenRain 0.55s linear infinite', animationPlayState: 'paused', mixBlendMode: 'screen' });
    const flash = document.createElement('div'); flash.className = 'storm-flash';
    Object.assign(flash.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 40, opacity: '0', background: '#f4f8ff' });
    el.appendChild(rain); container.appendChild(el); container.appendChild(flash);
    this._el = el; this._rain = rain; this._flash = flash;
  }

  dispose() {
    this.reset();
    if (this._streaks) { this._streaks.mesh.removeFromParent?.(); this._streaks.geo.dispose?.(); this._streaks.mat.dispose?.(); this._streaks = null; }
    if (this._el) { this._el.remove?.(); this._el = null; this._rain = null; }
    if (this._flash) { this._flash.remove?.(); this._flash = null; }
  }
}
const _X = new THREE.Vector3(1, 0, 0);
export default StormWeather;
