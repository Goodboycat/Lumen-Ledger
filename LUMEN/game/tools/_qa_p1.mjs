import { chromium } from 'playwright';
const [w,h,q,out] = [ +process.argv[2]||1280, +process.argv[3]||720, process.argv[4]||'', process.argv[5]||'a'];
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport:{width:w,height:h} });
const logs=[]; p.on('console',m=>logs.push(m.type()+': '+m.text())); p.on('pageerror',e=>logs.push('PAGEERR '+e.message));
await p.goto('http://localhost:3000/index.html'+q); await p.waitForTimeout(6000);
await p.screenshot({path:`/home/user/qa/${out}_title.png`});
const info = await p.evaluate(()=>{ const c=document.querySelector('canvas'); const r=c?.getBoundingClientRect(); return {canvas:r&&[r.x,r.y,r.width,r.height], body:[innerWidth,innerHeight], titleEls:[...document.querySelectorAll('[class*=title]')].slice(0,12).map(e=>{const r=e.getBoundingClientRect();return e.className+' '+[r.x|0,r.y|0,r.width|0,r.height|0]+' bg='+getComputedStyle(e).backgroundColor})}; });
console.log(JSON.stringify(info,null,1));
await p.mouse.click(5,5);
const play = await p.$('text=PLAY'); if (play) await play.click(); else console.log('no PLAY');
for (const t of [500,1500,3000,5000,8000]) { await p.waitForTimeout(t===500?500:t-[500,1500,3000,5000,8000][[500,1500,3000,5000,8000].indexOf(t)-1]); await p.screenshot({path:`/home/user/qa/${out}_arr${t}.png`}); }
const cam = await p.evaluate(()=>{ const lg=window.lg||window.__lg; const g=window.game||lg?.game; const c=g?.camera?.camera||g?.camera?.cam; return {keys:Object.keys(window).filter(k=>/lg|game|lumen/i.test(k)), pos:c?.position?.toArray?.(), cine:lg?.cine?.active}; });
console.log(JSON.stringify(cam));
console.log(logs.slice(0,40).join('\n'));
await b.close();
