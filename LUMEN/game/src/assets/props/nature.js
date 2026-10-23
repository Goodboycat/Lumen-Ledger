// Chat 1B — Props: Nature. Trees, rocks, bushes, flower field, grass tufts for the Glowmarket island.
// Every prop: makeX(opts) → THREE.Group, pivot at BASE (y=0), toon + outline, baked with mergeGroup
// so a whole tree = 2 meshes (trunk+crown toon mesh, optional flat glow mesh) → ≤ 4 draw calls incl. outline.
//
// Contract (API_CONTRACTS §B "Props"):
//   export const NATURE_PROPS = { tree_round: { make, footprint:[1,1], category:'nature', name, cost, tris }, ... }
//   makeFlowerField(count, areaFn) → InstancedMesh   (ONE draw call, 5 colors via instanceColor, vertex-shader wind)
//   makeGrassTufts(count, areaFn)  → InstancedMesh   (ONE draw call, vertex-shader wind)
//   swayAll(t)                      → drives wind on every nature prop + field built so far (call once per frame)
//   setWindEnabled(bool)            → global on/off (demo key N)
//
// opts for every makeX: { seed?: number, scale?: number, outline?: boolean (default true), sway?: boolean (default true) }
// Each group exposes userData.sway(t) (cheap wind: crown rotation ±0.03 rad, delta-time free because it is
// a pure function of t) and userData.footprint, .category, .name, .kind.
//
// WIND (all pure functions of time t, so they are frame-rate independent by construction):
//   crown.rotation.z = sin(t*1.6 + phase) * 0.03 ;  crown.rotation.x = cos(t*1.1 + phase) * 0.02
//   flowers/grass: vertex shader bends the TOP of each blade by sin(t*2 + worldX*0.8 + worldZ*0.5) * 0.12 * height01

import * as THREE from '../../../vendor/three.module.js';
import { G, mesh, group, rng, vary } from '../geo.js';
import { PALETTE as P, toonMat, flatMat, toonRamp } from '../../core/Toon.js';
import { addOutline } from '../../core/Outline.js';
import { mergeGroup } from './merge.js';

// ---------------------------------------------------------------------------------------
// Palette (extends core PALETTE; pastel toy colors)
// ---------------------------------------------------------------------------------------
export const NATURE_COLORS = {
  leaf: P.leaf, leafDark: P.leafDark, leafLight: 0x8bd17c, leafMint: 0x7fd8a8, leafTeal: 0x4db6ac,
  blossomPink: 0xf8a5c2, blossomPinkDark: 0xe57aa0, blossomWhite: 0xfff1f5,
  trunk: P.trunk, trunkDark: 0x6d4c41, trunkLight: 0xa98274, palmTrunk: 0xbf9b7a,
  stone: P.stone, stoneDark: P.stoneDark, stoneLight: 0xbdbdbd, stoneBlue: 0x90a4ae, stoneWarm: 0xb09a8a,
  moss: 0x7cb342, mossDark: 0x558b2f, crystal: 0x80deea, crystalDark: 0x26c6da,
  glow: 0xffe082, glowDark: 0xffca28, lanternFruit: 0xffb74d, berry: 0xef5350, berryBlue: 0x5c6bc0,
  flower1: 0xff7eb3, flower2: 0xffd54f, flower3: 0x80d8ff, flower4: 0xfff8e1, flower5: 0xb388ff,
  stem: 0x5fbf45, grass: P.grass, grassDark: P.grassDark, grassLight: 0x9be36f, dirt: P.dirt,
};
const C = NATURE_COLORS;

// Every prop/field built so far, so swayAll(t) can drive all of them in one call.
const _swayers = new Set();
let _windOn = true;
export function setWindEnabled(on) { _windOn = !!on; }
export function isWindEnabled() { return _windOn; }
// S17 storm: wind gain multiplies every sway amplitude (crowns + field shader). 1 = calm baseline, 3 = Spark Storm.
let _windGain = 1;
export function setWindGain(g) { _windGain = Math.max(0, +g || 0); _windGainUniform.value = _windGain; }
export function getWindGain() { return _windGain; }
/** Drive wind on every nature prop + instanced field. Call once per frame with game.time (seconds). */
export function swayAll(t) {
  _windUniform.value = _windOn ? t : 0;
  if (!_windOn) return;
  for (const s of _swayers) s(t);
}

