// src/systems/seasonScript.js — 43A: data-driven season scripts (data/seasons.json). Pure, no THREE, no DOM.
//   createSeasonScript(data?) → SS      data = parsed seasons.json; null → legacy fallback built from LEGACY_MARKS (= old SCHEDULER_MARKS)
//   SS.for(season) → row                { len, trickle[], warn, event, forceEvent, scam, scamKind, wave, novelty:{id,at}|null }  (S > 10 rotates endless rows)
//   SS.marks(season) → [{kind, at, payload?}] sorted by `at`   kinds: trickle | warn | event | scam | wave | novelty
//   SS.validate() → [errors]            every mark in (0,1) · trickle ascending · no mark kind equal (|d| < 0.02) to the previous season's same mark
//   SS.len(season) → seconds            (economy.seasonSecondsFor consults this when a script is loaded)
//   MASTER_PLAN_V6 §6: "nothing in a season is at the same day01 mark two seasons in a row".
export const SEASONS_VERSION = 1;
export const MARK_MIN_GAP = 0.02;
export const MARK_KINDS = ['trickle', 'warn', 'event', 'scam', 'wave', 'novelty'];
/** Mirrors Game.js SCHEDULER_MARKS (S37/41C) so a game without data/seasons.json behaves exactly as before 43A. */
export const LEGACY_MARKS = { trickle: [0.34, 0.67], warn: 0.30, event: 0.45, scam: 0.70, wave: (season) => (season === 1 ? 0.55 : 0.70) };
export const LEGACY_CURVE = [70, 90, 110, 130, 150];

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
      return errs;
    },
  };
  return SS;
}
export default createSeasonScript;
