// S61 rig: tiny phones (<= 360 px tall) Move-card overlap check + rotated-camera locate('ahead').  node tools/play_s61.mjs [W H]
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 568, H = +process.argv[3] || 320;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s61_${W}x${H}_${n}.png` });
await p.goto('http://localhost:3000/index.html?touch=1&nocine', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await shot('title');
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await shot('dialogue_done');
const out = { viewport: [W, H] };
await p.waitForFunction(() => ui.tutor.current === 'verb:move', null, { timeout: 40000 }).catch(() => {});
await p.waitForTimeout(800);
out.card = await p.evaluate(() => ui.tutor.current);
const boxes = () => p.evaluate(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const q = (s) => document.querySelector(s);
  const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  const named = { joy: q('.ll-tutor-joy'), card: q('.ll-tutor'), build: q('[data-id=build], .ll-build-btn, #ll-build-toggle, .ll-bt'), pouch: q('.ll-pouch, #ll-pouch'), season: q('.ll-season, .ll-pill'), };
  const all = {}; for (const [k, e] of Object.entries(named)) all[k] = vis(e) ? r(e) : null;
  // every visible fixed/absolute HUD child with a size, for a quick map
  const hud = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); return (cs.position === 'fixed' || cs.position === 'absolute') && e.getBoundingClientRect().width > 20 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && e.tagName !== 'CANVAS' && e.id !== 'ui'; }).map((e) => ({ n: (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ').slice(0, 2).join('.'), ...r(e) })).slice(0, 40);
  return { all, hud };
});
const bx = await boxes(); out.boxes = bx.all;
const ov = (a, c) => a && c && !(a.r <= c.x || a.x >= c.r || a.b <= c.y || a.y >= c.b);
out.joyOverlapsCard = ov(bx.all.joy, bx.all.card);
out.joyInViewport = bx.all.joy && bx.all.joy.x >= 0 && bx.all.joy.y >= 0 && bx.all.joy.r <= W && bx.all.joy.b <= H;
out.cardInViewport = bx.all.card && bx.all.card.x >= 0 && bx.all.card.y >= 0 && bx.all.card.r <= W && bx.all.card.b <= H;
// the joy vs every other HUD element
out.joyHits = bx.hud.filter((h) => !/ll-tutor/.test(h.n) && ov(bx.all.joy, h)).map((h) => `${h.n} [${h.x},${h.y},${h.r},${h.b}]`);
for (const [i, ms] of [[1, 300], [2, 700], [3, 800]]) { await p.waitForTimeout(ms); await shot('move' + i); }
// ---- rotated camera: locate('ahead') must be 'up the screen' (ground-projected camera forward), on land
out.rot = await p.evaluate(() => {
  const g = lg.game, cam = g.camera, three = cam.three, res = [], off0 = cam.offset.clone();
  const hp = lg.sb.hero.root.position;
  for (const deg of [0, 40, 90, 180, 270]) {
    const a = deg * Math.PI / 180, ox = off0.x, oz = off0.z;
    cam.offset.set(ox * Math.cos(a) + oz * Math.sin(a), off0.y, -ox * Math.sin(a) + oz * Math.cos(a));
    cam.snapTo(hp); cam.update(hp, 0.016); three.updateMatrixWorld(true);
    const L = lg.locate('ahead'); if (!L) { res.push({ deg, none: true }); continue; }
    const v0 = hp.clone().setY(0.2).project(three), v1 = new three.position.constructor(L.x, 0.2, L.z).project(three);
    res.push({ deg, to: [+(L.x - hp.x).toFixed(1), +(L.z - hp.z).toFixed(1)], screenDx: +(v1.x - v0.x).toFixed(2), screenDy: +(v1.y - v0.y).toFixed(2), land: !!lg.sb.island.isLand(L.x, L.z) });
  }
  cam.offset.copy(off0); cam.snapTo(hp);
  return res;
});
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
