// 10B — Integrate systems. `createSandbox(game, opts)` wires Island v2 + Economy (4A/4B) + Build (5) + Customers (6A) +
// hero moves/abilities (3A/3B) + VFX (9A/9B) into ONE playable sandbox season with debug keys (no UI — 10C mounts UI on the bus).
//
//   import { createSandbox } from './src/Game.js';
//   const sb = createSandbox(new Game(container));          // browser (demo_sandbox.html, index.html via 10C)
//   const sb = createSandbox(mockGame, { headless: true });  // Node (tools/check.mjs --sandbox) — no renderer, no DOM
//   sb.update(dt) is registered on game.add(); sb.keys: B build · 1–9 pick stall · E end season · H hire helper · Z unlock zone
//
// Everything here is GLUE. Rules live in the systems; this file only constructs, routes bus events and owns the debug keys.
import * as THREE from '../vendor/three.module.js';
import { Island } from './world/Island.js';
import { VFX } from './vfx/VFX.js';
import { installPack1 } from './vfx/pack1.js';
import { installPack2 } from './vfx/pack2.js';
import { HeroController } from './entities/HeroController.js';
import { attachMoves } from './anim/heroAnims.js';
import { attachAbilities, ABILITY_NAMES, FINLIT } from './anim/heroAbilities.js';
import { PROP_CATALOG, makeProp, STALL_TYPES, JAR_IDS, swayAll, swayDecor, updateLandmarks, makeFlowerField, makeGrassTufts } from './assets/props.js';
import { bakeStatic } from './assets/props/bake.js';
import { makeGlimmerAny, CreatureAnimator, HelperAnimator, makeHelper, HELPER_TYPES, registerVariants } from './assets/creatures/index.js';
import { makeEconomy, UPGRADES } from './systems/economyData.js';
import { BuildSystem } from './systems/build.js';
import { CustomerSystem } from './systems/customers.js';

export const SANDBOX_VERSION = '10B';
export const STALL_PICKS = STALL_TYPES.slice(0, 9);          // keys 1–9 → stall types
export const HELPER_UPGRADE_IDS = HELPER_TYPES.map((t) => 'helper_' + t);

/** Deterministic LCG so headless and browser build the same scenery. */
export function makeRnd(seed = 2026) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/**
 * @param {object} game  Game (or a mock: { scene, bus, sequences, input, time, add(), followTarget, camera })
 * @param {{headless?:boolean, seed?:number, zonesUnlocked?:number, starterStalls?:boolean, maxActive?:number, seasonSeconds?:number}} opts
 */
