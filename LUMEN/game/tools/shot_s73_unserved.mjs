// S73: real-browser check of the 'customers left empty-handed' BUILD card. node tools/shot_s73_unserved.mjs W H
// Jump to S3 with the 3 starter stalls, spawn a wave, wait for cust:unserved (6 walk-aways) -> blue card pointing at BUILD.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/');
const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(1000);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 60; i++) { await p.waitForTimeout(400); const st = await p.evaluate(() => ({ c: lg.cine && lg.cine.active, d: ui.dialogue.isOpen })); if (st.d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); if (!st.c && !st.d && i > 8) break; }
await p.evaluate(() => { window.__ev = []; lg.bus.on('cust:unserved', (q) => window.__ev.push(q)); lg.bus.on('tutor:shown', (q) => window.__ev.push({ shown: q.id, t: Math.round(performance.now() / 100) / 10, blocked: !!lg.guideBlocked?.() })); lg.bus.on('tutor:dismissed', (q) => window.__ev.push({ gone: q.id, why: q.why })); lg.sb.enemies && (lg.sb.enemies.enabled = false); lg.debug.season(3); });
for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); const st = await p.evaluate(() => ({ d: ui.dialogue.isOpen, ev: window.__ev.length })); if (st.d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); if (i % 6 === 5) await p.evaluate(() => lg.debug.wave && lg.sb.cust.spawnWave(3, 10)); if (st.ev) break; }
await p.waitForTimeout(800);
let shot = false;
for (let k = 0; k < 8; k++) { const cur = await p.evaluate(() => ui.tutor.current); if (cur === 'cust:unserved') { await p.waitForTimeout(1200); await p.screenshot({ path: `tools/shots/s73_unserved_${W}x${H}.png` }); shot = true; break; } if (cur) await p.evaluate(() => ui.tutor.dismiss('rig')); await p.waitForTimeout(900); }   // the rig skipped S1: a stale verb card is up; the urgent card was queued behind it and now shows
await p.waitForTimeout(1800);
const r = await p.evaluate(() => ({ ev: window.__ev, season: lg.sb.eco.state.season, cur: ui.tutor.current, queued: ui.tutor.queued, card: (document.querySelector('.ll-tutor') || {}).textContent || null }));
console.log(JSON.stringify({ r, errs: errs.slice(0, 5) }));
if (!shot) await p.screenshot({ path: `tools/shots/s73_unserved_${W}x${H}.png` });
await b.close();
