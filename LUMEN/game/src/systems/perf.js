// Chat 11A — Performance helpers (pure Three, no DOM). Three independent, opt-in tools the integrator (src/Game.js) wires:
//
//   BlobShadows(scene, max)          one InstancedMesh for EVERY creature blob shadow (hero, glimmers, helpers, villains).
//                                    .update(roots) each frame: hides each root's own `parts.shadow` disc (its scale is still
//                                    animated by the Creature/Helper/VillainAnimator — we read it) and writes one instance
//                                    matrix per visible root. 23 discs → 1 draw call in the demo world, 20–30 → 1 in play.
//   CreatureLOD(camera, opts)        distance LOD with hysteresis: beyond `near` (18 u) hide accessory outline hulls
//                                    (kit / hat / tool / tail / cape), beyond `far` (26 u) hide ALL hulls + tiny flat bits
//                                    (eyes / mouth / core). Hull lists are cached per root on first sight (root.userData.lod).
//   PixelRatioGovernor(game, opts)   fps < 45 for 3 s → drop one pixelRatio step (1.5 → 1.25 → 1.0 → 0.85);
//                                    fps > 58 for 10 s → raise one step (never above the quality cap / devicePixelRatio).
//   countGeometries(scene)           unique BufferGeometry count under a scene (memory-growth check, P3).
//
// Budget maths (measured with check.mjs --world, visible meshes = draw calls):
//   10D master 434 → P1.0 count fix 353 → P1.1 fuseGlimmer 316 → P1.4 bakeShells 292 → P1.3 BlobShadows 270 (this file).
import * as THREE from '../../vendor/three.module.js';

const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

/** Shared unit shadow material (same look as the per-creature discs: black, 20 %, no depth write). */
let _shadowMat = null;
export function shadowMaterial() {
  if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false });
  return _shadowMat;
}

/** Find the creature's own shadow disc: parts.shadow (creatures, hero) or a child named shadow/blobShadow. */
export function findShadow(root) {
  const p = root.userData && root.userData.parts;
  if (p && p.shadow) return p.shadow;
  return root.getObjectByName('shadow') || root.getObjectByName('blobShadow') || null;
}

// ═══════════════════════════════════════════ BlobShadows ═══════════════════════════════════════════
export class BlobShadows {
  /**
   * @param {THREE.Object3D} scene  parent for the instanced disc
   * @param {number} max            instance capacity (grows ×2 automatically when exceeded)
   */
  constructor(scene, max = 64) {
    this.scene = scene;
    this.max = max;
    this.mesh = this._make(max);
    scene.add(this.mesh);
    this.count = 0;
    this.hidden = new Set();      // shadow discs we turned invisible (restored by dispose / when a root drops out)
  }
  _make(max) {
    const geo = new THREE.CylinderGeometry(1, 1, 0.01, 12);     // unit radius; real radius baked into the instance matrix
    const im = new THREE.InstancedMesh(geo, shadowMaterial(), max);
    im.name = 'blobShadows'; im.frustumCulled = false; im.castShadow = im.receiveShadow = false;
    im.userData.noOutline = true; im.count = 0;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return im;
  }
  _grow(n) {
    const next = this._make(Math.max(n + 1, this.max * 2));
    for (let i = 0; i < n; i++) { this.mesh.getMatrixAt(i, _m); next.setMatrixAt(i, _m); }   // keep what this frame already wrote
    this.scene.remove(this.mesh); this.mesh.dispose?.(); this.mesh = next; this.max = next.instanceMatrix.count; this.scene.add(next);
  }
  /**
   * Write one instance per visible creature root. Reads the creature's own disc (radius from its geometry, scale.x/z
   * from the animator's squash) so the look is identical to the per-creature disc, then hides the disc.
   * @param {Iterable<THREE.Object3D>} roots  hero root, cust.active[].root, helpers[].g, villains[].g …
   */
  update(roots) {
    let n = 0; const seen = this.hidden;
    for (const root of roots) {
      if (!root || !root.visible) continue;
      const disc = findShadow(root); if (!disc) continue;
      if (disc.visible) { disc.visible = false; disc.userData.pooledShadow = true; seen.add(disc); }
      if (n >= this.max) this._grow(n);
      // radius: the disc's cylinder radius (unit discs from this file have 1) × its animated scale
      const r = (disc.geometry.parameters && disc.geometry.parameters.radiusTop) || 1;
      root.updateMatrixWorld(false);
      _p.setFromMatrixPosition(root.matrixWorld);
      _p.y += 0.012;
      _s.set(r * disc.scale.x, 1, r * disc.scale.z);
      _m.makeScale(_s.x, _s.y, _s.z); _m.setPosition(_p);
      this.mesh.setMatrixAt(n++, _m);
    }
    this.mesh.count = n; this.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    return n;
  }
  /** Give every creature its own disc back and remove the instanced mesh. */
  dispose() {
    for (const d of this.hidden) { d.visible = true; delete d.userData.pooledShadow; }
    this.hidden.clear();
    this.scene.remove(this.mesh); this.mesh.dispose?.(); this.mesh.geometry.dispose();
  }
}

// ═══════════════════════════════════════════ CreatureLOD ═══════════════════════════════════════════
export class CreatureLOD {
  constructor(camera, opts = {}) {
    this.camera = camera;                 // THREE.Camera or anything with .position (GameCamera.three)
    this.near = opts.near ?? 18;          // beyond: accessory hulls off
    this.far = opts.far ?? 26;            // beyond: all hulls + tiny flat bits off
    this.hyst = opts.hyst ?? 1;           // hysteresis in u (switch back only when 1 u closer)
    this.enabled = opts.enabled !== false;
    this.stats = { near: 0, mid: 0, far: 0 };
  }
}

// ═══════════════════════════════════════════ PixelRatioGovernor ═══════════════════════════════════════════
export class PixelRatioGovernor {
  constructor(game, opts = {}) {
    this.game = game;
    this.steps = opts.steps || [1.5, 1.25, 1.0, 0.85];
    this.low = opts.low ?? 45; this.lowS = opts.lowS ?? 3;
    this.high = opts.high ?? 58; this.highS = opts.highS ?? 10;
    this.enabled = opts.enabled !== false;
    this.lowT = 0; this.highT = 0; this.changes = 0;
    const cap = Math.min(game.quality?.pixelRatio ?? 1.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1.5);
    this.cap = cap;
    this.index = Math.max(0, this.steps.findIndex((s) => s <= cap + 1e-6));   // start at the quality cap (or the first step below it)
    if (this.index < 0) this.index = this.steps.length - 1;
  }
  get ratio() { return Math.min(this.cap, this.steps[this.index]); }
}

/** Unique geometries referenced by visible-or-not meshes under `root` (cheap memory-growth probe for P3). */
export function countGeometries(root) {
  const set = new Set();
  root.traverse((o) => { if (o.isMesh && o.geometry) set.add(o.geometry); });
  return set.size;
}

export default { BlobShadows, CreatureLOD, PixelRatioGovernor, countGeometries, findShadow };