export function createSandbox(game, opts = {}) {
  registerVariants?.();
  const headless = !!opts.headless;
  const rnd = makeRnd(opts.seed ?? 2026);
  const sb = { game, headless, opts, version: SANDBOX_VERSION, log: [], stats: { seasons: 0, reports: [] } };

  // ---- world ------------------------------------------------------------------------------------------------------
  sb.island = new Island({ radius: 11, seed: 7, zonesUnlocked: opts.zonesUnlocked ?? 1, starterProps: false });
  game.scene.add(sb.island.group);
  sb.vfx = headless ? mockVfx() : game.add(new VFX(game));
  if (!headless) installPack1(sb.vfx);
  sb.world = buildScenery(sb, rnd);                            // landmarks + decor + nature (baked) → sb.world.{lighthouse,cottage,pier,…}
  if (!headless) { installPack2(sb.vfx, { island: sb.island, lighthouse: sb.world.lighthouse, radius: 12.5, core: 2.5 }); sb.vfx.fog.setCoverage(0, { immediate: true }); }

  // ---- systems ------------------------------------------------------------------------------------------------------
  const bus = game.bus;
  sb.eco = makeEconomy({ bus, seed: opts.seed ?? 1, autoSeason: true }, opts.balance);
  if (opts.seasonSeconds) sb.eco.config.seasonSeconds = opts.seasonSeconds;
  sb.build = new BuildSystem(game, { island: sb.island, economy: sb.eco, catalog: PROP_CATALOG, vfx: sb.vfx });
  // scenery cells are "occupied" for Build (ghost turns red) and Customers (flow field routes around) without touching 5/6A code
  const SCENERY = { id: 'scenery', category: 'scenery', group: new THREE.Group(), cells: [], cx: 0, cz: 0, rot: 0, level: 0, cost: 0, scenery: true };
  sb.SCENERY = SCENERY;
  for (const k of sb.world.occupied) if (!sb.island.pathCells.has(k)) sb.build.cells.set(k, SCENERY);
  sb.cust = new CustomerSystem(game, { island: sb.island, build: sb.build, economy: sb.eco, vfx: sb.vfx, seed: opts.seed ?? 5, maxActive: opts.maxActive ?? 20,
    creatures: { makeGlimmer: (t) => makeGlimmerAny(t, { seed: (rnd() * 1e6) | 0 }), CreatureAnimator } });
  if (sb.world.pierSpawn) sb.cust.setSpawnPoint(sb.world.pierSpawn.x, sb.world.pierSpawn.z);

  // ---- hero ------------------------------------------------------------------------------------------------------
  sb.hero = new HeroController(game, { vfx: sb.vfx, targets: () => sb.cust.active.map((c) => ({ root: c.root, hit: (d, p) => c.anim?.hit?.(d, p) })), isLand: (x, z) => sb.island.isLand(x, z) });
  sb.hero.root.position.set(0, 0, 1);
  attachMoves(sb.hero); attachAbilities(sb.hero);
  game.followTarget = sb.hero.root.position;
  if (game.camera?.snapTo) { game.camera.zoom = 1.25; game.camera.snapTo(sb.hero.root.position); }

  sb.helpers = [];                                               // P3: hired helpers { g, anim, type, stall }
  sb.pick = 0;                                                   // current stall pick index (keys 1–9)
  wireEconomy(sb);
  wireAbilities(sb);
  if (opts.starterStalls !== false) placeStarterStalls(sb);
  installDebugKeys(sb);

  // ---- loop ------------------------------------------------------------------------------------------------------
  sb.update = (dt) => {
    sb.island.update(dt);
    if (!headless) { swayAll(game.time); swayDecor(game.time); updateLandmarks(dt); }
    sb.hero.update(dt);
    sb.build.update(dt);
    sb.cust.update(dt);
    sb.eco.tick(dt);
    for (const h of sb.helpers) h.anim.update(dt);
  };
  game.add({ update: (dt) => sb.update(dt) });
  bus.emit('sandbox:ready', { version: SANDBOX_VERSION });
  return sb;
}

