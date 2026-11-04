// tools/play.mjs — 45B. Real-browser playtest of index.html (Playwright headless, 1280×720). Run from game/ after `bash tools/setup_browser.sh`:
//   NODE_PATH=tools/node_modules node tools/play.mjs --script funnel [--speed 3] [--season 150] [--cap 200] [--shots]
// Boots `index.html?mute`, presses Enter on the title (= PLAY), clicks dialogue through, sets speed ×3 (window.lg.setSpeed — same as key T),
// replays the "average player" inputs via page.keyboard (WASD walk, B then 1 = stall at ~30 s game time, E = interact at a jar / the pier),
// skips each ledger with Enter, and at S3 start exports `window.lumenTelemetry.export()` → tools/shots/funnel_browser_45B.json.
// Then: node tools/funnel.mjs tools/shots/funnel_browser_45B.json --md   (FUNNEL_BASELINE "## 45B browser").
// Rule: no window.game / sb() scene forcing EXCEPT the stall fallback (if B+1 did not enter place mode, `ui:build` bus events place it — reported).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
const SPEED = +opt('--speed', 3), SEASON = +opt('--season', 150), CAP = +opt('--cap', 200), SHOTS = a.includes('--shots');
const OUT = 'tools/shots'; mkdirSync(OUT, { recursive: true });
const port = 3129, t0 = Date.now(), wall = () => ((Date.now() - t0) / 1000).toFixed(1);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], log = (...x) => console.log(`[${wall()}s]`, ...x);
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
const sleep = (ms) => p.waitForTimeout(ms);
const shot = async (n) => { if (SHOTS) { await p.screenshot({ path: `${OUT}/play_${n}.png` }); log('shot', n); } };
const findings = [];                                                          // every step the browser did NOT reach the way a player would

// ── boot + PLAY (keyboard Enter on the title, ui/title.js line 16) ────────────────────────────────────────────────────────────────
await p.goto(`http://127.0.0.1:${port}/index.html?mute${SEASON !== 150 ? `&season=${SEASON}` : ''}`, { waitUntil: 'load' });
await sleep(2500);
const title = await p.evaluate(() => ({ open: !!window.ui?.title?.isOpen, footer: document.querySelector('.ll-title-footer, .ll-title footer, [class*=version]')?.textContent?.trim() || null }));
log('title', JSON.stringify(title));
if (!title.open) findings.push('title not open 2.5 s after load');
await p.keyboard.press('Enter'); await sleep(1500);
let st = await p.evaluate(() => ({ sb: !!window.sb(), state: window.lg?.state, dlg: !!window.ui?.dialogue?.isOpen }));
log('after PLAY', JSON.stringify(st));
if (!st.sb) { findings.push('Enter on title did not start a run → clicking PLAY button'); await p.click('.ll-title button.play, .ll-title button').catch(() => {}); await sleep(1500); }

// ── helpers: dialogue (click body / press 1 like a player), ledger (Enter twice), speed ───────────────────────────────────────────
const dismiss = async () => { let n = 0; for (let i = 0; i < 16; i++) { const open = await p.evaluate(() => !!window.ui?.dialogue?.isOpen); if (!open) break; n++; const body = await p.$('.ll-dlg-body'); if (body) await body.click().catch(() => {}); else await p.keyboard.press('Space'); await sleep(350); } return n; };
const ledger = async () => { const open = await p.evaluate(() => !!window.ui?.ledger?.isOpen); if (!open) return false; await p.keyboard.press('Enter'); await sleep(400); await p.keyboard.press('Enter'); await sleep(600); return true; };
const speedUp = () => p.evaluate((n) => { if (window.lg?.speed !== n && window.lg?.state === 'playing') window.lg.setSpeed(n); return window.lg?.speed; }, SPEED);
const snap = () => p.evaluate(() => { const e = window.eco()?.state, s = window.sb(); return { season: e?.season, day: +(e?.day01 ?? e?.day ?? 0).toFixed?.(2), spark: Math.round(e?.spark ?? 0), speed: window.lg?.speed, state: window.lg?.state, modal: !!window.ui?.isModal?.(), build: s?.build?.mode, steps: window.lg?.telemetry?.session?.steps }; });
const hold = async (key, ms) => { await p.keyboard.down(key); await sleep(ms); await p.keyboard.up(key); };

const lines = await dismiss(); log('intro dialogue lines clicked', lines);
await shot('1_start');
log('speed →', await speedUp());

