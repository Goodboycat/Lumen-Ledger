// src/systems/save.js — Chat 10D. Versioned localStorage save for Lumen Ledger. Pure JS, no Three, no DOM (storage is injected).
//   import { snapshot, save, load, clear, hasSave, exportText, importText, SAVE_KEY, SAVE_VERSION } from './systems/save.js';
//   const snap = snapshot(lg);            // plain object from the running game (lg = createLumenGame result with lg.sb)
//   save(snap);                           // → localStorage[SAVE_KEY] (JSON) · returns true/false (quota / no storage → false, never throws)
//   const snap2 = load();                 // → object or null (missing, bad JSON, wrong major version → null)
//   hasSave()  clear()                    // title CONTINUE button · lose / new game
//   exportText(snap) / importText(text)   // P3: base64 JSON text with a "LUMEN1:" prefix — copy/paste for the Flutter WebView when storage is wiped
// Snapshot shape (v1):
//   { v, at, version, mode, state, seasonsToWin, eco: <Economy.serialize() string>, build: [{id,cx,cz,rot,level,cost}], story: {v,state}|null,
//     helpers: ['helper_runner', …], jars: {save,invest,protect} pct or null, settings?, tutorSeen: ['onBuildOpen', …] (48F) }
// Rules: a save is written by the integrator at season end + on review→playing (autosave) — never per frame. Loading NEVER mutates the
// snapshot. Anything missing in an old save falls back to the fresh-sandbox value (forward-compatible by omission).

export const SAVE_KEY = 'lumen.save';
export const SAVE_VERSION = 4;                // 41D: v2 adds abilities[] + starsTotal; v1 snapshots still parse (migrate → ABILITY_START, 0 ★)
                                              // 43D: v3 adds novelty (active id|null, mid-season resume re-starts it) + noveltiesSeen[] (story state; NEW chip once per id)
                                              // 48E: v4 — jars are BUILDABLES (build[] carries jar_* entries). v1–v3 saves had 4 implicit jars at (-8+i, 3):
                                              //      parseSnapshot synthesizes the 4 jar_* build entries (balances untouched); applySnapshot snaps them onto land via snapJarsToLand.
export const SAVE_VERSIONS_OK = [1, 2, 3, 4];
/** 48E: where the pre-48E world placed its 4 jars (Game.js `place(makeProp(id,{fill:.25}), -8+i, 3)` — the row that hung one jar over water). */
export const LEGACY_JAR_ROW = [['jar_save', -7, 3], ['jar_invest', -6, 3], ['jar_protect', -5, 3]];   // S66-A: no jar_spend any more (Spend = the pouch)
export const JAR_SNAP_TRIES = 6;
/** 48E migration half 1 (no world needed): a < v4 snapshot gets 4 jar_* build entries at the legacy row unless it already carries jars. */
export function synthesizeLegacyJars(d) {
  const build = Array.isArray(d.build) ? d.build : (d.build = []);
  if (build.some((e) => typeof e?.id === 'string' && e.id.startsWith('jar_'))) return 0;
  let n = 0; for (const [id, cx, cz] of LEGACY_JAR_ROW) { build.push({ id, cx, cz, rot: 0, level: 1, cost: 0, legacyJar: true }); n++; }
  d.jarsMigrated = true; return n;
}
/** 48E migration half 2 (needs the world): every jar_* entry that is NOT on land moves +1 z until `isLand(x,z)` (max JAR_SNAP_TRIES), so no
 *  legacy save shows a floating jar. `isLand` may also check occupancy. Returns how many entries moved. Idempotent; safe on v4 saves. */
export function snapJarsToLand(build, isLand) {
  if (!Array.isArray(build) || typeof isLand !== 'function') return 0;
  let moved = 0;
  for (const e of build) {
    if (!e || typeof e.id !== 'string' || !e.id.startsWith('jar_')) continue;
    let x = +e.cx, z = +e.cz, ok = !!isLand(x, z);
    for (let t = 0; !ok && t < JAR_SNAP_TRIES; t++) { z += 1; ok = !!isLand(x, z); }
    if (!ok) { z = +e.cz; for (let t = 0; !ok && t < JAR_SNAP_TRIES; t++) { z -= 1; ok = !!isLand(x, z); } }   // nothing south → try north
    if (!ok) { z = +e.cz; for (let t = 0; !ok && t < JAR_SNAP_TRIES; t++) { x += 1; ok = !!isLand(x, z); } }   // still nothing → east
    if (ok && (x !== +e.cx || z !== +e.cz)) { e.cx = x; e.cz = z; moved++; }
  }
  return moved;
}
//               // bump the MAJOR when a snapshot can no longer be applied; minor changes stay v1 (fields optional)
export const EXPORT_PREFIX = 'LUMEN1:';

