import { chromium } from 'playwright';
const b = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:3000/game/?mute&notutorial&season=20&seed=2026',{timeout:120000});
await p.waitForFunction(()=>window.lg); await p.waitForTimeout(1500);
await p.locator('.ll-title-btn.play').click(); await p.waitForTimeout(1000);
await p.evaluate(()=>{ ui.dialogue.hide?.(); lg.pause('dialogue',false); });
for (let i=0;i<5;i++){ const a=await p.evaluate(()=>({t:game.time,rt:game.realTime,ts:game.timeScale,paused:game.paused,frames:game.stats.frames,fps:game.stats.fps,hs:JSON.stringify(game.hitStop).slice(0,200)})); console.log(JSON.stringify(a)); await p.waitForTimeout(2000);}
await p.evaluate(()=>{game.renderer.render=()=>{};});
for (let i=0;i<3;i++){ const a=await p.evaluate(()=>({t:game.time,rt:game.realTime,fps:game.stats.fps})); console.log('norender',JSON.stringify(a)); await p.waitForTimeout(2000);}
await b.close();
