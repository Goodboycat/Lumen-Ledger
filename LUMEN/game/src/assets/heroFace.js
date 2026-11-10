// Pip's face rig (S82). Flat, unlit, no-outline meshes floating 0.015 u in front of the skull's flat front plane (skull front z = 0.52;
// the old eyes sat at z = 0.36 = INSIDE the head, so Pip had no visible face). Everything is driven by ONE parameter record (see
// src/anim/heroFace.js EXPRESSIONS), applied with rig.apply(P, t). No allocations per frame.
//   face (group, head-local (0, 0.36, 0.535))
//     eyeL/eyeR (group) → oval (black) + glint (white) + arc (happy ^ eye)
//     browL/browR (box)  mouth ribbon (+2 round caps)  open (ellipse + tongue + teeth)  tongueOut  blushL/R  sweat
import * as THREE from '../../vendor/three.module.js';
import { G } from './geo.js';
import { PALETTE as P, flatMat } from '../core/Toon.js';

const INK = 0x263238, BROW = 0x3e2723, TONGUE = 0xf06292, BLUSH = 0xff8a80, SWEAT = 0x81d4fa;
const fm = (c, o) => { const m = flatMat(c, o); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
const flat = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.userData.noOutline = true; m.castShadow = m.receiveShadow = false; return m; };

/** A thin curved strip (rounded with end caps): x in [-w, w], bow c (+ = smile, ends up). Updated in place. */
class Ribbon {
  constructor(mat, n = 10, caps = true) {
    this.n = n; const pos = new Float32Array((n + 1) * 2 * 3), idx = [];
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.userData.noOutline = true; this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.group = new THREE.Group(); this.group.add(this.mesh); this.caps = [];
    if (caps) for (let i = 0; i < 2; i++) { const c = flat(G.sphere(0.5, 6, 4), mat); c.scale.z = 0.3; this.group.add(c); this.caps.push(c); }
    this.key = '';
  }
  set(w, c, t) {
    const k = w.toFixed(3) + c.toFixed(3) + t.toFixed(3); if (k === this.key) return; this.key = k;
    const p = this.mesh.geometry.attributes.position, n = this.n;
    for (let i = 0; i <= n; i++) {
      const u = i / n, s = 2 * u - 1, x = s * w, y = c * w * (s * s - 0.5) * 0.9;
      p.setXYZ(i * 2, x, y + t / 2, 0); p.setXYZ(i * 2 + 1, x, y - t / 2, 0);
    }
    p.needsUpdate = true;
    for (let i = 0; i < this.caps.length; i++) { const s = i ? 1 : -1, cp = this.caps[i]; cp.position.set(s * w, c * w * (0.5) * 0.9, 0); cp.scale.set(t, t, cp.scale.z); }
  }
}

