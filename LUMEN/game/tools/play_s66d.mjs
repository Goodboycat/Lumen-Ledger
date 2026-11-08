// S66-D rig: boot story, clear intro, force eco:win, screenshot the victory cinematic at key times, check the camera returns.
//   node tools/play_s66d.mjs W H    (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:3000/index.html?touch=1&debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); const st = await p.evaluate(() => ({ cine: lg.cine && lg.cine.active, dlg: ui.dialogue.isOpen, vs: lg.verbs.step })); if (st.dlg) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); else if (!st.cine && st.vs >= 0) break; }
await p.evaluate(() => { lg.verbs.skip?.(); });
// put some fog on the island like a real win-run would have, then win
await p.evaluate(() => { const s = lg.sb.eco.state; s.season = 10; s.spark = 999; lg.sb.vfx.fog?.setCoverage(0.55, { immediate: true }); window.__fovs = []; window.__t = []; });
await p.evaluate(() => { lg.bus.emit('eco:win', { season: 10 }); });
const marks = [1.2, 3.0, 4.6, 5.3, 6.2, 7.4, 8.8, 10.2, 11.8, 13.2];
const info = []; let mi = 0, last = -1;
for (let k = 0; k < 900 && mi < marks.length; k++) {
  const st = await p.evaluate(() => ({ a: lg.cine.active, t: lg.cine.t, fov: lg.sb && lg.sb.game ? 0 : 0, camfov: window.game ? window.game.camera.cam.fov : null }));
  if (!st.a) break;
  if (st.t >= marks[mi]) { const n = `tools/shots/s66d_${W}x${H}_${String(mi).padStart(2, '0')}_t${marks[mi]}.png`; await p.screenshot({ path: n }); const e = await p.evaluate(() => ({ fov: lg.cine.game.camera.cam.fov, bank: lg.cine._shot && lg.cine._shot.bank ? lg.cine._shot.bank.alive : null, state: lg.sb.world.lighthouse.userData.state })); info.push({ mark: marks[mi], t: +st.t.toFixed(2), ...e }); mi++; }
  await p.waitForTimeout(60);
}
// wait for the end
for (let k = 0; k < 200; k++) { const a = await p.evaluate(() => lg.cine.active); if (!a) break; await p.waitForTimeout(100); }
await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({ active: lg.cine.active, fov: lg.cine.game.camera.cam.fov, dlg: ui.dialogue.isOpen, state: lg.state, fogCov: lg.sb.vfx.fog && lg.sb.vfx.fog.coverage, bankMeshes: lg.sb.game.scene.children.filter((c) => c.name === 'cine.fogBank').length }));
await p.screenshot({ path: `tools/shots/s66d_${W}x${H}_99_after.png` });
console.log(JSON.stringify({ info, after })); console.log('errs', errs.slice(0, 5)); await b.close();
