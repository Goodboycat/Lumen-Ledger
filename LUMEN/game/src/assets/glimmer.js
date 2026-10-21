// Glimmer — the cute customer blob (XP Hero slime vibe, but a "light-drop" creature).
// Hierarchy: root (feet) → body (squash pivot) → shell, face(eyes, mouth), antenna tip
// Creatures chat extends this into 12 variants; keep the part names.
import * as THREE from '../../vendor/three.module.js';
import { G, mesh } from './geo.js';
import { PALETTE as P, flatMat } from '../core/Toon.js';
import { addOutline } from '../core/Outline.js';
import { JellySpring, setSquash, breathe } from '../anim/SquashStretch.js';

export function makeGlimmer(opts = {}) {
  const color = opts.color ?? P.glimmerBlue;
  const size = opts.size ?? 1;
  const root = new THREE.Group(); root.name = 'glimmer';
  const body = new THREE.Group(); body.name = 'body'; root.add(body); body.scale.setScalar(size);

  // teardrop-ish shell: sphere + squashed bottom
  const shell = mesh(G.sphere(0.42, 10, 8), color, 0, 0.42, 0); shell.name = 'shell'; shell.scale.set(1, 0.95, 1); body.add(shell);
  const base = mesh(G.sphere(0.46, 10, 6), color, 0, 0.3, 0); base.scale.set(1, 0.6, 1); body.add(base);
  const peak = mesh(G.cone(0.14, 0.3, 6), color, 0, 0.9, 0); peak.rotation.z = 0.25; body.add(peak);
  // glow core (emissive sphere inside = the "spark" they carry)
  const core = new THREE.Mesh(G.sphere(0.16, 8, 6), flatMat(P.sparkGold)); core.position.set(0, 0.42, 0.15); core.userData.noOutline = true; core.name = 'core'; body.add(core);

  const face = new THREE.Group(); face.name = 'face'; face.position.set(0, 0.46, 0.36); body.add(face);
  const white = flatMat(P.white), black = flatMat(P.black);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(G.sphere(0.09, 8, 6), white); e.position.set(sx * 0.15, 0.02, 0); e.scale.set(1, 1.25, 0.45); e.userData.noOutline = true; e.name = 'eye'; face.add(e);
    const p = new THREE.Mesh(G.sphere(0.05, 6, 5), black); p.position.set(sx * 0.15, 0, 0.045); p.scale.set(1, 1.15, 0.5); p.userData.noOutline = true; p.name = 'pupil'; face.add(p);
  }
  const mouth = new THREE.Mesh(G.torus(0.06, 0.018, 4, 8, Math.PI), black); mouth.position.set(0, -0.11, 0.05); mouth.rotation.z = Math.PI; mouth.userData.noOutline = true; mouth.name = 'mouth'; face.add(mouth);

  const shadow = new THREE.Mesh(G.cyl(0.4, 0.4, 0.01, 12), flatMat(0x000000, { transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.position.y = 0.012; shadow.userData.noOutline = true; shadow.castShadow = shadow.receiveShadow = false; root.add(shadow);

  addOutline(body);

  root.userData.parts = { root, body, shell, face, core, mouth, shadow };
  root.userData.height = 1.0 * size;
  return root;
}

/**
 * Minimal behaviour controller used by the Foundation demo (idle breathe + hop + hit react).
 * The Creature chat replaces this with the full state machine, keeping the same methods.
 */
export class GlimmerController {
  constructor(root) {
    this.root = root; this.p = root.userData.parts;
    this.spring = new JellySpring(260, 12);
    this.t = Math.random() * 10;
    this.hopPhase = Math.random() * Math.PI * 2;
    this.hopping = true;
    this.flash = 0;
    this.knock = new THREE.Vector3();
    this.baseColor = this.p.shell.material.color.clone();
    this._flashMat = null;
  }
  /** Hit reaction: squash, knockback, white flash. dir = Vector3 from attacker. */
  hit(dir, power = 1) {
    this.spring.set(-0.45 * power); this.spring.kick(-2.5 * power);
    this.knock.copy(dir).setY(0).normalize().multiplyScalar(2.6 * power);
    this.flash = 1;
    if (!this._flashMat) { this._flashMat = this.p.shell.material.clone(); this._flashMat.emissive.set(0xffffff); this._orig = this.p.shell.material; }
    this._setMat(this._flashMat);
  }
  _setMat(m) { this.p.body.traverse((o) => { if (o.isMesh && !o.userData.isOutline && !o.userData.noOutline) o.material = m; }); }
  update(dt) {
    this.t += dt;
    const b = this.p.body;
    // knockback
    if (this.knock.lengthSq() > 0.0001) {
      this.root.position.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - 9 * dt));
    }
    // flash
    if (this.flash > 0) { this.flash -= dt / 0.09; if (this.flash <= 0) { this.flash = 0; this._setMat(this._orig); } }
    // hop + breathe + spring
    const s = this.spring.update(dt);
    let hopY = 0, sq = breathe(this.t, 2.4, 0.035);
    if (this.hopping) {
      this.hopPhase += dt * 4.2;
      const h = Math.max(0, Math.sin(this.hopPhase));
      hopY = h * h * 0.22;
      sq *= 1 + (h - 0.35) * 0.18;
    }
    setSquash(b, Math.max(0.3, sq + s));
    b.position.y = hopY;
    this.p.shadow.scale.setScalar(1 - hopY * 1.2);
    // eye sparkle wobble
    this.p.face.position.z = 0.36 + Math.sin(this.t * 3) * 0.004;
  }
}
