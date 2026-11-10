// S84: reload bug. session 1 plays (autosave + tutor seen persisted), session 2 = same localStorage, press CONTINUE / PLAY.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const which = process.argv[2] || 'continue'; const extra = process.argv[3] || ''; const W = 844, H = 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text().slice(0, 200)); });
const url = 'http://localhost:3000/index.html?touch=1&mute' + extra;
const boot = async () => { await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500); };
const skipDlg = async (n = 24) => { for (let i = 0; i < n; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); } };
const snap = (tag) => p.evaluate((tag) => { const sp = document.querySelector('.ll-speed'); let sb = 'none'; if (sp) { const r = sp.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); sb = { rect: [r.x | 0, r.y | 0, r.width | 0, r.height | 0], top: t && (t.className || t.tagName), disp: getComputedStyle(sp).display, op: getComputedStyle(sp).opacity }; }
  return { tag, state: lg.state, paused: lg.game.paused, pauseBy: [...lg.pauseBy], speed: lg.speed, hasSb: !!lg.sb, resuming: !!lg._resuming, tutorCur: String(ui.tutor?.current?.id ?? null), tutorVis: String(ui.tutor?.visible), seen: JSON.stringify(ui.tutor?.seen), counts: JSON.stringify(ui.tutor?.counts), guideBlocked: String(lg.guideBlocked?.()), bodyCls: document.body.className, speedBtn: sb, ls: Object.keys(localStorage) }; }, tag);
await boot(); console.log('title a', JSON.stringify(await snap('t1')));
await p.evaluate(() => ui.title.buttons.story.click()); await skipDlg(); await p.waitForTimeout(1000);
console.log('play a', JSON.stringify(await snap('p1')));
await p.evaluate(() => { lg.save?.write?.(); }); await p.waitForTimeout(300);
console.log('ls after write', await p.evaluate(() => Object.keys(localStorage).map(k => k + ':' + localStorage[k].length)));
await boot(); console.log('title b', JSON.stringify(await snap('t2')));
await p.evaluate((w) => { const bt = ui.title.buttons; console.log(Object.keys(bt)); (bt[w] || bt.story).click(); }, which); await skipDlg(); await p.waitForTimeout(1500);
console.log('play b', JSON.stringify(await snap('p2-' + which)));
await p.screenshot({ path: `tools/shots/s84_reload_${which}.png` });
const r = await p.evaluate(() => { const sp = document.querySelector('.ll-speed'); if (!sp) return 'nobtn'; const rc = sp.getBoundingClientRect(); return { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2 }; });
console.log('speed pos', JSON.stringify(r));
if (r && r.x) { await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(500); console.log('speed after real tap', await p.evaluate(() => lg.speed)); }
console.log('errs', errs.slice(0, 6)); await b.close();
