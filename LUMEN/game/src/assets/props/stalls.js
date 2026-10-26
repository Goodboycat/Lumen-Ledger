// Chat 1A — Props: Stalls. 12 procedural market stalls for the Glowmarket.
// Every stall: makeStallX(opts) → THREE.Group, pivot at BASE (y=0), footprint 2×2 tiles,
// toon + outline, ≤ 900 tris & ≤ 10 draw calls (contract updated by 1A; draw calls matter, not tris). Shared parts (counter, posts, awning, sign) are built once
// per stall from cached geometries (geo.js) so 12+ stalls stay cheap.
//
// Contract (API_CONTRACTS §B "Props"):
//   group.userData.footprint = [2, 2]
//   group.userData.slots = { counter: Vector3, queue: [Vector3 ×4], sign: Object3D }
//   group.userData.setLevel(1|2|3, { animate?: true, vfx?, sequences? })
//   group.userData.level, group.userData.stallType
//
// Orientation: the stall FACES +Z. Customers queue in front of it along +Z.
// Slots are LOCAL positions (apply group.localToWorld() when placed).
//
// LEVEL SWAP SEQUENCE  "stallLevelUp"   (phase table — all ms, delta-time driven)
//   squash      120  outCubic   scaleY 1 → 0.78 (volume-preserving), slight sink
//   swap          1  linear     onEnter: rebuild visuals for new level
//   pop         260  outBack    scale 0.78 → 1.0 with overshoot, dust burst on enter
//   settle      180  outCubic   JellySpring value → 0 (residual jiggle)

import * as THREE from '../../../vendor/three.module.js';
import { G, mesh, block, group, rng, vary } from '../geo.js';
import { PALETTE as P, toonMat, flatMat } from '../../core/Toon.js';
import { addOutline, removeOutline } from '../../core/Outline.js';
import { Sequence } from '../../anim/Sequencer.js';
import { Easing } from '../../anim/Easing.js';
import { setSquash } from '../../anim/SquashStretch.js';
import { mergeGroup, disposeMerged } from './merge.js';

// ---------------------------------------------------------------------------------------
// Shared palette for stalls (extends core PALETTE; flat pastel toy colors)
// ---------------------------------------------------------------------------------------
export const STALL_COLORS = {
  canvasWhite: 0xfff8e7, red: 0xef5350, blue: 0x42a5f5, green: 0x66bb6a, yellow: 0xffd54f,
  purple: 0xab47bc, teal: 0x26c6da, pink: 0xf48fb1, orange: 0xffa726, brown: 0x8d6e63,
  cream: 0xfff3c4, gold: 0xffd54f, goldDark: 0xf9a825, lanternGlow: 0xffe082,
  clay: 0xd7845a, clayDark: 0xa85a38, paper: 0xfffde7, ink: 0x263238, fishSilver: 0xb0bec5,
  fishBlue: 0x4fc3f7, bread: 0xe0a860, breadDark: 0xb8793a, leaf: 0x66bb6a, apple: 0xef5350,
  orangeFruit: 0xffa726, grape: 0x7e57c2, lemon: 0xfff176, tea: 0x8bc34a, teaDark: 0x558b2f,
  book1: 0xef5350, book2: 0x42a5f5, book3: 0x66bb6a, book4: 0xffb74d, toyRed: 0xff7043,
  toyBlue: 0x29b6f6, toyYellow: 0xffee58, cloth1: 0xf06292, cloth2: 0x4dd0e1, cloth3: 0xffd54f,
  spark: 0xffd54f, sparkDark: 0xf9a825, vault: 0x78909c, vaultDark: 0x546e7a,
};
const C = STALL_COLORS;

// Stall footprint 2×2 tiles → body is ~1.8 wide, counter at front (z ≈ +0.55)
const W = 1.8;          // stall width (x)
const D = 1.4;          // stall depth (z)
const COUNTER_H = 0.75; // counter top height
const POST_H = 2.1;     // awning post height

