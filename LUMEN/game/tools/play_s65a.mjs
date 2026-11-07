// S65-A rig: touch pad in the tutorial (Attack / Dash / ability chips).  node tools/play_s65a.mjs [W H] [tag]   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390, TAG = process.argv[4] || 'a';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = []; const out = {};
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s65${TAG}_${W}_${n}.png` });
await p.goto('http://localhost:3000/index.html?touch=1&nocine&debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 90000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3000);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); await p.waitForTimeout(300); }
await p.waitForTimeout(1500);
out.cards = await p.evaluate(() => ({ cur: ui.tutor.current, step: lg.sb?.verbChain?.step ?? null }));
await shot('1_start');
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss('followed'); }); await p.waitForTimeout(800);
// press Attack like a finger (real pointer events on the green/orange button)
const bb = await p.evaluate(() => { const b = document.querySelector('.ll-touch-btn.attack').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await p.touchscreen.tap(bb.x, bb.y); await p.waitForTimeout(1200);
await shot('2_after_attack');
// S65-A: tap the green Dash like a finger -> the Magnet power must fire (ability event + cooldown sweep on the SAME button, no white chip)
await p.evaluate(() => { window.__ev = []; for (const n of ['sandbox:ability:start', 'sandbox:denied', 'ability:answer', 'sandbox:ability']) lg.bus.on(n, (e) => window.__ev.push(n + ':' + JSON.stringify(e).slice(0, 80))); });
const db = await p.evaluate(() => { const b = document.querySelector('.ll-touch-btn.dash').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await p.touchscreen.tap(db.x, db.y); await p.waitForTimeout(500);
out.dash = await p.evaluate(() => ({ ev: window.__ev.slice(), cooling: document.querySelector('.ll-touch-btn.dash').classList.contains('cooling'), left: document.querySelector('.ll-touch-btn.dash').getAttribute('data-left'), whiteMagnet: !!document.querySelector('.ll-touch-ab[data-ability=coinMagnetDash]'), chips: [...document.querySelectorAll('.ll-touch-ab')].map((e) => e.dataset.ability) }));
out.overlapChips = await p.evaluate(() => { const t = document.querySelector('.ll-tutor'); if (!t || !t.classList.contains('show')) return 'no card'; const a = t.getBoundingClientRect(); return [...document.querySelectorAll('.ll-touch-ab,.ll-touch-btn')].map((e) => { const b = e.getBoundingClientRect(); const o = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; return o ? (e.dataset.ability || e.dataset.action) : null; }).filter(Boolean); });
await shot('3_dash_cooling'); await p.waitForTimeout(1200); await shot('4_dash_later');
out.boxes = await p.evaluate(() => [...document.querySelectorAll('.ll-touch-btn,.ll-touch-ab')].map((e) => { const b = e.getBoundingClientRect(); return [e.dataset.ability || e.dataset.action, Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)].join(' '); }));
console.log(JSON.stringify(out, null, 1)); console.log('errs', errs.slice(0, 5));
await b.close();
