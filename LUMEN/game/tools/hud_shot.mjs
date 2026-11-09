import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/node_modules/');
const { chromium } = require('playwright');
const [W,H]=[+process.argv[2],+process.argv[3]];
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport:{width:W,height:H}, hasTouch:W<900, isMobile:W<900 });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/index.html?'+(W<900?'touch=1&':'')+(process.argv[4]==='nodebug'?'':'debug=1'),{waitUntil:'load'});
await p.waitForFunction(()=>window.lg&&window.ui,null,{timeout:120000});
await p.waitForTimeout(1200);
await p.evaluate(()=>ui.title.buttons.story.click());
for (let i=0;i<80;i++){await p.waitForTimeout(500);const st=await p.evaluate(()=>({c:lg.cine&&lg.cine.active,d:ui.dialogue.isOpen,v:lg.verbs.step}));if(st.d)await p.evaluate(()=>{ui.dialogue.skip();ui.dialogue.advance()});else if(!st.c&&st.v>=0)break;}
await p.evaluate(()=>{lg.verbs.skip?.();const e=lg.sb.eco;e.state.spark=400;for(let i=0;i<5;i++)e.sell('fruit','regular',5);});
await p.evaluate(()=>{ const sb=lg.sb; for(const a of ['growthStomp','ledgerFlash','haggleShout','fogSweep'])sb.unlocks?.abilities?.add?.(a); lg.syncAbilities?.(); ui.reveal?.revealAll?.({quiet:true}); lg.ability('bubbleShield'); sb.focus.st.value=+(window.__F??5); });
await p.waitForTimeout(1500);
await p.screenshot({path:`tools/shots/s67_hud_${W}x${H}${process.argv[4]==='nodebug'?'_nd':''}_chips.png`});
const g=await p.evaluate(()=>{const r=(s)=>{const e=document.querySelector(s);if(!e)return null;const q=e.getBoundingClientRect();return [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]};return{spark:r('.ll-spark'),mid:r('.ll-mid'),season:r('.ll-season'),pay:r('.ll-spark-pay'),focus:r('.ll-focus'),rep:r('.ll-rep'),right:r('.ll-right'),strip:r('.ll-touch-abilities'),pad:r('.ll-touch-pad')}});
console.log(JSON.stringify(g)); await b.close();
