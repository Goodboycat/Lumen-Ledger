// Chat 1C — Landmarks: lighthouse (3 states), Pip's cottage, pier, bridge, Baron's fog towers,
// cliff walls, waterfall strip. Every prop: makeX(opts) → THREE.Group, pivot at BASE (y=0),
// baked with mergeGroup (1–3 meshes + outline hulls), toon + outline. Animated parts are kept
// un-merged (lamp, beam, chimney puffs, water sheet) and driven by group.userData.update(dt).
//
// Contract (API_CONTRACTS §B "Landmarks"):
//   export const LANDMARK_PROPS = { lighthouse: { make, footprint:[3,3], category:'landmark', name, cost }, ... }
//   makeLighthouse(opts) → Group  with userData.setState('dark'|'flicker'|'lit'), .state, .update(dt), .lampPos (local Vector3)
//   makeCottage(), makePier({length}), makeBridge({length}), makeFogTower({seed}), makeCliffWall({length}), makeWaterfall({height})
//   All groups: userData.update(dt) (no-op when static), .footprint, .category, .name, .kind, .dispose()
// opts for every makeX: { seed?, scale?, outline? (default true) }
import * as THREE from '../../../vendor/three.module.js';
import { G, mesh, group, rng, vary } from '../geo.js';
import { PALETTE as P, toonMat, flatMat } from '../../core/Toon.js';
import { addOutline } from '../../core/Outline.js';
import { mergeGroup } from './merge.js';
import { Easing } from '../../anim/Easing.js';

export const LANDMARK_COLORS = {
  towerWhite: 0xfff8e7, towerRed: 0xef5350, towerDark: 0x455a64, lampGlass: 0xb3e5fc, lampOff: 0x90a4ae,
  lampOn: 0xfff176, beam: 0xfff3b0, roofBlue: 0x3e6fb0, roofRed: 0xd84315,
  wallCream: 0xffe9c4, wallWood: P.wood, doorWood: P.woodDark, windowGlow: 0xffd54f, chimney: 0x8d6e63,
  plank: 0xc29a6b, plankDark: 0xa1704a, post: 0x6d4a30, rope: 0xe0c9a6,
  fogStone: 0x5e4a86, fogStoneDark: 0x4a3570, fogRoof: 0x37254f, fogGlow: 0xb388ff, fog: P.debtFog,
  cliff: 0xb09a8a, cliffDark: 0x8d7b6e, grassTop: P.grass, water: P.water, foam: 0xe8fbff,
};
const C = LANDMARK_COLORS;

// ---------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------
const _updaters = new Set();
/** Drive every landmark's animation in one call (or call group.userData.update(dt) per prop). */
export function updateLandmarks(dt) { for (const u of _updaters) u(dt); }

/** Bake `raw` (static part) + attach `live` (un-merged animated parts) into one finished prop group. */
function finish(raw, kind, opts, { footprint = [1, 1], name = kind, live = [], update = null, extra = {} } = {}) {
  const out = new THREE.Group();
  const baked = mergeGroup(raw); baked.name = 'baked'; out.add(baked);
  for (const l of live) out.add(l);
  out.scale.setScalar(opts.scale ?? 1);
  out.name = kind;
  Object.assign(out.userData, { kind, name, footprint, category: 'landmark', update: update || (() => {}), dispose: () => { if (update) _updaters.delete(update); } }, extra);
  if (update) _updaters.add(update);
  if (opts.outline !== false) addOutline(out);
  return out;
}
function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 8) { return mesh(G.cyl(rt, rb, h, seg), color, x, y + h / 2, z); }
function box(w, h, d, color, x = 0, y = 0, z = 0) { return mesh(G.box(w, h, d), color, x, y + h / 2, z); }

