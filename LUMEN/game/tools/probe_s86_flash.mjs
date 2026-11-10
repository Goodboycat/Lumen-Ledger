// S86: ledgerFlash on a NEW deal (arg id) with a REAL tap on the touch ability chip. Logs the answer, pendingOffer before/after, chips; screenshots.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const id = process.argv[2] || 'parcelFee', W = +process.argv[3] || 568, H = +process.argv[4] || 320;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(1200);
await p.evaluate((id) => { lg.verbs.skip(); lg.debug.season(6); lg.debug.grant(150); lg.debug.clearTutor?.(); try { lg.sb.unlocks.abilities.add('ledgerFlash'); lg.bus.emit('ability:unlock', { id: 'ledgerFlash' }); lg.syncAbilities(); ui.reveal?.revealAll?.({ quiet: true }); } catch (e) { console.log('unlock err', String(e)); } lg.sb.eco.offerScam(id, { by: 'stranger' }); }, id);
await p.waitForTimeout(800);
// close the dialogue so the offer stays pending (the flash is the alternative to talking)
await p.evaluate(() => { try { ui.dialogue.close?.(); ui.dialogue.hide?.(); } catch (e) {} });
await p.waitForTimeout(800);
console.log('pending', await p.evaluate(() => lg.sb.eco.pendingOffer && lg.sb.eco.pendingOffer.id), 'dlg', await p.evaluate(() => ui.dialogue.isOpen));
await p.evaluate(() => { window.__ev = []; for (const n of ['ability:fx', 'sandbox:ability:start', 'sandbox:denied', 'hud:answer', 'power:answer', 'scam:tell', 'eco:refuse', 'story:scamEnd']) lg.bus.on(n, (x) => window.__ev.push(n + ':' + JSON.stringify(x || {}).slice(0, 110))); });
console.log('dbg', JSON.stringify(await p.evaluate(() => { const e = document.querySelector('.ll-touch-ab[data-ability=ledgerFlash]'); const st = document.querySelector('.ll-touch-abilities'); return { chip: e && e.className, strip: st && st.className, stripDisp: st && getComputedStyle(st).display, chipDisp: e && getComputedStyle(e).display, touch: document.body.className, all: [...document.querySelectorAll('.ll-touch-ab')].map(x => x.dataset.ability + ':' + x.className) }; })));
const ab = await p.evaluate(() => { const e = document.querySelector('.ll-touch-ab[data-ability=ledgerFlash]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, vis: !!e.offsetParent }; }); console.log('ability chip', JSON.stringify(ab));
if (ab) { await p.touchscreen.tap(ab.x, ab.y); await p.waitForTimeout(700); await p.screenshot({ path: `tools/shots/s86_flash_${id}_1_${W}x${H}.png` }); await p.waitForTimeout(1800); await p.screenshot({ path: `tools/shots/s86_flash_${id}_2_${W}x${H}.png` }); }
console.log('events', JSON.stringify(await p.evaluate(() => window.__ev)));
console.log('after', JSON.stringify(await p.evaluate(() => ({ pending: lg.sb.eco.pendingOffer && lg.sb.eco.pendingOffer.id, chips: [...document.querySelectorAll('.ll-chips .ll-chip')].map(c => c.dataset.id + '|' + c.textContent.trim()), answer: [...document.querySelectorAll('[class*=answer]')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 3) }))));
console.log('errs', errs); await b.close();
