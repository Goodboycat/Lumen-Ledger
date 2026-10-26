// Headless smoke test for ANY demo page. Run from game/ :
//   node tools/smoke.mjs demo_stalls.html            (needs: npx playwright install chromium — once)
//   node tools/smoke.mjs demo_stalls.html --keys 1,2,3 --shots --close
// Prints console errors, fps, draw calls, triangles, mesh count. Exit code 1 if any page error.
// Saves screenshots to tools/shots/<page>_<n>.png when --shots is given.
// If playwright is not installed: bash tools/setup_browser.sh  (once; if it prints FAILED, skip the browser smoke)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire(new URL('../tools/node_modules/', import.meta.url).href)('playwright')); } catch { console.error('playwright missing → bash tools/setup_browser.sh'); process.exit(2); } }

const page = process.argv[2] || 'index.html';
const keysArg = (process.argv.find((a) => a.startsWith('--keys')) || '').split('=')[1] || (process.argv.includes('--keys') ? process.argv[process.argv.indexOf('--keys') + 1] : '');
const keys = keysArg ? keysArg.split(',') : [];
const shots = process.argv.includes('--shots');
// --close  : after the key presses, zoom the Foundation camera in (game.camera.zoom = 0.8) and take one more
//            screenshot. Use it to prove detail on your assets (the default framing is far away).
const close = process.argv.includes('--close');
const port = 3123;

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
if (shots) mkdirSync('tools/shots', { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text()); });
p.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
p.on('requestfailed', (r) => errors.push('[404/failed] ' + r.url()));
await p.goto(`http://127.0.0.1:${port}/${page}`, { waitUntil: 'load' });
await p.waitForTimeout(1500);
const stats = () => p.evaluate(() => {
  const g = window.game; if (!g) return { note: 'window.game not set (expose it in your demo: window.game = game)' };
  let meshes = 0, outlines = 0; g.scene.traverse((x) => { if (x.isMesh) { if (x.userData.isOutline) outlines++; else meshes++; } });
  return { fps: g.stats.fps, drawCalls: g.stats.drawCalls, tris: g.stats.triangles, meshes, outlines };
});
console.log(`[${page}] load:`, await stats());
if (shots) await p.screenshot({ path: `tools/shots/${page.replace('.html', '')}_0.png` });
let n = 1;
for (const k of keys) {
  await p.keyboard.press(k.length === 1 ? (/\d/.test(k) ? 'Digit' + k : 'Key' + k.toUpperCase()) : k);
  await p.waitForTimeout(1200);
  console.log(`[${page}] after key ${k}:`, await stats());
  if (shots) await p.screenshot({ path: `tools/shots/${page.replace('.html', '')}_${n++}.png` });
}
if (close) {
  await p.evaluate(() => { const g = window.game; if (g && g.camera) g.camera.zoom = 0.8; });
  await p.waitForTimeout(900);
  if (shots) await p.screenshot({ path: `tools/shots/${page.replace('.html', '')}_close.png` });
  console.log(`[${page}] close-up:`, await stats());
}
await p.waitForTimeout(800);
console.log(`[${page}] final:`, await stats());
console.log(errors.length ? `ERRORS (${errors.length}):\n` + errors.join('\n') : 'ERRORS: none ✅');
await b.close(); server.kill();
process.exit(errors.length ? 1 : 0);
