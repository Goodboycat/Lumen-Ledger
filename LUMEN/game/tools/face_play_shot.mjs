// S82: snap each Pip expression in REAL play (game camera, zoomed in) at W x H -> tools/shots/s82_fp_<expr>_WxH.png + sheet
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390]; const Z = +process.argv[4] || 1.25;
const list = (process.argv[5] || 'neutral,angry,focus,ouch,happy,worried').split(',');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true })).newPage();
await p.goto('http://localhost:3000/index.html?touch=1&nocine&mute&notutorial', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 90000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 24; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.evaluate((Z) => { lg.game.camera.zoom = Z; lg.sb.hero.root.rotation.y = 0; lg.sb.hero.facing = 0; }, Z); await p.waitForTimeout(1500);
const fs = await import('node:fs');
for (const e of list) {
  await p.evaluate((e) => { lg.sb.hero.face.set(e, 30, 9, true); }, e); await p.waitForTimeout(500);
  const c = await p.evaluate(() => { const h = lg.sb.hero, cam = lg.game.camera.cam || lg.game.camera.three; const v = h.root.position.clone(); v.y += 1.1; v.project(cam); const el = lg.game.renderer.domElement.getBoundingClientRect(); return { x: (v.x + 1) / 2 * el.width, y: (1 - v.y) / 2 * el.height }; });
  await p.screenshot({ path: `tools/shots/s82_fp_${e}_${W}x${H}.png`, clip: { x: Math.max(0, c.x - 45), y: Math.max(0, c.y - 45), width: 90, height: 90 } });
}
await b.close(); console.log('ok');
