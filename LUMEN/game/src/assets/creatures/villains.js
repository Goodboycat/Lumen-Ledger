// Chat 2C — Baron Gilt (Lord of the Debt Fog) + 3 Fog Collectors + VillainAnimator + FogPuffPool.
// Comic, pompous, bumbling tax-collector blobs. NEVER scary (GAME_BIBLE §2).
//
//   makeBaronGilt(opts) → Group                 tall purple blob lord: gold top hat, monocle, cane, cape, coin-purse belt
//   makeFogCollector(variant 0..2, opts) → Group  0 fat · 1 tall · 2 tiny — clerk visor, clipboard, sack on back
//   VillainAnimator(root, opts)                 extends CreatureAnimator: strut · taunt · offerDeal · flee · slipOnCoin · fogPuff
//                                               (+ idle/walk/happy/sad/pay/browse/wait/angry inherited)
//   VILLAIN_ANIMS, VILLAIN_INFO, FOG_COLLECTOR_VARIANTS, FogPuffPool, measureVillain
//
// Rig (same part names on all four so ONE animator drives them):
//   root (feet, y=0)                      ← mover sets position; animator sets rotation.y (facing)
//    └ body (squash pivot)
//        ├ torso   Group → ONE merged toon mesh (+hull) [+ ONE merged flat mesh: gold buttons / coin glints]
//        ├ cape    Group (Baron only) pivot at shoulders → merged mesh (+hull)     live: sway
//        ├ head    Group pivot at neck → merged toon (+hull) + face (eyes = ONE flat mesh, blinks)
//        │    ├ hat    Group pivot at hat base (Baron: top hat · Collectors: clerk visor)   live: tip / pop-off
//        │    └ sweat  Group of 2 flat drops — visible ONLY during `flee`
//        ├ tool    Group pivot at hand: Baron = cane (tip = fog source) · Collectors = clipboard      live: swing / present
//        │    └ scroll Group — the "Too-Good Deal" paper, unrolls (scale.y) ONLY during `offerDeal`
//    └ shadow (flat disc)
// Draw calls incl. outlines (visible, at rest): Baron 13 (boss; +2 scroll, +1 sweat when shown) · Collectors 11 (+2/+1). FogPuffPool = 1 InstancedMesh.
//
// ───────────────────────── PHASE TABLES (ms · easing) — every clip is a Sequence, poses set absolutely ─────────────────────────
// strut      loop 640  stepL 160 outQuad (y .09, squash 1.04, tilt +.09, nod −.08, cane trz −.35) → plantL 80 inQuad (y 0, squash .95)
//                      → stepR 160 outQuad (mirror: tilt −.09, cane trz +.35) → plantR 80 inQuad.  Chest out: lean −.12 throughout.
// taunt      700       tip 200 outBack (hat y +.18, hat rotZ −.45, nod −.25, lean −.15, squash 1.06)
//                      → chuckle 250 linear (squash sine 6 Hz ±.03, hat wobble ±.05) → lower 250 outBack (all → rest)
// offerDeal  600       reach 200 outCubic (lean .25, tool trx −1.25 presented forward, nod .2, squint via tilt .05)
//                      → unroll 250 outBack (scroll scale.y 0→1, scroll visible) → hold 150 linear (scroll flutter ±.02)   [then auto-return]
// flee       loop 300  hopL 150 (y .14 sine, lean .35, tilt +.18, squash 1.05→.92, sweat visible, arms/tool trx −.6)
//                      → hopR 150 (mirror tilt −.18).  Fast waddle: mover should push ~2.6 u/s.
// slipOnCoin 900       step 150 outQuad (lean .15, y .05) → slip 120 outQuad (lean −.9, y .32, stretch 1.12, hat y +.35 rotZ .6, tool trx .8)
//                      → fall 180 inQuad (y 0, lean −1.35, squash .72, hat falls back)  [onEnter: dust 8, hit-stop 60 via opts.game]
//                      → dazed 250 linear (jitter ±.03, hat wobble, nod sine 3 Hz) → up 200 outBack (all → rest)
// fogPuff    500       wind 150 inQuad (tool trx −.3, squash .95, lean −.08) → thrust 100 outQuad (tool trx −1.35, lean .15, stretch 1.08)
//                      [onEnter: fogPool.spawn(caneTip, forward, 6) + vfx.sparks] → settle 250 outBack (→ rest)
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

export const VILLAIN_ANIMS = ['strut', 'taunt', 'offerDeal', 'flee', 'slipOnCoin', 'fogPuff'];
export const FOG_COLLECTOR_VARIANTS = ['fat', 'tall', 'tiny'];

