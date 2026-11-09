// S79: Cloud pet close-up at 3x. node tools/shot_s79_cloud.mjs W H tag
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const [W, H, tag] = [+process.argv[2] || 844, +process.argv[3] || 390, process.argv[4] || 'a'];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&debug=1&nocine&mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(800);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.evaluate(() => { lg.debug.hire('cloud'); try { lg.sb.enemies.enabled = false; } catch {} });
await p.waitForTimeout(1500);
await p.evaluate(() => { const h = lg.sb.helpers.find(x => x.type === 'cloud'); h.job.state = 'follow'; h.job.path = []; h.anim.play('idle'); const hp = lg.sb.hero.root.position; h.g.position.set(hp.x - 1.2, 0, hp.z); });
await p.waitForTimeout(4000);
const info = await p.evaluate(() => { const h = lg.sb.helpers.find(x => x.type === 'cloud'); const c = h.g.position, hp = lg.sb.hero.root.position; return { cloud: [c.x, c.y, c.z].map(n => +n.toFixed(2)), pip: [hp.x, hp.y, hp.z].map(n => +n.toFixed(2)), job: h.job, dist: +Math.hypot(c.x - hp.x, c.z - hp.z).toFixed(2) }; });
console.log(JSON.stringify(info));
const pos = await p.evaluate(() => { const h = lg.sb.helpers.find(x => x.type === 'cloud'); const v = h.g.position.clone(); v.y += 0.45; v.project(lg.game.camera.three); const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left + (v.x * .5 + .5) * r.width, y: r.top + (-v.y * .5 + .5) * r.height }; });
console.log('cloud screen', JSON.stringify(pos));
const cw = 150, ch = 110;
await p.screenshot({ path: `tools/shots/s79_cloud_${tag}_crop.png`, clip: { x: Math.max(0, pos.x - cw / 2), y: Math.max(0, pos.y - ch / 2 - 10), width: cw, height: ch } });
console.log('errs', JSON.stringify(errs.slice(0, 4))); await b.close();
