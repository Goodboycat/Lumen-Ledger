// Pip — the hero. Procedural toy low-poly rig in XP Hero proportions (big head, stubby body).
// Hierarchy (all named, Hero Animation chat animates these parts):
//   root (feet pivot, moves in world)
//     └ body (squash/stretch pivot at feet)   ← setSquash() goes here
//         ├ hips → legL, legR (hip pivots)
//         ├ torso (pivot at waist; rotate for wind-up)
//         │    ├ armL (shoulder pivot) → handL
//         │    ├ armR (shoulder pivot) → handR → weaponSlot (sword attaches here)
//         │    └ head (neck pivot) → face, hair, eyes
//         └ shadow blob (flat disc, no outline)
import * as THREE from '../../vendor/three.module.js';
import { G, mesh, group } from './geo.js';
import { PALETTE as P, toonMat, flatMat } from '../core/Toon.js';
import { addOutline } from '../core/Outline.js';

export function makeHero(opts = {}) {
  const C = { shirt: P.heroOrange, skin: P.heroSkin, hair: P.heroHair, pants: P.heroPants, boots: P.woodDark, ...opts.colors };
  const root = new THREE.Group(); root.name = 'hero';
  const body = new THREE.Group(); body.name = 'body'; root.add(body);

  // legs (short, stubby) — hip pivot height 0.55
  const hips = new THREE.Group(); hips.name = 'hips'; hips.position.y = 0.55; body.add(hips);
  const legL = legPart(C, -0.17), legR = legPart(C, 0.17);
  legL.name = 'legL'; legR.name = 'legR'; hips.add(legL, legR);

  // torso: pivot at waist
  const torso = new THREE.Group(); torso.name = 'torso'; torso.position.y = 0.55; body.add(torso);
  const chest = mesh(G.rbox(0.62, 0.62, 0.46, 0.1), C.shirt, 0, 0.33, 0); chest.name = 'chest'; torso.add(chest);
  const belt = mesh(G.box(0.64, 0.1, 0.48), P.woodDark, 0, 0.05, 0); torso.add(belt);
  const buckle = mesh(G.box(0.14, 0.12, 0.05), P.sparkGold, 0, 0.05, 0.25); torso.add(buckle);
  // little backpack-pouch (channeler's ledger pouch)
  const pouch = mesh(G.rbox(0.3, 0.34, 0.16, 0.05), P.wood, 0, 0.3, -0.3); torso.add(pouch);

  // arms (shoulder pivots at y=0.6 of torso)
  const armL = armPart(C, -1), armR = armPart(C, 1);
  armL.name = 'armL'; armR.name = 'armR';
  // BUGFIX (arms/sword inside the stomach): shoulders were at ±0.38 (capsule r 0.11 → overlapped the 0.31 half-width chest) and every
  // pose rotates the arms ±0.35 rad INWARD, which pushed the hands + sword ~0.08 u deep into the belly. Shoulders now sit just outside
  // the chest, and armPart() adds a fixed outward splay (see ARM_SPLAY) under the animated pivot, so all existing poses stay valid.
  armL.position.set(-ARM_SHOULDER_X, 0.58, 0); armR.position.set(ARM_SHOULDER_X, 0.58, 0);
  torso.add(armL, armR);

  // head: neck pivot
  const head = new THREE.Group(); head.name = 'head'; head.position.y = 0.72; torso.add(head);
  const skull = mesh(G.rbox(0.78, 0.7, 0.72, 0.16), C.skin, 0, 0.36, 0); skull.name = 'skull'; head.add(skull);
  // hair cap + spiky fringe
  const hair = mesh(G.rbox(0.84, 0.3, 0.78, 0.12), C.hair, 0, 0.62, -0.02); head.add(hair);
  for (let i = 0; i < 4; i++) {
    const spike = mesh(G.cone(0.11, 0.26, 5), C.hair, -0.27 + i * 0.18, 0.78, 0.22 - (i % 2) * 0.08);
    spike.rotation.x = 0.5; spike.rotation.z = (i - 1.5) * -0.25; head.add(spike);
  }
  const tuft = mesh(G.cone(0.12, 0.36, 5), C.hair, 0.1, 0.86, -0.1); tuft.rotation.z = -0.4; head.add(tuft);
  // eyes: big toon eyes (white + pupil) on front face
  const eyeMat = flatMat(P.white), pupilMat = flatMat(P.black);
  const eyes = new THREE.Group(); eyes.name = 'eyes'; eyes.position.set(0, 0.34, 0.36); head.add(eyes);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(G.sphere(0.1, 8, 6), eyeMat); w.position.set(sx * 0.17, 0, 0); w.scale.set(1, 1.3, 0.5); w.userData.noOutline = true; eyes.add(w);
    const p = new THREE.Mesh(G.sphere(0.055, 6, 5), pupilMat); p.position.set(sx * 0.17, -0.01, 0.05); p.scale.set(1, 1.2, 0.6); p.userData.noOutline = true; eyes.add(p);
  }
  const blush = flatMat(0xff8a80, { transparent: true, opacity: 0.6 });
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(G.sphere(0.06, 6, 4), blush); b.position.set(sx * 0.3, 0.2, 0.34); b.scale.set(1.2, 0.7, 0.3); b.userData.noOutline = true; head.add(b); }
  const mouth = new THREE.Mesh(G.box(0.12, 0.03, 0.02), pupilMat); mouth.position.set(0, 0.17, 0.37); mouth.name = 'mouth'; mouth.userData.noOutline = true; head.add(mouth);

  // scarf (channeler's mark) — accent
  const scarf = mesh(G.torus(0.3, 0.09, 6, 10), P.glimmerBlue, 0, 0.68, 0); scarf.rotation.x = Math.PI / 2; torso.add(scarf);
  const scarfTail = mesh(G.box(0.14, 0.4, 0.06), P.glimmerBlue, -0.2, 0.42, -0.3); scarfTail.rotation.z = 0.3; scarfTail.name = 'scarfTail'; torso.add(scarfTail);

  // blob shadow (fake, cheap; real shadows also on)
  const shadow = new THREE.Mesh(G.cyl(0.42, 0.42, 0.01, 12), flatMat(0x000000, { transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.position.y = 0.012; shadow.userData.noOutline = true; shadow.name = 'blobShadow'; shadow.receiveShadow = false; shadow.castShadow = false; root.add(shadow);

  addOutline(body);

  // Expose parts
  const parts = { root, body, hips, legL, legR, torso, chest, armL, armR, head, eyes, mouth,
    handL: armL.getObjectByName('hand'), handR: armR.getObjectByName('hand'),
    weaponSlot: armR.getObjectByName('weaponSlot'), shadow, scarfTail };
  root.userData.parts = parts;
  root.userData.height = 1.95;
  return root;
}

function legPart(C, x) {
  const g = new THREE.Group(); g.position.set(x, 0, 0);
  const leg = mesh(G.rbox(0.22, 0.34, 0.24, 0.06), C.pants, 0, -0.2, 0); g.add(leg);
  const boot = mesh(G.rbox(0.26, 0.2, 0.34, 0.07), C.boots, 0, -0.45, 0.04); g.add(boot);
  return g;
}
// Shoulder offset from the spine + outward splay (rad) baked under the animated pivot. Rest pose z = ∓0.35 (inward) + splay → arm
// hangs ~0.13 rad outward, hand surface clears the chest side (0.31) with a small gap. Rotations are about z only → they just add.
export const ARM_SHOULDER_X = 0.43;
export const ARM_SPLAY = 0.48;
function armPart(C, side) {
  const g = new THREE.Group();                                        // animated pivot (poses write g.rotation)
  const splay = new THREE.Group(); splay.name = 'armSplay'; splay.rotation.z = side * ARM_SPLAY; g.add(splay);
  const upper = mesh(G.capsule(0.11, 0.3, 2, 7), C.shirt, 0, -0.2, 0); splay.add(upper);
  const hand = mesh(G.sphere(0.14, 8, 6), C.skin, 0, -0.44, 0); hand.name = 'hand'; splay.add(hand);
  const slot = new THREE.Group(); slot.name = 'weaponSlot'; slot.position.set(0, -0.02, 0.06); hand.add(slot);
  return g;
}

/** Sword: blade pivot at grip. Attach to parts.weaponSlot. */
export function makeSword() {
  const g = new THREE.Group(); g.name = 'sword';
  const grip = mesh(G.cyl(0.045, 0.05, 0.3, 6), P.woodDark, 0, 0, 0); g.add(grip);
  const pommel = mesh(G.sphere(0.07, 6, 5), P.sparkGold, 0, -0.17, 0); g.add(pommel);
  const guard = mesh(G.rbox(0.4, 0.08, 0.1, 0.03), P.sparkGold, 0, 0.18, 0); g.add(guard);
  const blade = mesh(G.box(0.14, 0.95, 0.045), P.metal, 0, 0.7, 0); blade.name = 'blade'; g.add(blade);
  const tip = mesh(G.cone(0.1, 0.22, 4), P.metal, 0, 1.28, 0); tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, 0.45); g.add(tip);
  const fuller = mesh(G.box(0.05, 0.75, 0.05), P.metalDark, 0, 0.65, 0); g.add(fuller);
  addOutline(g);
  g.userData.length = 1.4;
  return g;
}