/** Story / economy facing data (4B scams, 8A story, 7B dialogue read these). */
export const VILLAIN_INFO = {
  baron:      { name: 'Baron Gilt',   title: 'Lord of the Debt Fog', color: 0x7B5EA7, loanRate: 0.20, blurb: 'Offers loans at 20% a Season — compounding. Tips his hat while your Spark drains.' },
  collector0: { name: 'Ledgerworth',  title: 'Fog Collector (Senior)', color: 0x9575CD, loanRate: 0.20, blurb: 'Wide, slow, carries the biggest sack. Slips on coins.' },
  collector1: { name: 'Quillsby',     title: 'Fog Collector (Clerk)',  color: 0x9575CD, loanRate: 0.20, blurb: 'Tall and twitchy. Waves the clipboard. Flees from Haggle Shouts.' },
  collector2: { name: 'Pennywhistle', title: 'Fog Collector (Junior)', color: 0x9575CD, loanRate: 0.20, blurb: 'Tiny, eager, always first to run.' },
};

// ───────────────────────────── small kit (same helpers as 2B, local copy — 2C owns only this file) ─────────────────────────────
const WHITE = () => flatMat(P.white), BLACK = () => flatMat(P.black);
const GOLD = P.sparkGold, PURPLE = P.debtFog, PURPLE_DARK = P.debtFogDark, LILAC = 0x9575CD;

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
function shadowDisc(root, radius) {
  const sh = new THREE.Mesh(G.cyl(radius, radius, 0.01, 12), flatMat(0x000000, { transparent: true, opacity: 0.2, depthWrite: false }));
  sh.position.y = 0.012; sh.userData.noOutline = true; sh.castShadow = sh.receiveShadow = false; sh.name = 'shadow'; root.add(sh);
  return sh;
}
/** Two flat sweat drops on the head sides (hidden; `flee` shows them). ONE flat mesh. */
function makeSweat(head, y, x) {
  const sweat = new THREE.Group(); sweat.name = 'sweat'; sweat.position.set(0, y, 0); head.add(sweat);
  const raw = new THREE.Group();
  for (const sx of [-1, 1]) { const d = new THREE.Mesh(G.sphere(0.05, 6, 4), flatMat(0xB3E5FC)); d.position.set(sx * x, 0, 0.05); d.scale.set(0.8, 1.3, 0.8); raw.add(d); }
  sweat.add(raw); const m = mergeGroup(raw); sweat.remove(raw);
  const drops = m.children[0]; drops.userData.noOutline = true; drops.castShadow = false; sweat.add(drops);
  sweat.visible = false;
  return sweat;
}
/** The "Too-Good Deal" scroll hanging from the tool (hidden; `offerDeal` unrolls it). Pivot at its top edge. */
function makeScroll(tool, pos) {
  const scroll = new THREE.Group(); scroll.name = 'scroll'; scroll.position.copy(pos); tool.add(scroll);
  const raw = new THREE.Group();
  raw.add(mesh(G.box(0.3, 0.42, 0.015), 0xFFF8E1, 0, -0.21, 0));
  const rod = mesh(G.cyl(0.025, 0.025, 0.34, 6), P.woodDark, 0, 0, 0); rod.rotation.z = Math.PI / 2; raw.add(rod);
  for (let i = 0; i < 3; i++) raw.add(mesh(G.box(0.2, 0.02, 0.005), 0x7B5EA7, 0, -0.1 - i * 0.09, 0.01));
  const seal = mesh(G.sphere(0.04, 6, 4), P.red, 0.08, -0.36, 0.012); seal.scale.z = 0.3; raw.add(seal);
  bake(scroll, raw, 'scrollMesh');
  scroll.scale.y = 0.001; scroll.visible = false;
  return scroll;
}

// ───────────────────────────── builders ─────────────────────────────
/**
 * Shared assembly. `build(c)` fills c.torsoRaw / headRaw / hatRaw / toolRaw (+ c.capeRaw optional) and sets c.headY, c.toolPos, c.hatY, c.face …
 */
function assemble(kind, build, opts) {
  const r = rng(opts.seed ?? 1);
  const root = new THREE.Group(); root.name = 'villain_' + kind;
  const body = new THREE.Group(); body.name = 'body'; root.add(body); body.scale.setScalar(opts.size ?? 1);
  const c = { body, r, torsoRaw: new THREE.Group(), headRaw: new THREE.Group(), hatRaw: new THREE.Group(), toolRaw: new THREE.Group(), capeRaw: null,
    headY: 0.9, hatY: 0.3, toolPos: new THREE.Vector3(0.4, 0.6, 0.1), capePos: new THREE.Vector3(0, 0.9, -0.3), scrollPos: new THREE.Vector3(0, -0.1, 0.12), sweat: { y: 0.2, x: 0.3 }, face: {}, shadowR: 0.45, height: 1.6 };
  build(c);
  const torso = bake(body, c.torsoRaw, 'torso');
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, c.headY, 0); body.add(head);
  const headMesh = bake(head, c.headRaw, 'headMesh');
  const face = makeFace(head, c.face);
  const hat = new THREE.Group(); hat.name = 'hat'; hat.position.set(0, c.hatY, 0); head.add(hat);
  const hatMesh = bake(hat, c.hatRaw, 'hatMesh');
  const sweat = makeSweat(head, c.sweat.y, c.sweat.x);
  const tool = new THREE.Group(); tool.name = 'tool'; tool.position.copy(c.toolPos); body.add(tool);
  const toolMesh = bake(tool, c.toolRaw, 'toolMesh');
  const scroll = makeScroll(tool, c.scrollPos);
  const parts = { root, body, torso, head, headMesh, face, hat, hatMesh, sweat, tool, toolMesh, scroll, shell: torso.children.find((m) => m.name === 'merged_toon') || torso.children[0] };
  if (c.capeRaw) { const cape = new THREE.Group(); cape.name = 'cape'; cape.position.copy(c.capePos); body.add(cape); bake(cape, c.capeRaw, 'capeMesh'); parts.cape = cape; }
  parts.shadow = shadowDisc(root, c.shadowR);
  if (opts.outline === false) root.traverse((o) => { if (o.userData.isOutline) o.visible = false; });
  root.userData.parts = parts;
  root.userData.type = kind;
  root.userData.info = VILLAIN_INFO[kind] || VILLAIN_INFO.baron;
  root.userData.height = c.height;
  root.userData.caneTip = c.caneTip || new THREE.Vector3(0, -0.1, 0.25);   // tool-local point where fog comes out
  return root;
}

