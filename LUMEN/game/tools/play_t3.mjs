// T3 played in a real browser: hire the crew (debug), watch the pier walk-in, work + payoff pops, Ledger crew line.
//   node tools/play_t3.mjs [phone]   (server on :3000: cd game && python3 -m http.server 3000)
// NOTE sim stepping = every registered game system (sb.update lives there; lg.update alone only drives UI/story).
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const phone = process.argv[2] === 'phone', tag = phone ? 'phone' : 'desk';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:3000/index.html?debug=1&nocine&notutorial' + (phone ? '&touch=1' : ''), { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.screenshot({ path: `tools/shots/t3_${tag}_0_title.png` });
await p.evaluate(() => window.ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 25; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.evaluate(() => { document.querySelector('.ll-sb-ok')?.click(); window.__ev = []; for (const n of ['crew:arrive', 'crew:posted', 'crew:work', 'crew:payoff', 'crew:alert']) lg.bus.on(n, (e) => __ev.push(n + ':' + (e.type || '') + ':' + (e.text || ''))); });
await p.waitForTimeout(500);
const adv = (sec) => p.evaluate((n) => { const g = lg.game; for (let i = 0; i < Math.round(n / 0.1); i++) for (const s of g.systems) if (s.update) s.update(0.1, g, 0.1); }, sec);
await p.screenshot({ path: `tools/shots/t3_${tag}_1_start.png` });
await p.evaluate(() => { lg.debug.grant(900); lg.debug.unlockJar('save'); lg.debug.unlockJar('protect'); });
const res = await p.evaluate(() => ['tallyOwl', 'packMole', 'sparkBee', 'guardTortoise', 'scoutFox', 'gardenerSnail'].map((t) => lg.debug.hire(t).ok));
console.log('hired', res.join(','));
await adv(1.0); await p.screenshot({ path: `tools/shots/t3_${tag}_2_arriving.png` });
await adv(3.2); await p.screenshot({ path: `tools/shots/t3_${tag}_3_posted.png` });
await p.evaluate(() => { lg.sb.cust.spawnWave?.(1, 6); });
await adv(14); await p.screenshot({ path: `tools/shots/t3_${tag}_4_working.png` });
await adv(12); await p.screenshot({ path: `tools/shots/t3_${tag}_5_later.png` });
const out = await p.evaluate(() => { const s = {}; for (const e of __ev) { const k = e.split(':').slice(0, 2).join(':'); s[k] = (s[k] || 0) + 1; }
  return { counts: s, pops: __ev.filter((e) => e.startsWith('crew:payoff')).slice(0, 14), crew: lg.sb.helpers.map((h) => [h.type, h.job?.state, h.anim.current, +h.g.position.x.toFixed(1), +h.g.position.z.toFixed(1)]) }; });
console.log(JSON.stringify(out));
await p.evaluate(() => { lg.sb.eco.endSeason(); });
// the Baron collects first (state 'pier'); settle him like a player would, then the Ledger opens (state 'review')
for (let i = 0; i < 40 && (await p.evaluate(() => lg.state)) !== 'review'; i++) { await p.evaluate(() => { if (lg.state === 'pier') lg.sb.pier.settle?.('rig'); }); await adv(0.3); await p.waitForTimeout(300); }
// story lines (Baron, Owl) play before the Ledger: tap through them like a player until the Ledger is open
for (let i = 0; i < 80 && !(await p.evaluate(() => ui.ledger?.isOpen)); i++) { if (await p.evaluate(() => ui.dialogue.isOpen)) await p.keyboard.press('Enter'); await adv(0.2); await p.waitForTimeout(250); }
console.log('ledger open', await p.evaluate(() => !!ui.ledger?.isOpen)); await p.waitForTimeout(6500); await adv(0.1);
await p.screenshot({ path: `tools/shots/t3_${tag}_6_ledger.png` });
console.log('crewline', await p.evaluate(() => { const e = document.querySelector('#ll-ledger-crew'); return e ? JSON.stringify({ hidden: e.hidden, cls: e.className, txt: e.textContent }) : 'NONE'; }));
console.log('errors', JSON.stringify(errs.slice(0, 5)));
await b.close();
