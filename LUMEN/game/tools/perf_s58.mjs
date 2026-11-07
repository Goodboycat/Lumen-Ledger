import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/index.html?debug=1&nocine&touch=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => window.ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 25; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.waitForTimeout(2500);
const calls = () => p.evaluate(() => new Promise((r) => { const R = (lg.game.renderer?.three || lg.game.renderer); let m = 0; const f = () => { const c = R?.info?.render?.calls ?? -1; m = Math.max(m, c); }; let n = 0; const t = setInterval(() => { f(); if (++n > 12) { clearInterval(t); r({ max: m, last: R?.info?.render?.calls, tris: R?.info?.render?.triangles }); } }, 150); }));
console.log('idle', JSON.stringify(await calls()));
await p.evaluate(() => lg.debug.stranger('fair')); await p.waitForTimeout(6000);
console.log('stranger', JSON.stringify(await calls()), await p.evaluate(() => ui.stranger.shown));
await b.close();
