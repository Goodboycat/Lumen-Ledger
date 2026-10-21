// LUMEN LEDGER — VFX pack 2: Debt Fog (Chat 9B). Contract: API_CONTRACTS §B "VFX pack".
//
//   import { installPack2 } from './src/vfx/pack2.js';
//   installPack1(vfx); installPack2(vfx, { island, lighthouse? })   // pack1 optional (coinRain falls back to its own small coin pool)
//   vfx.fog.setCoverage(fog01, { immediate })   ← Debt Fog ring at the island edge, reaches inward by fog01 (outCubic 600 ms)
//   vfx.fog.push(origin, dir, strength)         ← 3B fogSweep hook: blobs in front of the hero are shoved back + squashed (0.9 s)
//   vfx.fog.coverage / targetCoverage / reach   · vfx.fogShader = vfx.fog (alias the 3B abilities call: vfx.fogShader.push)
//   vfx.debtPulse(strength = 0.5, { ms, color })  / vfx.debtPulse.pulse(pos?, strength)   ← red DOM vignette pulse (inQuad in 80 ms → outCubic out)
//   vfx.vignette.set(amount01, { color })        ← persistent soft purple vignette, usually driven from fog01 (vfx.fog does this automatically)
//   vfx.coinRain(pos, count = 12, { radius, height })  / .burst(pos, n)   ← coins fall from the sky around pos, bounce once (growthStomp hook)
//   vfx.lighthouseBeam.show(lampPos | lighthouseGroup, { on })  / .sweep(ms)   ← additive beam cone sweeping 360° (0.6 rad/s), fades in 400 ms
//   vfx.fogRecede({ onDone })  → Sequence       ← WIN celebration: anticipation 300 (fog breathes in) → recede 1200 outCubic (ring to 0, blobs sink) → beam on 400
//
// Rules (same as VFX.js / pack1.js): one InstancedMesh for all fog blobs (1 draw call, no outline — fog is translucent), fixed
// pool, pre-allocated scratch vectors, no per-frame allocation, delta-time only, hidden = zero-scale. Every mesh sets userData.noOutline.
//
// Fog ring model: N blobs sit on a circle of radius R_edge (island radius + 1.5) at angles 2πi/N. Each blob i has its own
// inward reach r_i = fog01 * (R_edge - R_core) * depth_i (depth_i ∈ 0.7..1.3, from the seed) and sits at radius R_edge - r_i.
// Blob scale grows with reach (0.9 → 2.2) so the ring thickens as it closes in. Bob: y = 0.35 + sin(t·1.1 + φ_i)·0.12.
// Drift: angle wobbles ±0.03 rad at 0.4 Hz. coverage → targetCoverage via outCubic 600 ms (setCoverage snapshots from/to).
//
// Timings:  coverage 600 ms outCubic · push 900 ms (shove 150 inQuad → settle 750 outElastic) · debtPulse 80 in / 520 out
//           coinRain fall ≈ 0.7 s + bounce (0.9 s life) · beam fade 400 ms, sweep 0.6 rad/s · fogRecede 300 + 1200 + 400 = 1900 ms
import * as THREE from '../../vendor/three.module.js';
import { G } from '../assets/geo.js';
import { toonMat, PALETTE as P } from '../core/Toon.js';
import { Easing } from '../anim/Easing.js';
import { Sequence } from '../anim/Sequencer.js';

const _hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _p = new THREE.Vector3();
const hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function';

