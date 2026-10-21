// Chat 11B — mobile QA harness. Run from game/ (needs the Playwright Chromium from tools/setup_browser.sh):
//   NODE_PATH=tools/node_modules node tools/qa_mobile.mjs            → 3 viewports, audit printed, shots in tools/shots/qa_<vp>_*.png
//   NODE_PATH=tools/node_modules node tools/qa_mobile.mjs --only 360x800
// For each viewport: load index.html?autoplay&touch=1 (phones) → drain the S1 opening dialogue → audit the DOM:
//   • overflow : visible UI elements whose rect leaves the viewport (right/bottom/left/top) by > 2 px
//   • overlap  : pairs of interactive panels (touch pad · build tray · jars · hud · dialogue · toasts) whose rects intersect
//   • taps     : visible buttons / sliders smaller than 44×44 css px (Apple HIG minimum)
//   • scroll   : document scrollable (scrollWidth/Height > viewport) → itch.io iframe would show scrollbars
//   • stats    : fps · draw calls · meshes (window.game)
// Exit code 1 if any viewport has overflow / overlap / scroll or a page error. Taps < 44 px are a warning only.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium, devices;
try { ({ chromium, devices } = require('playwright')); } catch { try { ({ chromium, devices } = createRequire(new URL('../tools/node_modules/', import.meta.url).href)('playwright')); } catch { console.error('playwright missing → bash tools/setup_browser.sh'); process.exit(2); } }

const only = (process.argv.find((a) => a.startsWith('--only')) || '').split('=')[1] || (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '');
const noShots = process.argv.includes('--no-shots');
const port = +(process.env.QA_PORT || 3124);

export const VIEWPORTS = [
  { id: '360x800',  width: 360,  height: 800, touch: true,  dpr: 2, note: 'phone portrait' },
  { id: '800x360',  width: 800,  height: 360, touch: true,  dpr: 2, note: 'phone landscape' },
  { id: '1280x720', width: 1280, height: 720, touch: false, dpr: 1, note: 'desktop / itch.io embed' },
];

