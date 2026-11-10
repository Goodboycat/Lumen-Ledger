// S85: what happens to the pouch when a season ends? Logs spark/debt/jars + pier phase over time.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.evaluate(() => { lg.verbs.skip(); lg.debug.season(3); lg.debug.grant(60); lg.sb.eco.state.debt = 80; });
const S = () => p.evaluate(() => { const e = lg.sb.eco.state; return { st: lg.state, season: e.season, spark: Math.round(e.spark), debt: Math.round(e.debt), owed: Math.round(e.interestOwed || 0), jars: JSON.stringify(e.jars), pier: lg.sb.pier.phase, t: lg.sb.pier.t | 0, hero: [lg.sb.hero.root.position.x | 0, lg.sb.hero.root.position.z | 0], baron: lg.sb.pier.g ? [lg.sb.pier.g.position.x | 0, lg.sb.pier.g.position.z | 0] : null, ledger: !!ui.ledger.isOpen }; });
console.log('before', JSON.stringify(await S()));
await p.evaluate(() => { lg.sb.eco.state.day01 = 0.999; });
for (let i = 0; i < 14; i++) { await p.waitForTimeout(1500); console.log(i, JSON.stringify(await S())); }
await p.screenshot({ path: 'tools/shots/s85_season.png' }); console.log('errs', errs); await b.close();
