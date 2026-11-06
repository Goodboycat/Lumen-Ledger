// LUMEN LEDGER — T2 curiosity registry (FUN_PASS §4 T2 / §7.A). Pure JS: no Three, no DOM, no per-frame work (checks at 5 Hz).
//
//   import { createCuriosity } from './curiosity.js';
//   const C = createCuriosity({ bus, hero: () => ({ x, z }), blocked: () => boolean, quiet: () => boolean });
//   C.register({ id, getPos: () => ({x,z}) | null, radius, hint, tapR?, ping?, act? }) → unregister()   one thing (null pos = not in the world right now)
//   C.source((add) => { add(id, x, z, hint, radius, tapR, ping, act); … })  → off()                       a LIST of things, rebuilt every check (stalls, tills, enemies…)
//   C.update(dt)                       game clock; runs a check every `interval` s (0.2 = 5 Hz)
//   C.tap(world, { hold }) → hint | null      a tap / hold at a world point → nearest thing within its tapR → bus 'curious' {why:'tap'|'hold'}
//   C.things() · C.hints() · C.size · C.destroy()
//
// `hint` = the tutor card id (string) or a function returning one (evaluated only when something is emitted, so a jar can answer 'jar:withdraw' once it holds ✦).
// Bus out (consumed by ui/tutor.js):
//   curious {id, hint, why, x, z}   why = 'approach' (first step inside `radius`, every visit) · 'linger' (inside ≥ lingerSec and almost still, once per visit)
//                                         · 'tap' (a tap near it, any distance) · 'hold' (press-and-hold ≥ 350 ms: ask only)
//   curious:ping {id, hint, x, z}   a NEW thing with `ping:true` appeared (Collector landing, stranger arriving) → the tutor shows a small "?" on it
// No emission while `blocked()` (dialogue / modal / deal / cinematic) — taps included. `quiet()` (verb chain running) silences approach / linger / ping only.
// Steady state allocates nothing: things are pooled objects in a Map, updated in place; strings are only built by the sources.
export const CURIOSITY = { interval: 0.2, lingerSec: 1.2, stillSpeed: 0.45, tapR: 1.4, radius: 2.0 };

export function createCuriosity(opts = {}) {
  const bus = opts.bus; const cfg = { ...CURIOSITY, ...(opts.cfg || {}) };
  const things = new Map();                    // id → pooled thing { id, x, z, hint, radius, tapR, ping, act, epoch, inside, t, lingered }
  const statics = new Map();                   // id → registration (getPos)
  const sources = new Set();
  let epoch = 0, acc = 0, primed = false, hx = NaN, hz = NaN, speed = 0, clock = 0;
  const hintOf = (t) => (typeof t.hint === 'function' ? t.hint() : t.hint);
  const emit = (name, p) => { if (bus) bus.emit(name, p); };

  function upsert(id, x, z, hint, radius, tapR, ping, act) {
    if (!id || !Number.isFinite(x) || !Number.isFinite(z)) return;
    let t = things.get(id);
    if (!t) {
      t = { id, x, z, hint, radius: 0, tapR: 0, ping: false, act: false, epoch, inside: false, t: 0, lingered: false, born: clock };
      things.set(id, t);
      t.radius = radius > 0 ? radius : cfg.radius; t.tapR = tapR > 0 ? tapR : cfg.tapR; t.ping = !!ping; t.act = !!act; t.hint = hint;
      if (primed && t.ping && !(opts.quiet && opts.quiet()) && !(opts.blocked && opts.blocked())) emit('curious:ping', { id, hint: hintOf(t), x, z });
      return;
    }
    t.x = x; t.z = z; t.hint = hint; t.epoch = epoch;
    if (radius > 0) t.radius = radius; if (tapR > 0) t.tapR = tapR; t.act = !!act;
  }

  function check() {
    epoch++;
    for (const s of sources) s(upsert);
    for (const r of statics.values()) { const p = r.getPos(); if (p) upsert(r.id, p.x, p.z, r.hint, r.radius, r.tapR, r.ping, r.act); }
    for (const [id, t] of things) if (t.epoch !== epoch) things.delete(id);     // gone from the world (removed stall, defeated Collector, stranger left)
    primed = true;
    const h = opts.hero ? opts.hero() : null; if (!h) return;
    if (Number.isFinite(hx)) { const d = Math.hypot(h.x - hx, h.z - hz); speed = d / Math.max(0.001, cfg.interval); } hx = h.x; hz = h.z;
    const blocked = !!(opts.blocked && opts.blocked()), quiet = blocked || !!(opts.quiet && opts.quiet());
    for (const t of things.values()) {
      const d = Math.hypot(t.x - h.x, t.z - h.z), inside = d <= t.radius;
      if (!inside) { t.inside = false; t.t = 0; t.lingered = false; continue; }
      if (!t.inside) { t.inside = true; t.t = 0; t.lingered = false; if (!quiet) emit('curious', { id: t.id, hint: hintOf(t), why: 'approach', x: t.x, z: t.z }); continue; }
      t.t += cfg.interval;
      if (!t.lingered && t.t >= cfg.lingerSec && speed <= cfg.stillSpeed) { t.lingered = true; if (!quiet) emit('curious', { id: t.id, hint: hintOf(t), why: 'linger', x: t.x, z: t.z }); }
    }
  }

  const C = {
    cfg, get size() { return things.size; },
    register(r) {
      if (!r || !r.id || typeof r.getPos !== 'function') return () => {};
      statics.set(r.id, { id: r.id, getPos: r.getPos, hint: r.hint ?? r.hintId ?? r.id, radius: r.radius, tapR: r.tapR, ping: !!r.ping, act: !!r.act });
      return () => C.unregister(r.id);
    },
    unregister(id) { statics.delete(id); things.delete(id); },
    source(fn) { if (typeof fn !== 'function') return () => {}; sources.add(fn); return () => sources.delete(fn); },
    update(dt) { clock += dt; acc += dt; if (acc < cfg.interval) return; acc = acc % cfg.interval; check(); },
    /** Force one check now (tests / the first frame after a run starts so the existing world is registered without pings). */
    prime() { check(); return C; },
    tap(world, o = {}) {
      if (!world || (opts.blocked && opts.blocked())) return null;
      let best = null, bd = Infinity;
      for (const t of things.values()) { const d = Math.hypot(t.x - world.x, t.z - world.z); if (d <= t.tapR && d < bd) { best = t; bd = d; } }
      if (!best) return null;
      const hint = hintOf(best);
      emit('curious', { id: best.id, hint, why: o.hold ? 'hold' : 'tap', x: best.x, z: best.z, act: best.act });
      return hint;
    },
    things() { return [...things.values()]; },
    /** Every hint id the registered things answer right now (coverage gate). Functions are called, so only the current answer is listed. */
    hints() { const out = new Set(); for (const t of things.values()) { const h = hintOf(t); if (h) out.add(h); } return [...out]; },
    get(id) { return things.get(id) || null; },
    destroy() { things.clear(); statics.clear(); sources.clear(); },
  };
  return C;
}

export default createCuriosity;