// ---------------------------------------------------------------- Debt Fog ring
export class DebtFog {
  /**
   * @param {THREE.Scene} scene
   * @param {{ island?: {radius:number}, radius?: number, core?: number, count?: number, seed?: number, vignette?: Vignette }} opts
   */
  constructor(scene, opts = {}) {
    const R = opts.radius ?? ((opts.island && opts.island.radius) || 11) + 1.5;
    this.edge = R; this.core = opts.core ?? 2.5;                         // fog01 = 1 → blobs reach R_core (island centre is swallowed)
    this.n = Math.min(60, opts.count ?? 48);
    this.coverage = 0; this.targetCoverage = 0; this._from = 0; this._t = 1; this.animMs = 600;
    this.time = 0; this.vignette = opts.vignette || null;
    const mat = toonMat(P.debtFog, { transparent: true, opacity: 0.72 });
    this.mesh = new THREE.InstancedMesh(G.sphere(0.7, 9, 6), mat, this.n);
    this.mesh.name = 'vfx.debtFog'; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    this.mesh.userData.noOutline = true; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.renderOrder = 5;
    // deterministic per-blob variation (no Math.random at runtime → stable between frames and in tests)
    let s = (opts.seed ?? 9) * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    this.blobs = Array.from({ length: this.n }, (_, i) => ({
      a: (i / this.n) * Math.PI * 2, depth: 0.7 + rnd() * 0.6, phase: rnd() * Math.PI * 2, size: 0.85 + rnd() * 0.3,
      push: 0, pushT: 1, pushDir: new THREE.Vector3(), lift: 0,              // push = current outward shove (u), lift = win-recede sink
    }));
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, _hidden);
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.visible = false;
    scene.add(this.mesh);
    this.dirty = true;
  }
  /** Inward reach in world units at the current coverage (0 at fog01 = 0). */
  get reach() { return this.coverage * (this.edge - this.core); }
  /** Animate coverage → fog01 (outCubic 600 ms). immediate: snap. */
  setCoverage(fog01, { immediate = false, ms = this.animMs } = {}) {
    const to = Math.max(0, Math.min(1, +fog01 || 0));
    this.targetCoverage = to;
    if (immediate || ms <= 0) { this.coverage = to; this._from = to; this._t = 1; }
    else { this._from = this.coverage; this._t = 0; this._dur = ms / 1000; }
    this.dirty = true;
    return this;
  }
  /** 3B fogSweep hook: blobs within ±60° of dir (seen from origin) and within 5 u are shoved outward by 1.6·strength u, then spring back. */
  push(origin, dir, strength = 1) {
    const ox = origin.x, oz = origin.z; let hit = 0;
    for (const b of this.blobs) {
      this._posOf(b, _p);
      _v.set(_p.x - ox, 0, _p.z - oz); const d = _v.length(); if (d > 5.5 || d < 1e-4) continue;
      _v.divideScalar(d); const cos = _v.x * dir.x + _v.z * dir.z; if (cos < 0.5) continue;
      b.push = 1.6 * strength * cos * (1 - d / 6); b.pushT = 0; b.pushDir.copy(_v); hit++;
    }
    this.dirty = true;
    return hit;
  }
  /** Position of blob b at the current coverage (without bob/push). */
  _posOf(b, out) {
    const r = this.edge - this.reach * b.depth;
    const a = b.a + Math.sin(this.time * 0.4 * Math.PI * 2 + b.phase) * 0.03;
    return out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  update(dt) {
    this.time += dt;
    if (this._t < 1) { this._t = Math.min(1, this._t + dt / this._dur); this.coverage = this._from + (this.targetCoverage - this._from) * Easing.outCubic(this._t); this.dirty = true; }
    const vis = this.coverage > 0.002 || this.dirty;
    this.mesh.visible = this.coverage > 0.002;
    if (this.vignette) this.vignette.set(Math.max(0, this.coverage - 0.15) * 0.8);
    if (!vis) return;
    let anyPush = false;
    for (let i = 0; i < this.n; i++) {
      const b = this.blobs[i];
      if (this.coverage <= 0.002) { this.mesh.setMatrixAt(i, _hidden); continue; }
      this._posOf(b, _p);
      // push: shove 150 ms inQuad out, settle 750 ms outElastic back
      if (b.pushT < 1) { anyPush = true; b.pushT = Math.min(1, b.pushT + dt / 0.9); const u = b.pushT; const k = u < 1 / 6 ? Easing.inQuad(u * 6) : 1 - Easing.outElastic((u - 1 / 6) / (5 / 6)); _p.addScaledVector(b.pushDir, b.push * k); }
      const grow = 0.9 + this.reach / (this.edge - this.core) * 1.3;    // 0.9 → 2.2 as the ring closes in
      const sq = b.pushT < 0.2 ? 1 - 0.35 * Math.sin(b.pushT * 5 * Math.PI) : 1;
      const bob = Math.sin(this.time * 1.1 + b.phase) * 0.12;
      _p.y = 0.35 + bob - b.lift;
      _s.set(grow * b.size * (2 - sq), grow * b.size * sq * Math.max(0.05, 1 - b.lift), grow * b.size * (2 - sq));
      _e.set(0, b.a + this.time * 0.1, 0); _q.setFromEuler(_e);
      _m.compose(_p, _q, _s); this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dirty = anyPush || this.coverage > 0.002;                        // keep animating (bob) while visible
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose?.(); }
}

// ---------------------------------------------------------------- DOM vignette (persistent) + debt pulse (transient red)
export class Vignette {
  constructor(container) {
    this.amount = 0; this.color = '123, 94, 167'; this.el = null;
    if (!hasDOM || !container || !container.appendChild) return;
    this.el = document.createElement('div'); this.el.className = 'vfx-vignette';
    Object.assign(this.el.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 40, opacity: '0', transition: 'opacity 120ms linear' });
    this._paint(); container.appendChild(this.el);
  }
  _paint() { if (this.el) this.el.style.background = `radial-gradient(ellipse at center, rgba(${this.color},0) 45%, rgba(${this.color},0.55) 80%, rgba(${this.color},0.9) 100%)`; }
  /** amount 0..1 → opacity. Cheap: only touches the DOM when the rounded value changes. */
  set(amount, { color = null } = {}) {
    const a = Math.max(0, Math.min(1, amount));
    if (color) { const c = new THREE.Color(color); this.color = `${(c.r * 255) | 0}, ${(c.g * 255) | 0}, ${(c.b * 255) | 0}`; this._paint(); }
    if (Math.abs(a - this.amount) < 0.004) return this;
    this.amount = a; if (this.el) this.el.style.opacity = a.toFixed(3);
    return this;
  }
  dispose() { this.el?.parentNode?.removeChild(this.el); }
}

