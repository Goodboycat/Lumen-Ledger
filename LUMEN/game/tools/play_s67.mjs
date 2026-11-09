// S67 rig: Boon Draft after a season end.   node tools/play_s67.mjs W H   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s67_${W}x${H}_${n}.png` });
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => { ui.title.buttons.story.click(); });
for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); const st = await p.evaluate(() => ({ cine: lg.cine && lg.cine.active, dlg: ui.dialogue.isOpen, vs: lg.verbs.step })); if (st.dlg) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); else if (!st.cine && st.vs >= 0) break; }
await p.waitForTimeout(800);
await p.evaluate(() => { lg.verbs.skip?.(); window.__ev = []; for (const k of ['ui:continue', 'ui:boon:open', 'ui:boon:pick', 'boon:picked']) lg.bus.on(k, () => window.__ev.push(k)); });
// a real S1 season end: sell, save, repay
await p.evaluate(() => { const e = lg.sb.eco; e.state.spark = 400; for (let i = 0; i < 20; i++) e.sell('fruit', 'regular', 5); e.allocate({ save: 30 }); e.repay(100); ui.tutor.dismiss(); });
await p.evaluate(() => { lg.sb.eco.state.day01 = 0.999; lg.sb.eco.tick(1.0); });
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(400);
  const st = await p.evaluate(() => ({ o: ui.ledger.isOpen, s: lg.state }));
  if (st.o) break;
  if (st.s === 'pier') await p.evaluate(() => { const b = lg.sb.pier; if (b && b.active) b.settle('rig'); });
}
await p.waitForTimeout(500);
await p.evaluate(() => { for (let i = 0; i < 6; i++) { if (ui.dialogue.isOpen) { ui.dialogue.skip(); ui.dialogue.advance(); } } });
await p.waitForTimeout(1200);
await p.evaluate(() => ui.ledger.skip && ui.ledger.skip()); await p.waitForTimeout(400);
const before = await p.evaluate(() => ({ st: lg.state, season: lg.sb.eco.state.season }));
await p.evaluate(() => ui.ledger.continue()); await p.waitForTimeout(1500);
const open = await p.evaluate(() => ({ open: ui.boons.isOpen, modal: ui.isModal, cards: [...document.querySelectorAll('.ll-boon-card')].map((c) => c.textContent.trim().replace(/\s+/g, ' ').slice(0, 90)), st: lg.state }));
await shot('2_draft');
const geo = await p.evaluate(() => { const g = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }; return { vw: innerWidth, vh: innerHeight, cards: [...document.querySelectorAll('.ll-boon-card')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom), c.scrollHeight > c.clientHeight + 1]; }), pick: g('.ll-boons-pick'), root: g('.ll-boons') }; });
await p.click('.ll-boon-card >> nth=0'); await p.waitForTimeout(400); await shot('3_selected');
const pickEnabled = await p.evaluate(() => !document.querySelector('.ll-boons-pick').disabled);
await p.click('.ll-boons-pick'); await p.waitForTimeout(2000);
const after = await p.evaluate(() => ({ open: ui.boons.isOpen, st: lg.state, season: lg.sb.eco.state.season, boons: lg.sb.eco.state.boons.map((b) => b.id), ev: window.__ev, rowKids: document.querySelector('#ll-boon-row') ? document.querySelector('#ll-boon-row').children.length : -1 }));
await shot('4_after');
for (let i = 0; i < 8; i++) { await p.evaluate(() => { if (ui.dialogue.isOpen) { ui.dialogue.skip(); ui.dialogue.advance(); } }); await p.waitForTimeout(300); }
await p.waitForTimeout(600); await shot('4b_play');
const row = await p.evaluate(() => { const r = document.querySelector('#ll-boon-row'); if (!r) return null; const b = r.getBoundingClientRect(); const hud = [...document.querySelectorAll('.ll-hud *')].filter((e) => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0 && !(q.right < b.left || q.left > b.right || q.bottom < b.top || q.top > b.bottom) && !r.contains(e); }).slice(0, 6).map((e) => e.className); return { rect: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], overlap: hud }; });
const badge = await p.$('#ll-boon-row > *'); if (badge) { await badge.click({ force: true, timeout: 5000 }).catch(() => {}); await p.waitForTimeout(500); await shot('5_badge_pop'); }
console.log(JSON.stringify({ W, H, before, open, geo, pickEnabled, after, row })); console.log('errs', errs.slice(0, 5)); await b.close();
