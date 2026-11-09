// S80: play-state shot + tutor/BUILD/Cloud geometry.  node tools/shot_s80_play.mjs W H tag
import { launch, startStory, shot } from './rig76.mjs';
const [W, H, tag] = [+process.argv[2] || 844, +process.argv[3] || 390, process.argv[4] || 'play'];
const { p, b, errs } = await launch(W, H); await startStory(p);
await p.waitForTimeout(1500);
const box = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), vis: cs.display !== 'none' && cs.opacity !== '0' }; }, sel);
const sels = ['.ll-tutor', '.ll-tutor-bub', '.ll-tutor-av', '.ll-tutor-txt', '.ll-tutor-x', '.ll-build-btn', '.ll-btn-build', '.ll-joy', '.ll-touch-joy', '.ll-spark', '.ll-right', '.ll-mid', '.ll-focus'];
for (const s of sels) console.log(s.padEnd(18), JSON.stringify(await box(s)));
const txt = await p.evaluate(() => document.querySelector('.ll-tutor-txt')?.textContent);
console.log('tutor text:', txt);
const all = await p.evaluate(() => [...document.querySelectorAll('button,.ll-btn,[role=button]')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'; }).map(e => { const r = e.getBoundingClientRect(); return [e.className.toString().slice(0, 28) || e.id, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
console.log('visible buttons [cls,x,y,w,h]'); for (const a of all) console.log(' ', JSON.stringify(a), (a[3] < 40 || a[4] < 40) ? '<<< <40' : '');
await shot(p, `s80_${tag}_${W}x${H}`); console.log('errs', errs.slice(0, 3)); await b.close();
