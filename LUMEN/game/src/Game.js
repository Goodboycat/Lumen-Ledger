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
import { bakeStatic, bakeShells, disposeBatch } from './assets/props/bake.js';
import { BlobShadows, CreatureLOD, PixelRatioGovernor } from './systems/perf.js';   // 11A
import { G } from './assets/geo.js';
import { PALETTE as P, flatMat } from './core/Toon.js';
import { makeGlimmerAny, CreatureAnimator, HelperAnimator, makeHelper, HELPER_TYPES, registerVariants, makeFogCollector, makeBaronGilt, VillainAnimator, FogPuffPool } from './assets/creatures/index.js';
import { EnemySystem, ENEMY_RULES } from './systems/enemies.js';   // S16
import { StormWeather, STORM } from './vfx/storm.js';   // S17 (+ S21 holdSeconds)
import { CinematicDirector } from './vfx/cinematics.js';   // S18
import { makeEconomy, UPGRADES, pickEvent } from './systems/economyData.js';
import { BuildSystem } from './systems/build.js';
import { CustomerSystem } from './systems/customers.js';
import { StorySystem } from './systems/story.js';
import { Economy } from './systems/economy.js';
import * as Save from './systems/save.js';

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
  placeClutter(sb);                                             // S07: salvageable plaza clutter (real BuildSystem entries, cost 0 → SALVAGE refund)
  sb.cust = new CustomerSystem(game, { island: sb.island, build: sb.build, economy: sb.eco, vfx: sb.vfx, seed: opts.seed ?? 5, maxActive: opts.maxActive ?? 20,
    creatures: { makeGlimmer: (t) => makeGlimmerAny(t, { seed: (rnd() * 1e6) | 0 }), CreatureAnimator } });
  if (sb.world.pierSpawn) sb.cust.setSpawnPoint(sb.world.pierSpawn.x, sb.world.pierSpawn.z);

  // ---- hero ------------------------------------------------------------------------------------------------------
  // S16: sword targets = Glimmers + live enemies (knockback / defeat). S32: every target is KNOCKED BACK (CreatureAnimator.hit slides the
  //   root; enemies keep ENEMY_RULES.knockback) and hired helpers are targets too (they slide, grumble and walk back to their stall).
  sb.hero = new HeroController(game, { vfx: sb.vfx, targets: () => sb.cust.active.filter((c) => c.state !== 'pooled' && c.state !== 'despawn').map((c) => ({ root: c.root, hit: (d, p) => c.anim?.hit?.(d, p) }))
    .concat(sb.enemies ? sb.enemies.targets() : [], helperTargets(sb)), isLand: (x, z) => sb.island.isLand(x, z) });
  sb.hero.root.position.set(0, 0, 1);
  // S16: Debt Collectors (+ Baron Gilt boss from S6). Transient — spawned by the scheduler at day 0.7, cleared at season end / win / lose.
  sb.enemies = new EnemySystem(game, { hero: sb.hero, eco: sb.eco, island: sb.island, vfx: sb.vfx, headless, occupied: (x, z) => sb.build?.occupied?.(x, z) || null,   // S34 / P73: enemies + shoves respect stall footprints
    creatures: headless ? {} : { makeFogCollector, makeBaronGilt, VillainAnimator, FogPuffPool },
    spawnPoint: sb.world.pierSpawn || { x: 0, z: -10 }, exitPoint: sb.world.pierSpawn || { x: 0, z: -10 }, onCoin: (x, z, v) => sb.dropTip?.(x, z, v), isShielded: () => game.time < (sb.shield?.until ?? -1) });
  sb.villains = sb.enemies.list;                                 // perf LOD / blob shadows / destroySandbox already walk sb.villains
  // S17: storm weather look (sky/fog slate, dim lights, wind ×3, streaks, DOM rain). Scheduler: warn at day 0.30 when the pre-rolled event is a storm, hit at 0.45, clear 3 s later.
  sb.storm = new StormWeather(game, { lights: game.lights, container: game.container, headless, reduceMotion: () => !!sb.reduceMotion });
  attachMoves(sb.hero); attachAbilities(sb.hero);
  game.followTarget = sb.hero.root.position;
  if (game.camera?.snapTo) { game.camera.zoom = 1.25; game.camera.snapTo(sb.hero.root.position); }

  // BUGFIX B15/C01: ONE place that derives the economy's stall count + upgrade upkeep from the live BuildSystem (decor never counts)
  sb.syncStalls = () => { let n = 0, extra = 0; for (const e of sb.build.placed.values()) if (e.id.startsWith('stall_')) { n++; extra += sb.eco.levelUpkeep?.(e.level) || 0; } sb.eco.state.stalls = n; sb.eco.state.stallUpkeepExtra = extra; return n; };
  // BUGFIX B08: world fog / fog towers / vignette follow the economy immediately (start, resume), not only after the next eco:fog
  sb.syncWorld = () => { const f = sb.eco.state.fog01; sb.vfx.fog?.setCoverage?.(f, { immediate: true }); sb.world.towers.forEach((t) => t.userData.setActive?.(f > 0.3)); };
  sb.helpers = [];                                               // P3: hired helpers { g, anim, type, stall }
  sb.pick = 0;                                                   // current stall pick index (keys 1–9)
  wireEconomy(sb);
  wireAbilities(sb);
  // BUGFIX P65: the starter footprints' SCENERY reservation must go even when starterStalls:false (CONTINUE) — otherwise build.load(snap.build)
  //   rejects the 3 saved starter stalls ("scenery" cell) and a resumed run silently loses them (check.mjs --save: stalls 9/12).
  for (const s of STARTER_STALLS) freeStarterCells(sb, s);
  if (opts.starterStalls !== false) placeStarterStalls(sb);
  sb.syncWorld();
  installDebugKeys(sb);

  // ---- loop ------------------------------------------------------------------------------------------------------
  sb.update = (dt, _g, dtReal) => {
    sb.island.update(dt);
    if (!headless) { const tw = game.realTime ?? game.time; swayAll(tw); swayDecor(tw); updateLandmarks(dt); }   // S18: wind keeps blowing on the (paused) title backdrop
    sb.hero.update(dt);
    sb.enemies.update(dt);
    sb.storm.update(dtReal ?? dt);
    sb.build.update(dt);
    sb.cust.update(dt);
    sb.eco.tick(dt);
    sb.updateScheduler?.();
    for (const h of sb.helpers) { h.anim.update(dt); updateHelperKnock(sb, h, dt); }
    updateCoins(sb, dt);
    updatePerf(sb, dtReal);
  };
  installPerf(sb);
  sb._system = game.add({ update: (dt, g, dtReal) => sb.update(dt, g, dtReal) });   // kept so 10C destroySandbox can unregister it
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
  // BUGFIX B07: the 3 starter stall footprints are reserved BEFORE any scenery is scattered, so no seed can block them
  for (const s of STARTER_STALLS) { const fp = PROP_CATALOG[s.id]?.footprint || [1, 1]; const [w, d] = (s.rot & 1) ? [fp[1], fp[0]] : fp; take(s.cx, s.cz, w, d); }
  // landmarks
  W.lighthouse = place(makeProp('lighthouse'), far.center.x, far.center.z - 1, { rot: Math.PI, w: 2, d: 2, parent: far.group }); take(far.center.x - 1, far.center.z - 2, 1, 2);
  W.cottage = place(makeProp('cottage'), -6, 6, { rot: 0.5, w: 2, d: 2 }); W.cottage.userData.setLit?.(true); take(-7, 5, 3, 3);
  const edge = island.landEdge(1, 0) || { x: 10, z: 0 };
  W.pier = makeProp('pier', { length: 4 }); W.pier.position.set(edge.x + 0.5, 0, edge.z + 0.5); start.group.add(W.pier);
  W.pierSpawn = { x: edge.x - 1, z: edge.z };                      // customers arrive by boat at the pier (6A default is the −Z edge)
  take(W.pierSpawn.x, W.pierSpawn.z, 1, 1);                       // S34 / P82: the landing cell is scenery-reserved — a stall built over it trapped every leaving customer
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
  for (let i = 0; i < 4; i++) stat.push(place(makeProp('fence_rail'), 4 + i, 6)); stat.push(place(makeProp('fence_gate'), 5, 7.5, { w: 2 }));
  // S07 "Clear Clutter": the plaza clutter (bench, sign, crate, barrel, flower pot, trough) is NOT baked any more — it is loaded into
  // BuildSystem as real owned decor (cost 0 → the sell refund is the small SALVAGE bonus), so players can sell it from the tray / by tap
  // to free prime market tiles. Its cells are reserved here (take) so the scatter below avoids them; placeClutter() loads them after build exists.
  W.clutter = [{ id: 'bench', cx: -3, cz: 7, rot: 0 }, { id: 'sign_board', cx: 2, cz: 7, rot: 0 }, { id: 'crate', cx: 6, cz: -5, rot: 0 }, { id: 'barrel', cx: 7, cz: -5, rot: 0 }, { id: 'flower_pot', cx: -4, cz: 7, rot: 0 }, { id: 'water_trough', cx: 5, cz: -8, rot: 0 }];
  for (const c of W.clutter) { const fp = PROP_CATALOG[c.id]?.footprint || [1, 1]; take(c.cx, c.cz, fp[0], fp[1]); }
  const TREES = ['tree_round', 'tree_cone', 'tree_double', 'tree_palm', 'tree_blossom', 'tree_tall'], ROCKS = ['rock_small', 'rock_medium', 'rock_flat', 'rock_mossy'], BUSHES = ['bush_round', 'bush_berry', 'bush_flower', 'bush_fern'];
  const scatter = (zone, n, pool, minR) => { let placed = 0, tries = 0; while (placed < n && tries++ < 300) { const c = zone.cells[(rnd() * zone.cells.length) | 0]; if (Math.hypot(c.x - zone.center.x, c.z - zone.center.z) < minR || !free(c.x, c.z)) continue; stat.push(place(makeProp(pool[(rnd() * pool.length) | 0], { seed: (rnd() * 1e6) | 0, scale: 0.85 + rnd() * 0.35 }), c.x, c.z, { rot: rnd() * Math.PI * 2, parent: zone.group })); placed++; } };
  scatter(start, 8, TREES, 7); scatter(start, 4, ROCKS, 7); scatter(start, 4, BUSHES, 6.5);
  for (const z of [far, west, east]) { scatter(z, 5, TREES, 2.5); scatter(z, 3, ROCKS, 2); scatter(z, 3, BUSHES, 1.5); }
  for (const z of island.zones) { const list = stat.filter((g) => g.parent === z.group); if (list.length) W.baked.push(bakeStatic(list, { parent: z.group, name: 'batch_' + z.id })); }
  // 11A Lever 2: the static shells of the LIVE props (lantern posts, jar bodies, lighthouse tower, cottage walls, pier planks,
  // sign posts…) go into one more batch per zone; only glass / glow / lamp / swing / flags / live parts stay as own meshes (−20 m).
  if (sb.opts?.bakeShells !== false) for (const z of island.zones) { const list = W.live.filter((g) => g.parent === z.group); const b = list.length && bakeShells(list, { parent: z.group, name: 'shells_' + z.id }); if (b) W.baked.push(b); }
  if (!headless) for (const z of island.zones) { // instanced flower/tuft fields on free land (1 dc each)
    const area = (x, y) => island.allTiles.get(key(x, y)) === z.index && !island.pathCells.has(key(x, y)) && !occupied.has(key(x, y));
    const fl = makeFlowerField(z.index === 0 ? 140 : 60, area, { seed: 11 + z.index, radius: z.radius + 1 }); fl.position.set(z.center.x, 0, z.center.z); z.group.add(fl);
    const tu = makeGrassTufts(z.index === 0 ? 100 : 50, area, { seed: 21 + z.index, radius: z.radius + 1 }); tu.position.set(z.center.x, 0, z.center.z); z.group.add(tu);
  }
  return W;
}
/** S07: pre-spawned plaza clutter → owned decor entries. Fresh runs only (a restored save re-places whatever the player kept via snap.build).
 *  cost 0 → BuildSystem pays SALVAGE_BONUS on demolish instead of the 50 % refund (see build.js demolish). */
export const CLUTTER_SALVAGE = 6;
function placeClutter(sb) {
  if (sb.opts?.starterStalls === false || sb.opts?.clutter === false) { for (const c of sb.world.clutter || []) { const fp = PROP_CATALOG[c.id]?.footprint || [1, 1]; for (let i = 0; i < fp[0]; i++) for (let j = 0; j < fp[1]; j++) sb.build.cells.delete(`${c.cx + i},${c.cz + j}`); } return 0; }
  let n = 0;
  for (const c of sb.world.clutter || []) {
    const fp = PROP_CATALOG[c.id]?.footprint || [1, 1];
    for (let i = 0; i < fp[0]; i++) for (let j = 0; j < fp[1]; j++) { const k = `${c.cx + i},${c.cz + j}`; if (sb.build.cells.get(k) === sb.SCENERY) sb.build.cells.delete(k); }   // un-reserve → place() can take it
    const e = sb.build.place(c.id, c.cx, c.cz, c.rot || 0, { animate: false, pay: false, level: 1, silent: true, cost: 0 });
    if (e) { e.salvage = CLUTTER_SALVAGE; n++; }
  }
  return n;
}
// 3 starter stalls (fruit / bread / tea) via build.load → no Spark charged; counts as owned stalls for upkeep.
export const STARTER_STALLS = [{ id: 'stall_fruit', cx: -4, cz: -3, rot: 1, level: 1 }, { id: 'stall_bread', cx: 3, cz: -3, rot: 3, level: 1 }, { id: 'stall_tea', cx: -3, cz: -6, rot: 0, level: 1 }];
function placeStarterStalls(sb) {
  for (const s of STARTER_STALLS) {
    // BUGFIX P46: buildScenery() reserved this footprint (so scatter avoids it) and createSandbox copied every reserved cell into
    // build.cells as SCENERY → load() always hit its own reservation, the B07 ring fallback moved the stall, and the planned 2×2 stayed
    // an invisible blocker forever (Glimmers froze against it after a sale). Un-reserve the planned cells first, like placeClutter().
    freeStarterCells(sb, s);
    if (sb.build.load([s])) continue;
    // BUGFIX B07 fallback: if the anchor is still blocked, try the nearest free spot (ring search) so every run starts with 3 stalls
    let done = false;
    for (let r = 1; r <= 3 && !done; r++) for (let dx = -r; dx <= r && !done; dx++) for (let dz = -r; dz <= r && !done; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      if (sb.build.canPlace(s.id, s.cx + dx, s.cz + dz, s.rot)) done = !!sb.build.load([{ ...s, cx: s.cx + dx, cz: s.cz + dz }]);
    }
  }
  sb.syncStalls();
  sb.cust.reroute();
}
/** P46: drop the SCENERY reservation of a starter stall footprint (rotation-aware) so BuildSystem can actually take the cells. */
function freeStarterCells(sb, s) {
  for (const c of sb.build.cellsFor(s.id, s.cx, s.cz, s.rot)) { const k = `${c.x},${c.z}`; if (sb.build.cells.get(k) === sb.SCENERY) sb.build.cells.delete(k); }
}

