// S67 Focus meter — pure, no DOM, no three. Replaces the flat 5 s ability cooldown.
//   import { createFocus, FOCUS_COST, GAP_S } from './focus.js';
// Powers cost Focus (0..100). It refills by itself (+0.67/s, S75: 3x slower) and faster when the player does money things well:
//   a fair-priced sale, a deposit in the Save jar, a scam refused.  (FinLit: good habits buy you attention.)
// A 0.6 s global gap stops double-fires. Refunds are capped per season so regen stays the main source.
export const FOCUS_MAX = 100;
export const FOCUS_COST = { coinMagnetDash: 15, bubbleShield: 35, growthStomp: 30, ledgerFlash: 20, haggleShout: 25, fogSweep: 45 };
export const GAP_S = 0.6;
export const REGEN_PER_S = 2 / 3;   // S75 (user: "focus meter fills three times slower"): was 2/s, now ~0.67/s (full bar from empty in 150 s). Good habits (GAINS) still refill it faster.
export const GAINS = { sale: 4, save: 10, scam: 15 };
export const GAIN_CAP = { sale: 40, save: 30, scam: 30 };   // per season

export function createFocus(o = {}) {
  const max = o.max ?? FOCUS_MAX, costs = { ...FOCUS_COST, ...(o.costs || {}) }, regen = o.regen ?? REGEN_PER_S, gap = o.gap ?? GAP_S;
  const st = { value: o.start ?? max, gapLeft: 0, got: { sale: 0, save: 0, scam: 0 } };
  const api = {
    max, costs, gap, st,
    get value() { return st.value; },
    get frac() { return st.value / max; },
    cost(name) { return costs[name] ?? 0; },
    /** { ok, why:'gap'|'focus', need, have, secondsLeft } */
    check(name) {
      const need = api.cost(name);
      if (st.gapLeft > 0) return { ok: false, why: 'gap', need, have: Math.floor(st.value), secondsLeft: st.gapLeft };
      if (st.value + 1e-9 < need) return { ok: false, why: 'focus', need, have: Math.floor(st.value), secondsLeft: (need - st.value) / regen };
      return { ok: true, need, have: Math.floor(st.value), secondsLeft: 0 };
    },
    spend(name) { const c = api.check(name); if (!c.ok) return c; st.value = Math.max(0, st.value - c.need); st.gapLeft = gap; return c; },
    /** reward from a good habit; returns what was actually added (season cap) */
    gain(why, mul = 1) {
      const base = GAINS[why]; if (!base) return 0;
      const room = (GAIN_CAP[why] ?? 0) - st.got[why]; if (room <= 0) return 0;
      const add = Math.min(room, base * mul, max - st.value); if (add <= 0) return 0;
      st.value += add; st.got[why] += add; return add;
    },
    tick(dt, regenMul = 1) { if (st.gapLeft > 0) st.gapLeft = Math.max(0, st.gapLeft - dt); if (st.value < max) st.value = Math.min(max, st.value + regen * regenMul * dt); },
    refill() { st.value = max; st.gapLeft = 0; return api; },
    newSeason() { st.got = { sale: 0, save: 0, scam: 0 }; return api; },
    /** whole-number snapshot for the HUD */
    view() { return { value: Math.floor(st.value), max, frac: st.value / max }; },
  };
  return api;
}
export default createFocus;
