// VFX core: pooled, allocation-free, delta-time driven. ≤ 2 ms/frame budget.
//  - DustPool: puffs (land, dash, anticipation)
//  - SlashTrail: single additive crescent quad that fades (120 ms)
//  - PopText: 3D sprite numbers/words ("+5", "Ka-ching") using canvas textures (pooled)
//  - ScreenFlash: DOM overlay flash
//  - HitSpark: small star burst at impact
// VFX Pack chat extends this file's patterns (coin burst, confetti, fog shader…).
import * as THREE from '../../vendor/three.module.js';
import { drawIconOnCanvas, iconName } from '../../ui/icons.js';
import { G } from '../assets/geo.js';
import { flatMat, toonMat, PALETTE as P } from '../core/Toon.js';
import { Easing } from '../anim/Easing.js';

// ---------- Dust puffs ----------
export class DustPool {
  constructor(scene, n = 48) {
    this.geo = G.sphere(0.5, 6, 4);
    this.mesh = new THREE.InstancedMesh(this.geo, new THREE.MeshToonMaterial({ color: 0xfff3dc, transparent: true, opacity: 0.85 }), n);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.userData.noOutline = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.items = Array.from({ length: n }, () => ({ life: 0, dur: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 1, grow: 1 }));
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3();
    this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, this.hidden);
  }
  /** Burst `count` puffs at pos. dir optional (puffs travel opposite). */
  burst(pos, count = 6, { size = 0.25, speed = 1.6, dur = 0.45, dir = null, up = 0.8 } = {}) {
    for (let k = 0; k < count; k++) {
      const it = this.items.find((i) => i.life <= 0); if (!it) return;
      it.life = it.dur = dur * (0.7 + Math.random() * 0.6);
      it.pos.copy(pos); it.pos.y += 0.05;
      const a = Math.random() * Math.PI * 2, sp = speed * (0.5 + Math.random());
      it.vel.set(Math.cos(a) * sp, up * Math.random(), Math.sin(a) * sp);
      if (dir) it.vel.addScaledVector(dir, -speed * 0.8);
      it.size = size * (0.7 + Math.random() * 0.6); it.grow = 1.6;
    }
  }
  /** Ring of puffs around a landing. */
  ring(pos, count = 8, size = 0.22) {
    for (let k = 0; k < count; k++) {
      const it = this.items.find((i) => i.life <= 0); if (!it) return;
      it.life = it.dur = 0.4; it.pos.copy(pos); it.pos.y += 0.05;
      const a = (k / count) * Math.PI * 2;
      it.vel.set(Math.cos(a) * 2.4, 0.3, Math.sin(a) * 2.4); it.size = size; it.grow = 1.4;
    }
  }
  update(dt) {
    const m = this._m, q = this._q, s = this._s;
    let any = false;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.life <= 0) continue;
      any = true;
      it.life -= dt;
      if (it.life <= 0) { this.mesh.setMatrixAt(i, this.hidden); continue; }
      const t = 1 - it.life / it.dur;
      it.pos.addScaledVector(it.vel, dt); it.vel.multiplyScalar(Math.max(0, 1 - 6 * dt)); it.vel.y -= 1.5 * dt;
      if (it.pos.y < 0.05) it.pos.y = 0.05;
      const sz = it.size * (1 + t * it.grow) * (1 - Easing.inCubic(t));
      s.setScalar(sz); m.compose(it.pos, q, s); this.mesh.setMatrixAt(i, m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Slash trail: blade-tracking ribbon (S35) ----------
// S35: the old crescent was a fixed quad fired once at strike start, so it never matched the sword — it lit up before the blade
// moved and faded while the blade was still sweeping. Now the trail is a RIBBON sampled from the sword's actual world transform
// every frame of the strike/follow phases (guard → tip), Catmull-Rom smoothed between samples and faded per vertex by age, so it
// is synchronised with the attack animation by construction (HeroController calls fire() on strike enter, track() each frame,
// release() when the follow-through settles). fire(pos, dir) without a blade still works (legacy crescent-ish sweep built from a
// virtual blade) so tools/check.mjs mocks + older callers keep running.
const TRAIL_MAX = 24, TRAIL_SUB = 4, TRAIL_LIFE = 0.16;
export class SlashTrail {
  constructor(scene) {
    const maxV = (TRAIL_MAX - 1) * TRAIL_SUB * 2 + 2;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(maxV * 3); this.col = new Float32Array(maxV * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < maxV / 2 - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx); this.geo.setDrawRange(0, 0);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.userData.noOutline = true; this.mesh.name = 'slashTrail';
    this.pivot = this.mesh;                                       // Game.js removes vfx.slash.pivot on reset
    this.mesh.visible = false; scene.add(this.mesh);
    this.samples = [];                                            // { b: Vector3 (guard), t: Vector3 (tip), age }
    this.pool = []; for (let i = 0; i < TRAIL_MAX + 2; i++) this.pool.push({ b: new THREE.Vector3(), t: new THREE.Vector3(), age: 0 });
    this.active = false; this.blade = null; this.color = new THREE.Color(0xfff6c8); this.scale = 1; this.life = 0;
    this._lb = new THREE.Vector3(); this._lt = new THREE.Vector3(); this._tmp = new THREE.Vector3();
    // legacy virtual blade (no sword object given): sweeps across the hero's front over `dur`
    this._virt = null;
  }
  /** Start a trail. opts.blade = Object3D of the sword (grip at origin, +Y along the blade, userData.length). */
  fire(pos, dir, { dur = 0.12, scale = 1, color = null, blade = null } = {}) {
    this.color.set(color || 0xfff6c8); this.scale = scale;
    for (const s of this.samples) this.pool.push(s); this.samples.length = 0;
    this.active = true; this.blade = blade; this.mesh.visible = true; this.life = 0;
    this._virt = blade ? null : { pos: pos.clone(), yaw: Math.atan2(dir.x, dir.z), dur, t: 0 };
    this.track();
  }
  /** Sample the blade's current world transform (call once per frame while the sword is swinging). */
  track() {
    if (!this.active) return;
    const s = this.pool.pop() || this.samples.shift();
    if (this.blade) {
      this.blade.updateWorldMatrix(true, false);
      const L = this.blade.userData.length || 1.4;
      s.b.set(0, 0.18, 0); this.blade.localToWorld(s.b);
      s.t.set(0, L * 1.04, 0); this.blade.localToWorld(s.t);
    } else {                                                      // virtual blade sweep (+0.35 → −0.35 rad, 0.55..1.75 u)
      const v = this._virt, k = Math.min(1, v.t / v.dur), a = v.yaw + 0.35 * (1 - 2 * Easing.outCubic(k));
      s.b.set(v.pos.x + Math.sin(a) * 0.55, v.pos.y + 0.9, v.pos.z + Math.cos(a) * 0.55);
      s.t.set(v.pos.x + Math.sin(a) * 1.75, v.pos.y + 1.1, v.pos.z + Math.cos(a) * 1.75);
    }
    s.age = 0; this.samples.push(s);
    if (this.samples.length > TRAIL_MAX) this.pool.push(this.samples.shift());
  }
  /** Stop recording — the ribbon fades out over TRAIL_LIFE. */
  release() { this.active = false; this.blade = null; this._virt = null; }
  update(dt) {
    if (!this.mesh.visible) return;
    if (this._virt) { this._virt.t += dt; this.track(); if (this._virt && this._virt.t >= this._virt.dur) this.release(); }
    for (const s of this.samples) s.age += dt;
    while (this.samples.length && this.samples[0].age >= TRAIL_LIFE) this.pool.push(this.samples.shift());
    if (!this.samples.length) { if (!this.active) this.mesh.visible = false; this.geo.setDrawRange(0, 0); return; }
    this._build();
  }
  _build() {
    const S = this.samples, n = S.length, P = this.pos, C = this.col, c = this.color, sc = this.scale; let v = 0;
    const put = (b, t, fade) => {
      // b/t are the smoothed guard/tip; stretch the tip slightly past the blade (scale) for a fuller ribbon
      const tx = b.x + (t.x - b.x) * sc, ty = b.y + (t.y - b.y) * sc, tz = b.z + (t.z - b.z) * sc;
      P[v * 3] = b.x; P[v * 3 + 1] = b.y; P[v * 3 + 2] = b.z; C[v * 3] = c.r * fade * 0.35; C[v * 3 + 1] = c.g * fade * 0.35; C[v * 3 + 2] = c.b * fade * 0.35; v++;
      P[v * 3] = tx; P[v * 3 + 1] = ty; P[v * 3 + 2] = tz; C[v * 3] = c.r * fade; C[v * 3 + 1] = c.g * fade; C[v * 3 + 2] = c.b * fade; v++;
    };
    const fadeOf = (s) => { const f = 1 - s.age / TRAIL_LIFE; return f * f; };
    if (n === 1) { put(S[0].b, S[0].t, fadeOf(S[0])); put(S[0].b, S[0].t, fadeOf(S[0])); }
    else {
      const cr = (p0, p1, p2, p3, u, out) => {           // Catmull-Rom
        const u2 = u * u, u3 = u2 * u;
        out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
        out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
        out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3);
        return out;
      };
      for (let i = 0; i < n - 1; i++) {
        const s0 = S[Math.max(0, i - 1)], s1 = S[i], s2 = S[i + 1], s3 = S[Math.min(n - 1, i + 2)];
        const f1 = fadeOf(s1), f2 = fadeOf(s2);
        for (let k = 0; k < TRAIL_SUB; k++) {
          const u = k / TRAIL_SUB;
          cr(s0.b, s1.b, s2.b, s3.b, u, this._lb); cr(s0.t, s1.t, s2.t, s3.t, u, this._lt);
          put(this._lb, this._lt, f1 + (f2 - f1) * u);
        }
      }
      put(S[n - 1].b, S[n - 1].t, fadeOf(S[n - 1]));
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(0, (v / 2 - 1) * 6));
  }
}
export const POP_SLOW = 2.2, POP_MIN = 1.6;   // floating text: duration multiplier + minimum seconds (mobile readability)

