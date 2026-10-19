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
  const buckets = newBuckets();
  let baked = 0;
  for (const prop of props) {
    if (!prop) continue;
    prop.updateMatrixWorld(true);
    prop.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.isOutline || o.userData.live) return;
      if (!o.visible) return;
      bakeMesh(o, inv, buckets);
    });
    baked++;
  }
  const out = finishBatch(buckets, parent, opts, baked);
  // remove the sources
  for (const prop of props) {
    if (!prop) continue;
    if (opts.dispose !== false && typeof prop.userData.dispose === 'function') { try { prop.userData.dispose(); } catch (_) { /* noop */ } }
    prop.removeFromParent();
  }
  return out;
}

/**
 * 11A perf (Lever 2) — bake only the STATIC SHELL of "live" props (lanterns, jars, landmarks, hanging signs,
 * banners) into one batch and leave the animated parts in place. The prop group stays in the scene (its
 * userData.setLit / setFill / update / sway keep working); only its static merged meshes (+ hulls) are removed
 * and re-baked into `parent` space. What counts as static: any mesh that is NOT under a `keep` match.
 * Default `isLive(mesh)`: unlit/flat meshes (glass, glow, lamp, sheet, foam), anything whose ancestor chain
 * (below the prop) contains a group named 'swing' | 'flags' | 'live' | 'boat' or is flagged userData.live.
 * Returns the batch (or null when nothing was baked). A mesh that was baked is set `visible=false` and flagged
 * `userData.bakedAway=true` (so it can be restored by restoreShells()).
 * @param {THREE.Object3D[]} props   placed, live prop groups (NOT removed)
 * @param {{ parent: THREE.Object3D, name?: string, outline?: boolean, isLive?: (mesh, prop)=>boolean }} opts
 */
export function bakeShells(props, opts = {}) {
  const parent = opts.parent;
  if (!parent) throw new Error('[bake] opts.parent is required');
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const isLive = opts.isLive || defaultIsLive;
  const buckets = newBuckets();
  let baked = 0;
  for (const prop of props) {
    if (!prop || prop.userData.shellBaked) continue;
    prop.updateMatrixWorld(true);
    const away = [];
    prop.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.isOutline || !o.visible) return;
      if (isLive(o, prop)) return;
      bakeMesh(o, inv, buckets); away.push(o);
    });
    if (!away.length) continue;
    for (const o of away) { o.visible = false; o.userData.bakedAway = true; }
    prop.userData.shellBaked = true; baked++;
  }
  if (!baked) return null;
  return finishBatch(buckets, parent, { ...opts, name: opts.name || 'shell_batch' }, baked);
}

/** Undo bakeShells() for the given props (e.g. before a level swap / demolish). Dispose the batch yourself. */
export function restoreShells(props) {
  for (const prop of props) {
    if (!prop || !prop.userData.shellBaked) continue;
    prop.traverse((o) => { if (o.userData.bakedAway) { o.visible = true; delete o.userData.bakedAway; } });
    delete prop.userData.shellBaked;
  }
}

const LIVE_GROUPS = new Set(['swing', 'flags', 'live', 'boat']);
const LIVE_NAMES = new Set(['glass', 'glow', 'lamp', 'sheet', 'halo', 'beam']);
function defaultIsLive(o, prop) {
  if (o.userData.live || LIVE_NAMES.has(o.name)) return true;
  if (prop.userData.category === 'landmark') {                // 1C: static part is always under the group named 'baked'
    for (let p = o.parent; p && p !== prop; p = p.parent) if (p.name === 'baked') return false;
    return true;
  }
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!mat || !mat.isMeshToonMaterial || mat.transparent) return true;   // flat / shader / glass → glowing or animated → keep live
  for (let p = o.parent; p && p !== prop; p = p.parent) { if (p.userData.live || LIVE_GROUPS.has(p.name)) return true; }
  return false;
}

/** Dispose a batch made by bakeStatic (geometries only; materials are shared). */
export function disposeBatch(batch) {
  batch.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.geometry.dispose(); });
  batch.removeFromParent();
}

/** Append one mesh (world → `inv` space) to the toon/flat buckets, honouring vertex colors. */
function bakeMesh(o, inv, buckets) {
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
}

function newBuckets() { return { toon: { pos: [], nor: [], col: [], count: 0 }, flat: { pos: [], nor: [], col: [], count: 0 } }; }

/** Build the batch group (1–2 meshes + hulls) from filled buckets, in `parent`. */
function finishBatch(buckets, parent, opts, baked) {
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
  let meshes = 0; out.traverse((o) => { if (o.isMesh) meshes++; });
  out.userData.count = baked; out.userData.meshes = meshes; out.userData.isStaticBatch = true;
  parent.add(out);
  return out;
}

function concat(arrays, total) {
  const out = new Float32Array(total); let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
