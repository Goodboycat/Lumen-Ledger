// S65-B rig: tutor card vs open Build tray on short phones.  node tools/play_s65b.mjs W H   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 568, H = +process.argv[3] || 320;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = []; const out = { W, H };
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s65b_${W}x${H}_${n}.png` });
await p.goto('http://localhost:3000/index.html?touch=1&nocine&debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3000);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); await p.waitForTimeout(300); }
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss('followed'); lg.debug?.unlockJar?.('save'); }); await p.waitForTimeout(800);
await p.evaluate(() => { ui.build.open(); lg.bus.emit('curious:ping', { id: 'jar:add', hint: 'jar:add', text: 'Add your new jars: Build, Jars tab.' }); }); await p.waitForTimeout(1200);
out.rects = await p.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; }; return { tutor: r('.ll-tutor'), tray: r('.ll-build'), tutorShown: document.querySelector('.ll-tutor')?.classList.contains('show'), trayOpen: document.body.classList.contains('ll-tray-open'), buildH: getComputedStyle(document.body).getPropertyValue('--ll-build-h') }; });
out.kids = await p.evaluate(() => [...document.querySelector('.ll-build').children].map((e) => { const b = e.getBoundingClientRect(); return { cls: e.className.toString().slice(0, 30), top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; }));
const t = out.rects.tutor; const hit = (k) => (t && t.top < k.bottom && t.bottom > k.top && t.left < k.right && t.right > k.left) ? Math.round(Math.min(t.bottom, k.bottom) - Math.max(t.top, k.top)) : 0;
out.overlapKids = out.kids.map((k) => k.cls + ':' + hit(k)); const y = null; out.overlap = t && y ? (t.top < y.bottom && t.bottom > y.top && t.left < y.right && t.right > y.left ? Math.round(Math.min(t.bottom, y.bottom) - Math.max(t.top, y.top)) : 0) : null;
await shot('tray_card');
console.log(JSON.stringify(out)); console.log('errs', errs.slice(0, 4)); await b.close();
