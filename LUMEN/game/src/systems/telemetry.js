// src/systems/telemetry.js — Chat 40A (MASTER_PLAN_V6 phase 40 "Instrument first"). Pure JS: no DOM, no Three, storage injected.
//   import { createTelemetry, TELEMETRY_KEY } from './systems/telemetry.js';
//   const T = createTelemetry({ bus, storage, now: () => performance.now(), endpoint: null, enabled: true, isModal: () => ui.isModal() });
//   T.session   → { id, startedAt, steps:{play, firstStall, firstSale, firstCoinInHand, s2, s3}, quit:{state, season, day01, reason}|null,
//                  seasonsPlayed, sparkHandled, sparkTotal, modalSeconds, touch, w, h, version }
//   T.mark(step, data?)   idempotent per session — records t = now() − startedAt (seconds, 2 dp) once · emits 'telemetry:mark' {step, t}
//   T.end(reason, info?)  writes quit once {state, season, day01, reason} then flush()
//   T.flush()             appends/updates the session in the ring buffer storage[TELEMETRY_KEY] (max 50) · POSTs via sendBeacon if endpoint
//   T.export()            JSON string of the ring buffer (what tools/funnel.mjs reads) · T.summary() → the PLAN §5 numbers · T.destroy() → 0 listeners
//   bus in : ui:start → play · game:start (new session, state/season context) · build:placed {id:'stall_*', entry} (not scenery/starter) → firstStall ·
//            eco:sale → firstSale · eco:spark {delta>0} → sparkTotal (+ sparkHandled when reason is 'tip:*' | 'till:*' → firstCoinInHand) ·
//            eco:season {season} → seasonsPlayed, s2/s3 · eco:tick {day01, season} → modal seconds sample (first 90 s) · ui:title / eco:lose / eco:win → end
//   Privacy: anonymous. Session id is random; no IP/UA; only touch:bool and viewport w×h. Network is OFF unless `endpoint` is given.
//   Never blocks ui:start — every handler is synchronous bookkeeping; flush() is try/catch and fire-and-forget.

export const TELEMETRY_KEY = 'lumen.telemetry';
export const TELEMETRY_MAX = 50;
export const STEPS = ['play', 'firstStall', 'firstSale', 'firstCoinInHand', 's2', 's3'];
const HANDLED_RE = /^(tip|till):/;

function memStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function rid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

