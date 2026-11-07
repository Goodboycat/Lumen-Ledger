// S62-B desktop half: placing bar on 1280x720 (mouse).  node tools/play_s62c.mjs
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s62c_desk_${n}.png` }); const out = {};
await p.goto('http://localhost:3000/index.html?nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 150000 }).catch(() => { console.log('LOAD FAIL', JSON.stringify(errs.slice(0, 5))); process.exit(1); });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss?.('followed'); lg.sb.eco._addSpark?.(400, 'test'); lg.debug?.unlockJar?.('save'); });
await p.waitForTimeout(800);
await p.evaluate(() => { ui.build.open(); }); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('.ll-build-tab[data-cat=jar]')?.click()); await p.waitForTimeout(500); await shot('1_tray');
await p.evaluate(() => { ui.build.select?.('jar_save'); ui.build.deploy('jar_save'); }); await p.waitForTimeout(500); await shot('2_placing');
out.keyHints = await p.evaluate(() => [...document.querySelectorAll('.ll-keyhint, .ll-key')].map((e) => ({ t: e.textContent, shown: getComputedStyle(e).display !== 'none' })));
// real mouse click on the ground = place, then must be idle
const hp = await p.evaluate(() => { const h = lg.sb.hero.root.position, c = lg.game.camera.three; const v = h.clone(); v.z += 3; v.project(c); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; });
await p.mouse.move(hp.x, hp.y); await p.waitForTimeout(300); await p.mouse.click(hp.x, hp.y); await p.waitForTimeout(1200); await shot('3_placed');
out.after = await p.evaluate(() => ({ mode: lg.sb.build.mode, ghost: !!lg.sb.build.ghost, jar: !!lg.sb.build.owned('jar_save') }));
// click again on another ground spot: must NOT place anything
const n0 = await p.evaluate(() => lg.sb.build.placed.size); await p.mouse.click(hp.x + 140, hp.y + 40); await p.waitForTimeout(500);
out.extraPlaced = (await p.evaluate(() => lg.sb.build.placed.size)) - n0;
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