function storageOf(storage) {
  if (storage) return storage;
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch (_) { /* SecurityError in sandboxed iframes */ }
  return null;
}

/** BUGFIX P18: hero coordinates are only persisted when they are on land; a hero standing on a water cell (P11 lunge, zone change) is
 *  snapped back onto the nearest land cell first, so CONTINUE can never restore a soft-locked position. */
function heroPos(sb) {
  const h = sb.hero; if (!h?.root) return null;
  if (sb.island?.isLand && !sb.island.isLand(h.root.position.x, h.root.position.z)) { if (!h.recoverToLand?.()) return null; }
  return { x: +h.root.position.x.toFixed(2), z: +h.root.position.z.toFixed(2) };
}

/** Build a plain, JSON-safe snapshot of the running game. `lg` = createLumenGame() result; needs lg.sb. Returns null when no run. */
export function snapshot(lg) {
  const sb = lg?.sb; if (!sb) return null;
  const eco = sb.eco;
  return {
    v: SAVE_VERSION, at: Date.now(), version: lg.version || null,
    mode: lg.mode || 'story',
    state: lg.state === 'review' ? 'playing' : lg.state,          // a save taken mid-review resumes at the start of the next season
    seasonsToWin: eco.config?.seasonsToWin ?? null,
    eco: typeof eco.serialize === 'function' ? eco.serialize() : null,
    build: typeof sb.build?.serialize === 'function' ? sb.build.serialize().filter((e) => !e.scenery) : [],
    story: lg.story && typeof lg.story.serialize === 'function' ? lg.story.serialize() : null,
    helpers: (sb.helpers || []).map((h) => 'helper_' + h.type),
    jars: lg.ui?.jars?.getPct?.() || lg.jarPct || null,
    autoApply: !!lg.autoApply,                                        // S03: the ⚡ AUTO jars toggle
    hero: heroPos(sb),
    abilities: sb.unlocks ? [...sb.unlocks.abilities] : undefined,            // 41D (v2)
    starsTotal: sb.unlocks ? sb.unlocks.starsTotal : undefined,               // 41D (v2)
    cust: typeof sb.cust?.serialize === 'function' ? sb.cust.serialize() : null,     // BUGFIX B16: per-stall prices + sale totals
    // BUGFIX P41: mid-season saves (⌂ TITLE while playing) resume at the same day01 with the scheduler's "event / scam already fired" flags,
    //   so CONTINUE does not replay the season. Saves taken at the review start the next season fresh (midSeason false).
    midSeason: lg.state === 'playing' && !eco.state?.ended && (eco.state?.day01 || 0) > 0 && (eco.state?.day01 || 0) < 1,
    sched: sb.sched ? { event: !!sb.sched.event, scam: !!sb.sched.scam } : null,
    novelty: sb.novelty?.id || null,                                                   // 43D (v3): active novelty → applySnapshot calls novelties.start(id, season) again when midSeason
    noveltiesSeen: lg.story?.state?.noveltiesSeen ? [...lg.story.state.noveltiesSeen] : [],   // 43D (v3): mirror of story.state (also inside `story`), kept top-level for describe()/tools
    scamJournal: sb.journal ? sb.journal.serialize() : undefined,                       // T5 (additive v4 field): { v:1, e:{ dealId:{ r, n, s } }, stars } — which deals were met and how they ended
    jarsUnlocked: sb.jarUnlocks ? sb.jarUnlocks.serialize() : undefined,                 // T1-C (additive v4 field): jar keys revealed so far (data/jars.json rules)
    tutorCounts: lg.ui?.tutor?.counts ? { ...lg.ui.tutor.counts } : (lg.tutorCounts || {}),   // T2 (additive v4 field): {cardId: times shown, 99 = retired by doing it}
    tutorSeen: Array.isArray(lg.ui?.tutor?.seen) ? [...lg.ui.tutor.seen] : (Array.isArray(lg.tutorSeen) ? [...lg.tutorSeen] : []),   // 48F (v4 field): curiosity-card ids shown once per profile (ui/tutor.js)
  };
}

/** Write a snapshot. Returns true on success; false (never throws) when storage is missing/full. */
export function save(snap, storage) {
  const st = storageOf(storage); if (!st || !snap) return false;
  try { st.setItem(SAVE_KEY, JSON.stringify(snap)); return true; } catch (_) { return false; }
}

/** Read + validate. Returns the snapshot object or null (missing · unparsable · incompatible major version). */
export function load(storage) {
  const st = storageOf(storage); if (!st) return null;
  let raw = null; try { raw = st.getItem(SAVE_KEY); } catch (_) { return null; }
  return parseSnapshot(raw);
}

