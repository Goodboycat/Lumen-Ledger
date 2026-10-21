import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1280,height:720}});
const result = {method:'Two runs, same page/context, no reload between runs. season=1 QA flag. Software GPU rendering disabled at runtime after title (canvas screenshots are not visual-world evidence); gameplay/UI logic still runs. Dialogues advanced through exposed UI API, rejecting scams; normal economy clock. Placement cursor moved through BuildSystem API, confirm through UI.', errors:[],consoleErrors:[],runs:[],events:[]};
page.on('pageerror',e=>result.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error') result.consoleErrors.push(m.text());});
const snap=()=>page.evaluate(()=>({state:lg.state,mode:lg.mode,paused:game.paused,pauseBy:[...lg.pauseBy],eco:lg.sb?JSON.parse(JSON.stringify(lg.sb.eco.state)):null,placed:lg.sb?[...lg.sb.build.placed.values()].map(e=>({id:e.id,level:e.level,cx:e.cx,cz:e.cz})):[],counts:{...ui.build.state.counts},vignettes:[...document.querySelectorAll('.vfx-vignette')].map(e=>({opacity:e.style.opacity})),sceneChildren:game.scene.children.length,systems:game.systems.length,save:lg.save.has(),jarsPct:{...ui.jars.state?.pct},story:lg.story?.state}));
async function drain(){return page.evaluate(()=>{if(ui.dialogue.isOpen){ui.dialogue.skip();const cs=ui.dialogue.line?.choices;if(cs?.length){let i=cs.findIndex(c=>/no thanks|refuse|decline|walk away|not today/i.test(typeof c==='string'?c:c.text||c.label||''));ui.dialogue.choose(i<0?cs.length-1:i);}else ui.dialogue.advance();}return {state:lg.state,dialogue:ui.dialogue.isOpen,ledger:ui.ledger.isOpen,outcome:ui.ledger.state?.outcome};});}
try {
 await page.goto('http://localhost:3000/game/?notutorial&mute&nohistory&season=1&seed=1');
 await page.waitForFunction(()=>window.lg); await page.waitForTimeout(700);
 await page.evaluate(()=>{game.renderer.render=()=>{};});
 for(let run=1;run<=2;run++){
  const rr={number:run,seasons:[]};result.runs.push(rr);
  await page.getByRole('button',{name:'PLAY New story',exact:false}).click();
  await page.evaluate(()=>{lg.sb.eco.autoSeason=false;});
  for(let i=0;i<25;i++){await drain();await page.waitForTimeout(60);if(await page.evaluate(()=>!ui.dialogue.isOpen&&!game.paused))break;}
  rr.start=await snap(); await page.screenshot({path:`qa/evidence/run${run}-start.png`});
  // Buy one additional fruit stall in the first run. No injected funds.
  if(run===1){
   await page.evaluate(()=>{ui.build.open();ui.build.select('stall_fruit');ui.build.deploy('stall_fruit');const b=lg.sb.build;outer:for(let z=-8;z<=8;z++)for(let x=-8;x<=8;x++)if(b.canPlace('stall_fruit',x,z)){const p=b.anchorToWorld('stall_fruit',x,z);b.moveTo(p.x,p.z);window.qaBuildSpot={x,z};break outer;}});
   await page.locator('.ll-placing .ll-btn.ok').click({timeout:2000}).catch(async()=>{await page.evaluate(()=>game.bus.emit('ui:build',{action:'confirm'}));rr.confirmFallback='ui:build confirm bus';});
   await page.evaluate(()=>ui.build.close());rr.afterPurchase=await snap();
  }
  await page.evaluate(()=>{lg.sb.eco.autoSeason=true;});
  let last=0,finished=false;
  for(let i=0;i<900;i++){
   const s=await drain();
   const h=await page.evaluate(()=>lg.sb?.eco.history.map(r=>({season:r.season,debt:r.debt,fog:r.fog01,spark:r.spark,upkeep:r.upkeep,stalls:lg.sb.eco.state.stalls})))||[];
   if(h.length>last){rr.seasons=h;last=h.length;console.log('RUN',run,'SEASON',JSON.stringify(h.at(-1)));}
   if(s.ledger){
    const end=await page.evaluate(()=>lg.sb?.eco.state.ended);
    if(end){rr.end=await snap();rr.endingText=await page.locator('body').innerText();await page.screenshot({path:`qa/evidence/run${run}-loss.png`});}
    await page.evaluate(()=>ui.ledger.continue());
    if(end){finished=true;break;}
   }
   await page.waitForTimeout(75);
  }
  rr.finished=finished;rr.afterReturn=await snap();
  if(!finished)throw Error('Run failed to reach ending');
 }
} catch(e){result.harnessError=e.stack;console.error(e);} finally{fs.writeFileSync('qa/evidence/two-runs.json',JSON.stringify(result,null,2));await browser.close();}
