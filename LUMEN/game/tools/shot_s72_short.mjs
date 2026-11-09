// S72: real-browser check of the short-pay fix. node tools/shot_s72_short.mjs W H
// Pouch short + money on a till -> season ends -> Baron waits -> chip says 'need N more' (salmon) -> Pip walks to the till -> chip flips to 'pay it all' -> pay -> star.
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
const setup = await p.evaluate(() => { const sb = lg.sb, e = sb.eco; sb.enemies && (sb.enemies.enabled = false); e.state.debt = 200; e.state.spark = 60;
  e.allocate({ save: 55 }); e.state.day01 = 1; e.endSeason(); return { owed: e.state.interestOwed, spark: e.state.spark, jars: { ...e.state.jars }, hold: [...sb.clockHold] }; });
console.log('setup', JSON.stringify(setup));
let last = null;
for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); last = await p.evaluate(() => ({ s: lg.state, d: ui.dialogue.isOpen, ph: lg.sb.pier.phase })); if (last.d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); if (last.s === 'pier' && last.ph === 'wait') break; }
console.log('at pier', JSON.stringify(last));
await p.waitForTimeout(500);
const chip = () => p.evaluate(() => { const c = document.querySelector('.ll-pier-chip'); return { text: c && c.textContent, short: c && c.classList.contains('short'), hidden: c && c.hidden, left: lg.sb.pier.t }; });
const c1 = await chip(); console.log('short chip', JSON.stringify(c1)); await p.screenshot({ path: `tools/shots/s72_short_${W}x${H}.png` });
// take Spark out of the Save jar the way a player does: the jars panel's withdraw button (tap), falling back to the world jar API
const wd = await p.evaluate(() => { const before = lg.sb.eco.state.spark; const btn = [...document.querySelectorAll('.ll-jar-wd')].find(x => x.offsetParent !== null); if (btn) btn.click(); else lg.sb.eco.withdraw('save', 40); return { before, viaButton: !!btn }; });
await p.waitForTimeout(900);
const c2 = await chip(); const sp = await p.evaluate(() => ({ spark: lg.sb.eco.state.spark, graceLeft: lg.sb.pier.grace, t: lg.sb.pier.t })); console.log('after withdraw', JSON.stringify({ wd, c2, sp })); await p.screenshot({ path: `tools/shots/s72_collected_${W}x${H}.png` });
const res = await p.evaluate(() => { const B = lg.sb.pier; lg.sb.hero.root.position.set(B.g.position.x + 1, 0, B.g.position.z); return lg.sb.interact(); });
await p.waitForTimeout(500); await p.screenshot({ path: `tools/shots/s72_paid_${W}x${H}.png` });
await p.evaluate(() => lg.sb.interactRelease());
for (let i = 0; i < 40; i++) { await p.waitForTimeout(400); const st = await p.evaluate(() => ({ s: lg.state, d: ui.dialogue.isOpen, l: ui.ledger.isOpen })); if (st.d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); if (st.l) break; }
const after = await p.evaluate(() => { const r = lg.sb.eco.history.at(-1); return { stars: r.stars, pier: r.pier, debt: lg.sb.eco.state.debt }; });
console.log(JSON.stringify({ res, after, errs: errs.slice(0, 6) }, null, 1)); await b.close();