// Economy ↔ world glue on the bus. Economy is PURE (4A); this is where its events touch the island.
function wireEconomy(sb) {
  const { eco, bus, vfx, world, island } = { ...sb, bus: sb.game.bus };
  const off = []; sb._offs = off;
  off.push(bus.on('build:placed', () => sb.syncStalls()));
  off.push(bus.on('build:removed', () => { sb.syncStalls(); reseatHelpers(sb); }));   // BUGFIX P31: orphaned helpers move to another stall
  off.push(bus.on('build:placed', (p) => { if (!p?.silent) reseatHelpers(sb); }));
  off.push(bus.on('build:upgraded', () => sb.syncStalls()));
  off.push(bus.on('eco:fog', (p) => { const f = p?.fog01 ?? eco.state.fog01; vfx.fog?.setCoverage?.(f); world.towers.forEach((t) => t.userData.setActive?.(f > 0.3)); if (f > 0.6) vfx.debtPulse?.(0.4); }));
  off.push(bus.on('eco:jar', () => { const j = eco.state.jars, tot = Math.max(1, j.spend + j.save + j.invest + j.protect); ['spend', 'save', 'invest', 'protect'].forEach((k, i) => world.jars[i]?.userData.setFill?.(Math.min(1, j[k] / tot))); }));
  off.push(bus.on('eco:season', (r) => {
    sb.stats.seasons++; sb.stats.reports.push(r);
    const spot = sb.hero.root.position.clone().setY(2); vfx.pop?.show?.(spot, `Season ${r.season} ★${r.stars}`, { color: '#FFD54F', dur: 1.6, size: 1.1 });
    world.lanterns.forEach((l) => l.userData.setLit?.(r.season % 2 === 0));                      // alternate day/night feel per season
    if (!eco.state.ended) sb.cust.spawnWave(eco.state.season);
    if (sb.enemies?.active.length) { const n = sb.enemies.sendHome(); sb.log.push(`S${r.season} collectors walk home (${n})`); }   // S16b: season over → they turn and walk back to the pier (not a defeat)
    sb.log.push(`S${r.season} income ${r.income} exp ${r.expenses} debt ${r.debt} fog ${(r.fog01 * 100) | 0}% ★${r.stars}`);
  }));
  off.push(bus.on('eco:win', () => { if (!sb._cineLamp) { world.lighthouse?.userData.setState?.('lit'); vfx.lighthouseBeam?.show?.(world.lighthouse); } vfx.fogRecede?.(); }));   // S18: the victory cinematic lights the lamp itself
  off.push(bus.on('eco:lose', () => { vfx.fog?.setCoverage?.(1); vfx.debtPulse?.(1); }));
  off.push(bus.on('eco:win', () => sb.enemies?.clear())); off.push(bus.on('eco:lose', () => sb.enemies?.clear()));   // S16
  off.push(bus.on('eco:season', () => { sb._stormClearAt = null; sb.storm?.clear(2); })); off.push(bus.on('eco:win', () => sb.storm?.clear(1.5)));   // S17: a new season always starts under a clear sky
  off.push(bus.on('eco:upgrade', (p) => { const u = p?.upgrade; if (u?.kind === 'zone') { const z = island.zones[u.effect.zone]; if (z && !z.unlocked) island.unlockZone(z.index, { game: sb.game, vfx }); } }));
  sb.cust.spawnWave(eco.state.season);                                                             // first wave at start (6A note)
  installScheduler(sb);
}
// Sandbox season scheduler (no story/UI here — 10C's StorySystem will own the real pacing on the same bus events):
//   day01 ≥ 0.45 → one random event (4B pickEvent) — absorbed if bubbleShield is armed (eco:absorbed, Protect jar untouched)
//   day01 ≥ 0.70 on odd seasons → Baron Gilt offers a Too-Good Deal (eco.offerScam) → player ledgerFlashes (refuse) or it is auto-refused at
//   season end (sandbox never auto-accepts). sb.nextEvent is pre-rolled so bubbleShield can name it.
function installScheduler(sb) {
  const { eco } = sb, bus = sb.game.bus; const S = sb.sched = { season: 0, event: false, scam: false, wave: false, warn: false };
  sb.nextEvent = pickEvent(eco, Math.max(1, eco.state.season));
  sb.updateScheduler = () => {
    const s = eco.state; if (s.ended) return;
    if (S.season !== s.season) { S.season = s.season; S.event = false; S.scam = false; S.wave = false; S.warn = false; sb.nextEvent = pickEvent(eco, s.season); }
    // S17: clouds gather from day 0.30 when a storm is coming (the player has ~15 s to fill Protect)
    if (!S.warn && s.day01 >= 0.3 && sb.nextEvent === 'storm' && !S.event) { S.warn = true; sb.storm?.warn(); sb.log.push(`S${s.season} storm clouds gather`); }
    if (!S.event && s.day01 >= 0.45 && sb.nextEvent) {
      S.event = true; const id = sb.nextEvent;
      if (sb.game.time < sb.shield.until) { sb.shield.until = -1; sb.stats.absorbed = (sb.stats.absorbed || 0) + 1; bus.emit('eco:absorbed', { id, event: eco.events[id] }); sb.log.push(`S${s.season} ${id} ABSORBED by Bubble Shield`); if (id === 'storm') sb.storm?.clear(2); }
      else { if (id === 'storm') { sb.storm?.hit(); sb._stormClearAt = STORM.holdSeconds > 0 ? sb.game.time + STORM.holdSeconds : null; /* S21: holdSeconds 0 → rains until the season ends */ } eco.applyEvent(id); sb.log.push(`S${s.season} event ${id}`); }
    }
    if (!S.scam && s.day01 >= 0.7 && s.season % 2 === 1) { S.scam = true; if (!eco.pendingOffer) eco.offerScam(); }
    // S16: the Baron's Debt Collectors land right after the Too-Good Deal moment (day 0.7, EVERY season — even seasons too, else no fight on S2/S4)
    if (sb._stormClearAt != null && sb.game.time >= sb._stormClearAt) { sb._stormClearAt = null; sb.storm?.clear(3); }   // S17/S21: only when STORM.holdSeconds > 0 (default 0 = whole season; eco:season clears it)
    // P62: the wave waits while the Baron's deal (or any dialogue) is on screen — Collectors land the moment the box closes, not frozen behind it
    if (!S.wave && s.day01 >= 0.7 && sb.enemies?.enabled !== false && !eco.pendingOffer && !(sb.modalOpen?.())) { S.wave = true; const w = sb.enemies.spawnWave(s.season); if (w.length) sb.log.push(`S${s.season} wave ${w.length} (${w.map((e) => e.kind).join(',')})`); }
  };
  sb._offs.push(bus.on('eco:season', () => { if (eco.pendingOffer) { eco.refuseOffer(); sb.log.push('deal expired → refused'); } }));
}
// tip coins: spin, bob, walk-over pickup (≤ 0.7 u) → eco.earn; one instanced mesh refresh per frame
function updateCoins(sb, dt) {
  if (!sb.coins.length) { if (sb.coinMesh.count) sb.syncCoins(); return; }
  const hp = sb.hero.root.position;
  for (let i = sb.coins.length - 1; i >= 0; i--) { const c = sb.coins[i]; c.t += dt; c.position.y = 0.12 + Math.sin(c.t * 4) * 0.04; if (Math.hypot(c.position.x - hp.x, c.position.z - hp.z) <= 0.7) sb.collectCoin(c, 'walk'); }
  sb.syncCoins();
}
function countStalls(sb) { let n = 0; for (const e of sb.build.placed.values()) if (e.id.startsWith('stall_')) n++; return n; }
// P2: hero abilities (3B) touch the economy through ctx callbacks + the bus. Nothing in 3B/4A/6A is edited; the glue is:
//   tips     every cust:paid drops a TIP coin (20 % of the sale, min 1) on the ground next to the stall. It is NOT income until Pip
//            collects it (walk over ≤ 0.7 u, or coinMagnetDash ≤ 2.2 u → onCollect → eco.earn). Max COIN_MAX coins; the oldest is lost.
//   sell()   eco.sell is wrapped: per-stall haggle charges (price ×1.1 — still "happy", baseMul ×1.3) and a growth pulse (baseMul ×(1+pct))
//   shield   bubbleShield arms sb.shield (SHIELD_S seconds) → the next scheduled event is absorbed (see scheduler) instead of applied
//   fog      fogSweep ctx.fog.push → eco.pushFog(strength) (−5 % fog per strength)
//   ledger   ledgerFlash reveals the pending Too-Good Deal (true cost = amount·(1+rate)³ or cost with payout 0) → eco.refuseOffer()
export const COIN_MAX = 32, TIP_PCT = 0.2, SHIELD_S = 30, COOLDOWN_S = 5, GROWTH_S = 12;
function wireAbilities(sb) {
  const { eco, hero, cust, vfx } = sb, bus = sb.game.bus, game = sb.game;
  // ---- tip coins: ONE InstancedMesh (1 dc), each coin = { position: Vector3, value, t } so 3B's targetPos(coin) works unchanged
  const im = new THREE.InstancedMesh(G.cyl(0.16, 0.16, 0.05, 10), flatMat(P.sparkGold), COIN_MAX);
  im.name = 'tipCoins'; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.userData.noOutline = true; im.count = 0;
  game.scene.add(im); sb.coinMesh = im; sb.coins = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  sb.syncCoins = () => { im.count = sb.coins.length; sb.coins.forEach((c, i) => { _q.setFromEuler(_e.set(Math.PI / 2, 0, c.t * 2.5)); _m.compose(c.position, _q, _s); im.setMatrixAt(i, _m); }); im.instanceMatrix.needsUpdate = true; };
  sb.dropTip = (x, z, value) => { const c = { position: new THREE.Vector3(x, 0.12, z), value: Math.max(1, Math.round(value)), t: 0 }; sb.coins.push(c); if (sb.coins.length > COIN_MAX) { const lost = sb.coins.shift(); sb.stats.tipsLost = (sb.stats.tipsLost || 0) + lost.value; } return c; };
  sb.collectCoin = (c, how = 'walk') => { const i = sb.coins.indexOf(c); if (i < 0) return 0; sb.coins.splice(i, 1); eco.earn(c.value, 'tip:' + how); sb.stats.tipsCollected = (sb.stats.tipsCollected || 0) + c.value;
    vfx.pop?.show?.(c.position.clone().setY(0.9), `+${c.value}`, { color: '#FFD54F', dur: 0.6, size: 0.8 }); bus.emit('sandbox:tip', { value: c.value, how }); return c.value; };
  sb._offs.push(bus.on('cust:paid', (p) => { if (p?.paid > 0 && p.at) { const a = Math.random() * Math.PI * 2; sb.dropTip(p.at.x + Math.cos(a) * 0.5, p.at.z + Math.sin(a) * 0.5, p.paid * TIP_PCT); } }));
  // ---- sell wrapper (haggle charges per stall + growth pulse)
  sb.haggle = new Map(); sb.growth = { mul: 1, until: -1 }; sb.shield = { until: -1 }; sb.cooldown = {};
  const baseSell = eco.sell.bind(eco);
  eco.sell = (stallId, type, price, opts = {}) => {
    const key = String(stallId).replace(/^stall_/, ''); let baseMul = opts.baseMul || 1;
    const h = sb.haggle.get(key); if (h && h.n > 0) { h.n--; if (price == null) price = eco.stallInfo(key)?.fair ?? 5; price = Math.round(price * 1.1 * 100) / 100; baseMul *= 1.3; sb.stats.haggled = (sb.stats.haggled || 0) + 1; }
    if (game.time < sb.growth.until) baseMul *= sb.growth.mul;
    return baseSell(stallId, type, price, { ...opts, baseMul });
  };
  // ---- dispatcher: sb.ability(name) → hero.playMove(name, ctx). Returns the Sequence or null (busy / cooling down).
  const near = (r) => cust.active.filter((c) => (c.state === 'walk' || c.state === 'queue' || c.state === 'browse') && c.stall && Math.hypot(c.root.position.x - hero.root.position.x, c.root.position.z - hero.root.position.z) <= r);
  const done = (name, effect) => { bus.emit('sandbox:ability', { name, effect }); sb.log.push(`${name}: ${effect}`); };
  const CTX = {
    // magnet: with joystick input the dash follows the stick (3B); idle → aim at the richest cluster = nearest coin, dash far enough to reach it (≤ 6 u)
    coinMagnetDash: () => {
      const ctx = { coins: sb.coins.slice(), radius: 2.2, onCollect: (c) => sb.collectCoin(c, 'magnet') };
      const hp = hero.root.position, inp = game.input;
      if (!(inp?.move?.lengthSq() > 0.05) && sb.coins.length) {
        let best = null, bd = Infinity; for (const c of sb.coins) { const d = Math.hypot(c.position.x - hp.x, c.position.z - hp.z); if (d < bd) { bd = d; best = c; } }
        if (best) { ctx.dir = new THREE.Vector3(best.position.x - hp.x, 0, best.position.z - hp.z).normalize(); ctx.dashDist = Math.min(6, Math.max(1, bd + 0.5)); }
      }
      return ctx;
    },
    haggleShout: () => { let t = near(4.5); if (!t.length) t = near(99).sort((a, b) => a.root.position.distanceToSquared(hero.root.position) - b.root.position.distanceToSquared(hero.root.position)).slice(0, 3); return { targets: t, text: t.length ? '+10%!' : 'DEAL?', onShout: (tg) => { if (!tg?.stall) return; const k = String(tg.stall.id).replace(/^stall_/, ''); const h = sb.haggle.get(k) || { n: 0 }; h.n++; sb.haggle.set(k, h); done('haggleShout', `${k} next sale price ×1.1, demand ×1.3 (${h.n} charged)`); } }; },
    growthStomp: () => ({ onPulse: (i, r, pct) => { sb.growth = { mul: 1 + pct / 100, until: game.time + GROWTH_S }; if (i === 2) done('growthStomp', `all stalls demand ×${(1 + pct / 100).toFixed(2)} for ${GROWTH_S} s`); } }),
    bubbleShield: () => ({ event: sb.nextEvent ? (eco.events[sb.nextEvent]?.title || sb.nextEvent) : 'next event', onAbsorb: () => { sb.shield.until = game.time + SHIELD_S; done('bubbleShield', `shield armed ${SHIELD_S} s — next event absorbed`); } }),
    fogSweep: () => ({ fog: { push: (o, d, s) => { const before = eco.state.fog01; eco.pushFog(s); done('fogSweep', `fog ${(before * 100) | 0}% → ${(eco.state.fog01 * 100) | 0}%`); } } }),
    ledgerFlash: () => { const o = eco.pendingOffer; if (!o) return { cost: 0, trueCost: 0, text: 'no deal on the table', onReveal: () => done('ledgerFlash', 'nothing to reveal') };
      const cost = o.cost || o.amount || 0, trueCost = o.amount ? Math.round(o.amount * Math.pow(1 + (o.trueRate || 0), 3)) : cost;
      return { cost, trueCost, text: o.payout === 0 ? `TRUE COST: ${cost} → you get 0` : undefined, onReveal: () => { eco.refuseOffer(o); done('ledgerFlash', `${o.title} revealed (true cost ${trueCost}) → refused`); } }; },
  };
  sb.ability = (name) => {
    if (!CTX[name] || !ABILITY_NAMES().includes(name)) return null;
    if ((sb.cooldown[name] || -1) > game.time) { bus.emit('sandbox:denied', { name, why: 'cooldown' }); return null; }
    const seq = hero.playMove(name, CTX[name]());
    if (seq) { sb.cooldown[name] = game.time + COOLDOWN_S; bus.emit('sandbox:ability:start', { name, cooldown: COOLDOWN_S }); }   // S08: touch strip starts its sweep here
    else bus.emit('sandbox:denied', { name, why: 'busy' });
    return seq;
  };
}
// Debug keys (prompt P1): B build mode for the current pick · 1–9 pick a stall type · E end season (LedgerReport → console)
// · H hire next helper (P3) · Z unlock next zone (buys the zone upgrade when affordable, else free in sandbox) · X demolish nearest
// · U upgrade nearest · R rotate ghost · Esc exit build. Every key is a method on sb.keys so check.mjs can drive it without a DOM.
function installDebugKeys(sb) {
  const K = sb.keys = {
    pick(i) { sb.pick = Math.max(0, Math.min(STALL_PICKS.length - 1, i | 0)); const id = 'stall_' + STALL_PICKS[sb.pick]; sb.game.bus.emit('sandbox:pick', { id, cost: sb.build.cost(id) }); if (sb.build.mode === 'place') sb.build.enter(id); return id; },
    build() { const id = 'stall_' + STALL_PICKS[sb.pick]; if (sb.build.mode === 'place') { sb.build.exit(); return false; } return sb.build.enter(id); },
    confirm() { return sb.build.mode === 'place' ? sb.build.confirm() : false; },
    rotate() { return sb.build.rotate(); },
    exit() { sb.build.exit(); },
    endSeason() { const r = sb.eco.endSeason(); if (r) printLedger(r); return r; },
    demolish() { const e = sb.build.nearest(sb.hero.root.position.x, sb.hero.root.position.z, 2.5); return e && !e.scenery ? sb.build.demolish(e) : false; },
    upgrade() { const e = sb.build.nearest(sb.hero.root.position.x, sb.hero.root.position.z, 2.5); return e && !e.scenery ? sb.build.upgrade(e) : false; },
    unlock() { const z = sb.island.nextLockedZone(); if (!z) return null; const up = Object.values(UPGRADES).find((u) => u.kind === 'zone' && u.effect.zone === z.index); if (up && sb.eco.canAfford(up.cost)) return sb.eco.buyUpgrade(up.id); return sb.island.unlockZone(z.index, { game: sb.game, vfx: sb.vfx }); },
    hire() { return hireHelper(sb); },
    ability(name) { return sb.ability(name); },
  };
  if (sb.headless || sb.opts.debugKeys === false || typeof window === 'undefined' || !window.addEventListener) return;   // 10C passes debugKeys:false (E/R/1–9 are ability + dialogue keys there)
  sb._onKey = (e) => {
    if (e.repeat) return; const c = e.code;
    if (c.startsWith('Digit')) { const d = +c.slice(5); if (d >= 1 && d <= 9) K.pick(d - 1); }
    else if (c === 'KeyB') K.build(); else if (c === 'KeyE') K.endSeason(); else if (c === 'KeyH') K.hire(); else if (c === 'KeyZ') K.unlock();
    else if (c === 'KeyX') K.demolish(); else if (c === 'KeyU') K.upgrade(); else if (c === 'KeyR' && sb.build.mode === 'place') K.rotate(); else if (c === 'Escape') K.exit();
  };
  window.addEventListener('keydown', sb._onKey);
  const prevTap = sb.game.input.onTap;
  const tap = sb.game.input.onTap = (world, ev) => {
    if (sb.build?.mode === 'place') { sb.build.moveTo(world.x, world.z); sb.build.confirm(); return; }
    if (prevTap) prevTap(world, ev);
  };
  // BUGFIX: unwrap on teardown — every PLAY used to add another layer that still closed over the destroyed sandbox
  (sb._offs ||= []).push(() => { if (sb.game.input && sb.game.input.onTap === tap) sb.game.input.onTap = prevTap; });
}
function printLedger(r) {
  const row = (k, v) => `  ${k.padEnd(14)} ${String(v).padStart(8)}`;
  console.log(`LedgerReport — Season ${r.season}  ★${r.stars}  lesson: ${r.lessonId}\n` + [row('income', r.income), row('expenses', r.expenses), row('interestEarned', r.interestEarned), row('interestPaid', r.interestPaid), row('investReturn', `${r.investReturn} (${(r.investRate * 100).toFixed(1)}%)`), row('upkeep', r.upkeep), row('sales/units', `${r.sales}/${r.units}`), row('saved', r.saved), row('debt', `${r.debtBefore} → ${r.debt}`), row('fog', `${(r.fog01 * 100).toFixed(0)}% (${r.fogDelta >= 0 ? '+' : ''}${(r.fogDelta * 100).toFixed(1)})`), row('spark', r.spark), row('netWorth', r.netWorth), row('events', r.events.join(', ') || '—')].join('\n'));
}
// P3: hire the next un-hired helper (eco.buyUpgrade helper_<type>) and give it a work loop at an owned stall.
// BUGFIX restore: `hireHelper(sb, type, { free: true })` spawns a specific helper WITHOUT buying (the upgrade is already in eco.state.owned
// after deserialize, so buyUpgrade would refuse with 'owned' and the helper never came back after CONTINUE).
function hireHelper(sb, wantType = null, { free = false } = {}) {
  const owned = new Set(sb.helpers.map((h) => h.type));
  const type = wantType && HELPER_TYPES.includes(wantType) && !owned.has(wantType) ? wantType : HELPER_TYPES.find((t) => !owned.has(t)); if (!type) return null;
  const u = free ? (sb.eco.grantUpgrade?.('helper_' + type) || sb.eco.upgrades?.['helper_' + type] || { cost: 0 }) : sb.eco.buyUpgrade('helper_' + type);
  if (!u) { sb.game.bus.emit('eco:denied', { why: 'cannot afford', id: 'helper_' + type }); return null; }
  const stalls = [...sb.build.placed.values()].filter((e) => e.id.startsWith('stall_'));
  const stall = stalls[sb.helpers.length % Math.max(1, stalls.length)] || null;
  const g = makeHelper(type, { seed: sb.helpers.length + 1 });
  sb.game.scene.add(g);
  const anim = new HelperAnimator(g, type, { vfx: sb.vfx });
  const h = { g, anim, type, stall: null, upgrade: u }; sb.helpers.push(h);
  seatHelper(sb, h, stall);
  sb.game.bus.emit('sandbox:hired', { type, stall: stall?.id || null, cost: u.cost });
  return h;
}
/** Stand helper `h` behind `stall` (or next to Pip, idle, when there is none). BUGFIX P31: also used to re-seat orphans. */
function seatHelper(sb, h, stall) {
  const at = stall ? stall.group.position : sb.hero.root.position;
  const back = new THREE.Vector3(0, 0, -0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), stall ? stall.group.rotation.y : 0);
  let sx = at.x + back.x, sz = at.z + back.z;
  // S34 / P81: idle helpers (no stall) fan out around Pip on LAND instead of stacking on one (possibly water) spot
  if (!stall) {
    const n = sb.helpers.filter((o) => o !== h && !o.stall).length;
    for (let k = 0; k < 8; k++) { const a = ((n + k) / 8) * Math.PI * 2 + Math.PI; const x = at.x + Math.sin(a) * 0.9, z = at.z + Math.cos(a) * 0.9; if (sb.island.isLand(x, z) && !sb.build.occupied(x, z)) { sx = x; sz = z; break; } }
    if (!sb.island.isLand(sx, sz)) { sx = at.x; sz = at.z; }
  }
  h.g.position.set(sx, 0, sz); h.stall = stall || null;
  h.seat = { x: sx, z: sz, fx: at.x - back.x * 3, fz: at.z - back.z * 3 };   // S32: remembered so a knocked helper can walk back
  h.anim.knock?.set?.(0, 0, 0); h.anim.knockT = 0;   // S34 / P68: a mid-slide reseat must not keep sliding away from the new seat
  // S32: the seat is INSIDE its own stall's footprint cell (0.9 u behind a 2-wide counter), so the clamp must allow the helper's
  // own stall or no shove could ever move it; other stalls + water still block (caught by check.mjs --knockback).
  h.anim.canStand = (x, z) => { if (!sb.island.isLand(x, z)) return false; const o = sb.build.occupied(x, z); return !(o && o !== h.stall && o.id?.startsWith?.('stall_')); };
  h.anim.faceToNow(new THREE.Vector3(at.x - back.x * 3, 0, at.z - back.z * 3)); h.anim.play(stall ? 'work' : 'idle');
  h.returning = false;
}
/** S32: hired helpers as sword targets. Hitting one is harmless (no Spark cost) — it slides, flashes red, says a line, then walks back. */
function helperTargets(sb) {
  return sb.helpers.map((h) => ({ root: h.g, helper: h, hit: (dir, power) => {
    h.anim.hit(dir, power); h.anim.play?.('idle'); h.returning = true; h.hitCount = (h.hitCount || 0) + 1;
    if (h.hitCount % 3 === 1) sb.vfx?.pop?.show?.(h.g.position, HELPER_OUCH[h.type] || 'Oi!', { color: '#FFAB91' });
    sb.game.bus.emit('helper:hit', { type: h.type, count: h.hitCount });
  } }));
}
const HELPER_OUCH = { tallyOwl: 'Hoo-rude!', packMole: 'Oof!', sparkBee: 'Bzzt!', scoutFox: 'Yip!', gardenerSnail: 'Sloooow down!', guardTortoise: 'Hmph.' };
const HELPER_WALK = 1.6;   // u/s walking back to the seat after a knockback
/** S32: once the slide ends a knocked helper walks straight back to its seat (stalls are never between seat and shove point → no pathing). */
function updateHelperKnock(sb, h, dt) {
  if (!h.returning || !h.seat || h.anim.knocked) return;
  const p = h.g.position, dx = h.seat.x - p.x, dz = h.seat.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.08) { p.x = h.seat.x; p.z = h.seat.z; h.returning = false; h.anim.faceToNow(new THREE.Vector3(h.seat.fx, 0, h.seat.fz)); h.anim.play(h.stall ? 'work' : 'idle'); return; }
  if (h.anim.current !== 'walk') h.anim.play('walk');
  const step = Math.min(d, HELPER_WALK * dt); const nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
  // S34 / P69: the walk back respects the same clamp as the slide (other stalls / water); fully blocked → skip the detour and snap home
  const ok = h.anim.canStand || (() => true);
  if (ok(nx, nz)) { p.x = nx; p.z = nz; } else if (ok(nx, p.z)) p.x = nx; else if (ok(p.x, nz)) p.z = nz; else { p.x = h.seat.x; p.z = h.seat.z; }
  h.anim.faceTo(new THREE.Vector3(h.seat.x, 0, h.seat.z));
}
/** BUGFIX P31: a helper whose stall was sold/demolished (or who was hired with no stall) moves to the least-staffed remaining stall. */
function reseatHelpers(sb) {
  const stalls = [...sb.build.placed.values()].filter((e) => e.id.startsWith('stall_'));
  const alive = new Set(stalls);
  const load = (e) => sb.helpers.filter((o) => o.stall === e).length;
  for (const h of sb.helpers) {
    if (h.stall && alive.has(h.stall)) continue;
    if (!stalls.length) { if (h.stall) seatHelper(sb, h, null); continue; }
    const target = stalls.slice().sort((a, b) => load(a) - load(b))[0];
    seatHelper(sb, h, target);
  }
  // S34 / P81: rebalance — while some stall has nobody and another has 2+ (or a helper idles with no stall), move one over
  if (stalls.length) for (let guard = 0; guard < sb.helpers.length; guard++) {
    const empty = stalls.find((e) => load(e) === 0); if (!empty) break;
    const mover = sb.helpers.find((h) => !h.stall) || sb.helpers.find((h) => load(h.stall) >= 2); if (!mover) break;
    seatHelper(sb, mover, empty);
  }
}