// ---------------------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------------------
/** Bake `raw` into merged meshes; keep `crown` (the swaying part) as its own merged sub-group. */
function finish(raw, kind, opts, { crown = null, footprint = [1, 1], name = kind } = {}) {
  const r = rng((opts.seed ?? 1) * 7919 + 13);
  const phase = r() * Math.PI * 2;
  const scale = opts.scale ?? 1;
  let out;
  if (crown) {
    // Merge the static part and the crown separately so the crown can rotate (wind) on its own.
    raw.remove(crown);
    const base = mergeGroup(raw);
    const crownPos = crown.position.clone(), crownRot = crown.rotation.clone(), crownScl = crown.scale.clone();
    crown.position.set(0, 0, 0); crown.rotation.set(0, 0, 0); crown.scale.set(1, 1, 1);
    const crownMerged = mergeGroup(crown);
    crownMerged.position.copy(crownPos); crownMerged.rotation.copy(crownRot); crownMerged.scale.copy(crownScl);
    crownMerged.name = 'crown';
    out = new THREE.Group();
    base.name = 'base';
    out.add(base, crownMerged);
    const amp = opts.swayAmp ?? 0.03;
    const sway = (t) => {
      const a = amp * _windGain, tt = t * (1 + (_windGain - 1) * 0.35);   // S17: storms sway wider and a little faster
      crownMerged.rotation.z = crownRot.z + Math.sin(tt * 1.6 + phase) * a;
      crownMerged.rotation.x = crownRot.x + Math.cos(tt * 1.1 + phase * 1.3) * a * 0.6;
    };
    out.userData.sway = sway;
    out.userData.crown = crownMerged;
    if (opts.sway !== false) _swayers.add(sway);
    out.userData.dispose = () => _swayers.delete(sway);
  } else {
    out = mergeGroup(raw);
    out.userData.sway = () => {};
    out.userData.dispose = () => {};
  }
  out.scale.setScalar(scale);
  out.name = kind;
  out.userData.kind = kind; out.userData.name = name;
  out.userData.footprint = footprint; out.userData.category = 'nature';
  if (opts.outline !== false) addOutline(out);
  return out;
}

/** Low-poly leaf blob: dodecahedron (12 faces ≈ 36 tris) or icosahedron (20 tris). Chunky toy look. */
function blob(radius, color, x, y, z, r, kind = 'dod') {
  const m = mesh(kind === 'ico' ? G.ico(radius) : G.dodeca(radius), color, x, y, z);
  m.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
  return m;
}
/** Add a flattened blob (moss cap) to a group — Group.add returns the group, so scale via helper. */
function cap(parent, m, sx, sy, sz) { m.scale.set(sx, sy, sz); parent.add(m); return m; }
function trunk(h, rt, rb, color, x = 0, z = 0, seg = 6) {
  return mesh(G.cyl(rt, rb, h, seg), color, x, h / 2, z);
}

