// GameCamera: top-down ¾ follow camera with damped follow, zoom, and trauma-based shake.
import * as THREE from '../../vendor/three.module.js';
import { damp } from '../anim/Easing.js';

export class GameCamera {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(38, aspect, 0.1, 120);
    this.target = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.offset = new THREE.Vector3(0, 13, 10); // ¾ view; tune pitch via y/z ratio
    this.zoom = 1; // 0.6 (close) … 1.6 (far)
    this.followSpeed = 6;
    this.trauma = 0;        // 0..1, decays; shake = trauma^2
    this.traumaDecay = 1.8;
    this.maxShakePos = 0.45;
    this.maxShakeRot = 0.035;
    this._t = 0;
    this._shakeOff = new THREE.Vector3();
    // S18 cinematics: an external rig (CinematicDirector) can own the camera. `cine` = { pos:Vector3, look:Vector3 } written every frame
    // by the director; `cineBlend` 0..1 mixes the follow camera (0) into the rig (1). The follow target/lookAt keep updating underneath
    // so handing control back is a blend, not a cut.
    this.cine = null; this.cineBlend = 0;
    this._cinePos = new THREE.Vector3(); this._cineLook = new THREE.Vector3();
    this.cam.position.copy(this.offset);
    this.cam.lookAt(0, 0, 0);
  }
  get three() { return this.cam; }
  setAspect(a) { this.cam.aspect = a; this.cam.updateProjectionMatrix(); }
  /** Add shake. amount 0..1 (0.25 small hit, 0.5 heavy, 1 explosion). */
  shake(amount) { if (this.reduceMotion) return; this.trauma = Math.min(1, this.trauma + amount); }   // BUGFIX B23: Reduce Motion → no camera shake
  snapTo(pos) { this.target.copy(pos); this.lookAt.copy(pos); this.cam.position.copy(pos).add(this.offset).multiplyScalar(1); }
  /** S18: hand the camera to a cinematic rig. rig = { pos:Vector3, look:Vector3 } (mutated by the caller each frame) or null to release. */
  setCine(rig, blend = rig ? 1 : 0) { this.cine = rig || null; this.cineBlend = rig ? Math.max(0, Math.min(1, blend)) : 0; }

  /** @param {THREE.Vector3} followPos @param {number} dt seconds */
  update(followPos, dt) {
    this._t += dt;
    if (followPos) this.target.copy(followPos);
    this.lookAt.x = damp(this.lookAt.x, this.target.x, this.followSpeed, dt);
    this.lookAt.y = damp(this.lookAt.y, this.target.y, this.followSpeed, dt);
    this.lookAt.z = damp(this.lookAt.z, this.target.z, this.followSpeed, dt);

    let px = this.lookAt.x + this.offset.x * this.zoom;
    let py = this.lookAt.y + this.offset.y * this.zoom;
    let pz = this.lookAt.z + this.offset.z * this.zoom;
    // S18: blend toward the cinematic rig (position + look-at both lerped, so a 0→1 ramp is a smooth pull, not a snap)
    const rig = this.cine, k = rig ? this.cineBlend : 0;
    if (rig && k > 0) {
      px += (rig.pos.x - px) * k; py += (rig.pos.y - py) * k; pz += (rig.pos.z - pz) * k;
      this._cineLook.copy(this.lookAt).lerp(rig.look, k);
    } else this._cineLook.copy(this.lookAt);

    // shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
      const s = this.trauma * this.trauma;
      const t = this._t * 40;
      this._shakeOff.set(
        noise1(t, 1) * this.maxShakePos * s,
        noise1(t, 2) * this.maxShakePos * s,
        noise1(t, 3) * this.maxShakePos * s * 0.5
      );
      this.cam.position.set(px, py, pz).add(this._shakeOff);
      this.cam.lookAt(this._cineLook);
      this.cam.rotation.z += noise1(t, 4) * this.maxShakeRot * s;
    } else {
      this.cam.position.set(px, py, pz);
      this.cam.lookAt(this._cineLook);
    }
  }
}

// Cheap smooth pseudo-noise in [-1,1]
function noise1(t, seed) {
  return Math.sin(t * 1.3 + seed * 17.1) * 0.6 + Math.sin(t * 2.7 + seed * 5.3) * 0.4;
}
