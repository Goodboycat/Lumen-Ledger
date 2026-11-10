// S82: Pip face in REAL play at W x H (default 844x390): attack -> angry, build placing -> focus, enemy hit -> ouch, idle -> neutral.
// node tools/probe_s82_face.mjs W H   -> tools/shots/s82_face_<state>_WxH.png (zoomed camera crop on Pip) + STATE lines
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })).newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/index.html?touch=1&nocine&mute&notutorial', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(3000);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(1200);
const S = async (n) => { await p.screenshot({ path: `tools/shots/s82_face_${n}_${W}x${H}.png` });
  const c = await p.evaluate(() => { const h = lg.sb.hero, cam = lg.game.camera.three || lg.game.camera.cam || lg.game.camera; const v = h.root.position.clone(); v.y += 1.15; v.project(cam.projectionMatrix ? cam : lg.game.camera.cam); const el = lg.game.renderer.domElement.getBoundingClientRect(); return { x: (v.x + 1) / 2 * el.width, y: (1 - v.y) / 2 * el.height }; });
  await p.screenshot({ path: `tools/shots/s82_face_${n}_${W}x${H}_crop.png`, clip: { x: Math.max(0, c.x - 40), y: Math.max(0, c.y - 40), width: 80, height: 80 } }); };
const face = () => p.evaluate(() => { const f = lg.sb.hero.face; return { name: f?.name, state: lg.sb.hero.state, move: lg.sb.hero.moveName }; });
console.log('STATE idle', JSON.stringify(await face())); await S('1_idle');
// attack
await p.evaluate(() => { lg.sb.hero.doAttack(); }); await p.waitForTimeout(450);
console.log('STATE attack', JSON.stringify(await face())); await S('2_attack');
await p.waitForTimeout(1800);
// build placing
await p.evaluate(() => { lg.debug.grant?.(400); lg.sb.build.enter('jar_save'); }); await p.waitForTimeout(900);
console.log('STATE build', JSON.stringify(await face(), null, 0), 'mode', await p.evaluate(() => lg.sb.build.mode)); await S('3_build');
await p.evaluate(() => { lg.sb.build.exit?.(); ui.build.close?.(); }); await p.waitForTimeout(1500);
console.log('STATE after build', JSON.stringify(await face()));
// hit
await p.evaluate(() => { lg.game.bus.emit('enemy:heroHit', { kind: 'collector', spark: 0 }); }); await p.waitForTimeout(250);
console.log('STATE hit', JSON.stringify(await face())); await S('4_hit');
await p.waitForTimeout(2000); console.log('STATE recover', JSON.stringify(await face()));
console.log('errs', errs.slice(0, 4)); await b.close();
