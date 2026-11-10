// Pip face close-ups: node tools/face_shot.mjs [expr,expr,...]  -> tools/shots/face_<expr>.png + face_sheet.png (run from LUMEN/game)
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const list = (process.argv[2] || 'neutral,angry,focus,ouch,happy,sad,dizzy,blink').split(',');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 420, height: 420 } })).newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/index.html?nocine&mute&notutorial', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(3000);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 30; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(800);
await p.evaluate(() => {
  const g = window.game, h = lg.sb.hero; document.querySelectorAll('.ll-hud, .ll-touch, [class*=ll-]').forEach(e => { if (e.tagName !== 'CANVAS' && !e.contains(g.renderer.domElement)) e.style.visibility = 'hidden'; });
  g.camera.update = () => { const hp = h.root.position; g.camera.cam.position.set(hp.x + 0.0, hp.y + 1.75, hp.z + 2.6); g.camera.cam.lookAt(hp.x, hp.y + 1.45, hp.z); g.camera.cam.fov = 38; g.camera.cam.updateProjectionMatrix(); };
  h.root.rotation.y = 0; h.facing = 0;
  window.__pause = () => { g.paused = true; };
});
const fs = await import('node:fs');
for (const e of list) {
  await p.evaluate((e) => { const h = lg.sb.hero; if (h.face) h.face.set(e, 5); }, e);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `tools/shots/face_${e}.png` });
}
console.log('errs', errs.slice(0, 4)); await b.close();
