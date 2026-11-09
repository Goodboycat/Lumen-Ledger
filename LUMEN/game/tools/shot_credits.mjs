// S71: real-browser credits card. node tools/shot_credits.mjs W H   (server on :3000). Fires game:won through the real bus path (stars 27 / season 10).
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/');
const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 568, +process.argv[3] || 320];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => { lg.bus.emit('game:won', { season: 10, stars: 27 }); return { open: ui.credits.isOpen, modal: ui.isModal() }; });
await p.waitForTimeout(2600);
await p.screenshot({ path: `tools/shots/s71_credits_${W}x${H}.png` });
const box = await p.evaluate(() => { const c = document.querySelector('.ll-credits-card').getBoundingClientRect(); const bt = document.querySelector('.ll-credits-back').getBoundingClientRect(); return { card: [c.left, c.top, c.right, c.bottom].map(Math.round), btn: [bt.left, bt.top, bt.right, bt.bottom].map(Math.round), vw: innerWidth, vh: innerHeight, scroll: document.querySelector('.ll-credits-card').scrollHeight > document.querySelector('.ll-credits-card').clientHeight }; });
await p.keyboard.press('Enter'); await p.waitForTimeout(500);
const after = await p.evaluate(() => ({ open: ui.credits.isOpen, titleOpen: ui.title.isOpen, state: lg.state }));
console.log(JSON.stringify({ r, box, after, errs }));
await b.close();
