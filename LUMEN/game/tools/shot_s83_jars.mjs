// S83: jars panel + deposit in real play. node tools/shot_s83_jars.mjs W H -> tools/shots/s83_jars_WxH.png
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 })).newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'nocine&mute&notutorial', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2000);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 24; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(800);
const r = await p.evaluate(() => { const e = lg.sb.eco; e.state.spark = 120; e.allocate({ save: 30, protect: 10 }); lg.sb.jarsWorld?.deposit?.('save', 10); for (const k of ['save', 'invest', 'protect']) ui.jars?.show?.(k); ui.jars?.setBalances?.({ ...e.state.jars }); ui.jars?.setCollapsed?.(false); ui.jars?.el?.classList?.remove('ll-staged'); return { jars: { ...e.state.jars }, panel: !!ui.jars?.el }; });
await p.waitForTimeout(1500);
await p.screenshot({ path: `tools/shots/s83_jars_${W}x${H}.png` });
console.log(JSON.stringify(r), 'errs', errs.slice(0, 3)); await b.close();
