// Island v2 (Chat 1C) — zoned island with ONE merged ground mesh per zone.
// Foundation v1 drew every grass cube / tuft / flower as separate instanced + outlined meshes and the
// path as ~60 individual decals (~200 draw calls). v2 bakes grass tops + cliff sides + path decals of a
// zone into ONE vertex-colored toon mesh (+1 outline hull) and keeps tufts / flowers / foam as ONE
// InstancedMesh each → 5 draw calls per zone, ~21 for the whole 4-zone island (sea included).
//
// Kept from v1 (every existing export / field still works):
//   new Island({ radius, tile, seed })  island.group  island.tiles (Map "x,z"→0, UNLOCKED land only)
//   island.isLand(x,z)  island.update(dt)  island.grass / tuftMesh / sea / foam  makeTree(r) makeRock(r)
// New (API_CONTRACTS §B "Island v2"):
//   opts: { lobes = 3, lobeRadius = 6, channel = 2, zonesUnlocked = 1, starterProps = true, bridges = true }
//   island.zones = [{ id, index, center:{x,z}, radius, unlocked, group, cells:[{x,z}], bridge }]
//   island.unlockZone(i, { game, vfx }) → Sequence | null   (anticipation 200 → rise 500 outBack → settle 150)
//   island.isLand(x,z) honors zones (locked zones are water)   island.gridCells() → [{x,z}] unlocked cells
//   island.zoneAt(x,z) → zone index | -1    island.nextLockedZone() → zone | null    island.unlockAll()
//   island.pathCells (Set "x,z") — dirt path cells (Chat 5: do not place stalls on them)
//   island.landEdge(dirX, dirZ) → {x,z} last land cell walking from origin in that direction (for the pier)
import * as THREE from '../../vendor/three.module.js';
import { G, mesh, rng, vary } from '../assets/geo.js';
import { PALETTE as P, toonMat, flatMat } from '../core/Toon.js';
import { addOutline } from '../core/Outline.js';
import { mergeGroup } from '../assets/props/merge.js';
import { Sequence } from '../anim/Sequencer.js';
import { Easing } from '../anim/Easing.js';
import { makeBridge } from '../assets/props/landmarks.js';

const key = (x, z) => `${x},${z}`;

export class Island {
  /**
   * @param {{radius?:number, tile?:number, seed?:number, lobes?:number, lobeRadius?:number, channel?:number,
   *          zonesUnlocked?:number, starterProps?:boolean, bridges?:boolean}} opts
   */
  constructor(opts = {}) {
    this.radius = opts.radius ?? 11;
    this.tile = opts.tile ?? 1;
    this.seed = opts.seed ?? 7;
    this.lobeCount = opts.lobes ?? 3;
    this.lobeRadius = opts.lobeRadius ?? 6;
    this.channel = opts.channel ?? 2;
    this.starterProps = opts.starterProps ?? true;
    this.bridges = opts.bridges ?? true;
    this.group = new THREE.Group(); this.group.name = 'island';
    this.tiles = new Map();      // UNLOCKED land: "x,z" -> 0  (v1 compat; isLand reads this)
    this.allTiles = new Map();   // every land cell of every zone: "x,z" -> zone index
    this.pathCells = new Set();
    this.zones = [];
    this._foams = [];
    this._t = 0;
    this._build();
    const n = Math.max(1, Math.min(this.zones.length, opts.zonesUnlocked ?? 1));
    for (let i = 0; i < n; i++) this._applyUnlock(i);
    this._syncVisibility();
  }

  // ------------------------------------------------------------------ queries
  isLand(x, z) { return this.tiles.has(key(Math.round(x), Math.round(z))); }
  zoneAt(x, z) { const i = this.allTiles.get(key(Math.round(x), Math.round(z))); return i === undefined ? -1 : i; }
  gridCells() { const out = []; for (const k of this.tiles.keys()) { const [x, z] = k.split(',').map(Number); out.push({ x, z }); } return out; }
  nextLockedZone() { return this.zones.find((z) => !z.unlocked) || null; }
  landEdge(dx, dz) {
    let last = null;
    for (let s = 0; s < this.radius * 2; s++) { const x = Math.round(dx * s), z = Math.round(dz * s); if (!this.isLand(x, z)) break; last = { x, z }; }
    return last;
  }

