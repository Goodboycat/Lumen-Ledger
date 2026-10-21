// Chat 2B — the 6 hireable Helper creatures + HelperAnimator.
//
//   makeHelper(type, opts) → Group     type ∈ HELPER_TYPES
//   HELPER_TYPES, HELPER_INFO           (data for 4A economy / 5 build / 7 UI)
//   HelperAnimator(root, type, opts)   same interface as CreatureAnimator (.play/.update/.moodTint/.faceTo/.hit)
//                                      clips: idle · work · carry · happy (+ walk/sad/pay/browse/wait/angry inherited)
//   HELPER_ANIMS = ['idle','work','carry','happy','walk']
//
// Rig (every helper has the same part names so ONE animator drives all six):
//   root (feet, y=0)                      ← mover sets position; animator sets rotation.y (facing)
//    └ body (squash pivot, scale by setSquash)
//        ├ torso  Group  = ONE merged toon mesh (+1 outline hull) [+ ONE merged flat mesh for glow bits]
//        ├ head   Group  pivot at the neck → merged toon (+hull) + face(eyes = ONE flat mesh)   live: nod / tilt
//        ├ tool   Group  job prop (ledger · crate · spark sack · shield · pointing paw · watering can) live: lift / swing
//        ├ held   Group  generic delivery crate shown ONLY during `carry`
//        ├ wingL/wingR (bee only, flat, noOutline)   tail (fox only)
//    └ shadow (flat disc, noOutline)
// Draw calls per helper incl. outlines: 9–11 at rest (≤ 12 budget), +2 while carrying. Tris measured in HANDOFF_2B.
//
// ───────────────────────── PHASE TABLES (ms · easing) — all clips are Sequences, poses set absolutely ─────────────────────────
// idle   loop  breathe (CreatureAnimator) + per-type idle tic: owl head tilt sine 0.7 Hz · bee hover bob 4 Hz ±0.06
//              · fox tail wag 2 Hz · tortoise slow blink only · snail eyestalk sway 1 Hz · mole sniff (head nod 3 Hz small)
// work   loop  800 ms, job specific, `onWork(worldPos)` + vfx.sparks fire on the BEAT phase enter:
//   tallyOwl        dip 200 outCubic (head nod .35, ledger up .08) → scribble 400 linear (quill = tool rotZ ±.25 × 4 cycles, head nod .35)
//                   [beat @ scribble] → lift 200 outBack (back to rest)
//   packMole        crouch 250 outCubic (squash .84, crate y −.05) → heave 150 outBack (stretch 1.12, crate y +.42, lean −.15)
//                   [beat @ heave] → hold 150 linear → set 250 inQuad (crate down, squash .92 then dust)
//   sparkBee        wind 150 inQuad (lean −.2, hover −.1) → zip 200 outCubic (lean .45, hover +.25, stretch 1.15)
//                   → collect 250 linear (tool = sack pulse scale 1→1.25→1 ×2) [beat @ collect] → return 200 outBack
//   guardTortoise   brace 200 outCubic (squash .9, lean .1) → raise 200 outBack (shield = tool rotX −1.2, y +.25)
//                   [beat @ raise] → hold 200 linear (shield jitter ±.02) → lower 200 inOutCubic
//   scoutFox        crouch 150 outCubic (squash .9) → point 200 outBack (tool = arm rotX −1.4, lean .25, tail up .6, head tilt .2)
//                   [beat @ point] → hold 250 linear (arm bob) → return 200 inOutCubic
//   gardenerSnail   lean 250 inOutCubic (lean .25, can = tool rotX .9) → pour 300 linear (can rotX .9→1.2, glow bud scale pulse)
//                   [beat @ pour] → return 250 outBack
// carry  loop  480 ms hop with `held` crate visible: push 100 outQuad (squash .92) → air 200 inOutQuad (y .18, stretch 1.08,
//              held y +.04 lag) → land 60 inQuad (squash .9, dust) → settle 120 outBack
// happy  600   crouch 120 outCubic (.82) → leap 260 outCubic (y .9, stretch 1.25, spin 360°, tool wave rotZ ±.6)
//              → land 80 inQuad (.78, dust) → settle 140 outBack  (same table as Glimmers so crowds celebrate in sync)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import * as THREE from '../../../vendor/three.module.js';
import { G, mesh, rng, vary } from '../geo.js';
import { PALETTE as P, flatMat, toonMat } from '../../core/Toon.js';
import { addOutline } from '../../core/Outline.js';
import { mergeGroup } from '../props/merge.js';
import { Sequence } from '../../anim/Sequencer.js';
import { Easing } from '../../anim/Easing.js';
import { CreatureAnimator } from './animator.js';
import { measureCreature } from './glimmers.js';

export const HELPER_TYPES = ['tallyOwl', 'packMole', 'sparkBee', 'guardTortoise', 'scoutFox', 'gardenerSnail'];
export const HELPER_ANIMS = ['idle', 'work', 'carry', 'happy', 'walk'];

/** Economy / UI facing data (4A, 5, 7A read these). wage = Spark per Season, effect = multiplier hint for 4A. */
export const HELPER_INFO = {
  tallyOwl:      { name: 'Tally-Owl',      job: 'Bookkeeper', color: 0x8D6E63, wage: 6,  effect: { ledgerAccuracy: 1 },  blurb: 'Keeps the ledger. Shows exact costs before you buy.' },
  packMole:      { name: 'Pack-Mole',      job: 'Hauler',     color: 0x78909C, wage: 5,  effect: { restockSpeed: 1.5 },  blurb: 'Hauls crates. Stalls restock 50% faster.' },
  sparkBee:      { name: 'Spark-Bee',      job: 'Collector',  color: 0xFFD54F, wage: 4,  effect: { autoCollect: 1 },     blurb: 'Buzzes around gathering dropped Spark for you.' },
  guardTortoise: { name: 'Guard-Tortoise', job: 'Insurance',  color: 0x81C784, wage: 7,  effect: { protectBonus: 0.25 }, blurb: 'Shell shield. Protect jar covers 25% more damage.' },
  scoutFox:      { name: 'Scout-Fox',      job: 'Scout',      color: 0xFF8A50, wage: 5,  effect: { scamWarn: 1 },        blurb: 'Points out Too-Good Deals before you fall for them.' },
  gardenerSnail: { name: 'Gardener-Snail', job: 'Grower',     color: 0xC5E1A5, wage: 4,  effect: { investGrowth: 0.02 }, blurb: 'Tends glow-plants. Invest jar grows +2% per Season.' },
};