// =====================================================================================================================
// 10C — THE GAME. `createLumenGame(game, { ui, story })` = state machine + UI ↔ systems glue on top of createSandbox().
//   import { mountUI } from './ui/index.js'; import { createLumenGame } from './src/Game.js';
//   const ui = mountUI(root, { bus: game.bus, … });  const lg = createLumenGame(game, { ui, storyData });  game.start();
//   headless: createLumenGame(mockGame, { ui: mockUi, storyData, headless: true, seasonSeconds: 20 })   (tools/check.mjs --game)
// States: 'title' → ('playing' ⇄ 'review') → 'ending' → 'endless' | 'title'.  Everything is driven by bus events:
//   ui:start {mode}        title → build the sandbox (createSandbox) → playing. mode 'endless' → no story, no win gate.
//   eco:season report      playing → review  (8B plays ledger lines first; `story:review` → ui.ledger.show(report))
//   ui:continue {outcome}  review → playing ('season') · → endless ('win') · → title ('lose')
//   eco:win / eco:lose     → ending (8B finale lines) → story:finale → endless | title
//   ui:pause {on, by}      pause reasons are OR-ed (menu ∨ dialogue ∨ ledger ∨ title) into game.paused — the only place that touches it.
// Nothing here edits a system; it only constructs, routes and owns `lg.state`.
export const GAME_VERSION = 'S36';   // S36 (2026-10-27): drag any bought prop (stalls, decor, fences) to a new spot — Game_Bible S36.md in LUMEN_extras/
export const GAME_STATES = ['title', 'playing', 'review', 'ending', 'endless'];
export const ABILITY_KEYS = { KeyQ: 'coinMagnetDash', KeyW: 'bubbleShield', KeyE: 'growthStomp', KeyR: 'ledgerFlash', KeyF: 'haggleShout', KeyG: 'fogSweep' };   // = FINLIT[name].key (3B)

