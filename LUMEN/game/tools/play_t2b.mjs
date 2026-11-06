// T2 browser walk test: real keyboard walking into a stall, event log with timestamps.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../tools/node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:3000/index.html?debug=1&nocine&notutorial', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => window.ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 25; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.evaluate(() => { window.__log = []; const t0 = performance.now(); for (const n of ['tutor:shown', 'tutor:dismissed', 'curious', 'curious:ping']) lg.bus.on(n, (e) => __log.push([Math.round(performance.now() - t0), n, e.id || e.hint || '', e.why || e.mode || ''])); });
const info = await p.evaluate(() => {
  const sb = lg.sb; sb.eco._addSpark(400, 'test'); if (sb.enemies) sb.enemies.enabled = false;
  const st = sb.build.stalls()[0]; const p0 = st.group.position; const hp = sb.hero.root.position;
  // D walks along (0.96, 0.29) on screen: this start passes ~1.5 u from the stall centre (inside its 2.4 radius, not through the wall)
  hp.set(p0.x - 8.1, 0, p0.z - 3.0); return { stall: st.id, at: [+p0.x.toFixed(2), +p0.z.toFixed(2)], hero: [hp.x, hp.z] };
});
console.log('setup', JSON.stringify(info)); if (info.err) { await b.close(); process.exit(1); }
await p.waitForTimeout(1200);
// let the placement card (onFirstStall) run, then walk east with the real D key
await p.evaluate(() => { __log.push([0, 'WALK-START', '', '']); });
await p.evaluate(() => { const st = lg.sb.build.stalls()[0].group.position; lg.sb.hero.root.position.set(st.x - 6, 0, st.z + 1.3); lg.sb.hero.vel?.set?.(0, 0, 0); });
await p.waitForTimeout(300);
await p.keyboard.down('d');
const trail = [];
for (let i = 0; i < 14; i++) { await p.waitForTimeout(200); trail.push(await p.evaluate(() => { const h = lg.sb.hero.root.position, st = lg.curiosity.get('stall:stall_fruit'); return [+h.x.toFixed(1), +h.z.toFixed(1), st ? +Math.hypot(h.x - st.x, h.z - st.z).toFixed(1) : null, st ? st.inside : null]; })); }
await p.keyboard.up('d');
console.log('trail [x,z,distToStall,inside]:', JSON.stringify(trail));
const pos = await p.evaluate(() => ({ hero: [lg.sb.hero.root.position.x, lg.sb.hero.root.position.z], thing: lg.curiosity.things().filter((t) => t.id.startsWith('stall')).map((t) => [t.id, +t.x.toFixed(2), +t.z.toFixed(2), t.radius, t.inside]) }));
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tools/shots/t2b_walk.png' });
console.log('setup', JSON.stringify(info)); console.log('pos', JSON.stringify(pos));
console.log((await p.evaluate(() => __log)).map((r) => r.join(' ')).join('\n'));
console.log('queued', await p.evaluate(() => JSON.stringify(ui.tutor.queued)), 'current', await p.evaluate(() => ui.tutor.current), 'errors', errs.length ? errs : 'none');
await b.close();
