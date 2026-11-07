// S59-G/H/I phone landscape: hand on tray tabs/cards/Deploy/toggle, jar reminder card, storm chip.  node tools/play_s59d.mjs  (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s59d_${n}.png` }); const out = {};
await p.goto('http://localhost:3000/index.html?touch=1&nocine&debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 12; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.waitForTimeout(800);
// state of the cloud hand: where is it vs. the thing the card names?
const hand = (sel) => p.evaluate((sel) => { const h = document.querySelector('.ll-tutor-hand'), w = document.querySelector('.ll-tutor'); const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const hb = h.getBoundingClientRect(); const t = sel ? document.querySelector(sel) : null; const tb = t ? t.getBoundingClientRect() : null;
  return { cur: ui.tutor.current, text: document.querySelector('.ll-tutor-txt')?.textContent, shown: w.classList.contains('show'), handShown: h.classList.contains('show'), flip: h.classList.contains('flip'), hand: r(h), card: r(w), target: r(t),
    // hand fingertip x vs target centre; vertical gap between hand and target edge
    dx: tb ? Math.round((hb.x + hb.width / 2) - (tb.x + tb.width / 2)) : null, onScreen: hb.x >= -2 && hb.y >= -2 && hb.right <= innerWidth + 2 && hb.bottom <= innerHeight + 2 }; }, sel);
// end the S1 verb chain so its card does not hold the slot (the reminder queues behind a card that is on screen, by design)
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss('followed'); }); await p.waitForTimeout(900);
out.chain = await p.evaluate(() => ({ step: lg.verbs?.step, cur: ui.tutor.current }));
// ---- S59-H: jar reminder card (jar unlocked, not placed) -> hand on the Build button / Jars tab
await p.evaluate(() => { lg.debug?.unlockJar?.('save'); });
await p.evaluate(() => { lg.bus.emit('curious:ping', { id: 'jar:add', hint: 'jar:add', text: 'Add your Save jar: Build, Jars tab.' }); });
await p.waitForTimeout(700); out.jarAdd = await hand('.ll-build-toggle'); await shot('1_jar_reminder');
// open tray -> Jars tab: hand should follow (card follows away on tab tap)
await p.evaluate(() => ui.build.open()); await p.waitForTimeout(900); out.trayOpen = await hand('.ll-build-tab[data-cat=jar]'); await shot('2_tray_open');
await p.evaluate(() => document.querySelector('.ll-build-tab[data-cat=jar]')?.click()); await p.waitForTimeout(900); out.jarsTab = await hand('.ll-build-card, .ll-build-item'); await shot('3_jars_tab');
await p.evaluate(() => ui.build.close?.()); await p.waitForTimeout(500);
// ---- S59-I: storm warning chip with the drawn stormmark
const r = await p.evaluate(() => { try { return JSON.stringify(lg.debug?.season?.(2)); } catch (e) { return 'ERR ' + e.message; } }); out.season2 = r;
await p.waitForTimeout(2500);
for (let i = 0; i < 8; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.evaluate(() => lg.bus.emit('hud:chip', { id: 'storm', icon: 'stormmark', text: 'STORM COMING: fill Protect', on: true, alert: true })); await p.waitForTimeout(500);
out.stormChip = await p.evaluate(() => { const c = [...document.querySelectorAll('.ll-chip')].find((n) => n.dataset.id === 'storm'); if (!c) return null; const b = c.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), icon: !!c.querySelector('.ll-ico-stormmark'), text: c.textContent.trim() }; });
await shot('4_storm_chip');
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