// ───────────────────────────── small kit ─────────────────────────────
const WHITE = () => flatMat(P.white), BLACK = () => flatMat(P.black);

/** Bake raw static meshes (children of `raw`, identity transform) into `parent`: one toon mesh + hull, flat bits unoutlined. */
function bake(parent, raw, name) {
  parent.add(raw);
  const merged = mergeGroup(raw);
  parent.remove(raw);
  merged.name = name;
  merged.traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial) { o.userData.noOutline = true; o.castShadow = false; } });
  addOutline(merged);
  parent.add(merged);
  return merged;
}

/** Eyes (+ optional squint lids) merged into ONE flat mesh inside a `face` group (CreatureAnimator blinks face.scale.y). */
function makeFace(parent, { y = 0.5, z = 0.3, gap = 0.13, r = 0.075, pupil = 0.04, squint = false } = {}) {
  const face = new THREE.Group(); face.name = 'face'; face.position.set(0, y, z); parent.add(face);
  const raw = new THREE.Group();
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(G.sphere(r, 6, 4), WHITE()); e.position.set(sx * gap, 0, 0); e.scale.set(1, squint ? 0.7 : 1.2, 0.45); raw.add(e);
    const pp = new THREE.Mesh(G.sphere(pupil, 5, 4), BLACK()); pp.position.set(sx * gap, 0, r * 0.5); pp.scale.set(1, squint ? 0.8 : 1.1, 0.5); raw.add(pp);
  }
  face.add(raw);
  const m = mergeGroup(raw); face.remove(raw);
  const eyes = m.children[0]; eyes.name = 'eyes'; eyes.userData.noOutline = true; eyes.castShadow = eyes.receiveShadow = false; face.add(eyes);
  return face;
}

/** Generic delivery crate used by `carry` on every helper (hidden by default). Pivot at crate base. */
function makeHeldCrate(parent, y, r) {
  const held = new THREE.Group(); held.name = 'held'; held.position.set(0, y, 0.05); parent.add(held);
  const raw = new THREE.Group();
  const wood = vary(P.wood, 0.05, r);
  raw.add(mesh(G.box(0.34, 0.26, 0.3), wood, 0, 0.13, 0));
  raw.add(mesh(G.box(0.36, 0.05, 0.32), P.woodDark, 0, 0.13, 0));
  raw.add(mesh(G.box(0.05, 0.28, 0.32), P.woodDark, 0, 0.13, 0));
  const glow = new THREE.Mesh(G.sphere(0.06, 6, 5), flatMat(P.sparkGold)); glow.position.set(0, 0.3, 0); raw.add(glow);
  bake(held, raw, 'crate');
  held.visible = false;
  return held;
}

function shadowDisc(root, radius) {
  const sh = new THREE.Mesh(G.cyl(radius, radius, 0.01, 12), flatMat(0x000000, { transparent: true, opacity: 0.2, depthWrite: false }));
  sh.position.y = 0.012; sh.userData.noOutline = true; sh.castShadow = sh.receiveShadow = false; sh.name = 'shadow'; root.add(sh);
  return sh;
}

