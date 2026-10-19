// Chat 2A — Glimmer customer variants. Built ON TOP of Foundation makeGlimmer() (same part names), adding
// an accessory kit per customer type. Accessories are static → baked with mergeGroup() into ONE toon mesh
// (+ outline hull) parented to `body` so they squash/stretch with it. The body itself stays live.
// Budget: ≤ 450 tris, ≤ 12 draw calls per variant incl. outlines (measured in HANDOFF_2A).
//
// 2A ships: regular, saver, spender, vip  (P1)     2D adds: impulse, haggler, kid, elder, tourist, critic,
// collector, newbie — using the same `VARIANTS[type] = { color, size, build(body, kit) }` pattern below.
import * as THREE from '../../../vendor/three.module.js';
import { G, mesh, group, rng, vary } from '../geo.js';
import { PALETTE as P, toonMat, flatMat } from '../../core/Toon.js';
import { addOutline, removeOutline } from '../../core/Outline.js';
import { makeGlimmer } from '../glimmer.js';
import { mergeGroup } from '../props/merge.js';

export const GLIMMER_TYPES = ['saver', 'spender', 'impulse', 'haggler', 'vip', 'kid', 'elder', 'tourist', 'critic', 'collector', 'newbie', 'regular'];

/** Economy-facing flavour per type (6A/4A read these; purely data). */
export const GLIMMER_INFO = {
  regular:   { name: 'Regular',   color: P.glimmerBlue,   size: 1.0,  budget: 1.0, patience: 1.0, blurb: 'Steady shopper. Pays fair prices.' },
  saver:     { name: 'Saver',     color: P.glimmerGreen,  size: 0.95, budget: 0.7, patience: 1.4, blurb: 'Carries a piggy pack. Loves discounts, hates waste.' },
  spender:   { name: 'Spender',   color: P.glimmerPink,   size: 1.05, budget: 1.6, patience: 0.7, blurb: 'Bags everywhere. Buys wants, not needs.' },
  vip:       { name: 'VIP',       color: P.glimmerYellow, size: 1.15, budget: 3.0, patience: 0.5, blurb: 'Crown + cape. Tips big if served fast.' },
  // 2D (placeholders fall back to regular look with a different colour until 2D lands)
  impulse:   { name: 'Impulse',   color: 0xFF8A65, size: 1.0,  budget: 1.2, patience: 0.4 },
  haggler:   { name: 'Haggler',   color: 0xB39DDB, size: 1.0,  budget: 0.9, patience: 1.6 },
  kid:       { name: 'Kid',       color: 0x80DEEA, size: 0.7,  budget: 0.3, patience: 0.6 },
  elder:     { name: 'Elder',     color: 0xBCAAA4, size: 0.95, budget: 1.1, patience: 1.8 },
  tourist:   { name: 'Tourist',   color: 0xFFF176, size: 1.0,  budget: 1.4, patience: 0.9 },
  critic:    { name: 'Critic',    color: 0x90A4AE, size: 1.0,  budget: 1.0, patience: 1.0 },
  collector: { name: 'Collector', color: 0xCE93D8, size: 1.0,  budget: 2.0, patience: 1.2 },
  newbie:    { name: 'Newbie',    color: 0xA5D6A7, size: 0.9,  budget: 0.8, patience: 1.0 },
};

