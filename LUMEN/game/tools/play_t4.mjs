// T4 played in a real browser: a stranger walks in from the pier, bell marker / edge arrow, sword whiff + owl line, talk opens the deal.
//   node tools/play_t4.mjs [phone|desk]   (server on :3000: cd game && python3 -m http.server 3000)   phone = 844x390 landscape touch
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const phone = process.argv[2] !== 'desk', tag = phone ? 'phone' : 'desk';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:3000/index.html?debug=1&nocine&notutorial' + (phone ? '&touch=1' : ''), { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => window.ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 25; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.evaluate(() => { document.querySelector('.ll-sb-ok')?.click(); window.__ev = []; for (const n of ['scam:npc', 'scam:whiff', 'scam:leave', 'eco:fair', 'eco:scam', 'story:bark']) lg.bus.on(n, (e) => __ev.push(n + ':' + (e?.kind || '') + ':' + (e?.text || e?.id || ''))); });
await p.waitForTimeout(500);
const adv = (sec) => p.evaluate((n) => { const g = lg.game; for (let i = 0; i < Math.round(n / 0.1); i++) { for (const s of g.systems) if (s.update) s.update(0.1, g, 0.1); lg.ui?.update?.(0.1); } ui.update(0.1); }, sec);
const shot = (n) => p.screenshot({ path: `tools/shots/t4_${tag}_${n}.png` });
await shot('0_start');
// 1) a stranger from the debug panel hook (same path the scheduler uses) — right after the pier walk-in: marker should be an arrow or a bell
console.log('spawn', JSON.stringify(await p.evaluate(() => lg.debug.stranger('fair'))));
await adv(0.6); await shot('1_arriving');
console.log('marker', await p.evaluate(() => ({ shown: ui.stranger.shown, bell: ui.stranger.bell.style.display, arrow: ui.stranger.arrow.style.display, state: lg.sb.scamNpc.state, model: lg.sb.scamNpc.g.userData.type })));
await adv(3.0); await shot('2_plaza');
console.log('marker2', await p.evaluate(() => ({ shown: ui.stranger.shown, state: lg.sb.scamNpc.state, pos: [lg.sb.scamNpc.g.position.x.toFixed(1), lg.sb.scamNpc.g.position.z.toFixed(1)], hero: [lg.sb.hero.root.position.x.toFixed(1), lg.sb.hero.root.position.z.toFixed(1)] })));
// 2) walk Pip next to them and swing the sword 3 times → whiff + owl "Not an enemy"
await p.evaluate(() => { const N = lg.sb.scamNpc; lg.sb.hero.root.position.set(N.g.position.x + 1.4, 0, N.g.position.z + 0.4); });
await adv(0.8); await shot('3_near');
await p.evaluate(() => { for (let i = 0; i < 3; i++) lg.bus.emit('combat:miss', { combo: i }); }); await adv(0.5); await p.waitForTimeout(300); await shot('4_whiff');
console.log('whiff', JSON.stringify(await p.evaluate(() => ({ whiffs: lg.sb.scamNpc.stats.whiffs, state: lg.sb.scamNpc.state, bark: [...document.querySelectorAll('.ll-bark')].map((e) => e.textContent) }))));
// 3) talk (E / interact) → the deal dialogue opens
console.log('interact', await p.evaluate(() => lg.sb.interact())); await adv(0.3); await p.waitForTimeout(600); await shot('5_talk');
console.log('dialogue', await p.evaluate(() => ({ open: ui.dialogue.isOpen, text: document.querySelector('.ll-dlg-text, .ll-dialogue')?.textContent?.slice(0, 160) })));
console.log('events', JSON.stringify(await p.evaluate(() => __ev.slice(0, 12))));
console.log('errors', JSON.stringify(errs.slice(0, 6)));
await b.close();