// ───────────────────────────── builders: (ctx) → fills ctx.parts ─────────────────────────────
// ctx = { body, r, parts, torsoRaw, headRaw, toolRaw, headY, toolPos }
const BUILD = {
  // Round brown owl, cream belly, round glasses, green ledger held in the right wing, quill in the left.
  tallyOwl(c) {
    const brown = vary(0x8D6E63, 0.05, c.r), dark = 0x6D4C41, cream = 0xFFF3E0;
    const t = c.torsoRaw;
    const belly = mesh(G.sphere(0.36, 9, 7), brown, 0, 0.4, 0); belly.scale.set(1, 1.1, 0.9); t.add(belly);
    const bib = mesh(G.sphere(0.27, 8, 6), cream, 0, 0.36, 0.15); bib.scale.set(1, 1.15, 0.5); t.add(bib);
    for (const sx of [-1, 1]) { const f = mesh(G.box(0.1, 0.05, 0.14), 0xFFB74D, sx * 0.13, 0.025, 0.1); t.add(f); }
    const wingL = mesh(G.sphere(0.13, 8, 6), dark, -0.36, 0.42, 0); wingL.scale.set(0.5, 1.3, 0.9); wingL.rotation.z = 0.25; t.add(wingL);
    const quill = mesh(G.box(0.03, 0.26, 0.03), P.white, -0.4, 0.62, 0.1); quill.rotation.z = 0.5; quill.rotation.x = -0.4; t.add(quill);
    // head (pivot at neck y=0.72): sphere + ear tufts + beak + glasses
    c.headY = 0.72;
    const h = c.headRaw;
    h.add(mesh(G.sphere(0.3, 9, 7), brown, 0, 0.1, 0));
    for (const sx of [-1, 1]) { const tuft = mesh(G.cone(0.07, 0.16, 5), dark, sx * 0.2, 0.36, -0.02); tuft.rotation.z = -sx * 0.35; h.add(tuft); }
    const beak = mesh(G.cone(0.06, 0.12, 4), 0xFFB74D, 0, 0.02, 0.3); beak.rotation.x = Math.PI / 2; h.add(beak);
    for (const sx of [-1, 1]) { const ring = mesh(G.torus(0.1, 0.018, 5, 10), 0x263238, sx * 0.13, 0.1, 0.25); h.add(ring); }
    h.add(mesh(G.box(0.08, 0.02, 0.02), 0x263238, 0, 0.1, 0.26));
    c.face = { y: 0.1, z: 0.26, gap: 0.13, r: 0.07, pupil: 0.04 };
    // tool = ledger (green book) in right wing, pivot at the wing joint
    c.toolPos.set(0.36, 0.5, 0.1);
    const o = c.toolRaw;
    const wingR = mesh(G.sphere(0.13, 8, 6), dark, 0, -0.08, 0); wingR.scale.set(0.5, 1.3, 0.9); wingR.rotation.z = -0.25; o.add(wingR);
    const book = mesh(G.box(0.22, 0.28, 0.06), 0x2E7D32, 0.06, -0.02, 0.14); book.rotation.y = -0.4; o.add(book);
    const pages = mesh(G.box(0.19, 0.24, 0.02), P.white, 0.06, -0.02, 0.175); pages.rotation.y = -0.4; o.add(pages);
    const spark = new THREE.Mesh(G.box(0.05, 0.05, 0.01), flatMat(P.sparkGold)); spark.position.set(0.08, 0.04, 0.19); spark.rotation.y = -0.4; o.add(spark);
    c.shadowR = 0.38;
  },

  // Stout blue-grey mole, pink nose, squinty eyes, yellow hard hat, holds a crate in front with both paws.
  packMole(c) {
    const grey = vary(0x78909C, 0.05, c.r), dark = 0x546E7A;
    const t = c.torsoRaw;
    const bod = mesh(G.sphere(0.4, 9, 7), grey, 0, 0.38, 0); bod.scale.set(1.05, 0.95, 0.95); t.add(bod);
    const tummy = mesh(G.sphere(0.28, 8, 6), 0xB0BEC5, 0, 0.32, 0.18); tummy.scale.set(1, 1, 0.5); t.add(tummy);
    for (const sx of [-1, 1]) { t.add(mesh(G.sphere(0.1, 6, 5), dark, sx * 0.22, 0.06, 0.1)); }
    const tail = mesh(G.cone(0.05, 0.18, 5), dark, 0, 0.3, -0.42); tail.rotation.x = -Math.PI / 2 - 0.4; t.add(tail);
    c.headY = 0.66;
    const h = c.headRaw;
    const head = mesh(G.sphere(0.27, 10, 8), grey, 0, 0.05, 0.05); head.scale.set(1, 0.9, 1.05); h.add(head);
    const snout = mesh(G.cone(0.1, 0.2, 6), 0xB0BEC5, 0, 0, 0.32); snout.rotation.x = Math.PI / 2; h.add(snout);
    const nose = new THREE.Mesh(G.sphere(0.055, 6, 5), flatMat(0xF48FB1)); nose.position.set(0, 0.01, 0.42); h.add(nose);
    const hat = mesh(G.sphere(0.24, 8, 6), 0xFFD54F, 0, 0.2, 0); hat.scale.set(1, 0.6, 1); h.add(hat);
    h.add(mesh(G.cyl(0.3, 0.3, 0.03, 10), 0xFFC107, 0, 0.17, 0.02));
    const lamp = new THREE.Mesh(G.sphere(0.05, 6, 5), flatMat(P.sparkGold)); lamp.position.set(0, 0.26, 0.2); h.add(lamp);
    c.face = { y: 0.08, z: 0.27, gap: 0.1, r: 0.05, pupil: 0.03, squint: true };
    // tool = crate held in both paws in front (pivot at the chest so it lifts in an arc)
    c.toolPos.set(0, 0.3, 0.3);
    const o = c.toolRaw;
    const wood = vary(P.wood, 0.05, c.r);
    o.add(mesh(G.box(0.4, 0.3, 0.3), wood, 0, 0.15, 0.1));
    o.add(mesh(G.box(0.42, 0.05, 0.32), P.woodDark, 0, 0.15, 0.1));
    o.add(mesh(G.box(0.05, 0.32, 0.32), P.woodDark, 0, 0.15, 0.1));
    for (const sx of [-1, 1]) { const paw = mesh(G.sphere(0.09, 6, 5), dark, sx * 0.22, 0.12, 0.02); o.add(paw); }
    c.shadowR = 0.42;
  },

  // Chubby gold bee with brown stripes, round antennae, translucent wings, carries a Spark sack under it. Hovers.
  sparkBee(c) {
    const gold = vary(0xFFD54F, 0.04, c.r), stripe = 0x5D4037;
    c.hover = 0.55;
    const t = c.torsoRaw;
    const bod = mesh(G.sphere(0.3, 9, 7), gold, 0, 0.3, 0); bod.scale.set(1, 0.9, 1.25); t.add(bod);
    for (const z of [-0.1, 0.1]) { const s = mesh(G.torus(0.28, 0.05, 5, 10), stripe, 0, 0.3, z); s.scale.set(1, 0.95, 1); t.add(s); }
    const tip = mesh(G.sphere(0.12, 8, 6), stripe, 0, 0.28, -0.36); tip.scale.set(1, 0.9, 1); t.add(tip);
    for (const sx of [-1, 1]) for (const z of [-0.08, 0.1]) { const leg = mesh(G.box(0.04, 0.14, 0.04), stripe, sx * 0.18, 0.1, z); leg.rotation.z = sx * 0.5; t.add(leg); }
    c.headY = 0.33;
    const h = c.headRaw;
    h.add(mesh(G.sphere(0.21, 10, 8), gold, 0, 0, 0.3));
    for (const sx of [-1, 1]) { const an = mesh(G.box(0.025, 0.2, 0.025), stripe, sx * 0.1, 0.2, 0.3); an.rotation.z = -sx * 0.4; h.add(an); h.add(mesh(G.sphere(0.04, 6, 5), stripe, sx * 0.17, 0.3, 0.3)); }
    c.face = { y: 0.03, z: 0.48, gap: 0.09, r: 0.06, pupil: 0.035 };
    // tool = little Spark sack hanging below the body
    c.toolPos.set(0, 0.08, 0.05);
    const o = c.toolRaw;
    const sack = mesh(G.sphere(0.12, 8, 6), 0xD7CCC8, 0, -0.1, 0); sack.scale.set(1, 1.1, 1); o.add(sack);
    o.add(mesh(G.torus(0.05, 0.02, 5, 8), 0x8D6E63, 0, 0.02, 0));
    const sp = new THREE.Mesh(G.sphere(0.05, 6, 5), flatMat(P.sparkGold)); sp.position.set(0, -0.1, 0.1); o.add(sp);
    c.shadowR = 0.26;
    c.wings = true;
  },

  // Round green tortoise with a dark dotted shell, stubby legs, holds a round gold-rimmed shield on the right arm.
  guardTortoise(c) {
    const skin = vary(0x81C784, 0.05, c.r), shell = 0x558B2F, shellD = 0x33691E;
    const t = c.torsoRaw;
    const sh = mesh(G.sphere(0.44, 9, 6), shell, 0, 0.36, -0.05); sh.scale.set(1, 0.7, 1); t.add(sh);
    const rim = mesh(G.cyl(0.46, 0.46, 0.08, 12), shellD, 0, 0.22, -0.05); t.add(rim);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const dot = mesh(G.sphere(0.08, 5, 4), shellD, Math.cos(a) * 0.26, 0.52, Math.sin(a) * 0.26 - 0.05); dot.scale.set(1, 0.5, 1); t.add(dot); }
    t.add(mesh(G.sphere(0.1, 6, 5), shellD, 0, 0.64, -0.05));
    for (const sx of [-1, 1]) for (const z of [-0.28, 0.18]) { t.add(mesh(G.cyl(0.08, 0.1, 0.18, 6), skin, sx * 0.3, 0.09, z)); }
    const armL = mesh(G.cyl(0.07, 0.08, 0.24, 6), skin, -0.3, 0.3, 0.3); armL.rotation.z = 0.8; t.add(armL);
    const tail = mesh(G.cone(0.05, 0.14, 5), skin, 0, 0.18, -0.5); tail.rotation.x = -Math.PI / 2 - 0.5; t.add(tail);
    c.headY = 0.36;
    const h = c.headRaw;
    const neck = mesh(G.cyl(0.11, 0.13, 0.22, 7), skin, 0, 0.08, 0.38); neck.rotation.x = 0.4; h.add(neck);
    h.add(mesh(G.sphere(0.17, 9, 7), skin, 0, 0.22, 0.46));
    const cap = mesh(G.sphere(0.14, 8, 6), 0x1E88E5, 0, 0.33, 0.44); cap.scale.set(1, 0.55, 1); h.add(cap);
    h.add(mesh(G.box(0.1, 0.03, 0.14), 0x1E88E5, 0, 0.31, 0.58));
    c.face = { y: 0.24, z: 0.6, gap: 0.09, r: 0.055, pupil: 0.032 };
    // tool = round shield on the right arm (pivot at the shoulder, shield hangs down at rest)
    c.toolPos.set(0.34, 0.38, 0.15);
    const o = c.toolRaw;
    const arm = mesh(G.cyl(0.07, 0.08, 0.24, 6), skin, 0.02, -0.1, 0); o.add(arm);
    const disc = mesh(G.cyl(0.26, 0.26, 0.05, 12), P.metal, 0.14, -0.15, 0.05); disc.rotation.z = Math.PI / 2; o.add(disc);
    const ring = mesh(G.torus(0.24, 0.035, 5, 10), P.sparkGold, 0.17, -0.15, 0.05); ring.rotation.y = Math.PI / 2; o.add(ring);
    const boss = new THREE.Mesh(G.sphere(0.07, 7, 6), flatMat(P.sparkGold)); boss.position.set(0.19, -0.15, 0.05); o.add(boss);
    c.shadowR = 0.48;
  },

  // Slim orange fox, white chest, blue bandana, big tail with white tip (live), pointing right paw.
  scoutFox(c) {
    const orange = vary(0xFF8A50, 0.05, c.r), cream = 0xFFF3E0;
    const t = c.torsoRaw;
    const bod = mesh(G.sphere(0.3, 9, 7), orange, 0, 0.42, 0); bod.scale.set(0.9, 1.25, 0.85); t.add(bod);
    const chest = mesh(G.sphere(0.2, 8, 6), cream, 0, 0.4, 0.14); chest.scale.set(0.9, 1.2, 0.5); t.add(chest);
    for (const sx of [-1, 1]) { t.add(mesh(G.cyl(0.07, 0.08, 0.2, 6), orange, sx * 0.14, 0.1, 0.02)); t.add(mesh(G.sphere(0.08, 6, 5), 0x4E342E, sx * 0.14, 0.03, 0.06)); }
    const armL = mesh(G.cyl(0.055, 0.06, 0.26, 6), orange, -0.26, 0.5, 0.05); armL.rotation.z = 0.5; t.add(armL);
    const band = mesh(G.torus(0.2, 0.05, 5, 10), 0x1E88E5, 0, 0.72, 0); band.rotation.x = Math.PI / 2; band.scale.set(1, 1, 0.8); t.add(band);
    const knot = mesh(G.box(0.12, 0.22, 0.05), 0x1E88E5, 0.14, 0.6, -0.16); knot.rotation.z = 0.5; t.add(knot);
    c.headY = 0.8;
    const h = c.headRaw;
    const head = mesh(G.sphere(0.24, 10, 8), orange, 0, 0.1, 0.02); head.scale.set(1, 0.9, 1); h.add(head);
    const muz = mesh(G.cone(0.11, 0.26, 6), cream, 0, 0.03, 0.28); muz.rotation.x = Math.PI / 2; h.add(muz);
    const nose = new THREE.Mesh(G.sphere(0.045, 6, 5), flatMat(P.black)); nose.position.set(0, 0.05, 0.41); h.add(nose);
    for (const sx of [-1, 1]) { const ear = mesh(G.cone(0.09, 0.24, 4), orange, sx * 0.16, 0.34, -0.02); ear.rotation.z = -sx * 0.25; h.add(ear); const inner = mesh(G.cone(0.05, 0.14, 4), cream, sx * 0.16, 0.32, 0.0); inner.rotation.z = -sx * 0.25; h.add(inner); }
    c.face = { y: 0.12, z: 0.22, gap: 0.11, r: 0.06, pupil: 0.035 };
    // tool = pointing right arm (pivot at the shoulder; rotX −1.4 raises it forward)
    c.toolPos.set(0.26, 0.6, 0.05);
    const o = c.toolRaw;
    const arm = mesh(G.cyl(0.055, 0.06, 0.3, 6), orange, 0, -0.13, 0); o.add(arm);
    o.add(mesh(G.sphere(0.07, 6, 5), 0x4E342E, 0, -0.3, 0));
    const finger = mesh(G.box(0.04, 0.12, 0.04), 0x4E342E, 0, -0.4, 0); o.add(finger);
    c.tail = { pos: new THREE.Vector3(0, 0.3, -0.26), color: orange, tip: cream };
    c.shadowR = 0.3;
  },

  // Mint snail with a purple spiral shell, eyestalks on the head pivot, straw hat, tiny watering can; a glow-bud on the shell.
  gardenerSnail(c) {
    const mint = vary(0xC5E1A5, 0.05, c.r), purple = 0xBA68C8, purpleD = 0x8E24AA;
    const t = c.torsoRaw;
    const foot = mesh(G.sphere(0.3, 9, 6), mint, 0, 0.14, 0.05); foot.scale.set(1, 0.5, 1.6); t.add(foot);
    const neck = mesh(G.sphere(0.17, 8, 6), mint, 0, 0.34, 0.42); neck.scale.set(1, 1.3, 1); t.add(neck);
    const sh = mesh(G.sphere(0.36, 9, 7), purple, 0, 0.5, -0.12); t.add(sh);
    const sp1 = mesh(G.torus(0.22, 0.05, 5, 10), purpleD, 0.33, 0.5, -0.12); sp1.rotation.y = Math.PI / 2; t.add(sp1);
    const sp2 = mesh(G.torus(0.11, 0.04, 6, 10), purpleD, 0.35, 0.5, -0.12); sp2.rotation.y = Math.PI / 2; t.add(sp2);
    const sp3 = mesh(G.torus(0.22, 0.05, 5, 10), purpleD, -0.33, 0.5, -0.12); sp3.rotation.y = Math.PI / 2; t.add(sp3);
    // glow bud planted on the shell (flat = glows)
    t.add(mesh(G.cyl(0.08, 0.06, 0.1, 7), 0x8D6E63, 0, 0.86, -0.12));
    const stem = mesh(G.box(0.025, 0.14, 0.025), 0x66BB6A, 0, 0.96, -0.12); t.add(stem);
    const bud = new THREE.Mesh(G.sphere(0.07, 7, 6), flatMat(P.sparkGold)); bud.position.set(0, 1.06, -0.12); bud.name = 'bud'; t.add(bud);
    c.headY = 0.54;
    const h = c.headRaw;
    h.add(mesh(G.sphere(0.15, 9, 7), mint, 0, 0, 0.45));
    for (const sx of [-1, 1]) { const stalk = mesh(G.box(0.035, 0.22, 0.035), mint, sx * 0.08, 0.16, 0.45); stalk.rotation.z = -sx * 0.3; h.add(stalk); }
    const hat = mesh(G.cyl(0.26, 0.28, 0.03, 10), 0xFFE082, 0, 0.1, 0.42); h.add(hat);
    const crown = mesh(G.cyl(0.12, 0.14, 0.1, 8), 0xFFD54F, 0, 0.16, 0.42); h.add(crown);
    h.add(mesh(G.torus(0.13, 0.02, 5, 10), P.red, 0, 0.13, 0.42).rotateX(Math.PI / 2));
    c.face = { y: 0.3, z: 0.48, gap: 0.115, r: 0.055, pupil: 0.03 };
    // tool = tiny watering can carried on the side (pivot at handle)
    c.toolPos.set(0.3, 0.3, 0.3);
    const o = c.toolRaw;
    o.add(mesh(G.cyl(0.1, 0.11, 0.16, 8), P.metal, 0, -0.08, 0));
    const spout = mesh(G.cyl(0.02, 0.03, 0.18, 5), P.metal, 0.1, -0.02, 0.06); spout.rotation.z = -1.0; o.add(spout);
    o.add(mesh(G.torus(0.07, 0.015, 5, 10), P.metalDark, 0, 0.02, 0).rotateY(Math.PI / 2));
    c.shadowR = 0.4;
  },
};