// ---------------------------------------------------------------------------------------
// Part builders (each returns Object3D with base pivot). Kept tiny & cached.
// ---------------------------------------------------------------------------------------
function counter(color = P.wood, dark = P.woodDark) {
  const g = group();
  // base body
  g.add(block(W, COUNTER_H - 0.1, 0.7, color, 0, 0, 0.35));
  // top slab (slightly wider, darker)
  g.add(block(W + 0.12, 0.1, 0.84, dark, 0, COUNTER_H - 0.1, 0.35));
  // front plank detail (one darker strip)
  g.add(block(W - 0.3, 0.12, 0.05, dark, 0, 0.18, 0.72));
  return g;
}
function backShelf(color = P.wood, dark = P.woodDark) {
  const g = group();
  g.add(block(W, 1.5, 0.3, color, 0, 0, -0.5));            // back wall
  g.add(block(W - 0.1, 0.08, 0.45, dark, 0, 0.95, -0.42));  // shelf
  return g;
}
function posts(color = P.woodDark) {
  const g = group();
  // chunky square posts (12 tris each)
  const geo = G.box(0.14, POST_H, 0.14);
  g.add(mesh(geo, color, -W / 2 + 0.08, POST_H / 2, 0.62));
  g.add(mesh(geo, color, W / 2 - 0.08, POST_H / 2, 0.62));
  g.add(mesh(geo, color, -W / 2 + 0.08, POST_H / 2, -0.6));
  g.add(mesh(geo, color, W / 2 - 0.08, POST_H / 2, -0.6));
  return g;
}
/** Striped awning: alternating colored slabs, slightly tilted toward the front. big → L2+ */
function awning(colorA, colorB, big = false) {
  const g = group();
  const stripes = 5;
  const w = (big ? W + 0.5 : W + 0.2);
  const depth = big ? 1.7 : 1.45;
  const sw = w / stripes;
  const tilt = big ? -0.22 : -0.16;
  for (let i = 0; i < stripes; i++) {
    const m = mesh(G.box(sw, 0.07, depth), i % 2 ? colorB : colorA, -w / 2 + sw * (i + 0.5), 0, 0);
    g.add(m);
  }
  // scalloped front edge: small hanging tabs (boxes, 12 tris each)
  for (let i = 0; i < stripes; i++) {
    g.add(mesh(G.box(sw * 0.7, 0.14, 0.06), i % 2 ? colorB : colorA, -w / 2 + sw * (i + 0.5), -0.08, depth / 2));
  }
  g.position.set(0, POST_H + 0.05, 0.08);
  g.rotation.x = tilt;
  return g;
}
/** Hanging sign: two chains + plank + colored emblem. userData.slots.sign points here. */
function hangingSign(emblemColor, emblemShape = 'circle') {
  const g = group();
  const chain = G.box(0.03, 0.25, 0.03);
  g.add(mesh(chain, P.metalDark, -0.3, -0.12, 0));
  g.add(mesh(chain, P.metalDark, 0.3, -0.12, 0));
  const plank = mesh(G.box(0.9, 0.42, 0.08), P.wood, 0, -0.45, 0);
  g.add(plank);
  let emblem;
  if (emblemShape === 'circle') emblem = mesh(G.cyl(0.13, 0.13, 0.05, 8), emblemColor, 0, -0.45, 0.07);
  else if (emblemShape === 'diamond') { emblem = mesh(G.box(0.19, 0.19, 0.05), emblemColor, 0, -0.45, 0.07); emblem.rotation.z = Math.PI / 4; }
  else emblem = mesh(G.box(0.26, 0.2, 0.05), emblemColor, 0, -0.45, 0.07);
  if (emblemShape === 'circle') emblem.rotation.x = Math.PI / 2;
  g.add(emblem);
  // bake chains+plank+emblem into ONE mesh; pivot stays at the hanging point (top)
  const merged = mergeGroup(g);
  merged.position.set(0, POST_H + 0.02, 0.86); // hangs from awning front
  merged.name = 'sign';
  return merged;
}
/** Small post lantern pair (L2+). glow=true uses flatMat (L3). S31: hooks dropped (−24 tris) to make room for per-type extras. */
function lanterns(glow = false) {
  const g = group();
  const body = G.box(0.18, 0.26, 0.18);
  const cap = G.cone(0.14, 0.1, 4);
  const mat = glow ? flatMat(C.lanternGlow) : toonMat(C.lanternGlow);
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.16);
    const b = mesh(body, mat, x, POST_H - 0.55, 0.62);
    const c = mesh(cap, P.woodDark, x, POST_H - 0.37, 0.62);
    g.add(b, c);
  }
  g.userData.lanterns = g.children.filter((m) => m.geometry === body);
  return g;
}
/** Roof flag + gold trim rails (L3). */
function roofFlag(color) {
  const g = group();
  const pole = mesh(G.box(0.05, 0.9, 0.05), P.woodDark, 0, POST_H + 0.5, -0.4);
  const flag = mesh(G.box(0.5, 0.3, 0.03), color, 0.27, POST_H + 0.78, -0.4);
  flag.userData.flag = true;
  g.add(pole, flag);
  g.userData.flag = flag;
  return g;
}
function goldTrim() {
  const g = group();
  const rail = G.box(W + 0.3, 0.06, 0.06);
  g.add(mesh(rail, C.goldDark, 0, POST_H + 0.02, 0.9));
  g.add(mesh(rail, C.goldDark, 0, POST_H + 0.02, -0.74));
  const knob = G.box(0.12, 0.12, 0.12); // S31: box knobs (12 tris) instead of ico (20) — gold cubes read the same at toy scale
  for (const sx of [-1, 1]) {
    const k1 = mesh(knob, C.gold, sx * (W / 2 + 0.1), POST_H + 0.1, 0.9); k1.rotation.y = Math.PI / 4;
    const k2 = mesh(knob, C.gold, sx * (W / 2 + 0.1), POST_H + 0.1, -0.74); k2.rotation.y = Math.PI / 4;
    g.add(k1, k2);
  }
  // gold edge on counter top
  g.add(mesh(G.box(W + 0.16, 0.04, 0.05), C.gold, 0, COUNTER_H + 0.02, 0.78));
  return g;
}
/** Decorative crate at the side (used by a few per-type extras) */
function sideCrate(x, z = 0.3) {
  const g = group(block(0.42, 0.4, 0.42, P.wood, x, 0, z));
  g.add(block(0.46, 0.05, 0.46, P.woodDark, x, 0.4, z));
  return g;
}

