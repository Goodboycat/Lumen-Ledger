// S60-C/D: opening bubbles on phone landscape 844x390: line count per bubble + shots of each; then first play frame.  node tools/play_s60c.mjs
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:3000/index.html?touch=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 }); await p.waitForTimeout(2000);
await p.evaluate(() => ui.title.buttons.story.click());
await p.waitForFunction(() => ui.dialogue.isOpen, null, { timeout: 40000 });
const out = { bubbles: [] };
for (let i = 0; i < 8; i++) {
  if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.waitForTimeout(1300);
  const info = await p.evaluate(() => { const t = document.querySelector('.ll-dlg-text, .ll-dlg-body, .ll-dlg [class*=text]'); const L = ui.dialogue.line; const lh = t ? parseFloat(getComputedStyle(t).lineHeight) || 18 : 18; return { who: L?.speaker, idx: L?.index, text: L?.text, lines: t ? Math.round(t.getBoundingClientRect().height / lh) : null }; });
  out.bubbles.push(info); await p.screenshot({ path: `tools/shots/s60c_open${i + 1}.png` }); await p.keyboard.press('Enter');
}
await p.waitForTimeout(4500); await p.screenshot({ path: 'tools/shots/s60c_play.png' });
out.card = await p.evaluate(() => ui.tutor.current); out.errors = errs.slice(0, 5); console.log(JSON.stringify(out, null, 1)); await b.close();
