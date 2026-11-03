// 42A — Tills: customers pay the STALL, Pip collects. Pure state + a tiny coin-layer adapter (no THREE here).
// API (API_CONTRACTS "Tills (42A)"):
//   createTills({ bus, eco, build, vfx, coinLayer, stats }) → T
//   T.get(stallId) → { stallId, amount, pos:{x,z}, counterY } | null      T.all() → [...]      T.total() → Σ amount
//   T.pay(stallId, amount, meta)       customers call this (economy.sell ran with { toTill:true } and did NOT touch the pouch)
//   T.collect(stallId, how:'walk'|'magnet'|'helper'|'sweep') → amount → eco.earn(amount, 'till:'+how)  (40A counts 'till:*' as handled)
//   T.spill(stallId, n) → n ground tips via coinLayer.spill(pos, value)  (overflow here; Collector raid in 42C)
//   T.steal(stallId, n, {enemyId}) → taken (42C raid, emits raid:take)   T.refund(stallId, n) → kept (raid cancelled before carry)
//   T.richest() → entry|null (42C)      T.sweep(tax) → { swept, tax } season-end: counters → pouch minus the Collector tax (P2)
//   T.tickHelpers(dt, helpers) helpers seated at a stall auto-collect that stall's till every HELPER_EVERY s (P2)
//   T.destroy()
// Rules: TILL_CAP = 40 ✦ at level 1 (+20 / level). Above cap a new sale spills 50 % of the overflow to the ground and the stall
//   flashes "FULL" (bus till:full). bus: till:change {stallId, amount, delta} · till:collect {stallId, amount, how} · till:full {stallId}
// coinLayer (built by Game.js on the shared tip-coin InstancedMesh): { setStack(stallId, n, pos, counterY), clear(stallId), spill(pos, value), fly?(from, to, amount) }
export const TILL_CAP = 40, TILL_CAP_PER_LEVEL = 20, SWEEP_TAX = 0.10, HELPER_EVERY = 12, SPILL_PCT = 0.5, COINS_PER_STACK = 8;
const round = (n) => Math.round(n * 100) / 100;
export function tillCap(level = 1) { return TILL_CAP + TILL_CAP_PER_LEVEL * (Math.max(1, level | 0) - 1); }

