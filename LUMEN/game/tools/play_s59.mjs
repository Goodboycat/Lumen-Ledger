// S59 in a real browser (phone landscape 844x390): persistent tutor cards + cloud hand + drawn SKIP.   node tools/play_s59.mjs [phone|desk]   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const phone = process.argv[2] !== 'desk', tag = phone ? 'phone' : 'desk';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const out = (n) => `tools/shots/s59_${tag}_${n}.png`; const res = {};
await p.goto('http://localhost:3000/index.html?debug=1' + (phone ? '&touch=1' : ''), { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => { window.__ev = []; for (const n of ['tutor:shown', 'tutor:dismissed', 'cine:begin', 'cine:end']) lg.bus.on(n, (e) => __ev.push(n + ':' + (e && (e.id || e.shot) || '') + (e && e.why ? ':' + e.why : ''))); });
await p.evaluate(() => window.ui.title.buttons.story.click());
// ---- cinematic: arrival shot with the drawn SKIP button
await p.waitForTimeout(2500);
res.cine = await p.evaluate(() => { const s = document.querySelector('.ll-cine-skip'); return s ? { text: s.textContent.trim(), hasIconImg: !!s.querySelector('img.ll-ico, svg.ll-ico'), icon: s.querySelector('.ll-ico')?.className?.baseVal ?? s.querySelector('.ll-ico')?.className, emoji: /⏭/.test(s.textContent), rect: (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(s.getBoundingClientRect()), active: lg.cine?.active } : null; });
await p.screenshot({ path: out('1_cine_skip') });
// skip it by tapping the button
await p.evaluate(() => document.querySelector('.ll-cine-skip')?.click()); await p.waitForTimeout(1500);
for (let i = 0; i < 25; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.waitForTimeout(1200);
await p.screenshot({ path: out('2_after_skip') });
// ---- verb chain card 1 (move): is it up, is the hand on screen, is it persistent when Pip walks?
const card = () => p.evaluate(() => { const w = document.querySelector('.ll-tutor'), h = document.querySelector('.ll-tutor-hand'); const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { cur: ui.tutor.current, visible: ui.tutor.visible, text: document.querySelector('.ll-tutor-txt')?.textContent, shown: w.classList.contains('show'), card: r(w), hand: h.classList.contains('show') ? { ...r(h), flip: h.classList.contains('flip') } : null, step: lg.verbs?.step, hero: [lg.sb.hero.root.position.x.toFixed(1), lg.sb.hero.root.position.z.toFixed(1)] }; });
res.c1 = await card(); await p.screenshot({ path: out('3_card_move') });
// walk (keyboard) for 1.2 s — the card must NOT disappear when Pip moves
await p.keyboard.down('d'); await p.waitForTimeout(700); res.c1_walking = await card(); await p.screenshot({ path: out('4_walking') }); await p.waitForTimeout(500); await p.keyboard.up('d');
await p.waitForTimeout(600); res.c2 = await card(); await p.screenshot({ path: out('5_after_move') });
// tap on empty ground must not close it either
await p.mouse.click(300, 200); await p.waitForTimeout(400); res.c2_afterTap = await card();
res.events = await p.evaluate(() => __ev.slice(0, 20)); res.errors = errs.slice(0, 8);
console.log(JSON.stringify(res, null, 1));
await b.close();