/**
 * @param {object} game  core Game (or the check.mjs mock)
 * @param {{ui:object, storyData?:object, headless?:boolean, seasonSeconds?:number, seed?:number, autoStart?:boolean, mode?:string}} opts
 *   ui = mountUI() result (or a mock with the same shape). storyData = parsed data/story.json (null → no story, sandbox pacing only).
 */
export function createLumenGame(game, opts = {}) {
  const bus = game.bus, ui = opts.ui || null;
  const lg = { game, ui, bus, opts, version: GAME_VERSION, state: 'title', mode: 'story', sb: null, story: null, pauseBy: new Set(), log: [], stats: { starts: 0, seasons: 0, reviews: 0, finales: 0 } };
  const offs = []; lg._offs = offs; const on = (n, f) => offs.push(bus.on(n, f));

  lg.setState = (s) => { if (!GAME_STATES.includes(s)) throw new Error('bad state ' + s); const prev = lg.state; lg.state = s; lg.log.push(`${prev} → ${s}`); bus.emit('game:state', { state: s, prev }); return s; };
  // ---- pause: OR of every reason. game.paused is written ONLY here. --------------------------------------------------
  lg.pause = (by, on_) => { if (on_) lg.pauseBy.add(by); else lg.pauseBy.delete(by); const p = lg.pauseBy.size > 0; if (game.paused !== p) { game.paused = p; bus.emit('game:paused', { paused: p, by: [...lg.pauseBy] }); } return p; };
  // ---- S28 time speed: 1× / 2× / 3×. game.timeScale is written ONLY here (and zeroed/restored by HitStop, which we keep in sync). -------
  //   lg.setSpeed(n) · ui:speed {speed} or {cycle:true} (HUD ⏩ button, key T) · emits game:speed {speed}. Reset to 1× on season end,
  //   win/lose, title and whenever a dialogue/ledger/menu pauses the game (so a cut-scene never runs at 3×).
  const SPEEDS = [1, 2, 3]; lg.speed = 1;
  lg.setSpeed = (n, { silent } = {}) => {
    n = SPEEDS.includes(+n) ? +n : 1; lg.speed = n;
    if (game.hitStop?.active) { const i = game.hitStop.targets.indexOf(game); if (i >= 0) game.hitStop.saved[i] = n; } else game.timeScale = n;
    bus.emit('game:speed', { speed: n });
    if (!silent && lg.sb) bus.emit('ui:toast', { text: n > 1 ? `Time ×${n} — tap ⏩ or press T to slow down` : 'Normal speed', kind: 'info', icon: '⏩', id: 'speed', duration: 1400 });
    return n;
  };
  lg._offs.push(bus.on('ui:speed', (p) => { if (!lg.sb || (lg.state !== 'playing' && lg.state !== 'endless')) return; const next = p?.cycle ? SPEEDS[(SPEEDS.indexOf(lg.speed) + 1) % SPEEDS.length] : p?.speed; lg.setSpeed(next); }));
  lg._offs.push(bus.on('game:paused', (p) => { if (p?.paused && lg.speed !== 1) lg.setSpeed(1, { silent: true }); }));
  for (const ev of ['eco:season', 'eco:win', 'eco:lose', 'game:title', 'game:state']) lg._offs.push(bus.on(ev, () => { if (lg.speed !== 1) lg.setSpeed(1, { silent: true }); }));
  if (typeof window !== 'undefined') { const onKey = (e) => { if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return; if (!lg.sb || game.paused || ui?.isModal?.()) return; bus.emit('ui:speed', { cycle: true, source: 'key' }); }; window.addEventListener('keydown', onKey); lg._offs.push(() => window.removeEventListener('keydown', onKey)); }
  on('ui:pause', (p) => lg.pause(p?.by || 'menu', !!p?.on));
  on('ui:ledger:open', () => lg.pause('ledger', true)); on('ui:ledger:close', () => lg.pause('ledger', false));
  on('ui:title:open', () => lg.pause('title', true)); on('ui:title:close', () => lg.pause('title', false));
  if (ui?.title?.isOpen) lg.pause('title', true);

  // ---- state machine ------------------------------------------------------------------------------------------------------
  installStart(lg);
  installSeasonLoop(lg);
  installMenu(lg);
  installSave(lg);                                                                  // 10D: autosave + ui:start {mode:'continue'} + tutorial gates
  installCinematics(lg);                                                            // S18: title orbit showcase · arrival walk-in · victory lighthouse

  // ---- loop: UI clock + story clock + HUD day bar -------------------------------------------------------------------------
  lg.update = (dt, _g, dtReal) => {
    ui?.update?.(dtReal ?? dt);                                                       // UI animates even while the game is paused
    lg.cine?.update(dtReal ?? dt);                                                    // S18: cinematics run on the real clock (title is paused)
    if (lg.sb && !game.paused) { lg.story?.update?.(dt); emitTick(lg); lg.tut?.update?.(dt); }
  };
  game.add({ update: (dt, g, dtReal) => lg.update(dt, g, dtReal) });
  lg.destroy = () => { for (const f of offs) f(); offs.length = 0; lg.teardown?.(); lg.cine?.dispose?.(); lg.cine = null; };
  bus.emit('game:ready', { version: GAME_VERSION });
  return lg;
}
// eco:tick {day01, season} at ≤ 10 Hz for the HUD day bar (7A listens; 4A never emits it — integrator's job).
function emitTick(lg) {
  const s = lg.sb.eco.state, t = lg.game.time; if (lg._tickAt != null && t - lg._tickAt < 0.1) return; lg._tickAt = t;
  lg.bus.emit('eco:tick', { day01: s.day01, season: s.season, spark: s.spark });
}
// ui:start {mode} → createSandbox (story: default BALANCE · endless: winRequiresSeasons:false, no scams) → StorySystem (story mode only,
// when opts.storyData is given) → hud.sync → title.hide() → 'playing'. A second ui:start (restart / back-to-title) tears the old run down first.
function installStart(lg) {
  const { game, bus, ui, opts } = lg;
  lg.start = (mode = 'story') => {
    const fresh = !!lg._freshPlay; lg._freshPlay = false;                               // S18: set by the ui:start handler (PLAY button) only
    lg.cine?.stop(true);                                                                // S18: title orbit ends (silent — no cine:end)
    lg.mode = mode === 'endless' ? 'endless' : 'story';
    // S18: a fresh story PLAY re-uses the island that was already built for the title backdrop (same seed/balance, starter stalls) —
    //   no second build, no visual pop. Resume (starterStalls:false) / endless (other balance) tear it down and build their own.
    const reuse = lg.showcaseSb && !lg._resuming && lg.mode === 'story' && !lg.sb ? lg.showcaseSb : null;
    if (reuse) lg.showcaseSb = null;                                                   // keep it out of teardown's way
    lg.teardown?.();
    const balance = lg.mode === 'endless' ? { ...(opts.balance || {}), winRequiresSeasons: false, endless: true } : opts.balance;
    const sb = lg.sb = reuse || createSandbox(game, { headless: !!opts.headless, seasonSeconds: opts.seasonSeconds, seed: opts.seed, balance, zonesUnlocked: opts.zonesUnlocked, maxActive: opts.maxActive, debugKeys: !!opts.debugKeys, starterStalls: lg._resuming ? false : undefined });
    if (reuse) { lg.stats.showcaseReused = (lg.stats.showcaseReused || 0) + 1; game.followTarget = sb.hero.root.position; }
    sb.modalOpen = () => !!(ui?.dialogue?.isOpen || ui?.ledger?.isOpen);                 // P62: the Collector wave waits for the dialogue box to close
    if (lg.mode === 'endless') sb.updateScheduler = wrapNoScam(sb);                      // endless: events yes, Baron's deals no
    lg.story = (lg.mode === 'story' && opts.storyData) ? new StorySystem(sb.eco, { data: opts.storyData, bus, ledgerLinesBeforeReview: true, autoAdvance: !!opts.autoAdvance, lineGap: opts.lineGap }) : null;
    if (lg._resuming?.story && lg.story) Object.assign(lg.story.state, StorySystem.deserialize(lg._resuming.story, sb.eco, { data: opts.storyData, autoplay: false }).state);   // 10D: before title.hide() → no toast replay
    installRunWires(lg);
    ui?.hud?.sync?.(sb.eco.state); ui?.jars?.setBalances?.(sb.eco.state.jars); ui?.jars?.setDebt?.(sb.eco.state.debt, sb.eco.state.spark); ui?.build?.setSpark?.(sb.eco.state.spark);
    lg.stats.starts++;
    ui?.title?.hide?.(); lg.pause('title', false);
    lg.setState('playing');
    // S18: the arrival walk-in (pier → plaza) plays on a FRESH story PLAY only — before game:start so the tutorial sees cine:begin first.
    if (lg.cine && fresh && !lg._resuming && lg.mode === 'story') lg.cine.play('arrival', { sb, story: lg.story });
    bus.emit('game:start', { mode: lg.mode, seasonsToWin: sb.eco.config.seasonsToWin, seasonSeconds: sb.eco.config.seasonSeconds });
    return sb;
  };
  lg.teardown = () => {
    if (lg.showcaseSb) { destroySandbox(lg.showcaseSb); lg.showcaseSb = null; }      // S18: title backdrop island
    if (!lg.sb) return;
    if (lg.cine?.active && lg.cine.active !== 'title') lg.cine.stop(true);
    lg.story?.destroy?.(); lg.story = null;
    for (const f of lg._runOffs || []) f(); lg._runOffs = [];
    destroySandbox(lg.sb); lg.sb = null;
    lg.pauseBy.clear(); lg.pause('none', false);
  };
  lg._offs.push(bus.on('ui:start', (p) => { if (lg.state !== 'title') return; if (p?.mode === 'continue' && lg.resume?.()) return; lg._freshPlay = p?.mode !== 'continue'; lg.start(p?.mode === 'continue' ? 'story' : p?.mode); }));
}
// P3 — pause menu + settings (7C): ui:restart → same mode from season 1 (10D will restart from its save point) · ui:title → teardown →
// title · ui:settings quality → game.setQuality?.() / pixel ratio (11A owns presets; outline is already wired by 7C's onOutline).
function installMenu(lg) {
  const { bus, game, ui } = lg, on = (n, f) => lg._offs.push(bus.on(n, f));
  // BUGFIX B12: RESTART SEASON really restarts the CURRENT season — from the checkpoint snapshot taken at the season's start
  // (lg.seasonCheckpoint, set by installSave). No checkpoint (old run / headless without save) → fresh run as before.
  on('ui:restart', () => { if (!lg.sb) return; const mode = lg.mode, snap = lg.seasonCheckpoint || null; lg.teardown(); lg.setState('title'); if (!(snap && lg.resume?.(snap))) lg.start(mode); bus.emit('game:restart', { mode, season: lg.sb?.eco.state.season || 1, fromCheckpoint: !!snap }); });
  // BUGFIX B17: a deliberate quit to TITLE keeps everything since the last checkpoint (was: silently dropped). Finished/ending runs do not save.
  on('ui:title', () => { if (lg.state === 'title') return; if (lg.sb && !lg.sb.eco.state.ended && lg.state !== 'ending') lg.save?.write?.(); lg.toTitle('menu'); });
  on('ui:settings', (p) => {
    if (!p) return; lg.settings = p.settings || lg.settings;
    if (p.key === 'quality') applyQuality(lg, p.value);
    if (p.key === 'reduceMotion') applyReduceMotion(lg, !!p.value);
  });
  // S02 (2026-10-23): the PixelRatioGovernor demoted the preset (high → medium → low) because the phone could not hold 50+ fps at the DPR
  //   floor. Mirror it into the pause-menu setting (so it persists and the menu shows it) and tell the player once per step.
  on('perf:quality', (p) => {
    if (!p?.to) return; lg.stats.demotions = (lg.stats.demotions || 0) + 1;
    // pause.setSetting renders the segmented control + persists; its ui:settings echo re-calls setQuality with the SAME preset — a no-op
    // (governor.recap ignores an unchanged cap, so the DPR floor is kept).
    if (ui?.pause?.setSetting) ui.pause.setSetting('quality', p.to); else if (ui?.pause?.settings) ui.pause.settings.quality = p.to;
    bus.emit('ui:toast', { text: `Graphics set to ${p.to} to keep 60 fps (change it in ⏸ Settings)`, kind: 'info', icon: '⚡', id: 'perf-quality', duration: 3500 });
  });
  applyReduceMotion(lg, !!ui?.pause?.settings?.reduceMotion);
  // BUGFIX B22: the stored quality setting is applied on boot too (was: only on a menu click, and then only the DPR).
  if (ui?.pause?.settings?.quality) applyQuality(lg, ui.pause.settings.quality);
}
// =====================================================================================================================
// S18 — cinematics glue. One CinematicDirector per lg (lg.cine). Three shots:
//   • title showcase: while the title is open and no run exists, a "showcase" sandbox (same seed/balance a fresh PLAY would get,
//     starter stalls) is built and the camera orbits it (shot 'title'). body.ll-title-3d turns the DOM sky translucent. PLAY reuses
//     that sandbox (lg.start), so there is no second build; CONTINUE / ENDLESS tear it down. Headless (opts.headless) → no showcase
//     unless opts.showcase === true (check.mjs); opts.cinematics === false → nothing at all (?nocine).
//   • arrival: lg.start plays it on a fresh story PLAY (see installStart). cine:begin → body.ll-cine-on (HUD fades), cine:end → removed.
//   • victory: installSeasonLoop plays it on eco:win; the ending lines wait (story.hold) until the shot ends.
export function installCinematics(lg) {
  const { game, bus, ui, opts } = lg, on = (n, f) => lg._offs.push(bus.on(n, f));
  // default: on in the browser, off headless (check.mjs --game/--save keep their timings; --cinematics passes cinematics:true)
  if (!(opts.cinematics ?? !opts.headless)) { lg.cine = null; return; }
  lg.cine = new CinematicDirector(game, { container: game.container, headless: !!opts.headless, reduceMotion: () => !!lg.reduceMotion });
  lg.showcaseSb = null;
  const body = typeof document !== 'undefined' ? document.body : null;
  const wantShowcase = () => (opts.showcase ?? !opts.headless) && lg.state === 'title' && !lg.sb && !lg.showcaseSb && game.scene;
  lg.showcase = () => {
    if (!wantShowcase()) return null;
    try { lg.showcaseSb = createSandbox(game, { headless: !!opts.headless, seasonSeconds: opts.seasonSeconds, seed: opts.seed, balance: opts.balance, zonesUnlocked: opts.zonesUnlocked, maxActive: opts.maxActive, debugKeys: !!opts.debugKeys }); }
    catch (err) { console.warn('[cine] showcase build failed:', err?.message || err); lg.showcaseSb = null; return null; }
    const sb = lg.showcaseSb; sb.showcase = true;
    sb.reduceMotion = !!lg.reduceMotion; if (sb.vfx) sb.vfx.reduceMotion = !!lg.reduceMotion;
    game.followTarget = null;                                                           // the follow cam must not chase Pip under the orbit
    lg.cine.play('title', { sb });
    body?.classList.add('ll-title-3d'); lg.stats.showcases = (lg.stats.showcases || 0) + 1;
    bus.emit('cine:showcase', { on: true });
    return sb;
  };
  const endShowcase = () => { if (lg.cine?.active === 'title') lg.cine.stop(true); body?.classList.remove('ll-title-3d'); };
  on('cine:begin', (p) => { if (p?.shot !== 'title') body?.classList.add('ll-cine-on'); });
  on('cine:end', () => body?.classList.remove('ll-cine-on'));
  on('game:start', () => { endShowcase(); body?.classList.remove('ll-title-3d'); });
  on('game:title', () => { if (lg.cine?.active) lg.cine.stop(true); body?.classList.remove('ll-cine-on'); lg.showcase(); });
  on('ui:settings', (p) => { if (p?.key === 'reduceMotion' && lg.showcaseSb) { lg.showcaseSb.reduceMotion = !!p.value; if (lg.showcaseSb.vfx) lg.showcaseSb.vfx.reduceMotion = !!p.value; } });
  // boot: the title is already open when createLumenGame runs (index.html mounts the UI first) → start the showcase right away
  if (lg.state === 'title' && (ui?.title?.isOpen ?? true)) lg.showcase();
}
// BUGFIX B22: one quality path — Core Game.setQuality applies DPR cap + shadows + shadow-map size (antialias needs a reload: Game reports
// quality.antialiasPending). Headless Game stubs without setQuality fall back to the DPR-only cap.
function applyQuality(lg, value) {
  const { game } = lg; if (!value) return;
  if (typeof game.setQuality === 'function') game.setQuality(value);
  else if (game.renderer?.setPixelRatio && typeof devicePixelRatio !== 'undefined') game.renderer.setPixelRatio(Math.min(devicePixelRatio, { low: 1, medium: 1.25, high: 1.5 }[value] || 1.25));
}
// BUGFIX B23: Reduce Motion is applied to the run that is live AND to every later run (installRunWires calls this), and it is consumed:
// camera trauma shake off, hit-stop off, pulses/beams damped (vfx.reduceMotion read by pack2 where present).
function applyReduceMotion(lg, on) {
  lg.reduceMotion = on;
  if (lg.game?.camera) lg.game.camera.reduceMotion = on;
  if (lg.game?.hitStop) lg.game.hitStop.disabled = on;
  if (lg.sb) { lg.sb.reduceMotion = on; if (lg.sb.vfx) lg.sb.vfx.reduceMotion = on; }
}
// endless: keep the 10B scheduler's events, drop the Too-Good Deal (scams are a story beat).
function wrapNoScam(sb) { const inner = sb.updateScheduler; return () => { inner?.(); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); }; }
// remove the sandbox from the scene + loop and release its bus listeners (createSandbox has no destroy — 10B owns it, so this is glue).
/** 11A P3: per-run GPU memory is freed here — baked batches (per-run vertex-colored geometry), fused/merged creature geometry
 *  (hero kit, helpers, pooled + active customers), instanced fields, tip-coin mesh. Shared catalogue geometry stays (module-level caches). */
