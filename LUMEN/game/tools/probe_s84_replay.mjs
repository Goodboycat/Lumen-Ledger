// S84: replay bug. play -> title -> play/continue again; is the tutor alive and does the speed button work?
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const mode = process.argv[2] || 'story'; const W = 844, H = 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true })).newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/index.html?touch=1&nocine&mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2000);
const snap = (tag) => p.evaluate((tag) => ({ tag, state: lg.state, paused: lg.game.paused, pauseBy: [...lg.pauseBy], speed: lg.speed, ts: lg.game.timeScale, hasSb: !!lg.sb, modal: ui.isModal?.(), tutorShown: String(ui.tutor?.current?.id ?? ui.tutor?.current ?? null), tutorVisible: String(ui.tutor?.visible), queued: JSON.stringify(ui.tutor?.queued)?.slice(0,80), seen: (ui.tutor?.seen || []).length, speedBtn: (() => { const e = document.querySelector('.ll-speed'); if (!e) return 'none'; const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { rect: [r.x | 0, r.y | 0, r.width | 0, r.height | 0], top: t && (t.className || t.tagName), disp: getComputedStyle(e).display, pe: getComputedStyle(e).pointerEvents }; })() }), tag);
const skipDlg = async (n = 24) => { for (let i = 0; i < n; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); } };
console.log(JSON.stringify(await snap('title0')));
await p.evaluate(() => ui.title.buttons.story.click()); await skipDlg(); await p.waitForTimeout(800);
console.log(JSON.stringify(await snap('play1')));
await p.evaluate(() => { ui.hud.root?.querySelector?.('.ll-speed')?.click(); }); await p.waitForTimeout(300);
console.log('after speed click1', await p.evaluate(() => lg.speed));
// quit to title via the same path as pause menu
await p.evaluate(() => lg.bus.emit('ui:title')); await p.waitForTimeout(1500);
console.log(JSON.stringify(await snap('title1')));
const which = mode;
await p.evaluate((w) => { const bt = ui.title.buttons; (w === 'continue' ? bt.continue : bt.story).click(); }, which); await skipDlg(); await p.waitForTimeout(1200);
console.log(JSON.stringify(await snap('play2-' + which)));
await p.evaluate(() => { document.querySelector('.ll-speed')?.click(); }); await p.waitForTimeout(300);
console.log('after speed click2', await p.evaluate(() => lg.speed));
const tut = await p.evaluate(() => ({ el: !!document.querySelector('.ll-tutor'), vis: [...document.querySelectorAll('[class*=tutor]')].map(e => e.className + ':' + getComputedStyle(e).display + ':' + (e.hidden ? 'H' : 'v')).slice(0, 8) }));
console.log(JSON.stringify(tut)); console.log('errs', errs.slice(0, 6));
await p.screenshot({ path: `tools/shots/s84_replay_${which}.png` }); await b.close();
