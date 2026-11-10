// S86: accept freeTrial with REAL taps, end the season, screenshot the Ledger (subscription row) and the Cloud renewal chip after CONTINUE.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const W = +process.argv[2] || 568, H = +process.argv[3] || 320;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(1200);
await p.evaluate(() => { lg.verbs.skip(); lg.debug.season(4); lg.debug.grant(150); lg.sb.eco.offerScam('freeTrial', { by: 'stranger' }); });
await p.waitForTimeout(1200);
const tapText = async (re) => { const r = await p.evaluate((re) => { const bs = [...document.querySelectorAll('.ll-dlg-choice')].filter(e => e.offsetParent && new RegExp(re, 'i').test(e.textContent)); const e = bs[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: e.textContent.trim().slice(0, 40) }; }, re); if (!r) return console.log('no button', re); await p.touchscreen.tap(r.x, r.y); console.log('tap', r.t); await p.waitForTimeout(700); };
const advance = async () => { if (await p.evaluate(() => ui.dialogue.isTyping)) { await p.evaluate(() => ui.dialogue.skip()); await p.waitForTimeout(250); return; } const r = await p.evaluate(() => { const e = document.querySelector('.ll-dlg'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 14 }; }); if (r) { await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(450); } };
const state = () => p.evaluate(() => { const l = ui.dialogue.line || {}; return { open: ui.dialogue.isOpen, typing: ui.dialogue.isTyping, line: (l.text || '').slice(0, 50), ch: (l.choices || []).map(c => c.id + ':' + String(c.text || c.label || '').slice(0, 24)).join(' | ') }; });
for (let i = 0; i < 30; i++) { const s = await state(); console.log(i, JSON.stringify(s)); if (!s.open) break;
  if (/look:/.test(s.ch) && !/sign:/.test(s.ch)) await tapText('read|see|let me|show|look'); else if (/sign:/.test(s.ch)) { await p.screenshot({ path: `tools/shots/s86_sub_1_${W}x${H}.png` }); await tapText('^sign'); } else await advance(); }
await p.waitForTimeout(900);
console.log('subs', JSON.stringify(await p.evaluate(() => ({ subs: lg.sb.eco.state.subs, spark: Math.round(lg.sb.eco.state.spark), scamsAccepted: lg.sb.eco.ledger.scamsAccepted }))));
await p.evaluate(() => { window.__ev = []; for (const n of ['eco:subscription','ui:continue','ui:ledger:close','boon:picked','ui:boon']) lg.bus.on(n, (x) => window.__ev.push(n + ':' + JSON.stringify(x || {}).slice(0, 60))); });
await p.evaluate(() => { lg.sb.eco.state.debt = 0; lg.sb.eco.state.interestOwed = 0; lg.sb.eco.state.day01 = 0.999; });   // no debt -> pier:skip -> straight to the Ledger
for (let i = 0; i < 30; i++) { await p.waitForTimeout(1500); const s = await p.evaluate(() => ({ st: lg.state, pier: lg.sb.pier.phase, led: !!ui.ledger.isOpen, d: ui.dialogue.isOpen })); console.log('w', i, JSON.stringify(s)); if (s.led) break; if (s.d) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(3500);
console.log('ledger open', await p.evaluate(() => !!ui.ledger.isOpen), JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.ll-ledger-row')].filter(r => !r.classList.contains('hidden-zero')).map(r => r.textContent.trim()))));
await p.screenshot({ path: `tools/shots/s86_sub_2_ledger_${W}x${H}.png` });
// CONTINUE with a real tap (button), then the Cloud chip
const btn = await p.evaluate(() => { const e = document.querySelector('.ll-ledger button'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, dis: e.disabled }; }); console.log('btn', JSON.stringify(btn));
if (btn) { await p.touchscreen.tap(btn.x, btn.y); await p.waitForTimeout(1500); await p.screenshot({ path: `tools/shots/s86_sub_3_after_${W}x${H}.png` });
  // Boon Draft: pick a card with a REAL tap, then the chip should speak
  const card = await p.evaluate(() => { const e = document.querySelector('.ll-boon-card, .ll-boon, [class*=boon-card]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (card) { await p.touchscreen.tap(card.x, card.y); await p.waitForTimeout(600); const pick = await p.evaluate(() => { const e = [...document.querySelectorAll('.ll-boons-pick')].find(b => !b.disabled); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); if (pick) await p.touchscreen.tap(pick.x, pick.y); await p.waitForTimeout(1500); } else console.log('no boon card'); }
await p.screenshot({ path: `tools/shots/s86_sub_5_chip_${W}x${H}.png` });
console.log('events', JSON.stringify(await p.evaluate(() => window.__ev)));
console.log('chips', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.ll-chips .ll-chip')].map(c => c.dataset.id + ' | ' + c.textContent.trim()))));
await p.waitForTimeout(2500); await p.screenshot({ path: `tools/shots/s86_sub_4_${W}x${H}.png` });
console.log('errs', errs); await b.close();
