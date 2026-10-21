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
    this.cam.position.copy(this.offset);
    this.cam.lookAt(0, 0, 0);
  }
  get three() { return this.cam; }
  setAspect(a) { this.cam.aspect = a; this.cam.updateProjectionMatrix(); }
  /** Add shake. amount 0..1 (0.25 small hit, 0.5 heavy, 1 explosion). */
  shake(amount) { if (this.reduceMotion) return; this.trauma = Math.min(1, this.trauma + amount); }   // BUGFIX B23: Reduce Motion → no camera shake
  snapTo(pos) { this.target.copy(pos); this.lookAt.copy(pos); this.cam.position.copy(pos).add(this.offset).multiplyScalar(1); }

  /** @param {THREE.Vector3} followPos @param {number} dt seconds */
  update(followPos, dt) {
    this._t += dt;
    if (followPos) this.target.copy(followPos);
    this.lookAt.x = damp(this.lookAt.x, this.target.x, this.followSpeed, dt);
    this.lookAt.y = damp(this.lookAt.y, this.target.y, this.followSpeed, dt);
    this.lookAt.z = damp(this.lookAt.z, this.target.z, this.followSpeed, dt);

    const px = this.lookAt.x + this.offset.x * this.zoom;
    const py = this.lookAt.y + this.offset.y * this.zoom;
    const pz = this.lookAt.z + this.offset.z * this.zoom;

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
      this.cam.lookAt(this.lookAt);
      this.cam.rotation.z += noise1(t, 4) * this.maxShakeRot * s;
    } else {
      this.cam.position.set(px, py, pz);
      this.cam.lookAt(this.lookAt);
    }
  }
}

// Cheap smooth pseudo-noise in [-1,1]
function noise1(t, seed) {
  return Math.sin(t * 1.3 + seed * 17.1) * 0.6 + Math.sin(t * 2.7 + seed * 5.3) * 0.4;
}