  // ------------------------------------------------------------------ build
  _build() {
    const r = rng(this.seed), R = this.radius;
    // Zone 0 = start island: blobby mask (same shape as Foundation v1 for seed 7)
    const lobes = [];
    for (let i = 0; i < 5; i++) lobes.push({ a: r() * Math.PI * 2, k: 0.6 + r() * 0.8, w: 1.5 + r() * 2 });
    const insideStart = (x, z) => {
      const d = Math.hypot(x, z), ang = Math.atan2(z, x);
      let rr = R; for (const l of lobes) rr += Math.cos(ang * l.k * 2 + l.a) * l.w * 0.5;
      return d < rr;
    };
    const startCells = [];
    for (let x = -R - 3; x <= R + 3; x++) for (let z = -R - 3; z <= R + 3; z++) if (insideStart(x, z)) startCells.push({ x, z });
    this._addZone('start', { x: 0, z: 0 }, R, startCells, r);

    // Lobes: far (−z, where the lighthouse goes), then two side lobes. Separated by a water channel.
    const angles = [-Math.PI / 2, Math.PI * 0.8, Math.PI * 0.2].slice(0, this.lobeCount);
    const names = ['far', 'west', 'east'];
    angles.forEach((a, li) => {
      const rl = this.lobeRadius;
      const dist = R + this.channel + rl + 1.5;
      const cx = Math.round(Math.cos(a) * dist), cz = Math.round(Math.sin(a) * dist);
      const wob = []; for (let i = 0; i < 3; i++) wob.push({ a: r() * Math.PI * 2, k: 1 + r(), w: 1 + r() });
      const cells = [];
      for (let x = cx - rl - 3; x <= cx + rl + 3; x++) for (let z = cz - rl - 3; z <= cz + rl + 3; z++) {
        const d = Math.hypot(x - cx, z - cz), ang = Math.atan2(z - cz, x - cx);
        let rr = rl; for (const w of wob) rr += Math.cos(ang * w.k * 2 + w.a) * w.w * 0.5;
        if (d >= rr) continue;
        // keep a channel of ≥ `channel` water tiles to any already-built zone
        let near = false;
        for (let dx = -this.channel; dx <= this.channel && !near; dx++) for (let dz = -this.channel; dz <= this.channel; dz++) if (this.allTiles.has(key(x + dx, z + dz))) { near = true; break; }
        if (!near) cells.push({ x, z });
      }
      const zone = this._addZone(names[li] || `lobe${li}`, { x: cx, z: cz }, rl, cells, r);
      if (this.bridges) this._addBridge(zone, a);
    });

    // Sea (shared)
    this.sea = new THREE.Mesh(G.plane(200, 200), new THREE.MeshToonMaterial({ color: P.water, gradientMap: null, transparent: true, opacity: 0.92 }));
    this.sea.rotation.x = -Math.PI / 2; this.sea.position.y = -0.9; this.sea.receiveShadow = false; this.sea.userData.noOutline = true;
    this.group.add(this.sea);
    this.grass = this.zones[0].ground; this.tuftMesh = this.zones[0].tufts; this.foam = this.zones[0].foam; // v1 compat handles
  }