/** Baron Gilt — tall purple blob lord. Pompous, never scary. */
export function makeBaronGilt(opts = {}) {
  return assemble('baron', (c) => {
    const purple = vary(PURPLE, 0.04, c.r), dark = PURPLE_DARK, gold = GOLD;
    const t = c.torsoRaw;
    // body: tall pear — big belly sphere + shoulders sphere, stacked
    const belly = mesh(G.sphere(0.46, 8, 6), purple, 0, 0.55, 0); belly.scale.set(1, 1.15, 0.92); t.add(belly);
    const chest = mesh(G.sphere(0.36, 8, 6), purple, 0, 0.98, 0); chest.scale.set(1, 0.85, 0.9); t.add(chest);
    // waistcoat front (darker) + gold buttons (flat)
    const vest = mesh(G.sphere(0.34, 8, 6), dark, 0, 0.7, 0.2); vest.scale.set(0.9, 1.25, 0.45); t.add(vest);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(G.sphere(0.035, 6, 4), flatMat(gold)); b.position.set(0, 0.5 + i * 0.17, 0.44 - i * 0.01); b.scale.z = 0.5; t.add(b); }
    // belt + coin purse
    const belt = mesh(G.torus(0.44, 0.045, 5, 12), 0x3E2723, 0, 0.42, 0); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.92, 1); t.add(belt);
    const buckle = new THREE.Mesh(G.box(0.1, 0.09, 0.03), flatMat(gold)); buckle.position.set(0, 0.42, 0.44); t.add(buckle);
    const purse = mesh(G.sphere(0.13, 8, 6), 0x8D6E63, -0.38, 0.36, 0.22); purse.scale.set(1, 1.15, 0.8); t.add(purse);
    const purseTie = mesh(G.torus(0.06, 0.02, 5, 8), gold, -0.38, 0.5, 0.22); purseTie.rotation.x = Math.PI / 2; t.add(purseTie);
    const glint = new THREE.Mesh(G.sphere(0.04, 5, 4), flatMat(gold)); glint.position.set(-0.38, 0.52, 0.24); t.add(glint);
    // feet (spats) + left arm (right arm = tool/cane)
    for (const sx of [-1, 1]) { const f = mesh(G.sphere(0.14, 8, 5), P.black, sx * 0.2, 0.06, 0.1); f.scale.set(1, 0.45, 1.5); t.add(f); const spat = mesh(G.sphere(0.1, 7, 5), P.white, sx * 0.2, 0.1, 0.12); spat.scale.set(1, 0.5, 1.2); t.add(spat); }
    const armL = mesh(G.capsule(0.09, 0.3, 3, 7), purple, -0.42, 0.78, 0.05); armL.rotation.z = 0.6; armL.rotation.x = 0.3; t.add(armL);
    const gloveL = mesh(G.sphere(0.1, 7, 5), P.white, -0.52, 0.6, 0.15); t.add(gloveL);
    // head (pivot at neck 1.25): sphere, jowls, curled mustache, monocle + chain
    c.headY = 1.25; c.height = 2.05; c.shadowR = 0.5;
    const h = c.headRaw;
    h.add(mesh(G.sphere(0.3, 8, 6), purple, 0, 0.14, 0));
    const jowl = mesh(G.sphere(0.2, 8, 6), purple, 0, 0.02, 0.1); jowl.scale.set(1.3, 0.6, 0.9); h.add(jowl);
    const nose = mesh(G.sphere(0.07, 7, 5), 0x8E6BB8, 0, 0.1, 0.3); h.add(nose);
    for (const sx of [-1, 1]) { const m = mesh(G.capsule(0.03, 0.14, 3, 6), dark, sx * 0.12, 0.03, 0.28); m.rotation.z = Math.PI / 2 + sx * 0.5; h.add(m); const curl = mesh(G.torus(0.035, 0.015, 5, 8), dark, sx * 0.23, 0.07, 0.27); h.add(curl); }
    const mono = mesh(G.torus(0.085, 0.016, 5, 12), gold, 0.13, 0.18, 0.26); h.add(mono);
    const chain = mesh(G.box(0.012, 0.22, 0.012), gold, 0.24, 0.05, 0.22); chain.rotation.z = 0.3; h.add(chain);
    c.face = { y: 0.18, z: 0.26, gap: 0.13, r: 0.07, pupil: 0.035, squint: true };
    c.sweat = { y: 0.28, x: 0.3 };
    // hat (pivot at hat base y .4 above neck): brim + crown + gold band
    c.hatY = 0.4;
    const ht = c.hatRaw;
    ht.add(mesh(G.cyl(0.36, 0.36, 0.035, 14), 0x1A1A2E, 0, 0.015, 0));
    const crown = mesh(G.cyl(0.21, 0.24, 0.42, 12), 0x1A1A2E, 0, 0.23, 0); ht.add(crown);
    const band = mesh(G.cyl(0.245, 0.245, 0.07, 12), gold, 0, 0.08, 0); ht.add(band);
    const badge = mesh(G.sphere(0.035, 6, 4), gold, 0, 0.08, 0.245); badge.scale.z = 0.4; ht.add(badge);
    // cape (pivot at shoulders): wide flat sheet, dark purple outside, red lining visible at the bottom
    c.capePos.set(0, 1.12, -0.28); c.capeRaw = new THREE.Group();
    const sheet = mesh(G.box(0.86, 0.95, 0.05), dark, 0, -0.47, -0.02); c.capeRaw.add(sheet);
    const lining = mesh(G.box(0.8, 0.12, 0.052), 0xB71C1C, 0, -0.9, -0.02); c.capeRaw.add(lining);
    const collar = mesh(G.box(0.7, 0.14, 0.14), dark, 0, 0.02, 0.02); c.capeRaw.add(collar);
    // tool = cane in the right (gloved) hand, pivot at hand. Shaft hangs down, knob up. Fog comes from the knob.
    c.toolPos.set(0.46, 0.72, 0.12);
    const o = c.toolRaw;
    const armR = mesh(G.capsule(0.09, 0.26, 3, 7), purple, -0.04, 0.1, -0.02); armR.rotation.z = -0.5; o.add(armR);
    o.add(mesh(G.sphere(0.1, 7, 5), P.white, 0.02, 0.0, 0.02));
    o.add(mesh(G.cyl(0.025, 0.03, 0.74, 7), 0x1A1A2E, 0.02, -0.3, 0.02));
    o.add(mesh(G.sphere(0.075, 8, 6), gold, 0.02, 0.12, 0.02));
    const ferrule = mesh(G.cyl(0.03, 0.025, 0.06, 7), gold, 0.02, -0.66, 0.02); o.add(ferrule);
    c.caneTip = new THREE.Vector3(0.02, 0.14, 0.02);
    c.scrollPos.set(0.02, -0.02, 0.1);
  }, opts);
}

