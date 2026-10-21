// LUMEN LEDGER — VFX pack 1 (Chat 9A). Contract: API_CONTRACTS §B "VFX pack".
//
//   import { installPack1 } from './src/vfx/pack1.js';
//   const vfx = game.add(new VFX(game)); installPack1(vfx);          // adds 6 pools, hooks them into vfx.update
//   vfx.coinFly(from, to, onArrive, { count, spread, dur })         // coins arc from → to (outQuad), spin, squash on arrival, then onArrive(i)
//   vfx.coinBurst(pos, count = 10, { speed, up, dur })               // coins pop out, bounce once, fade
//   vfx.confetti(pos, count = 40, { spread, up, dur })               // 40 flat quads, gravity + flutter + spin
//   vfx.levelRing(pos, { color, radius, dur, thickness })            // expanding torus that fades (stall level-up, growthStomp)
//   vfx.sparkTrail.emit(pos, { color, size }) / vfx.sparkTrail(pos, …)   // additive dots that shrink (dash / coin trails)
//   vfx.savingSparkle(pos, count = 6, { radius, dur })               // soft stars drifting up around a jar (Save interest tick)
//
// Rules (same as VFX.js): one InstancedMesh per effect (1 draw call each, 0 outline), fixed pool, all scratch vectors
// pre-allocated, no per-frame allocation, delta-time only, hidden instances = zero-scale matrix. Pools stop writing the
// instanceMatrix when nothing is alive. Every effect sets userData.noOutline so addOutline() skips them.
//
// Timings (seconds):              coinFly 0.55 arc (outQuad on the ground path, parabola height ∝ distance) + 0.12 squash on arrival
//   coinBurst 0.9 (bounce at y≤0 with 0.45 restitution)   confetti 1.6 (gravity 4.5, flutter 6 Hz)   levelRing 0.6 (outCubic radius, inQuad fade)
//   sparkTrail 0.35 (shrink inCubic)                      savingSparkle 1.1 (rise 0.9 u, twinkle 8 Hz)
//
// Pool sizes default to {coins 64, confetti 120, rings 6, trail 96, sparkle 48} → 334 instances / 5 draw calls total.

import * as THREE from '../../vendor/three.module.js';
import { G } from '../assets/geo.js';
import { flatMat, toonMat, PALETTE as P } from '../core/Toon.js';
import { Easing } from '../anim/Easing.js';

const _hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Shared base: fixed pool of `items`, one InstancedMesh, hidden by default. Subclasses implement spawn + step(it, i, dt). */
class InstancedPool {
  constructor(scene, geo, mat, n, name) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    this.mesh.userData.noOutline = true; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, _hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.items = Array.from({ length: n }, () => this.makeItem());
    this.alive = 0; this._cursor = 0;
    scene.add(this.mesh);
  }
  makeItem() { return { life: 0, dur: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3() }; }
  /** Next free item (round-robin so bursts spread across the pool); null if pool is exhausted. */
  take() {
    for (let k = 0; k < this.n; k++) { const i = (this._cursor + k) % this.n; const it = this.items[i]; if (it.life <= 0) { this._cursor = i + 1; it.idx = i; this.alive++; return it; } }   // alive++ here so update() does not early-out before the first step
    return null;
  }
  /** Does the per-instance work; subclasses override step(). */
  update(dt) {
    if (!this.alive) return;
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i]; if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) { this.mesh.setMatrixAt(i, _hidden); this.onDie?.(it); continue; }
      alive++; this.step(it, i, dt);
    }
    this.alive = alive; this.mesh.instanceMatrix.needsUpdate = true;
  }
  step() {}
  /** Hide everything immediately. */
  clear() { for (let i = 0; i < this.n; i++) { this.items[i].life = 0; this.mesh.setMatrixAt(i, _hidden); } this.alive = 0; this.mesh.instanceMatrix.needsUpdate = true; }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose?.(); this.mesh.material.dispose?.(); }
}

