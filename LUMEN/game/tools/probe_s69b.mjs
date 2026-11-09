import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
const imp = (p) => import(pathToFileURL(resolve(p)).href);
const THREE = await imp('vendor/three.module.js');
const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
const { EventBus } = await imp('src/core/EventBus.js');
const { tweens } = await imp('src/anim/Tween.js');
const { createSandbox } = await imp('src/Game.js');
for (const seed of [3,7,11,19]) {
  const bus = new EventBus(); let left={};
  bus.on('cust:left',(p)=>{ const k=p.result?.noStall||p.result==='noStall'?'noStall':(p.result?.why||p.result?.reaction||String(p.result&&typeof p.result==='object'?Object.keys(p.result):p.result)); left[k]=(left[k]||0)+1; });
  const game = { scene:new THREE.Scene(), bus, sequences:new SequencePlayer(), tweens, hitStop:new HitStop(), input:{pointerWorld:new THREE.Vector3(),hasPointerWorld:false,move:new THREE.Vector2(),actions:{},pressed:()=>false}, camera:{zoom:1,shake(){}}, time:0,timeScale:1,followTarget:null,systems:[],add(s){this.systems.push(s);return s},hitstop(){} };
  const sb = createSandbox(game,{headless:true,seasonSeconds:150,seed}); if(sb.enemies) sb.enemies.enabled=false;
  const dt=1/30; let g=0;
  while(sb.stats.seasons<3 && !sb.eco.state.ended && g++<3*150*30+600){game.time+=dt;game.sequences.update(dt);game.tweens.update(dt);for(const s of game.systems)s.update?.(dt);}
  console.log(seed, sb.stats.reports.map(r=>`S${r.season} u${r.units} +${r.income}/-${r.expenses} spark ${r.spark}`).join(' | '), JSON.stringify(left), 'totals', JSON.stringify(sb.cust.totals));
}