/**
 * Build a Helper creature. Returns a Group (feet pivot) with `userData.parts`, `userData.type`, `userData.info`,
 * `userData.hover` (bee rest height) so HelperAnimator and the integrator can drive it.
 * @param {string} type  ∈ HELPER_TYPES
 * @param {{ seed?:number, size?:number, outline?:boolean }} opts
 */
export function makeHelper(type = 'tallyOwl', opts = {}) {
  const build = BUILD[type];
  if (!build) throw new Error('[helpers] unknown helper type ' + type);
  const info = HELPER_INFO[type];
  const r = rng(opts.seed ?? 1);
  const root = new THREE.Group(); root.name = 'helper_' + type;
  const body = new THREE.Group(); body.name = 'body'; root.add(body); body.scale.setScalar(opts.size ?? 1);
  const c = { body, r, torsoRaw: new THREE.Group(), headRaw: new THREE.Group(), toolRaw: new THREE.Group(), toolPos: new THREE.Vector3(), headY: 0.6, face: {}, shadowR: 0.4, hover: 0 };
  build(c);
  const torso = bake(body, c.torsoRaw, 'torso');
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, c.headY, 0); body.add(head);
  const headMesh = bake(head, c.headRaw, 'headMesh');
  const face = makeFace(head, c.face);
  const tool = new THREE.Group(); tool.name = 'tool'; tool.position.copy(c.toolPos); body.add(tool);
  const toolMesh = bake(tool, c.toolRaw, 'toolMesh');
  const held = makeHeldCrate(body, Math.max(0.9, c.headY + 0.42), r);
  const parts = { root, body, torso, head, headMesh, face, tool, toolMesh, held, shell: torso.children.find((m) => m.name === 'merged_toon') || torso.children[0] };
  if (c.wings) {
    const wmat = toonMat(0xE3F2FD, { transparent: true, opacity: 0.75 });
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(G.sphere(0.2, 8, 5), wmat); w.position.set(sx * 0.14, 0.52, -0.02); w.scale.set(1, 0.08, 0.55); w.userData.noOutline = true; w.castShadow = false;
      const piv = new THREE.Group(); piv.position.set(sx * 0.06, 0.52, -0.02); w.position.set(sx * 0.16, 0, 0); piv.add(w); body.add(piv);
      parts[sx < 0 ? 'wingL' : 'wingR'] = piv;
    }
  }
  if (c.tail) {
    const tail = new THREE.Group(); tail.name = 'tail'; tail.position.copy(c.tail.pos); body.add(tail);
    const raw = new THREE.Group();
    const t1 = mesh(G.sphere(0.13, 8, 6), c.tail.color, 0, 0.0, -0.18); t1.scale.set(1, 1, 1.6); raw.add(t1);
    raw.add(mesh(G.sphere(0.1, 8, 6), c.tail.tip, 0, 0.04, -0.4));
    bake(tail, raw, 'tailMesh');
    tail.rotation.x = 0.5;
    parts.tail = tail;
  }
  parts.shadow = shadowDisc(root, c.shadowR);
  if (opts.outline === false) root.traverse((o) => { if (o.userData.isOutline) o.visible = false; });
  root.userData.parts = parts;
  root.userData.type = type;
  root.userData.info = info;
  root.userData.hover = c.hover;
  root.userData.height = c.headY + 0.5;
  return root;
}

