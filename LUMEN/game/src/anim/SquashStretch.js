// SquashStretch: volume-preserving scale helpers + a spring-based "jelly" settle.
// Apply to any THREE.Object3D (usually a `body` pivot group whose origin is at the feet).
import { damp } from './Easing.js';
import { Vector3 } from '../../vendor/three.module.js';

/**
 * Set volume-preserving squash on `obj.scale`.
 * amount < 1 squashes (wide + short), > 1 stretches (tall + thin).
 * axis: 'y' (default) | 'x' | 'z'
 */
export function setSquash(obj, amount, axis = 'y') {
  // BUGFIX S44: clamp both ends (was only a lower bound) so a runaway spring / huge dt can never stretch a body > 2.5×
  amount = Math.min(SQUASH_MAX, Math.max(SQUASH_MIN, Number.isFinite(amount) ? amount : 1));
  const side = 1 / Math.sqrt(amount);
  const s = obj.scale;
  if (axis === 'y') s.set(side, amount, side);
  else if (axis === 'x') s.set(amount, side, side);
  else s.set(side, side, amount);
}

/**
 * Stretch along an arbitrary world-space direction using a wrapper group.
 * `wrapper` must be a Group whose only child is the mesh. We rotate the wrapper
 * to align its Y axis with `dir` then scale (so stretch is along `dir`).
 */
export function setStretchAlong(wrapper, dir, along, across) {
  wrapper.quaternion.setFromUnitVectors(_up, _tmp.copy(dir).normalize());
  wrapper.scale.set(across, along, across);
}

/**
 * Spring (damped harmonic) that makes bodies "jiggle" back to rest.
 * Use for landing settles, hit reactions, coin pickups.
 *   const jelly = new JellySpring(); jelly.kick(-0.3); ... jelly.update(dt); setSquash(body, 1 + jelly.value)
 */
export class JellySpring {
  constructor(stiffness = 220, damping = 14) {
    this.value = 0; this.velocity = 0;
    this.stiffness = stiffness; this.damping = damping;
  }
  kick(impulse) { this.velocity += impulse; }
  set(v) { this.value = v; this.velocity = 0; }
  update(dt) {
    // BUGFIX S44 (speed ×2/×3 + Spark Storm "stretched characters"): semi-implicit Euler is only stable while
    // h·sqrt(stiffness) < 2, i.e. h < ~0.12 s at k=240–260. With game.timeScale 3 and maxDt 0.1 the old code took 2 steps of
    // 0.15 s and DIVERGED — the spring value grew every frame and setSquash(body, 1+value) stretched bodies tall + wide.
    // Now: fixed sub-step ≤ SPRING_H (1/120 s) and the state is clamped, so no dt can ever blow it up.
    if (!(dt > 0)) return this.value;
    if (dt > SPRING_DT_MAX) dt = SPRING_DT_MAX;
    const steps = Math.ceil(dt / SPRING_H); const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -this.stiffness * this.value - this.damping * this.velocity;
      this.velocity += a * h; this.value += this.velocity * h;
    }
    if (!Number.isFinite(this.value) || !Number.isFinite(this.velocity)) { this.value = 0; this.velocity = 0; }
    if (this.value > SPRING_CLAMP) this.value = SPRING_CLAMP; else if (this.value < -SPRING_CLAMP) this.value = -SPRING_CLAMP;
    return this.value;
  }
  get settled() { return Math.abs(this.value) < 0.001 && Math.abs(this.velocity) < 0.01; }
}

/** Simple idle breathing: returns squash amount around 1. */
export function breathe(time, speed = 2.2, amp = 0.03) {
  return 1 + Math.sin(time * speed) * amp;
}

/** Walk bob: y offset and tilt for a hopping XP-Hero gait. */
export function walkBob(phase, hop = 0.12) {
  const s = Math.abs(Math.sin(phase));
  return { y: s * hop, squash: 1 + (s - 0.5) * 0.16, tilt: Math.sin(phase * 2) * 0.08 };
}

/** Smoothly return a scale vector toward (1,1,1). */
export function relaxScale(obj, k, dt) {
  const s = obj.scale;
  s.x = damp(s.x, 1, k, dt); s.y = damp(s.y, 1, k, dt); s.z = damp(s.z, 1, k, dt);
}

const _up = new Vector3(0, 1, 0);
const _tmp = new Vector3();
// S44 stability constants (see JellySpring.update / setSquash)
const SPRING_H = 1 / 120;      // max integration sub-step (s) — stable for stiffness up to ~57 000
const SPRING_DT_MAX = 0.5;     // a single update never integrates more than this (a 0.5 s hitch at 3× settles anyway)
const SPRING_CLAMP = 1.2;      // |value| cap → body scaleY stays within [~-0.2, 2.2] before setSquash's own clamp
const SQUASH_MIN = 0.3, SQUASH_MAX = 2.5;