// ---------------------------------------------------------------------------------------
// LIGHTHOUSE — the win condition. States: dark → flicker → lit.
// Timing (lit): lamp pop 0 → 1.25 scale over 260 ms outBack, beam fade-in 400 ms, rotation 0.6 rad/s.
// Flicker: lamp opacity = step noise (on 70 % of the time, 90–220 ms segments).
// ---------------------------------------------------------------------------------------
export function makeLighthouse(opts = {}) {
  const r = rng((opts.seed ?? 1) * 101 + 5);
  const raw = group();
  // rocky base
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + r() * 0.4, d = 1.1 + r() * 0.35, s = 0.35 + r() * 0.25; const k = mesh(G.dodeca(s), i % 2 ? P.stone : P.stoneDark, Math.cos(a) * d, s * 0.4, Math.sin(a) * d); k.rotation.set(r(), r(), r()); k.scale.set(1.3, 0.7, 1); raw.add(k); }
  raw.add(cyl(1.15, 1.3, 0.35, P.stoneDark, 0, 0, 0, 10));
  // tower with red bands
  const H = 4.6;
  raw.add(cyl(0.62, 0.9, H, C.towerWhite, 0, 0.35, 0, 10));
  for (let i = 0; i < 3; i++) { const y = 0.35 + 0.5 + i * 1.35, t = (y - 0.35) / H; raw.add(cyl(0.9 - 0.28 * t + 0.03, 0.9 - 0.28 * (t - 0.09) + 0.03, 0.42, C.towerRed, 0, y, 0, 10)); }
  // door + windows
  raw.add(box(0.5, 0.75, 0.2, C.doorWood, 0, 0.36, 0.85));
  raw.add(box(0.26, 0.32, 0.14, C.lampGlass, 0, 2.2, 0.72));
  raw.add(box(0.26, 0.32, 0.14, C.lampGlass, 0, 3.4, 0.64));
  // gallery
  raw.add(cyl(0.95, 0.82, 0.22, C.towerDark, 0, H + 0.35, 0, 10));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; raw.add(cyl(0.035, 0.035, 0.5, C.towerDark, Math.cos(a) * 0.9, H + 0.57, Math.sin(a) * 0.9, 4)); }
  raw.add(mesh(G.torus(0.9, 0.035, 5, 12), C.towerDark, 0, H + 1.05, 0)).rotation.x = Math.PI / 2;
  // lamp room frame + roof
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; raw.add(cyl(0.04, 0.04, 0.8, C.towerDark, Math.cos(a) * 0.55, H + 0.57, Math.sin(a) * 0.55, 4)); }
  raw.add(mesh(G.cone(0.78, 0.7, 8), C.towerRed, 0, H + 1.37 + 0.35, 0));
  raw.add(mesh(G.sphere(0.12, 6, 4), C.sparkGold ?? P.sparkGold, 0, H + 2.1, 0));
  // --- live parts
  const lampY = H + 0.97;
  const lamp = new THREE.Mesh(G.sphere(0.36, 10, 7), flatMat(C.lampOff));
  lamp.position.y = lampY; lamp.name = 'lamp'; lamp.castShadow = false;
  const glass = new THREE.Mesh(G.cyl(0.56, 0.56, 0.78, 6), toonMat(C.lampGlass, { transparent: true, opacity: 0.35 }));
  glass.position.y = lampY; glass.userData.noOutline = true; glass.castShadow = false;
  // beam: additive cone pointing +z, pivot at lamp, child of a rotating pivot
  const beamPivot = new THREE.Group(); beamPivot.position.y = lampY;
  const beamGeo = G.cone(1.3, 9, 10);
  const beamMat = flatMat(C.beam, { transparent: true, opacity: 0, additive: true, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.rotation.x = -Math.PI / 2; beam.position.z = 4.5; beam.userData.noOutline = true; beam.castShadow = false; beam.frustumCulled = false;
  const beam2 = new THREE.Mesh(beamGeo, beamMat); beam2.rotation.x = Math.PI / 2; beam2.position.z = -4.5; beam2.userData.noOutline = true; beam2.castShadow = false; beam2.frustumCulled = false;
  beamPivot.add(beam, beam2); beamPivot.visible = false;
  const halo = new THREE.Mesh(G.sphere(0.7, 10, 7), flatMat(C.lampOn, { transparent: true, opacity: 0, additive: true, depthWrite: false }));
  halo.position.y = lampY; halo.userData.noOutline = true; halo.visible = false;

  const st = { state: 'dark', t: 0, flickT: 0, flickOn: false, litT: 0 };
  const lampOn = new THREE.Color(C.lampOn), lampOff = new THREE.Color(C.lampOff);
  const update = (dt) => {
    st.t += dt;
    if (st.state === 'flicker') {
      st.flickT -= dt;
      if (st.flickT <= 0) { st.flickOn = Math.random() < 0.7; st.flickT = 0.09 + Math.random() * 0.13; lamp.material.color.copy(st.flickOn ? lampOn : lampOff); }
      lamp.scale.setScalar(st.flickOn ? 1.1 : 1);
      halo.visible = st.flickOn; halo.material.opacity = st.flickOn ? 0.25 : 0;
    } else if (st.state === 'lit') {
      st.litT = Math.min(1, st.litT + dt / 0.4);
      const pop = Easing.outBack(Math.min(1, st.litT * 1.5));
      lamp.scale.setScalar(1 + 0.25 * pop);
      beamMat.opacity = 0.22 * Easing.outCubic(st.litT);
      halo.material.opacity = (0.35 + Math.sin(st.t * 3) * 0.08) * st.litT;
      halo.scale.setScalar(1 + Math.sin(st.t * 3) * 0.08);
      beamPivot.rotation.y += dt * 0.6;
    }
  };
  const setState = (s) => {
    if (!['dark', 'flicker', 'lit'].includes(s)) return;
    st.state = s; st.litT = 0; st.flickT = 0;
    lamp.material.color.copy(s === 'dark' ? lampOff : lampOn);
    lamp.scale.setScalar(1);
    beamPivot.visible = s === 'lit'; halo.visible = s !== 'dark';
    if (s !== 'lit') beamMat.opacity = 0;
    if (s === 'dark') halo.material.opacity = 0;
    out.userData.state = s;
  };
  const out = finish(raw, 'lighthouse', opts, { footprint: [3, 3], name: 'Lighthouse', live: [lamp, glass, halo, beamPivot], update,
    extra: { setState, state: 'dark', lampPos: new THREE.Vector3(0, lampY, 0), lamp, beamPivot } });
  setState(opts.state || 'dark');
  return out;
}

// ---------------------------------------------------------------------------------------
// PIP'S COTTAGE — chunky toy house, smoking chimney, glowing window at night (userData.setLit)
// ---------------------------------------------------------------------------------------
export function makeCottage(opts = {}) {
  const r = rng((opts.seed ?? 1) * 77 + 1);
  const raw = group();
  raw.add(box(2.6, 0.25, 2.2, P.stoneDark, 0, 0, 0));
  raw.add(box(2.3, 1.5, 1.9, C.wallCream, 0, 0.25, 0));
  // timber frame
  for (const x of [-1.1, 0, 1.1]) raw.add(box(0.12, 1.5, 0.1, C.wallWood, x, 0.25, 0.98));
  raw.add(box(2.3, 0.12, 0.1, C.wallWood, 0, 1.63, 0.98));
  // door + window
  raw.add(box(0.55, 0.9, 0.12, C.doorWood, -0.6, 0.25, 1.0));
  raw.add(mesh(G.sphere(0.05, 6, 4), P.sparkGold, -0.42, 0.72, 1.07));
  const win = box(0.5, 0.45, 0.12, C.lampGlass, 0.6, 0.75, 1.0); raw.add(win);
  raw.add(box(0.06, 0.45, 0.14, C.wallWood, 0.6, 0.75, 1.01)); raw.add(box(0.5, 0.06, 0.14, C.wallWood, 0.6, 0.95, 1.01));
  // roof (two slabs) + ridge + chimney
  const roofL = box(1.55, 0.18, 2.4, C.roofBlue, -0.6, 1.75, 0); roofL.rotation.z = 0.78; roofL.position.set(-0.62, 2.2, 0); raw.add(roofL);
  const roofR = box(1.55, 0.18, 2.4, C.roofBlue, 0.6, 1.75, 0); roofR.rotation.z = -0.78; roofR.position.set(0.62, 2.2, 0); raw.add(roofR);
  raw.add(box(2.4, 0.9, 0.08, C.wallCream, 0, 1.73, 0)).scale.set(1, 1, 1);
  const gableF = mesh(G.cone(0.85, 0.75, 4), C.wallCream, 0, 2.1, 0.92); gableF.rotation.y = Math.PI / 4; gableF.scale.set(1.9, 1, 0.1); raw.add(gableF);
  const gableB = gableF.clone(); gableB.position.z = -0.92; raw.add(gableB);
  raw.add(box(0.22, 0.18, 2.5, C.roofBlue, 0, 2.62, 0));
  raw.add(box(0.4, 0.9, 0.4, C.chimney, 0.65, 2.1, -0.5));
  raw.add(box(0.5, 0.12, 0.5, P.stoneDark, 0.65, 3.0, -0.5));
  // flower boxes + step
  raw.add(box(0.6, 0.15, 0.2, C.wallWood, 0.6, 0.55, 1.08));
  for (let i = 0; i < 3; i++) raw.add(mesh(G.sphere(0.08, 6, 4), [P.glimmerPink, P.glimmerYellow, P.red][i], 0.42 + i * 0.18, 0.76, 1.1));
  raw.add(box(0.7, 0.1, 0.4, P.stone, -0.6, 0, 1.25));
  // live: window glow + chimney smoke (3 pooled puffs)
  const glow = new THREE.Mesh(G.box(0.46, 0.41, 0.06), flatMat(C.windowGlow)); glow.position.set(0.6, 0.975, 1.08); glow.visible = false; glow.userData.noOutline = true;
  const puffs = []; const smokeMat = new THREE.MeshToonMaterial({ color: 0xfafafa, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(G.sphere(0.5, 6, 4), smokeMat); p.userData.noOutline = true; p.castShadow = false; p.userData.life = i / 3; puffs.push(p); }
  const update = (dt) => {
    for (const p of puffs) {
      p.userData.life += dt / 2.4; if (p.userData.life > 1) p.userData.life -= 1;
      const t = p.userData.life; p.position.set(0.65 + Math.sin(t * 6) * 0.15, 3.1 + t * 1.6, -0.5 + t * 0.4); p.scale.setScalar(0.18 + t * 0.35);
      p.material.opacity = 0.55 * (1 - Easing.inCubic(t));
    }
  };
  return finish(raw, 'cottage', opts, { footprint: [3, 3], name: "Pip's Cottage", live: [glow, ...puffs], update,
    extra: { setLit: (on) => { glow.visible = !!on; } } });
}

// ---------------------------------------------------------------------------------------
// PIER — planks over water along +x from the shore. length in tiles. Pivot at the shore end (x=0).
// ---------------------------------------------------------------------------------------
export function makePier(opts = {}) {
  const len = opts.length ?? 4, r = rng((opts.seed ?? 1) * 13 + 7);
  const raw = group();
  for (let i = 0; i < len * 3; i++) { const p = box(0.33, 0.1, 1.3, i % 3 === 1 ? C.plank : vary(C.plank, 0.06, r), 0.17 + i * 0.335, 0.05, 0); p.rotation.y = (r() - 0.5) * 0.04; raw.add(p); }
  for (let i = 0; i <= len; i += 1) for (const z of [-0.55, 0.55]) { raw.add(cyl(0.07, 0.08, 1.5, C.post, i + 0.05, -1.1, z, 6)); raw.add(cyl(0.09, 0.09, 0.08, C.post, i + 0.05, 0.4, z, 6)); }
  for (const z of [-0.55, 0.55]) raw.add(box(len, 0.05, 0.05, C.rope, len / 2 + 0.05, 0.32, z));
  // lantern on the far end + mooring bollard
  raw.add(cyl(0.05, 0.05, 1.1, C.post, len - 0.1, 0.15, 0.55, 5));
  raw.add(box(0.22, 0.26, 0.22, P.metalDark, len - 0.1, 1.25, 0.55));
  const lan = new THREE.Mesh(G.box(0.16, 0.18, 0.16), flatMat(P.sparkGold)); lan.position.set(len - 0.1, 1.38, 0.55);
  raw.add(cyl(0.1, 0.12, 0.28, P.metalDark, len - 0.3, 0.15, -0.5, 6));
  // tiny boat
  const boat = group(); boat.name = 'boat';
  const hull = mesh(G.sphere(0.55, 8, 5), C.roofRed, 0, 0, 0); hull.scale.set(1.3, 0.45, 0.8); boat.add(hull);
  boat.add(box(0.9, 0.12, 0.5, C.plank, 0, 0.12, 0));
  boat.add(cyl(0.03, 0.03, 0.9, C.post, 0, 0.18, 0, 4)); boat.add(box(0.02, 0.6, 0.45, C.towerWhite, 0.02, 0.4, 0.2));
  const boatM = mergeGroup(boat); boatM.position.set(len - 0.3, -0.75, -1.3);
  const update = (dt) => { boatM.userData.t = (boatM.userData.t || 0) + dt; boatM.position.y = -0.78 + Math.sin(boatM.userData.t * 1.3) * 0.05; boatM.rotation.z = Math.sin(boatM.userData.t * 1.1) * 0.05; boatM.rotation.x = Math.cos(boatM.userData.t * 0.9) * 0.04; };
  return finish(raw, 'pier', opts, { footprint: [len, 1], name: 'Pier', live: [lan, boatM], update });
}

// ---------------------------------------------------------------------------------------
// BRIDGE — spans +x, centered at origin, length in tiles. Rope rails, slight arch. (used by Island v2)
// ---------------------------------------------------------------------------------------
export function makeBridge(opts = {}) {
  const len = opts.length ?? 4, r = rng((opts.seed ?? 1) * 17 + 3);
  const raw = group();
  const n = Math.round(len * 3);
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n * len - len / 2, arch = Math.sin((i + 0.5) / n * Math.PI) * 0.25;
    const p = box(len / n * 0.92, 0.1, 1.4, i % 2 ? C.plank : vary(C.plankDark, 0.05, r), x, arch - 0.02, 0);
    p.rotation.z = -Math.cos((i + 0.5) / n * Math.PI) * 0.18; raw.add(p);
  }
  for (const x of [-len / 2 + 0.1, len / 2 - 0.1]) for (const z of [-0.62, 0.62]) { raw.add(cyl(0.08, 0.09, 1.0, C.post, x, 0, z, 6)); raw.add(mesh(G.sphere(0.1, 6, 4), C.post, x, 1.0, z)); }
  for (const z of [-0.62, 0.62]) { const rope = box(len - 0.2, 0.05, 0.05, C.rope, 0, 0.7, z); raw.add(rope); const rope2 = box(len - 0.2, 0.04, 0.04, C.rope, 0, 0.4, z); raw.add(rope2); }
  for (let i = 1; i < len; i++) for (const z of [-0.62, 0.62]) raw.add(cyl(0.025, 0.025, 0.65, C.rope, i - len / 2, 0.1, z, 4));
  return finish(raw, 'bridge', opts, { footprint: [len, 1], name: 'Bridge' });
}

// ---------------------------------------------------------------------------------------
// BARON'S FOG TOWER — crooked purple tower; chimney puffs Debt Fog spheres (pool of 5).
// userData.setActive(bool) stops the fog (zone cleansed). seed changes the lean / height.
// ---------------------------------------------------------------------------------------
export function makeFogTower(opts = {}) {
  const r = rng((opts.seed ?? 1) * 23 + 11);
  const raw = group();
  const H = 3 + r() * 1.2, lean = 0.08 + r() * 0.08, dir = r() * Math.PI * 2;
  raw.add(cyl(1.0, 1.2, 0.3, C.fogStoneDark, 0, 0, 0, 7));
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const t = i / segs, h = H / segs, w = 0.8 - 0.25 * t;
    const s = mesh(G.box(w * 2, h, w * 2), i % 2 ? C.fogStone : C.fogStoneDark, Math.cos(dir) * lean * i * h, 0.3 + i * h + h / 2, Math.sin(dir) * lean * i * h);
    s.rotation.y = t * 0.6; s.rotation.z = Math.cos(dir) * lean * 0.6; s.rotation.x = -Math.sin(dir) * lean * 0.6; raw.add(s);
  }
  const topX = Math.cos(dir) * lean * segs * (H / segs), topZ = Math.sin(dir) * lean * segs * (H / segs);
  const roof = mesh(G.cone(0.95, 1.2, 5), C.fogRoof, topX, H + 0.3 + 0.6, topZ); roof.rotation.y = 0.3; raw.add(roof);
  // window slits (glowing) + chains
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; raw.add(box(0.14, 0.4, 0.14, C.fogGlow, Math.cos(a) * 0.62 + topX * 0.5, 1.2 + i * 0.8, Math.sin(a) * 0.62 + topZ * 0.5)); }
  const chimney = box(0.36, 0.7, 0.36, C.fogStoneDark, topX + 0.35, H + 0.35, topZ - 0.2); raw.add(chimney);
  // live: fog puffs rising from the chimney
  const puffs = []; const fogMat = new THREE.MeshToonMaterial({ color: C.fog, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(G.sphere(0.5, 7, 5), fogMat); p.userData.noOutline = true; p.castShadow = false; p.userData.life = i / 5; p.userData.ph = r() * 6; puffs.push(p); }
  const st = { active: true };
  const update = (dt) => {
    for (const p of puffs) {
      if (st.active || p.userData.life > 0) p.userData.life += dt / 3; else continue;
      if (p.userData.life > 1) { p.userData.life = st.active ? p.userData.life - 1 : 0; p.visible = st.active; }
      const t = p.userData.life;
      p.position.set(topX + 0.35 + Math.sin(t * 5 + p.userData.ph) * 0.3, H + 1.1 + t * 2.2, topZ - 0.2 + Math.cos(t * 4 + p.userData.ph) * 0.3);
      p.scale.setScalar(0.3 + t * 0.9); p.material.opacity = 0.5 * (1 - Easing.inQuad(t));
    }
  };
  return finish(raw, 'fog_tower', opts, { footprint: [2, 2], name: 'Fog Tower', live: puffs, update,
    extra: { setActive: (on) => { st.active = !!on; }, isActive: () => st.active } });
}

