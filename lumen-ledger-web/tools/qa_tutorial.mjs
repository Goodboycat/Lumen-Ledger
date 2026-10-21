// Guided-tutorial QA (mobile + desktop). Run from game/ (needs the Playwright Chromium from tools/setup_browser.sh):
//   NODE_PATH=tools/node_modules node tools/qa_tutorial.mjs                 → 3 viewports, shots in tools/shots/tut_<vp>_<step>.png
//   NODE_PATH=tools/node_modules node tools/qa_tutorial.mjs --only 360x800 --no-shots
// For each viewport: fresh localStorage → title → PLAY → the tutorial must open by itself → walk every step and check:
//   • placement : the dialogue card is fully on screen and never covers the highlighted hole (ring) or the pointing hand
//   • hand      : the hand is on screen and next to the hole
//   • lock      : a 9×9 grid of probe points — every point outside the hole hits ONLY the tutorial (shade / card / hand area);
//                 inside the hole hits the tutorial cover on look-only steps, the real control on action steps
//   • keyboard  : game keys (KeyB, KeyW) are swallowed while the tutorial is open
// After the last step: the lock is gone (no .ll-tut-* element catches points), the game is unpaused, and replay from the pause
// menu (📖 TUTORIAL) opens it again. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium, devices;
try { ({ chromium, devices } = require('playwright')); } catch { try { ({ chromium, devices } = createRequire(new URL('../tools/node_modules/', import.meta.url).href)('playwright')); } catch { console.error('playwright missing → bash tools/setup_browser.sh'); process.exit(2); } }