// ─── accessory builders: (kit, r) → add static meshes to `kit` (local space = body space, feet at y=0) ───
const BUILD = {
  regular(kit, r) {
    // knitted scarf: torus around the "neck" + a dangling tail
    const sc = vary(P.red, 0.08, r);
    const ring = mesh(G.torus(0.33, 0.07, 6, 12), sc, 0, 0.62, 0); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1, 0.8); kit.add(ring);
    const tail = mesh(G.box(0.12, 0.3, 0.06), sc, 0.22, 0.46, 0.22); tail.rotation.z = -0.3; tail.rotation.x = 0.2; kit.add(tail);
    kit.add(mesh(G.box(0.14, 0.05, 0.07), P.white, 0.26, 0.31, 0.26));  // fringe
  },
  saver(kit, r) {
    // piggy backpack: pink barrel on the back, snout, two straps, coin slot
    const pk = 0xF48FB1, pkd = 0xE57AA0;
    const bag = mesh(G.sphere(0.24, 10, 8), pk, 0, 0.56, -0.38); bag.scale.set(1, 0.85, 0.75); kit.add(bag);
    const snout = mesh(G.cyl(0.08, 0.1, 0.08, 8), pkd, 0, 0.5, -0.62); snout.rotation.x = Math.PI / 2; kit.add(snout);
    for (const sx of [-1, 1]) { const ear = mesh(G.cone(0.06, 0.1, 4), pkd, sx * 0.13, 0.78, -0.4); kit.add(ear); }
    const slot = mesh(G.box(0.14, 0.03, 0.05), 0x5D4037, 0, 0.76, -0.36); kit.add(slot);
    const coin = new THREE.Mesh(G.cyl(0.07, 0.07, 0.025, 10), flatMat(P.sparkGold)); coin.position.set(0, 0.82, -0.36); coin.rotation.z = 0.2; coin.userData.noOutline = true; kit.add(coin);
    for (const sx of [-1, 1]) { const strap = mesh(G.box(0.05, 0.3, 0.05), 0x795548, sx * 0.2, 0.6, -0.2); strap.rotation.x = -0.5; kit.add(strap); }
  },
  spender(kit, r) {
    // two shopping bags (one each side) + a shopping hat (little bow)
    const bagCols = [vary(0xFFB74D, 0.1, r), vary(0x4DB6AC, 0.1, r)];
    for (const sx of [-1, 1]) {
      const c = bagCols[sx > 0 ? 1 : 0];
      const bag = mesh(G.box(0.22, 0.28, 0.14), c, sx * 0.5, 0.2, 0.05); kit.add(bag);
      const handle = mesh(G.torus(0.08, 0.015, 4, 10, Math.PI), 0x5D4037, sx * 0.5, 0.36, 0.05); kit.add(handle);
      const label = mesh(G.box(0.1, 0.08, 0.01), P.white, sx * 0.5, 0.2, 0.125); kit.add(label);
      const stick = mesh(G.box(0.04, 0.2, 0.04), c, sx * 0.4, 0.42, 0.05); stick.rotation.z = sx * 0.6; kit.add(stick); // "arm" holding the bag
    }
    const bow = group(mesh(G.sphere(0.07, 6, 5), P.red, -0.08, 0.98, 0.05), mesh(G.sphere(0.07, 6, 5), P.red, 0.08, 0.98, 0.05), mesh(G.sphere(0.04, 6, 5), 0xB71C1C, 0, 0.98, 0.07));
    bow.children.forEach((m) => { m.scale.set(1, 0.7, 0.6); }); kit.add(bow);
  },
  vip(kit, r) {
    // gold crown with 4 points + jewel, plus a purple cape hanging from the back
    const gold = P.sparkGold, goldD = P.sparkGoldDark;
    const band = mesh(G.cyl(0.19, 0.17, 0.1, 8), gold, 0, 0.98, 0); kit.add(band);
    for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + Math.PI / 4; const pt = mesh(G.cone(0.055, 0.14, 4), gold, Math.cos(an) * 0.16, 1.08, Math.sin(an) * 0.16); kit.add(pt); }
    const jewel = new THREE.Mesh(G.sphere(0.045, 6, 5), flatMat(P.red)); jewel.position.set(0, 0.99, 0.18); jewel.userData.noOutline = true; kit.add(jewel);
    const trim = mesh(G.torus(0.18, 0.02, 4, 10), goldD, 0, 0.93, 0); trim.rotation.x = Math.PI / 2; kit.add(trim);
    // cape: a thin trapezoid built from a scaled box, flared at the bottom
    const cape = mesh(G.box(0.5, 0.55, 0.04), P.debtFogDark ?? 0x5E35B1, 0, 0.32, -0.42); cape.rotation.x = -0.25; kit.add(cape);
    const capeHem = mesh(G.box(0.62, 0.08, 0.05), 0x4527A0, 0, 0.06, -0.49); kit.add(capeHem);
    const collar = mesh(G.torus(0.3, 0.05, 6, 12, Math.PI), P.white, 0, 0.66, -0.05); collar.rotation.x = Math.PI / 2; collar.rotation.z = Math.PI; kit.add(collar);
  },
};

/**
 * CHANGE_REQUEST [2D] (applied by 10A, additive): let another module supply the accessory builder for a type, so
 * `makeGlimmerVariant('kid')` builds the 2D kit instead of the regular fallback. Signature of fn: (kit, r) → void.
 * Returns true if registered (existing 2A builders are never overwritten unless `force`).
 */
export function registerBuilder(type, fn, force = false) {
  if (typeof fn !== 'function' || !type) return false;
  if (BUILD[type] && !force) return false;
  BUILD[type] = fn;
  if (!GLIMMER_TYPES.includes(type)) GLIMMER_TYPES.push(type);
  return true;
}
export function hasBuilder(type) { return !!BUILD[type]; }

/**
 * Build a Glimmer customer of `type` (∈ GLIMMER_TYPES). Returns a Group with Foundation part names plus
 * `userData.parts.kit` (merged accessory mesh group), `userData.type`, `userData.info`.
 * @param {string} type
 * @param {{ seed?:number, color?:number, size?:number, outline?:boolean }} opts
 */
