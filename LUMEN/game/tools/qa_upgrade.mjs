// Browser probe for the user-reported upgrade bugs (2026-10-24):
//   (a) upgrading a stall "has no effect"  (b) building a 2nd stall of the same type "resets the upgrade to L1".
// Run from game/ with the static server on :3000:   NODE_PATH=tools/node_modules node tools/qa_upgrade.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:3000/index.html?notutorial&mute&nohistory&nocine&autoplay&season=150&seed=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.lg.sb && window.lg.state === 'playing', null, { timeout: 30000 });
await p.waitForTimeout(800);
// close any opening dialogue
for (let i = 0; i < 40; i++) { const open = await p.evaluate(() => !!window.ui?.dialogue?.isOpen); if (!open) break; await p.evaluate(() => window.ui.dialogue.advance()); await p.waitForTimeout(150); }
const snap = async (tag) => console.log(tag, JSON.stringify(await p.evaluate(() => {
  const sb = window.lg.sb; const out = [];
  for (const e of sb.build.placed.values()) if (e.id.startsWith('stall_')) out.push({ id: e.id, lvl: e.level, ud: e.group.userData.level, parts: e.group.userData.body?.getObjectByName('levelParts')?.children.length, cost: e.cost, cx: e.cx, cz: e.cz });
  const tray = window.ui.build; const up = tray.el.querySelector('.ll-build-detail .ll-btn.up, .ll-build-detail button[title*="pgrade"], .ll-build-detail button');
  return { spark: sb.eco.state.spark, stalls: out, placedById: [...tray.state.placedById.entries()].map(([k, m]) => [k, [...m.values()]]) };
})));
await p.evaluate(() => { window.lg.sb.eco.state.spark = 2000; window.lg.sb.game.bus.emit('eco:spark', { spark: 2000, delta: 0, reason: 'qa' }); });
await snap('start');
// pick the first stall; select it in the tray; click the ⬆ Upgrade detail button
const id = await p.evaluate(() => [...window.lg.sb.build.placed.values()].find((e) => e.id.startsWith('stall_')).id);
await p.evaluate((id) => { window.ui.build.open(); window.ui.build.select(id); }, id);
await p.waitForTimeout(300);
const btnTxt = await p.evaluate(() => [...document.querySelectorAll('.ll-build-detail button')].map((x) => x.textContent.trim() + (x.disabled ? '(dis)' : '')));
console.log('detail buttons', btnTxt);
await p.evaluate(() => { const bt = [...document.querySelectorAll('.ll-build-detail button')].find((x) => /Upgrade/i.test(x.textContent)); bt && bt.click(); });
await p.waitForTimeout(1200);
await snap('after upgrade click');
const btnTxt2 = await p.evaluate(() => [...document.querySelectorAll('.ll-build-detail button')].map((x) => x.textContent.trim() + (x.disabled ? '(dis)' : '')));
console.log('detail buttons after', btnTxt2);
// now deploy another of the same type via BuildSystem directly at a free cell near the plaza
const placed = await p.evaluate((id) => {
  const sb = window.lg.sb; const b = sb.build; let ok = null;
  for (let x = -6; x <= 6 && !ok; x++) for (let z = -6; z <= 6 && !ok; z++) if (b.canPlace(id, x, z, 0)) { ok = b.place(id, x, z, 0, { animate: false }); if (ok) return { x, z }; }
  return null;
}, id);
console.log('placed 2nd', placed);
await p.waitForTimeout(600);
await snap('after 2nd placed');
const btnTxt3 = await p.evaluate(() => { window.ui.build.open(); return [...document.querySelectorAll('.ll-build-detail button')].map((x) => x.textContent.trim() + (x.disabled ? '(dis)' : '')); });
console.log('detail buttons after 2nd', btnTxt3);
// check that a sale at that stall uses the level multiplier
const sale = await p.evaluate((id) => { const sb = window.lg.sb; const e = [...sb.build.placed.values()].find((x) => x.id === id); const r1 = sb.eco.sell(id, 'regular', undefined, { level: 1 }); const r2 = sb.eco.sell(id, 'regular', undefined, { level: e.level }); return { lvl: e.level, l1: r1.sold, lN: r2.sold, mul: sb.eco.levelMul(e.level) }; }, id);
console.log('sale check', sale);
console.log('errors', errs.slice(0, 5));
await b.close();