const argv = process.argv;
const only = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || (argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '');
const noShots = argv.includes('--no-shots');
const port = +(process.env.QA_PORT || 3125);
const VIEWPORTS = [
  { id: '360x800',  width: 360,  height: 800, touch: true,  dpr: 2, note: 'phone portrait' },
  { id: '800x360',  width: 800,  height: 360, touch: true,  dpr: 2, note: 'phone landscape' },
  { id: '667x375',  width: 667,  height: 375, touch: true,  dpr: 2, note: 'small phone landscape' },
  { id: '1280x720', width: 1280, height: 720, touch: false, dpr: 1, note: 'desktop' },
];

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
if (!noShots) mkdirSync('tools/shots', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failedVp = 0;

async function tap(p, vp, x, y) { if (vp.touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); }
async function tapEl(p, vp, sel) { const h = await p.$(sel); const r = h && await h.boundingBox(); if (!r) return false; await tap(p, vp, r.x + r.width / 2, r.y + r.height / 2); return true; }

for (const vp of VIEWPORTS) {
  if (only && vp.id !== only) continue;
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch, userAgent: vp.touch ? devices['Pixel 5'].userAgent : undefined });
  const p = await ctx.newPage();
  const errors = [], fails = [];
  p.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/AudioContext encountered an error from the audio device/.test(m.text())) errors.push('[console.error] ' + m.text()); });
  await p.goto(`http://127.0.0.1:${port}/index.html?mute${vp.touch ? '&touch=1' : ''}`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(1800);
  await tapEl(p, vp, '.ll-title-btn.play');
  // the tutorial must open on the first PLAY
  let opened = false;
  for (let i = 0; i < 20 && !opened; i++) { await p.waitForTimeout(250); opened = await p.evaluate(() => !!window.ui?.tutorial?.state?.open); }
  if (!opened) fails.push('tutorial did not open on first PLAY');
  console.log(`\n[${vp.id} ${vp.note}${vp.touch ? ' touch' : ''}]`);

  const total = await p.evaluate(() => window.ui.tutorial.steps.length);
  for (let k = 0; opened && k < total; k++) {
    // wait until the layout has settled (card pop, ring glide, build tray slide-in) — the card's DOM rect must equal the layout target
    for (let w = 0; w < 30; w++) {
      await p.waitForTimeout(150);
      const ok = await p.evaluate(() => { const T = window.ui.tutorial, L = T.state.layout, c = T.card.getBoundingClientRect(); if (!T.step.target) return true; return !!L && Math.abs(c.left - L.card.l) < 1.5 && Math.abs(c.top - L.card.t) < 1.5 && !T.card.getAnimations().length; });
      if (ok && w >= 2) break;
    }
    const r = await p.evaluate(() => {
      const T = window.ui.tutorial, s = T.step, W = innerWidth, H = innerHeight;
      const vis = (e) => e && getComputedStyle(e).display !== 'none';
      const box = (e) => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }; };
      const inter = (a, c) => Math.max(0, Math.min(a.r, c.r) - Math.max(a.l, c.l)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.t, c.t));
      const card = box(T.card), sr = T.state.rect, ring = sr ? { l: sr.left, t: sr.top, r: Math.min(W, sr.left + sr.width), b: Math.min(H, sr.top + sr.height), w: sr.width, h: sr.height } : null;   // the layout's hole (the ring glides there)
      const L = T.state.layout, hand = s.target && L && L.hand ? { l: L.hand.x, t: L.hand.y, r: L.hand.x + 52, b: L.hand.y + 52, w: 52, h: 52 } : null;   // layout target (the DOM hand glides there)
      const out = { id: s.id, i: T.index, card, ring, hand, issues: [], probes: 0 };
      if (card.l < -1 || card.t < -1 || card.r > W + 1 || card.b > H + 1) out.issues.push(`card off-screen ${Math.round(card.l)},${Math.round(card.t)}→${Math.round(card.r)},${Math.round(card.b)}`);
      if (s.target && !ring) out.issues.push('no highlight ring for a targeted step');
      if (ring && inter(card, ring) > 4) out.issues.push(`card covers the highlight by ${Math.round(inter(card, ring))} px²`);
      if (hand) {
        const hb = { l: hand.l + 6, t: hand.t + 6, r: hand.r - 6, b: hand.b - 6 };
        if (inter(card, hb) > 4) out.issues.push(`card covers the hand by ${Math.round(inter(card, hb))} px²`);
        if (hand.l < -4 || hand.r > W + 4 || hand.t < -4 || hand.b > H + 4) out.issues.push('hand off-screen');
        if (ring) { const dx = Math.max(0, ring.l - hand.r, hand.l - ring.r), dy = Math.max(0, ring.t - hand.b, hand.t - ring.b); if (dx > 20 || dy > 20) out.issues.push(`hand ${Math.round(dx)},${Math.round(dy)} px away from the target`); }
      }
      // input lock: probe a grid; the top element must belong to the tutorial unless the point is inside an action hole
      const act = document.querySelector('.ll-tut').classList.contains('act');
      const tutEl = (e) => !!e?.closest?.('.ll-tut');
      for (let gx = 0; gx < 9; gx++) for (let gy = 0; gy < 9; gy++) {
        const x = Math.round((gx + 0.5) * W / 9), y = Math.round((gy + 0.5) * H / 9);
        const e = document.elementFromPoint(x, y); out.probes++;
        const inHole = ring && x > ring.l + 1 && x < ring.r - 1 && y > ring.t + 1 && y < ring.b - 1;
        if (inHole && act) continue;                                    // action hole: the real control is meant to work
        if (!tutEl(e)) out.issues.push(`LOCK LEAK @${x},${y} → ${e ? (e.className || e.tagName) : 'null'}`);
      }
      if (ring) {                                                       // centre of the hole
        const cx = (ring.l + ring.r) / 2, cy = (ring.t + ring.b) / 2, e = document.elementFromPoint(cx, cy);
        if (!act && !e?.classList?.contains('ll-tut-cover')) out.issues.push(`look-step hole centre → ${e?.className || e?.tagName} (should be the cover)`);
        if (act && tutEl(e)) out.issues.push('action-step hole is blocked by the tutorial');
      }
      out.paused = !!window.game?.paused;
      if (!out.paused) out.issues.push('game not paused during the tutorial');
      return out;
    });
    // keyboard swallow: B must not toggle the tray (except on the build step, where the tray may already be there)
    if (r.id !== 'build' && r.id !== 'deploy') {
      const before = await p.evaluate(() => !!window.ui.build.isOpen);
      await p.keyboard.press('KeyB'); await p.waitForTimeout(80);
      const after = await p.evaluate(() => !!window.ui.build.isOpen);
      if (before !== after) r.issues.push('KeyB leaked through the keyboard lock');
    }
    // focus trap: 6 × Tab must never focus anything outside the tutorial (or the pointed control on action steps)
    for (let t = 0; t < 6; t++) {
      await p.keyboard.press('Tab');
      const bad = await p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const T = window.ui.tutorial, s = T.step; if (a.closest('.ll-tut')) return null; const n = s.target && document.querySelector(s.target); if (s.mode === 'act' && n && n.contains(a)) return null; return a.className || a.tagName; });
      if (bad) { r.issues.push(`Tab focused ${bad} outside the tutorial`); break; }
    }
    await p.evaluate(() => document.activeElement?.blur?.());
    const leaks = r.issues.filter((s) => s.startsWith('LOCK LEAK'));
    const other = r.issues.filter((s) => !s.startsWith('LOCK LEAK'));
    console.log(`  ${String(r.i + 1).padStart(2)}/${total} ${r.id.padEnd(9)} card ${Math.round(r.card.l)},${Math.round(r.card.t)} ${Math.round(r.card.w)}×${Math.round(r.card.h)}` +
      `${r.ring ? ` · hole ${Math.round(r.ring.l)},${Math.round(r.ring.t)} ${Math.round(r.ring.w)}×${Math.round(r.ring.h)}` : ' · (centred)'} · lock ${r.probes - leaks.length}/${r.probes}` +
      `  ${r.issues.length ? 'FAIL ' + [...other, ...leaks.slice(0, 3), leaks.length > 3 ? `…+${leaks.length - 3} leaks` : ''].filter(Boolean).join(' | ') : 'OK'}`);
    if (r.issues.length) fails.push(`${r.id}: ${r.issues.length} issue(s)`);
    if (!noShots) await p.screenshot({ path: `tools/shots/tut_${vp.id}_${String(r.i + 1).padStart(2, '0')}_${r.id}.png` });
    // advance: the Build step wants the real BUILD button; every other step → Next
    const nextVisible = await p.evaluate(() => { const n = document.querySelector('.ll-tut-btn.next'); return !!n && getComputedStyle(n).display !== 'none'; });
    if (!nextVisible) { if (!(await tapEl(p, vp, '.ll-build-toggle'))) { fails.push('build step: no BUILD button'); break; } }
    else await tapEl(p, vp, '.ll-tut-btn.next');
    await p.waitForTimeout(150);
  }

  // after the tutorial: lock removed, game running, tray closed
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => {
    const W = innerWidth, H = innerHeight; let hits = 0;
    for (let gx = 0; gx < 9; gx++) for (let gy = 0; gy < 9; gy++) { const e = document.elementFromPoint((gx + 0.5) * W / 9, (gy + 0.5) * H / 9); if (e?.closest?.('.ll-tut')) hits++; }
    return { open: window.ui.tutorial.isOpen, hits, paused: !!window.game.paused, modal: window.ui.isModal(), bodyLock: document.body.classList.contains('ll-tut-open'), done: localStorage.getItem('lumen.tutorialDone') };
  });
  console.log(`  after close: open=${after.open} tutorial-hits=${after.hits}/81 bodyLock=${after.bodyLock} modal=${after.modal} done=${after.done}`);
  if (after.open || after.hits || after.bodyLock) fails.push('lock still active after the tutorial closed');
  if (after.done !== '1') fails.push('tutorial not marked done');
  // keyboard works again: B toggles the tray (only if no other modal took the screen, e.g. the season-1 dialogue)
  if (!after.modal) {
    await p.keyboard.press('KeyB'); await p.waitForTimeout(150);
    const tray = await p.evaluate(() => window.ui.build.isOpen);
    if (!tray) fails.push('KeyB does not open the tray after the tutorial'); else await p.keyboard.press('KeyB');
  }
  // replay from the pause menu
  await p.evaluate(() => { window.ui.dialogue?.close?.(); });
  await p.evaluate(() => window.ui.bus.emit('ui:tutorial', { from: 'pause' }));
  await p.waitForTimeout(400);
  const replay = await p.evaluate(() => window.ui.tutorial.state.open && window.ui.tutorial.index === 0);
  console.log(`  replay from pause menu: ${replay ? 'OK' : 'FAIL'}`);
  if (!replay) fails.push('replay from pause menu did not open');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  if (await p.evaluate(() => window.ui.tutorial.isOpen)) fails.push('Esc did not skip the tutorial');
  // a reload must NOT auto-open it again
  await p.goto(`http://127.0.0.1:${port}/index.html?mute${vp.touch ? '&touch=1' : ''}`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(1500); await tapEl(p, vp, '.ll-title-btn.play'); await p.waitForTimeout(1500);
  if (await p.evaluate(() => window.ui.tutorial.state.open)) fails.push('tutorial auto-opened again after it was finished');

  if (errors.length) fails.push(...errors);
  console.log(`  → ${fails.length ? 'FAIL: ' + fails.join(' ; ') : 'OK'}`);
  if (fails.length) failedVp++;
  await ctx.close();
}
await b.close(); server.kill();
const n = VIEWPORTS.filter((v) => !only || v.id === only).length;
console.log(`\nQA_TUTORIAL: ${n - failedVp}/${n} viewports OK${failedVp ? '' : ' ✅'}`);
process.exit(failedVp ? 1 : 0);