// panels that must never overlap each other while playing (selectors are the 7A/7B/7C roots)
const PANELS = { hud: '.ll-hud', jars: '.ll-jars', build: '.ll-build', touchpad: '.ll-touch-pad', dialogue: '.ll-dlg', toasts: '.ll-toasts' };   // #debug-stats is dev-only (?debug / F3), bottom-left, not gated

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
if (!noShots) mkdirSync('tools/shots', { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
const results = [];

for (const vp of VIEWPORTS) {
  if (only && vp.id !== only) continue;
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch, userAgent: vp.touch ? devices['Pixel 5'].userAgent : undefined });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/AudioContext encountered an error from the audio device/.test(m.text())) errors.push('[console.error] ' + m.text()); });
  p.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  p.on('requestfailed', (r) => errors.push('[404/failed] ' + r.url()));
  const url = `http://127.0.0.1:${port}/index.html?autoplay&debug${vp.touch ? '&touch=1' : ''}`;
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(1800);
  if (!noShots) await p.screenshot({ path: `tools/shots/qa_${vp.id}_0_title.png` });

  // drain the opening dialogue: tap the dialogue box (touch) / press Enter (desktop), up to 14 times, until it closes
  for (let i = 0; i < 14; i++) {
    const open = await p.evaluate(() => { const d = document.querySelector('.ll-dlg'); return !!d && getComputedStyle(d).display !== 'none'; });
    if (!open) break;
    if (vp.touch) { const box = await p.$('.ll-dlg'); const r = box && await box.boundingBox(); if (r) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); else await p.keyboard.press('Enter'); }
    else await p.keyboard.press('Enter');
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(600);

  const audit = await p.evaluate(({ PANELS, W, H }) => {
    const vis = (e) => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const rect = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; };
    const name = (e) => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase();
    // overflow: every visible element inside #game-root that is not the canvas
    const overflow = [];
    for (const e of document.querySelectorAll('#game-root *')) {
      if (e.tagName === 'CANVAS' || !vis(e)) continue;
      const r = rect(e);
      if (r.r > W + 2 || r.b > H + 2 || r.x < -2 || r.y < -2) overflow.push(`${name(e)} ${r.x},${r.y} ${r.w}×${r.h}`);
    }
    // overlap between panels
    const boxes = {};
    for (const [k, sel] of Object.entries(PANELS)) { const e = document.querySelector(sel); if (e && vis(e)) boxes[k] = rect(e); }
    const overlap = [];
    const keys = Object.keys(boxes);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = boxes[keys[i]], c = boxes[keys[j]];
      const ix = Math.min(a.r, c.r) - Math.max(a.x, c.x), iy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
      if (ix > 4 && iy > 4) overlap.push(`${keys[i]}×${keys[j]} ${ix}×${iy}px`);
    }
    // tap targets
    const taps = [];
    for (const e of document.querySelectorAll('#game-root button, #game-root input[type=range], #game-root [role=button]')) {
      if (!vis(e)) continue; const r = rect(e);
      if (r.w < 44 || r.h < 44) taps.push(`${name(e)} ${r.w}×${r.h}`);
    }
    const de = document.documentElement;
    const scroll = { w: de.scrollWidth, h: de.scrollHeight, x: de.scrollWidth > W + 1, y: de.scrollHeight > H + 1 };
    const g = window.game; let meshes = 0; g?.scene?.traverse((x) => { if (x.isMesh && !x.userData.isOutline) meshes++; });
    const stats = g ? { fps: g.stats.fps, dc: g.stats.drawCalls, meshes, dpr: window.devicePixelRatio, canvas: rect(document.querySelector('canvas')) } : null;
    const state = window.lumen?.state || document.body.className;
    return { overflow, overlap, taps, scroll, stats, boxes, state };
  }, { PANELS, W: vp.width, H: vp.height });

  if (!noShots) await p.screenshot({ path: `tools/shots/qa_${vp.id}_1_play.png` });
  // open the build tray too (B / touch build button) and audit overlap once more
  if (vp.touch) { const btn = await p.$('.ll-touch-btn.build, .ll-touch-pad button'); const r = btn && await btn.boundingBox(); if (r) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); }
  else await p.keyboard.press('KeyB');
  await p.waitForTimeout(700);
  const tray = await p.evaluate(({ PANELS, W, H }) => {
    const vis = (e) => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const rect = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; };
    const boxes = {}; for (const [k, sel] of Object.entries(PANELS)) { const e = document.querySelector(sel); if (e && vis(e)) boxes[k] = rect(e); }
    const overlap = []; const keys = Object.keys(boxes);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = boxes[keys[i]], c = boxes[keys[j]]; const ix = Math.min(a.r, c.r) - Math.max(a.x, c.x), iy = Math.min(a.b, c.b) - Math.max(a.y, c.y); if (ix > 4 && iy > 4) overlap.push(`${keys[i]}×${keys[j]} ${ix}×${iy}px`); }
    const overflow = []; const tr = document.querySelector('.ll-build'); if (tr && vis(tr)) { const r = rect(tr); if (r.r > W + 2 || r.b > H + 2 || r.x < -2 || r.y < -2) overflow.push(`.ll-build ${r.x},${r.y} ${r.w}×${r.h}`); }
    return { open: !!(tr && vis(tr)), overlap, overflow, box: tr && vis(tr) ? rect(tr) : null };
  }, { PANELS, W: vp.width, H: vp.height });
  if (!noShots) await p.screenshot({ path: `tools/shots/qa_${vp.id}_2_build.png` });

  const bad = audit.overflow.length + audit.overlap.length + tray.overlap.length + tray.overflow.length + (audit.scroll.x || audit.scroll.y ? 1 : 0) + errors.length;
  if (bad) failed++;
  results.push({ vp, audit, tray, errors, bad });
  console.log(`\n[${vp.id} ${vp.note}${vp.touch ? ' touch' : ''}]  stats ${JSON.stringify(audit.stats)}`);
  console.log(`  panels: ${Object.entries(audit.boxes).map(([k, r]) => `${k}@${r.x},${r.y} ${r.w}×${r.h}`).join(' · ') || 'none visible'}`);
  console.log(`  overflow (${audit.overflow.length}): ${audit.overflow.join(' | ') || 'none'}`);
  console.log(`  overlap  (${audit.overlap.length}): ${audit.overlap.join(' | ') || 'none'}`);
  console.log(`  build tray open=${tray.open} ${tray.box ? `@${tray.box.x},${tray.box.y} ${tray.box.w}×${tray.box.h}` : ''} overlap (${tray.overlap.length}): ${tray.overlap.join(' | ') || 'none'}${tray.overflow.length ? ' OVERFLOW ' + tray.overflow.join(' | ') : ''}`);
  console.log(`  taps < 44px (${audit.taps.length}, warning): ${audit.taps.slice(0, 8).join(' | ') || 'none'}${audit.taps.length > 8 ? ' …' : ''}`);
  console.log(`  scroll: ${audit.scroll.x || audit.scroll.y ? `YES ${audit.scroll.w}×${audit.scroll.h}` : 'none'}   errors: ${errors.length ? errors.join(' ; ') : 'none'}`);
  console.log(`  → ${bad ? 'FAIL' : 'OK'}`);
  await ctx.close();
}
await b.close(); server.kill();
console.log(`\nQA_MOBILE: ${results.length - failed}/${results.length} viewports OK${failed ? ' — fix the FAIL lines above' : ' ✅'}`);
process.exit(failed ? 1 : 0);
