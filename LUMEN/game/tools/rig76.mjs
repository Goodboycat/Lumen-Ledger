// S76 shared rig: import { launch } from './rig76.mjs'; const { p, b, errs, W, H } = await launch(844, 390, 'extra=flags');
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/');
const { chromium } = require('playwright');
export async function launch(W = 844, H = 390, qs = '', opts = {}) {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'debug=1&nocine&mute' + (qs ? '&' + qs : ''), { waitUntil: 'load' });
  await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  return { p, b, errs, W, H };
}
export async function startStory(p, { skipDialogue = true } = {}) {
  await p.evaluate(() => ui.title.buttons.story.click());
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); const d = await p.evaluate(() => ui.dialogue.isOpen); if (d && skipDialogue) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
  await p.waitForTimeout(800);
}
export const shot = (p, name) => p.screenshot({ path: `/home/user/webapp/LUMEN/game/tools/shots/${name}.png` });
