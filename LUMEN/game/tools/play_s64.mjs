// S64-A rig: who opens the Build tray after the opening dialogue? (phone landscape)  node tools/play_s64.mjs [W H]
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s64_${W}_${n}.png` });
await p.goto('http://localhost:3000/index.html?touch=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 90000 }); await p.waitForTimeout(1500);
await p.addScriptTag({ content: `window.__st = []; (function () { const o = ui.build.open; ui.build.open = function () { window.__st.push(Math.round(performance.now()) + ' ' + String(new Error().stack).split('\\n').slice(2, 7).join(' < ')); return o.apply(this, arguments); }; })();` });
await p.evaluate(() => ui.title.buttons.story.click());
await p.waitForFunction(() => ui.dialogue.isOpen, null, { timeout: 60000 });
// play it like a player: tap the dialogue box (real touch) until it is closed, then keep tapping the ground twice
for (let i = 0; i < 40; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.evaluate(() => ui.dialogue.skip()); await p.touchscreen.tap(Math.round(W / 2), Math.round(H * 0.8)); await p.waitForTimeout(200); }
await p.touchscreen.tap(Math.round(W * 0.5), Math.round(H * 0.4)); await p.waitForTimeout(150);
await p.touchscreen.tap(Math.round(W * 0.6), Math.round(H * 0.4)); await p.waitForTimeout(2500);
await shot('1_after_dialogue');
console.log('trayOpen', await p.evaluate(() => ui.build.isOpen), 'stacks', JSON.stringify(await p.evaluate(() => window.__st), null, 1));
console.log('tutor', JSON.stringify(await p.evaluate(() => ui.tutor.current)), 'errors', errs.slice(0, 5));
await b.close();
