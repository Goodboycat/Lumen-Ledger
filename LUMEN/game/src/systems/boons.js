// S67 — Boon Draft (pure: no DOM, no bus, no THREE). After each Ledger the player picks ONE of three cards.
// Every card is a money trade-off with a visible downside and a lesson of <= 10 words (data/boons.json, designer-editable).
//   createBoons(data)            -> { all, byId, families, rollThree(rng, owned, season), apply(eco, id), ownedRow(eco), validate(), ... }
//   rollThree(rng, owned, season) -> up to 3 boon defs, never two of one family, never one the player already owns
//   apply(eco, id)               -> pushes {id, since, until, lock, grow, fx} onto eco.state.boons (fx is COPIED in, so the save needs no lookup)
//   serialize(eco) / restore(eco, arr) -> eco.state.boons is part of eco.serialize() already; these only validate/clean old data
// Economy reads the effects through eco.mod(key) (*Mul keys multiply, the rest add), eco.boonGrowMul(), eco.investLocked(), eco.state.boonFree.
const MAX_WORDS = 10;
const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;

export function validateBoons(data) {
  const errs = []; const ids = new Set(); const fam = (data && data.families) || {};
  if (!data || !Array.isArray(data.boons)) return ['boons.json: no boons array'];
  for (const b of data.boons) {
    if (!b.id || ids.has(b.id)) errs.push('duplicate or missing id ' + b.id); ids.add(b.id);
    if (!fam[b.family]) errs.push(b.id + ': unknown family ' + b.family);
    if (!b.name || !b.up || !b.down) errs.push(b.id + ': name/up/down missing');
    if (!b.lesson) errs.push(b.id + ': lesson missing'); else if (words(b.lesson) > MAX_WORDS) errs.push(b.id + ': lesson has ' + words(b.lesson) + ' words (max ' + MAX_WORDS + ')');
    if (!b.fx || typeof b.fx !== 'object' || !Object.keys(b.fx).length) errs.push(b.id + ': fx missing');
  }
  for (const k of Object.keys(fam)) if (data.boons.filter((b) => b.family === k).length < 3) errs.push('family ' + k + ' has < 3 cards');
  return errs;
}

export function createBoons(data) {
  const all = (data && Array.isArray(data.boons)) ? data.boons : [];
  const families = (data && data.families) || {};
  const byId = Object.fromEntries(all.map((b) => [b.id, b]));
  const api = {
    all, byId, families, MAX_WORDS,
    validate: () => validateBoons(data),
    famOf: (id) => byId[id] && byId[id].family,
    /** Up to 3 cards from 3 different families; owned ids are skipped. rng() -> [0,1). Never throws on a small pool. */
    rollThree(rng = Math.random, owned = [], season = 1) {
      const have = new Set((owned || []).map((o) => (typeof o === 'string' ? o : o && o.id)));
      let pool = all.filter((b) => !have.has(b.id));
      const out = []; const used = new Set();
      // family weight: a family the player holds nothing of is a little more likely (variety), but any family can show up
      const heldFam = new Set([...have].map((id) => byId[id] && byId[id].family));
      while (out.length < 3) {
        const cand = pool.filter((b) => !used.has(b.family)); if (!cand.length) break;
        const w = cand.map((b) => (heldFam.has(b.family) ? 1 : 1.5)); const tot = w.reduce((a, c) => a + c, 0);
        let r = rng() * tot, pick = cand[cand.length - 1];
        for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r < 0) { pick = cand[i]; break; } }
        out.push(pick); used.add(pick.family);
      }
      return out;
    },
    /** Put boon `id` into the economy at the season the player is in NOW (the ledger opens after season++). Returns the stored entry or null. */
    apply(eco, id) {
      const b = byId[id]; if (!b || !eco || !eco.state) return null;
      const s = eco.state; s.boons = Array.isArray(s.boons) ? s.boons : [];
      if (s.boons.some((x) => x.id === id)) return null;
      const e = { id, since: s.season, until: b.seasons ? s.season + b.seasons : null, lock: b.lockSeasons || 0, grow: b.grow || 0, fx: { ...b.fx } };
      s.boons.push(e);
      if (b.fx.freeEvents) s.boonFree = (s.boonFree || 0) + b.fx.freeEvents;
      delete e.fx.freeEvents;   // counted in state.boonFree, not a mod() key
      if (eco.bus) eco.bus.emit('boon:picked', { id, boon: b, season: s.season });
      return e;
    },
    /** Owned badges for the HUD row: [{id, family, name, color, icon, left}] (left = seasons left or null). */
    ownedRow(eco) {
      const s = eco && eco.state ? eco.state : {}; const now = s.season || 1;
      return (s.boons || []).map((e) => { const b = byId[e.id] || {}; const f = families[b.family] || {}; return { id: e.id, family: b.family, name: b.name || e.id, color: f.color || '#ccc', icon: f.icon || 'boon', left: e.until != null ? Math.max(0, e.until - now) : null, up: b.up, down: b.down }; });
    },
    serialize(eco) { return ((eco && eco.state && eco.state.boons) || []).map((e) => ({ ...e, fx: { ...e.fx } })); },
    /** Accepts anything (old saves have no field). Keeps only well-formed entries whose id is still in the data. */
    restore(eco, arr) {
      const s = eco.state; const keep = [];
      for (const e of Array.isArray(arr) ? arr : []) { if (e && byId[e.id] && e.fx && typeof e.fx === 'object' && !keep.some((k) => k.id === e.id)) keep.push({ id: e.id, since: +e.since || 1, until: e.until == null ? null : +e.until, lock: +e.lock || 0, grow: +e.grow || 0, fx: { ...e.fx } }); }
      s.boons = keep; s.boonFree = Math.max(0, +s.boonFree || 0);
      return keep.length;
    },
    /** Deterministic random pick for sims / tests. */
    randomPick(rng, owned, season) { const t = api.rollThree(rng, owned, season); return t.length ? t[Math.floor(rng() * t.length)] : null; },
  };
  return api;
}
export default createBoons;