// ---------------------------------------------------------------------------------------
// CLIFF WALL — a row of chunky cliff blocks with grass caps, spans +x, length in tiles (decor / zone edge).
// ---------------------------------------------------------------------------------------
export function makeCliffWall(opts = {}) {
  const len = opts.length ?? 4, r = rng((opts.seed ?? 1) * 29 + 9);
  const raw = group();
  for (let i = 0; i < len; i++) {
    const x = i - len / 2 + 0.5, h = 1.2 + r() * 0.8, w = 0.9 + r() * 0.2;
    const b = box(w, h, 0.9, r() < 0.5 ? C.cliff : C.cliffDark, x, 0, 0); b.rotation.y = (r() - 0.5) * 0.15; raw.add(b);
    raw.add(box(w * 1.05, 0.22, 0.95, C.grassTop, x, h - 0.05, 0));
    if (r() < 0.5) { const k = mesh(G.dodeca(0.22 + r() * 0.15), P.stone, x + (r() - 0.5) * 0.5, h + 0.2, (r() - 0.5) * 0.4); k.rotation.set(r(), r(), r()); raw.add(k); }
  }
  return finish(raw, 'cliff_wall', opts, { footprint: [len, 1], name: 'Cliff Wall' });
}

// ---------------------------------------------------------------------------------------
// WATERFALL — vertical water strip (scrolling vertex offset via stacked quads) + splash foam.
// height in units; pivot at the pool (y=0). Faces +z.
// ---------------------------------------------------------------------------------------
export function makeWaterfall(opts = {}) {
  const h = opts.height ?? 2.5, w = opts.width ?? 1.2;
  const raw = group();
  raw.add(box(w + 0.8, 0.3, 0.8, C.cliffDark, 0, h - 0.3, -0.3)); // lip
  raw.add(box(w + 1.0, 0.15, 1.4, C.water, 0, -0.12, 0.6)); // pool
  const sheet = new THREE.Group();
  const stripes = []; const n = 5;
  for (let i = 0; i < n; i++) { const s = new THREE.Mesh(G.box(w, h / n, 0.18), toonMat(i % 2 ? C.water : 0x80e0ec, { transparent: true, opacity: 0.85 })); s.position.set(0, h - (i + 0.5) * (h / n), 0); s.userData.noOutline = true; s.castShadow = false; sheet.add(s); stripes.push(s); }
  const foams = []; const fm = flatMat(C.foam, { transparent: true, opacity: 0.8 });
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(G.sphere(0.2, 6, 4), fm); f.userData.noOutline = true; f.userData.ph = i * 1.7; foams.push(f); }
  let t = 0;
  const update = (dt) => {
    t += dt;
    stripes.forEach((s, i) => { const off = ((t * 1.8 + i / n) % 1); s.position.y = h - off * h; s.scale.y = 1 - Math.abs(off - 0.5) * 0.3; });
    foams.forEach((f) => { const p = (t * 1.2 + f.userData.ph) % 1; f.position.set(Math.sin(f.userData.ph * 3) * w * 0.45, 0.05 + Math.sin(p * Math.PI) * 0.35, 0.3 + p * 0.5); f.scale.setScalar(0.6 + Math.sin(p * Math.PI) * 0.7); });
  };
  return finish(raw, 'waterfall', opts, { footprint: [2, 2], name: 'Waterfall', live: [sheet, ...foams], update });
}

// ---------------------------------------------------------------------------------------
// CATALOG
// ---------------------------------------------------------------------------------------
const entry = (make, name, footprint, cost = 0) => ({ make, footprint, category: 'landmark', name, cost, tris: 0 });
export const LANDMARK_PROPS = {
  lighthouse: entry(makeLighthouse, 'Lighthouse', [3, 3], 0),
  cottage:    entry(makeCottage, "Pip's Cottage", [3, 3], 0),
  pier:       entry(makePier, 'Pier', [4, 1], 60),
  bridge:     entry(makeBridge, 'Bridge', [4, 1], 80),
  fog_tower:  entry(makeFogTower, 'Fog Tower', [2, 2], 0),
  cliff_wall: entry(makeCliffWall, 'Cliff Wall', [4, 1], 20),
  waterfall:  entry(makeWaterfall, 'Waterfall', [2, 2], 120),
};
export const LANDMARK_IDS = Object.keys(LANDMARK_PROPS);
