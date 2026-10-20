// Chat 1D — Props: Decor. The 4 FinLit Jars, fences, crates, barrels, lanterns, signs, bench, path tiles,
// banner string, flower pot, water trough — for the Glowmarket island.
// Every prop: makeX(opts) → THREE.Group, pivot at BASE (y=0), toon + outline, baked with mergeGroup
// so a prop = 1–2 merged meshes (+ ≤ 1 kept animated mesh) → ≤ 6 draw calls incl. outline.
//
// Contract (API_CONTRACTS §B "Props"):
//   export const DECOR_PROPS = { jar_spend: { make, footprint:[1,1], category:'decor', name, cost, tris }, ... }
//   makeJar(kind, opts)  kind ∈ JAR_KINDS = ['spend','save','invest','protect']
//     group.userData.setFill(0..1)        → scales the glowing Spark disc in the jar mouth (+ rim ring)
//     group.userData.fill                 → current 0..1
//     group.userData.jarKind / .color
//   makeJarFillSequence(jar, { from, to, onDone }) → Sequence  (the J-key animation, also used by check.mjs)
//     phase table: anticipation 120 ms inOutCubic (jar squashes 0.92 as it "inhales")
//                  fill         400 ms outCubic   (disc scales from→to, jar stretches 1.06 → 1.0)
//                  wobble       200 ms outElastic (jar squash overshoot settles to 1)
//   lanterns: group.userData.setLit(bool) → swaps glass material toon(dark amber) → flatMat(glow) ; .lit
//   banner_string: group.userData.sway(t) → flags wave (pure function of t) ; swayDecor(t) drives all built so far
//
// opts for every makeX: { seed?, scale?, outline? (default true), lit? (lanterns), fill? (jars), sway? (banner) }

import * as THREE from '../../../vendor/three.module.js';
import { G, mesh, group, rng, vary } from '../geo.js';
import { PALETTE as P, toonMat, flatMat } from '../../core/Toon.js';
import { addOutline } from '../../core/Outline.js';
import { mergeGroup } from './merge.js';
import { Sequence } from '../../anim/Sequencer.js';
import { Easing } from '../../anim/Easing.js';

// ---------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------
export const DECOR_COLORS = {
  clay: 0xd98c5f, clayDark: 0xb86f47, clayLight: 0xe8a77c, lid: 0x8d5a3b,
  spend: P.red, save: 0x66bb6a, invest: 0x42a5f5, protect: P.sparkGold,
  spendDark: 0xc62828, saveDark: 0x2e7d32, investDark: 0x1565c0, protectDark: 0xf9a825,
  glow: 0xffe082, glowDark: 0xffca28, glassOff: 0xc9a86a, flame: 0xffab40,
  wood: P.wood, woodDark: P.woodDark, woodLight: 0xbf8f63, plank: 0xc49a6c,
  metal: P.metal, metalDark: P.metalDark, iron: 0x546e7a, rope: 0xd7b98e,
  stone: P.stone, stoneDark: P.stoneDark, stoneLight: 0xbdbdbd, dirt: P.dirt, dirtDark: 0xa97f4f,
  paper: 0xfff3d6, ink: P.black, white: P.white, water: P.water,
  flag1: P.red, flag2: P.sparkGold, flag3: P.glimmerBlue, flag4: 0x81c784, flag5: 0xf48fb1,
  leaf: P.leaf, leafDark: P.leafDark, petal: 0xff7eb3, petal2: 0xffd54f, soil: 0x6d4c41,
};
const C = DECOR_COLORS;
export const JAR_KINDS = ['spend', 'save', 'invest', 'protect'];
export const JAR_LABELS = { spend: 'Spend', save: 'Save', invest: 'Invest', protect: 'Protect' };

// Every swaying decor prop built so far (banner strings, hanging signs/lanterns) → swayDecor(t) drives all.
const _swayers = new Set();
/** Drive wind on every decor prop that sways. Call once per frame with game.time (seconds). Pure fn of t. */
export function swayDecor(t) { for (const s of _swayers) s(t); }

