// Easing functions. All take t in [0,1] and return eased value.
// Names are the canonical ones used by every chat (see docs/API_CONTRACTS.md).
export const Easing = {
  linear: (t) => t,

  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  inCubic: (t) => t * t * t,
  outCubic: (t) => --t * t * t + 1,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - --t * t * t * t,
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t),

  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),

  // Overshoot family (the "snappy" XP Hero feel)
  outBack: (t, s = 1.70158) => --t * t * ((s + 1) * t + s) + 1,
  inBack: (t, s = 1.70158) => t * t * ((s + 1) * t - s),
  inOutBack: (t, s = 1.70158 * 1.525) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((s + 1) * 2 * t - s)) / 2
      : (Math.pow(2 * t - 2, 2) * ((s + 1) * (t * 2 - 2) + s) + 2) / 2,

  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },

  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },

  // Strike ease: accelerate hard then slight overshoot (ease-in + overshoot)
  strike: (t) => {
    const a = t * t * t; // accelerate
    const over = 1 + 0.08 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.7) / 0.3)));
    return t < 0.7 ? a / 0.343 * 1 * (0.343) / 0.343 * (a < 0.343 ? 1 : 1) : over;
  },
};

// Fixed cleaner strike: cubic ease-in to 1.0 at t=0.75, then overshoot to 1.06 and settle.
Easing.strike = (t) => {
  if (t < 0.75) {
    const k = t / 0.75;
    return k * k * k;
  }
  const k = (t - 0.75) / 0.25;
  return 1 + 0.06 * Math.sin(Math.PI * k);
};

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function remap(v, inLo, inHi, outLo, outHi) {
  return outLo + ((v - inLo) / (inHi - inLo)) * (outHi - outLo);
}
// Frame-rate independent exponential smoothing. k ≈ "speed" (8–20 feels snappy).
export function damp(current, target, k, dt) {
  return lerp(current, target, 1 - Math.exp(-k * dt));
}
export function smoothstep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
