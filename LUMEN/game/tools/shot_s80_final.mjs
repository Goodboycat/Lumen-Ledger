// S80 FINAL shots: title, play, shop tray, crew tab (Cloud card), ledger, boss banner.  node tools/shot_s80_final.mjs W H
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/index.html?touch=1&nocine&mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(3500);
const S = (n) => p.screenshot({ path: `tools/shots/s80_final_${n}_${W}x${H}.png` });
await S('1_title');
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(1500); await S('2_play');
await p.evaluate(() => { lg.debug.grant?.(400); ui.build.open(); }); await p.waitForTimeout(900); await S('3_tray'); console.log('tray', JSON.stringify(await p.evaluate(() => { const g = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.height)]; }; return { tray: g('.ll-build'), tray2: g('.ll-build-tray'), grid: g('.ll-build-grid'), detail: g('.ll-build-detail'), foot: g('.ll-build-foot'), spark: g('.ll-spark'), cls: document.querySelector('.ll-build')?.className, hasDetail: document.querySelector('.ll-build-tray')?.className, body: document.body.className }; })));
await p.evaluate(() => { lg.debug.hire?.('cloud'); });   // so the card shows owned? (hire only after we shoot the unowned card first)
await p.evaluate(() => { for (const t of document.querySelectorAll('.ll-build-tab')) if (t.dataset.cat === 'crew') t.click(); }); await p.waitForTimeout(700);
await p.evaluate(() => { const g = document.querySelector('.ll-build-grid'); const c = [...g.querySelectorAll('.ll-card')].find(e => /Cloud/.test(e.textContent)); if (c) g.scrollTop = c.offsetTop - g.offsetTop - 4; }); await p.waitForTimeout(400); await S('4_crew');
await p.evaluate(() => ui.build.close?.()); await p.waitForTimeout(400);
await p.evaluate(() => { lg.sb.eco.state.debt = 300; ui.wave.show('BARON GILT IS COMING FOR HIS INTEREST!', { kind: 'boss', duration: 60 }); }); await p.waitForTimeout(600); await S('5_boss'); await p.evaluate(() => ui.wave.hide());
await p.evaluate(() => { const r = lg.sb.eco.endSeason?.(); window.__rep = r; if (!ui.ledger.isOpen) ui.ledger.show(r || {}); }); await p.waitForTimeout(3500);
const led = await p.evaluate(() => ui.ledger.isOpen); console.log('ledger open', led); await S('6_ledger');
console.log('errs', errs.slice(0, 4)); await b.close();