// ---------------------------------------------------------------------------------------
// S31 — PER-TYPE LEVEL EXTRAS. Every stall type gets its own L2 piece (a side feature that tells
// you what the shop does from across the plaza) and a richer L3 piece on the other side / roof.
// Budget: each piece ≤ ~110 tris so every stall stays ≤ 900 tris at L3 (fruit/fish are the tight ones).// Positions: left side x≈-(W/2+0.4), right side x≈+(W/2+0.4); the counter front is z≈+0.7, back wall z≈-0.5.
// Pieces are static → baked into the level mesh by mergeGroup (flat glow materials go to the flat bucket).
// ---------------------------------------------------------------------------------------
const SX = W / 2 + 0.42; // side-piece x offset
const LEVEL_EXTRAS = {
  fruit: {
    // L2: apple barrel on the left. L3: chalk price board on the right + hanging fruit garland under the awning.
    l2(g) {
      g.add(mesh(G.cyl(0.22, 0.19, 0.42, 6), P.wood, -SX, 0.21, 0.3));
      g.add(block(0.5, 0.04, 0.1, P.woodDark, -SX, 0.22, 0.3));
      g.add(mesh(G.ico(0.08, 0), C.apple, -SX - 0.06, 0.48, 0.26));
      g.add(mesh(G.ico(0.08, 0), C.orangeFruit, -SX + 0.07, 0.48, 0.36));
    },
    l3(g) {
      g.add(block(0.05, 0.9, 0.05, P.woodDark, SX, 0, 0.5));
      g.add(block(0.42, 0.34, 0.04, C.ink, SX, 0.62, 0.5));
      g.add(block(0.2, 0.03, 0.05, C.canvasWhite, SX, 0.7, 0.53));
      g.add(block(0.14, 0.03, 0.05, C.canvasWhite, SX - 0.03, 0.62, 0.53));
    },
  },
  bread: {
    // L2: clay bread oven on the left (dome + chimney + dark mouth). L3: pretzel sign on the roof pole + flour sacks right.
    l2(g) {
      g.add(block(0.5, 0.3, 0.5, C.clayDark, -SX, 0, 0.1));
      g.add(mesh(G.ico(0.26, 0), C.clay, -SX, 0.42, 0.1));
      g.add(block(0.1, 0.42, 0.1, C.clayDark, -SX - 0.1, 0.5, -0.05));
      g.add(block(0.18, 0.14, 0.06, C.ink, -SX, 0.32, 0.35));
    },
    l3(g) {
      const pz = mesh(G.torus(0.14, 0.045, 4, 6), C.breadDark, SX, POST_H + 0.35, 0.3); g.add(pz);
      g.add(block(0.05, 0.6, 0.05, P.woodDark, SX, POST_H - 0.15, 0.3));
      g.add(block(0.3, 0.34, 0.3, C.cream, SX, 0, 0.45));
      g.add(block(0.28, 0.3, 0.28, C.cream, SX + 0.05, 0.34, 0.4));
    },
  },
  lantern: {
    // L2: string of three glowing mini lanterns under the awning front. L3: tall lamp post with a big glowing lantern on the right.
    l2(g) {
      const body = G.box(0.12, 0.18, 0.12), cap = G.cone(0.1, 0.07, 4);
      const cols = [C.teal, C.pink, C.lanternGlow];
      for (let i = 0; i < 3; i++) {
        const x = -0.55 + i * 0.55;
        g.add(mesh(body, flatMat(cols[i]), x, POST_H - 0.3, 0.95));
        g.add(mesh(cap, P.woodDark, x, POST_H - 0.18, 0.95));
      }
    },
    l3(g) {
      g.add(block(0.08, 2.4, 0.08, P.woodDark, SX, 0, 0.4));
      g.add(mesh(G.box(0.3, 0.4, 0.3), flatMat(C.lanternGlow), SX, 2.3, 0.4));
      g.add(mesh(G.cone(0.26, 0.16, 4), P.woodDark, SX, 2.58, 0.4));
      g.add(mesh(G.ico(0.1, 0), flatMat(C.canvasWhite), SX, 2.3, 0.4));
    },
  },
  fish: {
    // L2: ice barrel with a fish on the left. L3: anchor + buoy on the right.
    l2(g) {
      g.add(mesh(G.cyl(0.22, 0.19, 0.42, 6), P.woodDark, -SX, 0.21, 0.3));
      g.add(block(0.3, 0.08, 0.3, 0xe3f6ff, -SX, 0.4, 0.3));
      const f = mesh(G.cone(0.08, 0.3, 4), C.fishSilver, -SX, 0.6, 0.3); f.rotation.z = Math.PI; g.add(f);
      const t = mesh(G.cone(0.07, 0.12, 3), C.fishSilver, -SX, 0.8, 0.3); g.add(t);
    },
    l3(g) {
      g.add(block(0.06, 0.8, 0.06, P.metalDark, SX, 0, 0.4));
      g.add(block(0.4, 0.06, 0.06, P.metalDark, SX, 0.72, 0.4));
      g.add(block(0.46, 0.08, 0.1, P.metalDark, SX, 0.0, 0.4));
      g.add(block(0.2, 0.2, 0.2, C.red, SX + 0.3, 0.0, 0.75));
    },
  },
  flower: {
    // L2: hanging flower baskets on both front posts. L3: rose trellis arch on the right.
    l2(g) {
      for (const sx of [-1, 1]) {
        const x = sx * (W / 2 + 0.3);
        g.add(mesh(G.cyl(0.14, 0.1, 0.16, 5), C.brown, x, POST_H - 0.9, 0.62));
        g.add(mesh(G.ico(0.15, 0), sx < 0 ? C.pink : C.purple, x, POST_H - 0.74, 0.62));
      }
    },
    l3(g) {
      g.add(block(0.06, 1.6, 0.06, P.wood, SX - 0.3, 0, 0.5));
      g.add(block(0.06, 1.6, 0.06, P.wood, SX + 0.3, 0, 0.5));
      g.add(block(0.72, 0.06, 0.06, P.wood, SX, 1.6, 0.5));
      g.add(mesh(G.ico(0.12, 0), C.red, SX - 0.3, 1.1, 0.5));
      g.add(mesh(G.ico(0.12, 0), C.yellow, SX, 1.66, 0.5));
      g.add(mesh(G.ico(0.12, 0), C.pink, SX + 0.3, 0.8, 0.5));
    },
  },
  tool: {
    // L2: anvil on a stump + grindstone on the left. L3: forge chimney with glowing ember + tool rack on the right.
    l2(g) {
      g.add(mesh(G.cyl(0.2, 0.22, 0.36, 6), P.woodDark, -SX, 0.18, 0.4));
      g.add(block(0.44, 0.16, 0.2, P.metalDark, -SX, 0.36, 0.4));
      const horn = mesh(G.cone(0.08, 0.2, 4), P.metalDark, -SX + 0.3, 0.46, 0.4); horn.rotation.z = -Math.PI / 2; g.add(horn);
      const gs = mesh(G.cyl(0.2, 0.2, 0.08, 8), P.stone, -SX, 0.22, -0.2); gs.rotation.z = Math.PI / 2; g.add(gs);
    },
    l3(g) {
      g.add(block(0.5, 0.6, 0.5, P.stone, SX, 0, -0.1));
      g.add(block(0.22, 1.2, 0.22, P.stoneDark || P.stone, SX, 0.6, -0.2));
      g.add(mesh(G.ico(0.12, 0), flatMat(C.orange), SX, 0.5, 0.18));
      g.add(block(0.04, 0.5, 0.04, P.wood, SX - 0.1, 0.6, 0.3));
      g.add(block(0.04, 0.5, 0.04, P.wood, SX + 0.12, 0.6, 0.3));
      g.add(block(0.16, 0.08, 0.08, P.metal, SX - 0.1, 1.08, 0.3));
    },
  },
  cloth: {
    // L2: dress form (mannequin) on the left + two hanging banners. L3: spinning wheel on the right.
    l2(g) {
      g.add(mesh(G.cyl(0.16, 0.2, 0.7, 6), C.cloth2, -SX, 0.65, 0.35));
      g.add(block(0.05, 0.3, 0.05, P.woodDark, -SX, 0, 0.35));
      g.add(mesh(G.ico(0.1, 0), C.cream, -SX, 1.12, 0.35));
      g.add(block(0.26, 1.0, 0.03, C.cloth3, SX + 0.1, 0.9, -0.3));
    },
    l3(g) {
      const wheel = mesh(G.torus(0.3, 0.035, 4, 8), P.wood, SX, 0.55, 0.3); g.add(wheel);
      g.add(block(0.04, 0.6, 0.04, P.woodDark, SX, 0.25, 0.3));
      const sp = mesh(G.box(0.56, 0.04, 0.04), P.woodDark, SX, 0.55, 0.3); g.add(sp);
      g.add(block(0.5, 0.06, 0.3, P.wood, SX, 0, 0.3));
    },
  },
  pottery: {
    // L2: kiln on the left. L3: potter's wheel with wet clay on the right + big amphora.
    l2(g) {
      g.add(block(0.5, 0.36, 0.5, C.clayDark, -SX, 0, 0.0));
      g.add(mesh(G.ico(0.27, 0), C.clay, -SX, 0.48, 0.0));
      g.add(block(0.1, 0.5, 0.1, C.clayDark, -SX + 0.12, 0.5, -0.12));
      g.add(block(0.18, 0.14, 0.06, C.ink, -SX, 0.38, 0.25));
    },
    l3(g) {
      g.add(mesh(G.cyl(0.26, 0.26, 0.06, 6), P.woodDark, SX, 0.33, 0.45));
      g.add(block(0.08, 0.3, 0.08, P.wood, SX, 0, 0.45));
      g.add(mesh(G.ico(0.1, 0), C.clay, SX, 0.46, 0.45));
      g.add(mesh(G.cyl(0.16, 0.12, 0.5, 6), C.teal, SX, 0.25, -0.3));
      g.add(mesh(G.cyl(0.07, 0.1, 0.14, 5), C.teal, SX, 0.57, -0.3));
    },
  },
  toy: {
    // L2: rocking horse on the left + balloon. L3: pinwheel on the roof + gift boxes on the right.
    l2(g) {
      g.add(block(0.5, 0.06, 0.1, P.woodDark, -SX, 0, 0.45));
      g.add(block(0.5, 0.06, 0.1, P.woodDark, -SX, 0, 0.15));
      g.add(block(0.34, 0.22, 0.3, C.toyRed, -SX, 0.2, 0.3));
      g.add(block(0.14, 0.22, 0.16, C.toyRed, -SX + 0.2, 0.4, 0.3));
      g.add(block(0.02, 0.9, 0.02, P.metalDark, -SX - 0.2, 0.3, 0.3));
      g.add(mesh(G.ico(0.15, 0), C.toyYellow, -SX - 0.2, 1.3, 0.3));
    },
    l3(g) {
      g.add(block(0.04, 0.8, 0.04, P.woodDark, SX, POST_H - 0.2, -0.2));
      const blade = G.box(0.24, 0.1, 0.03);
      for (let i = 0; i < 4; i++) { const b = mesh(blade, [C.toyRed, C.toyBlue, C.toyYellow, C.pink][i], SX, POST_H + 0.6, -0.2); b.rotation.z = i * Math.PI / 2; b.position.x += Math.cos(i * Math.PI / 2) * 0.12; b.position.y += Math.sin(i * Math.PI / 2) * 0.12; g.add(b); }
      g.add(block(0.4, 0.3, 0.4, C.toyBlue, SX, 0, 0.4));
      g.add(block(0.08, 0.32, 0.42, C.toyYellow, SX, 0, 0.4));
      g.add(block(0.28, 0.22, 0.28, C.pink, SX + 0.05, 0.3, 0.4));
    },
  },
  tea: {
    // L2: brazier with steaming kettle on the left. L3: two potted tea shrubs on the right.
    l2(g) {
      g.add(mesh(G.cyl(0.2, 0.16, 0.3, 6), P.metalDark, -SX, 0.15, 0.35));
      g.add(mesh(G.ico(0.17, 0), C.teal, -SX, 0.46, 0.35));
      const sp = mesh(G.cyl(0.03, 0.045, 0.18, 4), C.teal, -SX + 0.18, 0.52, 0.35); sp.rotation.z = -1.1; g.add(sp);
      g.add(mesh(G.ico(0.09, 0), flatMat(C.canvasWhite), -SX + 0.26, 0.74, 0.35));
    },
    l3(g) {
      for (const dz of [-0.25, 0.45]) {
        g.add(mesh(G.cyl(0.17, 0.13, 0.26, 5), C.clay, SX, 0.13, dz));
        g.add(mesh(G.ico(0.22, 0), C.tea, SX, 0.46, dz));
      }
    },
  },
  book: {
    // L2: side bookshelf on the left. L3: globe on a stand + ink pot on the right.
    l2(g) {
      g.add(block(0.5, 1.3, 0.08, P.woodDark, -SX, 0, -0.3));
      g.add(block(0.5, 0.05, 0.3, P.wood, -SX, 0.5, -0.18));
      g.add(block(0.5, 0.05, 0.3, P.wood, -SX, 1.0, -0.18));
      const cols = [C.book1, C.book2, C.book3, C.book4];
      for (let i = 0; i < 4; i++) g.add(block(0.08, 0.3 + (i % 2) * 0.05, 0.22, cols[i], -SX - 0.17 + i * 0.11, i < 2 ? 0.55 : 1.05, -0.18));
    },
    l3(g) {
      g.add(block(0.08, 0.9, 0.08, P.woodDark, SX, 0, 0.35));
      g.add(mesh(G.cyl(0.2, 0.2, 0.04, 5), P.woodDark, SX, 0.02, 0.35));
      g.add(mesh(G.ico(0.22, 0), C.blue, SX, 1.1, 0.35));
      g.add(block(0.2, 0.2, 0.2, C.ink, SX - 0.2, 0, -0.3));
    },
  },
  sparkExchange: {
    // L2: vault door with a dial on the left + glowing coin stack. L3: spark chandelier (glowing coins on a pole) right.
    l2(g) {
      g.add(block(0.5, 0.8, 0.14, C.vault, -SX, 0, -0.3));
      const dial = mesh(G.cyl(0.1, 0.1, 0.05, 8), C.gold, -SX, 0.45, -0.21); dial.rotation.x = Math.PI / 2; g.add(dial);
      g.add(block(0.2, 0.05, 0.06, C.goldDark, -SX + 0.14, 0.25, -0.21));
      g.add(mesh(G.cyl(0.14, 0.14, 0.05, 6), flatMat(C.spark), -SX, 0.025, 0.4));
      g.add(mesh(G.cyl(0.14, 0.14, 0.05, 6), flatMat(C.sparkDark), -SX + 0.05, 0.075, 0.42));
    },
    l3(g) {
      g.add(block(0.06, 2.2, 0.06, C.goldDark, SX, 0, 0.3));
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        g.add(mesh(G.cyl(0.1, 0.1, 0.04, 6), flatMat(i % 2 ? C.spark : C.sparkDark), SX + Math.cos(a) * 0.22, 1.9 + (i % 2) * 0.12, 0.3 + Math.sin(a) * 0.22));
      }
    },
  },
};