// ---------------------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------------------
/** Bake `raw` into merged meshes. `keep(mesh)` leaves animated meshes un-merged. */
function finish(raw, kind, opts, { footprint = [1, 1], name = kind, keep = null, sway = null, premerged = false } = {}) {
  const out = premerged ? raw : mergeGroup(raw, keep ? { keep } : {});
  out.scale.setScalar(opts.scale ?? 1);
  out.name = kind;
  out.userData.kind = kind; out.userData.name = name;
  out.userData.footprint = footprint; out.userData.category = 'decor';
  if (sway) {
    out.userData.sway = sway;
    if (opts.sway !== false) _swayers.add(sway);
    out.userData.dispose = () => _swayers.delete(sway);
  } else { out.userData.sway = () => {}; out.userData.dispose = () => {}; }
  if (opts.outline !== false) addOutline(out);
  return out;
}
/** Find the merged toon mesh after finish() (for squash animations on the whole prop body). */
function bodyOf(g) { return g.children.find((o) => o.name === 'merged_toon') || g; }
/** Cylinder with base pivot. */
function post(rt, rb, h, color, x = 0, z = 0, seg = 8) { return mesh(G.cyl(rt, rb, h, seg), color, x, h / 2, z); }
/** Box with base pivot (alias to keep code short). */
function blk(w, h, d, color, x = 0, y = 0, z = 0) { return mesh(G.box(w, h, d), color, x, y + h / 2, z); }
/** Thin flat disc facing +Z (emblem / sign dots). */
function disc(r, color, x, y, z, flat = false) {
  const m = mesh(G.cyl(r, r, 0.03, 12), flat ? flatMat(color) : color, x, y, z);
  m.rotation.x = Math.PI / 2; return m;
}

// ---------------------------------------------------------------------------------------
// P1 — THE FOUR JARS (FinLit centrepiece: Spend red · Save green · Invest blue · Protect gold)
// ---------------------------------------------------------------------------------------
/**
 * Chunky clay jar, ~0.75 tall, mouth tilted toward the ¾ camera. Lid sits ajar on the back rim so
 * the glowing Spark disc in the mouth reads from above. Colored band + emblem on the front.
 * userData.setFill(f) scales the glow disc (0 → hidden, 1 → full mouth) and lifts it 0..0.06.
 */
export function makeJar(kind = 'spend', opts = {}) {
  if (!JAR_KINDS.includes(kind)) throw new Error(`[decor] unknown jar kind "${kind}"`);
  const r = rng((opts.seed ?? 1) * 131 + JAR_KINDS.indexOf(kind));
  const col = C[kind], colDark = C[kind + 'Dark'];
  const clay = vary(C.clay, 0.05, r);
  const raw = new THREE.Group();
  // body: foot → belly → neck (three stacked cylinders, 10 segs for a round toy look)
  raw.add(mesh(G.cyl(0.26, 0.22, 0.12, 10), C.clayDark, 0, 0.06, 0));            // foot
  raw.add(mesh(G.cyl(0.36, 0.26, 0.30, 10), clay, 0, 0.27, 0));                  // lower belly
  raw.add(mesh(G.cyl(0.30, 0.36, 0.22, 10), clay, 0, 0.53, 0));                  // upper belly
  raw.add(mesh(G.cyl(0.24, 0.30, 0.08, 10), C.clayLight, 0, 0.68, 0));           // neck
  const rim = mesh(G.torus(0.24, 0.035, 6, 12), C.clayLight, 0, 0.73, 0); rim.rotation.x = Math.PI / 2; raw.add(rim); // rim
  // colored band around the belly + front emblem (flat colored disc + white inner dot = readable icon)
  raw.add(mesh(G.cyl(0.365, 0.365, 0.08, 10), col, 0, 0.42, 0));                 // band
  raw.add(disc(0.11, col, 0, 0.42, 0.355));                                      // emblem plate
  raw.add(disc(0.07, C.white, 0, 0.42, 0.375));                                  // emblem face
  // emblem glyph: spend = coin slot bar · save = small pig-ish dome · invest = up-arrow · protect = shield notch
  if (kind === 'spend') raw.add(blk(0.08, 0.025, 0.03, colDark, 0, 0.405, 0.385));
  if (kind === 'save') raw.add(mesh(G.sphere(0.035, 8, 6), colDark, 0, 0.42, 0.39));
  if (kind === 'invest') { const a = blk(0.025, 0.09, 0.03, colDark, 0, 0.375, 0.385); const h = mesh(G.cone(0.04, 0.05, 4), colDark, 0, 0.465, 0.4); h.rotation.y = Math.PI / 4; raw.add(a, h); }
  if (kind === 'protect') { const s = blk(0.07, 0.08, 0.03, colDark, 0, 0.38, 0.385); raw.add(s); }
  // lid, ajar: rests on the back rim, tilted up toward -Z so the mouth is open to the camera (+Z, above)
  const lid = new THREE.Group();
  lid.add(mesh(G.cyl(0.26, 0.26, 0.06, 10), C.lid, 0, 0.03, 0));
  lid.add(mesh(G.sphere(0.06, 8, 6), col, 0, 0.09, 0));                          // colored knob
  lid.position.set(0, 0.74, -0.12); lid.rotation.x = -0.75;
  raw.add(lid);
  // glow disc: KEPT (animated), unlit Spark color, no outline
  const glow = mesh(G.cyl(0.22, 0.22, 0.04, 12), flatMat(C.glow), 0, 0.72, 0);
  glow.castShadow = false; glow.userData.noOutline = true; glow.name = 'glow';
  raw.add(glow);
  const out = finish(raw, 'jar_' + kind, opts, { name: JAR_LABELS[kind] + ' Jar', keep: (m) => m === glow });
  out.userData.jarKind = kind; out.userData.color = col; out.userData.glow = glow;
  out.userData.fill = -1;
  out.userData.setFill = (f) => {
    f = Math.min(1, Math.max(0, +f || 0));
    out.userData.fill = f;
    const s = 0.05 + 0.95 * f;              // never 0 → no degenerate matrix / NaN outline
    glow.scale.set(s, 1, s);
    glow.position.y = 0.66 + 0.06 * f;
    glow.visible = f > 0.01;
  };
  out.userData.setFill(opts.fill ?? 0.5);
  return out;
}
export const makeJarSpend = (o) => makeJar('spend', o);
export const makeJarSave = (o) => makeJar('save', o);
export const makeJarInvest = (o) => makeJar('invest', o);
export const makeJarProtect = (o) => makeJar('protect', o);

