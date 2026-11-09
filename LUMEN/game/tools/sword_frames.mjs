// S77-SW: frame-by-frame sword capture. node tools/sword_frames.mjs [step=0|1|2] [frameMs=40] [tag]
// Stops the RAF loop, drives game._frame() with synthetic time, screenshots a zoomed crop of Pip every frame, builds a contact sheet.
import { launch, startStory } from './rig76.mjs';
import fs from 'node:fs';
const STEP = +process.argv[2] || 0, FMS = +process.argv[3] || 16, TAG = process.argv[4] || 'before';
const STEP_ = STEP; const { p, b, errs } = await launch(844, 390); await startStory(p);
await p.evaluate(() => { const g = lg.game; g.stop(); window.__t = performance.now(); window.__tick = (ms) => { window.__t += ms; g._frame(window.__t); };
  const sb = lg.sb; for (const c of [...(sb.cust?.active || [])]) sb.cust._release?.(c);
  g.camera.zoom = 0.5; g.camera.offset.set(5.2, 3.2, 6.2); g.camera.shake = () => {}; sb.hero.root.position.set(0, 0, 3); sb.hero.facing = 0; sb.hero.root.rotation.y = 0; sb.hero.state = 'idle'; g.camera.snapTo?.(sb.hero.root.position); for (let i = 0; i < 20; i++) window.__tick(16); });
const dir = `/home/user/webapp/LUMEN/game/tools/shots/sword_${TAG}_s${STEP}`; fs.mkdirSync(dir, { recursive: true });
// advance combo to the wanted step by pressing attack and letting the chain fire
await p.evaluate(() => { lg.sb.hero.combat.attack(); });
// STEP>0: tick through earlier steps (hammering attack during each recovery), only START logging when the wanted step begins
let pre = 0; while (STEP > 0 && pre < 400) { const st = await p.evaluate(([ms, W]) => { window.__tick(ms); const C = lg.sb.hero.combat; if (C.step < W) { if (C.seqs[C.step]?.currentName === 'recovery') C.attack(); } return C.step; }, [16, STEP]); pre++; if (st >= STEP) break; }
const frames = []; let n = 0;
const clip = async () => { const bb = await p.evaluate(() => { const g = lg.game, h = lg.sb.hero, v = h.root.position.clone(); v.y += 1.1; v.project(g.camera.three); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; }); return { x: Math.max(0, Math.round(bb.x - 150)), y: Math.max(0, Math.round(bb.y - 120)), width: 300, height: 240 }; };
let c0 = await clip();
for (let f = 0; f < 90; f++) {
  const info = await p.evaluate((ms) => { window.__tick(ms); const h = lg.sb.hero, C = h.combat; const bl = h.sword; const pp = h.p; const wp = new (h.root.position.constructor)(); bl.getWorldPosition(wp);
    const tip = new (h.root.position.constructor)(0, 1.35, 0); bl.localToWorld(tip); const rel = tip.clone().sub(h.root.position); const fy = h.root.rotation.y; const fwd = rel.x * Math.sin(fy) + rel.z * Math.cos(fy), side = rel.x * Math.cos(fy) - rel.z * Math.sin(fy);
    return { step: C.step, phase: C.seqs[C.step]?.currentName || null, tipFwd: +fwd.toFixed(2), tipSide: +side.toFixed(2), tipUp: +rel.y.toFixed(2), yaw: +fy.toFixed(2), armR: pp.armR.rotation.toArray().slice(0, 3).map((x) => +x.toFixed(2)), sw: bl.rotation.toArray().slice(0, 3).map((x) => +x.toFixed(2)), torsoY: +pp.torso.rotation.y.toFixed(2) }; }, FMS);
  if (f === 0) c0 = await clip();
  const file = `${dir}/f${String(f).padStart(2, '0')}.png`; await p.screenshot({ path: file, clip: c0 }); frames.push({ f, file, ...info });
  if (info.step === -1 && f > 3) break; if (STEP > 0 && f === 0) {}
}
fs.writeFileSync(`${dir}/log.json`, JSON.stringify(frames.map(({ file, ...r }) => r), null, 0));
for (const r of frames) console.log(r.f, r.phase, 'tip fwd', r.tipFwd, 'side', r.tipSide, 'up', r.tipUp, 'yaw', r.yaw, 'armR', r.armR.join(','), 'sw', r.sw.join(','));
console.log('errs', errs.slice(0, 3)); await b.close();