export function createTelemetry(opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('createTelemetry needs { bus }');
  const storage = opts.storage || memStorage();
  const now = opts.now || (() => Date.now());
  const endpoint = opts.endpoint || null, enabled = opts.enabled !== false, isModal = opts.isModal || null;
  const T = { session: null, enabled, endpoint, key: opts.key || TELEMETRY_KEY, max: opts.max || TELEMETRY_MAX };
  let offs = [], ctx = { state: 'title', season: 0, day01: 0 }, lastTick = null;

  const fresh = () => ({ id: rid(), startedAt: now(), at: Date.now(), version: opts.version || null, touch: !!opts.touch, w: opts.w | 0, h: opts.h | 0,
    steps: {}, quit: null, seasonsPlayed: 0, sparkHandled: 0, sparkTotal: 0, modalSeconds: 0 });
  const tOf = () => +(((now() - T.session.startedAt) / 1000)).toFixed(2);
  const ensure = () => { if (!T.session) T.session = fresh(); return T.session; };

  T.mark = (step, data) => {
    if (!enabled) return false; const s = ensure(); if (s.steps[step] != null) return false;
    s.steps[step] = tOf(); if (data !== undefined) (s.data ??= {})[step] = data; bus.emit('telemetry:mark', { step, t: s.steps[step] }); return true;
  };
  T.end = (reason = 'unknown', info = {}) => {
    if (!enabled || !T.session || T.session.quit) return false;
    T.session.quit = { state: info.state ?? ctx.state, season: info.season ?? ctx.season, day01: +(+(info.day01 ?? ctx.day01)).toFixed(2), reason, t: tOf() };
    T.flush(); return true;
  };
  T.readAll = () => { try { const j = JSON.parse(storage.getItem(T.key) || '[]'); return Array.isArray(j) ? j : []; } catch (_) { return []; } };
  T.flush = () => {
    if (!enabled || !T.session) return false; const s = T.session;
    try { const all = T.readAll().filter((x) => x.id !== s.id); all.push(s); while (all.length > T.max) all.shift(); storage.setItem(T.key, JSON.stringify(all)); } catch (_) { /* quota / no storage */ }
    if (endpoint) { try { const json = JSON.stringify(s); if (typeof navigator !== 'undefined' && navigator.sendBeacon) navigator.sendBeacon(endpoint, json); else if (typeof fetch === 'function') fetch(endpoint, { method: 'POST', body: json, keepalive: true }).catch(() => {}); } catch (_) { /* fire-and-forget */ } }
    return true;
  };
  T.export = () => JSON.stringify(T.readAll());
  T.clear = () => { try { storage.removeItem ? storage.removeItem(T.key) : storage.setItem(T.key, '[]'); } catch (_) { /* ignore */ } };
  T.summary = (s = T.session) => s ? ({ reachedS2: s.steps.s2 != null, reachedS3: s.steps.s3 != null, tFirstStall: s.steps.firstStall ?? null, tFirstSale: s.steps.firstSale ?? null,
    tFirstCoin: s.steps.firstCoinInHand ?? null, modalSeconds: +s.modalSeconds.toFixed(1), handledRatio: s.sparkTotal > 0 ? +(s.sparkHandled / s.sparkTotal).toFixed(3) : 0, quit: s.quit }) : null;

  // ---- bus wiring ---------------------------------------------------------------------------------------------------------
  const on = (n, f) => offs.push(bus.on(n, f));
  on('ui:start', (p) => { if (!enabled) return; if (T.session && T.session.quit) T.session = null; const s = ensure(); s.mode = p?.mode || 'story'; ctx = { state: 'playing', season: 1, day01: 0 }; lastTick = null; T.mark('play'); });
  on('game:start', (p) => { if (!enabled) return; const s = ensure(); if (p?.resumed) s.resumed = true; ctx.state = 'playing'; if (s.steps.play == null) T.mark('play'); });
  on('game:state', (p) => { if (p?.state) ctx.state = p.state; });
  on('build:placed', (p) => { if (!p || !/^stall_/.test(p.id || '')) return; if (p.entry?.scenery || p.starter || p.entry?.starter) return; T.mark('firstStall', { id: p.id }); });
  on('eco:sale', () => T.mark('firstSale'));
  on('eco:spark', (p) => {
    if (!enabled || !T.session || !p || !(p.delta > 0)) return; const s = T.session; s.sparkTotal += p.delta;
    if (HANDLED_RE.test(p.reason || '')) { s.sparkHandled += p.delta; T.mark('firstCoinInHand', { reason: p.reason }); }
  });
  on('eco:season', (r) => { if (!enabled || !T.session) return; const s = T.session; s.seasonsPlayed = Math.max(s.seasonsPlayed, r?.season || 0); const next = (r?.season || 0) + 1; ctx.season = next; ctx.day01 = 0; if (next >= 2) T.mark('s2'); if (next >= 3) T.mark('s3'); });
  on('eco:tick', (p) => {
    if (!enabled || !T.session || !p) return; ctx.season = p.season ?? ctx.season; ctx.day01 = p.day01 ?? ctx.day01;
    const t = tOf(); if (lastTick != null && t <= 90 && isModal && isModal()) T.session.modalSeconds += Math.max(0, Math.min(0.5, t - lastTick)); lastTick = t;
  });
  on('ui:title', () => T.end('title'));
  on('eco:lose', (p) => T.end('lose', { state: 'ending', season: p?.season }));
  on('eco:win', (p) => T.end('win', { state: 'ending', season: p?.season }));
  T.destroy = () => { for (const f of offs) f(); offs = []; };
  return T;
}
