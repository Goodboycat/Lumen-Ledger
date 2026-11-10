// S85: log every pouch change (reason) around a season end. arg: 'away' (hero stays) | 'near' (hero walks to the Baron)
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const mode = process.argv[2] || 'away', wait = +process.argv[3] || 40;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
const skip = async () => { if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); };
for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); await skip(); }
await p.waitForTimeout(1500);
await p.evaluate(() => { lg.verbs.skip(); lg.debug.season(4); lg.sb.eco.state.debt = 60; lg.sb.eco.state.jars.spend = 20; window.__ev = []; const t0 = performance.now();
  for (const k of ['eco:spark','pier:due','pier:paid','pier:short','pier:done','pier:tick','eco:season','eco:stars','ui:ledger:open']) lg.bus.on(k, (pl) => { if (k === 'pier:tick' && pl.left % 5 > 0.01 && Math.round(pl.left) % 5) return; window.__ev.push([Math.round(performance.now()-t0), k, JSON.stringify(pl)?.slice(0,170)]); }); });
await p.evaluate(() => { lg.sb.eco.state.day01 = 0.99; });
for (let i = 0; i < wait; i++) { await p.waitForTimeout(1000); await skip();
  if (mode === 'near' && await p.evaluate(() => lg.sb.pier.active && lg.sb.pier.g)) await p.evaluate(() => { const g = lg.sb.pier.g.position; lg.sb.hero.root.position.set(g.x * 0.9, 0, g.z * 0.9); });
  if (await p.evaluate(() => ui.ledger.isOpen)) break; }
console.log((await p.evaluate(() => window.__ev)).map(x=>x.join(' ')).join('\n'));
console.log(await p.evaluate(() => JSON.stringify({ st: lg.state, spark: lg.sb.eco.state.spark, debt: lg.sb.eco.state.debt, ledger: ui.ledger.isOpen, last: (({income,expenses,interestPaid,upkeep,tillTax,pier})=>({income,expenses,interestPaid,upkeep,tillTax,pier}))(lg.sb.eco.history.at(-1)) })));
await p.screenshot({ path: `tools/shots/s85_season_${mode}.png` });
await b.close();
