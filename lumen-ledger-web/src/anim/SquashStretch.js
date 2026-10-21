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
  const side = 1 / Math.sqrt(Math.max(0.05, amount));
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
    // semi-implicit Euler, sub-stepped for stability at low fps
    const steps = dt > 1 / 30 ? 2 : 1; const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -this.stiffness * this.value - this.damping * this.velocity;
      this.velocity += a * h; this.value += this.velocity * h;
    }
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
