// S60-B repro: ask the stranger card while the stranger strolls; compare the hand with the stranger's LIVE screen position.
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:3000/index.html?touch=1&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 12; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.waitForTimeout(800);
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss('followed'); });
await p.evaluate(() => lg.debug.stranger('fair'));
await p.waitForFunction(() => lg.sb.scamNpc.state === 'pitch', null, { timeout: 20000 });
await p.waitForTimeout(500);
const S = () => p.evaluate(() => { const g = lg.sb.scamNpc.g, cam = lg.game.camera.three || lg.game.camera, el = lg.game.renderer.domElement; const h = document.querySelector('.ll-tutor-hand');
  const T = lg.sb.scamNpc.g ? (() => { const v = lg.sb.scamNpc.g.position.clone(); v.y = 1.3; v.project(cam); return [Math.round((v.x + 1) / 2 * el.clientWidth), Math.round((1 - v.y) / 2 * el.clientHeight)]; })() : null;
  const hb = h.getBoundingClientRect();
  return { state: lg.sb.scamNpc.state, card: ui.tutor.current, strangerPx: T, handTipPx: h.classList.contains('show') ? [Math.round(hb.x + hb.width / 2), Math.round(hb.y)] : null }; });
console.log('ask ->', await p.evaluate(() => ui.tutor.ask('npc:stranger', { x: lg.sb.scamNpc.g.position.x, z: lg.sb.scamNpc.g.position.z })));
for (let i = 0; i < 9; i++) { await p.waitForTimeout(1200); console.log(JSON.stringify(await S())); }
await p.screenshot({ path: 'tools/shots/s60_b_before.png' });
console.log(errs.slice(0, 5)); await b.close();
