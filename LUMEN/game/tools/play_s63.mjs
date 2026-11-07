// S63-A/B rig (phone landscape): a TAP on a jar = ONE deposit (no stuck hold) · a Stranger talks from ~3 u after a short stop.  node tools/play_s63.mjs [W H]  (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s63_${W}x${H}_${n}.png` }); const out = { viewport: [W, H] };
await p.goto('http://localhost:3000/index.html?touch=1&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss?.('followed'); lg.debug?.grant?.(500); });
await p.waitForTimeout(800);
// ---- A: place the Spend jar beside Pip, tap it, stand there 3 s
await p.evaluate(() => { ui.build.open(); }); await p.waitForTimeout(400);
await p.evaluate(() => { ui.build.select?.('jar_spend'); ui.build.deploy('jar_spend'); }); await p.waitForTimeout(400);
out.placed = await p.evaluate(() => { const b = lg.sb.build, hp = lg.sb.hero.root.position; for (const [dx, dz] of [[2,0],[-2,0],[0,2],[0,-2],[3,3],[-3,3],[3,-3],[-3,-3],[5,0],[-5,0]]) { if (b.moveTo) b.moveTo(hp.x + dx, hp.z + dz); if (b.valid !== false && b.confirm()) return true; } return false; });
await p.waitForTimeout(700);
out.jars = await p.evaluate(() => lg.sb.jarsWorld.ids());
const ev = await p.evaluate(() => { window.__ev = { dep: 0, wd: 0 }; lg.bus.on('jars:deposit', () => window.__ev.dep++); lg.bus.on('jars:withdraw', () => window.__ev.wd++); return 1; });
// walk Pip onto the jar then TAP it (landTap path = what a finger does)
out.tap = await p.evaluate(() => { const J = lg.sb.jarsWorld, id = J.ids()[0]; if (!id) return 'nojar'; const m = J.get(id), hp = lg.sb.hero.root.position; hp.set(m.position.x + 0.8, 0, m.position.z); lg.sb.hero.vel?.set?.(0, 0, 0); lg.sb.jarsWorld.update(0.016); return { id, near: J.near(), tapped: lg.landTap({ x: m.position.x, z: m.position.z }) }; });
await p.waitForTimeout(3000);
out.afterTap3s = await p.evaluate(() => ({ ...window.__ev, holding: lg.sb.jarsWorld.holding, spark: Math.round(lg.eco?.state?.spark ?? lg.sb.eco.state.spark) }));
await shot('a_jar_after_tap');
// ---- B: stranger talk from ~3 u, stop 0.3 s
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); });
const sp = await p.evaluate(() => lg.debug.stranger('fair')); out.strangerSpawned = sp;
await p.waitForFunction(() => lg.sb.scamNpc.state === 'pitch', null, { timeout: 30000 }).catch(() => {});
out.state = await p.evaluate(() => lg.sb.scamNpc.state);
const dist = await p.evaluate(() => { const g = lg.sb.scamNpc.g.position, h = lg.sb.hero.root.position, d = Math.hypot(g.x - h.x, g.z - h.z); const k = 3.0 / (d || 1); if (d > 3.0) h.set(g.x + (h.x - g.x) * k, 0, g.z + (h.z - g.z) * k); return Math.hypot(g.x - h.x, g.z - h.z); });
out.talkDist = +dist.toFixed(2); await shot('b_before_talk');
await p.waitForTimeout(700);
out.afterTalk = await p.evaluate(() => ({ npcState: lg.sb.scamNpc.state, dialogue: ui.dialogue.isOpen, pending: !!lg.sb.eco.pendingOffer }));
await shot('b_talk_opened');
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
