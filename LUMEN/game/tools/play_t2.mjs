// T2 browser playtest: node tools/play_t2.mjs  (server on :3000). Screenshots → tools/shots/t2_*.png
import { createRequire } from 'node:module';
const require = createRequire(new URL('../tools/node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await p.goto('http://localhost:3000/index.html?debug=1&nocine&notutorial', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.waitForTimeout(1500);
const shot = (n) => p.screenshot({ path: `tools/shots/t2_${n}.png` });
await shot('0_title');
await p.evaluate(() => window.ui.title.buttons.story.click());
await p.waitForTimeout(2500);
// skip dialogue
for (let i = 0; i < 25; i++) { const open = await p.evaluate(() => window.ui.dialogue.isOpen); if (!open) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.waitForTimeout(500);
await shot('1_play');
// stall + walk
const info = await p.evaluate(() => {
  const sb = lg.sb; sb.eco._addSpark(400, 'test'); if (sb.enemies) sb.enemies.enabled = false;
  const placed = [...sb.build.placed.values()].map((e) => e.id);
  const sid = ['stall_fruit','stall_bread','stall_tea','stall_flower','stall_gem'].find((id) => sb.build.entry(id) && !sb.build.placeBlocker(id));
  if (!sid) return { err: 'no free stall type', placed };
  const hp = sb.hero.root.position;
  const cells = sb.island.gridCells().filter((q) => Math.hypot(q.x - hp.x, q.z - hp.z) > 4).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const c = cells.find((q) => sb.build.canPlace(sid, q.x, q.z, 0)); if (!c) return { err: 'no cell', sid, placed, n: cells.length };
  sb.build.place(sid, c.x, c.z, 0, { animate: false });
  sb.hero.root.position.set(c.x + 9, 0, c.z + 7); return { sid, c: [c.x, c.z], placed };
});
console.log('setup', JSON.stringify(info)); if (info.err) { await b.close(); process.exit(1); }
await p.waitForTimeout(1500);
await shot('2_far');
await p.evaluate((i) => { lg.sb.hero.root.position.set(i.c[0] + 1.8, 0, i.c[1] + 1.8); }, info);
await p.waitForTimeout(1500);
await shot('3_stall_card');
console.log('tutor current:', await p.evaluate(() => ui.tutor.current), '| text:', await p.evaluate(() => document.querySelector('.ll-tutor-txt')?.textContent));
// HUD tap
await p.evaluate(() => ui.tutor.dismiss('t'));
await p.click('#ll-hud .ll-spark-col'); await p.waitForTimeout(500); await shot('4_hud_pouch');
console.log('after pouch tap:', await p.evaluate(() => ui.tutor.current));
// pause -> guide
await p.keyboard.press('Escape'); await p.waitForTimeout(700); await shot('5_pause');
await p.click('.ll-pause-btn.guide'); await p.waitForTimeout(600); await shot('6_codex');
console.log('codex:', await p.evaluate(() => ui.guideCodex.count.textContent), 'open', await p.evaluate(() => ui.guideCodex.isOpen));
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
console.log('after Esc codex open:', await p.evaluate(() => ui.guideCodex.isOpen), 'pause open:', await p.evaluate(() => ui.pause.isOpen));
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
console.log('counts', JSON.stringify(await p.evaluate(() => ui.tutor.counts)));
console.log('errors:', errs.length ? errs.slice(0, 6) : 'none');
await b.close();