// ---------------------------------------------------------------------------------------
// TREES (8)
// ---------------------------------------------------------------------------------------
/** Round tree: one big leaf ball + two satellites. ~130 tris. */
export function makeTreeRound(opts = {}) {
  const r = rng(opts.seed ?? 1);
  const raw = group(); const h = 0.9 + r() * 0.35;
  raw.add(trunk(h, 0.13, 0.2, vary(C.trunk, 0.05, r)));
  const crown = group(); crown.position.y = h;
  const s = 0.75 + r() * 0.2;
  crown.add(blob(0.72 * s, vary(C.leaf, 0.05, r), 0, 0.5 * s, 0, r));
  crown.add(blob(0.46 * s, vary(C.leafDark, 0.05, r), 0.38 * s, 0.22 * s, 0.22 * s, r));
  crown.add(blob(0.42 * s, vary(C.leafLight, 0.05, r), -0.32 * s, 0.85 * s, -0.12 * s, r));
  raw.add(crown);
  return finish(raw, 'tree_round', opts, { crown, name: 'Round Tree' });
}
/** Cone / pine tree: 3 stacked cones. ~70 tris. */
export function makeTreeCone(opts = {}) {
  const r = rng(opts.seed ?? 2);
  const raw = group(); const h = 0.55 + r() * 0.25;
  raw.add(trunk(h, 0.1, 0.16, vary(C.trunkDark, 0.05, r)));
  const crown = group(); crown.position.y = h;
  const s = 0.9 + r() * 0.25;
  const cols = [C.leafDark, C.leaf, C.leafLight];
  for (let i = 0; i < 3; i++) {
    const rad = (0.75 - i * 0.18) * s, ch = 0.85 * s;
    crown.add(mesh(G.cone(rad, ch, 7), vary(cols[i], 0.04, r), 0, ch / 2 + i * 0.55 * s, 0));
  }
  raw.add(crown);
  return finish(raw, 'tree_cone', opts, { crown, name: 'Pine Tree' });
}
/** Double-ball tree: two crowns on a forked trunk. ~160 tris. */
export function makeTreeDouble(opts = {}) {
  const r = rng(opts.seed ?? 3);
  const raw = group(); const h = 0.8 + r() * 0.3;
  raw.add(trunk(h, 0.14, 0.22, vary(C.trunk, 0.05, r)));
  const crown = group(); crown.position.y = h;
  const s = 0.8 + r() * 0.2;
  // fork branches (part of the crown so they sway with it)
  const bL = mesh(G.cyl(0.07, 0.1, 0.7 * s, 5), C.trunk, -0.28 * s, 0.25 * s, 0); bL.rotation.z = 0.6; crown.add(bL);
  const bR = mesh(G.cyl(0.07, 0.1, 0.6 * s, 5), C.trunk, 0.24 * s, 0.2 * s, 0.05); bR.rotation.z = -0.55; crown.add(bR);
  crown.add(blob(0.58 * s, vary(C.leaf, 0.05, r), -0.48 * s, 0.75 * s, 0, r));
  crown.add(blob(0.5 * s, vary(C.leafLight, 0.05, r), 0.44 * s, 0.6 * s, 0.08, r));
  crown.add(blob(0.36 * s, vary(C.leafDark, 0.05, r), 0, 0.95 * s, -0.1, r));
  raw.add(crown);
  return finish(raw, 'tree_double', opts, { crown, name: 'Twin Tree' });
}
/** Glow palm: tall leaning trunk, 6 flat frond slabs, glowing fruit (flatMat). ~140 tris. */
export function makeTreePalm(opts = {}) {
  const r = rng(opts.seed ?? 4);
  const raw = group(); const h = 1.7 + r() * 0.5;
  // trunk = 3 stacked tilted segments for a toy "bent" palm
  let y = 0, lean = 0;
  for (let i = 0; i < 3; i++) {
    const seg = h / 3;
    const m = mesh(G.cyl(0.11 - i * 0.015, 0.15 - i * 0.015, seg, 6), vary(C.palmTrunk, 0.05, r), lean, y + seg / 2, 0);
    m.rotation.z = -0.08 * (i + 1);
    raw.add(m); y += seg * 0.97; lean += 0.1;
  }
  const crown = group(); crown.position.set(lean + 0.05, y, 0);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const frond = mesh(G.box(1.25, 0.06, 0.34), vary(i % 2 ? C.leafTeal : C.leafMint, 0.05, r), 0, 0, 0);
    frond.position.set(Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55);
    frond.rotation.set(0, -a, 0.35 + r() * 0.15);
    crown.add(frond);
  }
  crown.add(blob(0.2, C.leafDark, 0, 0.05, 0, r, 'ico'));
  // 3 glowing fruit (flat → merged into the flat bucket)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    crown.add(mesh(G.ico(0.09), flatMat(C.glow), Math.cos(a) * 0.22, -0.14, Math.sin(a) * 0.22));
  }
  raw.add(crown);
  return finish(raw, 'tree_palm', opts, { crown, name: 'Glow Palm', footprint: [1, 1] });
}
/** Blossom tree: pink crown with white highlights. ~170 tris. */
export function makeTreeBlossom(opts = {}) {
  const r = rng(opts.seed ?? 5);
  const raw = group(); const h = 0.85 + r() * 0.3;
  raw.add(trunk(h, 0.12, 0.2, vary(C.trunkDark, 0.05, r)));
  const crown = group(); crown.position.y = h;
  const s = 0.85 + r() * 0.2;
  crown.add(blob(0.68 * s, vary(C.blossomPink, 0.04, r), 0, 0.5 * s, 0, r));
  crown.add(blob(0.44 * s, vary(C.blossomPinkDark, 0.04, r), 0.42 * s, 0.3 * s, 0.2 * s, r));
  crown.add(blob(0.4 * s, vary(C.blossomPink, 0.04, r), -0.4 * s, 0.55 * s, -0.25 * s, r));
  crown.add(blob(0.3 * s, C.blossomWhite, 0.1 * s, 1.0 * s, 0.1 * s, r, 'ico'));
  crown.add(blob(0.18 * s, C.blossomWhite, -0.45 * s, 0.95 * s, 0.25 * s, r, 'ico'));
  raw.add(crown);
  return finish(raw, 'tree_blossom', opts, { crown, name: 'Blossom Tree' });
}
/** Tall tree: slim 2.6 u trunk with a small high crown (for landmarks / backdrops). ~120 tris. */
export function makeTreeTall(opts = {}) {
  const r = rng(opts.seed ?? 6);
  const raw = group(); const h = 2.1 + r() * 0.6;
  raw.add(trunk(h, 0.1, 0.19, vary(C.trunkLight, 0.05, r), 0, 0, 7));
  const crown = group(); crown.position.y = h;
  const s = 0.7 + r() * 0.15;
  crown.add(blob(0.55 * s, vary(C.leafDark, 0.05, r), 0, 0.35 * s, 0, r));
  crown.add(blob(0.42 * s, vary(C.leaf, 0.05, r), 0.3 * s, 0.75 * s, 0.1 * s, r));
  crown.add(blob(0.34 * s, vary(C.leafLight, 0.05, r), -0.28 * s, 0.6 * s, -0.2 * s, r));
  raw.add(crown);
  return finish(raw, 'tree_tall', opts, { crown, name: 'Tall Tree', swayAmp: 0.04 });
}
/** Bush-tree: squat wide crown almost on the ground, stubby trunk. ~190 tris. */
export function makeTreeBush(opts = {}) {
  const r = rng(opts.seed ?? 7);
  const raw = group(); const h = 0.35 + r() * 0.15;
  raw.add(trunk(h, 0.16, 0.22, vary(C.trunk, 0.05, r)));
  const crown = group(); crown.position.y = h;
  const s = 0.9 + r() * 0.2;
  const cols = [C.leaf, C.leafDark, C.leafLight, C.leafMint, C.leaf];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    crown.add(blob(0.42 * s, vary(cols[i], 0.04, r), Math.cos(a) * 0.4 * s, 0.25 * s + r() * 0.1, Math.sin(a) * 0.4 * s, r));
  }
  crown.add(blob(0.5 * s, vary(C.leaf, 0.04, r), 0, 0.55 * s, 0, r));
  raw.add(crown);
  return finish(raw, 'tree_bush', opts, { crown, name: 'Bush Tree', swayAmp: 0.02 });
}
/** Lantern tree: dark round crown hung with 6 glowing lantern-fruit (flatMat). The "Spark" tree of the island. ~190 tris. */
export function makeTreeLantern(opts = {}) {
  const r = rng(opts.seed ?? 8);
  const raw = group(); const h = 1.0 + r() * 0.3;
  raw.add(trunk(h, 0.13, 0.21, vary(C.trunkDark, 0.05, r)));
  const crown = group(); crown.position.y = h;
  const s = 0.85 + r() * 0.15;
  crown.add(blob(0.7 * s, vary(C.leafTeal, 0.04, r), 0, 0.5 * s, 0, r));
  crown.add(blob(0.45 * s, vary(C.leafDark, 0.04, r), 0.4 * s, 0.3 * s, -0.2 * s, r));
  crown.add(blob(0.4 * s, vary(C.leafTeal, 0.04, r), -0.38 * s, 0.75 * s, 0.2 * s, r));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.4, rad = 0.62 * s, yy = 0.25 * s + r() * 0.45 * s;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    crown.add(mesh(G.box(0.02, 0.12, 0.02), C.trunkDark, x, yy + 0.1, z));          // string
    crown.add(mesh(G.ico(0.1), flatMat(i % 2 ? C.glow : C.lanternFruit), x, yy, z)); // glow fruit (ico = 20 tris)
  }
  raw.add(crown);
  return finish(raw, 'tree_lantern', opts, { crown, name: 'Lantern Tree' });
}