// ---------- Hit spark: star burst (instanced flat tris) ----------
export class HitSparkPool {
  constructor(scene, n = 32) {
    const geo = new THREE.PlaneGeometry(0.22, 0.06);
    this.mesh = new THREE.InstancedMesh(geo, flatMat(0xffffff, { transparent: true, additive: true, depthWrite: false }), n);
    this.mesh.frustumCulled = false; this.mesh.userData.noOutline = true;
    scene.add(this.mesh);
    this.items = Array.from({ length: n }, () => ({ life: 0, dur: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Quaternion() }));
    this._m = new THREE.Matrix4(); this._s = new THREE.Vector3(); this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, this.hidden);
    this._e = new THREE.Euler(); this._cam = null;
  }
  burst(pos, count = 8, speed = 5) {
    for (let k = 0; k < count; k++) {
      const it = this.items.find((i) => i.life <= 0); if (!it) return;
      it.life = it.dur = 0.18 + Math.random() * 0.12;
      it.pos.copy(pos);
      const a = Math.random() * Math.PI * 2, el = (Math.random() - 0.3) * 1.2;
      it.vel.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(speed * (0.6 + Math.random() * 0.8));
    }
  }
  update(dt, camera) {
    let any = false;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i]; if (it.life <= 0) continue; any = true;
      it.life -= dt;
      if (it.life <= 0) { this.mesh.setMatrixAt(i, this.hidden); continue; }
      it.pos.addScaledVector(it.vel, dt); it.vel.multiplyScalar(Math.max(0, 1 - 8 * dt));
      // orient along velocity, face camera-ish
      const len = it.vel.length();
      this._e.set(0, Math.atan2(it.vel.x, it.vel.z) + Math.PI / 2, Math.atan2(it.vel.y, Math.hypot(it.vel.x, it.vel.z)));
      it.rot.setFromEuler(this._e);
      const t = it.life / it.dur;
      this._s.set(1 + len * 0.15, t, 1);
      this._m.compose(it.pos, it.rot, this._s); this.mesh.setMatrixAt(i, this._m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Pop text (canvas sprites, pooled) ----------
export class PopTextPool {
  constructor(scene, n = 16) {
    this.items = [];
    for (let i = 0; i < n; i++) {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
      const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
      const sp = new THREE.Sprite(mat); sp.scale.set(1.6, 0.6, 1); sp.visible = false; sp.renderOrder = 999;
      scene.add(sp);
      this.items.push({ sp, canvas, tex, ctx: canvas.getContext('2d'), life: 0, dur: 1, vy: 0, base: 0 });
    }
  }
  show(pos, text, { color = '#FFD54F', dur = 0.8, size = 1 } = {}) {
    // mobile pass: floating texts vanished before they could be read on a phone → every pop lives POP_SLOW× longer (min POP_MIN s)
    dur = Math.max(POP_MIN, dur * POP_SLOW);
    const it = this.items.find((i) => i.life <= 0) || this.items.reduce((a, b) => (b.life < a.life ? b : a));   // reuse the OLDEST, not always #0
    const c = it.ctx; c.clearRect(0, 0, 256, 96);
    c.font = 'bold 56px "Baloo 2", "Arial Rounded MT Bold", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    // procedural icons: ★ ✦ ✓ ✗ inside a pop text are DRAWN (ui/icons.js drawIconOnCanvas), not printed as glyphs
    const parts = String(text).split(/([★✦✓✗✔✕])/u).filter((x) => x !== '');
    const ICO = 50, gap = 4; const widths = parts.map((x) => (iconName(x) ? ICO + gap : c.measureText(x).width));
    const total = widths.reduce((a, b) => a + b, 0); const k = total > 244 ? 244 / total : 1;
    c.save(); c.translate(128, 0); c.scale(k, 1); c.translate(-128, 0);
    let x = 128 - total / 2;
    parts.forEach((t, i) => {
      if (iconName(t)) drawIconOnCanvas(c, t, x + ICO / 2 + gap / 2, 50, ICO);
      else { c.textAlign = 'left'; c.lineWidth = 12; c.strokeStyle = '#263238'; c.lineJoin = 'round'; c.strokeText(t, x, 50); c.fillStyle = color; c.fillText(t, x, 50); }
      x += widths[i];
    });
    c.restore();
    it.tex.needsUpdate = true;
    it.sp.position.copy(pos); it.sp.position.y += 1.6; it.base = it.sp.position.y;
    it.sp.visible = true; it.life = it.dur = dur; it.size = size; it.sp.material.opacity = 1;
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt; const t = 1 - it.life / it.dur;
      const pop = t < 0.12 ? Easing.outBack(t / 0.12) : 1;
      it.sp.scale.set(1.6 * pop * it.size, 0.6 * pop * it.size, 1);
      it.sp.position.y = it.base + Easing.outCubic(t) * 0.9;
      it.sp.material.opacity = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;                // fully readable for 75 % of its life
      if (it.life <= 0) it.sp.visible = false;
    }
  }
}

