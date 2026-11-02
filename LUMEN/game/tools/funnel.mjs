#!/usr/bin/env node
// tools/funnel.mjs — Chat 40B. Funnel report over 40A telemetry sessions (MASTER_PLAN_V6 §5). Pure Node, no browser.
//   node tools/funnel.mjs <sessions.json|->  [--md]            table over `window.lumenTelemetry.export()` output (array of sessions)
//   node tools/funnel.mjs --synthetic N [--season S] [--md] [--out f.json]
//                                       N headless createLumenGame "average player" sessions (game-time clock, 30 fps):
//                                       PLAY → read dialogue → place 1 stall at t=30 s → play to S3 (ledgers skipped) → title. Season = S s (default 150 = real).
//   node tools/funnel.mjs --compare a.json b.json [--md]       delta columns (P3)
// Exit 0 on success, 1 on bad input. Sessions with `resumed:true` are bucketed separately (continue-game; firstStall may never fire).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const STEPS = ['play', 'firstStall', 'firstSale', 'firstCoinInHand', 's2', 's3'];
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(0)} %` : 'n/a');
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? 'n/a' : (+v).toFixed(d));

/** @param {Array<object>} sessions  40A session objects → PLAN §5 numbers. */
export function analyze(sessions) {
  if (!Array.isArray(sessions)) throw new Error('expected an array of sessions');
  const fresh = sessions.filter((s) => s && !s.resumed), resumed = sessions.length - fresh.length, n = fresh.length;
  const steps = {};
  for (const k of STEPS) { const ts = fresh.map((s) => s.steps?.[k]).filter((t) => typeof t === 'number'); steps[k] = { reached: ts.length, pct: n ? ts.length / n : null, median: median(ts) }; }
  const quits = {}; let quitN = 0;                                   // "S2 d0.3" → count (season × day01 decile)
  for (const s of fresh) { const q = s.quit; if (!q) continue; quitN++; const key = `S${q.season ?? '?'} d${(Math.min(9, Math.max(0, Math.floor((q.day01 ?? 0) * 10))) / 10).toFixed(1)} ${q.reason || ''}`.trim(); quits[key] = (quits[key] || 0) + 1; }
  const ratios = fresh.filter((s) => s.sparkTotal > 0).map((s) => s.sparkHandled / s.sparkTotal);
  const modal = fresh.map((s) => +s.modalSeconds || 0);
  return { n, resumed, total: sessions.length, steps, quits, quitN, noQuit: n - quitN, handledRatio: mean(ratios), handledN: ratios.length,
    sparkHandled: mean(fresh.map((s) => s.sparkHandled || 0)), sparkTotal: mean(fresh.map((s) => s.sparkTotal || 0)), modalSeconds: mean(modal), seasons: mean(fresh.map((s) => s.seasonsPlayed || 0)) };
}

/** Text (default) or Markdown table. */
export function render(R, { md = false, title = '' } = {}) {
  const rows = [['step', 'reached', '%', 'median t (s)'], ...STEPS.map((k) => [k, String(R.steps[k].reached), pct(R.steps[k].reached, R.n), fmt(R.steps[k].median, 2)])];
  const quitRows = Object.entries(R.quits).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v), pct(v, R.n)]);
  const sum = [`sessions n=${R.n}` + (R.resumed ? ` (+${R.resumed} resumed, excluded)` : ''),
    `mean sparkHandled/sparkTotal = ${R.handledRatio == null ? 'n/a' : (100 * R.handledRatio).toFixed(1) + ' %'} (${fmt(R.sparkHandled, 0)} / ${fmt(R.sparkTotal, 0)} spark · ${R.handledN} sessions with sales)`,
    `mean modalSeconds (0–90 s) = ${fmt(R.modalSeconds)} s`, `mean seasons played = ${fmt(R.seasons)}`, `quit recorded in ${R.quitN}/${R.n} (${R.noQuit} still open / tab closed without pagehide)`];
  if (md) {
    const t = (rs) => [`| ${rs[0].join(' | ')} |`, `|${rs[0].map(() => '---').join('|')}|`, ...rs.slice(1).map((r) => `| ${r.join(' | ')} |`)].join('\n');
    return [title ? `### Funnel — ${title}` : '', sum.map((l) => `- ${l}`).join('\n'), '', t(rows), '', quitRows.length ? t([['quit (season × day01 decile · reason)', 'n', '%'], ...quitRows]) : '_no quits recorded_'].join('\n');
  }
  const col = (rs) => { const w = rs[0].map((_, i) => Math.max(...rs.map((r) => r[i].length))); return rs.map((r) => r.map((c, i) => c.padEnd(w[i])).join('  ')).join('\n'); };
  return [title ? `FUNNEL — ${title}` : 'FUNNEL', ...sum.map((l) => '  ' + l), '', col(rows), '', quitRows.length ? col([['quit (season × day01 decile · reason)', 'n', '%'], ...quitRows]) : '  no quits recorded'].join('\n');
}

