// S59 final beginner-view shots, phone landscape 844x390: title, opening dialogue, first play frame, tray open.  node tools/play_s59f.mjs (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s59f_${n}.png` });
await p.goto('http://localhost:3000/index.html?touch=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 }); await p.waitForTimeout(2500); await shot('1_title');
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(6000); await shot('2_opening');
await p.waitForFunction(() => ui.dialogue.isOpen, null, { timeout: 30000 }).catch(() => {});
let n = 0; for (; n < 40; n++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; if (n === 4) await shot('3_cloud_or_owl_line'); await p.keyboard.press('Enter'); await p.waitForTimeout(700); }
await p.waitForTimeout(3500); await shot('4_first_play_frame');
await p.waitForTimeout(9000); await shot('5_after_9s');
console.log('enter presses', n);
console.log(JSON.stringify({ errors: errs.slice(0, 8), tutor: await p.evaluate(() => ui.tutor.current) }));
await b.close();