  /** Build one zone: merged ground + tufts + flowers + foam, all under zone.group (hidden until unlocked). */
  _addZone(id, center, radius, cells, r) {
    const index = this.zones.length, T = this.tile;
    for (const c of cells) this.allTiles.set(key(c.x, c.z), index);
    const has = (x, z) => this.allTiles.has(key(x, z));
    const zg = new THREE.Group(); zg.name = `zone_${id}`;

    // Path cells: start zone = cross; lobes = short spoke from the bridge side to the center
    const path = new Set();
    if (index === 0) { for (const c of cells) if ((Math.abs(c.x) <= 1 && Math.abs(c.z) < radius - 2) || (Math.abs(c.z) <= 1 && Math.abs(c.x) < radius - 2)) path.add(key(c.x, c.z)); }
    else {
      const ang = Math.atan2(-center.z, -center.x); // toward origin
      for (let s = 0; s < radius + 2; s++) for (let w = -1; w <= 0; w++) {
        const x = Math.round(center.x + Math.cos(ang) * s + Math.cos(ang + Math.PI / 2) * w), z = Math.round(center.z + Math.sin(ang) * s + Math.sin(ang + Math.PI / 2) * w);
        if (has(x, z)) path.add(key(x, z));
      }
    }
    for (const k of path) this.pathCells.add(k);

    // --- ground: grass tops + cliff sides (edge cells only) + path decals → ONE merged mesh
    const raw = new THREE.Group();
    const grassGeo = G.box(T, 0.5, T), cliffGeo = G.box(T, 1.2, T), pathGeo = G.box(T * 0.98, 0.06, T * 0.98);
    const grassCols = [0, 1, 2, 3].map((i) => toonMat(vary(P.grass, 0.05, rng(this.seed * 31 + index * 7 + i))));
    const cliffMat = toonMat(P.dirt), cliffDark = toonMat(vary(P.dirt, 0.08, rng(index + 3))), pathMat = toonMat(P.sand);
    const edges = [];
    for (const { x, z } of cells) {
      const g = mesh(grassGeo, grassCols[Math.floor(r() * 4)], x, -0.25 + (r() - 0.5) * 0.04, z); raw.add(g);
      let edge = false; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has(x + dx, z + dz)) { edge = true; break; }
      if (edge) { edges.push({ x, z }); raw.add(mesh(cliffGeo, r() < 0.3 ? cliffDark : cliffMat, x, -1.1, z)); }
      if (path.has(key(x, z))) raw.add(mesh(pathGeo, pathMat, x, 0.02, z));
    }
    const ground = mergeGroup(raw);
    ground.name = 'ground';
    ground.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    zg.add(ground);

    // --- tufts (1 instanced) + flowers (1 instanced, 3 colors via instanceColor) — noOutline
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
    const tufts = [], flowers = [];
    for (const { x, z } of cells) {
      if (path.has(key(x, z))) continue;
      const n = r() < 0.5 ? 1 + Math.floor(r() * 3) : 0;
      for (let i = 0; i < n; i++) tufts.push([x + (r() - 0.5) * 0.8, z + (r() - 0.5) * 0.8, r() * Math.PI, 0.7 + r() * 0.7]);
      if (r() < 0.12) flowers.push([x + (r() - 0.5) * 0.7, z + (r() - 0.5) * 0.7, [P.glimmerPink, P.glimmerYellow, P.white][Math.floor(r() * 3)]]);
    }
    const tuftMesh = new THREE.InstancedMesh(G.cone(0.08, 0.3, 4), toonMat(P.grassDark), Math.max(1, tufts.length));
    tufts.forEach(([x, z, rot, sc], i) => { pos.set(x, 0.12 * sc, z); e.set((r() - 0.5) * 0.4, rot, (r() - 0.5) * 0.4); q.setFromEuler(e); s.set(sc, sc, sc); m.compose(pos, q, s); tuftMesh.setMatrixAt(i, m); });
    tuftMesh.count = tufts.length; tuftMesh.castShadow = false; tuftMesh.receiveShadow = true; tuftMesh.userData.noOutline = true; zg.add(tuftMesh);
    const flowerMesh = new THREE.InstancedMesh(G.sphere(0.09, 6, 4), toonMat(P.white), Math.max(1, flowers.length));
    const col = new THREE.Color();
    flowers.forEach(([x, z, c], i) => { m.makeTranslation(x, 0.22, z); flowerMesh.setMatrixAt(i, m); col.setHex(c); flowerMesh.setColorAt(i, col); });
    flowerMesh.count = flowers.length; flowerMesh.castShadow = false; flowerMesh.userData.noOutline = true; zg.add(flowerMesh);

