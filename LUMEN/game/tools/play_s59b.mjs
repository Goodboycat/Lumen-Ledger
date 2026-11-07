// S59 part 2 (phone landscape): the hand on each verb step + build tray + coin. node tools/play_s59b.mjs
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:3000/index.html?touch=1&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => window.ui.title.buttons.story.click()); await p.waitForTimeout(3000);
for (let i = 0; i < 25; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.waitForTimeout(1500);
const st = () => p.evaluate(() => { const h = document.querySelector('.ll-tutor-hand'); const b = h.getBoundingClientRect(); return { step: lg.verbs.step, cur: ui.tutor.current, hand: h.classList.contains('show') ? [Math.round(b.x + b.width / 2), Math.round(b.y), h.classList.contains('flip') ? 'down' : 'up'] : null, text: document.querySelector('.ll-tutor-txt').textContent }; });
const out = {}; const shot = (n) => p.screenshot({ path: `tools/shots/s59_phone_${n}.png` });
out.s0 = await st(); await shot('6_move_plaza');
// walk 3 u → coin step
await p.evaluate(() => { const r = lg.sb.hero.root.position; r.x -= 4; }); await p.waitForTimeout(1800); out.s1 = await st(); await shot('7_coin');
// grab coin → bonk step
await p.evaluate(() => { lg.sb.coins.length = 0; }); await p.waitForTimeout(1500); out.s2 = await st(); await shot('8_bonk');
await p.evaluate(() => lg.bus.emit('combat:miss', {})); await p.waitForTimeout(1500); out.s3 = await st(); await shot('9_stall');
// open the tray → onBuildOpen card should replace? (verb card stays; tray opens)
await p.evaluate(() => ui.build.open()); await p.waitForTimeout(900); out.s4 = await st(); await shot('10_tray');
out.errors = errs; console.log(JSON.stringify(out));
await b.close();