// ---------------------------------------------------------------------------------------
// ROCKS (10) — seeded variation via rng/vary; moss caps; no sway.
// ---------------------------------------------------------------------------------------
function rockBody(geo, color, s, r, sx = 1.3, sy = 0.75, sz = 1) {
  const m = mesh(geo, color, 0, s * sy * 0.8, 0);
  m.scale.set(sx, sy, sz); m.rotation.set(r() * 0.4, r() * Math.PI, r() * 0.3);
  return m;
}
/** Small ico rock with moss cap. ~50 tris. */
export function makeRockSmall(opts = {}) {
  const r = rng(opts.seed ?? 11); const raw = group(); const s = 0.3 + r() * 0.12;
  raw.add(rockBody(G.ico(s), vary(C.stone, 0.06, r), s, r));
  cap(raw, blob(s * 0.55, C.moss, 0, s * 0.95, 0, r, 'ico'), 1.3, 0.4, 1.2);
  return finish(raw, 'rock_small', opts, { name: 'Pebble Rock' });
}
/** Medium dodeca rock + small companion, moss cap. ~110 tris. */
export function makeRockMedium(opts = {}) {
  const r = rng(opts.seed ?? 12); const raw = group(); const s = 0.42 + r() * 0.15;
  raw.add(rockBody(G.dodeca(s), vary(C.stone, 0.06, r), s, r));
  raw.add(mesh(G.dodeca(s * 0.45), vary(C.stoneDark, 0.05, r), s * 0.85, s * 0.3, 0.25 * s));
  cap(raw, blob(s * 0.6, C.moss, -0.1 * s, s * 1.05, 0, r, 'ico'), 1.4, 0.4, 1.2);
  return finish(raw, 'rock_medium', opts, { name: 'Moss Rock' });
}
/** Large boulder (2 dodecas) with big moss cap and a flat top. ~130 tris, footprint 2×2. */
export function makeRockLarge(opts = {}) {
  const r = rng(opts.seed ?? 13); const raw = group(); const s = 0.75 + r() * 0.2;
  raw.add(rockBody(G.dodeca(s), vary(C.stone, 0.05, r), s, r, 1.35, 0.8, 1.15));
  { const b2 = rockBody(G.dodeca(s * 0.6), vary(C.stoneLight, 0.05, r), s * 0.6, r, 1.1, 0.9, 1); b2.position.set(s * 0.8, s * 0.35, -s * 0.3); raw.add(b2); }
  cap(raw, blob(s * 0.75, vary(C.moss, 0.04, r), 0, s * 1.25, 0, r, 'ico'), 1.3, 0.35, 1.1);
  return finish(raw, 'rock_large', opts, { name: 'Boulder', footprint: [2, 2] });
}
/** Flat stepping slab. ~40 tris. */
export function makeRockFlat(opts = {}) {
  const r = rng(opts.seed ?? 14); const raw = group(); const s = 0.45 + r() * 0.15;
  const m = mesh(G.dodeca(s), vary(C.stoneWarm, 0.05, r), 0, s * 0.3, 0); m.scale.set(1.5, 0.35, 1.3); m.rotation.y = r() * Math.PI; raw.add(m);
  return finish(raw, 'rock_flat', opts, { name: 'Flat Stone' });
}
/** Tall spire rock (cone-ish dodeca stack). ~90 tris. */
export function makeRockSpire(opts = {}) {
  const r = rng(opts.seed ?? 15); const raw = group(); const s = 0.4 + r() * 0.1;
  const base = mesh(G.dodeca(s), vary(C.stoneDark, 0.05, r), 0, s * 0.6, 0); base.scale.set(1.2, 0.9, 1.1); raw.add(base);
  const mid = mesh(G.dodeca(s * 0.7), vary(C.stone, 0.05, r), 0.05, s * 1.5, -0.05); mid.rotation.set(0.2, r() * 2, 0.1); raw.add(mid);
  const top = mesh(G.ico(s * 0.45), vary(C.stoneLight, 0.05, r), 0, s * 2.25, 0); top.scale.set(0.9, 1.4, 0.9); raw.add(top);
  return finish(raw, 'rock_spire', opts, { name: 'Spire Rock' });
}
/** Rock cluster: 4 small rocks in a ring. ~150 tris. */
export function makeRockCluster(opts = {}) {
  const r = rng(opts.seed ?? 16); const raw = group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r() * 0.6, d = 0.25 + r() * 0.15, s = 0.16 + r() * 0.14;
    const m = mesh(i % 2 ? G.ico(s) : G.dodeca(s), vary(i % 3 ? C.stone : C.stoneDark, 0.06, r), Math.cos(a) * d, s * 0.7, Math.sin(a) * d);
    m.rotation.set(r(), r() * 3, r()); raw.add(m);
  }
  cap(raw, blob(0.14, C.moss, 0, 0.1, 0, r, 'ico'), 1.6, 0.4, 1.6);
  return finish(raw, 'rock_cluster', opts, { name: 'Rock Cluster' });
}
/** Crystal rock: grey base with 3 glowing crystal shards (flatMat, "Spark ore"). ~110 tris. */
export function makeRockCrystal(opts = {}) {
  const r = rng(opts.seed ?? 17); const raw = group(); const s = 0.4 + r() * 0.12;
  raw.add(rockBody(G.dodeca(s), vary(C.stoneBlue, 0.05, r), s, r, 1.3, 0.7, 1.1));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r(), h = 0.35 + r() * 0.3;
    const c = mesh(G.cone(0.1 + r() * 0.05, h, 5), flatMat(i ? C.crystal : C.crystalDark), Math.cos(a) * 0.18, s * 0.7 + h / 2, Math.sin(a) * 0.18);
    c.rotation.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); raw.add(c);
  }
  return finish(raw, 'rock_crystal', opts, { name: 'Spark Ore' });
}
/** Rock arch: two pillars + a lintel (decor gate). ~100 tris, footprint 2×1. */
export function makeRockArch(opts = {}) {
  const r = rng(opts.seed ?? 18); const raw = group();
  const pl = mesh(G.dodeca(0.35), vary(C.stone, 0.05, r), -0.55, 0.45, 0); pl.scale.set(0.9, 1.6, 0.9); raw.add(pl);
  const pr = mesh(G.dodeca(0.35), vary(C.stoneDark, 0.05, r), 0.55, 0.45, 0); pr.scale.set(0.9, 1.6, 0.9); pr.rotation.y = 1; raw.add(pr);
  const top = mesh(G.dodeca(0.4), vary(C.stoneLight, 0.05, r), 0, 1.1, 0); top.scale.set(1.9, 0.6, 0.9); raw.add(top);
  cap(raw, blob(0.3, C.moss, 0, 1.3, 0, r, 'ico'), 1.8, 0.35, 1);
  return finish(raw, 'rock_arch', opts, { name: 'Rock Arch', footprint: [2, 1] });
}
/** Mossy mound: mostly moss, tiny stone peeking out. ~60 tris. */
export function makeRockMossy(opts = {}) {
  const r = rng(opts.seed ?? 19); const raw = group(); const s = 0.38 + r() * 0.12;
  raw.add(rockBody(G.ico(s), vary(C.mossDark, 0.05, r), s, r, 1.4, 0.6, 1.3));
  cap(raw, blob(s * 0.8, vary(C.moss, 0.05, r), 0, s * 0.7, 0, r, 'ico'), 1.3, 0.5, 1.2);
  raw.add(mesh(G.dodeca(s * 0.3), C.stoneLight, s * 0.5, s * 0.75, s * 0.3));
  return finish(raw, 'rock_mossy', opts, { name: 'Mossy Mound' });
}
/** Cliff chunk: tall blocky stack for island edges (1C can tile it). ~90 tris, footprint 2×2. */
export function makeRockCliff(opts = {}) {
  const r = rng(opts.seed ?? 20); const raw = group();
  const b1 = mesh(G.dodeca(0.9), vary(C.stoneDark, 0.05, r), 0, 0.6, 0); b1.scale.set(1.2, 0.8, 1.0); raw.add(b1);
  const b2 = mesh(G.dodeca(0.7), vary(C.stone, 0.05, r), 0.2, 1.45, -0.1); b2.scale.set(1.1, 0.9, 1.0); b2.rotation.y = 0.7; raw.add(b2);
  const b3 = mesh(G.dodeca(0.45), vary(C.stoneLight, 0.05, r), -0.3, 2.1, 0.1); b3.rotation.y = 1.4; raw.add(b3);
  cap(raw, blob(0.5, C.moss, -0.25, 2.45, 0.1, r, 'ico'), 1.3, 0.35, 1.2);
  return finish(raw, 'rock_cliff', opts, { name: 'Cliff Chunk', footprint: [2, 2] });
}