/** P3: delta table a → b. */
export function renderCompare(A, B, { md = false } = {}) {
  const d = (a, b, dd = 1) => (a == null || b == null ? 'n/a' : (b - a >= 0 ? '+' : '') + (b - a).toFixed(dd));
  const rows = [['metric', 'a', 'b', 'Δ'], ['n', String(A.n), String(B.n), d(A.n, B.n, 0)],
    ...STEPS.map((k) => [`${k} %`, pct(A.steps[k].reached, A.n), pct(B.steps[k].reached, B.n), d(A.steps[k].pct == null ? null : 100 * A.steps[k].pct, B.steps[k].pct == null ? null : 100 * B.steps[k].pct, 0)]),
    ...STEPS.map((k) => [`${k} median s`, fmt(A.steps[k].median, 2), fmt(B.steps[k].median, 2), d(A.steps[k].median, B.steps[k].median, 2)]),
    ['handled %', fmt(A.handledRatio == null ? null : 100 * A.handledRatio), fmt(B.handledRatio == null ? null : 100 * B.handledRatio), d(A.handledRatio == null ? null : 100 * A.handledRatio, B.handledRatio == null ? null : 100 * B.handledRatio)],
    ['modalSeconds', fmt(A.modalSeconds), fmt(B.modalSeconds), d(A.modalSeconds, B.modalSeconds)]];
  if (md) return [`| ${rows[0].join(' | ')} |`, `|${rows[0].map(() => '---').join('|')}|`, ...rows.slice(1).map((r) => `| ${r.join(' | ')} |`)].join('\n');
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length))); return rows.map((r) => r.map((c, i) => c.padEnd(w[i])).join('  ')).join('\n');
}

/** Headless "average player": N sessions, game-time clock. Returns the array of exported sessions. */
export async function synthetic(N = 20, { seasonSeconds = 150, stallAt = 30, cap = 420, seed0 = 1, log = () => {} } = {}) {
  const game_ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const imp = (p) => import(pathToFileURL(resolve(game_, p)).href);
  const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
  const THREE = await imp('vendor/three.module.js');
  const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
  const { EventBus } = await imp('src/core/EventBus.js');
  const { tweens } = await imp('src/anim/Tween.js');
  const { createLumenGame, STALL_PICKS } = await imp('src/Game.js');
  const { mountUI } = await imp('ui/index.js');
  const { PROP_CATALOG } = await imp('src/assets/props.js');
  const storyData = JSON.parse(readFileSync(resolve(game_, 'data/story.json'), 'utf8'));
  const out = [];
  for (let i = 0; i < N; i++) {
    const mem = new Map(); const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    const bus = new EventBus();
    const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {}, snapTo() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    document.body.innerHTML = '';
    const ui = mountUI(document.body, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'funnel' });
    let clock = 0;                                                     // game-time ms → telemetry t is play-time, not wall time
    const lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds, seed: seed0 + i, storage, cinematics: false, telemetryNow: () => clock });
    const T = lg.telemetry; if (!T) throw new Error('lg.telemetry missing (40A)');
    const dt = 1 / 30; const step = () => { clock += dt * 1000; game.time += dt; game.sequences.update(dt); game.tweens.update(dt); ui.update?.(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); };
    const drain = () => { let n = 0; while (ui.dialogue.isOpen && n < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); n++; } };
    ui.title.buttons.story.click(); step(); drain();
    const eco = lg.sb.eco; let placed = false, guard = 0;
    while (eco.state.season < 3 && clock < cap * 1000 && guard++ < cap * 30 + 100) {
      step(); if (ui.dialogue.isOpen) drain();
      if (ui.ledger.isOpen) { ui.ledger.skip(); ui.ledger.continue(); step(); drain(); }
      if (!placed && clock >= stallAt * 1000 && !ui.isModal()) {           // the one stall the average player places
        const picks = STALL_PICKS.filter((k) => !lg.sb.build.placeBlocker('stall_' + k)); const id = 'stall_' + picks[i % picks.length]; eco.state.spark = Math.max(eco.state.spark, 400);   // average player has saved up by 30 s
        bus.emit('ui:build', { action: 'select', id });
        for (const [cx, cz] of [[1, 1], [2, 1], [1, 2], [-1, 1], [1, -1], [3, 3], [-2, -2], [0, 3]]) { if (lg.sb.build.canPlace(id, cx, cz)) { lg.sb.build.moveTo(cx, cz); break; } }
        bus.emit('ui:build', { action: 'confirm' }); bus.emit('ui:build', { action: 'cancel' }); placed = true;
      }
    }
    bus.emit('ui:title');
    const S = JSON.parse(T.export()).at(-1); out.push(S);
    log(`  run ${i + 1}/${N} seed ${seed0 + i}: firstStall ${S.steps.firstStall ?? 'n/a'} s · firstSale ${S.steps.firstSale ?? 'n/a'} s · s3 ${S.steps.s3 ?? 'n/a'} s · handled ${S.sparkHandled}/${S.sparkTotal} · quit ${S.quit?.state}@S${S.quit?.season}`);
    lg.destroy(); ui.destroy();
  }
  return out;
}

const read = (src) => JSON.parse(src === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(src), 'utf8'));
async function main() {
  const a = process.argv.slice(2), md = a.includes('--md'), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  if (a.includes('--compare')) { const i = a.indexOf('--compare'); console.log(renderCompare(analyze(read(a[i + 1])), analyze(read(a[i + 2])), { md })); return; }
  if (a.includes('--synthetic')) {
    const N = +opt('--synthetic', 20) || 20, season = +opt('--season', 150) || 150, quiet = a.includes('--quiet'), t0 = Date.now();
    const sessions = await synthetic(N, { seasonSeconds: season, log: quiet ? () => {} : console.log });
    const out = opt('--out', null); if (out) { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(resolve(out), JSON.stringify(sessions)); }
    console.log(render(analyze(sessions), { md, title: `synthetic ${N} × headless average player · season ${season} s · stall @30 s · ${((Date.now() - t0) / 1000).toFixed(1)} s wall` + (out ? ` · → ${out}` : '') }));
    return;
  }
  const src = a.find((x) => !x.startsWith('--')); if (!src) { console.error('usage: node tools/funnel.mjs <sessions.json|-> [--md] | --synthetic N [--season S] [--out f] | --compare a b'); process.exit(1); }
  console.log(render(analyze(read(src)), { md, title: src }));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch((e) => { console.error('funnel:', e.message); process.exit(1); });
