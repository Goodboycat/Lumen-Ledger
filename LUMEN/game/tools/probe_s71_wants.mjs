// S71 probe: does the player SEE the want bubble / Owl 'nobody sells X' line? (real browser, phone landscape)
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/');
const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&autoplay&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
await p.waitForTimeout(800);
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
  const out = { barksMounted: !!ui.barks, barkEls: document.querySelectorAll('.ll-bark').length };
  const ev = []; lg.bus.on('story:bark', (q) => ev.push({ kind: q.kind, text: String(q.text).slice(0, 50) })); lg.bus.on('cust:want', (q) => ev.push({ want: q.want, found: q.found }));
  const sb = lg.sb; sb.eco.state.season = 3; sb.cust.season = 3;
  out.ev = ev; return out;
});
console.log(JSON.stringify({ ...r, errs }));
await b.close();
