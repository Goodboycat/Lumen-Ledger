// Game: renderer, scene, fixed-timestep-free variable dt loop with clamping, time scales,
// pixel-ratio cap, resize, pause, FPS/stat overlay. Systems register with add(system) and
// get update(dt) / lateUpdate(dt) / resize(w,h) calls.
import * as THREE from '../../vendor/three.module.js';
import { GameCamera } from './Camera.js';
import { Input } from './Input.js';
import { setupToonLights, PALETTE } from './Toon.js';
import { tweens } from '../anim/Tween.js';
import { SequencePlayer, HitStop } from '../anim/Sequencer.js';
import { bus } from './EventBus.js';

export const QUALITY = {
  low:    { pixelRatio: 1.0, shadows: false, shadowSize: 512,  antialias: false },
  medium: { pixelRatio: 1.25, shadows: true, shadowSize: 1024, antialias: true },
  high:   { pixelRatio: 1.5, shadows: true,  shadowSize: 2048, antialias: true },
};

export class Game {
  /** @param {HTMLElement} container @param {{quality?:'low'|'medium'|'high'}} opts */
  constructor(container, opts = {}) {
    this.container = container;
    const qName = opts.quality || autoQuality();
    this.quality = { ...QUALITY[qName], name: qName, antialiasRendered: QUALITY[qName].antialias };
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 30, 70);
    this.lights = setupToonLights(this.scene, { shadows: this.quality.shadows, shadowSize: this.quality.shadowSize });

    this.camera = new GameCamera(1);
    this.input = new Input(this.renderer.domElement, this.camera.three);

    this.tweens = tweens;             // global TweenManager
    this.sequences = new SequencePlayer();
    this.hitStop = new HitStop();
    this.bus = bus;
    this.systems = [];
    this.time = 0;                    // scaled game time (s)
    this.realTime = 0;
    this.timeScale = 1;               // slow-mo etc.
    this.paused = false;
    this.maxDt = 1 / 20;              // clamp hitches
    this.followTarget = null;         // Vector3 the camera follows
    this.stats = { fps: 0, frames: 0, acc: 0, drawCalls: 0, triangles: 0 };
    this._last = performance.now();
    this._raf = 0;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  /** BUGFIX B22: apply a QUALITY preset at runtime — pixel-ratio cap, shadow map on/off + size. `antialias` is fixed at renderer
   *  creation (WebGL cannot toggle MSAA on a live context) and is reported as `antialiasPending` so the menu can say "after reload".
   *  Returns the preset now active. Emits 'game:quality' so the PixelRatioGovernor (11A) can re-cap itself. */
  setQuality(name) {
    const q = QUALITY[name]; if (!q) return this.quality;
    const rendered = this.quality.antialiasRendered ?? this.quality.antialias;   // what the live WebGL context was created with
    this.quality = { ...q, name, antialiasRendered: rendered, antialiasPending: q.antialias !== rendered };
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    if (r.shadowMap.enabled !== q.shadows) { r.shadowMap.enabled = q.shadows; r.shadowMap.needsUpdate = true; this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } }); }
    const key = this.lights?.key;
    if (key) {
      key.castShadow = q.shadows;
      if (q.shadows && key.shadow) { if (key.shadow.mapSize.x !== q.shadowSize) { key.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } } }
    }
    this.resize();
    this.bus.emit('game:quality', { name, quality: this.quality });
    return this.quality;
  }

  /** Register a system: { update(dt, game)?, lateUpdate(dt)?, resize(w,h)? } */
  add(system) { this.systems.push(system); if (system.init) system.init(this); return system; }
  remove(system) { const i = this.systems.indexOf(system); if (i >= 0) this.systems.splice(i, 1); }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.setAspect(w / h);
    // Portrait: zoom out so gameplay fits
    this.camera.zoom = w < h ? 1.35 : 1;
    for (const s of this.systems) if (s.resize) s.resize(w, h);
  }

  /** Freeze gameplay for ms (real time) — attacker/target/VFX all stop, camera still shakes. */
  hitstop(ms) { this.hitStop.trigger(ms, [this.sequences, this.tweens, this]); }

  start() { this._last = performance.now(); const loop = (now) => { this._raf = requestAnimationFrame(loop); this._frame(now); }; this._raf = requestAnimationFrame(loop); return this; }
  stop() { cancelAnimationFrame(this._raf); }

  _frame(now) {
    let dtReal = (now - this._last) / 1000; this._last = now;
    const dtRaw = Math.max(0, Math.min(dtReal, 1));   // BUGFIX P05: fps is measured on the UNclamped frame time (was clamped → never read below 20)
    if (dtReal > this.maxDt) dtReal = this.maxDt;
    if (dtReal < 0) dtReal = 0;
    this.realTime += dtReal;

    // stats
    const st = this.stats; st.frames++; st.acc += dtRaw;
    if (st.acc >= 0.5) { st.fps = Math.round(st.frames / st.acc); st.frames = 0; st.acc = 0; }

    this.hitStop.update(dtReal); // may restore timeScales
    const dt = this.paused ? 0 : dtReal * this.timeScale; // this.timeScale is zeroed by hitStop
    this.time += dt;

    this.input.update();
    for (const s of this.systems) if (s.update) s.update(dt, this, dtReal);
    this.sequences.update(this.paused ? 0 : dtReal);  // SequencePlayer has own timeScale (hit-stop)
    this.tweens.update(this.paused ? 0 : dtReal);
    for (const s of this.systems) if (s.lateUpdate) s.lateUpdate(dt, this, dtReal);
    this.camera.update(this.followTarget, dtReal); // camera uses real time so shake continues during hit-stop
    this.input.lateUpdate();

    this.renderer.render(this.scene, this.camera.three);
    st.drawCalls = this.renderer.info.render.calls; st.triangles = this.renderer.info.render.triangles;
  }

  dispose() { this.stop(); window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}

/** Guess quality from device. */
export function autoQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (mobile && (cores <= 4 || mem <= 3)) return 'low';
  if (mobile) return 'medium';
  return 'high';
}
