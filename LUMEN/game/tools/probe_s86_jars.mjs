// S86: Jars panel at phone landscape: rect of the panel, rows visible, rects of the touch buttons / ability strip under it.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const W = +process.argv[2] || 568, H = +process.argv[3] || 320, tag = process.argv[4] || 'a';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
await p.goto('http://localhost:3000/index.html?touch=1&mute&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.waitForTimeout(1200);
await p.evaluate(() => { lg.verbs.skip(); lg.debug.season(6); lg.debug.grant(150); try { for (const j of ['save', 'invest', 'protect']) lg.debug.unlockJar?.(j); ui.reveal?.revealAll?.({ quiet: true }); for (const j of ['save','invest','protect']) ui.jars.show(j); ui.jars.setCollapsed(false); lg.sb.unlocks.abilities.add('ledgerFlash'); lg.syncAbilities(); lg.sb.eco.state.debt = 80; } catch (e) { console.log('err', String(e)); } });
await p.waitForTimeout(1500);
console.log('dbg', JSON.stringify(await p.evaluate(() => { const j = document.querySelector('.ll-jars'); return j && { cls: j.className, disp: getComputedStyle(j).display, vis: getComputedStyle(j).visibility, rows: [...j.querySelectorAll('.ll-jar')].map(e => e.className + ':' + getComputedStyle(e).display), body: document.body.className, state: lg.state }; })));
const m = await p.evaluate(() => { const R = (e) => { if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const j = document.querySelector('.ll-jars'); const rows = [...document.querySelectorAll('.ll-jars .ll-jar')].filter(e => e.offsetParent).map(e => R(e));
  return { jars: R(j), maxH: j && getComputedStyle(j).maxHeight, scrollH: j && j.scrollHeight, clientH: j && j.clientHeight, rows, foot: R(document.querySelector('.ll-jars-foot')), debt: R(document.querySelector('.ll-jars-debt')), hint: R(document.querySelector('.ll-jars-hint')), head: R(document.querySelector('.ll-jars-head')),
    strip: R(document.querySelector('.ll-touch-abilities')), btns: [...document.querySelectorAll('.ll-touch button, .ll-touch [class*=btn]')].filter(e => e.offsetParent).map(e => (e.className + '').slice(0, 30) + ':' + R(e).join(',')).slice(0, 8), hud: R(document.querySelector('.ll-hud, header')) }; });
console.log(JSON.stringify(m, null, 0));
await p.screenshot({ path: `tools/shots/s86_jars_${tag}_${W}x${H}.png` });
console.log('errs', errs); await b.close();
