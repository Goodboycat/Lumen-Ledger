import { chromium } from 'playwright';
const b = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:3000/game/?mute&notutorial&season=20&seed=2026',{timeout:120000});
await p.waitForFunction(()=>window.lg); await p.waitForTimeout(1500);
await p.evaluate(()=>{ window.__ev=[]; for (const n of ['eco:season','eco:fog','eco:spark','eco:lose','eco:win','game:state','story:line','game:paused','story:review','eco:offer','eco:event']) game.bus.on(n,(x)=>__ev.push([n, performance.now()|0, JSON.stringify(x).slice(0,250)])); });
await p.locator('.ll-title-btn.play').click();
for (let i=0;i<40;i++){ await p.waitForTimeout(1500);
  const s=await p.evaluate(()=>({t:game.time.toFixed(1),day:lg.sb?.eco.state.day01.toFixed(3),season:lg.sb?.eco.state.season,pauseBy:[...lg.pauseBy],dlg:ui.dialogue.isOpen,led:ui.ledger.isOpen,fps:game.stats.fps,spark:lg.sb?.eco.state.spark,fog:lg.sb?.eco.state.fog01}));
  console.log(JSON.stringify(s));
  await p.evaluate(()=>{ if(ui.dialogue.isOpen){ const cs=ui.dialogue.line?.choices; if(cs?.length) ui.dialogue.choose(cs.length-1); else { ui.dialogue.skip(); ui.dialogue.advance(); } } if(ui.ledger.isOpen && !window.__ledgerDone){ window.__ledgerTxt=document.querySelector('.ll-ledger').innerText; window.__rep=JSON.stringify(lg.lastReport); window.__ledgerDone=1; } });
  if (await p.evaluate(()=>!!window.__ledgerDone)) break;
}
console.log(await p.evaluate(()=>window.__ledgerTxt)); console.log(await p.evaluate(()=>window.__rep));
console.log((await p.evaluate(()=>__ev)).map(x=>x.join(' ')).join('\n'));
console.log(errs); await b.close();
