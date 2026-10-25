// Browser probe #2: WHY does the stall visual stay at ud.level 1 after an upgrade in the real game (2026-10-24)?
// Run from game/ with the static server on :3000:   NODE_PATH=tools/node_modules node tools/qa_upgrade2.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
await p.goto('http://127.0.0.1:3000/index.html?notutorial&mute&nohistory&nocine&autoplay&season=150&seed=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.lg.sb && window.lg.state === 'playing', null, { timeout: 30000 });
await p.waitForTimeout(800);
for (let i = 0; i < 40; i++) { const open = await p.evaluate(() => !!window.ui?.dialogue?.isOpen); if (!open) break; await p.evaluate(() => window.ui.dialogue.advance()); await p.waitForTimeout(150); }
await p.evaluate(() => { window.lg.sb.eco.state.spark = 2000; window.lg.sb.game.bus.emit('eco:spark', { spark: 2000, delta: 0, reason: 'qa' }); });
const probe = (tag) => p.evaluate((tag) => {
  const sb = window.lg.sb; const e = [...sb.build.placed.values()].find((x) => x.id === 'stall_fruit'); const ud = e.group.userData;
  const seqs = sb.game.sequences; const active = seqs && (seqs.active || seqs.playing || seqs.list || seqs._active || seqs.items);
  return { tag, pauseBy: [...window.lg.pauseBy], dlg: !!window.ui?.dialogue?.isOpen, paused: sb.game.paused, time: +sb.game.time.toFixed(2), lvl: e.level, ud: ud.level, swapping: ud.swapping, pending: ud.pending && ud.pending.lvl, busy: sb.build.busy.has(e.group), bodyScaleY: +e.group.userData.body.scale.y.toFixed(2), activeSeqs: Array.isArray(active) ? active.length : (active instanceof Map || active instanceof Set ? active.size : typeof active), seqKeys: seqs ? Object.keys(seqs).slice(0, 10) : null, fps: window.lg.game.stats?.fps };
}, tag);
console.log(await probe('before'));
await p.evaluate(() => { const sb = window.lg.sb; const e = [...sb.build.placed.values()].find((x) => x.id === 'stall_fruit'); window.__r = sb.build.upgrade(e); });
console.log(await probe('t+0'));
await p.waitForTimeout(300); console.log(await probe('t+300'));
await p.waitForTimeout(1500); console.log(await probe('t+1800'));
await p.waitForTimeout(3000); console.log(await probe('t+4800'));
console.log('errors', errs.slice(0, 8));
await b.close();
