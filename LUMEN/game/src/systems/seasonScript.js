// src/systems/seasonScript.js — 43A: data-driven season scripts (data/seasons.json). Pure, no THREE, no DOM.
//   createSeasonScript(data?) → SS      data = parsed seasons.json; null → legacy fallback built from LEGACY_MARKS (= old SCHEDULER_MARKS)
//   SS.for(season) → row                { len, trickle[], warn, event, forceEvent, scam, scamKind, wave, novelty:{id,at}|null }  (S > 10 rotates endless rows)
//   SS.marks(season) → [{kind, at, payload?}] sorted by `at`   kinds: trickle | warn | event | scam | wave | novelty
//   SS.validate() → [errors]            every mark in (0,1) · trickle ascending · no mark kind equal (|d| < 0.02) to the previous season's same mark
//   SS.len(season) → seconds            (economy.seasonSecondsFor consults this when a script is loaded)
//   SS.demandFor(season) → {kind: mult} 44C: row.demand ({} for S1 / legacy); SS.hotCold(season) → {hot, cold} (kind with mult ≥ 1.3 / ≤ 0.7, or null)
//     validate: 0.3 ≤ mult ≤ 2, exactly one HOT + one COLD per S ≥ 2 row, hot/cold differ from the previous season (incl. the S10→S11 rotate wrap).
//   MASTER_PLAN_V6 §6: "nothing in a season is at the same day01 mark two seasons in a row".
export const SEASONS_VERSION = 1;
export const MARK_MIN_GAP = 0.02;
export const MARK_KINDS = ['trickle', 'warn', 'event', 'scam', 'wave', 'novelty'];
/** Mirrors Game.js SCHEDULER_MARKS (S37/41C) so a game without data/seasons.json behaves exactly as before 43A. */
export const LEGACY_MARKS = { trickle: [0.34, 0.67], warn: 0.30, event: 0.45, scam: 0.70, wave: (season) => (season === 1 ? 0.55 : 0.70) };
export const LEGACY_CURVE = [70, 90, 110, 130, 150];
export const DEMAND_HOT = 1.3, DEMAND_COLD = 0.7, DEMAND_MIN = 0.3, DEMAND_MAX = 2;   // 44C: season demand multiplier bands (Bible rule 4: no weight ever reaches 0)

export function legacyRow(season) {
  const s = Math.max(1, season | 0);
  return { len: LEGACY_CURVE[Math.min(LEGACY_CURVE.length, s) - 1], trickle: LEGACY_MARKS.trickle.slice(), warn: LEGACY_MARKS.warn, event: LEGACY_MARKS.event,
    forceEvent: null, scam: s % 2 === 1 ? LEGACY_MARKS.scam : null, scamKind: s % 2 === 1 ? 'npc' : null, wave: LEGACY_MARKS.wave(s), novelty: null, legacy: true };
}