// ---------------------------------------------------------------------------------------
// BUSHES (6) — whole bush is the crown (sways), base is a tiny dirt disc.
// ---------------------------------------------------------------------------------------
function bushBase(raw) { raw.add(mesh(G.cyl(0.32, 0.36, 0.05, 8), C.dirt, 0, 0.025, 0)); }
/** Round bush: 3 blobs. ~110 tris. */
export function makeBushRound(opts = {}) {
  const r = rng(opts.seed ?? 21); const raw = group(); bushBase(raw);
  const crown = group(); crown.position.y = 0.05; const s = 0.8 + r() * 0.25;
  crown.add(blob(0.4 * s, vary(C.leaf, 0.05, r), 0, 0.32 * s, 0, r));
  crown.add(blob(0.3 * s, vary(C.leafDark, 0.05, r), 0.3 * s, 0.22 * s, 0.15 * s, r));
  crown.add(blob(0.27 * s, vary(C.leafLight, 0.05, r), -0.28 * s, 0.26 * s, -0.1 * s, r));
  raw.add(crown);
  return finish(raw, 'bush_round', opts, { crown, name: 'Round Bush', swayAmp: 0.025 });
}
/** Berry bush: green blobs + 6 red berries. ~160 tris. */
export function makeBushBerry(opts = {}) {
  const r = rng(opts.seed ?? 22); const raw = group(); bushBase(raw);
  const crown = group(); crown.position.y = 0.05; const s = 0.85 + r() * 0.2;
  crown.add(blob(0.42 * s, vary(C.leafDark, 0.05, r), 0, 0.34 * s, 0, r));
  crown.add(blob(0.3 * s, vary(C.leaf, 0.05, r), 0.3 * s, 0.25 * s, -0.12 * s, r));
  crown.add(blob(0.26 * s, vary(C.leaf, 0.05, r), -0.26 * s, 0.3 * s, 0.18 * s, r));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r(), rr = 0.36 * s;
    crown.add(mesh(G.ico(0.06), i % 2 ? C.berry : C.berryBlue, Math.cos(a) * rr, 0.3 * s + r() * 0.2, Math.sin(a) * rr));
  }
  raw.add(crown);
  return finish(raw, 'bush_berry', opts, { crown, name: 'Berry Bush', swayAmp: 0.025 });
}
/** Hedge: long box-ish bush (1 tile wide) for market borders. ~90 tris, footprint 2×1. */
export function makeBushHedge(opts = {}) {
  const r = rng(opts.seed ?? 23); const raw = group();
  raw.add(mesh(G.box(1.7, 0.05, 0.6), C.dirt, 0, 0.025, 0));
  const crown = group(); crown.position.y = 0.05;
  for (let i = 0; i < 4; i++) crown.add(blob(0.34, vary(i % 2 ? C.leafDark : C.leaf, 0.04, r), -0.6 + i * 0.4, 0.3, 0, r));
  crown.add(mesh(G.box(1.6, 0.46, 0.5), vary(C.leaf, 0.03, r), 0, 0.3, 0));
  raw.add(crown);
  return finish(raw, 'bush_hedge', opts, { crown, name: 'Hedge', footprint: [2, 1], swayAmp: 0.012 });
}
/** Flowering bush: green with 5 pastel flower buds. ~150 tris. */
export function makeBushFlower(opts = {}) {
  const r = rng(opts.seed ?? 24); const raw = group(); bushBase(raw);
  const crown = group(); crown.position.y = 0.05; const s = 0.85 + r() * 0.2;
  crown.add(blob(0.4 * s, vary(C.leafMint, 0.05, r), 0, 0.32 * s, 0, r));
  crown.add(blob(0.28 * s, vary(C.leaf, 0.05, r), 0.28 * s, 0.22 * s, 0.14 * s, r));
  crown.add(blob(0.26 * s, vary(C.leafLight, 0.05, r), -0.26 * s, 0.26 * s, -0.12 * s, r));
  const cols = [C.flower1, C.flower2, C.flower3, C.flower4, C.flower5];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4, rr = 0.3 * s;
    crown.add(mesh(G.ico(0.07), cols[i], Math.cos(a) * rr, 0.42 * s + r() * 0.15, Math.sin(a) * rr));
  }
  raw.add(crown);
  return finish(raw, 'bush_flower', opts, { crown, name: 'Flower Bush', swayAmp: 0.03 });
}
/** Fern: 6 flat tilted blades in a fan. ~80 tris. */
export function makeBushFern(opts = {}) {
  const r = rng(opts.seed ?? 25); const raw = group(); bushBase(raw);
  const crown = group(); crown.position.y = 0.05;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const bl = mesh(G.box(0.14, 0.55, 0.04), vary(i % 2 ? C.leafDark : C.leafMint, 0.05, r), 0, 0, 0);
    bl.position.set(Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12);
    bl.rotation.set(Math.sin(a) * 0.7, -a, Math.cos(a) * 0.7);
    crown.add(bl);
  }
  crown.add(blob(0.12, C.leafDark, 0, 0.08, 0, r, 'ico'));
  raw.add(crown);
  return finish(raw, 'bush_fern', opts, { crown, name: 'Fern', swayAmp: 0.05 });
}
/** Tall grass clump: 5 cones. ~60 tris. */
export function makeBushTallGrass(opts = {}) {
  const r = rng(opts.seed ?? 26); const raw = group();
  const crown = group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r(), d = 0.08 + r() * 0.08, h = 0.45 + r() * 0.3;
    const c = mesh(G.cone(0.07, h, 4), vary(i % 2 ? C.grassLight : C.grassDark, 0.05, r), Math.cos(a) * d, h / 2, Math.sin(a) * d);
    c.rotation.set(Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2); crown.add(c);
  }
  raw.add(crown);
  return finish(raw, 'bush_tallgrass', opts, { crown, name: 'Tall Grass', swayAmp: 0.07 });
}

