// S62-B rig: beginner shots of the build tray (Jars tab) + the placed jar, phone landscape.  node tools/play_s62b.mjs [W H]
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s62b_${W}x${H}_${n}.png` }); const out = { viewport: [W, H] };
await p.goto('http://localhost:3000/index.html?touch=1&nocine&debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 150000 }).catch((e) => { console.log('LOAD FAIL', JSON.stringify(errs.slice(0, 5))); process.exit(1); });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss?.('followed'); lg.debug?.grant?.(500); lg.debug?.unlockJar?.('save'); });
await p.waitForTimeout(900);
await p.evaluate(() => ui.build.open()); await p.waitForTimeout(600);
await p.evaluate(() => document.querySelector('.ll-build-tab[data-cat=jar]')?.click()); await p.waitForTimeout(700); await shot('1_jars_tab');
// emoji leak scan inside the tray + placing bar (font emoji instead of drawn icons)
out.emojiInTray = await p.evaluate(() => { const re = /\p{Extended_Pictographic}/u; return [...document.querySelectorAll('.ll-build *')].filter((e) => e.children.length === 0 && re.test(e.textContent || '')).map((e) => e.className + ':' + e.textContent.trim().slice(0, 20)).slice(0, 12); });
await p.evaluate(() => { ui.build.select?.('jar_save'); ui.build.deploy('jar_save'); }); await p.waitForTimeout(600);
out.emojiInPlacing = await p.evaluate(() => { const re = /\p{Extended_Pictographic}/u; return [...document.querySelectorAll('.ll-build-placing *')].filter((e) => e.children.length === 0 && re.test(e.textContent || '')).map((e) => e.textContent.trim()); });
await shot('2_placing');
await p.evaluate(() => { const b = lg.sb.build, hp = lg.sb.hero.root.position; for (const [dx, dz] of [[0,3],[3,0],[-3,0],[0,-3],[4,4],[-4,4]]) { if (b.moveTo(hp.x + dx, hp.z + dz)) break; } b.confirm(); }); await p.waitForTimeout(1500); await shot('3_placed');
out.after = await p.evaluate(() => ({ mode: lg.sb.build.mode, ghost: !!lg.sb.build.ghost, cur: ui.tutor.current }));
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
