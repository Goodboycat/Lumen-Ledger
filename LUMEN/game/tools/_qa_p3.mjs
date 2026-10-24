import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport:{width:1280,height:720} });
const logs=[]; p.on('pageerror',e=>logs.push('PAGEERR '+e.message));
await p.goto('http://localhost:3000/index.html?autoplay&notutorial&nocine&mute&seed=1'); await p.waitForTimeout(7000);
const out = await p.evaluate(()=>{
  const sb=lg.sb, E=sb.enemies, res={};
  const minPair=()=>{const L=E.list.filter(e=>e.state==='chase');let m=99;for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++)m=Math.min(m,L[i].g.position.distanceTo(L[j].g.position));return +m.toFixed(2);};
  sb.hero.root.position.set(-4,0,2);
  E.spawnWave(5); res.spawnMin=minPair();
  const trace=[]; for(let s=0;s<80;s++){ E.update(0.05); if(s%20==19) trace.push(minPair()); }
  res.chaseMinPairs=trace; res.collectorsNearHero=E.list.map(e=>+e.g.position.distanceTo(sb.hero.root.position).toFixed(2));
  res.statsC=JSON.stringify(E.stats);
  E.clear(); E.waveSeason=0;
  // Baron
  sb.hero.root.position.set(-4,0,2);
  E.spawnWave(10); const bar=E.baron; const b0=bar.g.position.clone();
  for(let s=0;s<100;s++) E.update(0.05);
  res.baronMoved=+bar.g.position.distanceTo(b0).toFixed(2); res.baronDistHero=+bar.g.position.distanceTo(sb.hero.root.position).toFixed(2);
  res.baronReward=bar? (window.ENEMY?1:0):0; res.baronState=bar.state; res.statsB=JSON.stringify(E.stats);
  // kill baron, check reward coins
  const spark0=sb.eco.state.spark; let drops=0; const od=E.deps.onCoin; E.deps.onCoin=(x,z,v)=>{drops+=v; od?.(x,z,v);};
  for(let i=0;i<10;i++) E.hitEnemy(bar,new bar.g.position.constructor(1,0,0),1);
  res.baronRewardValue=drops;
  return res; });
console.log(JSON.stringify(out,null,1)); console.log(logs.join('\n'));
await b.close();
