import { launch, startStory } from './rig76.mjs';
const [W, H] = [+process.argv[2] || 568, +process.argv[3] || 320];
const { p, b } = await launch(W, H); await startStory(p);
await p.evaluate(() => { lg.debug.grant?.(300); ui.build.open(); }); await p.waitForTimeout(900);
console.log(JSON.stringify(await p.evaluate(() => { const o = {}; for (const s of ['.ll-build-tray', '.ll-build-tabs', '.ll-build-gridwrap', '.ll-build-grid', '.ll-card', '.ll-build-foot', '.ll-build-hint', '.ll-build-toggle', '.ll-spark', '.ll-build-detail']) { const e = document.querySelector(s); if (!e) { o[s] = null; continue; } const r = e.getBoundingClientRect(); o[s] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; } return o; }), null, 1));
await p.evaluate(() => document.querySelector('.ll-card:not(.locked)')?.click()); await p.waitForTimeout(500); console.log('with detail', JSON.stringify(await p.evaluate(() => { const o = {}; for (const s of ['.ll-build-tray', '.ll-build-detail', '.ll-build-grid']) { const r = document.querySelector(s)?.getBoundingClientRect(); o[s] = r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; } return o; }))); await p.screenshot({ path: 'tools/shots/s79_tray_detail_' + W + 'x' + H + '.png' });
await b.close();