export function parseSnapshot(raw) {
  if (!raw) return null;
  let d = raw;
  if (typeof raw === 'string') { try { d = JSON.parse(raw); } catch (_) { return null; } }
  if (!d || typeof d !== 'object' || !SAVE_VERSIONS_OK.includes(Math.floor(+d.v || 0))) return null;
  if (!d.eco) return null;
  // BUGFIX B18: validate the nested payloads here, so a corrupt slot never advertises CONTINUE and then throws inside resume.
  let eco = d.eco; if (typeof eco === 'string') { try { eco = JSON.parse(eco); } catch (_) { return null; } }
  if (!eco || typeof eco !== 'object' || !eco.state || typeof eco.state !== 'object') return null;
  const st = eco.state; if (!Number.isFinite(+st.season) || +st.season < 1 || !Number.isFinite(+st.spark) || !st.jars || typeof st.jars !== 'object') return null;
  if (d.build != null && !Array.isArray(d.build)) return null;
  if (Array.isArray(d.build) && d.build.some((e) => !e || typeof e.id !== 'string' || !Number.isFinite(+e.cx) || !Number.isFinite(+e.cz))) return null;
  if (d.helpers != null && !Array.isArray(d.helpers)) return null;
  if (d.story != null && (typeof d.story !== 'object' || (d.story.state != null && typeof d.story.state !== 'object'))) return null;
  if (d.jars != null && typeof d.jars !== 'object') return null;
  if (d.hero != null && (typeof d.hero !== 'object' || !Number.isFinite(+d.hero.x) || !Number.isFinite(+d.hero.z))) return null;
  if (d.cust != null && (typeof d.cust !== 'object' || (d.cust.prices != null && !Array.isArray(d.cust.prices)))) return null;
  if (d.abilities != null && (!Array.isArray(d.abilities) || d.abilities.some((a) => typeof a !== 'string'))) return null;
  if (Math.floor(+d.v) < 2) { d.abilities = ['coinMagnetDash', 'bubbleShield']; d.starsTotal = 0; }   // 41D migrate v1 → start set
  if (d.novelty != null && typeof d.novelty !== 'string') return null;
  if (d.noveltiesSeen != null && (!Array.isArray(d.noveltiesSeen) || d.noveltiesSeen.some((a) => typeof a !== 'string'))) return null;
  if (Math.floor(+d.v) < 3) { d.novelty = null; d.noveltiesSeen = []; }   // 43D migrate v1/v2 → no active novelty, nothing seen (story.state falls back to [])
  if (d.tutorSeen != null && (!Array.isArray(d.tutorSeen) || d.tutorSeen.some((a) => typeof a !== 'string'))) d.tutorSeen = [];   // 48F: tolerant — a bad list means "show the cards again", never a dropped slot
  if (!Array.isArray(d.tutorSeen)) d.tutorSeen = [];                        // 48F migrate: saves before the field → nothing seen
  if (!d.tutorCounts || typeof d.tutorCounts !== 'object' || Array.isArray(d.tutorCounts)) d.tutorCounts = {};   // T2: tolerant — old saves / bad map → {} (tutorSeen ids then count once each in ui/tutor.js merge)
  else for (const k of Object.keys(d.tutorCounts)) { const v = Math.floor(+d.tutorCounts[k]); if (!Number.isFinite(v) || v < 1) delete d.tutorCounts[k]; else d.tutorCounts[k] = Math.min(v, 99); }
  if (d.scamJournal != null && (typeof d.scamJournal !== 'object' || Array.isArray(d.scamJournal))) d.scamJournal = undefined;   // T5: tolerant — a bad journal never blocks a save (restore() → empty)
  if (Array.isArray(d.build)) d.build = d.build.filter((e) => e.id !== 'jar_spend');   // S66-A: old saves had a Spend jar prop; it is gone (its balance, if any, stays in eco.state.jars.spend and still counts as Spend)
  if (Math.floor(+d.v) < 4) synthesizeLegacyJars(d);
  // T1-C: jarsUnlocked is an additive v4 field (no version bump). Missing / malformed → legacy migration: Spend + every jar the player already owns (build[] jar_*,\n  //   incl. the 4 synthesized by synthesizeLegacyJars) + progress (season ≥ 2 → Save + Protect, ≥ 3 → Invest) so a mid-run profile never loses a jar it was using\n  //   and never waits for a one-shot rule that already fired in the past.\n
  d.jarsUnlocked = migrateJarsUnlocked(d);                       // 48E migrate v1–v3 → 4 jar_* build entries (land-snap happens in applySnapshot)
  return d;
}

