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

// ---------- Slash trail (one additive crescent quad) ----------
export class SlashTrail {
  constructor(scene) {
    // crescent: ring sector geometry. BUGFIX (mobile QA): the old arc was yawed +90° off the strike direction and its sweep rotated
    // it further round, so on screen the slash appeared on the OPPOSITE side of Pip (behind him). Now the crescent lives in a pivot:
    // the mesh is laid flat with its arc spanning the hero's FRONT half (angles 0.12π..0.88π → +Z), the pivot is yawed to the strike
    // direction and only the pivot sweeps (right → left, same way the sword swings). Every vertex stays in front of the hero.
    this.geo = new THREE.RingGeometry(0.55, 1.75, 18, 1, Math.PI * 0.12, Math.PI * 0.76);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.rotation.x = Math.PI / 2;                       // ring XY-plane → ground plane, arc toward local +Z (= forward)
    this.mesh.userData.noOutline = true; this.mesh.frustumCulled = false;
    this.pivot = new THREE.Group(); this.pivot.name = 'slashTrail'; this.pivot.rotation.order = 'YXZ';
    this.pivot.add(this.mesh); this.pivot.visible = false; this.pivot.userData.noOutline = true;
    scene.add(this.pivot);
    this.life = 0; this.dur = 0.12; this.fadeInEnd = 0.35; this.yaw = 0; this.baseScale = 1;
  }
  /** Show at pos facing dir (the strike direction): a crescent in front of the hero, slightly tilted (diagonal slash). */
  fire(pos, dir, { dur = 0.12, scale = 1, color = null } = {}) {
    this.pivot.position.copy(pos); this.pivot.position.y += 0.9;
    this.yaw = Math.atan2(dir.x, dir.z);
    this.pivot.rotation.set(0, this.yaw + SLASH_SWEEP, -0.28);
    this.baseScale = scale; this.pivot.scale.setScalar(scale);
    if (color) this.mat.color.set(color); else this.mat.color.set(0xfff6c8);
    this.life = this.dur = dur; this.pivot.visible = true; this.mat.opacity = 0;
  }
  update(dt) {
    if (this.life <= 0) return;
    this.life -= dt;
    const t = Math.min(1, 1 - this.life / this.dur);
    // fade in fast, then out
    this.mat.opacity = t < 0.3 ? Easing.outQuad(t / 0.3) * 0.95 : (1 - Easing.inQuad((t - 0.3) / 0.7)) * 0.95;
    // sweep across the hero's front: +SWEEP → −SWEEP around the strike direction (never behind him)
    this.pivot.rotation.y = this.yaw + SLASH_SWEEP * (1 - 2 * Easing.outCubic(t));
    this.pivot.scale.setScalar(this.baseScale * (1 + 0.25 * t));
    if (this.life <= 0) { this.pivot.visible = false; this.mat.opacity = 0; }
  }
}
const SLASH_SWEEP = 0.35;   // rad each side of the strike direction
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
    // mobile QA: floating texts vanished before they could be read on a phone → every pop lives POP_SLOW× longer (min POP_MIN s)
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