export function makeGlimmerVariant(type = 'regular', opts = {}) {
  const info = GLIMMER_INFO[type] || GLIMMER_INFO.regular;
  const r = rng(opts.seed ?? 1);
  const root = makeGlimmer({ color: opts.color ?? info.color, size: opts.size ?? info.size });
  root.name = 'glimmer_' + type;
  const body = root.userData.parts.body;
  if (opts.compact !== false) compactGlimmer(root);   // 13 dc → 6 dc for the bare body
  const build = BUILD[type] || BUILD.regular;    // 2D registers its 8 builders via registerBuilder() (CHANGE_REQUEST [2D], applied 10A)
  const raw = new THREE.Group(); raw.name = 'kit_raw'; raw.userData.color = opts.color ?? info.color;
  build(raw, r);
  body.add(raw);                                  // merge in body space so it rides squash/stretch
  const kit = mergeGroup(raw); kit.name = 'kit';
  body.remove(raw);
  body.add(kit);
  if (opts.outline !== false) addOutline(kit);
  root.userData.parts.kit = kit;
  root.userData.type = type;
  root.userData.info = info;
  if (opts.fuse !== false && opts.compact !== false) fuseGlimmer(root, opts);   // 11A: 8 → 6 meshes
  return root;
}

/**
 * Bake the Foundation Glimmer body (shell + base + peak = 3 toon meshes + 3 outline hulls) into ONE toon mesh
 * + ONE hull, and the 4 eye meshes into ONE flat mesh. Keeps `body` (squash pivot), `face` (blink), `mouth`
 * (frown flip), `core`, `shadow` live. parts.shell now points at the merged body mesh (vertex-colored, so
 * tint = material.color multiply; CreatureAnimator handles that).
 */
export function compactGlimmer(root) {
  const p = root.userData.parts; const body = p.body, face = p.face;
  if (!body || body.getObjectByName('merged_body')) return root;
  removeOutline(body);
  const tmp = new THREE.Group(); body.add(tmp);
  for (const c of body.children.slice()) if (c.isMesh && c.material.isMeshToonMaterial) tmp.add(c);
  const merged = mergeGroup(tmp); body.remove(tmp);
  const bodyMesh = merged.children.find((m) => m.name === 'merged_toon'); if (bodyMesh) { bodyMesh.name = 'merged_body'; body.add(bodyMesh); p.shell = bodyMesh; }
  if (face) {
    const ftmp = new THREE.Group(); face.add(ftmp);
    for (const c of face.children.slice()) if (c.isMesh && c !== p.mouth && c.name !== 'mouth') ftmp.add(c);
    const fm = mergeGroup(ftmp); face.remove(ftmp);
    const eyes = fm.children.find((m) => m.name === 'merged_flat'); if (eyes) { eyes.name = 'eyes'; eyes.userData.noOutline = true; eyes.castShadow = eyes.receiveShadow = false; face.add(eyes); p.eyes = eyes; }
  }
  if (bodyMesh) addOutline(bodyMesh);
  return root;
}

/**
 * 11A perf (Lever 1): fuse everything static under `body` — the compacted body mesh, the merged accessory kit and
 * the glow core — into ONE toon mesh (+ ONE outline hull) and ONE flat mesh. `face` (blink/mouth) and `live`
 * (2D flourish pivot) stay separate because the animator moves them. After this a bare variant is 6 meshes
 * (toon, hull, flat, eyes, mouth, shadow) instead of 8–11. parts.kit → the fused group (still has 'merged_toon'),
 * parts.shell → fused toon mesh (vertex-colored, tint via material.color multiply), parts.core → fused flat mesh.
 */
export function fuseGlimmer(root, opts = {}) {
  const p = root.userData.parts; const body = p && p.body;
  if (!body || body.userData.fused) return root;
  const movers = new Set([p.face, p.live].filter(Boolean));
  const tmp = new THREE.Group(); tmp.name = 'fuse_raw'; body.add(tmp);
  for (const c of body.children.slice()) {
    if (c === tmp || movers.has(c)) continue;
    if (c.isMesh || c.name === 'kit') { removeOutline(c); tmp.add(c); }
  }
  const fused = mergeGroup(tmp); body.remove(tmp); fused.name = 'kit'; body.add(fused);
  for (const m of fused.children) if (m.name === 'merged_flat') { m.userData.noOutline = true; m.castShadow = m.receiveShadow = false; }
  if (opts.outline !== false) addOutline(fused);
  body.userData.fused = true;
  p.kit = fused;
  p.shell = fused.children.find((m) => m.name === 'merged_toon') || p.shell;
  p.core = fused.children.find((m) => m.name === 'merged_flat') || null;
  return root;
}

/** Count triangles + meshes under a group (same as props.js countTris but local to avoid import cycle). */
export function measureCreature(g) {
  let tris = 0, meshes = 0, hulls = 0;
  g.traverse((o) => { if (!o.isMesh) return; const geo = o.geometry; const n = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3; if (o.userData.isOutline) hulls++; else { meshes++; tris += n; } });
  return { tris: Math.round(tris), meshes, hulls, drawCalls: meshes + hulls };
}

export const GLIMMER_VARIANTS_READY = ['regular', 'saver', 'spender', 'vip'];
