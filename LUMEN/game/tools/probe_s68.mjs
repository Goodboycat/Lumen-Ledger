import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/node_modules/');
const { chromium } = require('playwright');
const [W,H]=[+process.argv[2]||844,+process.argv[3]||390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport:{width:W,height:H}, hasTouch:W<900, isMobile:W<900 });
const p = await ctx.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:3000/index.html?'+(W<900?'touch=1&':''),{waitUntil:'load'});
await p.waitForFunction(()=>window.lg&&window.ui,null,{timeout:120000});
await p.waitForTimeout(1200);
await p.evaluate(()=>ui.title.buttons.story.click());
for (let i=0;i<80;i++){await p.waitForTimeout(500);const st=await p.evaluate(()=>({c:lg.cine&&lg.cine.active,d:ui.dialogue.isOpen,v:lg.verbs.step}));if(st.d)await p.evaluate(()=>{ui.dialogue.skip();ui.dialogue.advance()});else if(!st.c&&st.v>=0)break;}
const info = await p.evaluate(()=>{const s=document.querySelector('.ll-touch-abilities');const cs=getComputedStyle(s);const w=document.querySelector('.ll-touch');return {cls:s.className,disp:cs.display,vis:cs.visibility,kids:[...s.children].map(k=>k.className+':'+getComputedStyle(k).display+':'+k.getBoundingClientRect().width),wrapCls:w&&w.className,abil:[...lg.sb.unlocks.abilities], bodyCls:document.body.className}});
console.log(JSON.stringify(info,null,1));
await b.close();
