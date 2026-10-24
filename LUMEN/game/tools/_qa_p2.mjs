import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport:{width:1280,height:720} });
const logs=[]; p.on('pageerror',e=>logs.push('PAGEERR '+e.message)); p.on('console',m=>{ if(m.type()==='error') logs.push('ERR '+m.text()); });
await p.goto('http://localhost:3000/index.html?autoplay&notutorial&nocine&mute&seed=1'); await p.waitForTimeout(7000);
const k = await p.evaluate(()=>Object.keys(lg).join(','));
console.log('lg keys', k);
const r = await p.evaluate(()=>{ const sb=lg.sb||lg.sandbox; window._sb=sb; return { sbKeys: sb? Object.keys(sb).join(','):'none' }; });
console.log(r.sbKeys);
// close any dialogue
for (let i=0;i<8;i++){ await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.evaluate(()=>{ _sb.storm.warn(); });
await p.waitForTimeout(4000); await p.screenshot({path:'/home/user/qa/b_warn.png'});
await p.evaluate(()=>{ _sb.storm.hit(); });
await p.waitForTimeout(2500); await p.screenshot({path:'/home/user/qa/b_storm.png'});
const st = await p.evaluate(()=>{ const s=_sb.storm; return { k:s.intensity, phase:s.phase, streakVis:s._streaks?.mesh.visible, overlay:s._el?.style.opacity, rain:s._rain?.style.opacity, inDom: !!document.getElementById('storm-overlay'), z: getComputedStyle(s._el).zIndex, parent:s._el.parentElement?.className, bg:'#'+lg.game?.scene?.background?.getHexString?.() }; });
console.log('storm', JSON.stringify(st));
// enemies wave
await p.evaluate(()=>{ _sb.storm.clear(0.2); _sb.enemies.spawnWave(5); });
await p.waitForTimeout(1500);
const e1 = await p.evaluate(()=>_sb.enemies.list.map(e=>[e.kind,+e.g.position.x.toFixed(2),+e.g.position.z.toFixed(2)]));
console.log('wave spawn', JSON.stringify(e1));
await p.waitForTimeout(6000); await p.screenshot({path:'/home/user/qa/b_wave.png'});
const e2 = await p.evaluate(()=>{ const L=_sb.enemies.list; let min=99; for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){min=Math.min(min,L[i].g.position.distanceTo(L[j].g.position));} return {pos:L.map(e=>[+e.g.position.x.toFixed(2),+e.g.position.z.toFixed(2)]),minPair:min.toFixed(2),hero:_sb.hero.root.position.toArray().map(v=>+v.toFixed(2)),stats:_sb.enemies.stats}; });
console.log('wave later', JSON.stringify(e2));
console.log(logs.join('\n'));
await b.close();