    // --- foam ring (1 instanced, bobbing)
    const foam = new THREE.InstancedMesh(G.box(T * 1.1, 0.05, T * 1.1), flatMat(0xe8fbff, { transparent: true, opacity: 0.7, depthWrite: false }), Math.max(1, edges.length));
    edges.forEach(({ x, z }, i) => { m.makeTranslation(x, -0.86, z); foam.setMatrixAt(i, m); });
    foam.count = edges.length; foam.userData.noOutline = true; zg.add(foam); this._foams.push(foam);

    // --- starter placeholder props (v1 behaviour, start zone only; Chat 1B/10A replace with real nature props)
    if (this.starterProps && index === 0) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + r() * 0.3, d = radius - 2.5 - r() * 1.5;
        const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d);
        if (!has(x, z) || path.has(key(x, z))) continue;
        const p = r() < 0.7 ? makeTree(r) : makeRock(r);
        p.position.set(x, 0, z); p.rotation.y = r() * Math.PI * 2; zg.add(p);
      }
    }
    addOutline(zg);
    zg.visible = false;
    this.group.add(zg);
    const zone = { id, index, center, radius, unlocked: false, group: zg, cells, ground, tufts: tuftMesh, flowers: flowerMesh, foam, bridge: null, bridgeCells: [] };
    this.zones.push(zone);
    return zone;
  }

  /** Bridge over the channel from zone 0's shore to the lobe's shore along angle `a`. Lives in the lobe's group. */
  _addBridge(zone, a) {
    const dx = Math.cos(a), dz = Math.sin(a);
    let first = null, last = null;
    for (let s = 0; s < this.radius * 3; s++) {
      const x = Math.round(dx * s), z = Math.round(dz * s), zi = this.allTiles.get(key(x, z));
      if (zi === 0) first = null; // still on the start island
      else if (zi === undefined) { if (!first) first = { x, z }; last = { x, z }; }
      else if (zi === zone.index) break;
    }
    if (!first || !last) return;
    const cells = []; const n = Math.round(Math.hypot(last.x - first.x, last.z - first.z)) + 1;
    for (let i = 0; i < n; i++) cells.push({ x: Math.round(first.x + dx * i), z: Math.round(first.z + dz * i) });
    const len = n + 1;
    const b = makeBridge({ length: len });
    b.position.set((first.x + last.x) / 2, 0, (first.z + last.z) / 2);
    b.rotation.y = -a; // bridge spans +x by default
    zone.group.add(b);
    zone.bridge = b; zone.bridgeCells = cells;
  }

  _applyUnlock(i) {
    const z = this.zones[i]; if (!z || z.unlocked) return;
    z.unlocked = true;
    for (const c of z.cells) this.tiles.set(key(c.x, c.z), 0);
    for (const c of z.bridgeCells) { this.tiles.set(key(c.x, c.z), 0); this.allTiles.set(key(c.x, c.z), i); }
  }
  _syncVisibility() { for (const z of this.zones) { z.group.visible = z.unlocked || z.group.userData.rising === true; } }
  /** Save restore: unlock zone i instantly (no rise animation, no sound). Returns true if it was locked. */
  unlockInstant(i) { const z = this.zones[i]; if (!z || z.unlocked) return false; this._applyUnlock(i); z.group.position.y = 0; this._syncVisibility(); return true; }
  unlockAll() { for (let i = 0; i < this.zones.length; i++) this._applyUnlock(i); for (const z of this.zones) z.group.position.y = 0; this._syncVisibility(); }

  /**
   * Animated unlock. Timing table (ms / easing):
   *   anticipation 200 inQuad   — zone (still underwater at y −3) dips to −3.4, small camera shake, dust ring at the shore
   *   rise         500 outBack  — y −3.4 → 0 with overshoot (land pops out of the sea), foam burst
   *   settle       150 outCubic — scaleY 1.04 → 1 squash settle, big dust ring + "New land!" pop text
   * Returns the Sequence (already added to game.sequences when `game` is given) or null if already unlocked.
   */
  unlockZone(i, ctx = {}) {
    const z = this.zones[i]; if (!z || z.unlocked) return null;
    const { game, vfx } = ctx;
    if (!game) { this._applyUnlock(i); this._syncVisibility(); return null; }
    const g = z.group, c = new THREE.Vector3(z.center.x, 0, z.center.z);
    g.userData.rising = true; g.position.y = -3; g.visible = true;
    const seq = new Sequence('unlockZone')
      .phase('anticipation', 200, Easing.inQuad, (e) => { g.position.y = -3 - 0.4 * e; }, {
        onEnter: () => { game.camera.shake(0.2); if (vfx) vfx.dust.ring(c, 10, 0.3); } })
      .phase('rise', 500, Easing.outBack, (e) => { g.position.y = -3.4 + 3.4 * e; }, {
        onEnter: () => { this._applyUnlock(i); if (vfx) vfx.dust.burst(c, 14, { size: 0.3, speed: 3, dur: 0.5, up: 1.2 }); game.camera.shake(0.35); } })
      .phase('settle', 150, Easing.outCubic, (e) => { g.position.y = 0; g.scale.y = 1.04 - 0.04 * e; }, {
        onEnter: () => { if (vfx) { vfx.dust.ring(c, 16, 0.35); const p = c.clone(); p.y = 1.5; vfx.pop.show(p, 'New land!', { color: '#7ED957', dur: 1.1, size: 1.3 }); } game.hitstop && game.hitstop(40); },
        onExit: () => { g.scale.y = 1; g.userData.rising = false; this._syncVisibility(); } });
    game.sequences.play(seq, {});
    return seq;
  }

  update(dt) {
    this._t += dt;
    this.sea.position.y = -0.9 + Math.sin(this._t * 1.1) * 0.04;
    const fy = Math.sin(this._t * 1.1 + 1) * 0.03;
    for (const f of this._foams) f.position.y = fy;
    for (const z of this.zones) if (z.bridge && z.bridge.userData.update) z.bridge.userData.update(dt);
  }
}