// ---------- Screen flash (DOM) ----------
export class ScreenFlash {
  constructor(container) {
    this.el = document.createElement('div');
    Object.assign(this.el.style, { position: 'absolute', inset: '0', pointerEvents: 'none', background: '#fff', opacity: '0', zIndex: 50, mixBlendMode: 'screen' });
    container.appendChild(this.el); this.life = 0; this.dur = 0.1; this.max = 0.5;
  }
  flash(color = '#ffffff', ms = 100, max = 0.5) { this.el.style.background = color; this.life = this.dur = ms / 1000; this.max = max; }
  update(dt) {
    if (this.life <= 0) return;
    this.life -= dt; const t = Math.max(0, this.life / this.dur);
    this.el.style.opacity = String(t * this.max);
  }
}

/** Bundles all pools; add as a Game system. */
export class VFX {
  constructor(game) {
    this.game = game;
    this.dust = new DustPool(game.scene);
    this.slash = new SlashTrail(game.scene);
    this.sparks = new HitSparkPool(game.scene);
    this.pop = new PopTextPool(game.scene);
    this.flash = new ScreenFlash(game.container);
  }
  update(dt, game, dtReal) {
    // VFX obey hit-stop (dt from game.timeScale) except screen flash (real time)
    this.dust.update(dt); this.slash.update(dt); this.sparks.update(dt, game.camera.three); this.pop.update(dt);
    this.flash.update(dtReal);
  }
}
