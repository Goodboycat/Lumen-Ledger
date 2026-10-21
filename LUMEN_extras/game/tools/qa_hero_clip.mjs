// Arm/sword ↔ torso clipping QA (bug-fix helper). Run from game/:  NODE_PATH=tools/node_modules node tools/qa_hero_clip.mjs
// Loads demo_heromoves.html and samples idle, walk and the full sword attack every frame. For each sample it measures how deep the
// hands (spheres) and sword blade (box corners) go INSIDE the chest box (torso-local, 0.62 × 0.62 × 0.46). Prints the worst depth.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const port = 3126;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 600, height: 600 } });
await p.goto(`http://127.0.0.1:${port}/demo_heromoves.html`, { waitUntil: 'load' });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const h = window.hero, P = h.p, T = h.root.constructor; // THREE.Group ctor → get Vector3 / Matrix4 via existing objects
  const V3 = P.chest.position.constructor, M4 = P.chest.matrixWorld.constructor;
  const hx = 0.31, hy = 0.31, hz = 0.23;                // chest half extents (G.rbox(0.62,0.62,0.46)), centre = chest.position
  const inv = new M4(), v = new V3();
  const depthIn = (pt, r) => { // penetration of a sphere (pt, r) into the chest box, in chest-local space (0 = clear)
    v.copy(pt).applyMatrix4(inv);
    const dx = hx + r - Math.abs(v.x), dy = hy + r - Math.abs(v.y), dz = hz + r - Math.abs(v.z);
    return dx > 0 && dy > 0 && dz > 0 ? Math.min(dx, dy, dz) : 0;
  };
  window.__clip = { worst: { hand: 0, sword: 0 }, where: {}, per: {} };
  window.__sample = (tag) => {
    h.root.updateMatrixWorld(true); inv.copy(P.chest.matrixWorld).invert();
    const W = window.__clip; const per = (W.per[tag] ||= { hand: 0, sword: 0, handFrame: '', swordFrame: '' }); const st = (k, d, extra) => { if (d > per[k]) { per[k] = d; per[k + 'Frame'] = extra + ' t=' + (performance.now() - (window.__t0 || 0)).toFixed(0) + ' armR=' + P.armR.rotation.toArray().slice(0, 3).map((x) => x.toFixed(2)).join(',') + ' torso=' + P.torso.rotation.toArray().slice(0, 3).map((x) => x.toFixed(2)).join(',') + ' sword=' + h.sword.rotation.toArray().slice(0, 3).map((x) => x.toFixed(2)).join(','); } };
    for (const hand of [P.handL, P.handR]) { const d = depthIn(hand.getWorldPosition(new V3()), 0.14 * 0.9); st('hand', d, hand === P.handL ? 'L' : 'R'); if (d > W.worst.hand) { W.worst.hand = d; W.where.hand = tag; } }
    const blade = h.sword.getObjectByName('blade');
    if (h.sword.visible) for (const y of [-0.47, -0.2, 0.1, 0.47]) for (const x of [-0.07, 0.07]) {
      const d = depthIn(blade.localToWorld(new V3(x, y, 0)), 0.02); st('sword', d, 'blade y' + y); if (d > W.worst.sword) { W.worst.sword = d; W.where.sword = tag; } }
    // grip / guard
    for (const y of [0, 0.18]) { const d = depthIn(h.sword.localToWorld(new V3(0, y, 0)), 0.05); if (d > W.worst.sword) { W.worst.sword = d; W.where.sword = tag + ' (grip)'; } }
  };
  const g = window.game; g.add({ lateUpdate: () => window.__sample(window.__tag || 'idle') });   // after the hero's clearance solver = what gets rendered
});
await p.evaluate(() => (window.__tag = 'idle')); await p.waitForTimeout(1200);
await p.evaluate(() => (window.__tag = 'walk')); await p.keyboard.down('KeyD'); await p.waitForTimeout(1200); await p.keyboard.up('KeyD');
await p.evaluate(() => { window.__tag = 'attack'; window.__t0 = performance.now(); });
for (let i = 0; i < 3; i++) { await p.keyboard.down('Space'); await p.waitForTimeout(50); await p.keyboard.up('Space'); await p.waitForTimeout(900); }
for (let d = 1; d <= 9; d++) { await p.evaluate((d) => { window.__tag = 'move' + d; }, d); await p.keyboard.press('Digit' + d); await p.waitForTimeout(1800); }
const r = await p.evaluate(() => window.__clip);
const f = (x) => x.toFixed(3);
if (process.argv.includes('-v')) for (const [k, v] of Object.entries(r.per)) console.log(k.padEnd(7), 'hand', f(v.hand), v.handFrame, '\n        sword', f(v.sword), v.swordFrame);
console.log(`hand  max depth into chest: ${f(r.worst.hand)} u ${r.where.hand ? '(' + r.where.hand + ')' : ''}`);
console.log(`sword max depth into chest: ${f(r.worst.sword)} u ${r.where.sword ? '(' + r.where.sword + ')' : ''}`);
console.log(r.worst.hand < 0.02 && r.worst.sword < 0.02 ? 'CLIP OK' : 'CLIP FAIL');
await b.close(); server.kill();
