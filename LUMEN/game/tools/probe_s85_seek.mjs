// S85: force the Baron's wait to run out with the hero far away; log phase / Baron-hero distance / pouch until he collects.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
const skip = async () => { if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); };
for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); await skip(); }
await p.waitForTimeout(1500);
await p.evaluate(() => { lg.verbs.skip(); lg.debug.season(4); lg.sb.eco.state.debt = 60; lg.sb.eco.state.spark = 120; lg.sb.hero.root.position.set(-6, 0, 6); window.__ev = []; const t0 = performance.now();
  for (const k of ['pier:due','pier:seek','pier:paid','pier:short','pier:done','eco:interest']) lg.bus.on(k, (pl) => window.__ev.push([Math.round(performance.now() - t0), k, JSON.stringify(pl).slice(0, 110)])); });
await p.evaluate(() => { lg.sb.eco.state.day01 = 0.99; });
for (let i = 0; i < 60; i++) { await p.waitForTimeout(700); await skip();
  const s = await p.evaluate(() => { const B = lg.sb.pier; if (!B.active) return null; if (B.phase === 'wait' && B.t > 1) B.t = Math.max(B.t, 19.4); const g = B.g?.position, h = lg.sb.hero.root.position; return { ph: B.phase, d: g ? +Math.hypot(g.x - h.x, g.z - h.z).toFixed(1) : null, spark: Math.round(lg.sb.eco.state.spark), debt: Math.round(lg.sb.eco.state.debt) }; });
  if (s) console.log(JSON.stringify(s)); if (s && !['wait','arrive'].includes(s.ph) && i > 2 && s.ph === 'leave') break; }
console.log((await p.evaluate(() => window.__ev)).map(x => x.join(' ')).join('\n'));
await p.screenshot({ path: 'tools/shots/s85_seek.png' }); await b.close();
