// S74: real-browser check. node tools/shot_s74_boss.mjs W H
// 1) story start -> HUD debt (1300) shot  2) jump to S6, spawn the Baron, sample his distance to Pip every 0.5 s (he must HUNT), shot
// 3) boss layer state via window.audio (headless-safe intent flags)  4) defeat him -> layer off.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/');
const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : ''), { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(1000);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 60; i++) { await p.waitForTimeout(400); const st = await p.evaluate(() => ({ c: lg.cine && lg.cine.active, d: ui.dialogue.isOpen })); if (st.d) await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); if (!st.c && !st.d && i > 8) break; }
await p.waitForTimeout(1500);
const s1 = await p.evaluate(() => ({ debt: lg.sb.eco.state.debt, maxLoan: lg.sb.eco.config.maxLoan, rate: lg.sb.eco.config.loanRate, season: lg.sb.eco.state.season, hud: (document.querySelector('.ll-hud, #hud') || {}).textContent?.replace(/\s+/g, ' ').slice(0, 160) }));
console.log('start', JSON.stringify(s1));
await p.screenshot({ path: `tools/shots/s74_start_${W}x${H}.png` });
// jump to S6 and drop the Baron next to the plaza
await p.evaluate(() => { try { ui.tutor.destroy && 0; } catch {} const sb = lg.sb, e = sb.eco; e.state.season = 6; e.state.spark = 200; sb.sched.wave = false; sb.sched.season = 6; sb.enemies.enabled = true; sb.enemies.waveSeason = 0; window.__ev = []; for (const n of ['enemy:wave', 'enemy:baronWarn', 'enemy:baronEnrage', 'enemy:defeated', 'enemy:dash', 'enemy:cannon']) lg.bus.on(n, (q) => window.__ev.push([n, q && q.kind || q && q.boss || 1, +(lg.sb.eco.state.day01).toFixed(2)])); sb.enemies.spawnWave(6); });
await p.waitForTimeout(500);
const samples = [];
for (let i = 0; i < 14; i++) {
  await p.waitForTimeout(500);
  samples.push(await p.evaluate(() => { const B = lg.sb.enemies.baron; if (!B) return null; const h = lg.sb.hero.root.position, q = B.g.position; return { d: +Math.hypot(h.x - q.x, h.z - q.z).toFixed(2), ph: B.phase, hp: B.hp, atk: B.attack && B.attack.kind || null }; }));
  if (i === 6) await p.screenshot({ path: `tools/shots/s74_baron_${W}x${H}.png` });
}
console.log('baron samples', JSON.stringify(samples.map(s => s && (s.d + ':' + s.ph + (s.atk ? '/' + s.atk : '')))));
const au = await p.evaluate(() => ({ layer: audio.state.currentLayer, pend: audio.state.pendingLayer, music: audio.state.currentMusic, ev: window.__ev }));
console.log('audio', JSON.stringify(au));
await p.evaluate(() => { const E = lg.sb.enemies, B = E.baron; for (let i = 0; i < 9 && E.baron; i++) E.hitEnemy(B, { x: 1, y: 0, z: 0, clone() { return this; } }, 1); });
await p.waitForTimeout(600);
const au2 = await p.evaluate(() => ({ layer: audio.state.currentLayer, baron: !!lg.sb.enemies.baron, defeats: lg.sb.enemies.stats.baronDefeats }));
console.log('after defeat', JSON.stringify(au2), 'errs', JSON.stringify(errs.slice(0, 6)));
await b.close();