export function destroySandbox(sb) {
  const { game } = sb;
  for (const f of sb._offs || []) f(); sb._offs = [];
  if (sb._onKey && typeof window !== 'undefined') window.removeEventListener('keydown', sb._onKey);
  sb.build?.exit?.(true); sb.build?.unbind?.();   // BUGFIX P44: leave input.onAction chain
  game.systems = game.systems.filter((s) => s !== sb._system && s !== sb.vfx && s !== sb.hero?._lateSystem);   // BUGFIX B05
  sb.perf?.dispose?.();
  disposeVfx(sb.vfx, game.scene);                                                     // BUGFIX B03/B04: run-owned fog, vignette, pulses, pools
  const freeMerged = (root) => root && root.traverse((o) => { if (o.isMesh && o.geometry && /^merged_/.test(o.name)) o.geometry.dispose(); });
  if (sb.hero?.root) { freeMerged(sb.hero.root); game.scene.remove(sb.hero.root); }
  for (const p of Object.values(sb.hero?.props || {})) if (p?.parent === game.scene) game.scene.remove(p);   // 3A coin + 3B magnetCoins/rings/arc live in world space
  if (sb.coinMesh) { game.scene.remove(sb.coinMesh); sb.coinMesh.geometry?.dispose?.(); }
  for (const h of sb.helpers || []) { h.anim?.dispose?.(); freeMerged(h.g); game.scene.remove(h.g); }
  for (const v of (sb.villains || []).slice()) { const g = v.g || v.root || v; freeMerged(g); g.removeFromParent?.(); }
  sb.enemies?.dispose?.();                                                            // S16: fog puff pool + list
  sb.storm?.dispose?.();                                                              // S17: streak mesh + DOM overlay, sky/lights restored
  // customers: active roots are released into the pool first (keeps their state machine consistent), then every pooled root is freed
  for (const c of sb.cust?.active?.slice?.() || []) sb.cust._release(c);
  for (const list of sb.cust?.pool?.values?.() || []) { for (const c of list) sb.cust._dispose(c); list.length = 0; }
  sb.cust?.dispose?.();
  for (const e of sb.build?.placed?.values?.() || []) if (e.group?.parent) { e.group.parent.remove(e.group); e.group.userData.dispose?.(); }
  for (const b of sb.world?.baked || []) disposeBatch(b);
  if (sb.island?.group) { sb.island.group.traverse((o) => { if (o.isInstancedMesh) o.geometry?.dispose?.(); }); game.scene.remove(sb.island.group); }
  game.followTarget = null;
  sb.destroyed = true;
}
/** BUGFIX B03/B04: everything the run's VFX put into the scene / DOM goes away with the run (was +26 scene children per restart,
 *  and the purple debt vignette of the old run stayed on screen forever). Packs first (they restore vfx.update), then the base pools. */
