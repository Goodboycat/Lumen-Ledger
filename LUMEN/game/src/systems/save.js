// src/systems/save.js — Chat 10D. Versioned localStorage save for Lumen Ledger. Pure JS, no Three, no DOM (storage is injected).
//   import { snapshot, save, load, clear, hasSave, exportText, importText, SAVE_KEY, SAVE_VERSION } from './systems/save.js';
//   const snap = snapshot(lg);            // plain object from the running game (lg = createLumenGame result with lg.sb)
//   save(snap);                           // → localStorage[SAVE_KEY] (JSON) · returns true/false (quota / no storage → false, never throws)
//   const snap2 = load();                 // → object or null (missing, bad JSON, wrong major version → null)
//   hasSave()  clear()                    // title CONTINUE button · lose / new game
//   exportText(snap) / importText(text)   // P3: base64 JSON text with a "LUMEN1:" prefix — copy/paste for the Flutter WebView when storage is wiped
// Snapshot shape (v1):
//   { v, at, version, mode, state, seasonsToWin, eco: <Economy.serialize() string>, build: [{id,cx,cz,rot,level,cost}], story: {v,state}|null,
//     helpers: ['helper_runner', …], jars: {save,invest,protect} pct or null, settings? }
// Rules: a save is written by the integrator at season end + on review→playing (autosave) — never per frame. Loading NEVER mutates the
// snapshot. Anything missing in an old save falls back to the fresh-sandbox value (forward-compatible by omission).

export const SAVE_KEY = 'lumen.save';
export const SAVE_VERSION = 1;                // bump the MAJOR when a snapshot can no longer be applied; minor changes stay v1 (fields optional)
export const EXPORT_PREFIX = 'LUMEN1:';

function storageOf(storage) {
  if (storage) return storage;
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch (_) { /* SecurityError in sandboxed iframes */ }
  return null;
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
    hero: sb.hero?.root ? { x: +sb.hero.root.position.x.toFixed(2), z: +sb.hero.root.position.z.toFixed(2) } : null,
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
  if (!d || typeof d !== 'object' || Math.floor(+d.v || 0) !== SAVE_VERSION) return null;
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
  return d;
}

export function hasSave(storage) { return load(storage) != null; }

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
  if (snap.mode === 'endless') parts.push('Endless');
  return parts.join(' · ');
}

export default { SAVE_KEY, SAVE_VERSION, snapshot, save, load, clear, hasSave, exportText, importText, describe, parseSnapshot };