/** T1-C: the jar keys a snapshot counts as unlocked. Valid `jarsUnlocked` array → filtered to known keys (+ 'spend'); otherwise legacy derivation (see parseSnapshot). */
export const JAR_KEYS_ALL = ['spend', 'save', 'invest', 'protect'];
export function migrateJarsUnlocked(d) {
  const set = new Set(['spend']);
  if (Array.isArray(d?.jarsUnlocked) && d.jarsUnlocked.every((k) => typeof k === 'string')) { for (const k of d.jarsUnlocked) if (JAR_KEYS_ALL.includes(k)) set.add(k); }
  else {
    for (const e of Array.isArray(d?.build) ? d.build : []) { const id = String(e?.id || ''); if (id.startsWith('jar_') && JAR_KEYS_ALL.includes(id.slice(4))) set.add(id.slice(4)); }
    let eco = d?.eco; if (typeof eco === 'string') { try { eco = JSON.parse(eco); } catch { eco = null; } }   // parseSnapshot leaves d.eco as the stored string
    const season = Math.floor(+(eco?.state?.season ?? 1)) || 1;
    if (season >= 2) { set.add('save'); set.add('protect'); } if (season >= 3) set.add('invest');
    for (const k of JAR_KEYS_ALL) if (+(eco?.state?.jars?.[k]) > 0) set.add(k);   // a jar that holds Spark was obviously usable
  }
  return JAR_KEYS_ALL.filter((k) => set.has(k));
}

export function hasSave(storage) { return load(storage) != null; }

// S25 — persistent unlocks, separate from the run slot (a lost run clears `lumen.save` but never the unlocks).
//   unlocks()            → { endless: bool }   · setUnlock('endless', true) → persisted · hasWon() = unlocks().endless
//   Endless mode stays hidden on the title until the player has won the story once (eco:win → Game.js installSave sets it).
export const UNLOCKS_KEY = 'lumen.unlocks';
export function unlocks(storage) {
  const st = storageOf(storage); if (!st) return { endless: false };
  try { const raw = st.getItem(UNLOCKS_KEY); const u = raw ? JSON.parse(raw) : null; return { endless: !!(u && u.endless) }; } catch (_) { return { endless: false }; }
}
export function setUnlock(key, value = true, storage) {
  const st = storageOf(storage); if (!st) return false;
  const u = unlocks(storage); u[key] = !!value;
  try { st.setItem(UNLOCKS_KEY, JSON.stringify(u)); return true; } catch (_) { return false; }
}
export function hasWon(storage) { return unlocks(storage).endless; }
export function clearUnlocks(storage) { const st = storageOf(storage); if (!st) return false; try { st.removeItem(UNLOCKS_KEY); return true; } catch (_) { return false; } }

export function clear(storage) { const st = storageOf(storage); if (!st) return false; try { st.removeItem(SAVE_KEY); return true; } catch (_) { return false; } }

// ------------------------------------------------------------------------------------------------------- P3 export / import as text
function b64encode(s) {
  if (typeof btoa === 'function') { return btoa(unescape(encodeURIComponent(s))); }
  return Buffer.from(s, 'utf8').toString('base64');
}
function b64decode(s) {
  if (typeof atob === 'function') { return decodeURIComponent(escape(atob(s))); }
  return Buffer.from(s, 'base64').toString('utf8');
}
/** Snapshot → copyable text ("LUMEN1:<base64 json>"). null → ''. */
export function exportText(snap) { if (!snap) return ''; return EXPORT_PREFIX + b64encode(JSON.stringify(snap)); }
/** Text → snapshot or null. Accepts the prefixed base64 form or raw JSON. Whitespace-tolerant. */
export function importText(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim(); if (!t) return null;
  if (t.startsWith(EXPORT_PREFIX)) { try { return parseSnapshot(b64decode(t.slice(EXPORT_PREFIX.length).replace(/\s+/g, ''))); } catch (_) { return null; } }
  return parseSnapshot(t);
}

/** One-line summary for the title screen sub-text: "Season 3 · 412 Spark · 5 stalls". */
export function describe(snap) {
  if (!snap) return '';
  let s = null; try { s = typeof snap.eco === 'string' ? JSON.parse(snap.eco).state : snap.eco?.state; } catch (_) { s = null; }
  const parts = [];
  if (s?.season != null) parts.push(`Season ${s.season}`);
  if (s?.spark != null) parts.push(`${Math.round(s.spark)} Spark`);
  if (Array.isArray(snap.build)) parts.push(`${snap.build.filter((e) => String(e.id).startsWith('stall_')).length} stalls`);
  if (Array.isArray(snap.abilities)) parts.push(`${snap.abilities.length}/6 abilities`);
  if (snap.mode === 'endless') parts.push('Endless');
  return parts.join(' · ');
}

export default { SAVE_KEY, SAVE_VERSION, snapshot, save, load, clear, hasSave, exportText, importText, describe, parseSnapshot, synthesizeLegacyJars, snapJarsToLand };
