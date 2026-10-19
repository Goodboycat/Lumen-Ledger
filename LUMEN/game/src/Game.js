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
import { PROP_CATALOG, makeProp, STALL_TYPES, swayAll, swayDecor, updateLandmarks, makeFlowerField, makeGrassTufts } from './assets/props.js';
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
function buildScenery(sb, rnd) { return { lighthouse: null, cottage: null, pier: null, pierSpawn: null, baked: [] }; }
function placeStarterStalls(sb) {}
function wireEconomy(sb) {}
function wireAbilities(sb) {}
function installDebugKeys(sb) {}

/** VFX stand-in for Node: every pool call is a no-op counter. */
export function mockVfx() {
  const n = { calls: 0 }; const noop = () => { n.calls++; };
  const pool = { burst: noop, ring: noop, show: noop, emit: noop, stream: noop, hide: noop, push: noop, setCoverage: noop, coverage: 0 };
  return new Proxy({ _counts: n, fog: pool, coinFly: noop, debtPulse: noop, pop: pool, dust: pool, sparks: pool }, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : pool)) });
}

export default createSandbox;
