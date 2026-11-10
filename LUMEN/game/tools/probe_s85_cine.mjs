// S85: cinematic skip only by the SKIP button. Real taps: scene tap (must NOT skip), key presses (must NOT skip), SKIP tap inside the arm window (ignored), SKIP tap after it (skips).
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const W = +process.argv[2] || 568, H = +process.argv[3] || 320;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
await p.waitForFunction(() => window.lg?.cine?.active && lg.cine.active !== 'title', null, { timeout: 60000 }).catch(() => console.log('no arrival cine started'));
console.log('arrival cine:', await p.evaluate(() => lg.cine?.active));
const act = () => p.evaluate(() => lg.cine.active);
console.log('active after play:', await act());
await p.touchscreen.tap(W / 2, H / 2); await p.waitForTimeout(300); console.log('after scene tap (centre):', await act());
await p.touchscreen.tap(W / 2, H * 0.8); await p.waitForTimeout(300); console.log('after scene tap (low):', await act());
await p.keyboard.press('Space'); await p.keyboard.press('Enter'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('after Space/Enter/Escape:', await act());
const r = await p.evaluate(() => { const e = document.querySelector('.ll-cine-skip'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, vis: getComputedStyle(e).display + '/' + getComputedStyle(e).opacity }; });
console.log('skip button', JSON.stringify(r));
await p.screenshot({ path: `tools/shots/s85_cine_${W}x${H}.png` });
await p.waitForTimeout(1000);   // past skipArmMs (900)
console.log('element at button centre:', await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.className?.baseVal ?? e.className) + ' <' + e.tagName + '> inSkip=' + !!e.closest('.ll-cine-skip') : null; }, [r.x, r.y]));
console.log('cine phase/t/armed:', await p.evaluate(() => JSON.stringify({ ph: lg.cine.phase, t: +lg.cine.t.toFixed(2), armed: Date.now() - lg.cine._armedAt })));
await p.evaluate(() => { window.__clk = 0; document.querySelector('.ll-cine-skip').addEventListener('click', () => window.__clk++, true); });
await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(600);
console.log('click events on SKIP:', await p.evaluate(() => window.__clk), 'stats right after tap:', JSON.stringify(await p.evaluate(() => ({ stats: lg.cine.stats, phase: lg.cine.phase }))));
await p.waitForTimeout(2500);
console.log('after SKIP button tap (+3s):', await act(), 'state', await p.evaluate(() => lg.state), JSON.stringify(await p.evaluate(() => ({ stats: lg.cine.stats, phase: lg.cine.phase }))));
await b.close();