/**
 * Jar fill animation (key J in the demo). Phase table (ms · easing):
 *   anticipation 120 · inOutCubic  body squash 1 → 0.92 (inhale), disc holds `from`
 *   fill         400 · outCubic    disc from → to ; body 0.92 → 1.06 (stretch as Spark pours in)
 *   wobble       200 · outElastic  body 1.06 → 1.0 (overshoot settle)
 * Pose is set ABSOLUTELY from values snapshotted in onEnter → frame-rate independent.
 */
export function makeJarFillSequence(jar, { from = 0, to = 1, onDone = null } = {}) {
  const body = bodyOf(jar);
  const sq = (a) => { const side = 1 / Math.sqrt(Math.max(0.05, a)); body.scale.set(side, a, side); };
  const seq = new Sequence('jarFill')
    .phase('anticipation', 120, Easing.inOutCubic, (e) => { sq(1 - 0.08 * e); jar.userData.setFill(from); },
      { onEnter: () => { jar.userData.setFill(from); } })
    .phase('fill', 400, Easing.outCubic, (e) => { jar.userData.setFill(from + (to - from) * e); sq(0.92 + 0.14 * e); })
    .phase('wobble', 200, Easing.outElastic, (e) => { sq(1.06 + (1 - 1.06) * e); jar.userData.setFill(to); })
    .then(() => { sq(1); jar.userData.setFill(to); onDone && onDone(jar); });
  return seq;
}

