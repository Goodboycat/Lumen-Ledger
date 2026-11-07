// S60-A/B rig, phone landscape 844x390 (touch) or desktop (arg 'desk'): Move card joystick demo frames + stranger hand live-tracking.  node tools/play_s60.mjs [desk]
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const desk = process.argv[2] === 'desk';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(desk ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const tag = desk ? 'desk' : 'phone'; const shot = (n) => p.screenshot({ path: `tools/shots/s60_${tag}_${n}.png` });
await p.goto('http://localhost:3000/index.html' + (desk ? '?nocine' : '?touch=1&nocine'), { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
const out = {};
// wait for the verb chain's Move card
await p.waitForFunction(() => ui.tutor.current === 'verb:move', null, { timeout: 40000 }).catch(() => {});
out.card = await p.evaluate(() => ui.tutor.current); out.text = await p.evaluate(() => document.querySelector('.ll-tutor-txt')?.textContent);
const J = () => p.evaluate(() => { const j = document.querySelector('.ll-tutor-joy'), h = document.querySelector('.ll-tutor-hand'); const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const hero = lg.sb.hero.root.position; const cam = lg.game.camera.three || lg.game.camera, el = lg.game.renderer.domElement; const a = lg.sb ? null : null;
  return { joyClass: j.className, joyBox: r(j), joyDisplay: getComputedStyle(j).display, worldHandShown: h.classList.contains('show'), worldHand: h.classList.contains('show') ? r(h) : null, heroXZ: [+hero.x.toFixed(1), +hero.z.toFixed(1)] }; });
out.j0 = await J();
for (const [i, ms] of [[1, 450], [2, 700], [3, 700]]) { await p.waitForTimeout(ms); await shot('move' + i); }
out.joyOverlapsCard = await p.evaluate(() => { const a = document.querySelector('.ll-tutor-joy').getBoundingClientRect(), c = document.querySelector('.ll-tutor').getBoundingClientRect(); return !(a.right < c.left || a.left > c.right || a.bottom < c.top || a.top > c.bottom); });
// real stick touched -> demo steps aside; keyboard walk on desktop
if (!desk) { await p.evaluate(() => ui.touch.simulateJoystick?.(30, -40)); await p.waitForTimeout(500); out.hiddenWhileStick = await p.evaluate(() => document.querySelector('.ll-tutor-joy').classList.contains('hide')); await p.evaluate(() => ui.touch.simulateJoystick?.(0, 0, true)); }
else { await p.keyboard.down('w'); await p.waitForTimeout(1200); await p.keyboard.up('w'); }
await p.waitForTimeout(800); out.afterMove = await p.evaluate(() => ({ card: ui.tutor.current, joyShown: document.querySelector('.ll-tutor-joy').classList.contains('show') }));
// ---- S60-B stranger: hand follows the LIVE stranger, hides when the stranger is gone
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss('followed'); });
await p.evaluate(() => lg.debug.stranger('fair')); await p.waitForFunction(() => lg.sb.scamNpc.state === 'pitch', null, { timeout: 25000 });
await p.evaluate(() => ui.tutor.ask('npc:stranger', { x: 99, z: 99 }));        // a STALE snapshot far away on purpose: the hand must ignore it
const live = () => p.evaluate(() => { const g = lg.sb.scamNpc.g, cam = lg.game.camera.three || lg.game.camera, el = lg.game.renderer.domElement, h = document.querySelector('.ll-tutor-hand'); if (!g) return { gone: true, card: ui.tutor.current, hand: h.classList.contains('show') };
  const v = g.position.clone(); v.y = 1.3; v.project(cam); const sx = (v.x + 1) / 2 * el.clientWidth, sy = (1 - v.y) / 2 * el.clientHeight; const hb = h.getBoundingClientRect();
  return { card: ui.tutor.current, handShown: h.classList.contains('show'), dx: Math.round(hb.x + hb.width / 2 - sx), strangerPx: [Math.round(sx), Math.round(sy)] }; });
const samples = []; for (let i = 0; i < 4; i++) { await p.waitForTimeout(1000); samples.push(await live()); } out.strangerLive = samples; await shot('stranger_live');
await p.evaluate(() => lg.sb.scamNpc.clear()); await p.waitForTimeout(2600); out.strangerGone = await live();
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
