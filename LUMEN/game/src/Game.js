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
import { installCombat } from './combat/Combat.js';
import { attachMoves } from './anim/heroAnims.js';
import { attachAbilities, ABILITY_NAMES, FINLIT } from './anim/heroAbilities.js';
import { installVerbChain } from './systems/verbChain.js';
import { installCrew } from './systems/crewJobs.js';   // T3: crew do visible jobs (arrival, post, idle/work loop, payoff pops, Ledger crew line)
import { createScamJournal } from './systems/scamJournal.js';   // T5: sticker book of every deal met (spotted / fell for it)
import { installCuriosity } from './systems/curiosityWire.js';   // T2: curiosity guide — registry sources (jars, stalls, signs, tills, Collectors, Baron, stranger, crew)
import { WHEN as POWER_WHEN, lockedLine } from './systems/powerAnswers.js';   // T2b: every power press answers in ≤ 8 words
import { installUnlocks, starsFor } from './systems/unlocks.js';                          // 41D: 2 starters + 4 earned by ledger stars
import { createJarsWorld } from './systems/jarsWorld.js';                       // 42B: jars are places — walk to a jar, E deposits 10 ✦, hold E withdraws
import { createJarUnlocks } from './systems/jarUnlocks.js';                     // T1-A: jars unlock one by one (data/jars.json rules) → tray hides locked jar cards
import { PROP_CATALOG, makeProp, STALL_TYPES, JAR_IDS, swayAll, swayDecor, updateLandmarks, makeFlowerField, makeGrassTufts } from './assets/props.js';
import { bakeStatic, bakeShells, disposeBatch } from './assets/props/bake.js';
import { BlobShadows, CreatureLOD } from './systems/perf.js';   // 11A (S40: PixelRatioGovernor no longer wired — quality is locked to the Settings preset)
import { G } from './assets/geo.js';
import { PALETTE as P, flatMat } from './core/Toon.js';
import { makeGlimmerAny, CreatureAnimator, HelperAnimator, makeHelper, HELPER_TYPES, registerVariants, makeFogCollector, makeBaronGilt, makeStranger, VillainAnimator, FogPuffPool } from './assets/creatures/index.js';
import { EnemySystem, ENEMY_RULES } from './systems/enemies.js';   // S16
import { StormWeather, STORM } from './vfx/storm.js';   // S17 (+ S21 holdSeconds)
import { CinematicDirector } from './vfx/cinematics.js';   // S18
import { makeEconomy, UPGRADES, pickEvent } from './systems/economyData.js';
import { BuildSystem } from './systems/build.js';
import { CustomerSystem } from './systems/customers.js';
import { StorySystem } from './systems/story.js';
import { Economy } from './systems/economy.js';
import * as Save from './systems/save.js';
import { createTelemetry } from './systems/telemetry.js';
import { createTills, tillCap } from './systems/till.js';
import { createBaronPier } from './systems/baronPier.js';   // 42D: the Baron collects the season's interest at the pier
import { createScamNpc } from './systems/scamNpc.js';
import { createNoveltyRegistry } from './systems/novelties/index.js';   // 43B
import { createSeasonScript } from './systems/seasonScript.js';   // 43A: data/seasons.json drives the scheduler marks + season lengths       // 42D: the Too-Good Deal is a Collector NPC you must TALK to

export const SANDBOX_VERSION = '10B';
export const STALL_PICKS = STALL_TYPES.slice(0, 9);          // keys 1–9 → stall types
export const HELPER_UPGRADE_IDS = HELPER_TYPES.map((t) => 'helper_' + t);

/** Deterministic LCG so headless and browser build the same scenery. */
export function makeRnd(seed = 2026) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/**
 * @param {object} game  Game (or a mock: { scene, bus, sequences, input, time, add(), followTarget, camera })
 * @param {{headless?:boolean, seed?:number, zonesUnlocked?:number, starterStalls?:boolean, maxActive?:number, seasonSeconds?:number}} opts
 */
