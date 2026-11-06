// T2 browser: real mouse tap / hold on world things. node tools/play_t2c.mjs (server :3000)
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
await p.evaluate(() => { document.querySelector('.ll-sb-ok')?.click(); }); await p.waitForTimeout(400);
await p.evaluate(() => { window.__log = []; for (const n of ['tutor:shown', 'curious', 'jars:deposit', 'ui:tap:land']) lg.bus.on(n, (e) => __log.push([n, e.id || e.hint || e.jar || '', e.why || e.mode || ''].join(' '))); });
// screen position of a world point
const toScreen = (x, z) => p.evaluate(([x, z]) => { const cam = lg.game.camera.three || lg.game.camera; const el = lg.game.renderer.domElement; const v = new (lg.sb.hero.root.position.constructor)(x, 0.8, z).project(cam); const r = el.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, [x, z]);
const clear = async () => { await p.evaluate(() => { ui.tutor.dismiss('t'); __log.length = 0; }); await p.waitForTimeout(150); };
const out = {};
// 1. HOLD on the stall (hero far) → card, no tray
const st = await p.evaluate(() => { const s = lg.sb.build.stalls()[0].group.position; lg.sb.hero.root.position.set(s.x + 6, 0, s.z + 5); return { x: s.x, z: s.z }; });
await p.waitForTimeout(800); await clear();
let pt = await toScreen(st.x, st.z); await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(300);
out.holdStall = { log: await p.evaluate(() => __log.slice()), trayOpen: await p.evaluate(() => ui.build.isOpen) };
await p.screenshot({ path: 'tools/shots/t2c_hold_stall.png' });
// 2. short TAP on the stall → card (act: stall opens tray / select)
await clear(); await p.evaluate(() => { ui.build.close?.(); });
pt = await toScreen(st.x, st.z); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(400);
out.tapStall = { log: await p.evaluate(() => __log.slice()), trayOpen: await p.evaluate(() => ui.build.isOpen) };
// 3. jar: unlock+place Save far away, TAP → card AND auto-walk deposit; HOLD → card only, no walk
await p.evaluate(() => { ui.build.close?.(); lg.debug.unlockJar('save'); const sb = lg.sb; sb.eco._addSpark(100, 't'); const hp = sb.hero.root.position; hp.set(0, 0, 0);
  const c = sb.island.gridCells().filter((q) => Math.hypot(q.x - hp.x, q.z - hp.z) > 5 && Math.hypot(q.x - hp.x, q.z - hp.z) < 8).find((q) => sb.build.canPlace('jar_save', q.x, q.z, 0)); sb.build.place('jar_save', c.x, c.z, 0, { animate: false }); });
await p.waitForTimeout(800); await clear();
const jp = await p.evaluate(() => { const q = lg.sb.jarsWorld.get('save').position; return { x: q.x, z: q.z }; });
pt = await toScreen(jp.x, jp.z); await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(500);
out.holdJar = { log: await p.evaluate(() => __log.slice()), walking: await p.evaluate(() => !!lg.sb.autoWalk), save: await p.evaluate(() => lg.sb.eco.state.jars.save) };
await clear(); pt = await toScreen(jp.x, jp.z); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(9000);
out.tapJarWalk = await p.evaluate(() => ({ walking: !!lg.sb.autoWalk, hero: [lg.sb.hero.root.position.x, lg.sb.hero.root.position.z].map((v) => +v.toFixed(1)), eco: lg.sb.eco.state.spark }));
out.tapJar = { log: await p.evaluate(() => __log.slice()), save: await p.evaluate(() => lg.sb.eco.state.jars.save) };
await p.screenshot({ path: 'tools/shots/t2c_tap_jar.png' });
// 4. far Collector tap
await clear(); await p.evaluate(() => { const sb = lg.sb; sb.hero.root.position.set(0, 0, 0); sb.enemies.enabled = true; sb.enemies.waveSeason = null; sb.enemies.spawnWave(1); sb.enemies.enabled = false; });
await p.waitForTimeout(900); await clear();
const en = await p.evaluate(() => { const e = lg.curiosity.things().find((t) => t.id.startsWith('enemy:')); return e ? { x: e.x, z: e.z, d: Math.hypot(e.x, e.z) } : null; });
if (en) { pt = await toScreen(en.x, en.z); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(500); }
out.tapCollector = { en, log: await p.evaluate(() => __log.slice()) }; await p.screenshot({ path: 'tools/shots/t2c_collector.png' });
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
console.log('errors', errs.length ? errs.slice(0, 5) : 'none'); await b.close();
