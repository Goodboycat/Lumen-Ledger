// S58 real-browser check: no bubbles / no season banner, bell is tappable → Pip walks to the stranger and the talk opens.  node tools/play_s58.mjs [phone|desk]
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const phone = process.argv[2] !== 'desk', tag = phone ? 'phone' : 'desk';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:3000/index.html?debug=1&nocine' + (phone ? '&touch=1' : ''), { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => window.ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 25; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.waitForTimeout(1500);
const shot = (n) => p.screenshot({ path: `tools/shots/s58_${tag}_${n}.png` });
await shot('0_start');
console.log('banner/bubbles', JSON.stringify(await p.evaluate(() => ({ banner: !!document.querySelector('.ll-season-banner.on'), barksLayer: !!document.querySelector('.ll-barks'), bubbles: document.querySelectorAll('.ll-bark').length }))));
const adv = (sec) => p.evaluate((n) => { const g = lg.game; for (let i = 0; i < Math.round(n / 0.1); i++) { for (const s of g.systems) if (s.update) s.update(0.1, g, 0.1); } }, sec);
console.log('spawn', await p.evaluate(() => lg.debug.stranger('fair'))); await adv(3.5); await p.waitForTimeout(400); await shot('1_bell');
console.log('marker', JSON.stringify(await p.evaluate(() => ({ shown: ui.stranger.shown, state: lg.sb.scamNpc.state }))));
// tap the bell (or arrow) with a real touch / click
const sel = await p.evaluate(() => ui.stranger.shown === 'bell' ? '.ll-stranger-bell' : '.ll-stranger-arrow');
const box = await p.locator(sel).boundingBox(); console.log('hit box', sel, JSON.stringify(box));
const d0 = await p.evaluate(() => { const h = lg.sb.hero.root.position, g = lg.sb.scamNpc.g.position; return Math.hypot(h.x - g.x, h.z - g.z); });
if (phone) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await p.waitForTimeout(300); console.log('autowalk', JSON.stringify(await p.evaluate(() => ({ on: !!lg.sb.autoWalk, jar: lg.sb.autoWalk?.jar }))));
for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) break; }
const d1 = await p.evaluate(() => { const h = lg.sb.hero.root.position, g = lg.sb.scamNpc.g.position; return Math.hypot(h.x - g.x, h.z - g.z); });
console.log('dist before/after', d0.toFixed(1), d1.toFixed(1), 'dialogue open', await p.evaluate(() => ui.dialogue.isOpen)); await shot('2_talk');
console.log('errors', JSON.stringify(errs.slice(0, 6)));
await b.close();