// ---------------------------------------------------------------------------------------
// Goods: tiny clusters placed on the counter top (y = COUNTER_H). Each ≤ ~60 tris.
// ---------------------------------------------------------------------------------------
const TOP = COUNTER_H;
function crateOf(color, items, itemGeo, x, z, r) {
  const g = group();
  g.add(block(0.5, 0.16, 0.4, P.wood, x, TOP, z));
  for (let i = 0; i < items; i++) {
    const m = mesh(itemGeo, vary(color, 0.05, r), x - 0.15 + (i % 3) * 0.15, TOP + 0.22, z - 0.08 + Math.floor(i / 3) * 0.16);
    g.add(m);
  }
  return g;
}
const GOODS = {
  fruit(r) {
    return group(
      crateOf(C.apple, 5, G.ico(0.08, 0), -0.5, 0.35, r),
      crateOf(C.orangeFruit, 5, G.ico(0.08, 0), 0.1, 0.35, r),
      crateOf(C.grape, 4, G.ico(0.07, 0), 0.6, 0.35, r),
    );
  },
  bread(r) {
    const g = group();
    const loaf = G.capsule(0.08, 0.2, 1, 5);
    for (let i = 0; i < 4; i++) { const m = mesh(loaf, vary(C.bread, 0.05, r), -0.6 + i * 0.4, TOP + 0.08, 0.3); m.rotation.z = Math.PI / 2; g.add(m); }
    // bread basket
    g.add(mesh(G.cyl(0.26, 0.2, 0.18, 6), C.breadDark, 0.55, TOP + 0.09, 0.45));
    for (let i = 0; i < 3; i++) g.add(mesh(G.ico(0.08, 0), C.bread, 0.45 + i * 0.1, TOP + 0.22, 0.4 + (i % 2) * 0.08));
    return g;
  },
  lantern(r) {
    const g = group();
    const body = G.box(0.16, 0.22, 0.16);
    for (let i = 0; i < 4; i++) {
      const x = -0.6 + i * 0.4;
      g.add(mesh(body, flatMat([C.lanternGlow, C.teal, C.pink, C.lanternGlow][i]), x, TOP + 0.11, 0.35));
      g.add(mesh(G.cone(0.12, 0.08, 4), P.woodDark, x, TOP + 0.26, 0.35));
    }
    return g;
  },
  fish(r) {
    const g = group();
    const ice = block(1.5, 0.12, 0.5, 0xe3f6ff, 0, TOP, 0.35);
    g.add(ice);
    const body = G.capsule(0.07, 0.18, 1, 5), tail = G.cone(0.07, 0.12, 3);
    for (let i = 0; i < 5; i++) {
      const x = -0.55 + i * 0.28, col = i % 2 ? C.fishSilver : C.fishBlue;
      const b = mesh(body, col, x, TOP + 0.17, 0.35); b.rotation.z = Math.PI / 2; b.rotation.y = (r() - 0.5) * 0.4;
      const t = mesh(tail, col, x + 0.2, TOP + 0.17, 0.35); t.rotation.z = -Math.PI / 2;
      g.add(b, t);
    }
    return g;
  },
  flower(r) {
    const g = group();
    const pot = G.cyl(0.11, 0.08, 0.18, 5), stem = G.box(0.03, 0.25, 0.03), head = G.ico(0.1, 0);
    const cols = [C.pink, C.yellow, C.purple, C.red, C.teal];
    for (let i = 0; i < 5; i++) {
      const x = -0.65 + i * 0.32;
      g.add(mesh(pot, C.clay, x, TOP + 0.09, 0.35));
      g.add(mesh(stem, C.leaf, x, TOP + 0.3, 0.35));
      g.add(mesh(head, cols[i], x, TOP + 0.45, 0.35));
    }
    return g;
  },
  tool(r) {
    const g = group();
    // hammer
    const hH = mesh(G.box(0.4, 0.04, 0.04), P.wood, -0.55, TOP + 0.03, 0.35);
    g.add(hH, mesh(G.box(0.12, 0.1, 0.18), P.metal, -0.35, TOP + 0.06, 0.35));
    // wrench / rake handle
    const rk = mesh(G.box(0.5, 0.04, 0.04), P.wood, 0.05, TOP + 0.03, 0.35);
    g.add(rk, mesh(G.box(0.05, 0.06, 0.22), P.metalDark, 0.32, TOP + 0.05, 0.35));
    // bucket + toolbox
    g.add(mesh(G.cyl(0.14, 0.11, 0.22, 6), P.metal, 0.65, TOP + 0.11, 0.3));
    g.add(block(0.4, 0.2, 0.25, C.red, -0.15, TOP + 0.08, 0.5));
    return g;
  },
  cloth(r) {
    const g = group();
    // folded bolts of cloth: stacked slabs
    const cols = [C.cloth1, C.cloth2, C.cloth3, C.purple];
    for (let i = 0; i < 4; i++) {
      const x = -0.6 + i * 0.4;
      for (let k = 0; k < 3; k++) g.add(block(0.32, 0.07, 0.3, vary(cols[i], 0.08, r), x, TOP + k * 0.07, 0.35));
    }
    // a hanging drape at the back post
    const drape = block(0.3, 1.1, 0.04, C.cloth1, -0.7, 0.75, -0.3);
    g.add(drape);
    return g;
  },
  pottery(r) {
    const g = group();
    const vase = G.cyl(0.08, 0.12, 0.28, 6), bowl = G.cyl(0.14, 0.08, 0.12, 6), jug = G.dodeca(0.13);
    g.add(mesh(vase, C.clay, -0.6, TOP + 0.14, 0.35));
    g.add(mesh(bowl, C.clayDark, -0.2, TOP + 0.06, 0.4));
    g.add(mesh(jug, C.teal, 0.2, TOP + 0.12, 0.35));
    g.add(mesh(G.cyl(0.04, 0.05, 0.1, 5), C.teal, 0.2, TOP + 0.27, 0.35));
    g.add(mesh(vase, C.blue, 0.6, TOP + 0.14, 0.35));
    g.add(mesh(bowl, C.clay, 0.45, TOP + 0.06, 0.6));
    return g;
  },
  toy(r) {
    const g = group();
    // stacked blocks
    g.add(block(0.18, 0.18, 0.18, C.toyRed, -0.6, TOP, 0.35));
    g.add(block(0.18, 0.18, 0.18, C.toyBlue, -0.6, TOP + 0.18, 0.35));
    g.add(block(0.18, 0.18, 0.18, C.toyYellow, -0.42, TOP, 0.4));
    // ball
    g.add(mesh(G.ico(0.14, 1), C.toyRed, 0, TOP + 0.13, 0.35));
    // spinning top
    g.add(mesh(G.cone(0.12, 0.2, 6), C.toyBlue, 0.4, TOP + 0.1, 0.35));
    g.add(mesh(G.box(0.03, 0.12, 0.03), P.woodDark, 0.4, TOP + 0.26, 0.35));
    // toy Glimmer plush
    g.add(mesh(G.ico(0.13, 1), P.glimmerBlue, 0.7, TOP + 0.12, 0.35));
    return g;
  },
  tea(r) {
    const g = group();
    // teapot
    g.add(mesh(G.ico(0.17, 1), C.teal, -0.5, TOP + 0.16, 0.35));
    g.add(mesh(G.cyl(0.05, 0.05, 0.08, 5), C.teal, -0.5, TOP + 0.33, 0.35));
    const spout = mesh(G.cyl(0.03, 0.045, 0.18, 4), C.teal, -0.3, TOP + 0.22, 0.35); spout.rotation.z = -1.1; g.add(spout);
    // cups
    const cup = G.cyl(0.07, 0.05, 0.1, 5);
    for (let i = 0; i < 3; i++) g.add(mesh(cup, [C.pink, C.cream, C.yellow][i], 0 + i * 0.25, TOP + 0.05, 0.35));
    // tea leaves jar
    g.add(mesh(G.cyl(0.1, 0.1, 0.24, 6), C.tea, 0.7, TOP + 0.12, 0.3));
    g.add(mesh(G.cyl(0.11, 0.11, 0.04, 6), C.teaDark, 0.7, TOP + 0.26, 0.3));
    return g;
  },
  book(r) {
    const g = group();
    const cols = [C.book1, C.book2, C.book3, C.book4];
    // standing books
    for (let i = 0; i < 6; i++) g.add(block(0.09, 0.3 + (i % 3) * 0.04, 0.22, cols[i % 4], -0.7 + i * 0.1, TOP, 0.3));
    // flat stack
    for (let k = 0; k < 3; k++) g.add(block(0.3, 0.06, 0.22, cols[(k + 1) % 4], 0.2, TOP + k * 0.06, 0.35));
    // open book
    g.add(block(0.34, 0.03, 0.24, C.paper, 0.65, TOP, 0.35));
    g.add(block(0.02, 0.05, 0.24, C.book1, 0.65, TOP, 0.35));
    return g;
  },
  sparkExchange(r) {
    const g = group();
    // small vault with gold Spark coins and a scale
    g.add(block(0.5, 0.42, 0.4, C.vault, -0.5, TOP, 0.3));
    g.add(mesh(G.cyl(0.08, 0.08, 0.04, 6), C.gold, -0.5, TOP + 0.21, 0.52).rotateX(Math.PI / 2));
    const coin = G.cyl(0.07, 0.07, 0.03, 6);
    for (let i = 0; i < 5; i++) g.add(mesh(coin, flatMat(i % 2 ? C.spark : C.sparkDark), 0.05 + (i % 3) * 0.15, TOP + 0.015 + Math.floor(i / 3) * 0.035, 0.3 + (i % 2) * 0.12));
    // balance scale
    g.add(mesh(G.box(0.04, 0.3, 0.04), P.metalDark, 0.6, TOP + 0.15, 0.35));
    const beam = mesh(G.box(0.4, 0.03, 0.03), P.metalDark, 0.6, TOP + 0.3, 0.35); g.add(beam);
    g.add(mesh(G.cyl(0.08, 0.06, 0.03, 6), C.gold, 0.42, TOP + 0.2, 0.35));
    g.add(mesh(G.cyl(0.08, 0.06, 0.03, 6), C.gold, 0.78, TOP + 0.2, 0.35));
    return g;
  },
};