// ---------------------------------------------------------------------------------------
// P1 — FENCE POST · FENCE RAIL (1 tile) · CRATE · BARREL
// ---------------------------------------------------------------------------------------
export function makeFencePost(opts = {}) {
  const r = rng((opts.seed ?? 1) * 17);
  const raw = new THREE.Group();
  raw.add(blk(0.16, 0.9, 0.16, vary(C.wood, 0.05, r)));
  const cap = mesh(G.cone(0.14, 0.14, 4), C.woodDark, 0, 0.97, 0); cap.rotation.y = Math.PI / 4; raw.add(cap);
  raw.add(blk(0.18, 0.08, 0.18, C.woodDark, 0, 0, 0));                           // foot band
  return finish(raw, 'fence_post', opts, { name: 'Fence Post' });
}
/** One tile of fence: post at x=-0.5, two rails to x=+0.5 (chain tiles along X; add a final post). */
export function makeFenceRail(opts = {}) {
  const r = rng((opts.seed ?? 1) * 23);
  const raw = new THREE.Group();
  raw.add(blk(0.16, 0.9, 0.16, vary(C.wood, 0.05, r), -0.5, 0, 0));
  const cap = mesh(G.cone(0.14, 0.14, 4), C.woodDark, -0.5, 0.97, 0); cap.rotation.y = Math.PI / 4; raw.add(cap);
  raw.add(blk(1.0, 0.1, 0.06, vary(C.woodLight, 0.05, r), 0, 0.62, 0));          // top rail
  raw.add(blk(1.0, 0.1, 0.06, vary(C.woodLight, 0.05, r), 0, 0.30, 0));          // low rail
  return finish(raw, 'fence_rail', opts, { name: 'Fence Rail' });
}
export function makeCrate(opts = {}) {
  const r = rng((opts.seed ?? 1) * 29);
  const s = 0.6;
  const raw = new THREE.Group();
  raw.add(mesh(G.rbox(s, s, s, 0.04), vary(C.plank, 0.06, r), 0, s / 2, 0));
  // edge battens (4 vertical + 2 cross on front) — chunky toy crate
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) raw.add(blk(0.08, s + 0.02, 0.08, C.woodDark, x * (s / 2 - 0.02), 0, z * (s / 2 - 0.02)));
  const c1 = blk(0.07, s * 1.25, 0.03, C.woodDark, 0, 0, s / 2 + 0.01); c1.position.y = s / 2; c1.rotation.z = Math.PI / 4; raw.add(c1);
  const c2 = blk(0.07, s * 1.25, 0.03, C.woodDark, 0, 0, s / 2 + 0.01); c2.position.y = s / 2; c2.rotation.z = -Math.PI / 4; raw.add(c2);
  raw.add(blk(s + 0.04, 0.07, s + 0.04, C.woodDark, 0, s - 0.03, 0));            // top rim
  return finish(raw, 'crate', opts, { name: 'Crate' });
}
export function makeBarrel(opts = {}) {
  const r = rng((opts.seed ?? 1) * 31);
  const raw = new THREE.Group();
  const wood = vary(C.wood, 0.06, r);
  raw.add(mesh(G.cyl(0.26, 0.30, 0.28, 10), wood, 0, 0.14, 0));
  raw.add(mesh(G.cyl(0.30, 0.26, 0.28, 10), wood, 0, 0.42, 0));
  raw.add(mesh(G.cyl(0.25, 0.25, 0.04, 10), C.woodDark, 0, 0.57, 0));           // top disc
  for (const y of [0.12, 0.44]) raw.add(mesh(G.cyl(0.31, 0.31, 0.05, 10), C.iron, 0, y, 0)); // iron hoops
  return finish(raw, 'barrel', opts, { name: 'Barrel' });
}

// ---------------------------------------------------------------------------------------
// P2 — FENCE GATE · LANTERNS · SIGNS · BENCH · PATH TILES
// ---------------------------------------------------------------------------------------
export function makeFenceGate(opts = {}) {
  const r = rng((opts.seed ?? 1) * 37);
  const raw = new THREE.Group();
  for (const x of [-0.6, 0.6]) {
    raw.add(blk(0.18, 1.1, 0.18, vary(C.wood, 0.05, r), x, 0, 0));
    const cap = mesh(G.cone(0.16, 0.16, 4), C.woodDark, x, 1.18, 0); cap.rotation.y = Math.PI / 4; raw.add(cap);
  }
  raw.add(blk(1.3, 0.12, 0.08, C.woodDark, 0, 1.0, 0));                           // lintel
  // two gate leaves (slightly open, toy-like): 3 slats + diagonal each
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    for (const sx of [0.12, 0.30, 0.48]) leaf.add(blk(0.1, 0.78, 0.05, C.woodLight, side * sx, 0.08, 0));
    leaf.add(blk(0.5, 0.08, 0.04, C.wood, side * 0.3, 0.72, 0.03)); leaf.add(blk(0.5, 0.08, 0.04, C.wood, side * 0.3, 0.16, 0.03));
    leaf.position.set(side * 0.5, 0, 0); leaf.rotation.y = side * -0.35;          // ajar, inviting
    raw.add(leaf);
  }
  return finish(raw, 'fence_gate', opts, { footprint: [2, 1], name: 'Fence Gate' });
}

