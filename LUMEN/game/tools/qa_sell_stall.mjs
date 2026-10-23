// QA repro for P45–P52 (sell a starter stall → stuck Glimmers). Run from game/ with the static server on :3000: node tools/qa_sell_stall.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://localhost:3000/index.html?autoplay&notutorial&mute&nohistory&seed=1&season=120');
await p.waitForFunction(() => window.lg?.sb?.cust, null, { timeout: 60000 });
await p.waitForTimeout(1500);
// close dialogue if any
const st = () => p.evaluate(() => { const sb = lg.sb; return {
  paused: game.paused, modal: ui.isModal?.(),
  stalls: [...sb.build.placed.values()].filter(e=>e.category==='stall').map(e=>`${e.id}@${e.cx},${e.cz}`),
  queues: [...sb.cust.queues].map(([e,q])=>`${e.id}@${e.cx},${e.cz}:${q.length}:${sb.build.placed.has(e.cx+','+e.cz)&&[...sb.build.placed.values()].includes(e)?'live':'DEAD'}`),
  cust: sb.cust.active.map(c=>`${c.id}:${c.state}:${c.stall?c.stall.id+'@'+c.stall.entry.cx+','+c.stall.entry.cz:'-'}:${c.root.position.x.toFixed(1)},${c.root.position.z.toFixed(1)}:w${c.waited.toFixed(1)}`)
};});

const probe = () => p.evaluate(() => { const sb=lg.sb, cu=sb.cust, f=cu.flow; const out=[];
 for (const c of cu.active) { if (!['walk','queue','leave'].includes(c.state)) continue;
   const pos=c.root.position; const d={x:0,z:0}; let fld=null; try{ fld=c.field||f.get(c.target.x,c.target.z); f.direction(fld,pos.x,pos.z,d);}catch(e){}
   const occ=sb.build.occupied(c.target.x,c.target.z);
   out.push({id:c.id,st:c.state,stall:c.stall&&c.stall.id, live:c.stall?[...sb.build.placed.values()].includes(c.stall.entry):null, pos:[+pos.x.toFixed(2),+pos.z.toFixed(2)], tgt:[+c.target.x.toFixed(2),+c.target.z.toFixed(2)], tgtWalk:f.walkable(c.target.x,c.target.z), tgtOcc: occ?occ.id:null, posWalk:f.walkable(pos.x,pos.z), dir:[+d.x.toFixed(2),+d.z.toFixed(2)], vel:[+c.vel.x.toFixed(2),+c.vel.z.toFixed(2)], anim:c.anim&&c.anim.current, slot:c.slot}); }
 return out; });
for (let i=0;i<20;i++){ const s=await st(); if(!s.modal) break; await p.keyboard.press('Space'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);}
await p.evaluate(()=>{ lg.sb.cust.spawnWave(1, 6); window._fps=game.stats; });
for(let i=0;i<90;i++){ const n=await p.evaluate(()=>lg.sb.cust.active.filter(c=>c.stall&&c.stall.id==='stall_fruit'&&['queue','browse','walk'].includes(c.state)&&Math.hypot(c.root.position.x-c.target.x,c.root.position.z-c.target.z)<1.5).length); if(n>=2) break; await p.waitForTimeout(1000);}
console.log('BEFORE', JSON.stringify(await st(),null,1));
// sell the fruit stall via tray action
await p.evaluate(()=>game.bus.emit('ui:build',{action:'sell', id:'stall_fruit'}));
await p.waitForTimeout(200);
console.log('AFTER 0.2s', JSON.stringify(await st(),null,1));
for(let k=0;k<4;k++){await p.waitForTimeout(3000); console.log('t',k, JSON.stringify((await st()).cust));}
console.log('AFTER', JSON.stringify(await st(),null,1));
await p.screenshot({path:'/tmp/after_sell.png'});
// rebuild at same spot
await p.evaluate(()=>{ const sb=lg.sb; sb.eco.state.spark+=200; const e=sb.build.place('stall_fruit',-6,-5,1,{animate:false}); window._re=!!e; });
for(let k=0;k<4;k++){await p.waitForTimeout(3000); console.log('r',k, JSON.stringify((await st()).cust));}
console.log('REBUILT', await p.evaluate(()=>window._re), JSON.stringify(await st(),null,1));
await p.screenshot({path:'/tmp/after_rebuild.png'});
await p.waitForTimeout(4000); console.log('PROBE', JSON.stringify(await probe()));
console.log('errs', errs);
await b.close();