// ---------------------------------------------------------------------------------------
// INSTANCED FIELDS — flowers & grass tufts. ONE InstancedMesh each, wind in the vertex shader
// (no per-frame instanceMatrix writes). Outline is skipped on purpose (flowers are tiny; the
// outline hull would double the draw calls for no visible gain at game-camera distance).
// ---------------------------------------------------------------------------------------
const _windUniform = { value: 0 };
const _windGainUniform = { value: 1 };   // S17
let _fieldToonMat = null, _fieldFlatMat = null;
function windPatch(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = _windUniform; sh.uniforms.uWindGain = _windGainUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWindGain;')
      .replace('#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // bend the top of the blade/stem; strength grows with local height (y01)
          vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float h01 = clamp(position.y / 0.45, 0.0, 1.0);
          float w = sin(uWind * (1.0 + uWindGain) + wp.x * 0.8 + wp.z * 0.5) * 0.12 * uWindGain * h01 * h01;
          transformed.x += w; transformed.z += w * 0.4;
        }`);
  };
  mat.customProgramCacheKey = () => 'natureWind';
  return mat;
}
function fieldToonMat() {
  if (!_fieldToonMat) _fieldToonMat = windPatch(new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp(), vertexColors: true }));
  return _fieldToonMat;
}

/** Build a tiny flower geometry (stem + 4 petals + center), vertex-colored, pivot at base. petal color per instance via instanceColor. */
function flowerGeometry() {
  // merge via a temporary group → one BufferGeometry with per-vertex color; petals use white (so instanceColor tints them),
  // stem is green, center is gold. MeshToonMaterial multiplies vertexColor * instanceColor.
  const g = group();
  g.add(mesh(G.cyl(0.02, 0.025, 0.32, 4), C.stem, 0, 0.16, 0));
  const petalGeo = G.ico(0.07);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const p = mesh(petalGeo, 0xffffff, Math.cos(a) * 0.075, 0.36, Math.sin(a) * 0.075); p.scale.set(1, 0.5, 1); g.add(p);
  }
  g.add(mesh(G.ico(0.045), C.flower2, 0, 0.38, 0));
  const merged = mergeGroup(g);
  const m = merged.children.find((o) => o.isMesh);
  return m.geometry;
}
let _flowerGeo = null;
/**
 * One InstancedMesh of `count` flowers scattered where `areaFn(x, z) → bool` (e.g. island.isLand).
 * 5 pastel colors via instanceColor. ≤ 1 draw call (no outline). Wind via shader — nothing to update per frame
 * except calling swayAll(t).
 */
export function makeFlowerField(count = 300, areaFn = () => true, opts = {}) {
  const r = rng(opts.seed ?? 99);
  const radius = opts.radius ?? 11;
  if (!_flowerGeo) _flowerGeo = flowerGeometry();
  const im = new THREE.InstancedMesh(_flowerGeo, fieldToonMat(), count);
  const cols = [C.flower1, C.flower2, C.flower3, C.flower4, C.flower5].map((h) => new THREE.Color(h));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 20) {
    tries++;
    const x = (r() * 2 - 1) * radius, z = (r() * 2 - 1) * radius;
    if (!areaFn(x, z)) continue;
    p.set(x, 0, z); e.set(0, r() * Math.PI * 2, 0); q.setFromEuler(e);
    const sc = 0.8 + r() * 0.5; s.set(sc, sc * (0.8 + r() * 0.4), sc);
    m.compose(p, q, s); im.setMatrixAt(placed, m);
    im.setColorAt(placed, cols[Math.floor(r() * cols.length)]);
    placed++;
  }
  im.count = placed;
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
  im.userData.noOutline = true; im.userData.kind = 'flower_field'; im.userData.category = 'nature';
  im.name = 'flower_field';
  return im;
}

let _tuftGeo = null;
function tuftGeometry() {
  const g = group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, h = 0.3 + i * 0.06;
    const c = mesh(G.cone(0.05, h, 3), i === 1 ? C.grassLight : C.grassDark, Math.cos(a) * 0.05, h / 2, Math.sin(a) * 0.05);
    c.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25); g.add(c);
  }
  const merged = mergeGroup(g);
  return merged.children.find((o) => o.isMesh).geometry;
}
/** One InstancedMesh of grass tufts (3 cones each, 12 tris). Shader wind. ≤ 1 draw call. */
export function makeGrassTufts(count = 200, areaFn = () => true, opts = {}) {
  const r = rng(opts.seed ?? 77);
  const radius = opts.radius ?? 11;
  if (!_tuftGeo) _tuftGeo = tuftGeometry();
  const im = new THREE.InstancedMesh(_tuftGeo, fieldToonMat(), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const tint = new THREE.Color();
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 20) {
    tries++;
    const x = (r() * 2 - 1) * radius, z = (r() * 2 - 1) * radius;
    if (!areaFn(x, z)) continue;
    p.set(x, 0, z); e.set(0, r() * Math.PI * 2, 0); q.setFromEuler(e);
    const sc = 0.8 + r() * 0.6; s.set(sc, sc * (0.7 + r() * 0.6), sc);
    m.compose(p, q, s); im.setMatrixAt(placed, m);
    tint.setHSL(0.27 + r() * 0.04, 0.6, 0.55 + r() * 0.15); im.setColorAt(placed, tint);
    placed++;
  }
  im.count = placed;
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
  im.userData.noOutline = true; im.userData.kind = 'grass_tufts'; im.userData.category = 'nature';
  im.name = 'grass_tufts';
  return im;
}

// ---------------------------------------------------------------------------------------
// CATALOG (register with props.js → registerProps(NATURE_PROPS))
// ---------------------------------------------------------------------------------------
const entry = (make, name, footprint = [1, 1], cost = 0) => ({ make, footprint, category: 'nature', name, cost, tris: 0 });
export const NATURE_PROPS = {
  tree_round:    entry(makeTreeRound, 'Round Tree', [1, 1], 15),
  tree_cone:     entry(makeTreeCone, 'Pine Tree', [1, 1], 15),
  tree_double:   entry(makeTreeDouble, 'Twin Tree', [1, 1], 20),
  tree_palm:     entry(makeTreePalm, 'Glow Palm', [1, 1], 30),
  tree_blossom:  entry(makeTreeBlossom, 'Blossom Tree', [1, 1], 25),
  tree_tall:     entry(makeTreeTall, 'Tall Tree', [1, 1], 20),
  tree_bush:     entry(makeTreeBush, 'Bush Tree', [1, 1], 15),
  tree_lantern:  entry(makeTreeLantern, 'Lantern Tree', [1, 1], 40),
  rock_small:    entry(makeRockSmall, 'Pebble Rock', [1, 1], 5),
  rock_medium:   entry(makeRockMedium, 'Moss Rock', [1, 1], 8),
  rock_large:    entry(makeRockLarge, 'Boulder', [2, 2], 15),
  rock_flat:     entry(makeRockFlat, 'Flat Stone', [1, 1], 5),
  rock_spire:    entry(makeRockSpire, 'Spire Rock', [1, 1], 10),
  rock_cluster:  entry(makeRockCluster, 'Rock Cluster', [1, 1], 8),
  rock_crystal:  entry(makeRockCrystal, 'Spark Ore', [1, 1], 25),
  rock_arch:     entry(makeRockArch, 'Rock Arch', [2, 1], 20),
  rock_mossy:    entry(makeRockMossy, 'Mossy Mound', [1, 1], 6),
  rock_cliff:    entry(makeRockCliff, 'Cliff Chunk', [2, 2], 0),
  bush_round:    entry(makeBushRound, 'Round Bush', [1, 1], 6),
  bush_berry:    entry(makeBushBerry, 'Berry Bush', [1, 1], 10),
  bush_hedge:    entry(makeBushHedge, 'Hedge', [2, 1], 12),
  bush_flower:   entry(makeBushFlower, 'Flower Bush', [1, 1], 10),
  bush_fern:     entry(makeBushFern, 'Fern', [1, 1], 6),
  bush_tallgrass: entry(makeBushTallGrass, 'Tall Grass', [1, 1], 3),
};
export const NATURE_IDS = Object.keys(NATURE_PROPS);

/** Convenience: random nature prop by seed (trees 50 %, rocks 25 %, bushes 25 %). */
export function makeRandomNature(r = Math.random, opts = {}) {
  const v = r();
  const pool = v < 0.5 ? NATURE_IDS.filter((i) => i.startsWith('tree')) : v < 0.75 ? NATURE_IDS.filter((i) => i.startsWith('rock')) : NATURE_IDS.filter((i) => i.startsWith('bush'));
  const id = pool[Math.floor(r() * pool.length)];
  const g = NATURE_PROPS[id].make({ seed: Math.floor(r() * 100000) + 1, ...opts });
  g.userData.propId = id;
  return g;
}
