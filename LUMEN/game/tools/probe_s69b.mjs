import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
const imp = (p) => import(pathToFileURL(resolve(p)).href);
const THREE = await imp('vendor/three.module.js');
const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
const { EventBus } = await imp('src/core/EventBus.js');
const { tweens } = await imp('src/anim/Tween.js');
const { createSandbox } = await imp('src/Game.js');
for (const seed of [3,7]) {
  const bus = new EventBus(); const by = {};
  const cur = () => (by[sbS] ??= { spawn:0, paid:0, noStall:{}, foundYes:0 });
  let sbS = 1;
  bus.on('cust:spawn',()=>cur().spawn++); bus.on('cust:paid',()=>cur().paid++);
  bus.on('cust:want',(p)=>{ if(!p.found){ const n=cur().noStall; n[p.type+':'+p.want]=(n[p.type+':'+p.want]||0)+1; } else cur().foundYes++; });
  const game = { scene:new THREE.Scene(), bus, sequences:new SequencePlayer(), tweens, hitStop:new HitStop(), input:{pointerWorld:new THREE.Vector3(),hasPointerWorld:false,move:new THREE.Vector2(),actions:{},pressed:()=>false}, camera:{zoom:1,shake(){}}, time:0,timeScale:1,followTarget:null,systems:[],add(s){this.systems.push(s);return s},hitstop(){} };
  const sb = createSandbox(game,{headless:true,seasonSeconds:150,seed}); if(sb.enemies) sb.enemies.enabled=false;
  const dt=1/30; let g=0;
  while(sb.stats.seasons<3 && !sb.eco.state.ended && g++<3*150*30+600){ sbS = sb.eco.state.season||1; game.time+=dt;game.sequences.update(dt);game.tweens.update(dt);for(const s of game.systems)s.update?.(dt);}
  console.log('seed',seed); for (const [s,v] of Object.entries(by)) console.log(' S'+s, 'spawn',v.spawn,'paid',v.paid,'foundWant',v.foundYes,'noStall',JSON.stringify(v.noStall));
  console.log(' demand S3', ['fruit','bread','tea'].map(k=>sb.eco.demandOf?.(k)));
}
