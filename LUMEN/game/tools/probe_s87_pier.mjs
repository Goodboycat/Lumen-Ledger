// S87: season N, pay the Baron what he asks -> chip must be GREEN (not red), Ledger must count the debt star; also reads the 1.25x goal row.
// usage: node tools/probe_s87_pier.mjs <season> <W> <H> <short|full>
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const S = +process.argv[2] || 3, W = +process.argv[3] || 568, H = +process.argv[4] || 320, MODE = process.argv[5] || 'full';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
const skip = async () => { if (!(await p.evaluate(() => ui.dialogue.isOpen))) return;
  const c = await p.evaluate(() => { const e = [...document.querySelectorAll('.ll-dlg-choice')].filter(x => x.offsetParent && /not today|no thanks|refuse|decline|walk/i.test(x.textContent))[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (c) { await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(300); return; }
  await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); };
for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); await skip(); }
await p.waitForTimeout(1200);
await p.evaluate((S) => { lg.verbs.skip(); lg.debug.season(S); const e = lg.sb.eco; e.state.debt = 80; e.state.spark = 150; e.ledger.debtStart = 80; e.ledger.income = 260; e.ledger.expenses = 60; e.ledger.saved = 30; window.__ev = [];
  for (const k of ['pier:due','pier:paid','pier:short','pier:done','eco:stars']) lg.bus.on(k, (pl) => window.__ev.push(k + ' ' + JSON.stringify(pl && pl.report ? { stars: pl.stars, from: pl.from } : pl).slice(0, 90))); }, S);
if (MODE === 'topup') await p.evaluate(() => { lg.sb.eco.state.spark = 1; });
await p.evaluate(() => { lg.sb.eco.state.day01 = 0.999; });
if (MODE === 'topup') { for (let i = 0; i < 40; i++) { await p.waitForTimeout(300); await skip(); if (await p.evaluate(() => lg.sb.pier.phase) === 'arrive') break; } await p.evaluate(() => lg.sb.eco._addSpark(150, 'tip:walk')); console.log('topped up while arriving, chip:', JSON.stringify(await p.evaluate(() => document.querySelector('.ll-pier-chip')?.className))); }
for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); await skip(); const ph = await p.evaluate(() => lg.sb.pier.phase); if (i % 4 === 0) console.log('w', i, ph, JSON.stringify(await p.evaluate(() => ({ st: lg.state, season: lg.sb.eco.state.season, day: lg.sb.eco.state.day01, owed: lg.sb.eco.state.interestOwed, debt: lg.sb.eco.state.debt, dlg: ui.dialogue.isOpen ? ((ui.dialogue.line||{}).text||'').slice(0,60) + ' | ' + ((ui.dialogue.line||{}).choices||[]).map(c=>c.id).join(',') : false, led: ui.ledger.isOpen })))); if (ph === 'wait') break; if (ph === 'arrive') await p.evaluate(() => lg.sb.pier.update(0.5)); }
// walk Pip next to the Baron, optionally empty the pouch (short)
await p.evaluate((MODE) => { const B = lg.sb.pier, g = B.g.position; lg.sb.hero.root.position.set(g.x + 1, 0, g.z); if (MODE === 'short') lg.sb.eco.state.spark = 2; }, MODE);
await p.waitForTimeout(500);
const chip = () => p.evaluate(() => { const c = document.querySelector('.ll-pier-chip'); return c ? { cls: c.className, txt: c.textContent.trim().slice(0, 80), bg: getComputedStyle(c).backgroundColor } : null; });
console.log('chip BEFORE pay', JSON.stringify(await chip()));
await p.screenshot({ path: `tools/shots/s87_pier_1_before_${MODE}_S${S}_${W}x${H}.png` });
const r = await p.evaluate(() => lg.sb.pier.interact()); console.log('interact ->', r);
await p.waitForTimeout(600);
console.log('chip AFTER pay', JSON.stringify(await chip()));
await p.screenshot({ path: `tools/shots/s87_pier_2_after_${MODE}_S${S}_${W}x${H}.png` });
await p.evaluate(() => lg.sb.pier.release());
for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); await skip(); if (await p.evaluate(() => !!ui.ledger.isOpen)) break; }
await p.waitForTimeout(4500);
console.log('stars', await p.evaluate(() => lg.lastReport && lg.lastReport.stars), 'lit', await p.evaluate(() => document.querySelectorAll('.ll-ledger-stars i.on').length));
console.log('goals', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.ll-ledger-goals li, .ll-ledger-goal')].map(l => (l.className.includes('ok') ? 'OK ' : 'MISS ') + l.textContent.trim()))));
console.log('rows', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.ll-ledger-row')].filter(r => !r.classList.contains('hidden-zero')).map(r => r.textContent.trim().replace(/\s+/g, ' ')))));
await p.screenshot({ path: `tools/shots/s87_pier_3_ledger_${MODE}_S${S}_${W}x${H}.png` });
console.log('events', JSON.stringify(await p.evaluate(() => window.__ev)));
console.log('errs', errs); await b.close();