// ── the average player: walk a bit, place ONE stall at ~30 s game time (B, then 1), interact at a jar (E), skip ledgers, reach S3 ─
let placed = null, interacted = false, lastSeason = 1, guard = 0, s3 = null, firstSale = null;
while (Date.now() - t0 < CAP * 1000 && guard++ < 2000) {
  if (await ledger()) { log('ledger skipped'); await dismiss(); await speedUp(); continue; }
  if (await p.evaluate(() => !!window.ui?.dialogue?.isOpen)) { await dismiss(); await speedUp(); continue; }
  const s = await snap();
  if (s.state !== 'playing' && s.state !== 'endless') { findings.push(`state ${s.state} at ${wall()} s`); break; }
  if (s.season !== lastSeason) { lastSeason = s.season; log(`season ${s.season}`, JSON.stringify(s)); await shot(`season_${s.season}`); }
  if (firstSale == null && s.steps?.firstSale != null) { firstSale = s.steps.firstSale; log('firstSale', firstSale); }
  const gameT = s.steps?.play != null ? (await p.evaluate(() => window.lg?.telemetry?.now?.() ?? performance.now())) : 0;
  if (!placed && s.season === 1 && s.spark >= 0 && guard > 6) {                 // ≈ 30 s game time: the one stall
    await p.keyboard.press('KeyB'); await sleep(500); await p.keyboard.press('Digit1'); await sleep(500);
    let mode = await p.evaluate(() => window.sb()?.build?.mode);
    if (mode === 'place' || mode === 'drag') { await p.keyboard.press('Enter'); await sleep(400); mode = await p.evaluate(() => window.sb()?.build?.mode); placed = 'keyboard B,1,Enter'; }
    const got = await p.evaluate(() => window.lg?.telemetry?.session?.steps?.firstStall);
    if (got == null) {
      placed = 'FALLBACK ui:build bus (B+1 did not place)'; findings.push(`stall: keyboard B→1→Enter left build.mode=${mode}; used ui:build select/confirm fallback`);
      await p.evaluate(() => { const lg = window.lg, bus = window.game.bus, sb = lg.sb; const picks = ['tea', 'bread', 'flowers', 'fish', 'toys']; const id = 'stall_' + (picks.find((k) => !sb.build.placeBlocker?.('stall_' + k)) || 'tea'); sb.eco.state.spark = Math.max(sb.eco.state.spark, 400);
        bus.emit('ui:build', { action: 'select', id }); for (const [x, z] of [[1, 1], [2, 1], [1, 2], [-1, 1], [1, -1], [3, 3], [-2, -2], [0, 3]]) { if (sb.build.canPlace(id, x, z)) { sb.build.moveTo(x, z); break; } } bus.emit('ui:build', { action: 'confirm' }); bus.emit('ui:build', { action: 'cancel' }); });
      await sleep(300);
    }
    log('stall', placed, JSON.stringify(await snap()));
    await shot('2_stall');
  } else if (!interacted && s.season === 2) { await hold('KeyW', 700); await hold('KeyA', 500); await p.keyboard.press('KeyE'); interacted = true; log('walked + E'); }
  else { await hold(['KeyW', 'KeyA', 'KeyS', 'KeyD'][guard % 4], 250); }
  if (s.season >= 3) { s3 = s; log('S3 reached', JSON.stringify(s)); await shot('3_s3'); break; }
  await sleep(400);
}
if (!s3) findings.push(`S3 not reached within cap ${CAP} s (last ${JSON.stringify(await snap())})`);

// ── export telemetry (the deliverable) ────────────────────────────────────────────────────────────────────────────────────────────
await p.evaluate(() => window.game.bus.emit('ui:title')); await sleep(800);  // closes the session like a quit
const json = await p.evaluate(() => window.lumenTelemetry.export());
const sessions = typeof json === 'string' ? JSON.parse(json) : json;
writeFileSync(`${OUT}/funnel_browser_45B.json`, JSON.stringify(sessions, null, 1));
log('sessions', sessions.length, '→', `${OUT}/funnel_browser_45B.json`);
console.log('LAST', JSON.stringify(sessions.at(-1)?.steps), 'modal', sessions.at(-1)?.modalSeconds, 'handled', sessions.at(-1)?.sparkHandled, '/', sessions.at(-1)?.sparkTotal);
console.log('FINDINGS', findings.length ? findings.join(' | ') : 'none');
console.log('errors:', errors.length ? errors.slice(0, 5).join(' || ') : 'none');
await b.close(); server.kill();