// ---------------------------------------------------------------- Coins (coinFly + coinBurst share one pool)
export class CoinPool extends InstancedPool {
  constructor(scene, n = 64) {
    super(scene, G.cyl(0.16, 0.16, 0.05, 10), toonMat(P.sparkGold), n, 'vfx.coins');
    this.flyDur = 0.55; this.squashDur = 0.12; this.burstDur = 0.9;
  }
  makeItem() { return { life: 0, dur: 1, mode: 0, pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), vel: new THREE.Vector3(), h: 1, spin: 0, phase: 0, onArrive: null, i: 0, bounced: false }; }
  /**
   * Arc `count` coins from → to. onArrive(i, to) fires once per coin when it lands (after the squash). dur = flight time.
   * @returns number of coins actually spawned (pool may be short)
   */
  fly(from, to, onArrive = null, { count = 1, spread = 0.35, dur = this.flyDur, stagger = 0.04 } = {}) {
    let n = 0;
    for (let k = 0; k < count; k++) {
      const it = this.take(); if (!it) break;
      it.mode = 1; it.i = k; it.onArrive = onArrive;
      it.from.copy(from); it.from.x += (Math.random() - 0.5) * spread; it.from.z += (Math.random() - 0.5) * spread; if (it.from.y < 0.2) it.from.y = 0.2;
      it.to.copy(to); if (it.to.y < 0.25) it.to.y = 0.25;
      const dist = it.from.distanceTo(it.to);
      it.h = 0.6 + Math.min(2.2, dist * 0.35);                     // parabola height grows with distance
      it.dur = dur + k * stagger; it.life = it.dur + this.squashDur; // life includes the arrival squash
      it.spin = 6 + Math.random() * 6; it.phase = Math.random() * Math.PI * 2; it.bounced = false;
      n++;
    }
    return n;
  }
  /** Coins pop out of pos, bounce once, fade. */
  burst(pos, count = 10, { speed = 2.6, up = 3.2, dur = this.burstDur } = {}) {
    let n = 0;
    for (let k = 0; k < count; k++) {
      const it = this.take(); if (!it) break;
      it.mode = 2; it.onArrive = null;
      it.pos.copy(pos); it.pos.y += 0.3;
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      it.vel.set(Math.cos(a) * sp, up * (0.6 + Math.random() * 0.6), Math.sin(a) * sp);
      it.life = it.dur = dur * (0.8 + Math.random() * 0.4); it.spin = 8 + Math.random() * 8; it.phase = Math.random() * 6; it.bounced = false;
      n++;
    }
    return n;
  }
  step(it, i, dt) {
    if (it.mode === 1) {
      const tFlight = Math.min(1, (it.dur + this.squashDur - it.life) / it.dur);
      if (tFlight < 1) {
        const t = Easing.outQuad(tFlight);
        it.pos.lerpVectors(it.from, it.to, t);
        it.pos.y += Math.sin(tFlight * Math.PI) * it.h;             // parabola on top of the straight path
        it.phase += it.spin * dt;
        _e.set(Math.PI / 2 + Math.sin(it.phase) * 0.6, it.phase, 0); _q.setFromEuler(_e);
        _s.setScalar(1);
      } else {
        // arrival squash: 120 ms, flat → overshoot → done (then onArrive)
        if (!it.bounced) { it.bounced = true; it.pos.copy(it.to); }
        const u = 1 - it.life / this.squashDur;
        const sq = u < 0.5 ? 1 - u * 1.2 : 0.4 + Easing.outBack((u - 0.5) * 2) * 0.6;
        _e.set(Math.PI / 2, it.phase, 0); _q.setFromEuler(_e);
        _s.set(1 + (1 - sq) * 0.5, 1, 1 + (1 - sq) * 0.5); _s.y = Math.max(0.05, sq);
      }
      _m.compose(it.pos, _q, _s); this.mesh.setMatrixAt(i, _m);
    } else {
      // burst: ballistic + one bounce + fade by shrink in the last 30 %
      it.vel.y -= 9 * dt; it.pos.addScaledVector(it.vel, dt);
      if (it.pos.y < 0.03) { it.pos.y = 0.03; if (!it.bounced) { it.bounced = true; it.vel.y = -it.vel.y * 0.45; it.vel.x *= 0.6; it.vel.z *= 0.6; } else { it.vel.y = 0; it.vel.x *= 0.85; it.vel.z *= 0.85; } }
      it.phase += it.spin * dt * (it.bounced ? 0.5 : 1);
      const t = 1 - it.life / it.dur;
      const sz = t > 0.7 ? 1 - Easing.inCubic((t - 0.7) / 0.3) : 1;
      _e.set(it.bounced && it.vel.y === 0 ? Math.PI / 2 : it.phase * 0.7, it.phase, 0); _q.setFromEuler(_e);
      _s.setScalar(Math.max(0.001, sz)); _m.compose(it.pos, _q, _s); this.mesh.setMatrixAt(i, _m);
    }
  }
  onDie(it) { if (it.mode === 1 && it.onArrive) { const cb = it.onArrive; it.onArrive = null; cb(it.i, it.to); } }
}

