// S69: first-player mobile-landscape visual check. node tools/shot_s69.mjs W H
import { createRequire } from 'node:module';
const require = createRequire('/home/user/webapp/LUMEN/game/tools/node_modules/');
const { chromium } = require('playwright');
const [W,H]=[+process.argv[2]||844,+process.argv[3]||390];
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport:{width:W,height:H}, hasTouch:W<900, isMobile:W<900 });
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160))); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
await p.goto('http://localhost:3000/index.html?'+(W<900?'touch=1&':'')+'',{waitUntil:'load'});
await p.waitForFunction(()=>window.lg&&window.ui,null,{timeout:120000});
await p.waitForTimeout(1500);
await p.screenshot({path:`tools/shots/s69_title_${W}x${H}.png`});
await p.evaluate(()=>ui.title.buttons.story.click());
let shots=0;
for (let i=0;i<60;i++){ await p.waitForTimeout(500);
  const st=await p.evaluate(()=>({c:lg.cine&&lg.cine.active,d:ui.dialogue.isOpen,v:lg.verbs.step}));
  if(st.d && shots<1){ await p.screenshot({path:`tools/shots/s69_dialogue_${W}x${H}.png`}); shots++; }
  if(st.d) await p.evaluate(()=>{ui.dialogue.skip();ui.dialogue.advance()});
  if(!st.c && !st.d && i>8) break; }
await p.waitForTimeout(2500);
await p.screenshot({path:`tools/shots/s69_play_${W}x${H}.png`});
// tap empty ground after verbs → tray
await p.evaluate(()=>{ lg.verbs.skip?.(); });
await p.waitForTimeout(1200);
await p.evaluate(()=>{ lg.modalClosedAt=0; ui.build.open(); });
await p.waitForTimeout(1200);
await p.screenshot({path:`tools/shots/s69_tray_${W}x${H}.png`});
console.log(JSON.stringify({errs:errs.slice(0,6)})); await b.close();