export function buildHeroFace(head, C = {}) {
  const inkM = fm(INK), browM = fm(C.brow ?? BROW), whiteM = fm(P.white), tongueM = fm(TONGUE), blushM = fm(BLUSH, { transparent: true, opacity: 0.55 }), sweatM = fm(SWEAT);
  const face = new THREE.Group(); face.name = 'face'; face.position.set(0, 0.36, 0.535); head.add(face);

  const eyes = [], brows = [], blush = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(sx * 0.2, 0, 0); face.add(eye);
    const oval = flat(G.sphere(0.5, 10, 8), inkM); oval.scale.set(0.19, 0.25, 0.06); eye.add(oval);
    const glint = flat(G.sphere(0.5, 6, 5), whiteM, sx * 0.012 + 0.012, 0.045, 0.026); glint.scale.set(0.06, 0.07, 0.03); eye.add(glint);
    const arc = new Ribbon(inkM, 8, false); arc.set(0.085, -0.9, 0.034); arc.group.position.set(0, -0.01, 0.01); arc.group.visible = false; eye.add(arc.group);
    eyes.push({ g: eye, oval, glint, arc, sx });
    const brow = new THREE.Group(); brow.position.set(sx * 0.2, 0.21, 0.004); face.add(brow);
    const bm = flat(G.box(0.23, 0.08, 0.03), browM); brow.add(bm);
    brows.push({ g: brow, sx });
    const b = flat(G.sphere(0.5, 6, 4), blushM, sx * 0.335, -0.13, -0.005); b.scale.set(0.14, 0.08, 0.03); face.add(b); blush.push(b);
  }
  // mouth: ribbon (smile / frown / flat) OR open ellipse (+ tongue / teeth)
  const mouth = new THREE.Group(); mouth.name = 'mouth'; mouth.position.set(0, -0.2, 0); face.add(mouth);
  const rib = new Ribbon(inkM, 10, true); mouth.add(rib.group);
  const open = new THREE.Group(); open.visible = false; mouth.add(open);
  const hole = flat(G.sphere(0.5, 10, 8), inkM); open.add(hole);
  const tongue = flat(G.sphere(0.5, 8, 6), tongueM, 0, -0.28, 0.012); open.add(tongue);
  const teeth = flat(G.box(1, 0.3, 0.2), whiteM, 0, 0.26, 0.014); open.add(teeth);
  const tongueOut = flat(G.sphere(0.5, 8, 6), tongueM, 0.08, -0.045, 0.006); tongueOut.scale.set(0.06, 0.07, 0.03); tongueOut.visible = false; mouth.add(tongueOut);
  const sweat = new THREE.Group(); sweat.position.set(0.43, 0.16, 0.002); sweat.visible = false; face.add(sweat);
  const dropB = flat(G.sphere(0.5, 7, 5), sweatM); dropB.scale.set(0.07, 0.085, 0.03); sweat.add(dropB);
  const dropT = flat(G.cone(0.5, 1, 6), sweatM, 0, 0.07, 0); dropT.scale.set(0.06, 0.08, 0.03); sweat.add(dropT);

  const rig = {
    group: face, mouth, eyes, brows, blush, sweat, open,
    /** Q = param record (see src/anim/heroFace.js BASE); t = seconds (sweat drop slide, dizzy wobble). */
    apply(Q, t) {
      const shut = Q.happy > 0.5;
      for (const e of eyes) {
        const asy = e.sx < 0 ? 1 + Q.asy : 1 - Q.asy;
        e.g.position.set(e.sx * 0.2 * Q.espread + Q.lx, Q.ey + Q.ly, 0);
        e.oval.visible = !shut; e.arc.group.visible = shut;
        const sy = Math.max(0.012, 0.25 * Q.esy * asy);
        e.oval.scale.set(0.19 * Q.esx, sy, 0.06);
        e.glint.visible = !shut && Q.esy * asy > 0.45;
        if (shut) e.arc.set(0.085, Q.ac, 0.06);
      }
      for (const b of brows) { b.g.position.set(b.sx * 0.2 * Q.espread + Q.lx * 0.4, 0.21 + Q.bl, 0.004); b.g.rotation.z = b.sx * Q.ba; b.g.scale.x = Q.bsx; }
      const useOpen = Q.op > 0.3, o = Math.min(1, Q.op);
      rib.group.visible = !useOpen; open.visible = useOpen;
      if (!useOpen) rib.set(Q.mw, Q.mc, 0.062);
      else {
        const w = Q.ow, h = Math.max(0.02, Q.oh * o);
        hole.scale.set(w, h, 0.05);
        tongue.visible = Q.teeth < 0.5; tongue.scale.set(w * 0.62, h * 0.4, 0.04); tongue.position.y = -h * 0.28;
        teeth.visible = Q.teeth >= 0.5; teeth.scale.set(w * 0.86, h * 0.4, 0.15); teeth.position.y = h * 0.26;
      }
      tongueOut.visible = Q.tg > 0.5 && !useOpen; tongueOut.position.set(Q.mw * 0.5, -0.055, 0.006);
      blushM.opacity = Math.max(0, Math.min(1, Q.blush));
      for (const b of blush) b.visible = Q.blush > 0.04;
      sweat.visible = Q.sweat > 0.5; if (sweat.visible) sweat.position.y = 0.2 - ((t * 1.1) % 1) * 0.12;
    },
  };
  return rig;
}