export function disposeVfx(vfx, scene) {
  if (!vfx || vfx._counts) return;                                                    // headless mockVfx
  try { vfx.pack2?.dispose?.(); } catch (_) { /* already gone */ }
  try { vfx.pack1?.dispose?.(); } catch (_) { /* already gone */ }
  const rm = (o) => { if (!o) return; o.parent?.remove(o); o.traverse?.((m) => { if (m.isMesh || m.isSprite || m.isInstancedMesh) { m.geometry?.dispose?.(); const ms = Array.isArray(m.material) ? m.material : [m.material]; for (const x of ms) { x?.map?.dispose?.(); x?.dispose?.(); } } }); };
  rm(vfx.dust?.mesh); rm(vfx.slash?.pivot); rm(vfx.sparks?.mesh);
  for (const it of vfx.pop?.items || []) rm(it.sp);
  vfx.flash?.el?.remove?.();
  for (const p of Object.values(vfx.pools || {})) { try { p.dispose?.(); } catch (_) { /* pool without dispose */ } }
  if (scene) for (const o of scene.children.slice()) if (o.userData?.vfxOwner === vfx) scene.remove(o);
}
// Per-run wires (released on teardown): UI → systems. 7A build tray → BuildSystem (5) · 7A jars APPLY → eco.allocate from the pouch ·
// hero ability keys (3B FINLIT keys) → sb.ability · 7C touch 'build' button → tray · tap in demolish mode → build.demolish.
function installRunWires(lg) {
  const { bus, ui, sb } = lg, offs = lg._runOffs = [], on = (n, f) => offs.push(bus.on(n, f));
  const { build, eco, hero } = sb;
  lg.demolishMode = false;
  applyReduceMotion(lg, !!(lg.reduceMotion ?? ui?.pause?.settings?.reduceMotion));   // BUGFIX B23: every new run inherits the setting
  on('ui:build', (p) => {
    const a = p?.action;
    if (a === 'select') { lg.demolishMode = false; build.enter(p.id); }
    else if (a === 'cancel') { lg.demolishMode = false; build.exit(); }
    else if (a === 'pick') { lg.demolishMode = false; }   // BUGFIX P16: picking a card leaves demolish mode in BOTH layers (tray already cleared st.demolish)
    else if (a === 'rotate') { if (build.mode === 'place') build.rotate(); }
    else if (a === 'confirm') { if (build.mode === 'place') build.confirm(); }
    else if (a === 'demolish') { build.exit(); lg.demolishMode = true; }
    else if (a === 'upgrade') {
      // mobile bugfix: the build tray's ⬆ Upgrade for a SELECTED stall type upgrades your lowest-level one of that type (nearest Pip on ties),
      // no need to walk to it. Without an id (old ⬆ foot button / U key) it is still "the stall next to Pip".
      let e = null;
      if (p.id) { const hp = hero.root.position; e = [...build.placed.values()].filter((x) => x.id === p.id && x.level < 3).sort((x, y) => (x.level - y.level) || (x.group.position.distanceToSquared(hp) - y.group.position.distanceToSquared(hp)))[0] || null; }
      else {
        e = build.nearestUpgradable(hero.root.position.x, hero.root.position.z, 2.5);   // BUGFIX P37/P38: skips decor / nature / L3 stalls
        // BUGFIX P15: foot ⬆ / U key with nobody next to Pip → fall back to the lowest-level upgradable stall anywhere (nearest on ties)
        if (!e || e.scenery) { const hp = hero.root.position; e = [...build.placed.values()].filter((x) => x.category === 'stall' && x.level < 3).sort((x, y) => (x.level - y.level) || (x.group.position.distanceToSquared(hp) - y.group.position.distanceToSquared(hp)))[0] || null; }
      }
      lg.demolishMode = false; if (ui?.build?.state) { ui.build.state.demolish = false; ui.build.refresh?.(); }   // S34 / P79: upgrading disarms demolish mode in both layers
      if (e && !e.scenery) build.upgrade(e); else bus.emit('build:denied', { id: p.id, why: p.id ? 'no stall of that type to upgrade' : 'stand next to a stall to upgrade it' });
    }
    else if (a === 'sell') {   // BUGFIX P12: tray 💰 Sell → demolish (50 % refund) the lowest-level placed prop of that type, nearest Pip on ties
      const hp = hero.root.position, e = [...build.placed.values()].filter((x) => x.id === p.id && !x.scenery).sort((x, y) => ((x.level || 1) - (y.level || 1)) || (x.group.position.distanceToSquared(hp) - y.group.position.distanceToSquared(hp)))[0] || null;
      if (e) build.demolish(e); else bus.emit('build:denied', { id: p.id, why: 'nothing of that type to sell' });
    }
    else if (a === 'buy') { lg.demolishMode = false; lg.buyOffer(p.id); }   // BUGFIX B24 · P30: buying also leaves demolish mode in the integrator: Crew & Land tab (helpers + zones) — was debug H/Z only
  });
  // BUGFIX B24: player-facing hire / unlock / price. offers() feeds the tray's Crew & Land tab; buyOffer pays through the economy
  // (prereqs + cost enforced by buyUpgrade, C03) and then does the world side (helper creature / zone rise). ui:price nudges the per-type
  // price in CustomerSystem (±1 Spark, floor 1, ceiling 3× fair) and emits cust:price so the detail bar refreshes.
  const HELPER_NAMES = { tallyOwl: 'Tally Owl', packMole: 'Pack Mole', sparkBee: 'Spark Bee', guardTortoise: 'Guard Tortoise', scoutFox: 'Scout Fox', gardenerSnail: 'Gardener Snail' };
  const ZONE_NAMES = { zone_west: 'West Meadow', zone_east: 'East Shore', zone_far: 'Far Point' };
  lg.offers = () => Object.values(eco.upgrades || UPGRADES).filter((u) => u.kind === 'helper' || u.kind === 'zone').map((u) => {
    const owned = eco.owns(u.id) || (u.kind === 'zone' && !!sb.island.zones[u.effect.zone]?.unlocked);
    const blocker = owned ? 'owned' : eco.upgradeBlocker(u.id);
    const name = u.kind === 'helper' ? HELPER_NAMES[u.id.slice(7)] || u.id : ZONE_NAMES[u.id] || u.id;
    return { id: u.id, kind: u.kind, name, cost: u.cost, upkeep: u.upkeep || 0, text: u.text, owned, blocker: blocker === 'owned' ? null : blocker && String(blocker).replace(/^needs (zone_|helper_)/, 'needs ') };
  });
  lg.buyOffer = (id) => {
    const u = (eco.upgrades || UPGRADES)[id]; if (!u) return null;
    if (u.kind === 'helper') return hireHelper(sb, id.slice(7));
    if (u.kind === 'zone') { const z = sb.island.zones[u.effect.zone]; if (!z || z.unlocked) { bus.emit('eco:denied', { why: 'owned', id }); return null; } return eco.buyUpgrade(id); }   // eco:upgrade → wireEconomy raises the zone
    return eco.buyUpgrade(id);
  };
  on('ui:price', (p) => {
    const id = p?.id; if (!id || !sb.cust?.setPrice) return;
    const fair = sb.cust.fair(id), cur = sb.cust.price(id), next = Math.max(1, Math.min(Math.round(fair * 3), Math.round(cur + (+p.delta || 0))));
    if (next === cur) return; sb.cust.setPrice(id, next); bus.emit('cust:price', { id, price: next, fair });
  });
  if (ui?.build) { ui.build.offers = lg.offers; ui.build.priceOf = (id) => ({ price: sb.cust?.price?.(id) ?? 0, fair: sb.cust?.fair?.(id) ?? 0 }); }
  offs.push(() => { if (ui?.build) { ui.build.offers = null; ui.build.priceOf = null; } });
  // BUGFIX B13: closing the tray never leaves a live ghost. BUGFIX P13: demolish mode SURVIVES closing the tray (the player closes it to see the
  // island and tap a stall) — the tray's own close() keeps st.demolish, the HUD toast says how to leave it, and Esc / re-open ✕ / a pick ends it.
  on('ui:build:close', () => { if (build.mode === 'place') build.exit(); if (lg.demolishMode) bus.emit('ui:toast', { text: 'Demolish mode: tap a building to sell it (50 % refund) · ' + (lg.game.input?.isTouch ? '✕ Done or 🔨 to leave' : 'Esc or ✕ Done to stop'), kind: 'warn', icon: '💥', id: 'demolish-mode', duration: 6000, action: { label: 'Stop', emit: 'ui:demolish:stop' } }); });   // BUGFIX P28: touch has a tappable Stop
  // BUGFIX B13: a placed STALL ends placement in both layers (no accidental second purchase on the next click); cheap decor/nature stay
  // armed for quick fences/paths and Esc / ✕ cancel them. build.exit() emits build:exit → the tray leaves placing.
  on('build:placed', (p) => { if (!p?.silent && build.mode === 'place' && String(p?.id).startsWith('stall_')) build.exit(); });
  if (ui?.build) { ui.build.reset?.(); ui.build.costOf = (id) => build.cost(id); ui.build.upgradeCost = (lvl) => build.upgradeCost(lvl); ui.build.placedInfo = (id) => [...build.placed.values()].filter((x) => x.id === id).map((x) => ({ level: x.level, cost: x.cost, salvage: x.salvage || 0, busy: build.busy.has(x.group) || !!x.group.userData.swapping }));   /* S34 / P80: tray greys ⬆/💰 mid-animation */ /* BUGFIX P24: cost → real refund label */ ui.build.refresh?.(); }
  offs.push(() => { if (ui?.build) { ui.build.upgradeCost = null; ui.build.placedInfo = null; ui.build.costOf = null; ui.build.reset?.(); } });
  // jars APPLY {pct}: move the whole pouch into the 4 jars by pct (spend stays as pouch → its share is the amount NOT moved)
  lg.applyJars = (pct = {}) => {
    const spark = eco.state.spark; if (spark <= 0) { bus.emit('eco:denied', { reason: 'nothing to allocate', cost: 0, spark }); return false; }
    const d = {}; let moved = 0;
    for (const k of ['save', 'invest', 'protect']) { const v = Math.max(0, Math.floor(spark * ((+pct[k] || 0) / 100))); if (v > 0) { d[k] = v; moved += v; } }
    if (!moved) return false;
    const ok = eco.allocate(d); if (ok) bus.emit('game:allocated', { moved, deltas: d, spark: eco.state.spark }); return ok;
  };
  on('ui:jar:apply', (p) => lg.applyJars(p?.pct));
  // S03: AUTO ("pay yourself first") — while on, every SALE (eco:spark reason 'sale' / tips) is split by the current sliders the moment it lands.
  //   The fractional remainder is carried over (lg.autoCarry) so 7 ✦ sales at 30 % still fill the Save jar over time. Persisted in the save (autoApply).
  lg.autoApply = !!lg.autoApply; lg.autoCarry = { save: 0, invest: 0, protect: 0 };
  lg.autoSplit = (delta) => {
    if (!lg.autoApply || !(delta > 0) || !lg.sb) return 0;
    const pct = lg.jarPct || ui?.jars?.pct || {}; const d = {}; let moved = 0;
    for (const k of ['save', 'invest', 'protect']) { const want = delta * ((+pct[k] || 0) / 100) + (lg.autoCarry[k] || 0); const v = Math.floor(want); lg.autoCarry[k] = want - v; if (v > 0) { d[k] = v; moved += v; } }
    if (!moved || moved > eco.state.spark) return 0;
    const ok = eco.allocate(d); if (ok) bus.emit('game:allocated', { moved, deltas: d, spark: eco.state.spark, auto: true }); return ok ? moved : 0;
  };
  on('eco:spark', (p) => { if (p && p.delta > 0 && (p.reason === 'sale' || String(p.reason || '').startsWith('tip:'))) lg.autoSplit(p.delta); });
  on('ui:jar:auto', (p) => { lg.autoApply = !!p?.on; if (p?.pct) lg.jarPct = { ...p.pct }; if (p?.source !== 'restore') bus.emit('ui:toast', { text: lg.autoApply ? 'Pay yourself first: every sale is split into your jars automatically' : 'AUTO off — use APPLY to move Spark into the jars', kind: lg.autoApply ? 'ok' : 'info', icon: '⚡', id: 'jar-auto', duration: 2600 }); });
  if (ui?.jars?.setAuto && ui.jars.auto !== lg.autoApply) ui.jars.setAuto(lg.autoApply, 'restore');
  // BUGFIX B11: ↩ on a jar → Spark back into the pouch. BUGFIX B01: PAY BARON → economy.repay (the only way to clear principal; isWin needs debt 0).
  on('ui:jar:withdraw', (p) => { if (!p?.jar) return; const a = eco.withdraw(p.jar, p.amount); if (a > 0) bus.emit('game:withdrew', { jar: p.jar, amount: a, spark: eco.state.spark }); });
  lg.repay = (amount) => { const a = eco.repay(amount != null ? amount : eco.state.debt); if (a > 0) { bus.emit('game:repaid', { amount: a, debt: eco.state.debt, spark: eco.state.spark }); ui?.hud?.sync?.(eco.state); } return a; };
  on('ui:repay', (p) => { const a = lg.repay(p?.amount); if (a > 0 && p?.source === 'hud') bus.emit('ui:toast', { text: eco.state.debt > 0 ? `Paid the Baron ${a} ✦ — ${eco.state.debt} ✦ left` : `Paid the Baron ${a} ✦ — DEBT FREE!`, kind: eco.state.debt > 0 ? 'ok' : 'gold', icon: '💸', id: 'repay', duration: 2400 }); });   // S05: HUD PAY gets a toast (the jars panel shows its own debt row)
  // ability keys — only while playing/endless and no modal owns the screen (dialogue keys 1–4, ledger Enter, pause Esc)
  lg.ability = (name) => { if (!lg.sb || (lg.state !== 'playing' && lg.state !== 'endless') || lg.game.paused) return null; return sb.ability(name); };
  // BUGFIX P27: 🔨 on the touch pad while a ghost is up CONFIRMS placement (BuildSystem._onAction already did via input.press) — it must
  //   not toggle (= close) the tray, which emitted ui:build:close → build.exit() and cancelled the placement. In demolish mode 🔨 leaves it (P28).
  on('ui:touch', (p) => { if (p?.action !== 'build' || lg.game.paused) return; if (build.mode === 'place') return; if (lg.demolishMode) { lg.demolishMode = false; ui?.build?.cancel?.(); bus.emit('ui:toast', { text: 'Demolish mode off', kind: 'info', icon: '💥', id: 'demolish-mode', duration: 1500 }); return; } ui?.build?.toggle?.(); });
  on('ui:demolish:stop', () => { lg.demolishMode = false; ui?.build?.cancel?.(); });   // S09: also fired by the floating ✕ Done pill (was bus.on → leaked one listener per run)
  // BUGFIX P43: the season ends (ledger review) / the run ends → drop the build ghost, demolish mode and the open tray so nothing stays armed
  //   behind the Ledger modal or into the next season. ui.build.cancel() emits ui:build {action:'cancel'} → build.exit() + lg.demolishMode=false.
  const disarm = () => { if (!lg.sb) return; const armed = build.mode === 'place' || lg.demolishMode || ui?.build?.isOpen || ui?.build?.state?.demolish; if (!armed) return; lg.demolishMode = false; ui?.build?.cancel?.(); if (build.mode === 'place') build.exit(); if (ui?.build?.isOpen) ui.build.close(); };
  on('eco:season', disarm); on('eco:win', disarm); on('eco:lose', disarm); on('game:title', disarm);
  // BUGFIX P33: ✋ Interact (touch pad) finally DOES something, context-sensitive — placing a ghost → rotate it · next to an upgradable
  //   stall (≤ 2.5 u) → upgrade it (same as U / tray ⬆) · otherwise → open the Build Tray. Desktop E/F stay FinLit abilities (ABILITY_KEYS).
  lg.interact = () => {
    if (!lg.sb || lg.game.paused || ui?.isModal?.()) return 'blocked';
    if (build.mode === 'place') { build.rotate(); return 'rotate'; }
    if (build.mode === 'drag') { build.dragRotate(); return 'rotate'; }   // S36: ✋ rotates the prop being dragged
    // BUGFIX P37/P38: prefer the nearest stall that can still be upgraded; a decor pot or a maxed L3 stall between Pip and it no longer blocks U / ✋
    const e = build.nearestUpgradable(hero.root.position.x, hero.root.position.z, 2.5);
    if (e) { lg.demolishMode = false; if (ui?.build?.state) ui.build.state.demolish = false; return build.upgrade(e) ? 'upgrade' : 'denied'; }   // S34 / P79
    const near = build.nearest(hero.root.position.x, hero.root.position.z, 2.5);
    if (near && !near.scenery && near.category === 'stall' && near.level >= 3) { bus.emit('ui:toast', { text: `${near.id.replace('stall_', '')} stall is already max level`, kind: 'info', icon: '⬆', id: 'interact', duration: 1800 }); return 'max'; }
    ui?.build?.open?.(); return 'tray';
  };
  on('ui:touch', (p) => { if (p?.action === 'interact') lg.interact(); });
  // S08: touch ability strip → same gate as the Q W E R F G keys (playing / endless, not paused, no modal, tray closed, not placing)
  on('ui:touch', (p) => {
    if (p?.action !== 'ability' || !p.name) return;
    if (ui?.isModal?.() || ui?.build?.isOpen || build.mode === 'place' || lg.game.paused) { bus.emit('sandbox:denied', { name: p.name, why: 'blocked' }); return; }
    lg.ability(p.name);
  });
  // tap on the island while in demolish mode → demolish what is there (10B's onTap handles place mode)
  const prevTap = lg.game.input?.onTap;
  // BUGFIX (mobile): with debugKeys off (the real game) nothing handled a tap while PLACING → the ghost never moved on phones.
  //   touch: tap = move the ghost there (confirm with ✓ place / 🔨) · mouse: the ghost already follows the cursor → click places it.
  build.followTarget = () => { const h = hero.root.position, a = hero.facing || 0; return { x: h.x + Math.sin(a) * 2, z: h.z + Math.cos(a) * 2 }; };
  if (lg.game.input) lg.game.input.onTap = (world, ev) => {
    if (build.mode === 'place') { if (ui?.isModal?.()) return; build.moveTo(world.x, world.z); if (ev?.pointerType === 'mouse') build.confirm(); return; }
    // BUGFIX P17: prefer the prop under the cursor in 3D (roof / sign / awning) — the ground-plane point sits ~1.9 u behind a 2.2 u tall stall
    if (lg.demolishMode) { const e = build.pick(lg.game.input?._ray?.ray) || build.nearest(world.x, world.z, 1.2); if (e && !e.scenery) build.demolish(e); else if (e && e.scenery) bus.emit('ui:toast', { text: 'That is part of the island — only things YOU built can be sold', kind: 'info', icon: '🌿', id: 'scenery-sell', duration: 2200 }); return; }   // P23: explain instead of silent refusal
    if (lg.selectTap?.(world, ev)) return;
    prevTap?.(world, ev);
  };
  // S06: tap / click a stall (or any prop YOU built) on the island → inspect it: the Build Tray opens on its tab with its card selected,
  //   so 🚀 Deploy another · ⬆ Upgrade · 💰 Sell · price −/+ are one tap away. The 3D pick (roof / sign) comes first, then the ground cell.
  //   Scenery is "part of the island" (P23) and only gets a toast. Returns true when a prop was selected (the tap is consumed).
  lg.selectTap = (world) => {
    if (!lg.sb || lg.game.paused || ui?.isModal?.() || build.mode === 'place' || lg.demolishMode) return false;
    const e = build.pick(lg.game.input?._ray?.ray) || build.nearest(world.x, world.z, 1.0);
    if (!e) return false;
    if (e.scenery) { bus.emit('ui:toast', { text: 'That is part of the island — tap a stall you built to inspect it', kind: 'info', icon: '🌿', id: 'scenery-sell', duration: 1800 }); return true; }
    const cat = e.category || build.entry?.(e.id)?.category || 'stall';
    ui?.build?.setCategory?.(cat); ui?.build?.open?.(); ui?.build?.select?.(e.id);
    lg.inspected = { id: e.id, level: e.level || 1, at: lg.game.time };
    bus.emit('ui:inspect', { id: e.id, level: e.level || 1, category: cat, cost: e.cost });
    bus.emit('ui:toast', { text: `${(build.entry?.(e.id)?.name) || e.id.replace(/^stall_/, '')}${cat === 'stall' ? ` · L${e.level || 1}` : ''} — Deploy, Upgrade or Sell it from the tray`, kind: 'info', icon: '🔍', id: 'inspect', duration: 2000 });
    return true;
  };
  offs.push(() => { if (lg.game.input) lg.game.input.onTap = prevTap; });
  // S36: DRAG a prop you bought (stall, decor, fence, path …) to a new spot. Press on it, move > 10 px → it lifts and follows the finger /
  //   mouse snapped to the grid (green pad = free land, red = blocked); release → it lands there (free, keeps level & price) or snaps back.
  //   R (desktop) / ✋ (touch) rotates it mid-drag. Not while placing a ghost, in demolish mode, paused or behind a modal. Scenery is not yours.
  const inp = lg.game.input;
  const prevDrag = inp ? { s: inp.onDragStart, m: inp.onDrag, e: inp.onDragEnd } : null;
  if (inp) {
    inp.onDragStart = (world, ev) => {
      if (!lg.sb || lg.game.paused || ui?.isModal?.() || build.mode !== 'idle' || lg.demolishMode) return false;
      const ray = ev && typeof inp.rayAt === 'function' ? inp.rayAt(ev.clientX, ev.clientY) : null;
      const e = build.dragStart(world.x, world.z, ray);
      if (!e) return false;
      lg.dragging = e;
      bus.emit('ui:toast', { text: `Moving ${(build.entry?.(e.id)?.name) || e.id.replace(/^stall_/, '')} — drop it on green · ${inp.isTouch ? '✋' : 'R'} rotates`, kind: 'info', icon: '✋', id: 'drag', duration: 1600 });
      return true;
    };
    inp.onDrag = (world) => { if (lg.dragging) build.dragMove(world.x, world.z); };
    inp.onDragEnd = (world, ev, cancelled) => {
      if (!lg.dragging) return; lg.dragging = null;
      const moved = build.dragEnd(!!cancelled);
      if (!moved && !cancelled) bus.emit('ui:toast', { text: 'Cannot stand there — it hopped back', kind: 'warn', icon: '🚫', id: 'drag', duration: 1500 });
    };
  }
  on('build:moved', () => { sb.syncStalls(); for (const h of sb.helpers) if (h.stall) seatHelper(sb, h, h.stall); });   // helpers follow their stall
  on('build:moved', () => sb.cust?.reroute?.());
  const dropDrag = () => { if (lg.dragging) { lg.dragging = null; build.dragEnd(true); } };
  on('eco:season', dropDrag); on('eco:win', dropDrag); on('eco:lose', dropDrag); on('game:title', dropDrag); on('game:pause', dropDrag);
  offs.push(() => { dropDrag(); if (inp && prevDrag) { inp.onDragStart = prevDrag.s; inp.onDrag = prevDrag.m; inp.onDragEnd = prevDrag.e; } });
  if (typeof window !== 'undefined' && window.addEventListener && !lg.opts.headless) {
    // BUGFIX B20: W is also "walk forward" (Input KEY_MOVE). A HELD W walks; a TAP of W (released within 220 ms, no other
    //   WASD/arrow key down) fires Bubble Shield. BUGFIX B21: R rotates the ghost while placing, so Ledger Flash is skipped then.
    let wDown = 0;
    const MOVE_KEYS = ['KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    // BUGFIX P36: the open Build Tray is not a modal (ui.isModal) but it owns the keyboard — abilities and U must not fire behind it.
    const hotkeysBlocked = () => !!(ui?.isModal?.() || ui?.build?.isOpen);
    const onKey = (e) => {
      if (e.repeat) return;
      // BUGFIX P33: U = upgrade the stall next to Pip (the tutorial / README said so, but U was debug-only) — same handler as touch ✋
      if (e.code === 'KeyU' && !hotkeysBlocked() && lg.sb && lg.sb.build.mode !== 'place') { lg.interact(); return; }
      const name = ABILITY_KEYS[e.code]; if (!name || hotkeysBlocked()) return;
      if (e.code === 'KeyW') { const k = lg.game.input?.keys; wDown = (k && MOVE_KEYS.some((c) => k.has(c))) ? 0 : (performance.now?.() || Date.now()); return; }
      if (e.code === 'KeyR' && lg.sb?.build?.mode === 'place') return;
      if (e.code === 'KeyR' && lg.sb?.build?.mode === 'drag') { lg.sb.build.dragRotate(); return; }   // S36
      lg.ability(name);
    };
    const onKeyUp = (e) => { if (e.code !== 'KeyW' || !wDown) return; const dt = (performance.now?.() || Date.now()) - wDown; wDown = 0; if (dt <= 220 && !hotkeysBlocked()) lg.ability('bubbleShield'); };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    offs.push(() => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); });
  }
}
// Season loop on the bus (listeners live for the whole lg, they check lg.sb):
//   eco:season report → 'review' (economy clock keeps running at 0 because the ledger/dialogue pause the game).
//     story mode: 8B plays the ledger lines, then emits story:review → ui.ledger.show(report). No story → ledger.show at once.
//   ui:continue {outcome:'season'} → 'playing' (8B starts the next opening itself) · 'win' → endless · 'lose' → title (7C re-shows it).
//   eco:win → 'ending' (8B ending lines → story:finale {endless:true}) → ledger.show(last, {outcome:'win'}) → ui:continue → 'endless'.
//   eco:lose → 'ending' → story:finale → ledger.show(last, {outcome:'lose'}) → TRY AGAIN → teardown → 'title'.
function installSeasonLoop(lg) {
  const { bus, ui } = lg, on = (n, f) => lg._offs.push(bus.on(n, f));
  const showLedger = (report, o = {}) => { if (!report) return; lg.stats.reviews++; if (ui?.ledger?.show) ui.ledger.show(report, o); else bus.emit('ui:ledger:open', { season: report.season }); };
  lg.lastReport = null; lg.pendingOutcome = null;
  on('eco:season', (r) => {
    if (!lg.sb) return; lg.lastReport = r; lg.stats.seasons++;
    if (lg.sb.eco.state.ended) return;                                                   // win/lose follow → ending path below
    lg.setState('review');
    if (!lg.story) showLedger(r, { outcome: 'season' });                                // 8B emits story:review after its ledger lines
  });
  on('story:review', (p) => { if (lg.state === 'review') showLedger(p?.report || lg.lastReport, { outcome: 'season' }); });
  // S18: the victory cinematic (fly to the lighthouse, lamp lights, return) plays first; the story's ending lines are held until cine:end.
  //   No story (endless-like run forced to win in tests) → the ledger waits for the shot too. Listener order: this runs BEFORE the
  //   StorySystem's eco:win (registered per run), so hold(true) is in place when onWin() queues its lines.
  on('eco:win', () => {
    if (!lg.sb) return; lg.pendingOutcome = 'win'; lg.setState('ending');
    const sb = lg.sb;
    if (lg.cine) { sb._cineLamp = true; lg.cine.play('victory', { sb, story: lg.story, onDone: () => { if (!lg.story && lg.sb === sb && lg.state === 'ending') finale(lg, 'win'); } }); }
    else if (!lg.story) finale(lg, 'win');
  });
  on('eco:lose', () => { if (!lg.sb) return; lg.pendingOutcome = 'lose'; lg.setState('ending'); if (!lg.story) finale(lg, 'lose'); });
  on('story:finale', (p) => { if (lg.state === 'ending') finale(lg, p?.outcome || lg.pendingOutcome || 'win'); });
  on('ui:continue', (p) => {
    const out = p?.outcome || 'season';
    if (out === 'season') { if (lg.state === 'review') lg.setState(lg.mode === 'endless' ? 'endless' : 'playing'); }
    else if (out === 'win') { lg.goEndless(); }
    else if (out === 'lose') { lg.toTitle('lose'); }
  });
  // win → keep the island, drop the win gate, scams off, no more story (8B goes quiet after the finale), state 'endless'
  lg.goEndless = () => {
    const sb = lg.sb; if (!sb) return lg.setState('title');
    lg.mode = 'endless'; sb.eco.config.winRequiresSeasons = false; sb.eco.config.endless = true; sb.eco.state.ended = null; sb.eco.state.day01 = 0;
    sb.updateScheduler = wrapNoScam(sb); lg.stats.finales++;
    ui?.hud?.setSeason?.(sb.eco.state.season, 0);
    lg.setState('endless'); bus.emit('game:endless', { season: sb.eco.state.season });
  };
  lg.toTitle = (why = 'menu') => { lg.teardown(); lg.setState('title'); if (ui?.title && !ui.title.isOpen) ui.title.show?.(); lg.pause('title', true); bus.emit('game:title', { why }); };
  function finale(lg2, outcome) { lg2.stats.finales++; showLedger(lg2.lastReport || lg2.sb?.eco.history.at(-1), { outcome }); }
}

