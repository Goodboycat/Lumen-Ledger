import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport:{width:1280,height:720} });
const logs=[]; p.on('pageerror',e=>logs.push('PAGEERR '+e.message));
await p.goto('http://localhost:3000/index.html?autoplay&notutorial&nocine&mute&seed=1'); await p.waitForTimeout(7000);
const r = await p.evaluate(()=>{ const { CinematicDirector } = {}; return 1; });
// play victory directly through lg.cine if available (nocine disables it) -> fallback: import module
const v = await p.evaluate(async()=>{ const m = await import('./src/vfx/cinematics.js'); const d = new m.CinematicDirector(lg.game,{container:document.body}); d.play('victory',{sb:lg.sb}); const fin=[]; for(let i=0;i<40;i++){ d.update(0.1); fin.push(Number.isFinite(d.rig.pos.x)&&Number.isFinite(d.rig.pos.y)); } d.stop(true); d.play('arrival',{sb:lg.sb}); d.update(0.1); const a=[d.rig.pos.x,d.rig.pos.y]; d.dispose(); return {victoryFinite:fin.every(Boolean), arrivalPos:a}; });
console.log(JSON.stringify(v));
const m = await b.newPage({ viewport:{width:360,height:800}, hasTouch:true, isMobile:true });
await m.goto('http://localhost:3000/index.html?mute'); await m.waitForTimeout(7000); await m.screenshot({path:'/home/user/qa/c_mobile_title.png'});
console.log(logs.join('\n')); await b.close();