const _signV = new THREE.Vector3();   // 44A scratch
export function createSandbox(game, opts = {}) {
  registerVariants?.();
  const headless = !!opts.headless;
  const rnd = makeRnd(opts.seed ?? 2026);
  const sb = { game, headless, opts, version: SANDBOX_VERSION, log: [], stats: { seasons: 0, reports: [] }, labelsRoot: (!headless && opts.labelsRoot) || null };   // 42B: DOM root for the projected jar tags

  // ---- world ------------------------------------------------------------------------------------------------------
  sb.island = new Island({ radius: 11, seed: 7, zonesUnlocked: opts.zonesUnlocked ?? 1, starterProps: false });
  game.scene.add(sb.island.group);
  sb.vfx = headless ? mockVfx() : game.add(new VFX(game));
  if (!headless) installPack1(sb.vfx);
  sb.world = buildScenery(sb, rnd);                            // landmarks + decor + nature (baked) → sb.world.{lighthouse,cottage,pier,…}
  if (!headless) { installPack2(sb.vfx, { island: sb.island, lighthouse: sb.world.lighthouse, radius: 12.5, core: 2.5 }); sb.vfx.fog.setCoverage(0, { immediate: true }); }

  // ---- systems ------------------------------------------------------------------------------------------------------
  const bus = game.bus;
  sb.storyData = opts.storyData || null;                          // 42D: parsed data/story.json (pier lines; createLumenGame passes its own)
  sb.jarsData = opts.jarsData || null;                            // T1-A: parsed data/jars.json (null → DEFAULT_JAR_RULES in systems/jarUnlocks.js)
  sb.scamNpcs = opts.scamNpcs ?? !opts.headless;                 // 42D: the scheduler's scam mark spawns a pitching Collector (talk to open the deal); headless keeps eco.offerScam() direct unless opted in
  sb.seasons = createSeasonScript(opts.seasons || null);        // 43A: parsed data/seasons.json (null → legacy SCHEDULER_MARKS rows); createLumenGame passes its own
  if (!sb.seasons.legacy) { const errs = sb.seasons.validate(); if (errs.length) { sb.log.push('seasons.json invalid: ' + errs[0]); sb.seasons = createSeasonScript(null); } }
  sb.eco = makeEconomy({ bus, seed: opts.seed ?? 1, autoSeason: true, pierPays: opts.pierPays === true, demandFn: (kind, season) => sb.seasons.demandFor(season)[kind] ?? 1 }, opts.balance);   // 44C: season demand × fair price (seasons.json row.demand; {} on S1/legacy → ×1)   // 42D: pierPays → interest is collected at the pier (default off: headless harnesses keep the auto path)
  if (!sb.seasons.legacy && !(opts.seasonSeconds > 0) && !opts.balance?.seasonCurve) { const cv = []; for (let i = 1; i <= Math.max(5, sb.seasons.maxSeason); i++) cv.push(sb.seasons.len(i)); sb.eco.config.seasonCurve = cv; }   // 43A: row.len wins over BALANCE.seasonCurve (tests' seasonSeconds override still wins)
  if (opts.seasonSeconds) { sb.eco.config.seasonSeconds = opts.seasonSeconds; sb.eco.config.seasonSecondsOverride = opts.seasonSeconds; }   // 41C: tests/accelerated runs override the season curve
  sb.build = new BuildSystem(game, { island: sb.island, economy: sb.eco, catalog: PROP_CATALOG, vfx: sb.vfx });
  // scenery cells are "occupied" for Build (ghost turns red) and Customers (flow field routes around) without touching 5/6A code
  const SCENERY = { id: 'scenery', category: 'scenery', group: new THREE.Group(), cells: [], cx: 0, cz: 0, rot: 0, level: 0, cost: 0, scenery: true };
  sb.SCENERY = SCENERY;
  for (const k of sb.world.occupied) if (!sb.island.pathCells.has(k)) sb.build.cells.set(k, SCENERY);
  placeClutter(sb);                                             // S07: salvageable plaza clutter (real BuildSystem entries, cost 0 → SALVAGE refund)
  sb.cust = new CustomerSystem(game, { island: sb.island, build: sb.build, economy: sb.eco, vfx: sb.vfx, story: sb.storyData, seed: opts.seed ?? 5, maxActive: opts.maxActive ?? 20,
    creatures: { makeGlimmer: (t) => makeGlimmerAny(t, { seed: (rnd() * 1e6) | 0 }), CreatureAnimator } });
  if (sb.world.pierSpawn) sb.cust.setSpawnPoint(sb.world.pierSpawn.x, sb.world.pierSpawn.z);

  // ---- hero ------------------------------------------------------------------------------------------------------
  // S16: sword targets = Glimmers + live enemies (knockback / defeat). S32: every target is KNOCKED BACK (CreatureAnimator.hit slides the
  //   root; enemies keep ENEMY_RULES.knockback) and hired helpers are targets too (they slide, grumble and walk back to their stall).
  sb.hero = new HeroController(game, { vfx: sb.vfx, targets: () => sb.cust.active.filter((c) => c.state !== 'pooled' && c.state !== 'despawn').map((c) => ({ root: c.root, hit: (d, p) => c.anim?.hit?.(d, p) }))
    .concat(sb.enemies ? sb.enemies.targets() : [], helperTargets(sb), sb.scamNpc ? sb.scamNpc.targets() : [], sb.novelty?.targets?.() || []), isLand: (x, z) => sb.island.isLand(x, z),   // 42D: the pitching Collector is a target too (hit → refuse + flee)
    isSolid: (x, z) => { const o = sb.build?.occupied?.(x, z); return !!o && !o.ghost && !o.lifted; } });   // S41/15E: every occupied cell (stall / decor / nature / plaza scenery) blocks Pip — customers already route around them
  sb.hero.root.position.set(0, 0, 1);
  // S16: Debt Collectors (+ Baron Gilt boss from S6). Transient — spawned by the scheduler at day 0.7, cleared at season end / win / lose.
  sb.enemies = new EnemySystem(game, { hero: sb.hero, eco: sb.eco, island: sb.island, vfx: sb.vfx, headless, occupied: (x, z) => sb.build?.occupied?.(x, z) || null,   // S34 / P73: enemies + shoves respect stall footprints
    creatures: headless ? {} : { makeFogCollector, makeBaronGilt, VillainAnimator, FogPuffPool },
    spawnPoint: sb.world.pierSpawn || { x: 0, z: -10 }, exitPoint: sb.world.pierSpawn || { x: 0, z: -10 }, onCoin: (x, z, v) => sb.dropTip?.(x, z, v), isShielded: () => game.time < (sb.shield?.until ?? -1),
    // 42C: Collectors raid TILLS. sb.till is built after the enemies (installTills) → getter. Contact spills the pouch (42B jarsWorld), never subtracts.
    tills: () => sb.till || null, spillPouch: (frac) => sb.jarsWorld?.spillPouch?.(frac) ?? 0,
    stallName: (id) => sb.build?.entry?.(id)?.name || null, stallSign: (id) => sb.build?.owned?.(id)?.group?.userData?.slots?.sign || null,
    project: (p) => { const cam = game.camera?.three || game.camera; if (!cam?.projectionMatrix || !game.renderer?.domElement) return null; const v = new THREE.Vector3(p.x, p.y, p.z).project(cam); const el = game.renderer.domElement; return { x: (v.x + 1) / 2 * el.clientWidth, y: (1 - v.y) / 2 * el.clientHeight, behind: v.z > 1 }; },
    carryCoin: headless ? null : { attach: () => { const m = new THREE.Mesh(G.cyl(0.22, 0.22, 0.06, 12), flatMat(P.sparkGold)); m.rotation.x = Math.PI / 2; m.userData.noOutline = true; game.scene.add(m); return m; }, detach: (m) => { m.removeFromParent?.(); } } });
  sb.villains = sb.enemies.list;                                 // perf LOD / blob shadows / destroySandbox already walk sb.villains
  // S17: storm weather look (sky/fog slate, dim lights, wind ×3, streaks, DOM rain). Scheduler: warn at day 0.30 when the pre-rolled event is a storm, hit at 0.45, clear 3 s later.
  sb.storm = new StormWeather(game, { lights: game.lights, container: game.container, headless, reduceMotion: () => !!sb.reduceMotion });
  attachMoves(sb.hero); attachAbilities(sb.hero);
  installCombat(sb, game);                                       // S43/16B: 3-hit sword combo + soft lock-on (hero.doAttack → combat.attack)
  game.followTarget = sb.hero.root.position;
  if (game.camera?.snapTo) { game.camera.zoom = 1.25; game.camera.snapTo(sb.hero.root.position); }

  // BUGFIX B15/C01: ONE place that derives the economy's stall count + upgrade upkeep from the live BuildSystem (decor never counts)
  sb.syncStalls = () => { let n = 0, extra = 0; for (const e of sb.build.placed.values()) if (e.id.startsWith('stall_')) { n++; extra += sb.eco.levelUpkeep?.(e.level) || 0; } sb.eco.state.stalls = n; sb.eco.state.stallUpkeepExtra = extra; return n; };
  // BUGFIX B08: world fog / fog towers / vignette follow the economy immediately (start, resume), not only after the next eco:fog
  sb.syncWorld = () => { const f = sb.eco.state.fog01; sb.vfx.fog?.setCoverage?.(f, { immediate: true }); sb.world.towers.forEach((t) => t.userData.setActive?.(f > 0.3)); };
  sb.helpers = [];                                               // P3: hired helpers { g, anim, type, stall }
  sb.crew = installCrew(sb);                                               // T3: sb.crew — arrival from the pier, posts, work loop, payoff pops (presentation only; h.stall still drives the till)
  sb.pick = 0;                                                   // current stall pick index (keys 1–9)
  wireEconomy(sb);
  wireAbilities(sb);
  installTills(sb);                                              // 42A: customers pay the stall's counter, Pip collects (walk / dash / helper / season sweep)
  installJarsWorld(sb);                                          // 42B: jars are places (after wireEconomy — eco:jar → setFill stays the fill truth)
  sb.clockHold = new Set();                                      // 42D: reasons the eco clock is held ('pier'); sb.holdClock(by, on) → eco:clock {held, by}
  sb.holdClock = (by, on_) => { if (on_) sb.clockHold.add(by); else sb.clockHold.delete(by); const held = sb.clockHold.size > 0; game.bus.emit('eco:clock', { held, by: [...sb.clockHold], reason: by }); return held; };
  installPier(sb);                                               // 42D: Baron at the pier (sb.pier) + sb.interact routes to him when he waits
  installScamNpc(sb);                                            // 42D: scheduler scam mark → pitching Collector (sb.scamNpc); interact/hit/flash answer it
  // BUGFIX P65: the starter footprints' SCENERY reservation must go even when starterStalls:false (CONTINUE) — otherwise build.load(snap.build)
  //   rejects the 3 saved starter stalls ("scenery" cell) and a resumed run silently loses them (check.mjs --save: stalls 9/12).
  for (const s of STARTER_STALLS) freeStarterCells(sb, s);
  if (opts.starterStalls !== false) placeStarterStalls(sb);
  sb.syncWorld();
  installDebugKeys(sb);
  installUnlocks(sb, game.bus, { all: opts.allAbilities === true || (!!opts.headless && opts.allAbilities !== false) });   // 41D: gated in the real game; headless checks/sims keep all 6 unless allAbilities:false

  // ---- loop ------------------------------------------------------------------------------------------------------
  sb.update = (dt, _g, dtReal) => {
    sb.island.update(dt);
    if (!headless) { const tw = game.realTime ?? game.time; swayAll(tw); swayDecor(tw); updateLandmarks(dt); }   // S18: wind keeps blowing on the (paused) title backdrop
    sb.answerTick?.(dt);                                            // T2b: Magnet sum + Shield ring
    sb.autoWalkTick?.(dt);                                          // T1-B: tap a far jar → Pip walks over and deposits (steers hero.inputOverride)
    sb.hero.update(dt);
    sb.enemies.update(dt);
    sb.pier?.update(dt);                                            // 42D
    sb.scamNpc?.update(dt);                                         // 42D
    sb.storm.update(dtReal ?? dt);
    sb.build.update(dt);
    sb.cust.update(dt);
    if (!sb.clockHold.size) { sb.eco.tick(dt); sb.updateScheduler?.(); sb.novelties?.update(dt); }   // 43B: novelties run on the game clock (pause with holdClock)   // 42D: the season clock (and its marks) wait while the Baron collects at the pier

    sb.crew?.update(dt);                                            // T3: job loop (before the animators so the clip it picks plays this frame)
    for (const h of sb.helpers) { h.anim.update(dt); updateHelperKnock(sb, h, dt); }
    updateCoins(sb, dt);
    sb.till?.tickHelpers?.(dt, sb.helpers);                         // 42A P2: seated helpers empty their till every 12 s
    sb.jarsWorld?.update(dt);                                       // 42B: near-jar prompt, hold-E withdraw, DOM jar tags
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
  // 48B-1: the lighthouse is the goal of the whole game, so it must be visible from season 1. It stands on its own rock in the sea
  // at the Far Point (parent = island.group, NOT far.group which is hidden until zone_far is bought) and is tall (scale 1.6 → lamp ≈ 9 u).
  W.lighthouse = place(makeProp('lighthouse', { scale: 1.6 }), far.center.x, far.center.z - 1, { rot: Math.PI, w: 3, d: 3, parent: island.group }); take(far.center.x - 1, far.center.z - 2, 3, 3);
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
  // 48E: jars are BUILDABLES — nothing is pre-placed (the old `-8+i, 3` row hung one jar over water). W.jars stays an (empty) array for v1 consumers;
  //      the truth is sb.jarsWorld.get(key) (may be null). JAR_IDS still names the 4 catalog props (jar_spend … jar_protect).
  void JAR_IDS;
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
  // 44A readable pricing: the hanging sign's material colour says the price at a glance — ratio ≤ 0.9 green · ≤ 1.1 white · ≤ 1.4 amber · else red.
  // The sign is the ONE live (unmerged) mesh of a stall, so a per-sign material clone adds 0 draw calls. sb.signTint(id) → {ratio, tint}.
  const SIGN_TINT = { green: 0x9CE29C, white: 0xFFFFFF, amber: 0xFFC65C, red: 0xFF7A7A };
  sb.signTintOf = (ratio) => ratio <= 0.9 ? 'green' : ratio <= 1.1 ? 'white' : ratio <= 1.4 ? 'amber' : 'red';
  sb.signTint = (id) => {
    const sign = sb.build?.owned?.(id)?.group?.userData?.slots?.sign; if (!sign || !sb.cust) return null;
    const fair = sb.cust.fair(id), ratio = fair > 0 ? sb.cust.price(id) / fair : 1, tint = sb.signTintOf(ratio);
    sign.traverse((m) => { if (!m.isMesh || !m.material) return; if (!m.material.userData?.signTint) { m.material = m.material.clone(); m.material.userData.signTint = true; m.userData.disposable = true; } m.material.color?.setHex?.(SIGN_TINT[tint]); });   // headless stub materials have no .color
    sign.userData.priceTint = tint; sb.signGlyph(id, sign); return { id, ratio, tint };
  };
  // 44C: HOT ▲ (warm) / COLD ▼ (cool) glyph on the sign — one tiny cone mesh per sign, shared geometry+material, hidden when demand is ×1.
  const GLYPH = { hot: { geo: null, mat: null, hex: 0xFF8A50 }, cold: { geo: null, mat: null, hex: 0x6FB7FF } };
  const glyphParts = (k) => { const g = GLYPH[k]; if (!g.geo) { g.geo = new THREE.ConeGeometry(0.11, 0.2, 5); if (k === 'cold') g.geo.rotateX(Math.PI); g.mat = new THREE.MeshBasicMaterial({ color: g.hex }); } return g; };
  sb.demandGlyphOf = (id) => { const m = sb.eco?.demandOf?.(id) ?? 1; return m >= 1.3 ? 'hot' : m <= 0.7 ? 'cold' : null; };
  sb.signGlyph = (id, sign) => {
    sign = sign || sb.build?.owned?.(id)?.group?.userData?.slots?.sign; if (!sign) return null;
    const want = sb.demandGlyphOf(id); let g = sign.getObjectByName?.('demandGlyph') || null;
    if (!want) { if (g) g.visible = false; sign.userData.demandGlyph = null; return null; }
    if (g && g.userData.glyphKind !== want) { sign.remove(g); g = null; }
    if (!g) { const P = glyphParts(want); g = new THREE.Mesh(P.geo, P.mat); g.name = 'demandGlyph'; g.userData.glyphKind = want; g.position.set(0.56, -0.32, 0.1); sign.add(g); }   // 44D: beside the board's right edge at mid-height (pivot = hanging point, board spans y −0.64…0, half-width 0.43). 0.42 floated above the awning (screenshots/44_hot_sign_before.png); below the board it overlapped the goods.
    g.visible = true; sign.userData.demandGlyph = want; return want;
  };
  // 44C: season:demand {season, hot, cold} + Owl barks.demand once per season (S≥2, only when the row has a HOT or COLD)
  const demandBark = (season) => {
    const hc = sb.seasons?.hotCold?.(season) || {}; if (!hc.hot && !hc.cold) return;
    bus.emit('season:demand', { season, hot: hc.hot || null, cold: hc.cold || null });
    const list = sb.storyData?.barks?.demand, pick = list?.length ? list[(season | 0) % list.length] : null;
    const text = (pick?.text || pick || 'This season {hot} is in demand, {cold} is not. Price like the island does.').replace(/\{hot\}/g, hc.hot || 'nothing').replace(/\{cold\}/g, hc.cold || 'nothing');
    bus.emit('story:bark', { speaker: 'owl', kind: 'demand', text, hot: hc.hot, cold: hc.cold, anchor: 'owl', ttl: 3.4 });
  };
  off.push(bus.on('eco:season', (r) => { if (!eco.state.ended) demandBark(eco.state.season); }));
  off.push(bus.on('ui:price', (p) => {   // B24 (moved here in 44A): ±1 Spark per tap, floor 1, ceiling 3× fair → cust:price (detail bar + sign tint refresh)
    const id = p?.id; if (!id || !sb.cust?.setPrice) return;
    const fair = sb.cust.fair(id), cur = sb.cust.price(id), next = Math.max(1, Math.min(Math.round(fair * 3), Math.round(cur + (+p.delta || 0))));
    if (next === cur) return; sb.cust.setPrice(id, next); bus.emit('cust:price', { id, price: next, fair });
  }));
  off.push(bus.on('cust:price', (p) => { if (p?.id) sb.signTint(p.id); }));
  sb._angryAt = new Map();   // 44A: stallId → angry count this season; barks.pricing[0] once per stall per season after 3
  off.push(bus.on('cust:angry', (p) => { const id = p?.stallId; if (!id) return; const n = (sb._angryAt.get(id) || 0) + 1; sb._angryAt.set(id, n);
    if (n === 3) { const b = sb.storyData?.barks?.pricing?.[0]; bus.emit('story:bark', { speaker: 'owl', text: b?.text || b || 'Three frowns at one sign. The price, not the goods.', anchor: 'owl', ttl: 3, kind: 'pricing' }); } }));
  off.push(bus.on('eco:season', () => sb._angryAt.clear()));
  off.push(bus.on('eco:season', () => { for (const p of sb.build?.placed?.values?.() || []) if (p.category === 'stall' && !p.scenery) sb.signTint(p.id); }));   // 44C: demand changed fair → re-tint every sign at season start (44A Suspected)
  off.push(bus.on('build:placed', (p) => { if (p?.id && p.entry?.category === 'stall') sb.signTint(p.id); }));
  off.push(bus.on('build:upgraded', (p) => { if (p?.id) sb.signTint(p.id); }));   // level rebuild = new sign mesh
  off.push(bus.on('eco:fog', (p) => { const f = p?.fog01 ?? eco.state.fog01; vfx.fog?.setCoverage?.(f); world.towers.forEach((t) => t.userData.setActive?.(f > 0.3)); if (f > 0.6) vfx.debtPulse?.(0.4); }));
  off.push(bus.on('eco:jar', () => { const j = eco.state.jars, tot = Math.max(1, j.spend + j.save + j.invest + j.protect); ['spend', 'save', 'invest', 'protect'].forEach((k) => sb.jarsWorld?.get?.(k)?.userData.setFill?.(Math.min(1, j[k] / tot))); }));   // 48E: placed jars only
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
  installNovelties(sb);                                          // 43B: season:novelty → NOVELTIES[id].start · eco:season → end · destroy → dispose
}
// Sandbox season scheduler (no story/UI here — 10C's StorySystem will own the real pacing on the same bus events):
//   day01 ≥ 0.45 → one random event (4B pickEvent) — absorbed if bubbleShield is armed (eco:absorbed, Protect jar untouched)
//   day01 ≥ 0.70 on odd seasons → Baron Gilt offers a Too-Good Deal (eco.offerScam) → player ledgerFlashes (refuse) or it is auto-refused at
//   season end (sandbox never auto-accepts). sb.nextEvent is pre-rolled so bubbleShield can name it.
// 41C: ONE table of day01 marks (43 will move them per season — edit here only). waves = customer trickle, warn/event/scam = 4B/S17, wave = enemies.
export const SCHEDULER_MARKS = { trickle: [0.34, 0.67], warn: 0.30, event: 0.45, scam: 0.70, wave: (season) => (season === 1 ? 0.55 : 0.70) };
export const CUSTOMER_TRICKLE = SCHEDULER_MARKS.trickle;   // S37: day01 marks at which another customer wave lands (the first lands at day 0) → 3 waves/season ≈ balance.md's 18 + 5·stalls visits
function installScheduler(sb) {
  const { eco } = sb, bus = sb.game.bus; const S = sb.sched = { season: 0, event: false, scam: false, wave: false, warn: false, trickle: 0 };
  // S37 balance: ONE wave per season (6 Glimmers in S1) gave a first-time player ~60 ✦ income against ~75–140 ✦ of upkeep + interest —
  //   debt 260 → 431 by S3 even at fair prices (headless gate --firstplayer). balance.md's sim assumes 18 + 5·stalls visits per season,
  //   so the season now trickles CUSTOMER_TRICKLE extra waves at day 0.34 / 0.67 (≈ 18 visits in S1, 24 in S2, 30 in S3 — the numbers balance.md was tuned on).
  sb.nextEvent = pickEvent(eco, Math.max(1, eco.state.season));
  sb.updateScheduler = () => {
    const s = eco.state; if (s.ended) return;
    if (S.season !== s.season) { S.season = s.season; S.event = false; S.scam = false; S.wave = false; S.warn = false; S.trickle = 0; S.fired = new Set(); S.marks = sb.seasons.marks(s.season); const fe = sb.seasons.for(s.season).forceEvent; sb.nextEvent = fe && eco.events[fe] ? fe : pickEvent(eco, s.season); }
    if (!S.marks) { S.fired = new Set(); S.marks = sb.seasons.marks(s.season); }
    const modal = !!(sb.modalOpen?.());
    for (let i = 0; i < S.marks.length; i++) {
      const m = S.marks[i]; if (S.fired.has(i) || s.day01 < m.at) continue;
      let ok = true;
      switch (m.kind) {
        case 'trickle': if (modal) { ok = false; break; } S.trickle++; sb.cust.spawnWave(s.season); break;
        // S17: clouds gather at `warn` when a storm is coming (the player has ~15 s to fill Protect)
        case 'warn': S.warn = true; if (sb.nextEvent === 'storm' && !S.event && sb.storm?.phase !== 'warn') { sb.storm?.warn(); sb.log.push(`S${s.season} storm clouds gather`); } break;   // 43B: novelty may have warned already
        case 'event': {
          if (!sb.nextEvent) { S.event = true; break; }
          S.event = true; const id = sb.nextEvent;
          if (sb.game.time < sb.shield.until) { sb.shield.until = -1; sb.stats.absorbed = (sb.stats.absorbed || 0) + 1; bus.emit('eco:absorbed', { id, event: eco.events[id] }); sb.log.push(`S${s.season} ${id} ABSORBED by Bubble Shield`); if (id === 'storm') sb.storm?.clear(2); }
          else { if (id === 'storm') { sb.storm?.hit(); sb._stormClearAt = STORM.holdSeconds > 0 ? sb.game.time + STORM.holdSeconds : null; /* S21: holdSeconds 0 → rains until the season ends */ } eco.applyEvent(id); sb.log.push(`S${s.season} event ${id}`); }
          break; }
        // 42D: NPC first (opts.scamNpcs), else the old direct offer. 43C: scamKind 'baron' → the Baron himself (novelty baronVisit) — no NPC, no direct offer here.
        case 'scam': S.scam = true; if (!eco.pendingOffer && m.payload?.scamKind !== 'baron') { if (!(sb.scamNpcs && sb.scamNpc?.spawn())) eco.offerScam(); } break;
        // T4: a friendly stranger walks in from the pier (kind 'fair' = a genuinely good deal, 'scam' = the next scam not met yet). Waits for a free table + no modal; headless gates without opts.scamNpcs skip it.
        case 'stranger': if (!sb.scamNpcs || !sb.scamNpc) break; if (eco.pendingOffer || modal || sb.scamNpc.active) { ok = false; break; } sb.scamNpc.spawn(m.payload?.kind === 'fair' ? 'fair' : undefined); break;
        // P62: the wave waits while the Baron's deal (or any dialogue) is on screen. 41C: S1 wave at 0.55 (one Collector hp 1), S ≥ 2 after the offer.
        case 'wave': if (sb.enemies?.enabled === false) break; if (eco.pendingOffer || modal) { ok = false; break; } S.wave = true; { const w = sb.enemies.spawnWave(s.season); if (w.length) sb.log.push(`S${s.season} wave ${w.length} (${w.map((e) => e.kind).join(',')})`); } break;
        case 'novelty': if (sb.novelty?.id === m.payload?.id) break; /* 43D: resumed mid-season save already re-started it (applySnapshot) */ bus.emit('season:novelty', { season: s.season, id: m.payload.id, at: m.at }); sb.log.push(`S${s.season} novelty ${m.payload.id}`); break;
        default: break;
      }
      if (ok) { S.fired.add(i); if (sb.opts?.debugKeys || sb.headless) sb.log.push(`S${s.season} mark ${m.kind}@${m.at}`); bus.emit('season:mark', { season: s.season, kind: m.kind, at: m.at, payload: m.payload || null }); }   // 43A P2: debug trace of every fired mark
    }
    sb.signHoldTick?.();
    if (sb._stormClearAt != null && sb.game.time >= sb._stormClearAt) { sb._stormClearAt = null; sb.storm?.clear(3); }   // S17/S21: only when STORM.holdSeconds > 0 (default 0 = whole season; eco:season clears it)
  };
  sb._offs.push(bus.on('eco:season', () => { if (eco.pendingOffer) { eco.refuseOffer(); sb.log.push('deal expired → refused'); } }));
}
// tip coins: spin, bob, walk-over pickup (≤ 0.7 u) → eco.earn; one instanced mesh refresh per frame
function updateCoins(sb, dt) {
  const hp = sb.hero.root.position;
  // 42A: walk-over till collect — Pip within TILL_WALK u of a counter that holds money empties it into the pouch
  if (sb.till) { sb._tillT = (sb._tillT || 0) + dt; for (const t of sb.till.tills.values()) if (t.amount > 0 && Math.hypot(t.pos.x - hp.x, t.pos.z - hp.z) <= TILL_WALK) sb.till.collect(t.stallId, 'walk'); }
  if (!sb.coins.length) { if (sb.coinMesh.count !== (sb.tillCoins?.length || 0)) sb.syncCoins(); else if (sb.tillCoins?.length) sb.syncCoins(); return; }
  for (let i = sb.coins.length - 1; i >= 0; i--) { const c = sb.coins[i]; c.t += dt; c.position.y = 0.12 + Math.sin(c.t * 4) * 0.04; if (Math.hypot(c.position.x - hp.x, c.position.z - hp.z) <= 0.7) sb.collectCoin(c, 'walk'); }
  sb.syncCoins();
}
// 42A — tills. coinLayer = stacks of ≤ 8 coin instances on each counter, drawn by the SAME InstancedMesh as the ground tips
//   (indices after sb.coins; 0 new draw calls). Walk-over collect (updateCoins), coinMagnetDash collects every till ≤ 2.2 u of the dash path
//   (wireAbilities CTX), season end sweeps what is left into the pouch minus SWEEP_TAX (ledger row, P2), seated helpers auto-collect (P2).
export const TILL_WALK = 1.1, TILL_MAGNET = 2.2;

// 42B: jars are places. sb.jarsWorld = J (see systems/jarsWorld.js). sb.interact() is THE one interact dispatcher: jar > till > Baron (42D) >
//   scam NPC (42D) > null — the key handler / ✋ button call it and only fall through to their old behaviour when it returns null.
//   sb.interactRelease() ends a hold (the E keyup). Collector contact → sb.jarsWorld.spillPouch() drops ground tips (42C hooks it).
// 43B: novelties (S2 stormWarning, S3 nightMarket, …) — one active at a time, registry in systems/novelties/index.js
function installNovelties(sb) {
  const bus = sb.game.bus; const R = sb.novelties = createNoveltyRegistry(sb); sb.novelty = null;
  sb.creatures = sb.headless ? {} : { makeBaronGilt, VillainAnimator };          // 43C: baronVisit reuses the 42D Baron model/animator (no duplicate model code)
  sb._offs.push(bus.on('season:novelty', (p) => { if (p?.id) R.start(p.id, p.season); }));
  sb._offs.push(bus.on('eco:season', () => R.end()));
}
function installJarsWorld(sb) {
  const { eco, vfx, hero } = sb, bus = sb.game.bus;
  const J = createJarsWorld({ bus, eco, jars: sb.world.jars, hero, vfx, sequences: sb.game.sequences, labels: sb.labelsRoot || null, camera: () => sb.game.camera?.three || sb.game.camera,
    onSpill: (a) => { const h = hero.root.position; let left = a; for (let i = 0; left > 0 && i < 4; i++) { const v = i === 3 ? left : Math.max(1, Math.round(a / 4)); left -= v; const ang = Math.random() * Math.PI * 2; sb.dropTip?.(h.x + Math.cos(ang) * 0.9, h.z + Math.sin(ang) * 0.9, v); } sb.stats.spilled = (sb.stats.spilled || 0) + a; } });
  sb.jarsWorld = J;
  // T1-A: unlock state. Spend from the start; Save on the first till sweep; Protect at the S2 storm warning; Invest after the S2 Ledger (data/jars.json).
  //   The tray hides locked jar cards (ui/build.js setHidden); jars:unlocked → pulse the Jars tab + NEW tag (wired in createLumenGame, the UI owner).
  sb.jarUnlocks = createJarUnlocks({ bus, data: sb.jarsData });
  sb.journal = createScamJournal({ bus, eco });                      // T5: Scam Journal (data only; ui/journal.js draws it, save v4 field scamJournal)
  sb._offs.push(() => { sb.journal?.destroy(); sb.journal = null; });
  sb._offs.push(() => { sb.jarUnlocks?.destroy(); sb.jarUnlocks = null; });
  // 48E: jars are buildables. build:placed {id:'jar_*'} → register(key, group) + the panel row shows; build:removed → unregister (balance → pouch) + row hides.
  const jarKeyOf = (p) => { const id = String(p?.id || p?.entry?.id || ''); return id.startsWith('jar_') ? id.slice(4) : null; };
  sb._offs.push(bus.on('build:placed', (p) => { const k = jarKeyOf(p); if (!k) return; const g = p.group || p.entry?.group; if (g) { g.userData.jar = k; J.register(k, g); g.userData.setFill?.(J.fill01(k)); } }));
  sb._offs.push(bus.on('build:removed', (p) => { const k = jarKeyOf(p); if (k) J.unregister(k); }));
  const registerPlacedJars = () => { for (const e of sb.build?.placed?.values?.() || []) { const k = jarKeyOf(e); if (k && e.group && J.get(k) !== e.group) { e.group.userData.jar = k; J.register(k, e.group); e.group.userData.setFill?.(J.fill01(k)); } } };
  registerPlacedJars();   // jars already placed (restore order)
  // T1-C (found by --jars1 T1.5): build.load() places SILENTLY (no build:placed) → after CONTINUE the saved jars were never registered with jarsWorld (pre-existing 48E gap:
  //   a resumed run had jars on the ground that could not be used). build:loaded fires once per load → register them then.
  sb._offs.push(bus.on('build:loaded', registerPlacedJars));
  sb.interact = () => {
    if (J.near()) return J.press() || 'jar';
    if (sb.pier?.near?.()) return sb.pier.interact() || 'pier';                     // 42D: the Baron waits at the pier → pay interest / repay
    if (sb.novelty?.near?.()) return sb.novelty.interact() || 'scam';                 // 43C: baronVisit → eco.offerScam('zeroInterestLoan')
    if (sb.scamNpc?.near?.()) return sb.scamNpc.interact() || 'scam';                 // 42D: the pitching Collector → eco.offerScam → 8B dialogue
    if (sb.enemies?.talk?.(3)) return 'talk';                                         // 42C P2: a seeking Collector ≤ 3 u → enemy:talk (42D attaches the pitch)
    if (sb.signNear?.()) { sb._signHold = { id: sb.signNear(), t0: sb.game.time, fired: false }; return 'sign'; }   // 44A: E at a stall sign → price +1 on release (< 0.5 s) / −1 on hold ≥ 0.5 s
    return null;
  };
  // T1-B: tap a jar from afar → Pip walks there on his own and puts 10 ✦ in (touch has no E key). Steers hero.inputOverride (the S18 cinematic hook, same
  //   screen-relative space as the stick) straight at the jar — HeroController slides along props, there is no pathing. One walk at a time; ends on: arrival
  //   (J.near() === jar → J.press() once + J.release(), jars:autowalk {jar, done:true}) · real stick input · pause / modal / build mode · 6 s timeout · jar removed.
  //   Never takes the override from a cinematic (hero.inputOverride already set by someone else → refuse).
  const AW_TIMEOUT = 6, AW_STICK = 0.2;
  sb.autoWalk = null;
  const awEnd = (why, extra = {}) => { const a = sb.autoWalk; if (!a) return; sb.autoWalk = null; if (hero.inputOverride === a.ov) hero.inputOverride = null; bus.emit('jars:autowalk', { jar: a.jar, done: why === 'arrived', why, ...extra }); };
  sb.startAutoWalk = (jar) => {
    const m = J.get(jar); if (!m || !hero?.root) return false;
    if (J.near() === jar) return false;                                  // already there — caller deposits
    if (sb.autoWalk) awEnd('retarget'); else if (hero.inputOverride) return false;   // a cinematic owns Pip
    const ov = { move: { x: 0, y: 0 } }; hero.inputOverride = ov; sb.autoWalk = { jar, ov, t: 0 };
    bus.emit('jars:autowalk', { jar, done: false, why: 'start' }); return true;
  };
  sb.cancelAutoWalk = (why = 'cancel') => awEnd(why);
  // S58 (open item 2): tap the stranger's bell / the stranger → Pip walks over and the talk opens (same override, same cancel rules as a jar walk).
  const AW_STRANGER_STOP = 1.7, AW_STRANGER_TIMEOUT = 12;
  sb.startWalkToStranger = () => {
    const N = sb.scamNpc; if (!N?.active || !(N.state === 'pitch' || N.state === 'arrive') || !N.g || !hero?.root) return false;
    if (N.near?.(AW_STRANGER_STOP + 0.4)) { sb.interact(); return true; }                   // already beside them → just talk
    if (sb.autoWalk) awEnd('retarget'); else if (hero.inputOverride) return false;
    const ov = { move: { x: 0, y: 0 } }; hero.inputOverride = ov; sb.autoWalk = { jar: 'stranger', ov, t: 0, pt: () => (N.active && (N.state === 'pitch' || N.state === 'arrive') && N.g ? N.g.position : null) };
    bus.emit('jars:autowalk', { jar: 'stranger', done: false, why: 'start' }); return true;
  };
  sb.autoWalkTick = (dt) => {
    const a = sb.autoWalk; if (!a) return;
    const inp = sb.game.input?.move;
    if (hero.inputOverride !== a.ov) { sb.autoWalk = null; return; }      // someone else took over
    if (a.pt) {                                                           // walking to the stranger
      const p = a.pt(); if (!p) return awEnd('removed');
      if (sb.game.paused || sb.build?.mode !== 'idle') return awEnd('blocked');
      if (inp && inp.x * inp.x + inp.y * inp.y > AW_STICK * AW_STICK) return awEnd('input');
      a.t += dt; if (a.t > AW_STRANGER_TIMEOUT) return awEnd('timeout');
      const h = hero.root.position; let dx = p.x - h.x, dz = p.z - h.z; const d = Math.hypot(dx, dz) || 1;
      if (d <= AW_STRANGER_STOP) { a.ov.move.x = 0; a.ov.move.y = 0; awEnd('arrived'); sb.scamNpc?.state === 'pitch' && sb.interact(); return; }
      a.ov.move.x = dx / d; a.ov.move.y = -dz / d; return;
    }
    if (!J.get(a.jar)) return awEnd('removed');
    if (sb.game.paused || sb.build?.mode !== 'idle') return awEnd('blocked');   // modals: lg.update cancels (it owns ui)
    if (inp && inp.x * inp.x + inp.y * inp.y > AW_STICK * AW_STICK) return awEnd('input');   // the player grabbed the stick
    a.t += dt; if (a.t > AW_TIMEOUT) return awEnd('timeout');
    if (J.near() === a.jar) { a.ov.move.x = 0; a.ov.move.y = 0; const r = J.press(); J.release(); return awEnd('arrived', { result: r }); }
    const h = hero.root.position, p = J.get(a.jar).position; let dx = p.x - h.x, dz = p.z - h.z; const d = Math.hypot(dx, dz) || 1;
    a.ov.move.x = dx / d; a.ov.move.y = -dz / d;                          // screen up = −z world
  };
  sb._offs.push(() => { awEnd('destroy'); });
  // 44A: the hanging sign is a place too — nearest stall whose sign hangs ≤ 1.6 u from the hero (world xz). Same ui:price handler as the build panel.
  sb.signNear = () => { const h = hero?.root?.position; if (!h) return null; let best = null, bd = 1.6 * 1.6; for (const st of sb.build?.stalls?.() || []) { const sg = st.slots?.sign; if (!sg) continue; sg.getWorldPosition?.(_signV) || _signV.copy(st.group.position); const dx = _signV.x - h.x, dz = _signV.z - h.z; if (dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = st.id; } } return best; };
  sb._signHold = null;
  sb.signHoldTick = () => { const sh = sb._signHold; if (sh && !sh.fired && sb.game.time - sh.t0 >= 0.5) { sh.fired = true; bus.emit('ui:price', { id: sh.id, delta: -1 }); } };
  sb.interactRelease = () => { J.release(); sb.pier?.release?.(); const sh = sb._signHold; if (sh) { sb._signHold = null; if (!sh.fired) bus.emit('ui:price', { id: sh.id, delta: +1 }); } };
  // bark on an absorbed event at the Protect jar (P2): the spatial choice pays back visibly
  const protectBark = (title, amount) => { const m = J.get('protect'); if (m) bus.emit('story:bark', { speaker: 'owl', text: `The Protect jar ate the ${title || 'shock'}${amount ? ` (${amount} ✦)` : ''}. That is what it is for.`, anchor: { x: m.position.x, y: 1.2, z: m.position.z }, ttl: 3.4 }); };
  sb._offs.push(bus.on('eco:absorbed', (p) => protectBark(eco.events?.[p?.id]?.title)));                                  // Bubble Shield path
  sb._offs.push(bus.on('eco:event', (p) => { if (p?.effect?.absorbed > 0) protectBark(p.event?.title, p.effect.absorbed); }));   // the jar itself absorbed (4A rule)
  sb._offs.push(() => { J.destroy(); sb.jarsWorld = null; });
}

// 42D: Baron Gilt at the pier. Only acts when sb.eco.pierPays (createSandbox opts.pierPays); otherwise B stays idle (pier:skip never fires either).
// 42D: the scam NPC. opts.scamNpcs (default: !headless) → the scheduler's scam mark spawns a pitching Collector instead of eco.offerScam();
//   headless gates keep the direct offer so --game/--firstplayer stay green. Sword targets include him (hit → refuse + flee), ledgerFlash near him → scam:tell.
function installScamNpc(sb) {
  const { eco, hero } = sb, bus = sb.game.bus;
  const S = createScamNpc({ bus, eco, hero, world: sb.world, game: sb.game, scene: sb.headless ? null : sb.game.scene, rng: sb.rng || Math.random,
    creatures: sb.headless ? {} : { makeStranger: (v, o) => makeStranger(v, { ...o, outline: false }), VillainAnimator }, canStand: (x, z) => sb.island.isLand(x, z) && !sb.build?.occupied?.(x, z) });   // T4: the friendly Stranger species (not a Collector); no ink-outline shells on it (-5 draw calls, the scene sits near 180 in S1)
  sb.scamNpc = S;
  sb._offs.push(() => { S.destroy(); sb.scamNpc = null; });
}
function installPier(sb) {
  const { eco, vfx, hero } = sb, bus = sb.game.bus;
  const B = createBaronPier({ bus, eco, world: sb.world, hero, vfx, game: sb.game, scene: sb.headless ? null : sb.game.scene, story: sb.storyData ? { data: sb.storyData } : null,   // 42D step 3: data/story.json "pier" lines (FALLBACK otherwise)
    creatures: sb.headless ? {} : { makeBaronGilt, VillainAnimator } });
  sb.pier = B;
  sb._offs.push(bus.on('pier:due', () => sb.holdClock('pier', true)), bus.on('pier:done', () => sb.holdClock('pier', false)));   // the new season's clock does not run while he waits
  sb._offs.push(() => { B.destroy(); sb.pier = null; });
}

function installTills(sb) {
  const { eco, vfx, hero } = sb, bus = sb.game.bus;
  sb.tillCoins = [];                                   // [{ position: Vector3, t, scale }] composed into sb.coinMesh after the ground coins
  const stacks = new Map();                            // stallId → coin objects
  const coinLayer = {
    setStack(stallId, n, pos, counterY = 0.9, { scale = 1 } = {}) {
      let arr = stacks.get(stallId); if (!arr) { arr = []; stacks.set(stallId, arr); }
      while (arr.length > n) { const c = arr.pop(); const i = sb.tillCoins.indexOf(c); if (i >= 0) sb.tillCoins.splice(i, 1); }
      while (arr.length < n) { const c = { position: new THREE.Vector3(), t: Math.random() * 6, scale: 1, till: stallId }; arr.push(c); sb.tillCoins.push(c); }
      arr.forEach((c, i) => { const col = i % 4, row = (i / 4) | 0; c.position.set(pos.x - 0.27 + col * 0.18, counterY + 0.03 + row * 0.07, pos.z + (row ? 0.1 : -0.08)); c.scale = scale; });
      sb._tillDirty = true;
    },
    clear(stallId) { coinLayer.setStack(stallId, 0, { x: 0, z: 0 }); stacks.delete(stallId); },
    spill(pos, value) { return sb.dropTip(pos.x, pos.z, value); },
    fly(pos, y, amount, how) { const from = new THREE.Vector3(pos.x, y, pos.z), to = hero.root.position.clone().setY(1.1);
      vfx.coinFly?.(from, to, null, { count: Math.min(6, Math.max(1, Math.round(amount / 5))) }); vfx.pop?.show?.(from.clone().setY(y + 0.6), `+${amount}`, { color: '#FFD54F', dur: 0.8, size: how === 'magnet' ? 1.15 : 1 }); },
  };
  sb.till = createTills({ bus, eco, build: sb.build, vfx, coinLayer, stats: sb.stats });
  sb.cust.till = sb.till;                              // customers.js _settle: economy.sell({ toTill }) + till.pay
  // compose: ground coins first (their indices are stable for 3B's magnet), till stacks after — one setMatrixAt pass, one needsUpdate
  const im = sb.coinMesh, baseSync = sb.syncCoins, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  sb.syncCoins = () => { baseSync(); const n0 = sb.coins.length, room = Math.max(0, im.instanceMatrix.count - n0); const list = sb.tillCoins.slice(0, room);
    list.forEach((c, i) => { _q.setFromEuler(_e.set(Math.PI / 2, 0, c.t)); _s.setScalar(c.scale); _m.compose(c.position, _q, _s); im.setMatrixAt(n0 + i, _m); }); im.count = n0 + list.length; im.instanceMatrix.needsUpdate = true; };
  // helpers' auto-collect pop (optional on HelperAnimator)
  // P2: season end → every counter is swept into the pouch minus the Collector tax; the ledger shows the red row (ui/ledger reads r.tillSweep)
  // the sweep runs BEFORE the report is built, so the tax is this season's expense and the ledger shows the red "Left on counters" row
  const baseEnd = eco.endSeason.bind(eco);
  eco.endSeason = (...a) => { const sw = sb.till.sweep(); const r = baseEnd(...a); if (r) { r.tillSwept = sw.swept; r.tillTax = sw.tax; if (sw.swept > 0) sb.log.push(`S${r.season} counters swept ${sw.swept} (tax ${sw.tax})`); } return r; };
  sb._offs.push(bus.on('till:full', (p) => { const t = sb.till.get(p.stallId); if (t) vfx.pop?.show?.(new THREE.Vector3(t.pos.x, 1.6, t.pos.z), 'FULL', { color: '#FF7043', dur: 1.0, size: 1.1 }); }));
  sb._offs.push(bus.on('build:placed', () => sb.till.refresh()));
  sb._offs.push(bus.on('build:loaded', () => sb.till.refresh()));
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
  // T2b: one visible answer per press (ui/powerAnswer.js shows 'ability:answer'; denied / locked are mapped there). kind: ok | none | absorbed
  const answer = (name, text, kind = 'ok') => bus.emit('ability:answer', { name, text, kind });
  const whenOf = (name) => sb.whenHint?.(name) || POWER_WHEN[name];
  sb._mag = null; sb._hagSaid = -9;
  const CTX = {
    // magnet: with joystick input the dash follows the stick (3B); idle → aim at the richest cluster = nearest coin, dash far enough to reach it (≤ 6 u)
    coinMagnetDash: () => {
      // 42A: till stacks are magnet targets too — each stack's first coin stands in for the whole till (collect empties it)
      const tillTargets = sb.till ? [...sb.till.tills.values()].filter((t) => t.amount > 0).map((t) => ({ position: new THREE.Vector3(t.pos.x, 0.9, t.pos.z), value: t.amount, till: t.stallId })) : [];
      const ctx = { coins: sb.coins.slice().concat(tillTargets), radius: TILL_MAGNET, onCollect: (c) => { if (sb._mag) { sb._mag.sum += Math.round(c.value || 0); sb._mag.last = game.time; } return c.till ? sb.till.collect(c.till, 'magnet') : sb.collectCoin(c, 'magnet'); } };
      const hp = hero.root.position, inp = game.input;
      if (!(inp?.move?.lengthSq() > 0.05) && ctx.coins.length) {
        let best = null, bd = Infinity; for (const c of ctx.coins) { const d = Math.hypot(c.position.x - hp.x, c.position.z - hp.z); if (d < bd) { bd = d; best = c; } }
        if (best) { ctx.dir = new THREE.Vector3(best.position.x - hp.x, 0, best.position.z - hp.z).normalize(); ctx.dashDist = Math.min(6, Math.max(1, bd + 0.5)); }
      }
      return ctx;
    },
    haggleShout: () => { let t = near(4.5); if (!t.length) t = near(99).sort((a, b) => a.root.position.distanceToSquared(hero.root.position) - b.root.position.distanceToSquared(hero.root.position)).slice(0, 3); return { targets: t, text: t.length ? '+10%!' : 'DEAL?', onShout: (tg) => { if (!tg?.stall) return; const k = String(tg.stall.id).replace(/^stall_/, ''); const h = sb.haggle.get(k) || { n: 0 }; h.n++; sb.haggle.set(k, h); done('haggleShout', `${k} next sale price ×1.1, demand ×1.3 (${h.n} charged)`); if (game.time - sb._hagSaid > 1) { sb._hagSaid = game.time; answer('haggleShout', 'Haggle: next sale ×1.1'); } } }; },
    growthStomp: () => ({ onPulse: (i, r, pct) => { sb.growth = { mul: 1 + pct / 100, until: game.time + GROWTH_S }; if (i === 2) { done('growthStomp', `all stalls demand ×${(1 + pct / 100).toFixed(2)} for ${GROWTH_S} s`); answer('growthStomp', `Stalls ×${+(1 + pct / 100).toFixed(2)} for ${GROWTH_S} s`); } } }),
    bubbleShield: () => ({ event: sb.nextEvent ? (eco.events[sb.nextEvent]?.title || sb.nextEvent) : 'next event', onAbsorb: () => { sb.shield.until = game.time + SHIELD_S; done('bubbleShield', `shield armed ${SHIELD_S} s — next event absorbed`); answer('bubbleShield', `Shield ${SHIELD_S} s: next hit free`); } }),
    fogSweep: () => ({ fog: { push: (o, d, s) => { const before = eco.state.fog01; eco.pushFog(s); done('fogSweep', `fog ${(before * 100) | 0}% → ${(eco.state.fog01 * 100) | 0}%`); if (before > 0.001) answer('fogSweep', `Fog ${(before * 100) | 0}% → ${(eco.state.fog01 * 100) | 0}%`); } } }),
    ledgerFlash: () => { const o = eco.pendingOffer; const npcTell = sb.scamNpc?.flash?.() || sb.novelty?.flash?.();   // 42D: near the pitching Collector the owl names the tell (scam:tell) even before any offer is open
      if (!o) return { cost: 0, trueCost: 0, text: npcTell ? `TELL: ${npcTell}` : 'no deal on the table', onReveal: () => { done('ledgerFlash', npcTell ? `tell named: ${npcTell}` : 'nothing to reveal'); if (npcTell) answer('ledgerFlash', `Tell: ${String(npcTell).split(/\s+/).slice(0, 6).join(' ')}`); } };
      const cost = o.cost || o.amount || 0, trueCost = o.amount ? Math.round(o.amount * Math.pow(1 + (o.trueRate || 0), 3)) : cost;
      return { cost, trueCost, text: o.payout === 0 ? `TRUE COST: ${cost} → you get 0` : undefined, onReveal: () => { eco.refuseOffer(o); done('ledgerFlash', `${o.title} revealed (true cost ${trueCost}) → refused`); answer('ledgerFlash', `TRUE COST ${trueCost}`); } }; },
  };
  sb.ability = (name) => {
    if (!CTX[name] || !ABILITY_NAMES().includes(name)) return null;
    if ((sb.cooldown[name] || -1) > game.time) { bus.emit('sandbox:denied', { name, why: 'cooldown', secondsLeft: sb.cooldown[name] - game.time }); return null; }
    const ctx = CTX[name]();
    const seq = hero.playMove(name, ctx);
    if (seq) {
      sb.cooldown[name] = game.time + COOLDOWN_S; bus.emit('sandbox:ability:start', { name, cooldown: COOLDOWN_S });   // S08: touch strip starts its sweep here
      // T2b: pressed with nothing to act on → say what to do instead (the move still plays); with a target the callbacks answer with the numbers
      const none = name === 'coinMagnetDash' ? !(ctx.coins && ctx.coins.length) : name === 'haggleShout' ? !(ctx.targets && ctx.targets.length) : name === 'ledgerFlash' ? ctx.text === 'no deal on the table'
        : name === 'growthStomp' ? !(sb.build?.stalls?.().length) : name === 'fogSweep' ? !(eco.state.fog01 > 0.001) : false;
      if (none) answer(name, whenOf(name), 'none');
      else if (name === 'coinMagnetDash') sb._mag = { sum: 0, last: null, born: game.time };
    } else bus.emit('sandbox:denied', { name, why: 'busy' });
    return seq;
  };
  // T2b: Magnet reports the sum it pulled in once the dash is over (or says it was too far) · Shield keeps a faint ring on Pip while armed (the existing bubble mesh, no new one)
  sb._fx = {};
  const fxTick = (name, until, total) => { const f = until > game.time ? Math.max(0, Math.min(1, (until - game.time) / total)) : 0; const last = sb._fx[name];
    if (last === undefined ? f > 0 : (Math.abs(f - last) >= 0.02 || (f === 0 && last !== 0))) { sb._fx[name] = f; bus.emit('ability:fx', { name, frac: f }); } };   // chips drain a thin bar from this (game time, so ×2/×3 speed stays honest)
  sb.answerTick = () => {
    fxTick('bubbleShield', sb.shield.until, SHIELD_S); fxTick('growthStomp', sb.growth.until, GROWTH_S);
    const m = sb._mag;
    if (m) {
      if (m.last != null) { if (game.time - m.last > 0.45) { sb._mag = null; if (m.sum > 0) answer('coinMagnetDash', `Magnet +${m.sum} ✦`); } }
      else if (game.time - m.born > 1.4) { sb._mag = null; answer('coinMagnetDash', 'Too far. Dash closer.', 'none'); }
    }
    const b = hero.props?.bubble; if (!b) return;
    const armed = game.time < sb.shield.until, inMove = hero.state === 'move' && hero.moveName === 'bubbleShield';
    if (inMove) { if (b.children[0]) b.children[0].visible = true; sb._ringOn = false; return; }
    if (armed) { sb._ringOn = true; b.visible = true; if (b.children[0]) b.children[0].visible = false; b.scale.setScalar(0.92 + 0.03 * Math.sin(game.time * 3)); }
    else if (sb._ringOn) { sb._ringOn = false; b.visible = false; if (b.children[0]) b.children[0].visible = true; b.scale.setScalar(1); }
  };
  // T2b: a shield that eats an event says what it saved
  sb._offs.push(bus.on('eco:absorbed', (p) => { const sp = eco.events?.[p?.id]?.effect?.spark; answer('bubbleShield', `🛡 ${typeof sp === 'number' && sp < 0 ? `−${-sp} ✦ ` : ''}absorbed`, 'absorbed'); }));
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
  sb.crew?.hire(h, { restore: free && !!sb.game.crewRestoring });   // T3: walks in from the pier to its post (a CONTINUE restore places it instantly)
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
  h.stall = stall || null;   // the till assignment (HELPER_EVERY auto-collect) — unchanged by T3
  if (h.job) { sb.crew?.retarget(h); return; }   // T3: a crew member with a job walks to its post, it is never teleported to the stall
  h.g.position.set(sx, 0, sz);
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
// States: 'title' → ('playing' <-> 'review') → 'ending' → 'endless' | 'title'.  Everything is driven by bus events:
//   ui:start {mode}        title → build the sandbox (createSandbox) → playing. mode 'endless' → no story, no win gate.
//   eco:season report      playing → review  (8B plays ledger lines first; `story:review` → ui.ledger.show(report))
//   ui:continue {outcome}  review → playing ('season') · → endless ('win') · → title ('lose')
//   eco:win / eco:lose     → ending (8B finale lines) → story:finale → endless | title
//   ui:pause {on, by}      pause reasons are OR-ed (menu ∨ dialogue ∨ ledger ∨ title) into game.paused — the only place that touches it.
// Nothing here edits a system; it only constructs, routes and owns `lg.state`.
export const GAME_VERSION = 'S57';   // S57 (2026-11-07): FUN_PASS T4 — friendly Stranger species (makeStranger, not Collector-shaped) walks in from the pier, strolls the plaza 25-40 s with a bell marker + edge arrow (ui/stranger.js), a sword never resolves them (whiff + owl 'Not an enemy. Talk to them.'), seasons.json strangers marks (S1 fair, S2 scam, then 1-2 per season, >= 1 in 3 fair), FAIRS deals (eco.offerFair), timeout = no penalty/reward. Gate --strangers 5/5. Previous: S56 (2026-11-06): FUN_PASS T2b + T3 — T2b Powers answer every press (hold = guide card on touch + desktop chips, ≤ 8-word answer pill, cooldown/busy/blocked lines, 6 touch chips with 4 dim, Shield/Stomp drain bar, whenHint in data/tutor.json, gate `--powers` 5/5). T3 Crew do visible jobs — src/systems/crewJobs.js: pier walk-in ≤ 3 s, posts (Owl→Save jar, Tortoise→Protect jar, Fox→pier, Mole→stalls, Bee circles busiest stall, Snail wanders + flowers) that need no stall, idle-work loop, payoff pops (+N / −N / +10% / 🛡 N / ! / 🌱) carrying the real numbers, Ledger Crew line, BFS paths, 1 InstancedMesh, gate `--crew` 8/8. S54 (2026-11-06): FUN_PASS T2 Curiosity guide — curiosity.js registry + curiosityWire.js (approach / linger / tap / HOLD / HUD data-guide), queued blue cards with maxShows + doneOn, pause GUIDE codex, tutorCounts in the save. S53 (2026-11-06): FUN_PASS T1 Jars — data/jars.json + jarUnlocks.js (Spend at start · Save on first till sweep · Protect at the storm warning · Invest after the S2 Ledger), tray lists unlocked jars only (NEW tag + tab pulse), tap a far jar → Pip auto-walks + deposits 10 ✦ (hero.inputOverride, 6 s timeout, cancels on stick/pause/modal), save field jarsUnlocked (additive v4) + legacy migration, verb chain deposit step unlocks Save + 'Build the Save jar' hint, FIX CONTINUE re-registers loaded jars (build:loaded), gate `--jars1` 10/10. S52 (2026-11-05): FUN_PASS T0 Debug panel — lg.debug hooks (installDebugHooks: grant/season/day/speed/stranger/wave/event/hire/clearTutor/resetSave/state/dump, n/a stubs for T1/T4/T7), ?debug=1 → src/debug/panel.js (aside#ll-debug, window.LUMEN_DEBUG), gate `--debug` 17/17. S51 (2026-11-04): phase 48 Hush — toasts/hero bark/touch buttons/pre-placed jars/verb chip deleted, blue once-only tutor cards. S50: phase 47 Measure-fix — telemetry counts dialogue time in modalSeconds (47A, PLAY_BUGS 45B-2), PERF.md 167 calls + ≤ 180 budget (47B, 45B-3). S49 (2026-11-04): phase 46 Quiet — comfort by deletion: verb chain waits for the opening dialogue (46A, PLAY_BUGS 45B-1), ?oldtutorial overlay deleted (46B), ?sliders legacy jars flag deleted + itch/GDD jars text fixed (46C). S48 (2026-11-04): phase 45 Ship v3 closed — itch page + 6 ship shots (45A), real-browser funnel + 13 gates + PLAY_BUGS (45B), final zip + Bible S48 (45C). S47 (2026-11-03): phase 44 closed — readable market: ♥/✓/✗ price bubbles + sign tint + E-on-sign price (44A), want bubbles + noStall leave (44B), season demand HOT/COLD fair× + PREFS× + sign glyph (44C), islands = NO (44D)
// S46 (prev):   // S46 (2026-11-03): phase 43 closed — season scripts (data/seasons.json), 5 novelties (storm/night/baron/picky/raidDouble), rotation S7–10 + endless, NEW chip, save v3.
// S44 (prev):   // S44 (2026-11-01): BUGFIX speed ×2/×3 + Spark Storm "stretched characters" — JellySpring fixed sub-step 1/120 s + clamp, setSquash clamped [0.3, 2.5]; tests/spring.test.mjs. Game_Bible S44.md in LUMEN_extras/
// S43 history:   // S43 (2026-11-01): 16B P1 — src/combat/Combat.js 3-hit sword combo (slash1 forehand / slash2 backhand / slash3 spin, power 1/1/2) with input buffering + soft lock-on (≤5 u, ±70°), installCombat(sb) · check.mjs --combat. Game_Bible S43.md in LUMEN_extras/
// S42:   // S42 (2026-11-01): 16A point-blank sword fix · 16B readability — Debt-Fog HUD bar hidden (island fog is the meter), lesson tag/ⓘ gone, 'Touch here!' ⏩ nudge when nothing happens. Game_Bible S42.md in LUMEN_extras/
// S41:   // S41 (2026-10-31): playtest-readability pass 15-0…15F — no fps/calls HUD pill, progressive HUD reveal, one text channel, unaffordable build cards, Collector wave banner + edge arrows, solid props, debt-clarity toasts. Game_Bible S41.md in LUMEN_extras/
// S40:   // S40 (2026-10-28): low-fps protection removed (no DPR/quality auto-demotion), quality locked to Settings, AudioContext resume watchdog. Game_Bible S40.md in LUMEN_extras/
export const GAME_STATES = ['title', 'playing', 'pier', 'review', 'ending', 'endless'];   // 42D: 'pier' = the Baron collects interest between a season and its ledger review
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

  lg.pierPays = opts.pierPays ?? !opts.headless;                                     // 42D: the real game pays interest at the pier; headless harnesses keep the old auto path unless they opt in
  lg.setState = (s) => { if (!GAME_STATES.includes(s)) throw new Error('bad state ' + s); const prev = lg.state; lg.state = s; lg.log.push(`${prev} → ${s}`); bus.emit('game:state', { state: s, prev }); return s; };
  // ---- pause: OR of every reason. game.paused is written ONLY here. --------------------------------------------------
  lg.pause = (by, on_) => { if (on_) lg.pauseBy.add(by); else lg.pauseBy.delete(by); const p = lg.pauseBy.size > 0; if (game.paused !== p) { game.paused = p; bus.emit('game:paused', { paused: p, by: [...lg.pauseBy] }); } return p; };
  // ---- S28 time speed: 1× / 2× / 3×. game.timeScale is written ONLY here (and zeroed/restored by HitStop, which we keep in sync). -------
  //   lg.setSpeed(n) · ui:speed {speed} or {cycle:true} (HUD ⏩ button, key T) · emits game:speed {speed}. Reset to 1× on season end,
  //   win/lose, title and whenever a dialogue/ledger/menu pauses the game (so a cut-scene never runs at 3×).
  const SPEEDS = [1, 2, 3]; lg.speed = 1;
  lg.setSpeed = (n, { silent } = {}) => {
    n = SPEEDS.includes(+n) || (+n === 4 && opts.debugKeys) ? +n : 1; lg.speed = n;   // T0-A: ×4 only with opts.debugKeys (debug panel)
    if (game.hitStop?.active) { const i = game.hitStop.targets.indexOf(game); if (i >= 0) game.hitStop.saved[i] = n; } else game.timeScale = n;
    bus.emit('game:speed', { speed: n });
    return n;
  };
  lg._offs.push(bus.on('ui:speed', (p) => { if (!lg.sb || (lg.state !== 'playing' && lg.state !== 'endless')) return; const next = p?.cycle ? SPEEDS[(SPEEDS.indexOf(lg.speed) + 1) % SPEEDS.length] : p?.speed; lg.setSpeed(next); }));
  lg._offs.push(bus.on('game:paused', (p) => { if (p?.paused && lg.speed !== 1) lg.setSpeed(1, { silent: true }); }));
  // ---- S42/16B speed-up nudge: ui.nudge shows a "Touch here!" hand on ⏩ after ~7 s of nothing happening. "Bored" = playing at 1×,
  //   no Collector chasing, no Glimmer on the island, no pending deal, not in build/placing mode. Game.js owns the predicate; ui/nudge.js the timing.
  lg.isBored = () => {
    const sb = lg.sb; if (!sb || (lg.state !== 'playing' && lg.state !== 'endless') || game.paused || lg.speed !== 1) return false;
    if (sb.eco?.pendingOffer || sb.modalOpen?.()) return false;
    if (sb.enemies?.active?.length) return false;
    if (sb.cust?.active?.some((c) => c.state !== 'pooled' && c.state !== 'despawn')) return false;
    if (ui?.build?.isOpen || ui?.build?.state?.placing || ui?.build?.state?.demolish) return false;
    return true;
  };
  ui?.nudge?.bind?.({ bored: lg.isBored });
  ui?.tutor?.bind?.({ blocked: () => !!lg.guideBlocked?.(), project: (p) => { const cam = game.camera?.three || game.camera; const el = game.renderer?.domElement; if (!cam?.projectionMatrix || !el) return null; const v = new THREE.Vector3(p.x, p.y, p.z).project(cam); return { x: (v.x + 1) / 2 * el.clientWidth, y: (1 - v.y) / 2 * el.clientHeight, behind: v.z > 1 }; }, touched: () => !!(ui?.build?.isOpen || (lg.sb?.build?.serialize?.() || []).some((e) => !e.scenery && String(e.id).startsWith('stall_')) || (lg.sb?.eco?.state?.jars && Object.values(lg.sb.eco.state.jars).some((v) => v > 0))) });   // 48F onCuriosityLull: tray opened / a stall built / any jar holds Spark → the player found it
  // S59: the cloud hand asks the world where a thing is. locate('hero' | 'coin' | 'jar:<id>' | 'stall' | 'till' | 'enemy' | 'stranger' | 'pier') → {x, z, y?} | null (nearest to Pip where it matters).
  ui?.tutor?.bind?.({ locate: (kind) => {
    const sb = lg.sb; if (!sb) return null; const hp = sb.hero?.root?.position; const xz = (o) => { const q = o && (o.position || o.root?.position || o.g?.position || o.group?.position); return q && Number.isFinite(q.x) && Number.isFinite(q.z) ? { x: q.x, z: q.z } : null; };
    const near = (arr, pick) => { let best = null, bd = Infinity; for (const o of arr || []) { const q = pick ? pick(o) : xz(o); if (!q) continue; const d = hp ? Math.hypot(q.x - hp.x, q.z - hp.z) : 0; if (d < bd) { bd = d; best = q; } } return best; };
    if (kind === 'hero') return hp ? { x: hp.x, z: hp.z } : null;
    if (kind === 'ahead') { if (!hp) return null; const dx = -hp.x, dz = -hp.z, d = Math.hypot(dx, dz) || 1, k = Math.min(3.2, d) / d; return { x: hp.x + dx * k, z: hp.z + dz * k, y: 0.2 }; }   // 'go there' marker for the Move step: 3 u toward the plaza (island centre), never over the water
    if (kind === 'coin') { const q = near(sb.coins); return q ? { ...q, y: 0.35 } : null; }
    if (kind.startsWith('jar:')) { const m = sb.jarsWorld?.get?.(kind.slice(4)); const q = xz(m); return q ? { ...q, y: 1.4 } : null; }
    if (kind === 'jar') { const J = sb.jarsWorld; return near((J?.ids?.() || []).map((id) => J.get(id))); }
    if (kind === 'stall') return near(sb.build?.stalls?.() || [], (s) => xz(s.group));
    if (kind === 'till') { const q = near(sb.till?.all?.()?.filter?.((t) => t.amount > 0) || [], (t) => (t.pos ? { x: t.pos.x, z: t.pos.z } : null)); return q ? { ...q, y: 1.0 } : null; }
    if (kind === 'enemy') return near((sb.enemies?.list || []).filter((e) => e && e.state !== 'flee' && e.state !== 'dead'), (e) => xz(e.g || e.root));
    if (kind === 'stranger') { const S = sb.scamNpc; return S?.active && S.g ? xz(S.g) : null; }
    if (kind === 'pier') { const B = sb.pier; return B?.active && B.g ? xz(B.g) : null; }
    return null;
  } });
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
  installTelemetry(lg);                                                             // 40A: anonymous funnel recorder (PLAN v6 §5); network off unless opts.telemetryEndpoint
  installCinematics(lg);                                                            // S18: title orbit showcase · arrival walk-in · victory lighthouse
  installDebugHooks(lg);                                                            // T0-A (FUN_PASS §4 T0): lg.debug.* hooks, no DOM, no window global (panel = T0-B)

  // ---- loop: UI clock + story clock + HUD day bar -------------------------------------------------------------------------
  lg.update = (dt, _g, dtReal) => {
    ui?.update?.(dtReal ?? dt);                                                       // UI animates even while the game is paused
    lg.cine?.update(dtReal ?? dt);                                                    // S18: cinematics run on the real clock (title is paused)
    if (lg.sb?.autoWalk && ui?.isModal?.()) lg.sb.cancelAutoWalk('blocked');           // T1-B: a modal (dialogue / ledger) ends the auto-walk
    if (lg.sb && !game.paused) { lg.story?.update?.(dt); emitTick(lg); lg.tut?.update?.(dt); lg.verbs?.update?.(dt); lg.proxTick?.(dt); lg.curiosity?.update?.(dt); }   // 48D: proximity interact · T2: 5 Hz curiosity check
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
    const sb = lg.sb = reuse || createSandbox(game, { headless: !!opts.headless, storyData: opts.storyData, jarsData: opts.jarsData, seasons: opts.seasons, seasonSeconds: opts.seasonSeconds, seed: opts.seed, balance, zonesUnlocked: opts.zonesUnlocked, maxActive: opts.maxActive, debugKeys: !!opts.debugKeys, starterStalls: lg._resuming ? false : undefined, labelsRoot: lg.ui?.root || null, pierPays: lg.pierPays });
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
    bus.emit('game:start', { mode: lg.mode, seasonsToWin: sb.eco.config.seasonsToWin, seasonSeconds: sb.eco.seasonSecondsFor(sb.eco.state.season), resumed: !!lg._resuming, debt: sb.eco.state.debt, loanRate: sb.eco.config.loanRate });   // S41/15F: toast.js explains the inherited debt once
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
  // S40 (2026-10-28): the S02 low-fps protection (PixelRatioGovernor → DPR drop → preset demotion high → medium → low, mirrored into
  //   Settings) is REMOVED. The Quality preset is now exactly what the player picked in ⏸ Settings (default 'medium') and never moves
  //   by itself — needed for gameplay capture, where the recorder itself lowers fps and the game kept downgrading itself to 'low'.
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
    try { lg.showcaseSb = createSandbox(game, { headless: !!opts.headless, storyData: opts.storyData, seasons: opts.seasons, seasonSeconds: opts.seasonSeconds, seed: opts.seed, balance: opts.balance, zonesUnlocked: opts.zonesUnlocked, maxActive: opts.maxActive, debugKeys: !!opts.debugKeys, pierPays: lg.pierPays }); }
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
  sb.till?.destroy?.(); if (sb.cust) sb.cust.till = null;                            // 42A
  if (sb.coinMesh) { game.scene.remove(sb.coinMesh); sb.coinMesh.geometry?.dispose?.(); }
  sb.crew?.dispose?.();                                                              // T3: flower mesh + applyLoss wrap
  for (const h of sb.helpers || []) { h.anim?.dispose?.(); freeMerged(h.g); game.scene.remove(h.g); }
  for (const v of (sb.villains || []).slice()) { const g = v.g || v.root || v; freeMerged(g); g.removeFromParent?.(); }
  sb.enemies?.dispose?.();                                                            // S16: fog puff pool + list
  sb.novelties?.dispose?.(); sb.novelties = null;                                     // 43B: active novelty end + listeners
  sb.unlocks?.destroy?.();                                                            // 43A: 41D unlocks kept 2 bus listeners (eco:season/eco:win) alive after destroy — found by --seasons
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
  installCuriosity(lg);   // T2: fresh registry per run (destroyed with _runOffs); lg.guideBlocked() = the same 'no card now' rule the tutor uses
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
  // ui:price handler moved to wireEconomy (44A) — the sandbox owns it so the stall sign (E) and the build panel share ONE handler
  if (ui?.build) { ui.build.offers = lg.offers; ui.build.priceOf = (id) => ({ price: sb.cust?.price?.(id) ?? 0, fair: sb.cust?.fair?.(id) ?? 0 }); }
  offs.push(() => { if (ui?.build) { ui.build.offers = null; ui.build.priceOf = null; } });
  // T1-A (FUN_PASS §4 T1): locked jars are NOT listed in the tray. sb.jarUnlocks.hiddenIds() → ui.build.setHidden; on jars:unlocked the Jars tab
  //   pulses (ll-new 1.2 s), the new card carries a NEW tag until first placed (ui/build.js markNew) and a 1.2 s reveal ping over the tab. No modal.
  if (ui?.build?.setHidden && sb.jarUnlocks) {
    ui.build.setHidden(sb.jarUnlocks.hiddenIds());
    on('jars:unlocked', (p) => { ui.build.setHidden(sb.jarUnlocks.hiddenIds()); if (p?.how !== 'restore') { ui.build.markNew?.('jar_' + p?.jar); ui.build.pulseTab?.('jar'); } });
    offs.push(() => ui.build.setHidden?.([]));
  }
  // BUGFIX B13: closing the tray never leaves a live ghost. BUGFIX P13: demolish mode SURVIVES closing the tray (the player closes it to see the
  // island and tap a stall) — the tray's own close() keeps st.demolish, the HUD toast says how to leave it, and Esc / re-open ✕ / a pick ends it.
  on('ui:build:close', () => { if (build.mode === 'place') build.exit(); });   // 48H: demolish toast deleted. BUGFIX P28: touch has a tappable Stop
  // BUGFIX B13: a placed STALL ends placement in both layers (no accidental second purchase on the next click); cheap decor/nature stay
  // armed for quick fences/paths and Esc / ✕ cancel them. build.exit() emits build:exit → the tray leaves placing.
  on('build:placed', (p) => { if (!p?.silent && build.mode === 'place' && String(p?.id).startsWith('stall_')) build.exit(); });
  if (ui?.build) { ui.build.reset?.(); ui.build.costOf = (id) => build.cost(id); ui.build.demandOf = (id) => sb.eco?.demandOf?.(id) ?? 1; ui.build.upgradeCost = (lvl) => build.upgradeCost(lvl); ui.build.placedInfo = (id) => [...build.placed.values()].filter((x) => x.id === id).map((x) => ({ level: x.level, cost: x.cost, salvage: x.salvage || 0, busy: build.busy.has(x.group) || !!x.group.userData.swapping }));   /* S34 / P80: tray greys ⬆/💰 mid-animation */ /* BUGFIX P24: cost → real refund label */ ui.build.refresh?.(); }
  offs.push(() => { if (ui?.build) { ui.build.upgradeCost = null; ui.build.placedInfo = null; ui.build.costOf = null; ui.build.demandOf = null; ui.build.reset?.(); } });
  // jars APPLY {pct}: move the whole pouch into the 4 jars by pct (spend stays as pouch → its share is the amount NOT moved)
  lg.applyJars = (pct = {}) => {
    const spark = eco.state.spark; if (spark <= 0) { bus.emit('eco:denied', { reason: 'nothing to allocate', cost: 0, spark }); return false; }
    const d = {}; let moved = 0;
    for (const k of ['save', 'invest', 'protect']) { const v = Math.max(0, Math.floor(spark * ((+pct[k] || 0) / 100))); if (v > 0) { d[k] = v; moved += v; } }
    if (!moved) return false;
    const ok = eco.allocate(d); if (ok) bus.emit('game:allocated', { moved, deltas: d, spark: eco.state.spark }); return ok;
  };
  on('ui:jar:apply', (p) => lg.applyJars(p?.pct));
  on('ui:ability', (p) => { if (!p?.name) return; if (lg.sb && (lg.state === 'playing' || lg.state === 'endless') && (ui?.isModal?.() || ui?.build?.isOpen || build.mode === 'place' || lg.game.paused)) { bus.emit('sandbox:denied', { name: p.name, why: 'blocked', reason: lg.game.paused && !ui?.isModal?.() ? 'paused' : ui?.isModal?.() ? 'modal' : build.mode === 'place' ? 'placing' : 'tray' }); return; } lg.ability(p.name); });                                        // 41D chips click
  // T2b: HOLD a power chip (touch or desktop, ≥ 350 ms) = ask the guide, the press is NOT fired. Locked: the card AND the live ★ count.
  on('ui:power:ask', (p) => { const n = p?.name; if (!n || !ui?.tutor) return; const u = lg.sb?.unlocks; const locked = !!(u && !u.abilities.has(n));
    ui.tutor.ask('power:' + n);
    if (locked) bus.emit('ability:answer', { name: n, text: lockedLine({ stars: starsFor(n), have: u.starsTotal }), kind: 'locked' }); });
  // T2b-2: the "no target → do this" line is DATA (data/tutor.json power:<id>.whenHint); powerAnswers.WHEN is the fallback
  const whenFromCards = (n) => ui?.tutor?.card?.('power:' + n)?.whenHint || null;
  if (lg.sb) lg.sb.whenHint = whenFromCards; on('game:state', () => { if (lg.sb && lg.sb.whenHint !== whenFromCards) lg.sb.whenHint = whenFromCards; });
  lg.syncAbilities = () => { const u = lg.sb?.unlocks; if (u) bus.emit('ui:abilities', { abilities: u.abilities, starsTotal: u.starsTotal }); };
  on('game:state', () => lg.syncAbilities()); on('ability:unlock', () => lg.syncAbilities());  // 41D HUD chips follow the set
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
  on('ui:jar:auto', (p) => { lg.autoApply = !!p?.on; if (p?.pct) lg.jarPct = { ...p.pct }; });
  if (ui?.jars?.setAuto && ui.jars.auto !== lg.autoApply) ui.jars.setAuto(lg.autoApply, 'restore');
  // BUGFIX B11: ↩ on a jar → Spark back into the pouch. BUGFIX B01: PAY BARON → economy.repay (the only way to clear principal; isWin needs debt 0).
  on('ui:jar:withdraw', (p) => { if (!p?.jar) return; const a = eco.withdraw(p.jar, p.amount); if (a > 0) bus.emit('game:withdrew', { jar: p.jar, amount: a, spark: eco.state.spark }); });
  lg.repay = (amount) => { const a = eco.repay(amount != null ? amount : eco.state.debt); if (a > 0) { bus.emit('game:repaid', { amount: a, debt: eco.state.debt, spark: eco.state.spark }); ui?.hud?.sync?.(eco.state); } return a; };
  on('ui:repay', (p) => { lg.repay(p?.amount); });   // 48H: HUD PAY toast deleted (the jars panel shows its own debt row)
  // ability keys — only while playing/endless and no modal owns the screen (dialogue keys 1–4, ledger Enter, pause Esc)
  lg.ability = (name) => { if (!lg.sb || (lg.state !== 'playing' && lg.state !== 'endless') || lg.game.paused) return null; return sb.ability(name); };
  // BUGFIX P27: 🔨 on the touch pad while a ghost is up CONFIRMS placement (BuildSystem._onAction already did via input.press) — it must
  //   not toggle (= close) the tray, which emitted ui:build:close → build.exit() and cancelled the placement. In demolish mode 🔨 leaves it (P28).
  on('ui:touch', (p) => { if (p?.action !== 'build' || lg.game.paused) return; if (build.mode === 'place') return; if (lg.demolishMode) { lg.demolishMode = false; ui?.build?.cancel?.(); return; } ui?.build?.toggle?.(); });
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
    if (build.mode !== 'drag') { const r = lg.sb.interact?.(); if (r) return r; }   // 42B: standing at a jar → deposit (one dispatcher, jar first)
    if (build.mode === 'drag') { build.dragRotate(); return 'rotate'; }   // S36: ✋ rotates the prop being dragged
    // BUGFIX P37/P38: prefer the nearest stall that can still be upgraded; a decor pot or a maxed L3 stall between Pip and it no longer blocks U / ✋
    const e = build.nearestUpgradable(hero.root.position.x, hero.root.position.z, 2.5);
    if (e) { lg.demolishMode = false; if (ui?.build?.state) ui.build.state.demolish = false; return build.upgrade(e) ? 'upgrade' : 'denied'; }   // S34 / P79
    const near = build.nearest(hero.root.position.x, hero.root.position.z, 2.5);
    if (near && !near.scenery && near.category === 'stall' && near.level >= 3) { return 'max'; }
    ui?.build?.open?.(); return 'tray';
  };
  on('ui:touch', (p) => { if (p?.action === 'interact') lg.interact(); if (p?.action === 'interact:release') lg.sb?.interactRelease?.(); });   // 42B: ✋ hold → withdraw (touch.js emits the release when it supports it)
  // S08: touch ability strip → same gate as the Q W E R F G keys (playing / endless, not paused, no modal, tray closed, not placing)
  on('ui:touch', (p) => {
    if (p?.action !== 'ability' || !p.name) return;
    if (ui?.isModal?.() || ui?.build?.isOpen || build.mode === 'place' || lg.game.paused) { bus.emit('sandbox:denied', { name: p.name, why: 'blocked', reason: lg.game.paused && !ui?.isModal?.() ? 'paused' : ui?.isModal?.() ? 'modal' : build.mode === 'place' ? 'placing' : 'tray' }); return; }
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
    if (lg.demolishMode) { const e = build.pick(lg.game.input?._ray?.ray) || build.nearest(world.x, world.z, 1.2); if (e && !e.scenery) build.demolish(e); else if (e && e.scenery) return; }   // P23: explain instead of silent refusal
    if (lg.guideTap?.(world, ev)) return;   // T2: tap a guideable thing → its card (any distance, every tap); a tap that has no game action is consumed here
    if (lg.selectTap?.(world, ev)) return;
    if (lg.landTap?.(world, ev)) return;   // 48D: tap a jar → use it · tap empty ground → the build tray opens on that cell
    prevTap?.(world, ev);
  };
  // 48D (HUSH D1): the ✋ Interact and 🔨 Build touch buttons are gone. Their two jobs move into the world:
  //   · tap a JAR (≤ 1.2 u of its mesh) → sb.interact() (deposit); tap the Baron / scam NPC when near → same dispatcher.
  //   · tap EMPTY LAND with the tray closed → bus 'ui:tap:land' {x,z} + the tray opens; the next build.enter(id) starts its ghost on that
  //     cell (lg.tapCell, consumed once, forgotten after 20 s or when the tray closes). Tray already open + land tap = placement confirm (unchanged).
  lg.tapCell = null;
  // T2 hold-to-ask: press-and-hold ≥ 350 ms on a guideable thing = its card, NO game action (the tap that acts never fires: taps are < 300 ms)
  const prevHold = lg.game.input?.onHold;
  if (lg.game.input) lg.game.input.onHold = (world, ev) => {
    if (!lg.sb || lg.game.paused || ui?.isModal?.() || build.mode === 'place' || build.mode === 'drag' || lg.demolishMode) { prevHold?.(world, ev); return; }
    if (!lg.curiosity?.tap(world, { hold: true })) prevHold?.(world, ev);
  };
  offs.push(() => { if (lg.game.input) lg.game.input.onHold = prevHold || null; });
  lg.guideTap = (world) => {
    const C = lg.curiosity; if (!C || !world || !lg.sb || lg.game.paused || ui?.isModal?.() || build.mode === 'place' || build.mode === 'drag' || lg.demolishMode) return false;
    const hint = C.tap(world); if (!hint) return false;
    return !C.lastTap?.act;                                                              // tools with a game action (jar, stall) go on to act; the rest are answered, not turned into a build tap
  };
  lg.landTap = (world) => {
    if (!lg.sb || lg.game.paused || ui?.isModal?.() || build.mode === 'place' || build.mode === 'drag' || lg.demolishMode || !world) return false;
    const J = lg.sb.jarsWorld; const ids = J?.ids?.() || [];
    for (const id of ids) { const m = J.meshOf?.(id); const p = m?.position || m; if (p && Math.hypot(p.x - world.x, p.z - world.z) <= 1.2) { if (J.near() !== id && lg.sb.startAutoWalk?.(id)) return true; lg.interact(); return true; } }   // T1-B: far jar → auto-walk, then deposit
    { const N = lg.sb.scamNpc; const gp = N?.active && (N.state === 'pitch' || N.state === 'arrive') ? N.g?.position : null;   // S58: tap on the stranger → walk there + talk
      if (gp && Math.hypot(gp.x - world.x, gp.z - world.z) <= 2.2 && lg.sb.startWalkToStranger?.()) return true; }
    if ((lg.sb.pier?.near?.() || lg.sb.scamNpc?.near?.() || lg.sb.novelty?.near?.()) && hero?.root && Math.hypot(hero.root.position.x - world.x, hero.root.position.z - world.z) <= 2.5) { lg.interact(); return true; }
    if (ui?.build?.isOpen) return false;                                                   // open tray: a land tap is handled by the tray / placement
    if (lg.sb.island?.isLand && !lg.sb.island.isLand(world.x, world.z)) return false;     // water: nothing to build on
    lg.tapCell = { x: world.x, z: world.z, at: lg.game.time };
    bus.emit('ui:tap:land', { x: world.x, z: world.z });
    ui?.build?.open?.();
    return true;
  };
  offs.push(bus.on('ui:build:close', () => { lg.tapCell = null; }));
  offs.push(bus.on('build:enter', () => { const c = lg.tapCell; lg.tapCell = null; if (c && lg.game.time - c.at < 20 && build.mode === 'place') build.moveTo(c.x, c.z); }));
  // 48D proximity interact (replaces ✋ for the Baron pier / scam NPC): hero ≤ 1.3 u of them and standing still 0.6 s → sb.interact() once;
  //   re-armed when the hero leaves the radius. Jars keep E / tap (a deposit must be a choice); the panel just un-collapses nearby (jars:near).
  lg._prox = { still: 0, fired: false };
  lg.proxTick = (dt) => {
    const sb = lg.sb; if (!sb || lg.game.paused || ui?.isModal?.() || build.mode !== 'idle') return;
    const near = sb.pier?.near?.(1.3) || sb.scamNpc?.near?.(1.3) || false;
    if (!near) { lg._prox.still = 0; lg._prox.fired = false; return; }
    const h = hero; const moving = h?.moving || (h?.vel && h.vel.lengthSq() > 1e-4);
    lg._prox.still = moving ? 0 : lg._prox.still + dt;
    if (!lg._prox.fired && lg._prox.still >= 0.6) { lg._prox.fired = true; sb.interact?.(); }
  };
  let _nearT = null;
  offs.push(bus.on('jars:near', (p) => { if (_nearT) { clearTimeout(_nearT); _nearT = null; } if (p?.jar) { ui?.jars?.setCollapsed?.(false); ui?.jars?.focus?.(p.jar); } else _nearT = setTimeout(() => { _nearT = null; ui?.jars?.setCollapsed?.(true); }, 1500); }));
  offs.push(() => { if (_nearT) clearTimeout(_nearT); });
  // S06: tap / click a stall (or any prop YOU built) on the island → inspect it: the Build Tray opens on its tab with its card selected,
  //   so 🚀 Deploy another · ⬆ Upgrade · 💰 Sell · price −/+ are one tap away. The 3D pick (roof / sign) comes first, then the ground cell.
  //   Scenery is "part of the island" (P23) and only gets a toast. Returns true when a prop was selected (the tap is consumed).
  lg.selectTap = (world) => {
    if (!lg.sb || lg.game.paused || ui?.isModal?.() || build.mode === 'place' || lg.demolishMode) return false;
    const e = build.pick(lg.game.input?._ray?.ray) || build.nearest(world.x, world.z, 1.0);
    if (!e) return false;
    if (e.scenery) { return true; }
    if (typeof e.id === 'string' && e.id.startsWith('jar_')) return false;   // T2 fix: a jar is used (landTap: walk + deposit), not inspected — selectTap ran first and swallowed every real jar tap (found in a real-mouse run)
    const cat = e.category || build.entry?.(e.id)?.category || 'stall';
    ui?.build?.setCategory?.(cat); ui?.build?.open?.(); ui?.build?.select?.(e.id);
    lg.inspected = { id: e.id, level: e.level || 1, at: lg.game.time };
    bus.emit('ui:inspect', { id: e.id, level: e.level || 1, category: cat, cost: e.cost });

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

      return true;
    };
    inp.onDrag = (world) => { if (lg.dragging) build.dragMove(world.x, world.z); };
    inp.onDragEnd = (world, ev, cancelled) => {
      if (!lg.dragging) return; lg.dragging = null;
      build.dragEnd(!!cancelled);   // 48H: 'hopped back' toast deleted
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
      const name = ABILITY_KEYS[e.code]; if (!name) return; if (hotkeysBlocked()) { if (lg.sb && (lg.state === 'playing' || lg.state === 'endless')) bus.emit('sandbox:denied', { name, why: 'blocked', reason: ui?.isModal?.() ? 'modal' : build.mode === 'place' ? 'placing' : 'tray' }); return; }
      if (e.code === 'KeyE' && lg.sb?.build?.mode !== 'place' && lg.sb?.build?.mode !== 'drag') { const r = lg.sb?.interact?.(); if (r) { eDown = true; return; } }   // 42B: E at a jar = deposit (hold = withdraw); elsewhere E stays growthStomp
      if (e.code === 'KeyW') { const k = lg.game.input?.keys; wDown = (k && MOVE_KEYS.some((c) => k.has(c))) ? 0 : (performance.now?.() || Date.now()); return; }
      if (e.code === 'KeyR' && lg.sb?.build?.mode === 'place') return;
      if (e.code === 'KeyR' && lg.sb?.build?.mode === 'drag') { lg.sb.build.dragRotate(); return; }   // S36
      lg.ability(name);
    };
    let eDown = false;
    const onKeyUp = (e) => { if (e.code === 'KeyE' && eDown) { eDown = false; lg.sb?.interactRelease?.(); return; } if (e.code !== 'KeyW' || !wDown) return; const dt = (performance.now?.() || Date.now()) - wDown; wDown = 0; if (dt <= 220 && !hotkeysBlocked()) lg.ability('bubbleShield'); };
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
  // 42D: with pierPays the Baron collects first → state 'pier' (clock held by installPier, 8B's ledger lines held) → pier:done → 'review' as before.
  //   B.begin() returns false when nothing is owed and the player is debt-free (pier:skip) → straight to review. Listener order: this runs
  //   BEFORE the StorySystem's eco:season (registered per run), so hold(true) is in place when onSeasonEnd() queues its lines.
  const toReview = (r) => { lg.setState('review'); lg.story?.hold?.(false); if (!lg.story) showLedger(r, { outcome: 'season' }); };   // 8B emits story:review after its ledger lines
  lg.enterPier = () => { const sb = lg.sb; if (!sb?.eco?.pierPays || !sb.pier?.begin?.()) return false; lg.setState('pier'); lg.story?.hold?.(true); lg.stats.piers = (lg.stats.piers || 0) + 1; return true; };
  on('eco:season', (r) => {
    if (!lg.sb) return; lg.lastReport = r; lg.stats.seasons++;
    if (lg.sb.eco.state.ended) return;                                                   // win/lose follow → ending path below
    if (!lg.enterPier()) toReview(r);
  });
  on('pier:done', () => { if (lg.sb && lg.state === 'pier') toReview(lg.lastReport); });
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
// ---- T0-A (FUN_PASS §4 T0): debug hooks. lg.debug = { grant, season, day, speed, stranger, wave, event, crisis, unlockJar, hire, clearTutor, resetSave, state, dump }.
//   Pure hooks: no DOM, no window global, zero cost unless called. The `?debug=1` panel (T0-B, src/debug/panel.js) and the headless
//   gate (T0-C, tools/gates/debug.mjs) call these. Hooks whose system does not exist yet return { na: 'T#' } so the panel can
//   render them disabled as "n/a (T#)". Every hook returns a plain object (never throws) so a phone tap can never break the game.
function installDebugHooks(lg) {
  const { bus, game } = lg; const ui = lg.ui;
  const noSb = () => ({ ok: false, why: 'no sandbox (press PLAY first)' });
  const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  const D = {
    /** +N ✦ into the pouch (default 100). economy.earn emits eco:spark → HUD. */
    grant(n = 100) { const sb = lg.sb; if (!sb) return noSb(); n = Math.max(0, Math.round(num(n, 100))); sb.eco.earn(n, 'debug'); return { ok: true, spark: sb.eco.state.spark, granted: n }; },
    /** Jump to season N (1..seasonsToWin): day 0, fresh ledger; the scheduler re-reads the seasons.json row on its next tick. Skips the opening. */
    season(n = 1) {
      const sb = lg.sb; if (!sb) return noSb(); const eco = sb.eco, s = eco.state;
      const max = Math.max(1, num(eco.config?.seasonsToWin, 10)); n = Math.min(max, Math.max(1, Math.round(num(n, 1))));
      s.season = n; s.day01 = 0; eco.ledger = eco._freshLedger(); eco.pendingOffer = null;
      if (sb.enemies) sb.enemies.waveSeason = 0;                                      // allow this season's wave again
      if (lg.story?.state) { lg.story.state.season = n; lg.story.state.openingPlayed = n; }   // skip the opening dialogue
      ui?.hud?.setSeason?.(n, 0); ui?.hud?.setSeasonSeconds?.(eco.seasonSecondsFor(n));
      sb.updateScheduler?.(0);                                                        // scheduler: S.season !== s.season → new marks for this row
      bus.emit('debug:season', { season: n });
      return { ok: true, season: n, seasonSeconds: eco.seasonSecondsFor(n) };
    },
    /** Set day 0.0–0.99; marks with at < f fire on the next scheduler tick (0.7 = wave). */
    day(f = 0) { const sb = lg.sb; if (!sb) return noSb(); f = Math.min(0.99, Math.max(0, num(f, 0))); sb.eco.state.day01 = f; sb.updateScheduler?.(0); return { ok: true, day01: f }; },
    /** Time scale 1/2/3 (4 only with opts.debugKeys). */
    speed(n = 1) { const r = lg.setSpeed(n); return { ok: r === +n, speed: r }; },
    /** Spawn a stranger: a scam id · a fair id · 'fair' (an unmet fair deal) · nothing (the next unmet scam). false when one is already out or an offer is pending. */
    stranger(id) {
      const sb = lg.sb; if (!sb) return noSb();
      const scamIds = Object.keys(sb.eco.scams || {}), fairIds = Object.keys(sb.eco.fairs || {}), ids = [...scamIds, ...fairIds];
      if (id && id !== 'fair' && !ids.includes(id)) return { ok: false, why: 'unknown scam id', ids };
      if (sb.eco.pendingOffer) return { ok: false, why: 'offer already pending' };
      let how = 'npc'; let ok = !!(sb.scamNpc?.spawn?.(id));
      if (!ok && sb.scamNpc?.active) return { ok: false, why: 'stranger already active', ids };
      if (!ok) { how = 'direct'; ok = !!(id === 'fair' || fairIds.includes(id) ? sb.eco.offerFair(id === 'fair' ? undefined : id) : sb.eco.offerScam(id)); }
      return { ok, how, id: sb.scamNpc?.id || sb.eco.pendingOffer?.id || id || null, kind: sb.scamNpc?.kind || null, ids };
    },
    /** Spawn this season's Collector wave now (bypasses the one-per-season guard). */
    wave() { const sb = lg.sb; if (!sb) return noSb(); if (!sb.enemies) return { ok: false, why: 'no enemies system' }; sb.enemies.enabled = true; sb.enemies.waveSeason = 0; const w = sb.enemies.spawnWave(sb.eco.state.season) || []; return { ok: w.length > 0, count: w.length, ids: Object.keys(sb.eco.events || {}) }; },
    /** Apply an economy event (storm, …) right now via eco.applyEvent; storm also triggers the visible storm. */
    event(id) {
      const sb = lg.sb; if (!sb) return noSb(); const ids = Object.keys(sb.eco.events || {}); if (!id || !ids.includes(id)) return { ok: false, why: 'unknown event id', ids };
      if (id === 'storm') sb.storm?.hit?.();
      const out = sb.eco.applyEvent(id); return { ok: !!out, id, effect: out?.effect || null, ids };
    },
    crisis() { return { na: 'T7' }; },
    /** T1-A: unlock a jar now (key spend|save|invest|protect). Emits jars:unlocked once; already-unlocked → ok:false. */
    unlockJar(k) { const sb = lg.sb; if (!sb) return noSb(); const U = sb.jarUnlocks; if (!U) return { ok: false, why: 'no jarUnlocks' }; if (!k || !U.rules[k]) return { ok: false, why: 'unknown jar key', keys: Object.keys(U.rules) }; const was = U.isUnlocked(k); const did = U.unlockNow(k, 'debug'); return { ok: did, why: was ? 'already unlocked' : undefined, jar: k, unlocked: U.unlocked(), keys: Object.keys(U.rules) }; },
    /** Hire a crew member for free (type = HELPER_TYPES entry, or the next unowned). */
    hire(type) { const sb = lg.sb; if (!sb) return noSb(); if (type && !HELPER_TYPES.includes(type)) return { ok: false, why: 'unknown crew type', types: HELPER_TYPES }; const h = hireHelper(sb, type || null, { free: true }); return { ok: !!h, type: h?.type || null, crew: sb.helpers.map((x) => x.type), types: HELPER_TYPES }; },
    /** Forget every guide card seen (tutor + save). */
    clearTutor() { const seen = ui?.tutor?.seen; if (ui?.tutor?.clear) ui.tutor.clear(); else if (Array.isArray(seen)) seen.length = 0; lg.tutorSeen = []; if (lg.sb) lg.save?.write?.(); return { ok: true, hintsSeen: Array.isArray(seen) ? seen.length : 0 }; },
    /** Delete the save slot (the running game is untouched). */
    resetSave() { const ok = !!lg.save?.clear?.(); return { ok, hasSave: !!lg.save?.has?.() }; },
    /** Plain JSON mirror of the HUD truth. Never NaN (every number is finite-guarded). */
    state() {
      const sb = lg.sb, eco = sb?.eco; const sum = eco?.summary?.() || null;
      const jars = sum?.jars || {}; for (const k of Object.keys(jars)) jars[k] = num(jars[k]);
      return {
        version: GAME_VERSION, state: lg.state, mode: lg.mode, paused: !!game.paused, speed: num(lg.speed, 1),
        season: num(sum?.season ?? eco?.state?.season, 0), day01: num(sum?.day01 ?? eco?.state?.day01, 0),
        spark: num(sum?.spark ?? eco?.state?.spark, 0), debt: num(sum?.debt ?? eco?.state?.debt, 0), fog01: num(sum?.fog01 ?? eco?.state?.fog01, 0),
        jars: { balances: jars, placed: sb?.jarsWorld?.ids?.() || [], unlocked: sb?.jarUnlocks?.unlocked?.() || [] },
        crew: (sb?.helpers || []).map((h) => h.type),
        hintsSeen: [...(ui?.tutor?.seen || lg.tutorSeen || [])],
        scamsSeen: [...(lg.story?.state?.scamsSeen || [])],
        pendingOffer: eco?.pendingOffer?.id || null,
        enemies: num(sb?.enemies?.active?.length, 0),
        drawCalls: num(game.stats?.drawCalls, 0),
        hasSave: !!lg.save?.has?.(),
      };
    },
    /** state() as a pretty string (panel "dump" button → console / clipboard). */
    dump() { const s = D.state(); const text = JSON.stringify(s, null, 2); if (typeof console !== 'undefined') console.log('[LUMEN_DEBUG]', text); return text; },
  };
  lg.debug = D;
}

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
  installVerbChain(lg);                                                          // 41B: diegetic verb chain (src/systems/verbChain.js)
}
// 40A: funnel telemetry. Pure recorder on the bus (src/systems/telemetry.js); storage = opts.storage || localStorage || memory; clock = performance.now.
//   Quit point is captured on ui:title / eco:lose / eco:win (inside the module) and on pagehide / tab hidden (here). lg.telemetry.export() is what
//   tools/funnel.mjs (40B) reads. Nothing here awaits or touches ui:start timing.
function installTelemetry(lg) {
  const { bus, ui, opts } = lg; if (opts.telemetry === false) return;
  let storage = opts.storage || null; if (!storage) { try { if (typeof localStorage !== 'undefined') storage = localStorage; } catch (_) { storage = null; } }
  const now = opts.telemetryNow || ((typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => Date.now());   // 40B: synthetic runs pass game-time ms
  const win = typeof window !== 'undefined' ? window : null;
  const T = createTelemetry({ bus, storage: storage || undefined, now, endpoint: opts.telemetryEndpoint || null, isModal: () => !!ui?.isModal?.(), version: lg.version,
    touch: !!(win && ('ontouchstart' in win)), w: win?.innerWidth | 0, h: win?.innerHeight | 0 });
  lg.telemetry = T;
  const ctx = () => ({ state: lg.state, season: lg.sb?.eco?.state?.season, day01: lg.sb?.eco?.state?.day01 });
  if (win) { const hide = () => { if (lg.sb) T.end('pagehide', ctx()); else T.flush(); }; const vis = () => { if (document.visibilityState === 'hidden') hide(); };
    win.addEventListener('pagehide', hide); document.addEventListener('visibilitychange', vis); lg._offs.push(() => { win.removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', vis); }); }
  lg._offs.push(() => T.destroy());
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
    if (snap.midSeason && snap.novelty && sb.novelties) sb.novelties.start(snap.novelty, eco.state.season);   // 43D (save v3): re-enter the active novelty (start is re-entrant, 43C note); its mark is skipped below
    if (lg.mode === 'endless') { eco.config.winRequiresSeasons = false; eco.config.endless = true; }
  }
  // BUGFIX B14: unlocked zones come back from the owned zone_* upgrades BEFORE the buildings are re-placed (locked zones are water → placements rejected)
  for (const id of eco.state.owned || []) { const u = eco.upgrades?.[id]; if (u?.kind === 'zone' && Number.isInteger(u.effect?.zone)) { if (sb.island.unlockInstant?.(u.effect.zone)) lg.stats.zonesRestored = (lg.stats.zonesRestored || 0) + 1; } }
  if (lg.stats.zonesRestored) sb.cust?.reroute?.();
  if (Array.isArray(snap.build) && snap.build.length) { Save.snapJarsToLand(snap.build, (x, z) => sb.island.isLand(x, z) && !build.occupied(x, z)); build.load(snap.build); sb.syncStalls?.(); sb.cust?.reroute?.(); }   // 48E: legacy (< v4) jars synthesized at (-8+i,3) snap onto free land — no floating jar   // BUGFIX: syncStalls is authoritative (skips decor/nature, adds L2/L3 upkeep)
  sb.game.crewRestoring = true;   // T3: a CONTINUE places each crew member at its post at once (no pier walk-in replay)
  for (const id of snap.helpers || []) { const type = String(id).replace(/^helper_/, ''); if (HELPER_TYPES.includes(type) && !sb.helpers.some((h) => h.type === type)) hireHelper(sb, type, { free: true }); }
  sb.game.crewRestoring = false;
  // BUGFIX P18: a restored position on water (old save, zone that is no longer unlocked) is pulled back to the nearest land cell (or the plaza)
  if (snap.hero && sb.hero?.root) { sb.hero.root.position.set(snap.hero.x, 0, snap.hero.z); if (!sb.island.isLand(snap.hero.x, snap.hero.z) && !sb.hero.recoverToLand?.()) sb.hero.root.position.set(0, 0, 1); lg.game.camera?.snapTo?.(sb.hero.root.position); }
  if (snap.jars) { lg.jarPct = { ...snap.jars }; lg.ui?.jars?.setPct?.(snap.jars); }
  if (snap.autoApply != null) { lg.autoApply = !!snap.autoApply; lg.ui?.jars?.setAuto?.(lg.autoApply, 'restore'); }   // S03
  if (snap.cust && sb.cust?.load) sb.cust.load(snap.cust);                               // BUGFIX B16: per-stall prices (+ sale totals) survive CONTINUE
  sb.unlocks?.restore?.(snap);                                                           // 41D: v2 abilities/starsTotal (v1 → starters)
  if (sb.journal) sb.journal.restore(snap.scamJournal);                                  // T5: tolerant — missing / malformed → empty journal (old saves load)
  if (Array.isArray(snap.jarsUnlocked) && sb.jarUnlocks) { sb.jarUnlocks.restore(snap.jarsUnlocked); lg.ui?.build?.setHidden?.(sb.jarUnlocks.hiddenIds()); sb.game.bus.emit('jars:unlocked', { jar: null, how: 'restore', unlocked: sb.jarUnlocks.unlocked() }); }   // T1-C: silent restore (how 'restore' → no NEW tag / pulse)
  if (Array.isArray(snap.tutorSeen)) { lg.tutorSeen = [...snap.tutorSeen]; const seen = lg.ui?.tutor?.seen; if (lg.ui?.tutor?.merge) lg.ui.tutor.merge({ seen: snap.tutorSeen, counts: snap.tutorCounts }); else if (Array.isArray(seen)) for (const id of snap.tutorSeen) if (!seen.includes(id)) seen.push(id); }   // T2: counts {id:n} (maxShows) merge on top of the seen list   // 48F: cards already shown on this profile stay shown
  lg.ui?.hud?.sync?.(eco.state); lg.ui?.jars?.setBalances?.(eco.state.jars); lg.ui?.jars?.setDebt?.(eco.state.debt, eco.state.spark); lg.ui?.build?.setSpark?.(eco.state.spark);
  // 42D: a save taken while the Baron waited at the pier resumes AT the pier (interestOwed survives in eco.state); the ledger it leads to is the last report
  if (snap.state === 'pier' && lg.enterPier?.()) { lg.lastReport = eco.history?.at?.(-1) || null; return; }
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
  // S40: no PixelRatioGovernor — fps never changes DPR or the quality preset (governor stays null; the debug line falls back to the renderer DPR).
  sb.perf = { shadows: new BlobShadows(scene, 48), lod: hasCam ? new CreatureLOD(cam, sb.opts?.lod) : null, governor: null, roots: [] };
  sb.perf.dispose = () => { sb.perf.shadows.dispose(); sb.perf.lod?.dispose?.(); };
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
}

/** VFX stand-in for Node: every pool call is a no-op counter. */
export function mockVfx() {
  const n = { calls: 0 }; const noop = () => { n.calls++; };
  // the fallback is a FUNCTION that also carries the pool methods, so both `vfx.fogRecede?.()` (9B win hook) and `vfx.pop.show()` work headless
  const pool = Object.assign(() => { n.calls++; return null; }, { burst: noop, ring: noop, show: noop, emit: noop, stream: noop, hide: noop, push: noop, pulse: noop, flash: noop, setCoverage: noop, coverage: 0 });
  return new Proxy({ _counts: n, fog: pool, coinFly: noop, debtPulse: noop, pop: pool, dust: pool, sparks: pool }, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : pool)) });
}

export default createSandbox;
