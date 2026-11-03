// 44D hero shots (phase 44 readable market). Run from game/:
//   NODE_PATH=tools/node_modules node tools/hero_shot_44.mjs
// Boots index.html (?nocine&notutorial&mute), starts a story run, forces season 3 (tea HOT ×1.5 / tool COLD) and
// re-tints every sign, then frames the starter tea stall's sign close-up → LUMEN_extras/game/docs/screenshots/44_hot_sign.png
// and a wide market shot after ~20 s of play (price/want bubbles) → 44_price_bubble.png. Also prints the glyph's
// world position vs the sign bounds so the (0, 0.42, 0.08) offset can be judged numerically, not only by eye.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const port = 3126, OUT = '../../LUMEN_extras/game/docs/screenshots';
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
await p.goto(`http://127.0.0.1:${port}/index.html?nocine&notutorial&mute&season=600`, { waitUntil: 'load' });
await p.waitForTimeout(2000);
// start a fresh story run (same as pressing PLAY), then jump the economy to season 3
const info = await p.evaluate(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  window.game.bus.emit('ui:start', { mode: 'story' });
  await new Promise((r) => setTimeout(r, 1200));
  const sb = window.sb(); const eco = sb.eco;
  eco.state.season = 3;
  for (const pl of sb.build.placed.values()) if (pl.category === 'stall' && !pl.scenery) sb.signTint(pl.id);
  const sign = sb.build.owned('stall_tea')?.group?.userData?.slots?.sign;
  const g = sign?.getObjectByName('demandGlyph');
  const T = window.THREE || null;
  let bounds = null, gw = null;
  if (sign && g) {
    sign.updateWorldMatrix(true, true);
    const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    sign.traverse((m) => { if (!m.isMesh || m === g) return; m.geometry.computeBoundingBox?.(); const bb = m.geometry.boundingBox; if (!bb) return;
      for (const c of [[bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.max.y, bb.max.z]]) { const v = m.localToWorld(new m.position.constructor(...c)); box.min = box.min.map((x, i) => Math.min(x, v.getComponent(i))); box.max = box.max.map((x, i) => Math.max(x, v.getComponent(i))); } });
    bounds = box; const w = g.getWorldPosition(new g.position.constructor()); gw = [w.x, w.y, w.z];
    window.__signPos = sign.getWorldPosition(new g.position.constructor());
    window.__glyphPos = w;
  }
  return { season: eco.state.season, demandTea: eco.demandOf('stall_tea'), glyph: sb.demandGlyphOf('stall_tea'), glyphVisible: g?.visible, glyphWorld: gw, signBounds: bounds, tint: sign?.userData?.priceTint };
});
console.log('STATE', JSON.stringify(info));
// frame the tea sign: camera 3.2 u in front of the sign (stall rot 0 → faces +z), slightly above, looking at the glyph
await p.evaluate(() => {
  const g = window.game, s = window.__signPos, t = window.__glyphPos || s;
  g.camera.update = () => { g.camera.cam.position.set(s.x + 1.6, s.y + 1.1, s.z + 3.0); g.camera.cam.lookAt(t.x, t.y - 0.1, t.z); };
  document.body.classList.add('ll-shot'); for (const el of document.querySelectorAll('.hud, .ll-hud, #hud')) el.style.opacity = '0.35';
});
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/44_hot_sign.png` });
console.log('shot', `${OUT}/44_hot_sign.png`);
// wide shot: default camera, let customers walk + react for a while → price / want bubbles
await p.evaluate(() => { location.reload(); });
await p.waitForTimeout(2200);
await p.evaluate(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.game.bus.emit('ui:start', { mode: 'story' }); await new Promise((r) => setTimeout(r, 800)); const sb = window.sb(); sb.eco.state.season = 2; for (const pl of sb.build.placed.values()) if (pl.category === 'stall' && !pl.scenery) sb.signTint(pl.id); });
let bubbles = 0;
for (let i = 0; i < 16 && bubbles === 0; i++) { await p.waitForTimeout(1500); bubbles = await p.evaluate(() => document.querySelectorAll('.bark, .ll-bark, [class*="bubble"]').length); }
await p.evaluate(() => { const g = window.game; g.camera.zoom = 0.75; });
await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/44_price_bubble.png` });
console.log('shot', `${OUT}/44_price_bubble.png`, 'bubbles seen:', bubbles);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'errors: none');
await b.close(); server.kill();
