// S77-SW: solve armR/sword rotations so the blade TIP hits target points in the hero frame (fwd, side(+ = sword hand), up).
// node tools/sword_solve.mjs   -> prints keyframes to paste into Combat.js (KF table)
import { launch, startStory } from './rig76.mjs';
const T = JSON.parse(process.argv[2] || 'null') || {
  s1_wind: { tip: [-0.1, 0.85, 2.3], dir: [-0.1, 0.2, 0.97], ty: 0, tx: -0.05 },   // forehand: blade high behind the sword shoulder
  s1_mid:  { tip: [1.6, 0.1, 1.25],  dir: [0.8, -0.2, 0.2],  ty: 0, tx: 0.15 },    // passes in front at head height, blade slanting down
  s1_end:  { tip: [1.0, -1.15, 0.55], dir: [0.5, -0.8, -0.3], ty: 0, tx: 0.25 },   // ends low across the body
  s2_wind: { tip: [0.9, -1.2, 1.0],  dir: [0.3, -0.95, 0.0],  ty: 0, tx: 0.1 },    // backhand: blade out on the OFF side, flat
  s2_mid:  { tip: [1.7, -0.1, 1.05], dir: [0.95, 0.1, 0.0],   ty: 0, tx: 0.15 },
  s2_end:  { tip: [0.65, 1.45, 1.1], dir: [0.25, 0.97, 0.0],  ty: 0, tx: 0.2 },    // finishes wide on the sword side
  th_wind: { tip: [0.35, 0.5, 1.0],  dir: [0.2, 0.2, 0.0],    ty: 0, tx: 0.1 },    // thrust: elbow back, blade level beside the hip
  th_end:  { tip: [2.55, 0.15, 1.05], dir: [0.99, 0.0, 0.05], ty: 0, tx: 0.2 },    // arm straight, point forward at chest height
  sp_out:  { tip: [0.1, 1.9, 1.0],   dir: [0.0, 1.0, 0.0],    ty: 0, tx: 0.1 },    // spin: blade fully out to the side, flat
};
const { p, b, errs } = await launch(844, 390); await startStory(p);
const out = await p.evaluate(async (T) => {
  const { solveArmClearance } = await import('/src/entities/HeroController.js');
  const h = lg.sb.hero, P = h.p; h.root.rotation.set(0, 0, 0); h.root.position.set(0, 0, 0);
  const res = {}; const THREE_V = h.root.position.constructor;
  const apply = (q, ty, tx) => { P.torso.rotation.set(tx, q[3], 0); P.armR.rotation.set(q[0], 0, q[1]); h.sword.rotation.set(q[2], 0, 0); P.armL.rotation.set(0.1, 0, 0.35); h.root.updateMatrixWorld(true); solveArmClearance(h); h.root.updateMatrixWorld(true); };
  const measure = () => { const tip = new THREE_V(0, 1.35, 0); h.sword.localToWorld(tip); const base = new THREE_V(0, 0.3, 0); h.sword.localToWorld(base); const d = tip.clone().sub(base).normalize(); return { tip: [tip.z, tip.x, tip.y], dir: [d.z, d.x, d.y] }; };
  let PREV = null; const cost = (q, t) => { apply(q, t.ty, t.tx); const m = measure(); let c = 0; for (let i = 0; i < 3; i++) c += (m.tip[i] - t.tip[i]) ** 2; const dd = m.dir[0] * t.dir[0] + m.dir[1] * t.dir[1] + m.dir[2] * t.dir[2]; const n = Math.hypot(...t.dir); c += 0.6 * (1 - dd / n); c += 0.004 * (q[0] ** 2 + q[1] ** 2) + 0.01 * q[3] ** 2; if (PREV && t.chain) for (let i = 0; i < 4; i++) c += 0.12 * (q[i] - PREV[i]) ** 2; return c; };
  for (const [name, t] of Object.entries(T)) {
    PREV = t.chain ? PREV : null; let best = t.chain && PREV ? PREV.slice() : [-1, 0.3, 1, 0], bc = cost(best, t);
    for (let r = 0; r < 6; r++) { let s = 1.2; let cur = r === 0 ? best.slice() : best.map((x) => x + (Math.random() - 0.5) * (t.chain ? 0.3 : 1)); let cc = cost(cur, t);
      for (let i = 0; i < 700; i++) { const cand = cur.map((x) => x + (Math.random() - 0.5) * 2 * s); cand[0] = Math.max(-3.0, Math.min(1.0, cand[0])); cand[1] = Math.max(-1.6, Math.min(1.6, cand[1])); cand[2] = Math.max(-1.0, Math.min(3.2, cand[2])); cand[3] = Math.max(-1.2, Math.min(1.2, cand[3])); const c2 = cost(cand, t); if (c2 < cc) { cc = c2; cur = cand; } if (i % 100 === 99) s *= 0.6; }
      if (cc < bc) { bc = cc; best = cur; } }
    PREV = best.slice(); apply(best, t.ty, t.tx); const m = measure();
    res[name] = { armX: +best[0].toFixed(2), armZ: +best[1].toFixed(2), swX: +best[2].toFixed(2), ty: +best[3].toFixed(2), tx: t.tx, gotTip: m.tip.map((x) => +x.toFixed(2)), wantTip: t.tip, cost: +bc.toFixed(3) };
  }
  return res;
}, T);
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(9), JSON.stringify(v));
console.log('errs', errs.slice(0, 3)); await b.close();