export class DebtPulse {
  constructor(container) {
    this.life = 0; this.dur = 0.6; this.max = 0.5; this.opacity = 0; this.el = null;
    if (!hasDOM || !container || !container.appendChild) return;
    this.el = document.createElement('div'); this.el.className = 'vfx-debt-pulse';
    Object.assign(this.el.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 41, opacity: '0',
      background: 'radial-gradient(ellipse at center, rgba(239,83,80,0) 35%, rgba(239,83,80,0.7) 85%, rgba(239,83,80,1) 100%)' });
    container.appendChild(this.el);
  }
  /** Red vignette pulse: 80 ms inQuad up to `strength`, then 520 ms outCubic down. Stacking takes the max. */
  pulse(strength = 0.5, { ms = 600, color = null } = {}) {
    if (typeof strength === 'object' && strength) { strength = arguments[1] ?? 0.5; }  // tolerate pulse(pos, strength) from the 3B hook
    this.max = Math.max(this.life > 0 ? this.max : 0, Math.min(1, +strength || 0.5));
    this.life = this.dur = ms / 1000;
    if (color && this.el) this.el.style.background = `radial-gradient(ellipse at center, transparent 35%, ${color} 100%)`;
    return this;
  }
  update(dtReal) {
    if (this.life <= 0) return;
    this.life -= dtReal; const t = 1 - Math.max(0, this.life) / this.dur;
    const inEnd = 0.08 / this.dur;
    this.opacity = t < inEnd ? Easing.inQuad(t / inEnd) * this.max : (1 - Easing.outCubic((t - inEnd) / (1 - inEnd))) * this.max;
    if (this.life <= 0) this.opacity = 0;
    if (this.el) this.el.style.opacity = this.opacity.toFixed(3);
  }
  dispose() { this.el?.parentNode?.removeChild(this.el); }
}

