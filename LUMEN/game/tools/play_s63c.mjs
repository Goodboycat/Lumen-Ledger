// S63-C rig: 'drag to move' label fades after the first stick use. Also S63-D tray hint size. node tools/play_s63c.mjs [W H]
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s63c_${W}x${H}_${n}.png` }); const out = {};
await p.goto('http://localhost:3000/index.html?touch=1&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
const hint = () => p.evaluate(() => { const h = document.querySelector('.ll-joy-hint'); const z = document.querySelector('.ll-joy-zone'); return { opacity: getComputedStyle(h).opacity, used: z.classList.contains('used') }; });
await p.waitForTimeout(1500); out.before = await hint();
await p.evaluate(() => ui.touch.simulateJoystick?.(30, -40)); await p.waitForTimeout(900); out.after = await hint();
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss?.('followed'); lg.debug?.grant?.(300); });
await p.evaluate(() => ui.build.open()); await p.waitForTimeout(500);
out.hint = await p.evaluate(() => { const e = document.querySelector('.ll-build-hint'); return e ? { txt: e.textContent, px: getComputedStyle(e).fontSize } : null; });
await shot('tray'); out.errors = errs.slice(0, 5); console.log(JSON.stringify(out, null, 1)); await b.close();
