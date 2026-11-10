// S84: jars panel geometry vs the touch buttons. node tools/probe_s84_jars.mjs W H [shot]
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 844, +process.argv[3] || 390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, isMobile: W < 900 })).newPage();
await p.goto('http://localhost:3000/index.html?' + (W < 900 ? 'touch=1&' : '') + 'nocine&mute&notutorial', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2000);
await p.evaluate(() => ui.title.buttons.story.click());
for (let i = 0; i < 24; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); }
await p.evaluate(() => { const e = lg.sb.eco; e.state.spark = 120; e.allocate({ save: 30, protect: 10 }); for (const k of ['save', 'invest', 'protect']) ui.jars.show(k); ui.jars.setBalances({ ...e.state.jars }); ui.jars.setDebt?.(1300, 120); ui.jars.setCollapsed(false); ui.jars.el.classList.remove('ll-staged'); });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => { const bx = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.x | 0, r.y | 0, (r.x + r.width) | 0, (r.y + r.height) | 0]; };
  const J = ui.jars.el; return { jars: bx(J), scrollH: J.scrollHeight, clientH: J.clientHeight, maxH: getComputedStyle(J).maxHeight, pause: bx(document.querySelector('.ll-pause-btn,.ll-pause')), touchBtns: [...document.querySelectorAll('.ll-touch-btn,.ll-touch-strip,.ll-touch button')].map((e) => (e.className + '').slice(0, 24) + ':' + bx(e)).slice(0, 8), grid: (() => { const r = ui.jars.el.querySelectorAll('.ll-jar')[1]; const c = getComputedStyle(r); return c.gridTemplateColumns + ' | rows ' + c.gridTemplateRows + ' | cls ' + r.className; })(), kids: [...J.querySelectorAll('.ll-jar')][1] && [...[...J.querySelectorAll('.ll-jar')][1].children].map((e) => (e.className + '').slice(0, 14) + ':' + (e.getBoundingClientRect().height | 0) + 'x' + (e.getBoundingClientRect().width | 0)), head: (J.querySelector('.ll-jars-head').getBoundingClientRect().height | 0), foot: J.querySelector('.ll-jars-foot') && (J.querySelector('.ll-jars-foot').getBoundingClientRect().height | 0), rows: [...J.querySelectorAll('.ll-jar')].map((e) => e.hidden ? 'hid' : bx(e)) }; });
console.log(JSON.stringify(r));
if (process.argv[4]) await p.screenshot({ path: `tools/shots/s84_jars_${W}x${H}.png` });
await b.close();