/**
 * Fog Collector — variant 0 fat · 1 tall · 2 tiny (or 'fat'|'tall'|'tiny'). Lilac blob clerk: green visor, clipboard, sack on back.
 */
export function makeFogCollector(variant = 0, opts = {}) {
  const vi = typeof variant === 'string' ? Math.max(0, FOG_COLLECTOR_VARIANTS.indexOf(variant)) : (variant | 0) % 3;
  const V = [ // per-variant proportions
    { bw: 0.46, bh: 0.95, headR: 0.26, headY: 0.74, sack: 0.24, shadow: 0.48, height: 1.35 },
    { bw: 0.27, bh: 1.3,  headR: 0.22, headY: 1.0,  sack: 0.16, shadow: 0.34, height: 1.55 },
    { bw: 0.26, bh: 0.6,  headR: 0.2,  headY: 0.46, sack: 0.13, shadow: 0.3,  height: 0.95 },
  ][vi];
  return assemble('collector' + vi, (c) => {
    const lilac = vary(LILAC, 0.05, c.r), dark = 0x5E4A8C, visorGreen = 0x43A047;
    const t = c.torsoRaw;
    const body = mesh(G.sphere(0.5, 8, 6), lilac, 0, V.bh * 0.5, 0); body.scale.set(V.bw * 2, V.bh, V.bw * 1.8); t.add(body);
    // clerk collar + tie
    const collar = mesh(G.torus(V.bw * 0.72, 0.035, 6, 12), P.white, 0, V.bh * 0.86, 0); collar.rotation.x = Math.PI / 2; t.add(collar);
    const tie = mesh(G.box(0.07, V.bh * 0.3, 0.03), P.red, 0, V.bh * 0.68, V.bw * 0.95); t.add(tie);
    // sack on back (brown, with a coin glint peeking out)
    const sack = mesh(G.sphere(V.sack, 9, 7), 0x8D6E63, 0, V.bh * 0.62, -V.bw * 0.95 - V.sack * 0.3); sack.scale.set(1, 1.25, 1); t.add(sack);
    const tieS = mesh(G.torus(V.sack * 0.4, 0.02, 5, 8), 0x5D4037, 0, V.bh * 0.62 + V.sack * 1.15, -V.bw * 0.95 - V.sack * 0.3); tieS.rotation.x = Math.PI / 2; t.add(tieS);
    t.add(mesh(G.sphere(0.04, 5, 4), GOLD, 0.03, V.bh * 0.62 + V.sack * 1.25, -V.bw * 0.95 - V.sack * 0.3));
    // feet + left arm
    for (const sx of [-1, 1]) { const f = mesh(G.sphere(0.12, 8, 5), dark, sx * V.bw * 0.5, 0.05, 0.08); f.scale.set(1, 0.4, 1.4); t.add(f); }
    const armL = mesh(G.capsule(0.07, 0.22, 3, 7), lilac, -V.bw * 0.95, V.bh * 0.62, 0.05); armL.rotation.z = 0.7; t.add(armL);
    // head: sphere + big round nose + sleeve-garter (none) ; visor is the hat
    c.headY = V.headY; c.height = V.height; c.shadowR = V.shadow;
    const h = c.headRaw;
    h.add(mesh(G.sphere(V.headR, 8, 6), lilac, 0, V.headR * 0.5, 0));
    h.add(mesh(G.sphere(V.headR * 0.28, 7, 5), 0xB39DDB, 0, V.headR * 0.4, V.headR * 0.95));
    c.face = { y: V.headR * 0.62, z: V.headR * 0.85, gap: V.headR * 0.42, r: V.headR * 0.26, pupil: V.headR * 0.13, squint: vi === 1 };
    c.sweat = { y: V.headR * 0.95, x: V.headR * 1.0 };
    // hat = clerk visor: green translucent brim + dark band
    c.hatY = V.headR * 1.1;
    const ht = c.hatRaw;
    const band = mesh(G.cyl(V.headR * 0.78, V.headR * 0.82, 0.06, 12), 0x263238, 0, 0.0, 0); ht.add(band);
    const brim = new THREE.Mesh(G.cyl(V.headR * 1.25, V.headR * 1.25, 0.02, 14), flatMat(visorGreen, { transparent: true, opacity: 0.75 })); brim.position.set(0, 0.0, V.headR * 0.55); brim.scale.set(1, 1, 0.7); ht.add(brim);
    // tool = clipboard in right hand, pivot at hand
    c.toolPos.set(V.bw * 0.95, V.bh * 0.62, 0.1);
    const o = c.toolRaw;
    const armR = mesh(G.capsule(0.07, 0.22, 3, 7), lilac, 0, 0.02, 0); armR.rotation.z = -0.7; o.add(armR);
    const board = mesh(G.box(0.26, 0.34, 0.03), P.woodDark, 0.08, 0.02, 0.14); board.rotation.y = -0.3; o.add(board);
    const paper = mesh(G.box(0.22, 0.28, 0.012), 0xFFF8E1, 0.08, 0.0, 0.16); paper.rotation.y = -0.3; o.add(paper);
    const clip = mesh(G.box(0.1, 0.04, 0.04), P.metal, 0.08, 0.18, 0.15); clip.rotation.y = -0.3; o.add(clip);
    for (let i = 0; i < 3; i++) { const line = mesh(G.box(0.14, 0.015, 0.005), 0x7B5EA7, 0.08, 0.08 - i * 0.07, 0.168); line.rotation.y = -0.3; o.add(line); }
    c.caneTip = new THREE.Vector3(0.08, 0.18, 0.15);
    c.scrollPos.set(0.08, -0.06, 0.2);
  }, opts);
}