export { measureCreature as measureHelper };

// ═══════════════════════════════════════════ HelperAnimator ═══════════════════════════════════════════
const _v = new THREE.Vector3();
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Drives a helper built by makeHelper(). Same interface as CreatureAnimator (it IS one):
 *   .play('idle'|'work'|'carry'|'happy'|'walk'|…)  .update(dt)  .moodTint(t)  .faceTo(v)  .faceToNow(v)  .hit(dir,p)  .current  .timeScale
 * Extra: opts.onWork(worldPos) fires once per work loop on the job "beat" (4A hooks the economic effect there),
 *        vfx.sparks / vfx.dust fire on the beat when `vfx` is given; `.carrying` (bool) mirrors the held crate.
 * Extra pose channels (reset every frame, written by clips): head.nod/tilt/yaw, tool.rx/ry/rz/y/scale, hover, heldY.
 */
export class HelperAnimator extends CreatureAnimator {
  constructor(root, type, opts = {}) {
    if (typeof type === 'object' && type) { opts = type; type = root.userData.type; }
    super(root, opts);
    this.type = type || root.userData.type || 'tallyOwl';
    this.onWork = opts.onWork || null;
    this.hover = root.userData.hover || 0;
    this.carrying = false;
    this.hp = { nod: 0, tilt: 0, yaw: 0, trx: 0, try: 0, trz: 0, ty: 0, ts: 1, hover: 0, heldY: 0, wing: 0, tail: 0, bud: 1 };
    this.wingT = Math.random() * 10;
    Object.assign(this._clips, buildHelperClips(this));
    this.play('idle');
  }