export function createSeasonScript(data = null) {
  const seasons = data?.seasons || null;
  const rotate = seasons?.endless?.rotate || ['6', '7', '8', '9', '10'];
  const numbered = seasons ? Object.keys(seasons).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b) : [];
  const maxS = numbered.length ? numbered[numbered.length - 1] : 0;
  const rowKey = (season) => {
    const s = Math.max(1, season | 0);
    if (!seasons) return null;
    if (seasons[String(s)]) return String(s);
    if (!rotate.length) return String(maxS);
    return rotate[(s - maxS - 1) % rotate.length];   // S11 → rotate[0], S12 → rotate[1], …
  };
  const SS = {
    version: data?.version ?? SEASONS_VERSION, legacy: !seasons, maxSeason: maxS, rotate,
    for(season) {
      const k = rowKey(season); if (!k) return legacyRow(season);
      const r = seasons[k]; const s = Math.max(1, season | 0);
      return { len: r.len ?? 150, trickle: (r.trickle || []).slice(), warn: r.warn ?? null, event: r.event ?? null, forceEvent: r.forceEvent ?? null,
        scam: r.scam ?? null, scamKind: r.scam == null ? null : (r.scamKind || 'npc'), wave: r.wave ?? null, novelty: r.novelty ? { id: r.novelty.id, at: r.novelty.at } : null,
        key: k, rotated: k !== String(s) };
    },
    len(season) { return SS.for(season).len; },
    demandFor(season) { const k = rowKey(season); const d = k && seasons[k].demand; return d && typeof d === 'object' ? { ...d } : {}; },   // 44C
    hotCold(season) { const d = SS.demandFor(season); let hot = null, cold = null; for (const k of Object.keys(d)) { if (d[k] >= DEMAND_HOT) hot = k; else if (d[k] <= DEMAND_COLD) cold = k; } return { hot, cold }; },
    marks(season) {
      const r = SS.for(season), out = [];
      r.trickle.forEach((at, i) => out.push({ kind: 'trickle', at, payload: { index: i } }));
      if (r.warn != null) out.push({ kind: 'warn', at: r.warn });
      if (r.event != null) out.push({ kind: 'event', at: r.event, payload: { forceEvent: r.forceEvent } });
      if (r.scam != null) out.push({ kind: 'scam', at: r.scam, payload: { scamKind: r.scamKind } });
      if (r.wave != null) out.push({ kind: 'wave', at: r.wave });
      if (r.novelty) out.push({ kind: 'novelty', at: r.novelty.at, payload: { id: r.novelty.id } });
      return out.sort((a, b) => a.at - b.at);
    },
    validate() {
      const errs = [];
      if (!seasons) return errs;
      const in01 = (v) => typeof v === 'number' && v > 0 && v < 1;
      const prevOf = {}; 
      for (const s of numbered) {
        const r = SS.for(s), tag = `S${s}`;
        if (!(r.len > 0)) errs.push(`${tag}: len must be > 0`);
        r.trickle.forEach((v, i) => { if (!in01(v)) errs.push(`${tag}: trickle[${i}] ${v} not in (0,1)`); if (i && v <= r.trickle[i - 1]) errs.push(`${tag}: trickle not ascending`); });
        for (const k of ['warn', 'event', 'scam', 'wave']) if (r[k] != null && !in01(r[k])) errs.push(`${tag}: ${k} ${r[k]} not in (0,1)`);
        if (r.novelty && (!r.novelty.id || !in01(r.novelty.at))) errs.push(`${tag}: novelty needs id + at in (0,1)`);
        if (r.scam != null && !['npc', 'baron'].includes(r.scamKind)) errs.push(`${tag}: scamKind must be npc|baron`);
        // consecutive-season rule (PLAN §6)
        const cur = { warn: r.warn, event: r.event, scam: r.scam, wave: r.wave, novelty: r.novelty?.at ?? null };
        r.trickle.forEach((v, i) => { cur['trickle' + i] = v; });
        if (prevOf.season === s - 1) for (const k of Object.keys(cur)) { const a = cur[k], b = prevOf.m[k]; if (a != null && b != null && Math.abs(a - b) < MARK_MIN_GAP) errs.push(`${tag}: ${k} ${a} equals S${s - 1}'s ${b} (gap < ${MARK_MIN_GAP})`); }
        prevOf.season = s; prevOf.m = cur;
      }
      for (const k of rotate) if (!seasons[k]) errs.push(`endless.rotate references missing season ${k}`);
      // 44C demand: S1 none · S ≥ 2 exactly one HOT (≥ 1.3) + one COLD (≤ 0.7), all mults in [0.3, 2] · hot/cold ≠ previous season's (S2..maxS, plus the wrap maxS → maxS+1)
      const last = numbered.length ? numbered[numbered.length - 1] : 0;
      for (let s = 1; s <= last + 1; s++) {
        const d = SS.demandFor(s), tag = `S${s}`, keys = Object.keys(d);
        if (s === 1) { if (keys.length) errs.push(`${tag}: demand must be empty on the tutorial season`); continue; }
        for (const k of keys) if (!(d[k] >= DEMAND_MIN && d[k] <= DEMAND_MAX)) errs.push(`${tag}: demand.${k} ${d[k]} not in [${DEMAND_MIN}, ${DEMAND_MAX}]`);
        const hots = keys.filter((k) => d[k] >= DEMAND_HOT), colds = keys.filter((k) => d[k] <= DEMAND_COLD);
        if (hots.length !== 1 || colds.length !== 1) { errs.push(`${tag}: demand needs exactly one HOT (≥ ${DEMAND_HOT}) and one COLD (≤ ${DEMAND_COLD}), got ${hots.length}/${colds.length}`); continue; }
        if (s > 2) { const p = SS.hotCold(s - 1); if (p.hot === hots[0]) errs.push(`${tag}: hot ${hots[0]} repeats S${s - 1}`); if (p.cold === colds[0]) errs.push(`${tag}: cold ${colds[0]} repeats S${s - 1}`); }
      }
      return errs;
    },
  };
  return SS;
}
export default createSeasonScript;