// ---------------------------------------------------------------- Confetti (flat quads, 6 palette colours via instanceColor)
export class ConfettiPool extends InstancedPool {
  constructor(scene, n = 120) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
    super(scene, G.plane(0.16, 0.1), mat, n, 'vfx.confetti');
    this.colors = [P.sparkGold, P.glimmerBlue, 0xFF8A80, 0xA5D6A7, 0xFFFFFF, 0xCE93D8].map((c) => new THREE.Color(c));
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, this.colors[i % this.colors.length]);
    this.mesh.instanceColor.needsUpdate = true;
    this.dur = 1.6;
  }
  makeItem() { return { life: 0, dur: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Vector3(), rotV: new THREE.Vector3(), flutter: 0 }; }
  /** 40 quads burst up and flutter down. */
  burst(pos, count = 40, { spread = 2.6, up = 5, dur = this.dur } = {}) {
    let n = 0;
    for (let k = 0; k < count; k++) {
      const it = this.take(); if (!it) break;
      it.pos.copy(pos); it.pos.y += 0.6;
      const a = Math.random() * Math.PI * 2, sp = spread * (0.3 + Math.random() * 0.7);
      it.vel.set(Math.cos(a) * sp, up * (0.5 + Math.random() * 0.7), Math.sin(a) * sp);
      it.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      it.rotV.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      it.flutter = Math.random() * Math.PI * 2;
      it.life = it.dur = dur * (0.75 + Math.random() * 0.5);
      n++;
    }
    return n;
  }
  step(it, i, dt) {
    it.vel.y -= 4.5 * dt;                                                // gravity, but drag caps fall speed → flutter
    it.vel.multiplyScalar(Math.max(0, 1 - 1.8 * dt));
    if (it.vel.y < -1.6) it.vel.y = -1.6;
    it.flutter += 6 * dt;
    it.pos.addScaledVector(it.vel, dt); it.pos.x += Math.sin(it.flutter) * 0.9 * dt; it.pos.z += Math.cos(it.flutter * 0.8) * 0.9 * dt;
    if (it.pos.y < 0.02) { it.pos.y = 0.02; it.vel.set(0, 0, 0); it.rotV.multiplyScalar(0.8); }
    it.rot.addScaledVector(it.rotV, dt);
    _e.set(it.rot.x, it.rot.y, it.rot.z); _q.setFromEuler(_e);
    const t = 1 - it.life / it.dur; const sz = t > 0.8 ? 1 - Easing.inQuad((t - 0.8) / 0.2) : 1;
    _s.setScalar(Math.max(0.001, sz)); _m.compose(it.pos, _q, _s); this.mesh.setMatrixAt(i, _m);
  }
}

// ---------------------------------------------------------------- Level ring (expanding torus, fades)
export class RingPool extends InstancedPool {
  constructor(scene, n = 6) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    super(scene, G.torus(1, 0.06, 6, 28), mat, n, 'vfx.rings');
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this._c = new THREE.Color();
    this.dur = 0.6;
  }
  makeItem() { return { life: 0, dur: 1, pos: new THREE.Vector3(), r0: 0.2, r1: 2, th: 1 }; }
  /** One ring at pos: radius r0 → radius (outCubic), fades inQuad. */
  show(pos, { color = P.sparkGold, radius = 2.2, start = 0.3, dur = this.dur, thickness = 1, y = 0.08 } = {}) {
    const it = this.take() || this.items[0];                      // pool full → recycle slot 0 (already counted alive)
    it.pos.copy(pos); it.pos.y += y; it.r0 = start; it.r1 = radius; it.th = thickness; it.life = it.dur = dur;
    this._c.set(color); this.mesh.setColorAt(it.idx ?? 0, this._c); this.mesh.instanceColor.needsUpdate = true;
    return it;
  }
  step(it, i, dt) {
    const t = 1 - it.life / it.dur;
    const r = it.r0 + (it.r1 - it.r0) * Easing.outCubic(t);
    const fade = 1 - Easing.inQuad(t);
    _e.set(Math.PI / 2, 0, 0); _q.setFromEuler(_e);
    _s.set(r, r, Math.max(0.05, it.th * (0.4 + fade * 1.2)));        // tube thins as it fades (z = tube axis after the X-rotation)
    _m.compose(it.pos, _q, _s); this.mesh.setMatrixAt(i, _m);
  }
}