// ---- parts (filled in below, one per commit) ----------------------------------------------------------------------
// Landmarks (1C) + live decor (1D) + nature (1B, baked by 10A bake.js) around the plaza. The plaza (|x| ≤ 5, −7 ≤ z ≤ 4) is left
// free: that is where the player builds. Cells are reserved on the Island's tile map via a local `occupied` set that BuildSystem
// also respects (we pre-fill build.cells after construction — see placeStarterStalls). Mirrors demo_world.html, trimmed.
function buildScenery(sb, rnd) {
  const island = sb.island, headless = sb.headless;
  const occupied = new Set(); const key = (x, z) => `${Math.round(x)},${Math.round(z)}`;
  const free = (x, z, w = 1, d = 1) => { for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) { const k = key(Math.round(x) + i, Math.round(z) + j); if (!island.allTiles.has(k) || island.pathCells.has(k) || occupied.has(k)) return false; } return true; };
  const take = (x, z, w = 1, d = 1) => { for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) occupied.add(key(Math.round(x) + i, Math.round(z) + j)); };
  const zoneOf = (x, z) => island.zones[Math.max(0, island.zoneAt(x, z))].group;
  const place = (g, x, z, { rot = 0, w = 1, d = 1, parent = null } = {}) => { g.position.set(x, 0, z); g.rotation.y = rot; (parent || zoneOf(x, z)).add(g); take(x, z, w, d); return g; };
  const W = { occupied, key, free, take, place, live: [], baked: [], towers: [], lanterns: [], jars: [] };
  const [start, far, west, east] = island.zones;
  // landmarks
  W.lighthouse = place(makeProp('lighthouse'), far.center.x, far.center.z - 1, { rot: Math.PI, w: 2, d: 2, parent: far.group }); take(far.center.x - 1, far.center.z - 2, 1, 2);
  W.cottage = place(makeProp('cottage'), -6, 6, { rot: 0.5, w: 2, d: 2 }); W.cottage.userData.setLit?.(true); take(-7, 5, 3, 3);
  const edge = island.landEdge(1, 0) || { x: 10, z: 0 };
  W.pier = makeProp('pier', { length: 4 }); W.pier.position.set(edge.x + 0.5, 0, edge.z + 0.5); start.group.add(W.pier);
  W.pierSpawn = { x: edge.x - 1, z: edge.z };                      // customers arrive by boat at the pier (6A default is the −Z edge)
  for (const [zone, dx, dz, seed] of [[west, 1.5, -1, 1], [east, -1, -2, 2], [far, 3.5, 2.5, 3]]) W.towers.push(place(makeProp('fog_tower', { seed }), zone.center.x + dx, zone.center.z + dz, { parent: zone.group }));
  const cliff = place(makeProp('cliff_wall', { length: 5 }), west.center.x - 1, west.center.z + 3.5, { w: 5, parent: west.group });
  W.waterfall = place(makeProp('waterfall', { height: 2.4 }), east.center.x + 2, east.center.z + 2.5, { rot: Math.PI, w: 2, d: 2, parent: east.group });
  W.live.push(W.lighthouse, W.cottage, W.pier, W.waterfall, ...W.towers);
  // live decor: 4 jars by the cottage, 5 lanterns, hanging sign + banner at the plaza entrance
  JAR_IDS.forEach((id, i) => { const j = place(makeProp(id, { fill: 0.25 }), -8 + i, 3); W.jars.push(j); W.live.push(j); });
  for (const [x, z] of [[-1.5, -8], [1.5, -8], [-6, -2], [5, 4], [-2, 5.5]]) { const l = place(makeProp(rnd() < 0.5 ? 'lantern_post' : 'lantern_hanging'), x, z); l.userData.setLit?.(false); W.lanterns.push(l); W.live.push(l); }
  W.live.push(place(makeProp('sign_hanging'), -5, -6), place(makeProp('banner_string'), -1, -4.5, { w: 2 }));
  // static decor + nature → baked per zone
  const stat = [cliff];
  for (let i = 0; i < 4; i++) stat.push(place(makeProp('fence_rail'), 4 + i, 6)); stat.push(place(makeProp('fence_gate'), 5, 7.5, { w: 2 }), place(makeProp('bench'), -2.5, 7, { w: 2 }), place(makeProp('sign_board'), 2, 7));
  stat.push(place(makeProp('crate'), 6, -5), place(makeProp('barrel'), 7, -5), place(makeProp('flower_pot'), -4, 7), place(makeProp('water_trough'), 5.5, -7.5, { w: 2 }));
  const TREES = ['tree_round', 'tree_cone', 'tree_double', 'tree_palm', 'tree_blossom', 'tree_tall'], ROCKS = ['rock_small', 'rock_medium', 'rock_flat', 'rock_mossy'], BUSHES = ['bush_round', 'bush_berry', 'bush_flower', 'bush_fern'];
  const scatter = (zone, n, pool, minR) => { let placed = 0, tries = 0; while (placed < n && tries++ < 300) { const c = zone.cells[(rnd() * zone.cells.length) | 0]; if (Math.hypot(c.x - zone.center.x, c.z - zone.center.z) < minR || !free(c.x, c.z)) continue; stat.push(place(makeProp(pool[(rnd() * pool.length) | 0], { seed: (rnd() * 1e6) | 0, scale: 0.85 + rnd() * 0.35 }), c.x, c.z, { rot: rnd() * Math.PI * 2, parent: zone.group })); placed++; } };
  scatter(start, 8, TREES, 7); scatter(start, 4, ROCKS, 7); scatter(start, 4, BUSHES, 6.5);
  for (const z of [far, west, east]) { scatter(z, 5, TREES, 2.5); scatter(z, 3, ROCKS, 2); scatter(z, 3, BUSHES, 1.5); }
  for (const z of island.zones) { const list = stat.filter((g) => g.parent === z.group); if (list.length) W.baked.push(bakeStatic(list, { parent: z.group, name: 'batch_' + z.id })); }
  if (!headless) for (const z of island.zones) { // instanced flower/tuft fields on free land (1 dc each)
    const area = (x, y) => island.allTiles.get(key(x, y)) === z.index && !island.pathCells.has(key(x, y)) && !occupied.has(key(x, y));
    const fl = makeFlowerField(z.index === 0 ? 140 : 60, area, { seed: 11 + z.index, radius: z.radius + 1 }); fl.position.set(z.center.x, 0, z.center.z); z.group.add(fl);
    const tu = makeGrassTufts(z.index === 0 ? 100 : 50, area, { seed: 21 + z.index, radius: z.radius + 1 }); tu.position.set(z.center.x, 0, z.center.z); z.group.add(tu);
  }
  return W;
}
// 3 starter stalls (fruit / bread / tea) via build.load → no Spark charged; counts as owned stalls for upkeep.
function placeStarterStalls(sb) {
  sb.build.load([{ id: 'stall_fruit', cx: -4, cz: -3, rot: 1, level: 1 }, { id: 'stall_bread', cx: 3, cz: -3, rot: 3, level: 1 }, { id: 'stall_tea', cx: -3, cz: -6, rot: 0, level: 1 }]);
  sb.eco.state.stalls = sb.build.placed.size;
  sb.cust.reroute();
}

