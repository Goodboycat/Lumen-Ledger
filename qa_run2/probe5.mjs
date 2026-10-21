import { chromium } from 'playwright';
const b = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:3000/game/?mute&notutorial&season=20&seed=2026',{timeout:120000});
await p.waitForFunction(()=>window.lg); await p.waitForTimeout(800);
const R0=await p.evaluate(()=>{window.__r=game.renderer.render; game.renderer.render=()=>{}; localStorage.clear(); return 1;});
const play=async()=>{ await p.locator('.ll-title-btn.play').click(); await p.waitForTimeout(400); await p.evaluate(()=>{ for(let i=0;i<60&&ui.dialogue.isOpen;i++){ui.dialogue.skip();const cs=ui.dialogue.line?.choices; if(cs?.length) ui.dialogue.choose(cs.length-1); else ui.dialogue.advance();} }); };
const fogMeshes=()=>p.evaluate(()=>game.scene.children.filter(o=>o.isInstancedMesh||o.isMesh||o.isGroup).map(o=>`${o.name||o.type}:${o.visible?'vis':'hid'}`).reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{}));
await play();
console.log('run1 start', JSON.stringify(await fogMeshes()));
// lose by fog
await p.evaluate(()=>{ const e=lg.sb.eco; e.state.fog01=0.95; e.endSeason(); });
for (let k=0;k<60;k++){ await p.evaluate(()=>{ if(ui.dialogue.isOpen){ui.dialogue.skip();ui.dialogue.advance();} }); if(await p.evaluate(()=>ui.ledger.isOpen)) break; await p.waitForTimeout(150);}
await p.waitForTimeout(1500);
await p.locator('.ll-ledger-continue').click(); await p.waitForTimeout(800);
console.log('title', JSON.stringify(await fogMeshes()), await p.evaluate(()=>[...document.querySelectorAll('.vfx-vignette')].map(e=>e.style.opacity)));
await play();
await p.evaluate(()=>{game.renderer.render=window.__r;}); await p.waitForTimeout(3000);
await p.screenshot({path:'/home/user/webapp/qa_run2/evidence/t13-run2-start-after-fog-loss.png'});
console.log('run2 start', JSON.stringify(await fogMeshes()), await p.evaluate(()=>({vign:[...document.querySelectorAll('.vfx-vignette')].map(e=>e.style.opacity), fog:lg.sb.eco.state.fog01, hud:document.querySelector('.ll-hud')?.innerText.replace(/\s+/g,' ').slice(0,90)})));
await p.evaluate(()=>{game.renderer.render=()=>{};});
// keys: W, R during placement
const k = await p.evaluate(()=>{ const log=[]; game.bus.on('sandbox:ability',(x)=>log.push(x.name)); const orig=lg.sb.ability; lg.sb.ability=(n)=>{log.push('req:'+n); return orig(n);}; window.__klog=log; return 1;});
await p.keyboard.down('KeyW'); await p.waitForTimeout(400); await p.keyboard.up('KeyW');
await p.evaluate(()=>{ lg.sb.eco.earn(300,'qa'); ui.build.open(); ui.build.select('stall_tea'); ui.build.deploy('stall_tea'); });
await p.waitForTimeout(300);
const rot0=await p.evaluate(()=>lg.sb.build.rot ?? lg.sb.build.ghostRot ?? null);
await p.keyboard.press('KeyR'); await p.waitForTimeout(6000);
const rot1=await p.evaluate(()=>lg.sb.build.rot ?? lg.sb.build.ghostRot ?? null);
console.log('keys', JSON.stringify(await p.evaluate(()=>window.__klog)), 'rot', rot0, rot1);
// upgrade L1->L2 via UI and verify sales multiplier wiring + stallUpkeepExtra
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.evaluate(()=>{ ui.build.open(); ui.build.select('stall_fruit'); });
await p.waitForTimeout(200);
await p.locator('.ll-build-detail .ll-btn.up').click().catch(e=>console.log('upclick',e.message));
await p.waitForTimeout(300);
console.log('upgrade', JSON.stringify(await p.evaluate(()=>({levels:[...lg.sb.build.placed.values()].map(e=>e.id+':L'+e.level), spark:lg.sb.eco.state.spark, extra:lg.sb.eco.state.stallUpkeepExtra, levelMul: lg.sb.eco.levelMul?.(2)}))));
// quality low
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.locator('.ll-seg-btn',{hasText:'Low'}).click().catch(e=>console.log('q',e.message)); await p.waitForTimeout(300);
console.log('quality', JSON.stringify(await p.evaluate(()=>({dpr:game.renderer.getPixelRatio(), shadows:game.renderer.shadowMap.enabled, setQ: typeof game.setQuality}))));
// endless from title
console.log(errs); await b.close();
