import { chromium } from 'playwright';
const b = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:3000/game/?mute&notutorial&season=20&seed=2026',{timeout:120000});
await p.waitForFunction(()=>window.lg); await p.waitForTimeout(800);
await p.evaluate(()=>{game.renderer.render=()=>{};});
await p.locator('.ll-title-btn.play').click(); await p.waitForTimeout(400);
await p.evaluate(()=>{ for(let i=0;i<60&&ui.dialogue.isOpen;i++){ui.dialogue.skip();const cs=ui.dialogue.line?.choices; if(cs?.length) ui.dialogue.choose(cs.length-1); else ui.dialogue.advance();} });
await p.evaluate(()=>{ lg.sb.eco.earn(50,'qa'); lg.sb.eco.endSeason(); });
for (let k=0;k<40;k++){ await p.evaluate(()=>{ if(ui.dialogue.isOpen){ui.dialogue.skip();ui.dialogue.advance();} }); if(await p.evaluate(()=>ui.ledger.isOpen)) break; await p.waitForTimeout(150);}
for (const ms of [500,1500,3000,8000]) { await p.waitForTimeout(ms); console.log(ms, await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(ui.ledger.rows).map(([k,r])=>[k,[r.val.textContent,Math.round(r.target),Math.round(r.t)]])))+' btnDisabled='+document.querySelector('.ll-ledger-continue').disabled)); }
await b.close();