/** Shared lantern head: cage box + glass (kept, swappable material) + little roof. Returns { head, glass }. */
function lanternHead(raw, x, y, z, size = 0.22) {
  const head = new THREE.Group();
  head.add(blk(size, 0.04, size, C.iron, 0, 0, 0));                                // floor
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) head.add(blk(0.03, size + 0.04, 0.03, C.iron, dx * (size / 2 - 0.015), 0.02, dz * (size / 2 - 0.015)));
  const roof = mesh(G.cone(size * 0.85, 0.14, 4), C.iron, 0, size + 0.12, 0); roof.rotation.y = Math.PI / 4; head.add(roof);
  head.add(mesh(G.sphere(0.035, 6, 5), C.iron, 0, size + 0.2, 0));                 // finial
  const glass = mesh(G.box(size - 0.07, size - 0.04, size - 0.07), toonMat(C.glassOff), 0, size / 2 + 0.02, 0);
  glass.name = 'glass'; glass.castShadow = false; head.add(glass);
  head.position.set(x, y, z); raw.add(head);
  return { head, glass };
}
function litApi(out, glass, opts) {
  const on = flatMat(C.glow), off = toonMat(C.glassOff);
  out.userData.glass = glass; out.userData.lit = null;
  out.userData.setLit = (v) => { v = !!v; if (out.userData.lit === v) return; out.userData.lit = v; glass.material = v ? on : off; };
  out.userData.setLit(opts.lit ?? true);
}
export function makeLanternPost(opts = {}) {
  const raw = new THREE.Group();
  raw.add(mesh(G.cyl(0.14, 0.18, 0.1, 8), C.stoneDark, 0, 0.05, 0));              // stone foot
  raw.add(post(0.04, 0.05, 1.4, C.iron, 0, 0, 6));
  raw.add(blk(0.3, 0.04, 0.04, C.iron, 0.12, 1.36, 0));                             // arm
  const { glass } = lanternHead(raw, 0.26, 1.02, 0, 0.22);
  const out = finish(raw, 'lantern_post', opts, { name: 'Post Lantern', keep: (m) => m === glass });
  litApi(out, glass, opts);
  return out;
}
/** Hanging lantern: a hook/bracket at 1.1 (hang it on a stall or tree) — the head swings gently (sway). */
export function makeLanternHanging(opts = {}) {
  const r = rng((opts.seed ?? 1) * 41);
  const phase = r() * Math.PI * 2;
  const raw = new THREE.Group();
  raw.add(blk(0.06, 0.5, 0.06, C.iron, 0, 0.75, 0));                                // bracket stem
  raw.add(blk(0.32, 0.05, 0.05, C.iron, 0.13, 1.22, 0));                            // bracket arm
  const swing = new THREE.Group();                                                  // pivot at hook
  swing.add(mesh(G.torus(0.04, 0.012, 5, 8), C.iron, 0, -0.04, 0));
  const { glass } = lanternHead(swing, 0, -0.44, 0, 0.2);
  swing.position.set(0.26, 1.22, 0); raw.add(swing);
  // bake bracket and swing separately so the swing can rotate
  raw.remove(swing);
  const base = mergeGroup(raw); base.name = 'base';
  const swingPos = swing.position.clone(); swing.position.set(0, 0, 0);
  const swingM = mergeGroup(swing, { keep: (m) => m === glass }); swingM.position.copy(swingPos); swingM.name = 'swing';
  const wrap = new THREE.Group(); wrap.add(base, swingM);
  const sway = (t) => { swingM.rotation.z = Math.sin(t * 1.7 + phase) * 0.08; swingM.rotation.x = Math.cos(t * 1.2 + phase) * 0.05; };
  const out = finish(wrap, 'lantern_hanging', opts, { name: 'Hanging Lantern', premerged: true, sway });
  litApi(out, glass, opts);
  return out;
}