// ---------------------------------------------------------------- Coin rain (its own tiny pool when pack1 is absent; reuses pack1's CoinPool otherwise)
export class CoinRainPool {
  constructor(scene, n = 48) {
    this.n = n; this.mesh = new THREE.InstancedMesh(G.cyl(0.16, 0.16, 0.05, 10), toonMat(P.sparkGold), n);
    this.mesh.name = 'vfx.coinRain'; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.userData.noOutline = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, _hidden);
    this.items = Array.from({ length: n }, () => ({ life: 0, dur: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0, phase: 0, bounced: false, delay: 0 }));
    this.alive = 0; scene.add(this.mesh);
  }
  /** `count` coins drop from `height` onto a disc of `radius` around pos, staggered 0.03 s, bounce once, shrink out. */
  burst(pos, count = 12, { radius = 1.6, height = 4, dur = 1.4, stagger = 0.03 } = {}) {
    let n = 0;
    for (let k = 0; k < count; k++) {
      const it = this.items.find((i) => i.life <= 0); if (!it) break;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      it.pos.set(pos.x + Math.cos(a) * r, pos.y + height + Math.random() * 1.2, pos.z + Math.sin(a) * r);
      it.vel.set(0, -0.5, 0); it.spin = 6 + Math.random() * 6; it.phase = Math.random() * 6; it.bounced = false;
      it.delay = k * stagger; it.life = it.dur = dur + it.delay; this.alive++; n++;
    }
    return n;
  }
  update(dt) {
    if (!this.alive) return;
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i]; if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) { this.mesh.setMatrixAt(i, _hidden); continue; }
      alive++;
      if (it.delay > 0) { it.delay -= dt; this.mesh.setMatrixAt(i, _hidden); continue; }
      it.vel.y -= 11 * dt; it.pos.addScaledVector(it.vel, dt);
      if (it.pos.y < 0.03) { it.pos.y = 0.03; if (!it.bounced) { it.bounced = true; it.vel.y = -it.vel.y * 0.35; it.vel.x = (Math.random() - 0.5) * 0.8; it.vel.z = (Math.random() - 0.5) * 0.8; } else { it.vel.set(0, 0, 0); } }
      it.phase += it.spin * dt * (it.vel.y === 0 ? 0 : 1);
      const t = 1 - it.life / it.dur; const sz = t > 0.75 ? 1 - Easing.inCubic((t - 0.75) / 0.25) : 1;
      _e.set(it.vel.y === 0 ? Math.PI / 2 : it.phase * 0.8, it.phase, 0); _q.setFromEuler(_e);
      _s.setScalar(Math.max(0.001, sz)); _m.compose(it.pos, _q, _s); this.mesh.setMatrixAt(i, _m);
    }
    this.alive = alive; this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (let i = 0; i < this.n; i++) { this.items[i].life = 0; this.mesh.setMatrixAt(i, _hidden); } this.alive = 0; this.mesh.instanceMatrix.needsUpdate = true; }
  dispose() { this.mesh.parent?.remove(this.mesh); }
}