// Economy ↔ world glue on the bus. Economy is PURE (4A); this is where its events touch the island.
function wireEconomy(sb) {
  const { eco, bus, vfx, world, island } = { ...sb, bus: sb.game.bus };
  const off = []; sb._offs = off;
  off.push(bus.on('build:placed', (p) => { if (p?.id?.startsWith?.('stall_')) eco.state.stalls = countStalls(sb); }));
  off.push(bus.on('build:removed', () => { eco.state.stalls = countStalls(sb); }));
  off.push(bus.on('eco:fog', (p) => { const f = p?.fog01 ?? eco.state.fog01; vfx.fog?.setCoverage?.(f); world.towers.forEach((t) => t.userData.setActive?.(f > 0.3)); if (f > 0.6) vfx.debtPulse?.(0.4); }));
  off.push(bus.on('eco:jar', () => { const j = eco.state.jars, tot = Math.max(1, j.spend + j.save + j.invest + j.protect); ['spend', 'save', 'invest', 'protect'].forEach((k, i) => world.jars[i]?.userData.setFill?.(Math.min(1, j[k] / tot))); }));
  off.push(bus.on('eco:season', (r) => {
    sb.stats.seasons++; sb.stats.reports.push(r);
    const spot = sb.hero.root.position.clone().setY(2); vfx.pop?.show?.(spot, `Season ${r.season} ★${r.stars}`, { color: '#FFD54F', dur: 1.6, size: 1.1 });
    world.lanterns.forEach((l) => l.userData.setLit?.(r.season % 2 === 0));                      // alternate day/night feel per season
    if (!eco.state.ended) sb.cust.spawnWave(eco.state.season);
    sb.log.push(`S${r.season} income ${r.income} exp ${r.expenses} debt ${r.debt} fog ${(r.fog01 * 100) | 0}% ★${r.stars}`);
  }));
  off.push(bus.on('eco:win', () => { world.lighthouse?.userData.setState?.('lit'); vfx.lighthouseBeam?.show?.(world.lighthouse); vfx.fogRecede?.(); }));
  off.push(bus.on('eco:lose', () => { vfx.fog?.setCoverage?.(1); vfx.debtPulse?.(1); }));
  off.push(bus.on('eco:upgrade', (p) => { const u = p?.upgrade; if (u?.kind === 'zone') { const z = island.zones[u.effect.zone]; if (z && !z.unlocked) island.unlockZone(z.index, { game: sb.game, vfx }); } }));
  sb.cust.spawnWave(eco.state.season);                                                             // first wave at start (6A note)
}
function countStalls(sb) { let n = 0; for (const e of sb.build.placed.values()) if (e.id.startsWith('stall_')) n++; return n; }
function wireAbilities(sb) {}
function installDebugKeys(sb) {}

/** VFX stand-in for Node: every pool call is a no-op counter. */
export function mockVfx() {
  const n = { calls: 0 }; const noop = () => { n.calls++; };
  const pool = { burst: noop, ring: noop, show: noop, emit: noop, stream: noop, hide: noop, push: noop, setCoverage: noop, coverage: 0 };
  return new Proxy({ _counts: n, fog: pool, coinFly: noop, debtPulse: noop, pop: pool, dust: pool, sparks: pool }, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : pool)) });
}

export default createSandbox;