// =====================================================================================================================
// 10D — save / load + tutorial gates. Save = src/systems/save.js (pure). Autosave: after every eco:season report and on review → playing
// (never per frame). ui:start {mode:'continue'} → lg.resume(): createSandbox(starterStalls:false) → Economy.deserialize state copied into the
// live sb.eco (keeps the 10B bus wires) → build.load → StorySystem.deserialize (toasts fire once across reloads) → helpers re-hired for free →
// HUD sync → 'playing' at the saved season's start. lose / back-to-title from a finished run → clear(). opts.storage overrides localStorage.
export const SAVE_VERSION = Save.SAVE_VERSION;
function installSave(lg) {
  const { bus, ui, opts } = lg, on = (n, f) => lg._offs.push(bus.on(n, f));
  const storage = opts.storage;
  lg.save = {
    snapshot: () => Save.snapshot(lg),
    write: () => { const s = Save.snapshot(lg); if (!s) return false; const ok = Save.save(s, storage); if (ok) { lg.stats.saves = (lg.stats.saves || 0) + 1; bus.emit('game:saved', { season: lg.sb.eco.state.season, at: s.at }); } return ok; },
    read: () => Save.load(storage), has: () => Save.hasSave(storage), clear: () => { const ok = Save.clear(storage); ui?.title?.setHasSave?.(false); return ok; },
    exportText: () => Save.exportText(Save.load(storage) || Save.snapshot(lg)),
    importText: (t) => { const s = Save.importText(t); if (!s) return false; Save.save(s, storage); ui?.title?.setHasSave?.(true); return true; },
    describe: () => Save.describe(Save.load(storage)),
    // S25: persistent unlocks (lumen.unlocks) — ∞ ENDLESS on the title only after the first story win
    unlocks: () => Save.unlocks(storage), hasWon: () => Save.hasWon(storage),
    unlock: (key, v = true) => { const ok = Save.setUnlock(key, v, storage); if (key === 'endless') ui?.title?.setUnlocked?.({ endless: !!v }); return ok; },
  };
  ui?.title?.setUnlocked?.({ endless: Save.hasWon(storage) });
  lg.resume = (snap = Save.load(storage)) => {
    if (!snap) return false;
    lg._resuming = snap;
    try { lg.start(snap.mode === 'endless' ? 'endless' : 'story'); } finally { lg._resuming = null; }
    const sb = lg.sb; if (!sb) return false;
    // BUGFIX B18: a slot that passed parseSnapshot but still breaks during restore → drop it, fall back to a fresh run (never a dead title)
    try { applySnapshot(lg, sb, snap); }
    catch (err) { console.warn('[save] corrupt slot dropped:', err?.message || err); lg.save.clear(); lg.stats.corruptSaves = (lg.stats.corruptSaves || 0) + 1; bus.emit('game:saveCorrupt', { error: String(err?.message || err) }); lg.start(lg.mode); return true; }
    bus.emit('game:resumed', { season: sb.eco.state.season, mode: lg.mode });
    return true;
  };
  on('eco:season', () => { if (lg.sb && !lg.sb.eco.state.ended) lg.save.write(); });
  on('game:state', (p) => { if (p.prev === 'review' && (p.state === 'playing' || p.state === 'endless')) lg.save.write(); });
  on('game:endless', () => lg.save.write());
  on('game:title', (p) => { if (p?.why === 'lose') lg.save.clear(); });
  // BUGFIX B12: season checkpoint = snapshot at the start of every season (fresh start, resume, review → next season, endless)
  const checkpoint = () => { if (lg.sb && !lg.sb.eco.state.ended) lg.seasonCheckpoint = Save.snapshot(lg); };
  on('game:start', () => { if (!lg._resuming) checkpoint(); });
  on('game:resumed', checkpoint);
  on('game:state', (p) => { if (p.prev === 'review' && (p.state === 'playing' || p.state === 'endless')) checkpoint(); });
  on('game:endless', checkpoint);
  on('eco:lose', () => lg.save.clear());
  on('eco:win', () => { if (lg.sb && lg.mode === 'story' && !lg.save.hasWon()) { lg.save.unlock('endless', true); bus.emit('game:unlock', { key: 'endless' }); } });   // S25: the 10-season STORY victory unlocks Endless (never an endless-mode fog win)
  on('game:start', () => { if (!lg._resuming) ui?.title?.setHasSave?.(lg.save.has()); });
  on('ui:jar', (p) => { if (p?.pct) lg.jarPct = { ...p.pct }; });
  installTutorialGates(lg);
}
// Put a snapshot onto a freshly started sandbox. Economy: deserialize into a throwaway, then copy state/ledger/history/pendingOffer so the
// live instance keeps its bus + config (seasonSeconds etc.). Build: load() places silently at no cost. Helpers: re-hire without paying.
function applySnapshot(lg, sb, snap) {
  const { eco, build } = sb;
  if (snap.eco) {
    const e2 = Economy.deserialize(snap.eco, eco.config, { bus: null, events: eco.events, scams: eco.scams, upgrades: eco.upgrades });
    // BUGFIX P41: a save taken MID-season keeps its day01 (and the scheduler flags below) — resetting to 0 replayed the season's income,
    //   event and scam a second time on CONTINUE. A save taken at the review (snap.midSeason false / old save) still starts the next season at 0.
    const day01 = snap.midSeason && Number.isFinite(e2.state.day01) && e2.state.day01 < 1 ? e2.state.day01 : 0;
    eco.state = { ...eco.state, ...e2.state, day01, ended: null }; eco.ledger = e2.ledger; eco.history = e2.history; eco.pendingOffer = null;
    if (snap.midSeason && sb.sched && snap.sched) { sb.sched.season = eco.state.season; sb.sched.event = !!snap.sched.event; sb.sched.scam = !!snap.sched.scam; }
    if (lg.mode === 'endless') { eco.config.winRequiresSeasons = false; eco.config.endless = true; }
  }
  // BUGFIX B14: unlocked zones come back from the owned zone_* upgrades BEFORE the buildings are re-placed (locked zones are water → placements rejected)
  for (const id of eco.state.owned || []) { const u = eco.upgrades?.[id]; if (u?.kind === 'zone' && Number.isInteger(u.effect?.zone)) { if (sb.island.unlockInstant?.(u.effect.zone)) lg.stats.zonesRestored = (lg.stats.zonesRestored || 0) + 1; } }
  if (lg.stats.zonesRestored) sb.cust?.reroute?.();
  if (Array.isArray(snap.build) && snap.build.length) { build.load(snap.build); sb.syncStalls?.(); sb.cust?.reroute?.(); }   // BUGFIX: syncStalls is authoritative (skips decor/nature, adds L2/L3 upkeep)
  for (const id of snap.helpers || []) { const type = String(id).replace(/^helper_/, ''); if (HELPER_TYPES.includes(type) && !sb.helpers.some((h) => h.type === type)) hireHelper(sb, type, { free: true }); }
  // BUGFIX P18: a restored position on water (old save, zone that is no longer unlocked) is pulled back to the nearest land cell (or the plaza)
  if (snap.hero && sb.hero?.root) { sb.hero.root.position.set(snap.hero.x, 0, snap.hero.z); if (!sb.island.isLand(snap.hero.x, snap.hero.z) && !sb.hero.recoverToLand?.()) sb.hero.root.position.set(0, 0, 1); lg.game.camera?.snapTo?.(sb.hero.root.position); }
  if (snap.jars) { lg.jarPct = { ...snap.jars }; lg.ui?.jars?.setPct?.(snap.jars); }
  if (snap.autoApply != null) { lg.autoApply = !!snap.autoApply; lg.ui?.jars?.setAuto?.(lg.autoApply, 'restore'); }   // S03
  if (snap.cust && sb.cust?.load) sb.cust.load(snap.cust);                               // BUGFIX B16: per-stall prices (+ sale totals) survive CONTINUE
  lg.ui?.hud?.sync?.(eco.state); lg.ui?.jars?.setBalances?.(eco.state.jars); lg.ui?.jars?.setDebt?.(eco.state.debt, eco.state.spark); lg.ui?.build?.setSpark?.(eco.state.spark);
  if (lg.story && lg.state === 'playing') lg.story.onSeasonStart?.(eco.state.season);   // 8B: no-op if this season's opening already played (saved mid-season); plays it if the save was taken at the review
}

