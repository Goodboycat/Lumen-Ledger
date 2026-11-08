// S66-F rig: title, gameplay (HUD), PAY tutor card, Ledger with star checklist (S1) at one viewport.   node tools/play_s66f.mjs W H   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s66f_${W}x${H}_${n}.png` });
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(1500); await shot('0_title');
await p.evaluate(() => { window.__cards = []; lg.bus.on('tutor:shown', (e) => window.__cards.push(e.id)); ui.title.buttons.story.click(); });
for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); const st = await p.evaluate(() => ({ cine: lg.cine && lg.cine.active, dlg: ui.dialogue.isOpen, vs: lg.verbs.step })); if (st.dlg) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); else if (!st.cine && st.vs >= 0) break; }
await p.waitForTimeout(800); await shot('1_play');
// finish the verb chain, then make 3 sales so the PAY gate fires (real gate: sold>=2, spark>=25, day01>0.3, debt>0)
await p.evaluate(() => { lg.verbs.skip?.(); const s = lg.sb.eco.state; s.spark = 80; lg.sb.eco.state.day01 = 0.35; for (let i = 0; i < 3; i++) lg.bus.emit('cust:paid', { amount: 6 }); });
let paySeen = false; for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); paySeen = await p.evaluate(() => window.__cards.includes('onDebtPay')); if (paySeen) break; }
await p.waitForTimeout(700); await shot('2_paycard');
const payInfo = await p.evaluate(() => ({ cur: ui.tutor.current, cards: window.__cards.slice(), hand: !!document.querySelector('.ll-tutor-hand.show') }));
// a real S1 season end with a fair 3rd star: sell, save, repay >= interest
await p.evaluate(() => { const e = lg.sb.eco; e.state.spark = 400; for (let i = 0; i < 20; i++) e.sell('fruit', 'regular', 5); e.allocate({ save: 30 }); e.repay(100); ui.tutor.dismiss(); });
await p.evaluate(() => { lg.sb.eco.state.day01 = 0.999; lg.sb.eco.tick(1.0); });
// the Baron pier comes first (state 'pier'); finish his visit like a real player would, then the ledger opens
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(400);
  const st = await p.evaluate(() => ({ o: ui.ledger.isOpen, s: lg.state }));
  if (st.o) break;
  if (st.s === 'pier') await p.evaluate(() => { const b = lg.sb.pier; if (b && b.active) b.settle('rig'); });
}
await p.waitForTimeout(500);
await p.evaluate(() => { for (let i = 0; i < 6; i++) { if (ui.dialogue.isOpen) { ui.dialogue.skip(); ui.dialogue.advance(); } } });
await p.waitForTimeout(1200);
const led = await p.evaluate(() => ({ open: ui.ledger.isOpen, goals: [...document.querySelectorAll('.ll-ledger-goals .goal')].map((g) => g.className + ' | ' + g.textContent.trim()), stars: ui.ledger.state.report && ui.ledger.state.report.stars, goalsVisible: getComputedStyle(document.querySelector('.ll-ledger-goals')).opacity }));
await p.evaluate(() => ui.ledger.skip && ui.ledger.skip()); await p.waitForTimeout(500);
await shot('3_ledger');
// is the CONTINUE button visible without scrolling? (phone landscape)
const fit = await p.evaluate(() => { const sh = document.querySelector('.ll-ledger-sheet'), bt = document.querySelector('.ll-ledger-continue'); const r = sh.getBoundingClientRect(), br = bt.getBoundingClientRect(); return { sheetH: Math.round(r.height), sheetScroll: sh.scrollHeight, clientH: sh.clientHeight, btnBottom: Math.round(br.bottom), vh: innerHeight, btnH: Math.round(br.height), btnW: Math.round(br.width) }; });
await p.evaluate(() => { const sh = document.querySelector('.ll-ledger-sheet'); sh.scrollTop = sh.scrollHeight; }); await p.waitForTimeout(300); await shot('4_ledger_scrolled');
console.log(JSON.stringify({ W, H, payInfo, led, fit })); console.log('errs', errs.slice(0, 5)); await b.close();
