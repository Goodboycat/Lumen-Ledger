// S64 final review rig: beginner flow screenshots.  node tools/play_s64c.mjs [W H]   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390; const touch = W < 1000;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s64c_${W}_${n}.png` });
await p.goto(`http://localhost:3000/index.html?${touch ? 'touch=1&' : ''}nocine`, { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 90000 }); await p.waitForTimeout(1500);
await shot('1_title');
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(2500); await shot('2_dialogue');
for (let i = 0; i < 20; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); await p.waitForTimeout(300); }
await p.waitForTimeout(2500); await shot('3_after_dialogue');
console.log('tutor', JSON.stringify(await p.evaluate(() => ui.tutor.current)), 'tray', await p.evaluate(() => ui.build.isOpen));
await p.evaluate(() => ui.build.open()); await p.waitForTimeout(900); await shot('4_tray');
await p.evaluate(() => ui.build.close()); await p.waitForTimeout(500);
await p.evaluate(() => { lg.debug?.grant?.(300); }); await p.waitForTimeout(500); await shot('5_play');
console.log('errors', errs.slice(0, 6)); await b.close();