// ---------------------------------------------------------------- Spark trail (additive dots that shrink; call emit() every frame while dashing)
export class TrailPool extends InstancedPool {
  constructor(scene, n = 96) {
    super(scene, G.sphere(0.12, 6, 4), flatMat(P.sparkGold, { transparent: true, additive: true, depthWrite: false }), n, 'vfx.trail');
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, new THREE.Color(P.sparkGold));
    this._c = new THREE.Color(); this.dur = 0.35; this._acc = 0;
  }
  makeItem() { return { life: 0, dur: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 1 }; }
  /** One dot at pos (jittered). Returns the item or null. */
  emit(pos, { color = null, size = 1, jitter = 0.12, drift = 0.4, dur = this.dur } = {}) {
    const it = this.take(); if (!it) return null;
    it.pos.copy(pos); it.pos.x += (Math.random() - 0.5) * jitter; it.pos.y += 0.35 + (Math.random() - 0.5) * jitter; it.pos.z += (Math.random() - 0.5) * jitter;
    it.vel.set((Math.random() - 0.5) * drift, drift * 0.6, (Math.random() - 0.5) * drift);
    it.size = size * (0.7 + Math.random() * 0.6); it.life = it.dur = dur;
    if (color !== null) { this._c.set(color); this.mesh.setColorAt(it.idx, this._c); this.mesh.instanceColor.needsUpdate = true; }
    return it;
  }
  /** Convenience: emit `rate` dots per second from a moving source (call each frame). */
  stream(pos, dt, rate = 40, opts) { this._acc += dt * rate; while (this._acc >= 1) { this._acc -= 1; this.emit(pos, opts); } }
  step(it, i, dt) {
    it.pos.addScaledVector(it.vel, dt);
    const t = 1 - it.life / it.dur; const sz = it.size * (1 - Easing.inCubic(t));
    _s.setScalar(Math.max(0.001, sz)); _q.identity(); _m.compose(it.pos, _q, _s); this.mesh.setMatrixAt(i, _m);
  }
}

// ---------------------------------------------------------------- Saving sparkle (soft stars that rise and twinkle around a jar)
export class SparklePool extends InstancedPool {
  constructor(scene, n = 48) {
    super(scene, G.ico(0.09, 0), flatMat(0xFFF8D6, { transparent: true, additive: true, depthWrite: false }), n, 'vfx.sparkle');
    this.dur = 1.1;
  }
  makeItem() { return { life: 0, dur: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), phase: 0, size: 1 }; }
  /** `count` sparkles spawn on a ring of `radius` around pos and drift up 0.9 u while twinkling at 8 Hz. */
  burst(pos, count = 6, { radius = 0.45, rise = 0.9, dur = this.dur, size = 1 } = {}) {
    let n = 0;
    for (let k = 0; k < count; k++) {
      const it = this.take(); if (!it) break;
      const a = (k / count) * Math.PI * 2 + Math.random() * 0.5;
      it.pos.set(pos.x + Math.cos(a) * radius, pos.y + 0.2 + Math.random() * 0.3, pos.z + Math.sin(a) * radius);
      it.vel.set(Math.cos(a) * 0.15, rise / dur, Math.sin(a) * 0.15);
      it.phase = Math.random() * Math.PI * 2; it.size = size * (0.7 + Math.random() * 0.6);
      it.life = it.dur = dur * (0.8 + Math.random() * 0.4);
      n++;
    }
    return n;
  }
  step(it, i, dt) {
    it.pos.addScaledVector(it.vel, dt); it.phase += 8 * dt;
    const t = 1 - it.life / it.dur;
    const env = Math.sin(t * Math.PI);                                   // in → out envelope
    const tw = 0.6 + 0.4 * Math.abs(Math.sin(it.phase));                 // twinkle
    _e.set(it.phase * 0.5, it.phase, 0); _q.setFromEuler(_e);
    _s.setScalar(Math.max(0.001, it.size * env * tw)); _m.compose(it.pos, _q, _s); this.mesh.setMatrixAt(i, _m);
  }
}

