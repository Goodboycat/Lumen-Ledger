// S64-A rig: double-tap through the LAST dialogue line, does the Build tray open by itself? (phone landscape)  node tools/play_s64.mjs [W H]
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s64_${W}_${n}.png` });
await p.goto('http://localhost:3000/index.html?touch=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 90000 }); await p.waitForTimeout(1500);
await p.evaluate(() => ui.title.buttons.story.click());
await p.waitForFunction(() => ui.dialogue.isOpen, null, { timeout: 60000 });
const lastLine = async (label) => {   // advance until ONE line is left (typing done), then tap-tap: close + a 2nd tap 120 ms later on the ground
  for (let i = 0; i < 30; i++) { const s = await p.evaluate(() => ({ o: ui.dialogue.isOpen, q: ui.dialogue.state.queue.length, t: ui.dialogue.isTyping })); if (!s.o) break; if (s.q === 0 && !s.t) break; await p.evaluate(() => ui.dialogue.advance()); await p.waitForTimeout(120); }
  await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); });   // closes
  await p.waitForTimeout(120);
  await p.touchscreen.tap(Math.round(W * 0.5), Math.round(H * 0.35));        // the 2nd, quick tap on the ground
  await p.waitForTimeout(500);
  const open = await p.evaluate(() => ui.build.isOpen); console.log(label, 'trayOpen =', open); return open;
};
await p.evaluate(() => { window.__grace = lg.tapGrace; });
await p.evaluate(() => { lg.tapGrace = () => false; });                    // trial 1: guard OFF (old behaviour)
const offOpen = await lastLine('guard OFF');
await shot('1_guard_off');
await p.evaluate(() => { ui.build.close(); lg.tapGrace = window.__grace; ui.dialogue.queue([{ speaker: 'owl', text: 'one' }, { speaker: 'owl', text: 'two' }]); });   // trial 2: guard ON
await p.waitForTimeout(800);
const onOpen = await lastLine('guard ON ');
await shot('2_guard_on');
console.log(JSON.stringify({ guardOff_trayOpened: offOpen, guardOn_trayOpened: onOpen, errors: errs.slice(0, 6) }));
await b.close();
