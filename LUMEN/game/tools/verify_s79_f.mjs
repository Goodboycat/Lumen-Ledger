// S79: verify S77-F1/F2/F3 at a given size. node tools/verify_s79_f.mjs W H
import { launch, startStory, shot } from './rig76.mjs';
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const { p, b, errs } = await launch(W, H);
await startStory(p);
const box = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; }, sel);
const hit = (a, c) => a && c && a.x < c.r && a.r > c.x && a.y < c.b && a.b > c.y;
// F1: banner
await p.evaluate(() => { lg.sb.eco.state.debt = 300; lg.sb.eco.state.spark = 120; ui.wave.show('BARON GILT IS COMING FOR HIS INTEREST!', { kind: 'boss', duration: 60 }); });
await p.waitForTimeout(500);
console.log('wave api', await p.evaluate(() => Object.keys(ui.wave)));
const ban = await box('.ll-wave-banner');
const pills = {};
for (const s of ['.ll-spark', '.ll-spark-pay', '.ll-season', '.ll-mid', '.ll-right', '.ll-focus', '.ll-rep', '.ll-fog']) pills[s] = await box(s);
console.log('banner', JSON.stringify(ban));
for (const [k, v] of Object.entries(pills)) console.log(' ', k, JSON.stringify(v), hit(ban, v) ? '<<< OVERLAP' : 'ok');
await shot(p, `s79_banner_${W}x${H}`);
await p.evaluate(() => ui.wave.hide());
// F2/F3: shop tray
await p.evaluate(() => { lg.debug.grant?.(300); ui.build.open(); });
await p.waitForTimeout(900);
const tray = await box('.ll-build-tray') || await box('.ll-build'); const tabs = await p.evaluate(() => [...document.querySelectorAll('.ll-build-tab')].map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0,8), Math.round(r.width), Math.round(r.height)]; }));
const sparkB = await box('.ll-spark'); const grid = await box('.ll-build-grid');
console.log('tray', JSON.stringify(tray), 'spark', JSON.stringify(sparkB), 'tray-vs-spark', hit(tray, sparkB) ? '<<< OVERLAP' : 'ok');
console.log('tabs [name,w,h]', JSON.stringify(tabs));
const more = await p.evaluate(() => { const g = document.querySelector('.ll-build-grid'), w = document.querySelector('.ll-build-gridwrap'); return { wrapMore: w?.classList.contains('more'), overflow: g.scrollHeight - g.clientHeight, cards: g.children.length }; });
console.log('hint', JSON.stringify(more));
await shot(p, `s79_tray_${W}x${H}`);
// each tab: chevron only when overflowing
const cats = await p.evaluate(() => [...document.querySelectorAll('.ll-build-tab')].map((e, i) => i));
for (const i of cats) { await p.evaluate((i) => document.querySelectorAll('.ll-build-tab')[i].click(), i); await p.waitForTimeout(350);
  console.log(' tab', i, JSON.stringify(await p.evaluate(() => { const g = document.querySelector('.ll-build-grid'), w = document.querySelector('.ll-build-gridwrap'); return { more: w?.classList.contains('more'), overflow: g.scrollHeight - g.clientHeight, cards: g.children.length }; }))); }
console.log('errs', JSON.stringify(errs.slice(0, 5)));
await b.close();
