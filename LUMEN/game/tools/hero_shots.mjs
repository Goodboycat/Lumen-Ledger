// Close-up hero inspection shots (bug-fix helper). Run from game/:
//   NODE_PATH=tools/node_modules node tools/hero_shots.mjs [--attack]
// Loads demo_heromoves.html, moves the camera close to Pip and shoots front / side / back / top views → tools/shots/hero_*.png
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const port = 3125;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
mkdirSync('tools/shots', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://127.0.0.1:${port}/demo_heromoves.html`, { waitUntil: 'load' });
await p.waitForTimeout(1500);
// freeze the camera: override update to orbit around the hero
await p.evaluate(() => {
  const g = window.game; g.camera.offset.set(0, 0, 0);
  window.__setCam = (ax, ay, az, ty) => { g.camera.update = () => { const h = window.hero.root.position; g.camera.cam.position.set(h.x + ax, h.y + ay, h.z + az); g.camera.cam.lookAt(h.x, h.y + ty, h.z); }; };
  document.querySelectorAll('.panel,.hud,.help').forEach((e) => e.style.display = 'none');
});
const views = { front: [0, 1.4, 4.2, 1.0], side: [4.2, 1.4, 0, 1.0], back: [0, 1.4, -4.2, 1.0], top: [0, 5, 0.01, 0.8], iso: [3, 3.2, 3, 0.9] };
const tag = process.argv.includes('--attack') ? 'attack' : 'rest';
for (const [n, v] of Object.entries(views)) {
  await p.evaluate((v) => window.__setCam(...v), v);
  if (tag === 'attack') { await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space'); await p.waitForTimeout(parseInt(process.env.ATK_MS || '330')); }
  else await p.waitForTimeout(250);
  await p.screenshot({ path: `tools/shots/hero_${tag}_${n}.png` });
  if (tag === 'attack') await p.waitForTimeout(900);
}
console.log(errors.length ? 'ERRORS: ' + errors.join('\n') : 'shots ok');
await b.close(); server.kill();
