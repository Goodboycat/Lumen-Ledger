// S66 baseline rig: start story, skip dialogues, follow the tutorial verbs literally, record every tutor card shown + the S1 ledger stars.
//   node tools/play_s66base.mjs W H   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = []; const out = { W, H, cards: [] };
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s66base_${W}x${H}_${n}.png` });
await p.goto('http://localhost:3000/index.html?touch=1&debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.evaluate(() => { window.__cards = []; lg.bus.on('tutor:shown', (e) => window.__cards.push({ t: Math.round(performance.now()), id: e.id, mode: e.mode })); lg.bus.on('eco:season', (r) => { window.__led = window.__led || []; window.__led.push({ season: r.season, stars: r.stars, income: r.income, expenses: r.expenses, saved: r.saved, debtBefore: r.debtBefore, debt: r.debt, fog: r.fog01, upkeep: r.upkeep, interestPaid: r.interestPaid }); }); });
await shot('0_title');
await p.evaluate(() => ui.title.buttons.story.click());
// wait for the arrival cinematic to end, then clear every opening dialogue line (the verb chain starts only after both)
for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); const st = await p.evaluate(() => ({ cine: lg.cine && lg.cine.active, dlg: ui.dialogue.isOpen, vs: lg.verbs.step })); if (st.dlg) { await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); } else if (!st.cine && st.vs >= 0) break; }
await shot('1_after_dialogue');
out.verbStep = await p.evaluate(() => lg.verbs.step);
// let the chain run on its own for 60 s real time and sample which cards show
for (let k = 0; k < 12; k++) { await p.waitForTimeout(5000); out['vs' + k] = await p.evaluate(() => [lg.verbs.step, Math.round(lg.sb.eco.state.spark), lg.sb.eco.state.season, Math.round(lg.sb.eco.state.day01 * 100) / 100]); }
await shot('2_idle60');
out.cards = await p.evaluate(() => window.__cards);
console.log(JSON.stringify(out)); console.log('errs', errs.slice(0, 4)); await b.close();
