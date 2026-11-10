// S84: session 1 plays through the first tutor cards; session 2 (same storage) presses PLAY or CONTINUE and waits for the cine to end.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/'); const { chromium } = require('playwright');
const which = process.argv[2] || 'story'; const W = 844, H = 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
const url = 'http://localhost:3000/index.html?touch=1&mute&nocine';
const boot = async () => { await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(2500); };
const skipDlg = async (n = 20) => { for (let i = 0; i < n; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); } };
const snap = (tag) => p.evaluate((tag) => { const sp = document.querySelector('.ll-speed'); let sb = 'none'; if (sp) { const r = sp.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); sb = { rect: [r.x | 0, r.y | 0], top: t && (t.className || t.tagName), staged: sp.classList.contains('ll-staged'), disp: getComputedStyle(sp).display }; }
  return { tag, state: lg.state, verbStep: lg.verbs?.step, storyVerb: lg.story?.state?.verbStep, tutorCur: String(ui.tutor?.current?.id ?? null), counts: JSON.stringify(ui.tutor?.counts), speedBtn: sb, tutDone: localStorage.getItem('lumen.tutorialDone') }; }, tag);
await boot(); await p.evaluate(() => ui.title.buttons.story.click()); await skipDlg(); await p.waitForTimeout(1000);
console.log('play1', JSON.stringify(await snap('p1')));
// walk through the verb steps quickly by faking completion
await p.evaluate(() => { lg.sb.hero.root.position.x += 5; }); await p.waitForTimeout(1500);
console.log('play1b', JSON.stringify(await snap('p1b')));
await p.evaluate(() => lg.save.write()); 
console.log('save verbStep', await p.evaluate(() => { const s = JSON.parse(localStorage['lumen.save']); return JSON.stringify({ v: s.story?.verbStep, c: s.tutorCounts, seen: s.tutorSeen }); }));
await boot();
await p.evaluate((w) => { (ui.title.buttons[w] || ui.title.buttons.story).click(); }, which); await skipDlg(); await p.waitForTimeout(2500);
for (let i=0;i<20;i++){ const v=await p.evaluate(()=>[String(ui.tutor?.visible), String(ui.tutor?.current?.id)]); if(v[0]==='true'){console.log('tutor visible after',i,'s',JSON.stringify(v)); break;} await p.waitForTimeout(1000);}
console.log('play2', which, JSON.stringify(await snap('p2')));
const r = await p.evaluate(() => { const sp = document.querySelector('.ll-speed'); const rc = sp.getBoundingClientRect(); return { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2 }; });
if (r.x) { await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(600); console.log('speed after real tap', await p.evaluate(() => lg.speed), 'seasonCard', await p.evaluate(() => getComputedStyle(document.querySelector('.ll-season-back')).display)); }
await p.screenshot({ path: `tools/shots/s84_b_${which}.png` }); console.log('errs', errs.slice(0, 5)); await b.close();
