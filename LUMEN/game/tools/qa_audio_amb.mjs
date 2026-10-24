// Headless probe for the 2026-10-24 audio pack: title shot → PLAY → ambience beds live → forced storm → rain/wind beds → title → off.
//   cd game && NODE_PATH=tools/node_modules node tools/qa_audio_amb.mjs
// Chromium is launched with --autoplay-policy=no-user-gesture-required so the AudioContext really runs; we read audio.state.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const port = 3131;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
mkdirSync('tools/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 652 } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const fail = (m) => { console.log('FAIL ' + m); };
try {
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'tools/shots/amb_00_title.png' });
  const endlessVisible = await page.evaluate(() => { const b = document.querySelector('.ll-title-btn.endless'); return b ? (b.offsetParent !== null && getComputedStyle(b).display !== 'none') : false; });
  console.log('title: endless button visible =', endlessVisible, '(expected false on a fresh profile)');
  // gesture → unlock, then PLAY
  await page.mouse.click(512, 300); await page.waitForTimeout(200);
  await page.click('.ll-title-btn.play'); await page.waitForTimeout(4500);
  const st1 = await page.evaluate(() => { const s = window.audio.state; return { unlocked: s.unlocked, ctx: s.ctx?.state, ambMode: s.ambMode, ambOn: s.ambOn, beds: Object.fromEntries(Object.entries(s.beds).map(([k, v]) => [k, v ? { src: !!v.s, gain: +v.g.gain.value.toFixed(2) } : null])), missing: [...s.missing], log: s.log.slice(-6), music: s.currentMusic }; });
  console.log('after PLAY:', JSON.stringify(st1));
  if (st1.ambMode !== 'always' || !st1.beds.surf?.src || !st1.beds.island_birds?.src) fail('always beds not live after PLAY');
  if (st1.beds.rain) fail('rain bed should not exist before a storm');
  // force a storm (vfx storm.hit emits storm:hit → thunder + rain/wind beds)
  await page.evaluate(() => { window.sb().storm.hit(); });
  await page.waitForTimeout(3000);
  const st2 = await page.evaluate(() => { const s = window.audio.state; return { ambMode: s.ambMode, beds: Object.fromEntries(Object.entries(s.beds).map(([k, v]) => [k, v ? { src: !!v.s, gain: +v.g.gain.value.toFixed(2) } : null])), thunder: s.played.thunder || 0, missing: [...s.missing] }; });
  console.log('after storm.hit():', JSON.stringify(st2));
  if (st2.ambMode !== 'storm' || !st2.beds.rain?.src || !st2.beds.wind?.src || st2.thunder < 1) fail('storm beds / thunder not live');
  if (!(st2.beds.island_birds.gain < st1.beds.island_birds.gain)) fail('birds not ducked during the storm');
  await page.screenshot({ path: 'tools/shots/amb_01_storm.png' });
  await page.evaluate(() => { window.sb().storm.clear(0.5); });
  await page.waitForTimeout(3000);
  const st3 = await page.evaluate(() => { const s = window.audio.state; return { ambMode: s.ambMode, rain: !!s.beds.rain, wind: !!s.beds.wind }; });
  console.log('after clear:', JSON.stringify(st3));
  if (st3.ambMode !== 'always' || st3.rain || st3.wind) fail('storm beds not released on clear');
  await page.evaluate(() => { window.lg.toTitle('qa'); });
  await page.waitForTimeout(1800);
  const st4 = await page.evaluate(() => { const s = window.audio.state; return { ambMode: s.ambMode, live: Object.entries(s.beds).filter(([, v]) => v).map(([k]) => k) }; });
  console.log('after toTitle:', JSON.stringify(st4));
  if (st4.ambMode !== 'off' || st4.live.length) fail('beds still live on the title');
} catch (e) { fail(String(e)); }
console.log('page errors:', errors.length ? errors : 'none');
await browser.close(); server.kill();
