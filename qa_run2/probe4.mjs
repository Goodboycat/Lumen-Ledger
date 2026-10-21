import { chromium } from 'playwright';
const b = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:3000/game/?mute&notutorial&season=20&seed=2026',{timeout:120000});
await p.waitForFunction(()=>window.lg); await p.waitForTimeout(800);
await p.evaluate(()=>{game.renderer.render=()=>{}; localStorage.clear();});
const play=async()=>{ await p.locator('.ll-title-btn.play').click(); await p.waitForTimeout(400); await p.evaluate(()=>{ for(let i=0;i<60&&ui.dialogue.isOpen;i++){ui.dialogue.skip();const cs=ui.dialogue.line?.choices; if(cs?.length) ui.dialogue.choose(cs.length-1); else ui.dialogue.advance();} }); };
await play();
await p.evaluate(()=>{ const e=lg.sb.eco; e.state.season=4; e.earn(300,'qa'); });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
const btn=p.locator('.ll-pause-btn').filter({hasText:/RESTART/}); 
await btn.click(); await p.waitForTimeout(200);
await p.locator('.ll-pause-btn').nth(3).click(); await p.waitForTimeout(800);
console.log('restart', await p.evaluate(()=>({season:lg.sb?.eco.state.season,spark:lg.sb?.eco.state.spark,starts:lg.stats.starts,paused:game.paused,pauseBy:[...lg.pauseBy]})));
// save/continue: play season 1 → end → continue → title → continue?
await p.evaluate(()=>{ for(let i=0;i<60&&ui.dialogue.isOpen;i++){ui.dialogue.skip();const cs=ui.dialogue.line?.choices; if(cs?.length) ui.dialogue.choose(cs.length-1); else ui.dialogue.advance();} });
await p.evaluate(()=>{ lg.sb.eco.earn(200,'qa'); });
await p.keyboard.press('KeyB'); await p.waitForTimeout(200);
// buy a decor item via API then save
const s1 = await p.evaluate(()=>{ const b=lg.sb.build; b.enter('bench'); for(let z=-6;z<=6;z++)for(let x=-6;x<=6;x++) if(b.canPlace('bench',x,z)){ const w=b.anchorToWorld('bench',x,z); b.moveTo(w.x,w.z); b.confirm(); b.exit(); return {stalls:lg.sb.eco.state.stalls, placed:b.placed.size}; } });
await p.keyboard.press('KeyB');
await p.evaluate(()=>lg.save.write());
const before = await p.evaluate(()=>({spark:lg.sb.eco.state.spark,debt:lg.sb.eco.state.debt,stalls:lg.sb.eco.state.stalls,placed:lg.sb.build.placed.size, has:lg.save.has(), desc:lg.save.describe()}));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.locator('.ll-pause-btn').filter({hasText:/TITLE/}).click(); await p.waitForTimeout(200);
const afterTitleClick = await p.evaluate(()=>lg.state);
if (afterTitleClick!=='title') { await p.locator('.ll-pause-btn').filter({hasText:/TITLE|SURE/}).click().catch(()=>{}); await p.waitForTimeout(500); }
const titleBtns = await p.evaluate(()=>[...document.querySelectorAll('.ll-title-btn')].filter(b=>b.offsetParent).map(b=>b.innerText.replace(/\s+/g,' ')));
const cont = p.locator('.ll-title-btn').filter({hasText:/CONTINUE/});
let after=null;
if (await cont.count()) { await cont.click(); await p.waitForTimeout(800); after = await p.evaluate(()=>({spark:lg.sb.eco.state.spark,debt:lg.sb.eco.state.debt,stalls:lg.sb.eco.state.stalls,placed:lg.sb.build.placed.size, counts:{...ui.build.state.counts}})); }
console.log(JSON.stringify({s1,before,afterTitleClick,titleBtns,after}));
console.log(errs); await b.close();