/** Placeholder chunky tree (Chat 1B ships the real ones in src/assets/props/nature.js). */
export function makeTree(r = Math.random) {
  const g = new THREE.Group(); g.name = 'tree';
  const h = 0.9 + r() * 0.5;
  g.add(mesh(G.cyl(0.14, 0.2, h, 6), P.trunk, 0, h / 2, 0));
  const s = 0.7 + r() * 0.3;
  g.add(mesh(G.dodeca(0.75 * s), P.leaf, 0, h + 0.5 * s, 0));
  g.add(mesh(G.dodeca(0.5 * s), P.leafDark, 0.35 * s, h + 0.25 * s, 0.2 * s));
  g.add(mesh(G.dodeca(0.45 * s), P.leaf, -0.3 * s, h + 0.9 * s, -0.1 * s));
  const out = mergeGroup(g); out.name = 'tree'; return out;
}
export function makeRock(r = Math.random) {
  const g = new THREE.Group(); g.name = 'rock';
  const s = 0.4 + r() * 0.4;
  const rock = mesh(G.dodeca(s), P.stone, 0, s * 0.55, 0); rock.scale.set(1.3, 0.75, 1); rock.rotation.set(r(), r(), r() * 0.3); g.add(rock);
  const rock2 = mesh(G.dodeca(s * 0.5), P.stoneDark, s * 0.8, s * 0.3, 0.2); g.add(rock2);
  const out = mergeGroup(g); out.name = 'rock'; return out;
}