/** Arrow sign: post + arrow plank pointing +X (rotate the group to aim). */
export function makeSignArrow(opts = {}) {
  const r = rng((opts.seed ?? 1) * 43);
  const raw = new THREE.Group();
  raw.add(post(0.05, 0.06, 1.1, vary(C.wood, 0.05, r), 0, 0, 6));
  const plank = blk(0.7, 0.24, 0.06, C.plank, 0.12, 0.78, 0);
  const tip = mesh(G.cone(0.17, 0.16, 4), C.plank, 0.55, 0.9, 0); tip.rotation.z = -Math.PI / 2; tip.rotation.x = Math.PI / 4;
  raw.add(plank, tip);
  raw.add(blk(0.4, 0.05, 0.02, C.ink, 0.1, 0.875, 0.035));                          // "text" line
  raw.add(disc(0.045, C.spend, -0.14, 0.9, 0.04));                                  // colored dot
  return finish(raw, 'sign_arrow', opts, { name: 'Arrow Sign' });
}
/** Board sign: two posts + wide board (price board / notice). */
export function makeSignBoard(opts = {}) {
  const r = rng((opts.seed ?? 1) * 47);
  const raw = new THREE.Group();
  for (const x of [-0.42, 0.42]) raw.add(blk(0.1, 1.2, 0.1, vary(C.wood, 0.05, r), x, 0, 0));
  raw.add(mesh(G.rbox(1.0, 0.6, 0.06, 0.03), C.plank, 0, 0.85, 0));
  raw.add(mesh(G.rbox(0.86, 0.46, 0.02, 0.02), C.paper, 0, 0.85, 0.035));
  for (const [y, w] of [[0.97, 0.6], [0.86, 0.5], [0.75, 0.4]]) raw.add(blk(w, 0.04, 0.015, C.ink, -0.05 + (0.6 - w) / 2 * -1, y - 0.02, 0.05));
  raw.add(disc(0.07, C.protect, 0.3, 0.75, 0.055));                                  // gold coin sticker
  return finish(raw, 'sign_board', opts, { footprint: [1, 1], name: 'Board Sign' });
}
/** Hanging sign: bracket post + swinging board (sway). */
export function makeSignHanging(opts = {}) {
  const r = rng((opts.seed ?? 1) * 53);
  const phase = r() * Math.PI * 2;
  const raw = new THREE.Group();
  raw.add(post(0.06, 0.07, 1.6, vary(C.wood, 0.05, r), 0, 0, 6));
  raw.add(blk(0.7, 0.07, 0.07, C.woodDark, 0.3, 1.55, 0));
  raw.add(mesh(G.sphere(0.06, 6, 5), C.woodDark, 0, 1.64, 0));
  const swing = new THREE.Group();
  for (const x of [-0.2, 0.2]) swing.add(blk(0.025, 0.14, 0.025, C.iron, x, -0.14, 0));
  swing.add(mesh(G.rbox(0.56, 0.36, 0.05, 0.03), C.plank, 0, -0.32, 0));
  swing.add(disc(0.1, C.invest, 0, -0.32, 0.035)); swing.add(disc(0.06, C.white, 0, -0.32, 0.05));
  swing.position.set(0.42, 1.55, 0); raw.add(swing);
  raw.remove(swing);
  const base = mergeGroup(raw); base.name = 'base';
  const sp = swing.position.clone(); swing.position.set(0, 0, 0);
  const sw = mergeGroup(swing); sw.position.copy(sp); sw.name = 'swing';
  const wrap = new THREE.Group(); wrap.add(base, sw);
  const sway = (t) => { sw.rotation.x = Math.sin(t * 1.5 + phase) * 0.07; };
  return finish(wrap, 'sign_hanging', opts, { name: 'Hanging Sign', premerged: true, sway });
}
export function makeBench(opts = {}) {
  const r = rng((opts.seed ?? 1) * 59);
  const raw = new THREE.Group();
  const wood = vary(C.plank, 0.05, r);
  for (const x of [-0.5, 0.5]) { raw.add(blk(0.1, 0.42, 0.38, C.woodDark, x, 0, 0)); raw.add(blk(0.1, 0.5, 0.08, C.woodDark, x, 0.42, -0.15)); }
  raw.add(blk(1.3, 0.08, 0.2, wood, 0, 0.42, 0.1)); raw.add(blk(1.3, 0.08, 0.16, wood, 0, 0.42, -0.1));   // seat slats
  raw.add(blk(1.3, 0.12, 0.06, wood, 0, 0.72, -0.16)); raw.add(blk(1.3, 0.1, 0.06, wood, 0, 0.56, -0.16)); // back slats
  return finish(raw, 'bench', opts, { footprint: [2, 1], name: 'Bench' });
}
/** Flat 1×1 dirt slab (top at y=0.04) with two pebbles. */
export function makePathDirt(opts = {}) {
  const r = rng((opts.seed ?? 1) * 61);
  const raw = new THREE.Group();
  const slab = mesh(G.box(0.96, 0.04, 0.96), vary(C.dirt, 0.05, r), 0, 0.02, 0); slab.castShadow = false; raw.add(slab);
  for (let i = 0; i < 2; i++) { const p = mesh(G.dodeca(0.05), C.dirtDark, (r() - 0.5) * 0.7, 0.04, (r() - 0.5) * 0.7); p.scale.y = 0.5; p.castShadow = false; raw.add(p); }
  return finish(raw, 'path_dirt', opts, { name: 'Dirt Path' });
}
/** Flat 1×1 stone slab: 4–5 flagstones on a dark grout slab (top at y≈0.05). */
export function makePathStone(opts = {}) {
  const r = rng((opts.seed ?? 1) * 67);
  const raw = new THREE.Group();
  const grout = mesh(G.box(0.96, 0.04, 0.96), C.stoneDark, 0, 0.02, 0); grout.castShadow = false; raw.add(grout);
  const cells = [[-0.24, -0.24, 0.42, 0.42], [0.24, -0.24, 0.42, 0.42], [-0.24, 0.24, 0.42, 0.42], [0.24, 0.24, 0.42, 0.42]];
  for (const [x, z, w, d] of cells) { const s = mesh(G.box(w, 0.03, d), vary(C.stone, 0.08, r), x, 0.045, z); s.castShadow = false; s.rotation.y = (r() - 0.5) * 0.1; raw.add(s); }
  return finish(raw, 'path_stone', opts, { name: 'Stone Path' });
}

