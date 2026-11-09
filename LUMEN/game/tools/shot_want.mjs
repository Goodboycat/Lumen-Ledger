// S71: real-browser check of the 'Nobody sells X' chip. node tools/shot_want.mjs W H
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/');
const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 568, +process.argv[3] || 320];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'mute&autoplay&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(800);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 40; i++) { await p.waitForTimeout(300); const d = await p.evaluate(() => ui.dialogue.isOpen); if (d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); else if (i > 6) break; }
const r = await p.evaluate(() => { const c = lg.sb.cust; c._wantBarked = new Set(); c._owlWant('tea', 'elder'); return [...document.querySelectorAll('.ll-chip')].map((n) => n.className + ' | ' + n.textContent.trim() + ' | img ' + n.querySelectorAll('img,svg').length); });
await p.waitForTimeout(700);
await p.screenshot({ path: `tools/shots/s71_want_${W}x${H}.png` });
await p.waitForTimeout(7600);
const gone = await p.evaluate(() => document.querySelectorAll('.ll-chip-want').length);
console.log(JSON.stringify({ r, goneAfter7s: gone === 0, errs }));
await b.close();
