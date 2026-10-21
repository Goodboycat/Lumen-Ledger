// Multi-touch QA (bug-fix helper). Run from game/:  NODE_PATH=tools/node_modules node tools/qa_touch.mjs
// Real CDP touch points on a 800x360 phone: finger 1 drags the joystick, finger 2 holds ATTACK, finger 3 taps INTERACT,
// then fingers lift in a different order. Prints PASS/FAIL per check.
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const port = 3140;
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 360 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?autoplay&mute&nohistory`, { waitUntil: 'load' });
await p.waitForTimeout(3000);
await p.evaluate(() => { for (let i = 0; i < 30 && window.ui?.dialogue?.isOpen; i++) window.ui.dialogue.hide(); window.__presses = []; window.game.bus.on('ui:touch', (e) => window.__presses.push(e.action)); });
await p.waitForTimeout(400);
const cdp = await ctx.newCDPSession(p);
const c = (sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const atk = await c('.ll-touch-btn.attack'), inter = await c('.ll-touch-btn.interact');
const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });   // touchEnd lists the fingers being LIFTED
const st = () => p.evaluate(() => ({ joy: window.game.input.joystick.active, vx: window.game.input.joystick.vec.x, atk: window.game.input.actions.attack }));
const res = []; const ok = (name, v) => res.push((v ? 'PASS ' : 'FAIL ') + name);
const J = { x: 200, y: 220, id: 1 };
await T('touchStart', [J]); for (let i = 1; i <= 8; i++) { await T('touchMove', [{ ...J, x: 200 + i * 7 }]); await p.waitForTimeout(30); }
let s = await st(); ok('joystick drag moves', s.joy && s.vx > 0.5);
await T('touchStart', [{ ...J, x: 256 }, { x: atk.x, y: atk.y, id: 2 }]); await p.waitForTimeout(400);
s = await st(); ok('attack held while joystick held', s.joy && s.atk);
await T('touchStart', [{ ...J, x: 256 }, { x: atk.x, y: atk.y, id: 2 }, { x: inter.x, y: inter.y, id: 3 }]); await p.waitForTimeout(80);
await T('touchEnd', [{ x: inter.x, y: inter.y, id: 3 }]); await p.waitForTimeout(80);
s = await st(); ok('3rd finger tap keeps joystick + attack', s.joy && s.atk);
await T('touchEnd', [{ ...J, x: 256 }]); await p.waitForTimeout(120);
s = await st(); ok('lifting joystick finger keeps attack held', !s.joy && s.atk);
await T('touchEnd', [{ x: atk.x, y: atk.y, id: 2 }]); await p.waitForTimeout(120);
s = await st(); ok('all released', !s.joy && !s.atk);
const presses = await p.evaluate(() => window.__presses);
ok('interact fired during multi-touch', presses.includes('interact')); ok('attack repeats while held', presses.filter((x) => x === 'attack').length >= 2);
ok('no page errors', errs.length === 0);
console.log(res.join('\n')); console.log(res.some((r) => r.startsWith('FAIL')) ? 'MULTITOUCH FAIL' : 'MULTITOUCH OK');
await b.close(); srv.kill();
