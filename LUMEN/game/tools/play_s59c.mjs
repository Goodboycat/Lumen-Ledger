// S59-F/G/H/I/J in a real browser (phone landscape 844x390).  node tools/play_s59c.mjs   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s59c_${n}.png` }); const out = {};
await p.goto('http://localhost:3000/index.html?touch=1&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
const dlg = () => p.evaluate(() => ({ open: ui.dialogue.isOpen, name: document.querySelector('.ll-dlg-name')?.textContent, text: document.querySelector('.ll-dlg-text')?.textContent?.slice(0, 90), face: document.querySelector('.ll-dlg-face img, .ll-dlg-face svg')?.className?.baseVal || document.querySelector('.ll-dlg-face img')?.className }));
out.l1 = await dlg(); await shot('1_owl');
await p.keyboard.press('Enter'); await p.waitForTimeout(1200); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
out.l2 = await dlg(); await shot('2_pip');
await p.keyboard.press('Enter'); await p.waitForTimeout(1200); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
out.l3 = await dlg(); await shot('3_cloud');
for (let i = 0; i < 10; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.waitForTimeout(1800); await shot('4_after');
out.tutor = await p.evaluate(() => ({ cur: ui.tutor.current, txt: document.querySelector('.ll-tutor-txt')?.textContent }));
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