// ---------------------------------------------------------------------------------------
// Stall definitions: colors, emblem, flag color, special back-wall tint
// ---------------------------------------------------------------------------------------
export const STALL_DEFS = {
  fruit:         { name: 'Fruit Stand',     awning: [C.red, C.canvasWhite],    emblem: C.apple,     shape: 'circle',  wood: P.wood },
  bread:         { name: 'Bakery',          awning: [C.orange, C.cream],       emblem: C.bread,     shape: 'bar',     wood: P.wood },
  lantern:       { name: 'Lantern Shop',    awning: [C.yellow, C.canvasWhite], emblem: C.lanternGlow, shape: 'diamond', wood: P.woodDark },
  fish:          { name: 'Fish Market',     awning: [C.blue, C.canvasWhite],   emblem: C.fishBlue,  shape: 'circle',  wood: P.wood },
  flower:        { name: 'Flower Cart',     awning: [C.pink, C.canvasWhite],   emblem: C.pink,      shape: 'circle',  wood: P.wood },
  tool:          { name: 'Tool Smith',      awning: [C.brown, C.cream],        emblem: P.metal,     shape: 'bar',     wood: P.woodDark },
  cloth:         { name: 'Cloth Weaver',    awning: [C.purple, C.canvasWhite], emblem: C.cloth1,    shape: 'bar',     wood: P.wood },
  pottery:       { name: 'Pottery',         awning: [C.clay, C.cream],         emblem: C.clay,      shape: 'circle',  wood: P.wood },
  toy:           { name: 'Toy Box',         awning: [C.toyBlue, C.toyYellow],  emblem: C.toyRed,    shape: 'diamond', wood: P.wood },
  tea:           { name: 'Tea House',       awning: [C.green, C.cream],        emblem: C.teal,      shape: 'circle',  wood: P.woodDark },
  book:          { name: 'Book Nook',       awning: [C.book2, C.cream],        emblem: C.book1,     shape: 'bar',     wood: P.woodDark },
  sparkExchange: { name: 'Spark Exchange',  awning: [C.gold, C.ink],           emblem: C.spark,     shape: 'diamond', wood: C.vaultDark, vault: true },
};
export const STALL_TYPES = Object.keys(STALL_DEFS);