  /** Fire the job beat: callback + VFX at the tool's world position. */
  beat() {
    const tool = this.p.tool || this.body;
    tool.getWorldPosition(_v);
    if (this.onWork) this.onWork(_v.clone());
    if (this.vfx) {
      if (this.vfx.sparks) this.vfx.sparks.burst(_v.clone(), 5, 1.8);
      if (this.type === 'packMole' || this.type === 'guardTortoise') this.dust(4, 0.3);
    }
  }

  update(dt) {
    const hp = this.hp;
    hp.nod = 0; hp.tilt = 0; hp.yaw = 0; hp.trx = 0; hp.try = 0; hp.trz = 0; hp.ty = 0; hp.ts = 1; hp.hover = 0; hp.heldY = 0; hp.tail = 0; hp.bud = 1;
    super.update(dt);                               // runs the Sequence (fills hp), applies body squash / y / lean
    const sdt = dt * this.timeScale;
    this.wingT += sdt;
    const p = this.p;
    // per-type idle tics layered under every clip (cheap, continuous, delta-time only)
    const t = this.t;
    switch (this.type) {
      case 'tallyOwl':      hp.tilt += Math.sin(t * 0.7 * Math.PI * 2) * 0.08; break;
      case 'packMole':      hp.nod += Math.sin(t * 3 * Math.PI * 2) * 0.03; break;
      case 'sparkBee':      hp.hover += Math.sin(t * 4 * Math.PI * 2) * 0.06; break;
      case 'scoutFox':      hp.tail += Math.sin(t * 2 * Math.PI * 2) * 0.35; break;
      case 'gardenerSnail': hp.yaw += Math.sin(t * 1 * Math.PI * 2) * 0.12; break;
      default: break; // tortoise: stoic
    }
    if (p.head) p.head.rotation.set(hp.nod, hp.yaw, hp.tilt);
    if (p.tool) { p.tool.rotation.set(hp.trx, hp.try, hp.trz); p.tool.position.y = p.tool.userData.y0 ?? (p.tool.userData.y0 = p.tool.position.y); p.tool.position.y += hp.ty; p.tool.scale.setScalar(hp.ts); }
    if (p.held) { p.held.visible = this.carrying; if (this.carrying) { p.held.position.y = (p.held.userData.y0 ?? (p.held.userData.y0 = p.held.position.y)) + hp.heldY; } }
    if (p.tail) p.tail.rotation.set(0.5, hp.tail, 0);
    if (p.wingL) { const f = Math.sin(this.wingT * 60) * 0.55; p.wingL.rotation.z = f + 0.2; p.wingR.rotation.z = -f - 0.2; }
    const bud = p.torso && p.torso.children.find((m) => m.name === 'merged_flat'); if (bud && this.type === 'gardenerSnail') bud.scale.setScalar(hp.bud);
    // hover (bee) stacks on top of the clip's body.y; shadow shrinks with height
    const totalHover = this.hover + hp.hover;
    if (totalHover) { this.body.position.y += totalHover; if (p.shadow) { const sh = 1 - Math.min(0.8, (this.body.position.y) * 0.6); p.shadow.scale.set(sh, 1, sh); } }
  }
}

