// S63 final beginner shots: phone 844x390 (touch) + desktop 1280x720. Jar tag near Pip, tray open. node tools/play_s63d.mjs
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = {};
for (const [tag, o, q] of [['phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, '?touch=1&nocine'], ['desk', { viewport: { width: 1280, height: 720 } }, '?nocine']]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:3000/index.html' + q, { waitUntil: 'load' });
  await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
  await p.screenshot({ path: `tools/shots/s63d_${tag}_title.png` });
  await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
  for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
  await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss?.('followed'); lg.debug?.grant?.(300); });
  await p.evaluate(() => { ui.build.open(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { ui.build.select?.('jar_spend'); ui.build.deploy('jar_spend'); }); await p.waitForTimeout(400);
  await p.evaluate(() => { const b = lg.sb.build, hp = lg.sb.hero.root.position; for (const [dx, dz] of [[2,0],[-2,0],[0,2],[0,-2],[3,3],[-3,3],[3,-3],[-3,-3]]) { b.moveTo(hp.x + dx, hp.z + dz); if (b.confirm()) return; } });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const J = lg.sb.jarsWorld, m = J.get(J.ids()[0]); lg.sb.hero.root.position.set(m.position.x + 0.9, 0, m.position.z); lg.sb.jarsWorld.update(0.016); lg.bus.emit('tut:skip', {}); });
  await p.waitForTimeout(1200); await p.screenshot({ path: `tools/shots/s63d_${tag}_jar.png` });
  await p.evaluate(() => ui.build.open()); await p.waitForTimeout(600); await p.screenshot({ path: `tools/shots/s63d_${tag}_tray.png` });
  out[tag] = { tag: await p.evaluate(() => document.querySelector('.ll-jar-tag.near')?.textContent || null), errors: errs.slice(0, 4) };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1)); await b.close();
