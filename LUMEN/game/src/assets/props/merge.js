// Chat 1A — geometry merging for props. A stall built from ~40 tiny toon meshes would cost
// ~80 draw calls (mesh + outline hull each). mergeGroup() bakes all meshes under a group into
// ONE vertex-colored toon mesh (+ one flat/unlit mesh for glowing parts), so a whole stall is
// 2–4 draw calls. Outline (addOutline) then adds just one hull per merged mesh.
//
// No BufferGeometryUtils needed (not vendored) — we concatenate non-indexed buffers directly.
// Materials: shared vertex-color variants built from the Foundation toonRamp().
// (CHANGE_REQUEST: Toon.js could export toonVertexMat()/flatVertexMat(); we define them here.)
import * as THREE from '../../../vendor/three.module.js';
import { toonRamp } from '../../core/Toon.js';

let _toonV = null, _flatV = null;
/** Shared MeshToonMaterial with vertexColors (same 3-step ramp as toonMat). */
export function toonVertexMat() {
  if (!_toonV) _toonV = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp(), vertexColors: true });
  return _toonV;
}
/** Shared unlit vertex-color material for glowing parts (lantern glass, Spark coins). */
export function flatVertexMat() {
  if (!_flatV) _flatV = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
  return _flatV;
}

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _c = new THREE.Color();

/**
 * Merge every Mesh under `root` into at most two meshes (toon / flat), positioned in root's
 * local space. Source meshes are NOT disposed (their geometries are shared/cached).
 * @param {THREE.Object3D} root
 * @param {{ keep?: (mesh)=>boolean }} opts  keep(mesh) → true to leave a mesh un-merged (animated parts)
 * @returns {THREE.Group} new group containing merged meshes (+ kept meshes re-parented)
 */
export function mergeGroup(root, opts = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = { toon: { pos: [], nor: [], col: [], count: 0 }, flat: { pos: [], nor: [], col: [], count: 0 } };
  const kept = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    if (opts.keep && opts.keep(o)) { kept.push(o); return; }
    const mat = o.material;
    const b = mat.isMeshBasicMaterial ? buckets.flat : buckets.toon;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    _m.multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(_m);
    const p = g.attributes.position, n = g.attributes.normal;
    _c.copy(mat.color || 0xffffff);
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    b.pos.push(p.array); b.nor.push(n ? n.array : new Float32Array(p.count * 3)); b.col.push(col); b.count += p.count;
    g.dispose();
  });
  const out = new THREE.Group();
  for (const key of ['toon', 'flat']) {
    const b = buckets[key];
    if (!b.count) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(concat(b.pos, b.count * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(concat(b.nor, b.count * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(concat(b.col, b.count * 3), 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, key === 'toon' ? toonVertexMat() : flatVertexMat());
    mesh.name = 'merged_' + key;
    mesh.castShadow = key === 'toon'; mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const k of kept) {
    // re-parent keeping world transform relative to root
    k.updateMatrixWorld(true);
    _m.multiplyMatrices(inv, k.matrixWorld);
    k.removeFromParent();
    _m.decompose(k.position, k.quaternion, k.scale);
    out.add(k);
  }
  return out;
}

function concat(arrays, total) {
  const out = new Float32Array(total); let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

/** Dispose merged geometries under a group (call when swapping level parts). */
export function disposeMerged(group) {
  group.traverse((o) => { if (o.isMesh && o.name.startsWith('merged_')) o.geometry.dispose(); });
}