function buildHelperClips(a) {
  const pose = a.pose, hp = a.hp;
  const idle = () => new Sequence('idle').phase('breathe', 1000, Easing.linear, () => {}).setLoop(true);

  // carry: push 100 → air 200 → land 60 → settle 120 (= 480 loop). Crate lags the hop by ~0.04.
  const carry = () => new Sequence('carry')
    .phase('push', 100, Easing.outQuad, (e) => { pose.squash = lerp(1, 0.92, e); pose.lean = lerp(0, 0.1, e); }, { onEnter: () => { a.carrying = true; } })
    .phase('air', 200, Easing.inOutQuad, (e, c, t) => { const h = Math.sin(t * Math.PI); pose.y = h * 0.18; pose.squash = lerp(0.92, 1.08, Math.min(1, h * 1.3)); pose.lean = 0.1 - t * 0.15; hp.heldY = -h * 0.04; })
    .phase('land', 60, Easing.inQuad, (e) => { pose.y = 0; pose.squash = lerp(1.0, 0.9, e); pose.lean = -0.05; hp.heldY = e * 0.03; }, { onEnter: () => a.dust(3, 0.25) })
    .phase('settle', 120, Easing.outBack, (e) => { pose.squash = lerp(0.9, 1.0, e); pose.lean = lerp(-0.05, 0, e); hp.heldY = (1 - e) * 0.03; })
    .setLoop(true);

  // happy: crouch 120 → leap 260 (spin 360, tool wave) → land 80 → settle 140 (= 600)
  const happy = () => new Sequence('happy')
    .phase('crouch', 120, Easing.outCubic, (e) => { pose.squash = lerp(1, 0.82, e); hp.nod = e * 0.2; })
    .phase('leap', 260, Easing.outCubic, (e, c, t) => { const h = Math.sin(t * Math.PI); pose.y = h * 0.9; pose.squash = lerp(0.82, 1.25, Math.min(1, e * 1.4)); pose.spin = e * Math.PI * 2; hp.trz = Math.sin(t * Math.PI * 4) * 0.6; hp.nod = -0.2; }, { onEnter: () => { a.spring.kick(1.2); a.dust(5, 0.6); } })
    .phase('land', 80, Easing.inQuad, (e) => { pose.y = 0; pose.squash = lerp(1.05, 0.78, e); pose.spin = 0; }, { onEnter: () => a.dust(6, 0.3) })
    .phase('settle', 140, Easing.outBack, (e) => { pose.squash = lerp(0.78, 1, e); });

  const stopCarry = { onEnter: () => { a.carrying = false; } };
  const WORK = {
    // dip 200 → scribble 400 [beat] → lift 200
    tallyOwl: () => new Sequence('work')
      .phase('dip', 200, Easing.outCubic, (e) => { hp.nod = e * 0.35; hp.ty = e * 0.08; hp.trx = e * -0.3; pose.squash = lerp(1, 0.96, e); }, stopCarry)
      .phase('scribble', 400, Easing.linear, (e, c, t) => { hp.nod = 0.35 + Math.sin(t * Math.PI * 8) * 0.03; hp.ty = 0.08; hp.trx = -0.3; hp.trz = Math.sin(t * Math.PI * 8) * 0.25; pose.squash = 0.96; }, { onEnter: () => a.beat() })
      .phase('lift', 200, Easing.outBack, (e) => { hp.nod = lerp(0.35, 0, e); hp.ty = lerp(0.08, 0, e); hp.trx = lerp(-0.3, 0, e); pose.squash = lerp(0.96, 1, e); })
      .setLoop(true),
    // crouch 250 → heave 150 [beat] → hold 150 → set 250
    packMole: () => new Sequence('work')
      .phase('crouch', 250, Easing.outCubic, (e) => { pose.squash = lerp(1, 0.84, e); hp.ty = e * -0.05; hp.nod = e * 0.25; }, stopCarry)
      .phase('heave', 150, Easing.outBack, (e) => { pose.squash = lerp(0.84, 1.12, e); hp.ty = lerp(-0.05, 0.42, e); hp.trx = e * -0.5; pose.lean = e * -0.15; hp.nod = lerp(0.25, -0.3, e); }, { onEnter: () => { a.spring.kick(0.8); a.beat(); } })
      .phase('hold', 150, Easing.linear, () => { pose.squash = 1.12; hp.ty = 0.42; hp.trx = -0.5; pose.lean = -0.15; hp.nod = -0.3; })
      .phase('set', 250, Easing.inQuad, (e) => { pose.squash = lerp(1.12, 0.92, e); hp.ty = lerp(0.42, 0, e); hp.trx = lerp(-0.5, 0, e); pose.lean = lerp(-0.15, 0, e); hp.nod = lerp(-0.3, 0, e); }, { onExit: () => { a.spring.kick(-0.5); a.dust(4, 0.2); } })
      .setLoop(true),
    // wind 150 → zip 200 → collect 250 [beat] → return 200
    sparkBee: () => new Sequence('work')
      .phase('wind', 150, Easing.inQuad, (e) => { pose.lean = e * -0.2; hp.hover = e * -0.1; pose.squash = lerp(1, 0.94, e); }, stopCarry)
      .phase('zip', 200, Easing.outCubic, (e) => { pose.lean = lerp(-0.2, 0.45, e); hp.hover = lerp(-0.1, 0.25, e); pose.squash = lerp(0.94, 1.15, e); })
      .phase('collect', 250, Easing.linear, (e, c, t) => { pose.lean = 0.45; hp.hover = 0.25; pose.squash = 1.15; hp.ts = 1 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.25; }, { onEnter: () => a.beat() })
      .phase('return', 200, Easing.outBack, (e) => { pose.lean = lerp(0.45, 0, e); hp.hover = lerp(0.25, 0, e); pose.squash = lerp(1.15, 1, e); })
      .setLoop(true),
    // brace 200 → raise 200 [beat] → hold 200 → lower 200
    guardTortoise: () => new Sequence('work')
      .phase('brace', 200, Easing.outCubic, (e) => { pose.squash = lerp(1, 0.9, e); pose.lean = e * 0.1; hp.nod = e * -0.15; }, stopCarry)
      .phase('raise', 200, Easing.outBack, (e) => { pose.squash = 0.9; pose.lean = 0.1; hp.trx = e * -1.2; hp.ty = e * 0.25; hp.nod = -0.15; }, { onEnter: () => a.beat() })
      .phase('hold', 200, Easing.linear, (e, c, t) => { pose.squash = 0.9; pose.lean = 0.1; hp.trx = -1.2 + Math.sin(t * Math.PI * 10) * 0.02; hp.ty = 0.25; hp.nod = -0.15; })
      .phase('lower', 200, Easing.inOutCubic, (e) => { pose.squash = lerp(0.9, 1, e); pose.lean = lerp(0.1, 0, e); hp.trx = lerp(-1.2, 0, e); hp.ty = lerp(0.25, 0, e); hp.nod = lerp(-0.15, 0, e); })
      .setLoop(true),
    // crouch 150 → point 200 [beat] → hold 250 → return 200
    scoutFox: () => new Sequence('work')
      .phase('crouch', 150, Easing.outCubic, (e) => { pose.squash = lerp(1, 0.9, e); }, stopCarry)
      .phase('point', 200, Easing.outBack, (e) => { pose.squash = lerp(0.9, 1.05, e); hp.trx = e * -1.4; pose.lean = e * 0.25; hp.tilt = e * 0.2; hp.tail = e * 0.6; }, { onEnter: () => a.beat() })
      .phase('hold', 250, Easing.linear, (e, c, t) => { pose.squash = 1.05; hp.trx = -1.4 + Math.sin(t * Math.PI * 4) * 0.08; pose.lean = 0.25; hp.tilt = 0.2; hp.tail = 0.6; })
      .phase('return', 200, Easing.inOutCubic, (e) => { pose.squash = lerp(1.05, 1, e); hp.trx = lerp(-1.4, 0, e); pose.lean = lerp(0.25, 0, e); hp.tilt = lerp(0.2, 0, e); hp.tail = lerp(0.6, 0, e); })
      .setLoop(true),
    // lean 250 → pour 300 [beat] → return 250
    gardenerSnail: () => new Sequence('work')
      .phase('lean', 250, Easing.inOutCubic, (e) => { pose.lean = e * 0.25; hp.trx = e * 0.9; hp.ty = e * 0.15; }, stopCarry)
      .phase('pour', 300, Easing.linear, (e, c, t) => { pose.lean = 0.25; hp.trx = lerp(0.9, 1.2, e); hp.ty = 0.15; hp.bud = 1 + Math.sin(t * Math.PI) * 0.6; }, { onEnter: () => a.beat() })
      .phase('return', 250, Easing.outBack, (e) => { pose.lean = lerp(0.25, 0, e); hp.trx = lerp(1.2, 0, e); hp.ty = lerp(0.15, 0, e); })
      .setLoop(true),
  };
  const work = WORK[a.type] || WORK.tallyOwl;
  // every clip other than carry drops the crate when it starts
  const base = Object.assign({}, a._clips);   // snapshot the CreatureAnimator clips before we overwrite them
  const wrap = (name) => () => { a.carrying = false; return base[name](); };
  return { idle: () => { a.carrying = false; return idle(); }, work, carry, happy: () => { a.carrying = false; return happy(); }, walk: wrap('walk'), sad: wrap('sad'), pay: wrap('pay'), browse: wrap('browse'), wait: wrap('wait'), angry: wrap('angry') };
}
