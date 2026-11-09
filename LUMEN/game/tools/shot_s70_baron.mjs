// S70: real-browser check of the Baron-pays-a-star fix. node tools/shot_s70_baron.mjs W H
// Plays S1 to the pier (debt 100 + pouch 150 forced), walks to the Baron, pays, leaves, screenshots the ledger and prints stars + goals.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/');
const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(1000);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 60; i++) { await p.waitForTimeout(400); const st = await p.evaluate(() => ({ c: lg.cine && lg.cine.active, d: ui.dialogue.isOpen })); if (st.d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); if (!st.c && !st.d && i > 8) break; }
const info = await p.evaluate(() => { const e = lg.sb.eco; e.state.debt = 100; e.state.spark = 160; for (let i = 0; i < 12; i++) e.sell('fruit', 'regular', 6); e.allocate({ save: 25 }); lg.sb.enemies && (lg.sb.enemies.enabled = false); e.state.day01 = 1; const pre = { ended: e.state.ended, st: lg.state, season: e.state.season, hold: [...lg.sb.clockHold], modal: ui.dialogue.isOpen }; let thrown = null; try { e.endSeason(); } catch (x) { thrown = String(x && x.stack || x).slice(0, 400); } return { pre, thrown, hist: e.history.length, pierPays: e.pierPays, clockHold: [...(lg.sb.clockHold||[])] }; });
console.log('info', JSON.stringify(info));
let last = null;
for (let i = 0; i < 120; i++) { await p.waitForTimeout(500); last = await p.evaluate(() => ({ s: lg.state, day: +lg.sb.eco.state.day01.toFixed(3), season: lg.sb.eco.state.season, paused: !!lg.paused, d: ui.dialogue.isOpen, hist: lg.sb.eco.history.length })); if (last.d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); if (last.s === 'pier') break; }
console.log('wait-for-pier', JSON.stringify(last), 'errs', JSON.stringify(errs.slice(0,4)));
await p.waitForTimeout(3500);
await p.screenshot({ path: `tools/shots/s70_pier_${W}x${H}.png` });
const before = await p.evaluate(() => { const r = lg.sb.eco.history.at(-1); return { stars: r.stars, pending: r.pier?.pending, owed: lg.sb.eco.state.interestOwed, goals: r.goals.map(g => g.id + ':' + g.ok) }; });
const res = await p.evaluate(() => { const B = lg.sb.pier; lg.sb.hero.root.position.set(B.g.position.x + 1, 0, B.g.position.z); const r = lg.sb.interact(); return r; });
await p.waitForTimeout(600); await p.screenshot({ path: `tools/shots/s70_paid_${W}x${H}.png` });
await p.evaluate(() => lg.sb.interactRelease());
for (let i = 0; i < 40; i++) { await p.waitForTimeout(400); const st = await p.evaluate(() => ({ s: lg.state, d: ui.dialogue.isOpen, l: ui.ledger.isOpen })); if (st.d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); if (st.l) break; }
await p.waitForTimeout(500); await p.evaluate(() => ui.ledger.skip()); await p.waitForTimeout(900);
await p.screenshot({ path: `tools/shots/s70_ledger_${W}x${H}.png` });
const after = await p.evaluate(() => { const r = lg.sb.eco.history.at(-1); return { stars: r.stars, pier: r.pier, goals: r.goals.map(g => g.id + ':' + g.ok + (g.id === 'debt' ? ' paidInterest=' + g.paidInterest : '')), unlockStars: lg.sb.unlocks.starsTotal, litStars: [...document.querySelectorAll('.ll-ledger-star.on, .ll-star.on')].length, goalRows: [...document.querySelectorAll('#ll-ledger-goals li')].map(l => l.className + ' | ' + l.textContent.trim()) }; });
console.log(JSON.stringify({ res, before, after, errs: errs.slice(0, 6) }, null, 1)); await b.close();