export function createTills({ bus, eco, build, vfx = null, coinLayer = null, stats = null } = {}) {
  const tills = new Map();   // stallId → { stallId, amount, pos:{x,z}, counterY, level, fullAt }
  const key = (id) => String(id);
  const emit = (ev, p) => bus?.emit?.(ev, p);
  const stallEntry = (id) => {
    if (!build?.stalls) return null;
    for (const s of build.stalls()) if (key(s.id) === key(id)) return s;
    return null;
  };
  // counter position: BuildSystem.stalls() gives the world-space counter slot; fallback = group position
  const locate = (id) => {
    const s = stallEntry(id);
    if (!s) return { pos: { x: 0, z: 0 }, counterY: 0.9, level: 1 };
    const c = s.slots?.counter || s.group?.position || { x: 0, y: 0, z: 0 };
    return { pos: { x: c.x, z: c.z }, counterY: 0.9, level: s.level || s.entry?.level || 1 };
  };
  const ensure = (id) => {
    const k = key(id); let t = tills.get(k);
    if (!t) { t = { stallId: k, amount: 0, ...locate(k), fullAt: -1 }; tills.set(k, t); }
    return t;
  };
  const sync = (t) => {
    const n = t.amount <= 0 ? 0 : Math.min(COINS_PER_STACK, Math.ceil(t.amount / 5));          // 1 coin per 5 ✦, ≤ 8 instances
    const scale = t.amount > COINS_PER_STACK * 5 ? Math.min(1.6, 1 + (t.amount - COINS_PER_STACK * 5) / 80) : 1;  // 9th+ coin → stack grows
    coinLayer?.setStack?.(t.stallId, n, t.pos, t.counterY, { scale, amount: t.amount });
  };

  const T = {
    tills, TILL_CAP, SWEEP_TAX,
    get(id) { const t = tills.get(key(id)); return t ? { ...t } : null; },
    all() { return [...tills.values()].map((t) => ({ ...t })); },
    total() { let s = 0; for (const t of tills.values()) s += t.amount; return round(s); },
    cap(id) { const t = tills.get(key(id)); return tillCap(t ? t.level : locate(id).level); },
    richest() { let b = null; for (const t of tills.values()) if (t.amount > 0 && (!b || t.amount > b.amount)) b = t; return b ? { ...b } : null; },
    /** refresh positions + levels from the live BuildSystem (after a move / upgrade / load). Stalls that vanished are swept to the pouch. */
    refresh() {
      for (const t of [...tills.values()]) {
        if (!stallEntry(t.stallId)) { if (t.amount > 0) T.collect(t.stallId, 'removed'); coinLayer?.clear?.(t.stallId); tills.delete(t.stallId); continue; }
        Object.assign(t, locate(t.stallId)); sync(t);
      }
    },
    pay(id, amount, meta = {}) {
      amount = round(Math.max(0, +amount || 0)); if (amount <= 0) return 0;
      const t = ensure(id); Object.assign(t, locate(t.stallId));
      const cap = tillCap(t.level);
      let kept = amount, spilled = 0;
      if (t.amount + amount > cap) {
        const over = round(t.amount + amount - cap);
        kept = round(Math.max(0, cap - t.amount));
        spilled = round(over * SPILL_PCT);                       // half the overflow hits the ground (collectable tips); the rest is lost
        if (stats) stats.tillLost = round((stats.tillLost || 0) + (over - spilled));
        t.fullAt = (eco?.state?.time ?? 0);
        emit('till:full', { stallId: t.stallId, amount: cap, overflow: over, spilled });
        if (spilled > 0) T.spill(t.stallId, spilled);
      }
      if (kept > 0) { t.amount = round(t.amount + kept); if (stats) stats.tillPaid = round((stats.tillPaid || 0) + kept); emit('till:change', { stallId: t.stallId, amount: t.amount, delta: kept, cap, meta }); }
      sync(t);
      return kept;
    },
    collect(id, how = 'walk') {
      const t = tills.get(key(id)); if (!t || t.amount <= 0) return 0;
      const amount = t.amount; t.amount = 0; t.fullAt = -1;
      // pouch += amount. NOT eco.earn: the ledger already counted this income at the sale (toTill) — only the cash moves now
      if (eco?._addSpark) eco._addSpark(amount, 'till:' + how); else eco?.earn?.(amount, 'till:' + how);
      if (stats) { stats.tillCollected = round((stats.tillCollected || 0) + amount); stats['tillCollected_' + how] = round((stats['tillCollected_' + how] || 0) + amount); }
      emit('till:change', { stallId: t.stallId, amount: 0, delta: -amount, cap: tillCap(t.level), how });
      emit('till:collect', { stallId: t.stallId, amount, how, pos: { ...t.pos } });
      if (how !== 'sweep') coinLayer?.fly?.(t.pos, t.counterY, amount, how);
      sync(t);
      return amount;
    },
    /** n ✦ fall off the counter as ground tips (≥ 1 ✦ each, ≤ 6 coins). Returns coins made. */
    spill(id, n) {
      const t = ensure(id); n = round(Math.max(0, +n || 0)); if (n <= 0 || !coinLayer?.spill) return 0;
      const coins = Math.max(1, Math.min(6, Math.round(n / 2)));
      let left = n, made = 0;
      for (let i = 0; i < coins; i++) { const v = i === coins - 1 ? left : Math.max(1, Math.round(n / coins)); if (v <= 0) break; left = round(left - v); const a = (i / coins) * Math.PI * 2; coinLayer.spill({ x: t.pos.x + Math.cos(a) * 0.55, z: t.pos.z + Math.sin(a) * 0.55 }, v); made++; }
      if (stats) stats.tillSpilled = round((stats.tillSpilled || 0) + n);
      return made;
    },
    /** 42C raid: a Collector takes n ✦ (clamped to the till) from the counter. Returns the amount taken; emits raid:take. */
    steal(id, n, meta = {}) {
      const t = tills.get(key(id)); n = round(Math.max(0, +n || 0)); if (!t || t.amount <= 0 || n <= 0) return 0;
      const taken = round(Math.min(t.amount, n)); t.amount = round(t.amount - taken); t.fullAt = -1;
      if (stats) stats.tillStolen = round((stats.tillStolen || 0) + taken);
      emit('till:change', { stallId: t.stallId, amount: t.amount, delta: -taken, cap: tillCap(t.level), how: 'raid' });
      emit('raid:take', { stallId: t.stallId, amount: taken, enemyId: meta.enemyId ?? null, pos: { ...t.pos } });
      sync(t);
      return taken;
    },
    /** 42C raid cancelled before `carry`: put n ✦ back on the counter (never above the cap; the excess spills). Returns amount refunded. */
    refund(id, n) {
      const t = ensure(id); n = round(Math.max(0, +n || 0)); if (n <= 0) return 0;
      const cap = tillCap(t.level), kept = round(Math.min(n, Math.max(0, cap - t.amount))), over = round(n - kept);
      if (kept > 0) { t.amount = round(t.amount + kept); emit('till:change', { stallId: t.stallId, amount: t.amount, delta: kept, cap, how: 'refund' }); }
      if (over > 0) T.spill(t.stallId, over);
      sync(t);
      return kept;
    },
    /** Season end (P2): every counter is emptied into the pouch minus the Collector tax. Returns { swept, tax, net }. */
    sweep(tax = SWEEP_TAX) {
      let swept = 0; for (const t of tills.values()) swept += t.amount; swept = round(swept);
      if (swept <= 0) return { swept: 0, tax: 0, net: 0 };
      const taxed = round(swept * tax), net = round(swept - taxed);
      for (const t of tills.values()) if (t.amount > 0) { const a = t.amount; t.amount = 0; t.fullAt = -1; emit('till:change', { stallId: t.stallId, amount: 0, delta: -a, cap: tillCap(t.level), how: 'sweep' }); sync(t); }
      if (eco?._addSpark) eco._addSpark(net, 'till:sweep'); else eco?.earn?.(net, 'till:sweep');
      if (eco?.ledger) { eco.ledger.expenses = round((eco.ledger.expenses || 0) + taxed); eco.ledger.tillTax = round((eco.ledger.tillTax || 0) + taxed); eco.ledger.tillSwept = round((eco.ledger.tillSwept || 0) + swept); }   // call BEFORE endSeason so the tax lands in this season's report
      if (stats) { stats.tillSwept = round((stats.tillSwept || 0) + swept); stats.tillTax = round((stats.tillTax || 0) + taxed); }
      emit('till:collect', { stallId: null, amount: net, tax: taxed, swept, how: 'sweep' });
      return { swept, tax: taxed, net };
    },
    /** P2 helpers: a helper seated at a stall empties that till every HELPER_EVERY s. `helpers` = [{ stall:{id}|null, ... }]. */
    tickHelpers(dt, helpers) {
      if (!helpers?.length) return 0;
      let got = 0;
      for (const h of helpers) {
        if (!h?.stall?.id) continue;
        h._tillT = (h._tillT || 0) + dt; if (h._tillT < HELPER_EVERY) continue; h._tillT = 0;
        const t = tills.get(key(h.stall.id)); if (t && t.amount > 0) { got += T.collect(t.stallId, 'helper'); h.anim?.pop?.('✦'); }
      }
      return got;
    },
    destroy() { for (const t of tills.values()) coinLayer?.clear?.(t.stallId); tills.clear(); for (const f of offs) f?.(); offs.length = 0; },
  };
  const offs = [];
  if (bus?.on) {
    offs.push(bus.on('build:upgraded', () => T.refresh()));
    offs.push(bus.on('build:removed', () => T.refresh()));
    offs.push(bus.on('build:moved', () => T.refresh()));
  }
  return T;
}
export default { TILL_CAP, TILL_CAP_PER_LEVEL, SWEEP_TAX, HELPER_EVERY, tillCap, createTills };