// Tutorial gates (P2). 8B fires its 10 toasts from data/story.json on bus events (ui:start, build:placed, cust:paid, ui:jar:apply, eco:fog, …).
// Three of them have no natural event in season 1, so 10D emits NUDGE events after the player has been idle on that step for a while — each
// is a bus event 8B's `tutorial[].trigger` can name, and each fires at most once per run (StorySystem keeps toastsFired, which is saved):
//   tut:move      hero walked > 2 u from spawn (replaces the ui:start toast timing: fires when the player actually moved)
//   tut:build     12 s into season 1 with no stall placed by the player → "Press B to build"
//   tut:jars      after the first sale, 15 s without an APPLY → "Set your jars"
//   tut:endSeason day01 > 0.85 in season 1 → "the season ends soon — the Ledger shows how you did"
//   tut:upgrade   season ≥ 2, 10 s in, spark ≥ upgrade cost, no upgrade yet → "stand by a stall, press U/⬆ to upgrade"
// Gates only run in story mode, season ≤ 2, while playing and unpaused. They are observable as `lg.tut.fired` for check.mjs.
export const TUTORIAL_GATES = ['tut:move', 'tut:build', 'tut:jars', 'tut:endSeason', 'tut:upgrade'];
export const TUTORIAL_LINES = {                                               // used only when data/story.json has no entry for the trigger
  'tut:move':      { icon: '🦉', text: 'Nice — Pip walks wherever you point. Glimmers wander in from the dock on the left.' },
  'tut:build':     { icon: '🔨', text: 'Press B (or tap 🔨) and pick a stall. Place it on the grass near the path so Glimmers can reach it.' },
  'tut:jars':      { icon: '🫙', text: 'Spark piles up in your pouch. Open the jars and press APPLY to move some into Save, Invest and Protect.' },
  'tut:endSeason': { icon: '📒', text: 'The season ends when the day bar fills. The Ledger then shows income, interest and what the Fog took.' },
  'tut:upgrade':   { icon: '⬆️', text: 'Stand next to a stall and press U (or ⬆ in the build tray) to upgrade it — more sales, a bit more upkeep.' },
};
function installTutorialGates(lg) {
  const { bus } = lg, on = (n, f) => lg._offs.push(bus.on(n, f));
  const T = lg.tut = { fired: new Set(), t: 0, sinceSale: null, built: 0, applied: 0, upgraded: 0, sold: 0, spawn: null, enabled: lg.opts.tutorial !== false };
  // fire: bus event (8B picks it up if data/story.json names the trigger) → else the built-in line below, recorded in 8B's toastsFired so it is saved.
  const fire = (name, extra = {}) => {
    if (T.fired.has(name)) return false; T.fired.add(name); bus.emit(name, { tutorial: true, ...extra });
    const st = lg.story; if (!st || !st.opts?.tutorial || st.state.toastsFired.includes(name)) return true;
    if ((st.data?.tutorial || []).some((x) => x.trigger === name)) { st.tutorialFor?.(name); return true; }
    const t = TUTORIAL_LINES[name]; if (!t) return true;
    st.state.toastsFired.push(name); bus.emit('story:toast', { id: name, text: t.text, icon: t.icon || '🦉', kind: 'info', trigger: name }); return true;
  };
  T.fire = fire;
  on('game:start', () => { T.fired.clear(); T.t = 0; T.sinceSale = null; T.built = 0; T.applied = 0; T.upgraded = 0; T.sold = 0; T.spawn = null; });
  on('game:resumed', () => { for (const id of lg.story?.state.toastsFired || []) T.fired.add(id); });   // resumed run: whatever 8B already showed counts as fired
  on('build:placed', (p) => { if (!p?.silent) T.built++; });
  on('build:upgraded', () => { T.upgraded++; });
  on('cust:paid', () => { T.sold++; if (T.sinceSale == null) T.sinceSale = 0; });
  on('ui:jar:apply', () => { T.applied++; });
  T.update = (dt) => {
    const sb = lg.sb; if (!T.enabled || !sb || lg.mode !== 'story' || lg.state !== 'playing' || lg.game.paused) return;
    const s = sb.eco.state; if (s.season > 2) return;
    T.t += dt; if (T.sinceSale != null) T.sinceSale += dt;
    if (lg.cine?.active) { T.spawn = null; return; }                                     // S18: the arrival walk-in is not the player moving
    const h = sb.hero?.root?.position; if (h) { if (!T.spawn) T.spawn = { x: h.x, z: h.z }; else if (!T.fired.has('tut:move') && Math.hypot(h.x - T.spawn.x, h.z - T.spawn.z) > 2) fire('tut:move'); }
    if (s.season === 1) {
      if (T.t > 12 && T.built === 0) fire('tut:build');
      if (T.sinceSale != null && T.sinceSale > 15 && T.applied === 0) fire('tut:jars');
      if (s.day01 > 0.85) fire('tut:endSeason');
    } else if (s.season === 2 && T.t > 10 && T.upgraded === 0 && s.spark >= 60) fire('tut:upgrade');
  };
}

// ═══════════════════════════════════════════ 11A perf glue ═══════════════════════════════════════════
// sb.perf = { shadows: BlobShadows (all creature discs → 1 dc) · lod: CreatureLOD (hulls off far away) · governor: PixelRatioGovernor }
// opts.perf === false disables all three (demos that measure per-creature numbers). Headless: shadows + lod run (deterministic,
// asserted by check.mjs --sandbox), the governor needs a renderer so it is skipped.
export const PERF_VERSION = '11A';
function installPerf(sb) {
  if (sb.opts?.perf === false) return;
  const scene = sb.game.scene, cam = sb.game.camera?.three || sb.game.camera;
  const hasCam = !!(cam && cam.position && cam.position.isVector3);   // mock cameras in check.mjs have no position → LOD skipped
  sb.perf = { shadows: new BlobShadows(scene, 48), lod: hasCam ? new CreatureLOD(cam, sb.opts?.lod) : null, governor: null, roots: [] };
  if (!sb.headless && sb.game.renderer) sb.perf.governor = new PixelRatioGovernor(sb.game, sb.opts?.governor);
  sb.perf.dispose = () => { sb.perf.shadows.dispose(); sb.perf.lod?.dispose?.(); sb.perf.governor?.dispose?.(); };
}
function perfRoots(sb) {
  const r = sb.perf.roots; r.length = 0;
  if (sb.hero?.root) r.push(sb.hero.root);
  for (const c of sb.cust.active) if (c.root) r.push(c.root);
  for (const h of sb.helpers) r.push(h.g);
  for (const v of sb.villains || []) r.push(v.g || v.root || v);
  return r;
}
function updatePerf(sb, dtReal) {
  if (!sb.perf) return;
  const roots = perfRoots(sb);
  sb.perf.shadows.update(roots);
  sb.perf.lod?.update?.(roots);
  sb.perf.governor?.update?.(dtReal ?? 1 / 60);
}

/** VFX stand-in for Node: every pool call is a no-op counter. */
export function mockVfx() {
  const n = { calls: 0 }; const noop = () => { n.calls++; };
  // the fallback is a FUNCTION that also carries the pool methods, so both `vfx.fogRecede?.()` (9B win hook) and `vfx.pop.show()` work headless
  const pool = Object.assign(() => { n.calls++; return null; }, { burst: noop, ring: noop, show: noop, emit: noop, stream: noop, hide: noop, push: noop, pulse: noop, flash: noop, setCoverage: noop, coverage: 0 });
  return new Proxy({ _counts: n, fog: pool, coinFly: noop, debtPulse: noop, pop: pool, dust: pool, sparks: pool }, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : pool)) });
}

export default createSandbox;
