// S85: Journal with 14 slots (11 scams + 3 fair) at W x H: meet 7 deals with mixed results, open it, screenshot (top + scrolled to the new stickers).
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const W = +process.argv[2] || 568, H = +process.argv[3] || 320;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 16; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.evaluate(() => { lg.verbs.skip(); const J = lg.sb.journal; const set = [['parcelFee', 'spotted'], ['fakeCharity', 'fell'], ['freeTrial', 'spotted'], ['fogLevy', 'refused'], ['bringAFriend', 'met'], ['zeroInterestLoan', 'fell'], ['quickFlip', 'spotted']];
  for (const [id, r] of set) { J.meet(id); if (r !== 'met') J.result({ id, accepted: r === 'fell', looked: r === 'spotted' }); } ui.journal.open(); });
await p.waitForTimeout(900);
console.log(await p.evaluate(() => JSON.stringify({ count: document.querySelector('.ll-journal-count')?.textContent, stickers: document.querySelectorAll('.ll-sticker').length, gridH: document.querySelector('.ll-journal-grid').clientHeight, scrollH: document.querySelector('.ll-journal-grid').scrollHeight })));
console.log(await p.evaluate(() => { const g = document.querySelector('.ll-journal-grid'), gs = getComputedStyle(g); return JSON.stringify({ rows: gs.gridTemplateRows, autoRows: gs.gridAutoRows, ac: gs.alignContent, st: [...document.querySelectorAll('.ll-sticker')].slice(0, 8).map(c => [c.dataset.id, Math.round(c.getBoundingClientRect().height), c.scrollHeight, Math.round(c.querySelector('.ll-sticker-body').scrollHeight)]) }); }));
await p.screenshot({ path: `tools/shots/s85_journal_${W}x${H}_a.png` });
await p.evaluate(() => { const g = document.querySelector('.ll-journal-grid'); g.scrollTop = 200; });
await p.waitForTimeout(300); await p.screenshot({ path: `tools/shots/s85_journal_${W}x${H}_b.png` });
await b.close();
