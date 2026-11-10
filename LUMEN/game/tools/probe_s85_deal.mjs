// S85: open a new deal (arg: id) in a real browser, tap through look -> ask -> refuse with REAL taps, screenshot each step + the Cloud result chip.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const id = process.argv[2] || 'fogLevy', W = +process.argv[3] || 568, H = +process.argv[4] || 320, accept = process.argv[5] === 'accept';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
const skip = async () => { if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); };
for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); await skip(); }
await p.waitForTimeout(1500);
await p.evaluate((id) => { lg.verbs.skip(); lg.debug.season(5); lg.debug.grant(150); lg.sb.eco.offerScam(id, { by: 'stranger' }); }, id);
await p.waitForTimeout(1200);
const tapText = async (re) => { const r = await p.evaluate((re) => { const bs = [...document.querySelectorAll('.ll-dlg-choice')].filter(e => e.offsetParent && new RegExp(re, 'i').test(e.textContent)); const e = bs[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: e.textContent.trim().slice(0, 40) }; }, re); if (!r) return console.log('no button', re); await p.touchscreen.tap(r.x, r.y); console.log('tap', r.t); await p.waitForTimeout(700); };
const advance = async () => { if (await p.evaluate(() => ui.dialogue.isTyping)) { await p.evaluate(() => ui.dialogue.skip()); await p.waitForTimeout(250); return; } const r = await p.evaluate(() => { const e = document.querySelector('.ll-dlg'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 14 }; }); if (r) { await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(450); } };
await p.screenshot({ path: `tools/shots/s85_deal_${id}_1_${W}x${H}.png` });
await advance(); await p.screenshot({ path: `tools/shots/s85_deal_${id}_2_${W}x${H}.png` });
const state = () => p.evaluate(() => { const l = ui.dialogue.line || {}; return { open: ui.dialogue.isOpen, typing: ui.dialogue.isTyping, line: (l.text || '').slice(0, 50), ch: (l.choices || []).map(c => c.id).join(',') }; });
for (let i = 0; i < 30; i++) { const s = await state(); console.log(i, JSON.stringify(s)); if (!s.open) break;
  if (s.ch.includes('look') && !s.ch.includes('sign')) await tapText('read|see|let me|show|look|open|check'); else if (s.ch.includes('sign')) { await p.screenshot({ path: `tools/shots/s85_deal_${id}_3_${W}x${H}.png` }); await tapText(accept ? '^(pay|give|sign|join|send|take|buy|yes)' : 'which|what|who|how|check'); } else if (s.ch.includes('refuse')) { await tapText(accept ? '^(pay|give|sign|join)' : 'writing|books|no |check|first|invoice|price|selling|draw'); } else await advance(); }
await p.waitForTimeout(900);
await p.screenshot({ path: `tools/shots/s85_deal_${id}_4_${W}x${H}.png` });
console.log(await p.evaluate(() => JSON.stringify({ chips: [...document.querySelectorAll('.ll-chips .ll-chip')].map(c => c.className + ' | ' + c.textContent.trim()), spark: Math.round(lg.sb.eco.state.spark), journal: lg.sb.journal?.entries?.[Object.keys(lg.sb.journal.entries).pop()] })));
await b.close();
