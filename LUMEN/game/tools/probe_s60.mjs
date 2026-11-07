// S60-B probe: spawn a stranger, sample where it is / whether visible / where the hand points, every 1 s.  node tools/probe_s60.mjs
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:3000/index.html?touch=1&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 12; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.waitForTimeout(800);
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss('followed'); });
console.log(await p.evaluate(() => JSON.stringify(lg.debug.stranger('fair'))));
for (let i = 0; i < 14; i++) {
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => { const S = lg.sb.scamNpc; const g = S.g; const h = document.querySelector('.ll-tutor-hand');
    let vis = null; if (g) { vis = true; g.traverseVisible && (vis = g.visible && !!g.parent); }
    return { t: +S.t.toFixed(1), state: S.state, active: S.active, pos: g ? [+g.position.x.toFixed(1), +g.position.z.toFixed(1)] : null, visible: g?.visible, parent: !!g?.parent, hero: [+lg.sb.hero.root.position.x.toFixed(1), +lg.sb.hero.root.position.z.toFixed(1)], card: ui.tutor.current, hand: h?.classList.contains('show') ? [h.style.left, h.style.top] : null }; });
  console.log(JSON.stringify(r));
  if (i === 6) await p.screenshot({ path: 'tools/shots/s60_probe_stranger.png' });
}
console.log(errs.slice(0, 5)); await b.close();