// ---------------------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------------------
/**
 * Build a stall. opts: { type, level=1, seed, outline=true }
 * @returns {THREE.Group}
 */
export function makeStall(type, opts = {}) {
  const def = STALL_DEFS[type];
  if (!def) throw new Error(`Unknown stall type "${type}"`);
  const seed = opts.seed ?? (type.length * 131 + 7);
  const root = new THREE.Group();
  root.name = `stall_${type}`;
  // `body` is the squash pivot (scale at base). Visual children live under body.
  const body = new THREE.Group(); body.name = 'body';
  root.add(body);

  // --- permanent parts (never swapped) ---
  const baseRaw = group(
    counter(def.wood, def.vault ? C.vaultDark : P.woodDark),
    backShelf(def.wood, def.vault ? C.vaultDark : P.woodDark),
    posts(def.vault ? C.vaultDark : P.woodDark),
    GOODS[type](rng(seed)),
  );
  // Bake ~40 small meshes → 1 toon mesh (+1 flat mesh if glowing goods). 2–4 draw calls per stall.
  const base = opts.merge === false ? baseRaw : mergeGroup(baseRaw);
  base.name = 'base';
  body.add(base);

  // --- level-dependent parts (rebuilt on setLevel) ---
  const levelGroup = new THREE.Group(); levelGroup.name = 'levelParts';
  body.add(levelGroup);

  // Slots (local coords). counter: where the customer stands to be served; queue: 4 spots behind.
  const slots = {
    counter: new THREE.Vector3(0, 0, 1.15),
    queue: [1.15, 1.95, 2.75, 3.55].map((z) => new THREE.Vector3(0, 0, z)),
    sign: null,
  };

  const ud = root.userData;
  ud.stallType = type;
  ud.name = def.name;
  ud.footprint = [2, 2];
  ud.category = 'stall';
  ud.level = 0;
  ud.slots = slots;
  ud.body = body;
  ud.flag = null;
  ud.lanterns = [];
  ud.swapping = false;
  ud.pending = null;

  const buildLevel = (lvl) => {
    // dispose old level parts (merged geometry is unique per stall → dispose it)
    removeOutline(levelGroup);
    disposeMerged(levelGroup);
    while (levelGroup.children.length) levelGroup.remove(levelGroup.children[0]);
    const [a, b] = def.awning;
    const raw = group(awning(a, b, lvl >= 2));
    const sign = hangingSign(def.emblem, def.shape);
    raw.add(sign);
    ud.lanterns = [];
    ud.flag = null;
    let flagMesh = null;
    // S31: generic kit per level is lanterns (L2+) and gold trim + flag (L3); the side pieces are PER TYPE (LEVEL_EXTRAS)
    // so a Bakery L2 (oven) looks nothing like a Fish Market L2 (ice barrel), and L3 adds a second, richer piece.
    const extras = LEVEL_EXTRAS[type];
    if (lvl >= 2) {
      const l = lanterns(lvl >= 3);
      raw.add(l);
      ud.lanterns = l.userData.lanterns;
      if (extras && extras.l2) { const x2 = group(); extras.l2(x2); x2.name = 'extraL2'; raw.add(x2); } else raw.add(sideCrate(-W / 2 - 0.4));
    }
    if (lvl >= 3) {
      raw.add(goldTrim());
      const f = roofFlag(a === C.canvasWhite ? b : a);
      raw.add(f);
      flagMesh = f.userData.flag;
      if (extras && extras.l3) { const x3 = group(); extras.l3(x3); x3.name = 'extraL3'; raw.add(x3); } else raw.add(sideCrate(W / 2 + 0.4));
    }
    // Keep the sign (swings) and flag (waves) as live meshes; bake everything else.
    const keepSet = new Set();
    sign.traverse((o) => { if (o.isMesh) keepSet.add(o); });
    if (flagMesh) keepSet.add(flagMesh);
    if (opts.merge === false) {
      levelGroup.add(raw);
    } else {
      const merged = mergeGroup(raw, { keep: (m) => keepSet.has(m) });
      // Re-parent the (single) sign mesh under a pivot at its hanging point so it swings correctly
      const signPivot = new THREE.Group(); signPivot.position.copy(sign.position); signPivot.name = 'sign';
      for (const m of [...merged.children]) if (keepSet.has(m) && m !== flagMesh) { merged.remove(m); m.position.sub(sign.position); signPivot.add(m); }
      merged.add(signPivot);
      levelGroup.add(merged);
      sign.userData.disposable = true;
      slots.sign = signPivot;
    }
    if (opts.merge === false) slots.sign = sign;
    ud.flag = flagMesh;
    if (opts.outline !== false) addOutline(levelGroup);
    ud.level = lvl;
  };

  /**
   * Set visual level 1..3. With animate=true (and a `sequences` player or `game`),
   * plays the "stallLevelUp" Sequence (squash → swap → pop → settle) and dust via vfx.
   * ctx: { animate?: boolean, game?, sequences?, vfx? }
   */
  ud.setLevel = (lvl, ctx = {}) => {
    lvl = THREE.MathUtils.clamp(Math.round(lvl), 1, 3);
    const player = ctx.sequences || (ctx.game && ctx.game.sequences);
    if (!ctx.animate || !player) {
      // Instant path. If an animated swap is mid-flight, let it finish but land on this level.
      if (ud.swapping) { ud.pending = { lvl, ctx: null }; return null; }
      if (lvl !== ud.level) buildLevel(lvl);
      body.scale.set(1, 1, 1);
      return null;
    }
    if (lvl === ud.level && !ud.swapping) return null;
    if (ud.swapping) { ud.pending = { lvl, ctx }; return null; } // queue, never drop (low-fps safe)
    ud.swapping = true;
    const seq = makeLevelSwapSequence(root, () => buildLevel(lvl), ctx.vfx);
    seq.then(() => {
      ud.swapping = false;
      const p = ud.pending; ud.pending = null;
      if (p && p.lvl !== ud.level) ud.setLevel(p.lvl, p.ctx || { animate: false });
    });
    player.play(seq, { root });
    return seq;
  };

  // Idle update: flag waves, sign swings, lanterns bob. Cheap — call from your system.
  let t = Math.random() * 10;
  ud.update = (dt) => {
    t += dt;
    const sign = slots.sign;
    if (sign) sign.rotation.z = Math.sin(t * 1.7) * 0.05;
    if (ud.flag) { ud.flag.rotation.y = Math.sin(t * 4) * 0.25; ud.flag.scale.x = 1 + Math.sin(t * 6) * 0.06; }
  };

  buildLevel(opts.level ?? 1);
  if (opts.outline !== false) addOutline(base);
  // Shadow flags
  root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

/**
 * Level swap sequence (see phase table at top of file).
 * Pose is set ABSOLUTELY per phase from values snapshotted in onEnter.
 */
export function makeLevelSwapSequence(root, swapFn, vfx) {
  const body = root.userData.body;
  const basePos = root.position; // dust at world pos
  const seq = new Sequence('stallLevelUp')
    .phase('squash', 120, Easing.outCubic, (e, ctx, t, ph) => {
      const s = THREE.MathUtils.lerp(ph.state.from, 0.78, e);
      setSquash(body, s, 'y');
    }, { onEnter: (ctx, ph) => { ph.state.from = body.scale.y; } })
    .phase('swap', 1, Easing.linear, null, {
      onEnter: () => {
        swapFn();
        setSquash(body, 0.78, 'y');
        if (vfx && vfx.dust) {
          const p = new THREE.Vector3(); root.getWorldPosition(p);
          vfx.dust.burst(p, 10, { size: 0.32, speed: 2.2, dur: 0.5, up: 0.6 });
        }
        if (vfx && vfx.sparks) { const p = new THREE.Vector3(0, 1.4, 0.3); root.localToWorld(p); vfx.sparks.burst(p, 8, 4); }
      },
    })
    .phase('pop', 260, Easing.outBack, (e) => {
      // outBack overshoots > 1 → body goes tall then returns; volume-preserving
      const s = THREE.MathUtils.lerp(0.78, 1.0, e);
      setSquash(body, s, 'y');
    })
    .phase('settle', 180, Easing.outCubic, (e, ctx, t, ph) => {
      const s = THREE.MathUtils.lerp(ph.state.from, 1.0, e);
      setSquash(body, s, 'y');
    }, { onEnter: (ctx, ph) => { ph.state.from = body.scale.y; }, onExit: () => body.scale.set(1, 1, 1) });
  return seq;
}

// ---------------------------------------------------------------------------------------
// Named factories (contract: makeStallX(opts) → Group)
// ---------------------------------------------------------------------------------------
export const makeStallFruit = (o) => makeStall('fruit', o);
export const makeStallBread = (o) => makeStall('bread', o);
export const makeStallLantern = (o) => makeStall('lantern', o);
export const makeStallFish = (o) => makeStall('fish', o);
export const makeStallFlower = (o) => makeStall('flower', o);
export const makeStallTool = (o) => makeStall('tool', o);
export const makeStallCloth = (o) => makeStall('cloth', o);
export const makeStallPottery = (o) => makeStall('pottery', o);
export const makeStallToy = (o) => makeStall('toy', o);
export const makeStallTea = (o) => makeStall('tea', o);
export const makeStallBook = (o) => makeStall('book', o);
export const makeStallSparkExchange = (o) => makeStall('sparkExchange', o);

/** Count triangles under a root (excluding outline hulls) — for stats. */
export function countTris(root, includeOutline = false) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || (!includeOutline && o.userData.isOutline)) return;
    const g = o.geometry; const c = g.index ? g.index.count : g.attributes.position.count;
    n += (c / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return Math.round(n);
}

/** Catalog entries for props.js (cost = placeholder; Chat 4B balances). */
export const STALL_PROPS = {};
const COSTS = { fruit: 40, bread: 55, lantern: 70, fish: 65, flower: 50, tool: 90, cloth: 85, pottery: 75, toy: 95, tea: 80, book: 100, sparkExchange: 150 };
for (const type of STALL_TYPES) {
  STALL_PROPS[`stall_${type}`] = {
    make: (o) => makeStall(type, o),
    footprint: [2, 2],
    category: 'stall',
    stallType: type,
    name: STALL_DEFS[type].name,
    cost: COSTS[type],
    tris: 0, // filled lazily by props.js measureCatalog()
  };
}
