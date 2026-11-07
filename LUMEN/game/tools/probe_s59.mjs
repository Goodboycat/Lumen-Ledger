// S59 probe: event order + timing at the start of a story run (phone landscape).  node tools/probe_s59.mjs   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/index.html?debug=1&touch=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => { window.__t0 = performance.now(); window.__ev = []; const push = (n, e) => __ev.push(((performance.now() - __t0) / 1000).toFixed(2) + ' ' + n + ' ' + (e && (e.id || e.shot || e.why || '') || '') + ' cine=' + (lg.cine?.active || '-') + ' dlg=' + !!ui.dialogue.isOpen + ' tutor=' + (ui.tutor.current || '-'));
  for (const n of ['game:start', 'tutor:hint', 'tutor:shown', 'tutor:dismissed', 'cine:begin', 'cine:end', 'ui:dialogue:open', 'ui:dialogue:close', 'tut:step', 'tut:done']) lg.bus.on(n, (e) => push(n, e)); });
await p.evaluate(() => window.ui.title.buttons.story.click());
for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); if (i % 2 === 1 && await p.evaluate(() => ui.dialogue.isOpen)) await p.keyboard.press('Enter'); }
console.log((await p.evaluate(() => __ev)).join('\n'));
await b.close();
