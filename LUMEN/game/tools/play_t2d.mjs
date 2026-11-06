// T2.2 / T2.3 played in a real browser: leave+return re-shows (max 3), two triggers queue, doing the action retires. node tools/play_t2d.mjs (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('../tools/node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:3000/index.html?debug=1&nocine&notutorial', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => window.ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 25; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.evaluate(() => { document.querySelector('.ll-sb-ok')?.click(); window.__log = []; lg.bus.on('tutor:shown', (e) => __log.push(e.id + ':' + (e.mode || ''))); });
await p.waitForTimeout(400);
const st = await p.evaluate(() => { const s = lg.sb.build.stalls()[0].group.position; return { x: s.x, z: s.z }; });
const goto = (dx, dz) => p.evaluate(([x, z]) => lg.sb.hero.root.position.set(x, 0, z), [st.x + dx, st.z + dz]);
const adv = (sec) => p.evaluate((n) => { for (let i = 0; i < Math.round(n / 0.1); i++) { lg.update(0.1); ui.update(0.1); } }, sec);
const out = {};
// T2.2: leave + return (repeatGap 12 s per card) → stall:any shows again, max 3 visits, then never
const shown = [];
for (let k = 0; k < 4; k++) {
  await goto(9, 7); await adv(14);
  await p.evaluate(() => { ui.tutor.dismiss('t'); __log.length = 0; });
  await goto(1.2, 1.2); await adv(2.6);
  shown.push(await p.evaluate(() => __log.filter((x) => x.startsWith('stall:any')).length));
  console.log(' visit', k, await p.evaluate(() => ({ log: __log.slice(), n: ui.tutor.counts['stall:any'], blocked: !!lg.tutorBlocked?.(), cur: ui.tutor.current })));
}
out.reshowPerVisit = shown;               // expect [1,1,1,0]
await p.screenshot({ path: 'tools/shots/t2d_card.png' });
// T2.3: two different triggers 300 ms apart → both shown, in order, none dropped
await goto(9, 7); await p.waitForTimeout(500);
await p.evaluate(() => { ui.tutor.dismiss('t'); __log.length = 0; lg.bus.emit('curious', { id: 'hud:a', hint: 'hud:pouch', why: 'approach' }); lg.bus.emit('curious', { id: 'hud:b', hint: 'hud:season', why: 'approach' }); });
await adv(0.5); out.t23_after500ms = await p.evaluate(() => ({ cur: ui.tutor.current?.id ?? null, queued: (() => { const q = ui.tutor.queued; return typeof q === 'function' ? q() : (q && q.length != null ? q.length : q); })() }));
console.log(' t23', await p.evaluate(() => ({ counts: { pouch: ui.tutor.counts['hud:pouch'], season: ui.tutor.counts['hud:season'] }, cards: ui.tutor.cardIds?.().filter((x) => x.startsWith('hud')) }))); await adv(14); out.t23_order = await p.evaluate(() => __log.slice());
console.log(JSON.stringify(out), 'errors', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
