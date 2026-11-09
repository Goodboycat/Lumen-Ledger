// S75: real-browser check of the 5 user fixes. node tools/shot_s75.mjs W H
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/');
const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto('http://localhost:3000/index.html?touch=1&debug=1&nocine&mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(800);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 50; i++) { await p.waitForTimeout(300); const d = await p.evaluate(() => ui.dialogue.isOpen); if (d) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(1200);
const out = {};
// unlock + place two jars side by side through the build API (like gates/jars1.mjs)
out.setup = await p.evaluate(() => {
  const d = lg.debug; d.unlockJar('save'); d.unlockJar('protect'); d.grant?.(500);
  const sb = lg.sb, hp = sb.hero.root.position; hp.set(0, 0, 0);
  const cells = sb.island.gridCells().filter((c) => Math.hypot(c.x, c.z) >= 4 && Math.hypot(c.x, c.z) <= 9);
  // find two neighbouring cells (same z, dx ~ 1.5-2 u): left = save, right = protect
  let pair = null;
  for (const a of cells) { for (const b of cells) { const dx = b.x - a.x; if (Math.abs(b.z - a.z) < 0.01 && dx > 1.2 && dx < 2.6 && sb.build.canPlace('jar_save', a.x, a.z, 0) && sb.build.canPlace('jar_protect', b.x, b.z, 0)) { pair = [a, b]; break; } } if (pair) break; }
  if (!pair) return { err: 'no pair' };
  sb.build.place('jar_save', pair[0].x, pair[0].z, 0); sb.build.place('jar_protect', pair[1].x, pair[1].z, 0);
  return { pair: pair.map(c => [c.x, c.z]), jars: sb.jarsWorld.ids() };
});
console.log('setup', JSON.stringify(out.setup));
const toScreen = (id) => p.evaluate((id) => { const m = lg.sb.jarsWorld.meshOf(id); const cam = lg.game.camera.three; const v = m.position.clone(); v.y += 0.5; v.project(cam); const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; }, id);
const tap = async (x, y) => { await p.touchscreen.tap(x, y); await p.waitForTimeout(900); };
await p.evaluate(() => { lg.modalClosedAt = 0; });
await p.screenshot({ path: `tools/shots/s75_jars_${W}x${H}.png` });
// 1 ground tap -> no tray
await tap(W * 0.5, H * 0.8);
out.groundTrayOpen = await p.evaluate(() => ui.build.isOpen);
console.log('1 ground tap -> tray open:', out.groundTrayOpen, '(want false)');
// 2 adjacent jars: tap the RIGHT one (protect) while Pip stands near both
await p.evaluate(() => { const sb = lg.sb, a = sb.jarsWorld.get('save').position, b = sb.jarsWorld.get('protect').position; sb.hero.root.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2 + 0.6); });
await p.waitForTimeout(3500);   // the follow camera glides after the teleport: project only once it has settled
const sp = await toScreen('save'), pp = await toScreen('protect');
console.log('screen save', JSON.stringify(sp), 'protect', JSON.stringify(pp), 'gap px', Math.round(pp.x - sp.x));
const bal = () => p.evaluate(() => ({ ...lg.sb.eco.state.jars, spark: lg.sb.eco.state.spark }));
const b0 = await bal(); await tap(pp.x + 6, pp.y + 10); const b1 = await bal();   // finger a little off-centre, toward the left jar's side
console.log('2 tap RIGHT jar (protect): before', JSON.stringify(b0), 'after', JSON.stringify(b1));
{ const sp2 = await toScreen('save'); await tap(sp2.x - 4, sp2.y + 8); } const b2 = await bal();
console.log('2 tap LEFT jar (save): after', JSON.stringify(b2));
// 3 shop: low pouch -> unaffordable cards must show "need N more" with NO lock glyph (text, ::after, icon)
await p.evaluate(() => { const e = lg.sb.eco; e._addSpark(-(e.state.spark - 5), 'test'); ui.build.setCategory?.('stall'); ui.build.open(); });
await p.waitForTimeout(900);
out.lock = await p.evaluate(() => { const cards = [...document.querySelectorAll('.ll-card.poor')]; const all = document.querySelectorAll('.ll-card').length;
  const c0 = cards[0]; const cost = c0?.querySelector('.ll-card-cost'); return { all, poor: cards.length, txt: cards.slice(0, 3).map(c => c.querySelector('.ll-card-cost')?.textContent), after: c0 ? getComputedStyle(c0, '::after').content : null, costHtmlHasLock: cards.some(c => /lock/i.test(c.querySelector('.ll-card-cost')?.innerHTML || '')) }; });
console.log('3 shop', JSON.stringify(out.lock));
await p.screenshot({ path: `tools/shots/s75_shop_${W}x${H}.png` });
await p.evaluate(() => ui.build.close());
await p.waitForTimeout(400);
// 4 ledger: tap OUTSIDE the sheet closes it (after the count-up)
await p.evaluate(() => { const e = lg.sb.eco; e._addSpark(300, 'test'); });
await p.evaluate(() => { const r = lg.sb.eco.endSeason(); ui.ledger.show(r); });
await p.waitForTimeout(3500);
out.ledgerOpen = await p.evaluate(() => !!document.querySelector('.ll-ledger.open'));
await p.screenshot({ path: `tools/shots/s75_ledger_${W}x${H}.png` });
const sheetBox = await p.evaluate(() => { const r = document.querySelector('.ll-ledger-sheet')?.getBoundingClientRect(); return r && { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
console.log('4 ledger open', out.ledgerOpen, JSON.stringify(sheetBox));
if (out.ledgerOpen && sheetBox) { await p.touchscreen.tap(Math.max(6, sheetBox.l / 2), H / 2); await p.waitForTimeout(900); }
console.log('4 ledger still open after tapping OUTSIDE the sheet:', await p.evaluate(() => !!document.querySelector('.ll-ledger.open')), '(want false, or boon draft shown)', 'draft', await p.evaluate(() => !!document.querySelector('.ll-boon.open, .ll-draft.open, [class*=boon][class*=open]')));
console.log('errs', JSON.stringify(errs.slice(0, 5)));
await b.close();