// ---------------------------------------------------------------- install
/**
 * Adds the 6 pack-1 effects to a VFX instance (API_CONTRACTS §B). Idempotent. Returns the pools object.
 * Hooks into vfx.update so the Game's single `game.add(vfx)` keeps driving everything (hit-stop aware: uses the scaled dt).
 * opts.sizes overrides pool sizes: { coins, confetti, rings, trail, sparkle }.
 */
export function installPack1(vfx, opts = {}) {
  if (vfx.pack1) return vfx.pack1;
  const scene = vfx.game?.scene || opts.scene; if (!scene) throw new Error('installPack1: vfx.game.scene missing');
  const sz = { coins: 64, confetti: 120, rings: 6, trail: 96, sparkle: 48, ...(opts.sizes || {}) };
  const pools = {
    coins: new CoinPool(scene, sz.coins),
    confetti: new ConfettiPool(scene, sz.confetti),
    rings: new RingPool(scene, sz.rings),
    trail: new TrailPool(scene, sz.trail),
    sparkle: new SparklePool(scene, sz.sparkle),
  };
  const list = Object.values(pools);
  // Contract names (functions on vfx). Each is callable AND carries method aliases, because the 3A/3B/6A hooks call
  // vfx.coinBurst.burst / vfx.confetti.burst / vfx.levelRing.show / vfx.savingSparkle.burst / vfx.sparkTrail.emit
  // (see heroAbilities.js `hook(M, pool, fn)`), while customers.js calls vfx.coinFly(from, to) directly.
  const withAlias = (fn, names) => { for (const n of names) fn[n] = fn; return fn; };
  vfx.coinFly = withAlias((from, to, onArrive, o) => pools.coins.fly(from, to, onArrive, o), ['fly', 'burst']);
  vfx.coinBurst = withAlias((pos, count, o) => pools.coins.burst(pos, count, o), ['burst']);
  vfx.confetti = withAlias((pos, count, o) => pools.confetti.burst(pos, count, o), ['burst']);
  vfx.levelRing = withAlias((pos, o) => pools.rings.show(pos, o), ['show', 'burst']);
  vfx.savingSparkle = withAlias((pos, count, o) => pools.sparkle.burst(pos, count, o), ['burst']);
  vfx.coinFly.pool = vfx.coinBurst.pool = pools.coins; vfx.confetti.pool = pools.confetti; vfx.levelRing.pool = pools.rings; vfx.savingSparkle.pool = pools.sparkle;
  // sparkTrail is callable (one dot) AND has .emit/.stream for per-frame use
  const trail = (pos, o) => pools.trail.emit(pos, o);
  trail.emit = (pos, o) => pools.trail.emit(pos, o); trail.burst = (pos, n = 3, o) => { for (let i = 0; i < n; i++) pools.trail.emit(pos, o); };
  trail.stream = (pos, dt, rate, o) => pools.trail.stream(pos, dt, rate, o); trail.pool = pools.trail;
  vfx.sparkTrail = trail;
  // registry (API_CONTRACTS mentions vfx.register(name, pool) — provide it if VFX.js has none)
  if (!vfx.pools) vfx.pools = {};
  if (!vfx.register) vfx.register = (name, pool) => { vfx.pools[name] = pool; return pool; };
  for (const [k, p] of Object.entries(pools)) vfx.register('pack1.' + k, p);
  // chain into vfx.update (keeps VFX a single Game system)
  const prev = vfx.update.bind(vfx);
  vfx.update = (dt, game, dtReal) => { prev(dt, game, dtReal); for (const p of list) p.update(dt); };
  vfx.pack1 = {
    pools, list,
    /** live instance count across the pack (for stats) */
    get alive() { let n = 0; for (const p of list) n += p.alive; return n; },
    /** sum of pool sizes */
    get capacity() { let n = 0; for (const p of list) n += p.n; return n; },
    clear() { for (const p of list) p.clear(); },
    dispose() { for (const p of list) p.dispose(); vfx.update = prev; delete vfx.pack1; },
  };
  return vfx.pack1;
}

export const PACK1_NAMES = ['coinFly', 'coinBurst', 'confetti', 'levelRing', 'sparkTrail', 'savingSparkle'];
export default installPack1;