export { measureCreature as measureVillain };

// ═══════════════════════════════════════════ FogPuffPool ═══════════════════════════════════════════
/**
 * Small pool of purple fog spheres (ONE InstancedMesh = 1 draw call). Baron's cane / Collectors' clipboards puff from it.
 *   const fog = new FogPuffPool(game.scene); game.add(fog);       fog.spawn(worldPos, dirVec3, count)      fog.active
 * Puffs rise, drift along dir, swell to 2.2×, then shrink out over 0.9–1.3 s. 9B (Debt Fog VFX) may replace with its own pool;
 * the animator only needs `.spawn(pos, dir, n)`.
 */
export class FogPuffPool {
  constructor(scene, n = 32) {
    this.n = n;
    const mat = toonMat(PURPLE, { transparent: true, opacity: 0.8 });
    this.mesh = new THREE.InstancedMesh(G.sphere(0.16, 8, 6), mat, n);
    this.mesh.frustumCulled = false; this.mesh.userData.noOutline = true; this.mesh.castShadow = false; this.mesh.name = 'fogPuffs';
    this.items = Array.from({ length: n }, () => ({ life: 0, dur: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: Math.random() * 6 }));
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, this._hidden);
    this.active = 0;
    if (scene) scene.add(this.mesh);
  }
  spawn(pos, dir, count = 6) {
    let spawned = 0;
    for (const it of this.items) {
      if (it.life > 0) continue;
      it.life = it.dur = 0.9 + Math.random() * 0.4;
      it.pos.copy(pos);
      it.vel.set(dir.x + (Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.5, dir.z + (Math.random() - 0.5) * 0.8).multiplyScalar(1.1);
      it.rot = Math.random() * 6;
      if (++spawned >= count) break;
    }
    this.active += spawned;
    return spawned;
  }
  update(dt) {
    let any = false;
    this.items.forEach((it, i) => {
      if (it.life <= 0) return;
      it.life -= dt; any = true;
      if (it.life <= 0) { this.mesh.setMatrixAt(i, this._hidden); this.active--; return; }
      const t = 1 - it.life / it.dur;                                   // 0 → 1
      it.vel.multiplyScalar(1 - 1.8 * dt); it.vel.y += 0.3 * dt;         // drag + slow rise
      it.pos.addScaledVector(it.vel, dt);
      const s = t < 0.35 ? 0.4 + (t / 0.35) * 1.8 : 2.2 * (1 - (t - 0.35) / 0.65);
      this._q.setFromAxisAngle(_UP, it.rot + t * 2);
      this._m.compose(it.pos, this._q, this._s.setScalar(Math.max(0.001, s)));
      this.mesh.setMatrixAt(i, this._m);
    });
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const _UP = new THREE.Vector3(0, 1, 0);

// ═══════════════════════════════════════════ VillainAnimator ═══════════════════════════════════════════
const _v = new THREE.Vector3(), _d = new THREE.Vector3();
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Drives Baron Gilt and the Fog Collectors. Same interface as CreatureAnimator (it IS one):
 *   .play('strut'|'taunt'|'offerDeal'|'flee'|'slipOnCoin'|'fogPuff'|'idle'|'walk'|…)  .update(dt)  .moodTint(t)  .faceTo(v)  .hit(dir,p)  .current  .timeScale
 * opts: { vfx, fogPool (FogPuffPool — fogPuff spawns from the cane tip), game (for game.hitstop(60) + camera shake on slip),
 *         onDeal(worldPos) fires when the scroll unrolls (4B/8B hook the Too-Good Deal here), onSlip() fires at the fall impact }
 * One-shots (taunt/offerDeal/slipOnCoin/fogPuff) return to the previous loop (strut/flee/idle) automatically.
 * Extra pose channels (reset every frame, written by clips): head nod/tilt/yaw · tool rx/ry/rz/y · hat y/rz · cape · scroll (0..1) · sweat (bool).
 */
export class VillainAnimator extends CreatureAnimator {
  constructor(root, opts = {}) {
    super(root, opts);
    this.type = root.userData.type || 'baron';
    this.fogPool = opts.fogPool || null;
    this.game = opts.game || null;
    this.onDeal = opts.onDeal || null;
    this.onSlip = opts.onSlip || null;
    this.puffs = 0;                       // total puffs spawned (for tests / demo)
    this.hp = { nod: 0, tilt: 0, yaw: 0, trx: 0, try: 0, trz: 0, ty: 0, hatY: 0, hatRz: 0, hatRx: 0, cape: 0, scroll: 0, sweat: false };
    this.turnSpeed = 7;                   // pompous = slower turns
    Object.assign(this._clips, buildVillainClips(this));
    this.play('idle');
  }

  /** World position of the cane knob / clipboard top (fog source). */
  toolTip(out = new THREE.Vector3()) { const tool = this.p.tool || this.body; return tool.localToWorld(out.copy(this.root.userData.caneTip || _ZERO)); }

  puff(n = 6) {
    this.toolTip(_v);
    _d.set(0, 0, 1).applyQuaternion(this.root.quaternion);
    if (this.fogPool) this.puffs += this.fogPool.spawn(_v, _d, n);
    if (this.vfx && this.vfx.sparks) this.vfx.sparks.burst(_v.clone(), 4, 1.5);
  }

  slipImpact() {
    this.dust(8, 0.5);
    if (this.game) { if (this.game.hitstop) this.game.hitstop(60); if (this.game.camera && this.game.camera.shake) this.game.camera.shake(0.2); }
    if (this.onSlip) this.onSlip();
  }

  update(dt) {
    const hp = this.hp;
    hp.nod = 0; hp.tilt = 0; hp.yaw = 0; hp.trx = 0; hp.try = 0; hp.trz = 0; hp.ty = 0; hp.hatY = 0; hp.hatRz = 0; hp.hatRx = 0; hp.cape = 0; hp.scroll = 0; hp.sweat = false;
    super.update(dt);                              // runs the Sequence (fills hp), applies body squash / y / lean / facing
    const p = this.p, t = this.t;
    // continuous tics: Baron sways his cane + cape breathes; collectors glance about nervously
    if (this.type === 'baron') { hp.trz += Math.sin(t * 1.2 * Math.PI * 2) * 0.04; hp.cape += Math.sin(t * 1.6) * 0.04; }
    else { hp.yaw += Math.sin(t * 0.9 * Math.PI * 2) * 0.1; hp.tilt += Math.sin(t * 2.3) * 0.03; }
    if (p.head) p.head.rotation.set(hp.nod, hp.yaw, hp.tilt);
    if (p.hat) { p.hat.position.y = (p.hat.userData.y0 ?? (p.hat.userData.y0 = p.hat.position.y)) + hp.hatY; p.hat.rotation.set(hp.hatRx, 0, hp.hatRz); }
    if (p.tool) { p.tool.rotation.set(hp.trx, hp.try, hp.trz); p.tool.position.y = (p.tool.userData.y0 ?? (p.tool.userData.y0 = p.tool.position.y)) + hp.ty; }
    if (p.cape) p.cape.rotation.x = -0.12 + hp.cape - this.pose.lean * 0.6;     // cape trails opposite to the lean
    if (p.scroll) { const s = Math.max(0.001, hp.scroll); p.scroll.visible = hp.scroll > 0.01; p.scroll.scale.y = s; }
    if (p.sweat) { p.sweat.visible = hp.sweat; if (hp.sweat) p.sweat.position.y = (p.sweat.userData.y0 ?? (p.sweat.userData.y0 = p.sweat.position.y)) + Math.abs(Math.sin(t * 14)) * 0.05; }
  }
}
const _ZERO = new THREE.Vector3();

function buildVillainClips(a) {
  const pose = a.pose, hp = a.hp;
  return {
    // strut: stepL 160 → plantL 80 → stepR 160 → plantR 80 (= 480... + 160 = 640 incl. both steps) — chest out, cane swings
    strut: () => new Sequence('strut')
      .phase('stepL', 160, Easing.outQuad, (e, c, t) => { const h = Math.sin(t * Math.PI); pose.y = h * 0.09; pose.squash = lerp(1, 1.04, h); pose.tilt = e * 0.09; pose.lean = -0.12; hp.nod = -0.08 * h; hp.trz = -0.35 * e; hp.cape = -h * 0.1; })
      .phase('plantL', 80, Easing.inQuad, (e) => { pose.y = 0; pose.squash = lerp(1.0, 0.95, e); pose.tilt = 0.09; pose.lean = -0.12; hp.trz = -0.35; }, { onEnter: () => a.dust(2, 0.2) })
      .phase('stepR', 160, Easing.outQuad, (e, c, t) => { const h = Math.sin(t * Math.PI); pose.y = h * 0.09; pose.squash = lerp(0.95, 1.04, h); pose.tilt = lerp(0.09, -0.09, e); pose.lean = -0.12; hp.nod = -0.08 * h; hp.trz = lerp(-0.35, 0.35, e); hp.cape = -h * 0.1; })
      .phase('plantR', 80, Easing.inQuad, (e) => { pose.y = 0; pose.squash = lerp(1.0, 0.95, e); pose.tilt = lerp(-0.09, 0, e); pose.lean = -0.12; hp.trz = 0.35 * (1 - e); }, { onEnter: () => a.dust(2, 0.2) })
      .setLoop(true),

    // taunt: tip 200 → chuckle 250 → lower 250 (= 700)
    taunt: () => new Sequence('taunt')
      .phase('tip', 200, Easing.outBack, (e) => { hp.hatY = e * 0.18; hp.hatRz = e * -0.45; hp.nod = e * -0.25; pose.lean = e * -0.15; pose.squash = lerp(1, 1.06, e); hp.trz = e * 0.3; }, { onEnter: () => a.spring.kick(0.5) })
      .phase('chuckle', 250, Easing.linear, (e, c, t) => { hp.hatY = 0.18 + Math.sin(t * Math.PI * 6) * 0.02; hp.hatRz = -0.45 + Math.sin(t * Math.PI * 6) * 0.05; hp.nod = -0.25; pose.lean = -0.15; pose.squash = 1.06 + Math.sin(t * Math.PI * 12) * 0.03; hp.trz = 0.3; })
      .phase('lower', 250, Easing.outBack, (e) => { hp.hatY = lerp(0.18, 0, e); hp.hatRz = lerp(-0.45, 0, e); hp.nod = lerp(-0.25, 0, e); pose.lean = lerp(-0.15, 0, e); pose.squash = lerp(1.06, 1, e); hp.trz = lerp(0.3, 0, e); }),

    // offerDeal: reach 200 → unroll 250 [onDeal] → hold 150 (= 600)
    offerDeal: () => new Sequence('offerDeal')
      .phase('reach', 200, Easing.outCubic, (e) => { pose.lean = e * 0.25; hp.trx = e * -1.25; hp.nod = e * 0.2; hp.tilt = e * 0.05; pose.squash = lerp(1, 0.97, e); })
      .phase('unroll', 250, Easing.outBack, (e) => { pose.lean = 0.25; hp.trx = -1.25; hp.nod = 0.2; hp.tilt = 0.05; pose.squash = 0.97; hp.scroll = Math.max(0.01, e); },
        { onEnter: () => { a.spring.kick(0.3); if (a.onDeal) { a.toolTip(_v); a.onDeal(_v.clone()); } if (a.vfx && a.vfx.sparks) { a.toolTip(_v); a.vfx.sparks.burst(_v.clone(), 5, 1.6); } } })
      .phase('hold', 150, Easing.linear, (e, c, t) => { pose.lean = 0.25; hp.trx = -1.25; hp.nod = 0.2; hp.tilt = 0.05; pose.squash = 0.97; hp.scroll = 1 + Math.sin(t * Math.PI * 4) * 0.02; }),

    // flee: hopL 150 → hopR 150 (= 300 loop) — fast waddle, sweat drops, tool flailing
    flee: () => new Sequence('flee')
      .phase('hopL', 150, Easing.linear, (e, c, t) => { const h = Math.sin(t * Math.PI); pose.y = h * 0.14; pose.lean = 0.35; pose.tilt = 0.18 * h; pose.squash = lerp(1.05, 0.92, t); hp.sweat = true; hp.trx = -0.6 - h * 0.3; hp.nod = 0.15; hp.cape = -0.35 - h * 0.1; hp.hatRx = -0.15; }, { onEnter: () => a.dust(2, 0.3) })
      .phase('hopR', 150, Easing.linear, (e, c, t) => { const h = Math.sin(t * Math.PI); pose.y = h * 0.14; pose.lean = 0.35; pose.tilt = -0.18 * h; pose.squash = lerp(1.05, 0.92, t); hp.sweat = true; hp.trx = -0.6 - h * 0.3; hp.nod = 0.15; hp.cape = -0.35 - h * 0.1; hp.hatRx = -0.15; }, { onEnter: () => a.dust(2, 0.3) })
      .setLoop(true),

    // slipOnCoin: step 150 → slip 120 → fall 180 [impact: dust, hit-stop 60] → dazed 250 → up 200 (= 900)
    slipOnCoin: () => new Sequence('slipOnCoin')
      .phase('step', 150, Easing.outQuad, (e) => { pose.lean = e * 0.15; pose.y = e * 0.05; hp.nod = e * 0.1; })
      .phase('slip', 120, Easing.outQuad, (e) => { pose.lean = lerp(0.15, -0.9, e); pose.y = lerp(0.05, 0.32, e); pose.squash = lerp(1, 1.12, e); hp.hatY = e * 0.35; hp.hatRz = e * 0.6; hp.trx = e * 0.8; hp.nod = lerp(0.1, -0.4, e); hp.cape = e * 0.5; }, { onEnter: () => { a.spring.kick(0.8); if (a.vfx && a.vfx.pop) { _v.copy(a.root.position); _v.y += a.root.userData.height || 1.5; a.vfx.pop.show(_v.clone(), '!', { color: '#FFD54F', dur: 0.5, size: 1 }); } } })
      .phase('fall', 180, Easing.inQuad, (e) => { pose.lean = lerp(-0.9, -1.35, e); pose.y = lerp(0.32, 0, e); pose.squash = lerp(1.12, 0.72, e); hp.hatY = lerp(0.35, 0.05, e); hp.hatRz = lerp(0.6, 0.9, e); hp.trx = 0.8; hp.nod = -0.4; hp.cape = 0.5; }, { onExit: () => { a.spring.kick(-1.5); a.slipImpact(); } })
      .phase('dazed', 250, Easing.linear, (e, c, t) => { pose.lean = -1.35; pose.y = 0; pose.squash = 0.72 + Math.sin(t * Math.PI * 2) * 0.02; pose.jitter = Math.sin(t * Math.PI * 10) * 0.03; hp.hatY = 0.05; hp.hatRz = 0.9 + Math.sin(t * Math.PI * 6) * 0.08; hp.nod = Math.sin(t * Math.PI * 6) * 0.2; hp.trx = 0.8; hp.cape = 0.5; hp.sweat = true; })
      .phase('up', 200, Easing.outBack, (e) => { pose.lean = lerp(-1.35, 0, e); pose.squash = lerp(0.72, 1, e); hp.hatY = lerp(0.05, 0, e); hp.hatRz = lerp(0.9, 0, e); hp.trx = lerp(0.8, 0, e); hp.cape = lerp(0.5, 0, e); hp.nod = lerp(0.2, 0, e); }, { onEnter: () => a.dust(3, 0.3) }),

    // fogPuff: wind 150 → thrust 100 [puff ×6] → settle 250 (= 500)
    fogPuff: () => new Sequence('fogPuff')
      .phase('wind', 150, Easing.inQuad, (e) => { hp.trx = e * -0.3; pose.squash = lerp(1, 0.95, e); pose.lean = e * -0.08; hp.nod = e * -0.1; })
      .phase('thrust', 100, Easing.outQuad, (e) => { hp.trx = lerp(-0.3, -1.35, e); pose.squash = lerp(0.95, 1.08, e); pose.lean = lerp(-0.08, 0.15, e); hp.nod = lerp(-0.1, 0.15, e); hp.cape = -e * 0.2; }, { onEnter: () => { a.spring.kick(0.7); } })
      .phase('settle', 250, Easing.outBack, (e) => { hp.trx = lerp(-1.35, 0, e); pose.squash = lerp(1.08, 1, e); pose.lean = lerp(0.15, 0, e); hp.nod = lerp(0.15, 0, e); hp.cape = -(1 - e) * 0.2; }, { onEnter: () => a.puff(6) }),
  };
}