// ---------------------------------------------------------------------------------------
// P3 — BANNER STRING · FLOWER POT · WATER TROUGH
// ---------------------------------------------------------------------------------------
/** Two posts 2 tiles apart with a rope and 7 pennant flags; flags are ONE merged mesh that waves (rotation). */
export function makeBannerString(opts = {}) {
  const r = rng((opts.seed ?? 1) * 71);
  const phase = r() * Math.PI * 2;
  const raw = new THREE.Group();
  for (const x of [-1, 1]) { raw.add(post(0.05, 0.06, 1.5, vary(C.wood, 0.05, r), x, 0, 6)); raw.add(mesh(G.sphere(0.06, 6, 5), C.spend, x, 1.55, 0)); }
  // rope: 6 short segments on a shallow catenary
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = -1 + (2 * i) / n, x1 = -1 + (2 * (i + 1)) / n;
    const y0 = 1.48 - 0.12 * (1 - x0 * x0), y1 = 1.48 - 0.12 * (1 - x1 * x1);
    const seg = mesh(G.cyl(0.012, 0.012, Math.hypot(x1 - x0, y1 - y0) + 0.01, 4), C.rope, (x0 + x1) / 2, (y0 + y1) / 2, 0);
    seg.rotation.z = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2; seg.castShadow = false; raw.add(seg);
  }
  const flags = new THREE.Group();
  const cols = [C.flag1, C.flag2, C.flag3, C.flag4, C.flag5, C.flag1, C.flag2];
  for (let i = 0; i < 7; i++) {
    const x = -0.85 + (1.7 * i) / 6, y = 1.47 - 0.12 * (1 - x * x);
    const f = mesh(G.cone(0.1, 0.22, 4), cols[i], x, y - 0.12, 0); f.rotation.x = Math.PI; f.rotation.y = Math.PI / 4; f.scale.z = 0.25; f.castShadow = false;
    flags.add(f);
  }
  raw.add(flags);
  raw.remove(flags);
  const base = mergeGroup(raw); base.name = 'base';
  const flagsM = mergeGroup(flags); flagsM.name = 'flags';
  // wave: rotate the whole flag row around the rope axis (X) + tiny z lean, pure fn of time
  flagsM.position.set(0, 1.47, 0); flagsM.children.forEach((m) => { m.position.y -= 1.47; });
  const wrap = new THREE.Group(); wrap.add(base, flagsM);
  const sway = (t) => { flagsM.rotation.x = Math.sin(t * 2.2 + phase) * 0.22; flagsM.rotation.z = Math.cos(t * 1.3 + phase) * 0.03; };
  return finish(wrap, 'banner_string', opts, { footprint: [2, 1], name: 'Banner String', premerged: true, sway });
}
export function makeFlowerPot(opts = {}) {
  const r = rng((opts.seed ?? 1) * 73);
  const raw = new THREE.Group();
  raw.add(mesh(G.cyl(0.2, 0.15, 0.28, 10), vary(C.clay, 0.05, r), 0, 0.14, 0));
  raw.add(mesh(G.cyl(0.22, 0.22, 0.06, 10), C.clayLight, 0, 0.3, 0));
  raw.add(mesh(G.cyl(0.17, 0.17, 0.03, 10), C.soil, 0, 0.34, 0));
  const petals = [C.petal, C.petal2, C.flag3, C.flag5];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r(), x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08, h = 0.18 + r() * 0.1;
    const stem = post(0.012, 0.012, h, C.leafDark, x, z, 4); stem.position.y = 0.34 + h / 2; raw.add(stem);
    raw.add(mesh(G.dodeca(0.06), petals[(i + (opts.seed ?? 1)) % petals.length], x, 0.36 + h, z));
  }
  const leaf = mesh(G.dodeca(0.07), C.leaf, 0.1, 0.4, -0.06); leaf.scale.set(1.3, 0.6, 1); raw.add(leaf);
  return finish(raw, 'flower_pot', opts, { name: 'Flower Pot' });
}
/** Water trough: wooden box with a flat unlit water surface (merges into the flat bucket). */
export function makeWaterTrough(opts = {}) {
  const r = rng((opts.seed ?? 1) * 79);
  const raw = new THREE.Group();
  const wood = vary(C.wood, 0.05, r);
  raw.add(blk(1.2, 0.44, 0.5, wood, 0, 0, 0));
  for (const x of [-0.5, 0.5]) raw.add(blk(0.08, 0.5, 0.56, C.woodDark, x, 0, 0));
  for (const z of [-0.25, 0.25]) raw.add(blk(1.26, 0.06, 0.06, C.iron, 0, 0.3, z));
  const water = mesh(G.box(1.04, 0.02, 0.38), flatMat(C.water), 0, 0.4, 0); water.castShadow = false; water.userData.noOutline = true; raw.add(water);
  raw.add(mesh(G.sphere(0.03, 6, 5), C.white, 0.3, 0.41, 0.08)); raw.add(mesh(G.sphere(0.025, 6, 5), C.white, -0.25, 0.41, -0.06));   // glints
  return finish(raw, 'water_trough', opts, { footprint: [2, 1], name: 'Water Trough' });
}