// ---------------------------------------------------------------- Lighthouse beam (one additive cone, sweeps)
export class LighthouseBeam {
  constructor(scene) {
    const geo = G.cyl(0.25, 2.6, 14, 10);                                 // narrow at the lamp, wide at the far end; rotated to lie along +x
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.pivot = new THREE.Group(); this.pivot.name = 'vfx.beamPivot'; this.pivot.visible = false;
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.rotation.z = -Math.PI / 2; this.mesh.position.x = 7; this.mesh.userData.noOutline = true; this.mesh.frustumCulled = false;
    this.pivot.add(this.mesh); this.pivot.userData.noOutline = true; scene.add(this.pivot);
    this.on = false; this.fade = 0; this.fadeMs = 400; this.speed = 0.6; this.maxOpacity = 0.35; this.sweepLeft = 0;
  }
  /** Place at a lamp position (Vector3) or a lighthouse group (uses group.position + userData.lampPos). on: start fading in. */
  show(target, { on = true } = {}) {
    if (target) {
      if (target.isVector3) this.pivot.position.copy(target);
      else { this.pivot.position.copy(target.position); if (target.userData && target.userData.lampPos) this.pivot.position.add(target.userData.lampPos); else this.pivot.position.y += 4; }
    }
    this.on = on; this.pivot.visible = true;
    return this;
  }
  hide() { this.on = false; return this; }
  /** Fade in and sweep for `ms`, then fade out. */
  sweep(ms = 3000) { this.show(null, { on: true }); this.sweepLeft = ms / 1000; return this; }
  update(dt) {
    if (this.sweepLeft > 0) { this.sweepLeft -= dt; if (this.sweepLeft <= 0) this.on = false; }
    const tgt = this.on ? 1 : 0;
    if (this.fade !== tgt) { this.fade += Math.sign(tgt - this.fade) * dt / (this.fadeMs / 1000); this.fade = Math.max(0, Math.min(1, this.fade)); }
    if (this.fade <= 0 && !this.on) { this.pivot.visible = false; this.mesh.material.opacity = 0; return; }
    this.pivot.visible = true; this.pivot.rotation.y += dt * this.speed;
    this.mesh.material.opacity = Easing.outCubic(this.fade) * this.maxOpacity;
  }
  dispose() { this.pivot.parent?.remove(this.pivot); this.mesh.material.dispose(); }
}

// ---------------------------------------------------------------- WIN celebration: fog recede Sequence
// | phase        |  ms  | easing    | what                                                                                  |
// |--------------|------|-----------|---------------------------------------------------------------------------------------|
// | anticipation |  300 | inOutCubic| fog "inhales": coverage → cov0 + 0.08, blobs lift 0 → -0.15 (rise slightly)             |
// | recede       | 1200 | outCubic  | coverage → 0, blobs sink (lift 0 → 1, flattens them), ring opacity 0.72 → 0 via lift     |
// | relight      |  400 | outBack   | lighthouse beam on (show + fade), confetti/coinRain hook if pack1 present, done           |
export function makeFogRecedeSequence(vfx, { onDone = null, lighthouse = null, confetti = true } = {}) {
  const fog = vfx.fog; let cov0 = 0;
  const seq = new Sequence('fogRecede')
    .phase('anticipation', 300, Easing.inOutCubic, (e) => { fog.coverage = Math.min(1, cov0 + 0.08 * e); for (const b of fog.blobs) b.lift = -0.15 * e; fog.dirty = true; },
      { onEnter: () => { cov0 = fog.coverage; fog.targetCoverage = 0; fog._t = 1; } })
    .phase('recede', 1200, Easing.outCubic, (e) => { fog.coverage = (cov0 + 0.08) * (1 - e); for (const b of fog.blobs) b.lift = -0.15 + 1.15 * e; fog.dirty = true; })
    .phase('relight', 400, Easing.outBack, () => {}, { onEnter: () => {
      fog.coverage = 0; for (const b of fog.blobs) b.lift = 0; fog.dirty = true;
      if (lighthouse) vfx.lighthouseBeam.show(lighthouse, { on: true }); else vfx.lighthouseBeam.on = true;
      if (confetti && vfx.confetti) { _v.copy(vfx.lighthouseBeam.pivot.position); _v.y = 0; vfx.confetti(_v, 40); }
      if (vfx.coinRain) { _v.copy(vfx.lighthouseBeam.pivot.position); _v.y = 0; vfx.coinRain(_v, 10); }
    } })
    .then(() => { onDone && onDone(); });
  return seq;
}

// ---------------------------------------------------------------- install
/**
 * Adds the pack-2 effects to a VFX instance. Idempotent. opts: { island, lighthouse, fogCount, seed, scene, container }.
 * Chains into vfx.update (fog/beam/coinRain use scaled dt; DOM vignette + pulse use real dt).
 */
