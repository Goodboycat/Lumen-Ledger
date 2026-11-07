// S59-G/J remainder, phone landscape 844x390: hand on tray cards / Deploy / stall tab; till, stall upgrade, Collector, stranger cards; debug text w/o ?debug.
//   node tools/play_s59e.mjs  (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s59e_${n}.png` }); const out = {};
await p.goto('http://localhost:3000/index.html?touch=1&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
out.debugTextVisible = await p.evaluate(() => { const e = document.getElementById('debug-stats'); return e ? getComputedStyle(e).display : 'none-missing'; });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 12; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.waitForTimeout(800);
out.debugTextAfterStart = await p.evaluate(() => getComputedStyle(document.getElementById('debug-stats')).display);
const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
// state of hand + the card, plus which element sits under the hand's centre and whether the hand overlaps the tutor card
const probe = (sel) => p.evaluate((sel) => { const h = document.querySelector('.ll-tutor-hand'), w = document.querySelector('.ll-tutor'); const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const hb = h.getBoundingClientRect(), cb = w.getBoundingClientRect(); const t = sel ? document.querySelector(sel) : null, tb = t ? t.getBoundingClientRect() : null;
  const overlapCard = !(hb.right < cb.left || hb.left > cb.right || hb.bottom < cb.top || hb.top > cb.bottom);
  return { cur: ui.tutor.current, text: document.querySelector('.ll-tutor-txt')?.textContent, shown: w.classList.contains('show'), handShown: h.classList.contains('show'), flip: h.classList.contains('flip'), hand: r(h), card: r(w), target: r(t),
    dx: tb ? Math.round((hb.x + hb.width / 2) - (tb.x + tb.width / 2)) : null, gapY: tb ? Math.round(h.classList.contains('flip') ? tb.top - hb.bottom : hb.top - tb.bottom) : null, onScreen: hb.x >= -2 && hb.y >= -2 && hb.right <= innerWidth + 2 && hb.bottom <= innerHeight + 2, overlapCard }; }, sel);
const settle = async () => { await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss?.('followed'); }); await p.waitForTimeout(700); };
const hint = async (id) => { await p.evaluate((id) => lg.bus.emit('tutor:hint', { id }), id); await p.waitForTimeout(800); };
const ask = async (id) => { await p.evaluate((id) => ui.tutor.ask(id), id); await p.waitForTimeout(800); };
await settle(); await p.evaluate(() => lg.debug.grant(300));
// ---- S59-G: verb:stall card walks through the tray: toggle -> tab -> card -> Deploy
await hint('stall'); out.g1_toggle = await probe('.ll-build-toggle'); await shot('g1_toggle');
await p.evaluate(() => ui.build.open()); await p.waitForTimeout(900);
out.g2_trayOpenBeforeTab = await probe('.ll-build-tab[data-cat=stall]'); await shot('g2_tray');
await p.evaluate(() => { document.querySelector('.ll-build-tab[data-cat=stall]')?.click(); }); await p.waitForTimeout(500);
await hint('stall'); out.g3_cards = await probe('.ll-build-grid .ll-card'); await shot('g3_cards');
await p.evaluate(() => document.querySelector('.ll-build-grid .ll-card')?.click()); await p.waitForTimeout(700);
await hint('stall'); out.g4_deploy = await probe('.ll-build-detail .ll-btn.deploy'); await shot('g4_deploy');
// ---- deploy for real (tap the ground cell), so later cards have a stall to point at
await p.evaluate(() => document.querySelector('.ll-build-detail .ll-btn.deploy')?.click()); await p.waitForTimeout(700);
await hint('stall'); out.g5_placing = await probe('.ll-build-placing .ll-btn.ok'); await shot('g5_placing');
await p.evaluate(() => document.querySelector('.ll-build-placing .ll-btn.ok')?.click()); await p.waitForTimeout(1500);
out.stalls = await p.evaluate(() => lg.sb.build.stalls().length);
await p.evaluate(() => { ui.build.close?.(); }); await p.waitForTimeout(500); await settle();
// ---- S59-J: world cards on the phone
await ask('stall:any'); out.j_stall = await probe(null); await shot('j1_stall');
await settle(); await ask('stall:upgrade'); out.j_upgrade = await probe(null); await shot('j2_upgrade');
await settle(); await p.evaluate(() => { const t = lg.sb.till.all()[0]; if (t) t.amount = 12; }); await ask('till:coins'); out.j_till = await probe(null); await shot('j3_till');
await settle(); out.wave = await p.evaluate(() => JSON.stringify(lg.debug.wave())); await p.waitForTimeout(1500); await ask('enemy:collector'); out.j_collector = await probe(null); await shot('j4_collector');
await p.evaluate(() => { for (const e of lg.sb.enemies.list) e.hp = 0; }); await settle();
out.stranger = await p.evaluate(() => JSON.stringify(lg.debug.stranger('fair'))); await p.waitForTimeout(2500); await ask('npc:stranger'); out.j_stranger = await probe(null); await shot('j5_stranger');
out.errors = errs.slice(0, 8); console.log(JSON.stringify(out, null, 1)); await b.close();
