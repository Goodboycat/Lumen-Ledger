// 41D — Two abilities at start, four earned by ledger stars. Pure-ish: wraps sb.ability, listens to eco:season.
// API (API_CONTRACTS "Unlocks (41D)"):
//   ABILITY_START, ABILITY_UNLOCKS · installUnlocks(sb, bus, opts) → { abilities:Set, starsTotal, pending, restore(snap), destroy() }
//   sb.abilities: Set<string> · sb.ability(name) → 'locked' when not unlocked (no cooldown, emits 'ability:locked' {name})
//   bus 'ability:unlock' {id, stars, key, title, lesson} · sb.eco.state.starsTotal mirrors sb.unlocks.starsTotal
import { FINLIT } from '../anim/heroAbilities.js';

export const ABILITY_START = ['coinMagnetDash', 'bubbleShield'];
export const ABILITY_UNLOCKS = [
  { id: 'growthStomp', stars: 3 },
  { id: 'ledgerFlash', stars: 6 },
  { id: 'haggleShout', stars: 9 },
  { id: 'fogSweep',    stars: 12 },
];
export const ABILITY_ORDER = ['coinMagnetDash', 'bubbleShield', 'growthStomp', 'ledgerFlash', 'haggleShout', 'fogSweep'];

/** ★ cost of an ability (0 for starters, null for unknown). */
export function starsFor(id) { if (ABILITY_START.includes(id)) return 0; const r = ABILITY_UNLOCKS.find((u) => u.id === id); return r ? r.stars : null; }

export function installUnlocks(sb, bus, opts = {}) {
  const all = !!opts.all;                                     // endless / debug: everything open
  const u = { abilities: new Set(all ? ABILITY_ORDER : ABILITY_START), starsTotal: 0, pending: null, _offs: [] };
  sb.abilities = u.abilities; sb.unlocks = u;
  if (sb.eco?.state) sb.eco.state.starsTotal = 0;

  const inner = sb.ability;
  sb.ability = (name) => {
    if (!u.abilities.has(name)) { bus.emit('ability:locked', { name, stars: starsFor(name), have: u.starsTotal }); return 'locked'; }
    return inner(name);
  };

  /** Unlock the next row reached by starsTotal (max one per call so each ledger shows one card). */
  u.tryUnlock = () => {
    const row = ABILITY_UNLOCKS.find((r) => !u.abilities.has(r.id) && u.starsTotal >= r.stars);
    if (!row) return null;
    u.abilities.add(row.id);
    const f = FINLIT[row.id] || {};
    const ev = { id: row.id, stars: row.stars, key: f.key || '', title: f.title || row.id, lesson: f.lesson || '' };
    u.pending = ev; bus.emit('ability:unlock', ev);
    return ev;
  };
  u.addStars = (n) => { u.starsTotal += Math.max(0, n | 0); if (sb.eco?.state) sb.eco.state.starsTotal = u.starsTotal; return u.tryUnlock(); };
  u._offs.push(bus.on('eco:season', (r) => { u.pending = null; if (r?.pier?.pending) return; u.addStars(r?.stars ?? r?.report?.stars ?? 0); }));   // S70: with the Baron still to be paid the stars are provisional → counted at eco:stars
  u._offs.push(bus.on('eco:stars', (e) => { u.addStars(e?.stars ?? 0); }));
  u._offs.push(bus.on('eco:win', () => { for (const id of ABILITY_ORDER) u.abilities.add(id); }));   // P3: endless = playground

  /** Restore from a save snapshot (v2 fields; v1 → starters + 0). */
  u.restore = (snap) => {
    u.abilities.clear();
    const list = Array.isArray(snap?.abilities) && snap.abilities.length ? snap.abilities : ABILITY_START;
    for (const id of list) if (ABILITY_ORDER.includes(id)) u.abilities.add(id);
    for (const id of ABILITY_START) u.abilities.add(id);
    u.starsTotal = Math.max(0, +snap?.starsTotal || 0); if (sb.eco?.state) sb.eco.state.starsTotal = u.starsTotal;
    u.pending = null;
  };
  u.serialize = () => ({ abilities: [...u.abilities], starsTotal: u.starsTotal });
  u.destroy = () => { for (const off of u._offs) try { off(); } catch (_) {} u._offs.length = 0; sb.ability = inner; };
  return u;
}

export default { ABILITY_START, ABILITY_UNLOCKS, ABILITY_ORDER, starsFor, installUnlocks };