export function installPack2(vfx, opts = {}) {
  if (vfx.pack2) return vfx.pack2;
  const scene = vfx.game?.scene || opts.scene; if (!scene) throw new Error('installPack2: vfx.game.scene missing');
  const container = vfx.game?.container || opts.container || (hasDOM ? document.body : null);
  const vignette = new Vignette(container);
  const fog = new DebtFog(scene, { island: opts.island, radius: opts.radius, core: opts.core, count: opts.fogCount, seed: opts.seed, vignette });
  const pulse = new DebtPulse(container);
  const beam = new LighthouseBeam(scene);
  const rain = vfx.pack1 && vfx.pack1.pools && vfx.pack1.pools.coins ? null : new CoinRainPool(scene, opts.rainCount ?? 48);

  vfx.fog = fog; vfx.fogShader = fog;                                     // 3B calls vfx.fogShader.push(origin, dir, strength)
  vfx.vignette = vignette;
  const dp = (strength, o) => pulse.pulse(strength, o); dp.pulse = (a, b, o) => (a && typeof a === 'object' ? pulse.pulse(b ?? 0.5, o) : pulse.pulse(a, b)); dp.el = pulse.el; dp.ctl = pulse;
  vfx.debtPulse = dp;
  const rainFn = rain
    ? (pos, count, o) => rain.burst(pos, count, o)
    : (pos, count = 12, { radius = 1.6, height = 4 } = {}) => {              // pack1 present: drop coins with its CoinPool (fly from above → bounce via burst-mode)
        const coins = vfx.pack1.pools.coins; let n = 0;
        for (let k = 0; k < count; k++) { const it = coins.take(); if (!it) break; it.mode = 2; it.onArrive = null; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
          it.pos.set(pos.x + Math.cos(a) * r, pos.y + height + Math.random() * 1.2, pos.z + Math.sin(a) * r); it.vel.set(0, -0.5, 0); it.life = it.dur = 1.2 + k * 0.03; it.spin = 6 + Math.random() * 6; it.phase = Math.random() * 6; it.bounced = false; n++; }
        return n;
      };
  rainFn.burst = rainFn; rainFn.pool = rain || vfx.pack1.pools.coins;
  vfx.coinRain = rainFn;
  vfx.lighthouseBeam = beam;
  if (opts.lighthouse) beam.show(opts.lighthouse, { on: false });
  vfx.fogRecede = (o) => { const seq = makeFogRecedeSequence(vfx, { lighthouse: opts.lighthouse, ...(o || {}) }); const player = vfx.game?.sequences; if (player && player.play) player.play(seq, vfx); else seq.play(vfx); return seq; };
  if (!vfx.pools) vfx.pools = {};
  if (!vfx.register) vfx.register = (name, pool) => { vfx.pools[name] = pool; return pool; };
  vfx.register('pack2.fog', fog); vfx.register('pack2.beam', beam); vfx.register('pack2.pulse', pulse); vfx.register('pack2.vignette', vignette); if (rain) vfx.register('pack2.coinRain', rain);

  const prev = vfx.update.bind(vfx);
  vfx.update = (dt, game, dtReal) => { prev(dt, game, dtReal); fog.update(dt); beam.update(dt); if (rain) rain.update(dt); pulse.update(dtReal ?? dt); };
  vfx.pack2 = {
    fog, beam, pulse, vignette, rain,
    get alive() { return (rain ? rain.alive : 0) + (fog.mesh.visible ? fog.n : 0) + (beam.pivot.visible ? 1 : 0); },
    clear() { fog.setCoverage(0, { immediate: true }); fog.update(0); beam.hide(); beam.fade = 0; beam.update(0); rain?.clear(); pulse.life = 0; pulse.update(0); vignette.set(0); },
    dispose() { fog.dispose(); beam.dispose(); rain?.dispose(); pulse.dispose(); vignette.dispose(); vfx.update = prev; delete vfx.pack2; delete vfx.fog; delete vfx.fogShader; },
  };
  return vfx.pack2;
}

export const PACK2_NAMES = ['fog', 'debtPulse', 'coinRain', 'lighthouseBeam', 'vignette', 'fogRecede'];
export default installPack2;
