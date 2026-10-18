// Chat 10A — static batching for the integrated world.
// A zone full of rocks, fences, crates and trees costs 2–6 draw calls PER PROP (mesh + outline hull each).
// bakeStatic() merges every mesh of a list of already-placed props into ONE vertex-colored toon mesh
// (+ ONE flat mesh for glowing parts) + their two outline hulls → ≤ 4 draw calls for the whole batch.
//
// Differences from props/merge.js mergeGroup() (which bakes the *inside* of one prop at build time):
//   · honours an existing `color` vertex attribute (props are already merged → vertex-colored), so
//     re-baking a baked prop keeps its colors (mergeGroup would paint it white);
//   · bakes in the PARENT's space (zone group), so the batch rises with Island.unlockZone();
//   · skips InstancedMesh (flower/tuft fields), outline hulls and anything with userData.live;
//   · the source props are removed from the scene (and their swayers disposed) — the batch is static.
// Use only for props with NO per-frame animation worth keeping at game zoom: rocks, fences, crates,
// barrels, benches, board/arrow signs, path tiles, pots, troughs, cliff walls, (trees/bushes if you
// accept losing the ±0.03 rad crown sway — 10A does, 11A may keep 2–3 "hero" trees live).
import * as THREE from '../../../vendor/three.module.js';
import { addOutline } from '../../core/Outline.js';
import { toonVertexMat, flatVertexMat } from './merge.js';

const _m = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * @param {THREE.Object3D[]} props   placed prop groups (any parent; world transform is used)
 * @param {{ parent: THREE.Object3D, outline?: boolean, name?: string, dispose?: boolean }} opts
 *        parent  — group that receives the baked meshes (e.g. island.zones[i].group)
 *        dispose — call prop.userData.dispose() on each source (default true; unregisters 1B/1D swayers)
 * @returns {THREE.Group} the batch (userData.count = props baked, userData.meshes = 1–2 + hulls)
 */
export function bakeStatic(props, opts = {}) {
  const parent = opts.parent;
  if (!parent) throw new Error('[bake] opts.parent is required');
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const buckets = { toon: { pos: [], nor: [], col: [], count: 0 }, flat: { pos: [], nor: [], col: [], count: 0 } };
  let baked = 0;
  for (const prop of props) {
    if (!prop) continue;
    prop.updateMatrixWorld(true);
    prop.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.isOutline || o.userData.live) return;
      if (!o.visible) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const b = mat.isMeshBasicMaterial ? buckets.flat : buckets.toon;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      _m.multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(_m);
      const p = g.attributes.position, n = g.attributes.normal, vc = g.attributes.color;
      const col = new Float32Array(p.count * 3);
      if (vc && mat.vertexColors) {
        for (let i = 0; i < p.count; i++) { col[i * 3] = vc.getX(i); col[i * 3 + 1] = vc.getY(i); col[i * 3 + 2] = vc.getZ(i); }
      } else {
        _c.copy(mat.color || 0xffffff);
        for (let i = 0; i < p.count; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
      }
      b.pos.push(p.array); b.nor.push(n ? n.array : new Float32Array(p.count * 3)); b.col.push(col); b.count += p.count;
      g.dispose();
    });
    baked++;
  }
  const out = new THREE.Group(); out.name = opts.name || 'static_batch';
  for (const key of ['toon', 'flat']) {
    const b = buckets[key];
    if (!b.count) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(concat(b.pos, b.count * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(concat(b.nor, b.count * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(concat(b.col, b.count * 3), 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, key === 'toon' ? toonVertexMat() : flatVertexMat());
    mesh.name = 'baked_' + key;
    mesh.castShadow = key === 'toon'; mesh.receiveShadow = true;
    if (key === 'flat') mesh.userData.noOutline = true;
    out.add(mesh);
  }
  if (opts.outline !== false) addOutline(out);
  // remove the sources
  for (const prop of props) {
    if (!prop) continue;
    if (opts.dispose !== false && typeof prop.userData.dispose === 'function') { try { prop.userData.dispose(); } catch (_) { /* noop */ } }
    prop.removeFromParent();
  }
  let meshes = 0; out.traverse((o) => { if (o.isMesh) meshes++; });
  out.userData.count = baked; out.userData.meshes = meshes; out.userData.isStaticBatch = true;
  parent.add(out);
  return out;
}

/** Dispose a batch made by bakeStatic (geometries only; materials are shared). */
export function disposeBatch(batch) {
  batch.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.geometry.dispose(); });
  batch.removeFromParent();
}

function concat(arrays, total) {
  const out = new Float32Array(total); let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