// ---------------------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------------------
const entry = (make, name, footprint = [1, 1], cost = 0) => ({ make, footprint, category: 'decor', name, cost, tris: 0 });
export const DECOR_PROPS = {
  jar_spend:       entry(makeJarSpend, 'Spend Jar', [1, 1], 0),
  jar_save:        entry(makeJarSave, 'Save Jar', [1, 1], 0),
  jar_invest:      entry(makeJarInvest, 'Invest Jar', [1, 1], 0),
  jar_protect:     entry(makeJarProtect, 'Protect Jar', [1, 1], 0),
  fence_post:      entry(makeFencePost, 'Fence Post', [1, 1], 3),
  fence_rail:      entry(makeFenceRail, 'Fence Rail', [1, 1], 5),
  fence_gate:      entry(makeFenceGate, 'Fence Gate', [2, 1], 12),
  crate:           entry(makeCrate, 'Crate', [1, 1], 4),
  barrel:          entry(makeBarrel, 'Barrel', [1, 1], 5),
  lantern_post:    entry(makeLanternPost, 'Post Lantern', [1, 1], 15),
  lantern_hanging: entry(makeLanternHanging, 'Hanging Lantern', [1, 1], 12),
  sign_arrow:      entry(makeSignArrow, 'Arrow Sign', [1, 1], 6),
  sign_board:      entry(makeSignBoard, 'Board Sign', [1, 1], 10),
  sign_hanging:    entry(makeSignHanging, 'Hanging Sign', [1, 1], 10),
  bench:           entry(makeBench, 'Bench', [2, 1], 12),
  path_dirt:       entry(makePathDirt, 'Dirt Path', [1, 1], 1),
  path_stone:      entry(makePathStone, 'Stone Path', [1, 1], 2),
  banner_string:   entry(makeBannerString, 'Banner String', [2, 1], 15),
  flower_pot:      entry(makeFlowerPot, 'Flower Pot', [1, 1], 4),
  water_trough:    entry(makeWaterTrough, 'Water Trough', [2, 1], 8),
};
export const DECOR_IDS = Object.keys(DECOR_PROPS);
export const JAR_IDS = JAR_KINDS.map((k) => 'jar_' + k);
export const LANTERN_IDS = ['lantern_post', 'lantern_hanging'];
