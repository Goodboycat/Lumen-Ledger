// 13B — Demo mode: a 60 s unattended, loopable camera + action script over a pre-built market, for trailer / GIF capture.
// Owned by 13B. Reads: 10C `createLumenGame` (lg.start / lg.sb / lg.state / lg.applyJars), Foundation `GameCamera`
// (game.followTarget Vector3 · camera.zoom · camera.offset), 10B sandbox (sb.build.load, sb.cust.spawnWave, sb.ability,
// sb.hero.playMove, sb.eco), 13A ITCH_PAGE §5 (the 6 shots = the 6 camera moves). Writes NOTHING into other systems'
// files: it only drives them through their public APIs. Inert in Node (no document → no CSS / keys), fully steppable.
//
//   import { createDemoMode } from './src/systems/demoMode.js';
//   const demo = createDemoMode(lg, { seconds: 60, loop: true, hud: true });
//   demo.start();            // builds the market if lg has no sandbox yet (lg.start('endless')), then plays shot 1
//   demo.stop();             // hands control back (camera follows Pip again, HUD shown, input released)
//   demo.shot                // current shot object { id, name, caption, ... } · demo.state.shotIndex / .elapsed / .loops
//   demo.toggleHud()         // key H in the browser — body.ll-demo-nohud hides #ll-hud/#ll-jars/#ll-build/#ll-touch/#ll-toasts/#debug-stats
//   demo.setCine(on)         // P3: 2.39:1 letterbox bars (body.ll-demo-cine)
//
// The script is ONE `Sequence` (src/anim/Sequencer.js) with six phases; it is stepped by the demo's own system with
// REAL dt so it keeps going while a dialogue / ledger pauses the sandbox (the demo auto-advances those modals itself).
// All camera motion is a dolly (followTarget lerp) + zoom tween — the GameCamera has no yaw, so there is no orbit.
import * as THREE from '../../vendor/three.module.js';
import { Sequence } from '../anim/Sequencer.js';
import { Easing } from '../anim/Easing.js';

export const DEMO_VERSION = '13B';
export const HUD_CLASS = 'll-demo-nohud', CINE_CLASS = 'll-demo-cine', HUD_HIDE = ['#ll-hud', '#ll-jars', '#ll-build', '#ll-touch', '#ll-toasts', '#debug-stats'];

/** The pre-built market (ITCH_PAGE §5 shot 1–6 need stalls on screen from frame one). 8 stalls L1–L3 around the plaza. */
export const DEMO_MARKET = [
  { id: 'stall_fruit', cx: -4, cz: -3, rot: 1, level: 2 }, { id: 'stall_bread', cx: 3, cz: -3, rot: 3, level: 3 },
  { id: 'stall_tea', cx: -3, cz: -6, rot: 0, level: 2 }, { id: 'stall_lantern', cx: 3, cz: -6, rot: 0, level: 1 },
  { id: 'stall_flower', cx: -4, cz: 0, rot: 1, level: 1 }, { id: 'stall_toy', cx: 3, cz: 0, rot: 3, level: 2 },
  { id: 'stall_fish', cx: 0, cz: -6, rot: 0, level: 1 }, { id: 'stall_pottery', cx: -1, cz: 3, rot: 2, level: 1 },
];
export const DEMO_SPARK = 400, DEMO_HELPERS = 2, DEMO_CUSTOMERS = 12;

// Shot table — ms · camera ease · zoom · where the camera dollies to · what Pip does. Filled in below (one shot per commit).
//   #  id                 ms     ease        zoom   target                     actions (ms → fn)
//   1  pier_arrival     10000  inOutCubic   0.80   pier → plaza (Pip walks)   0: wave of 12 Glimmers · Pip walks pier → plaza
//   2  build_ghost      10000  outCubic     0.70   Pip                        1200: build enter bread · 2800: ghost moves · 4600: confirm (hammer)
//   3  jars_apply       10000  inOutQuad    1.00   the 4 jars (−6.5, 3)       2500: APPLY save 40 / invest 15 / protect 15 · 4000: coinMagnetDash
//   4  debt_fog         10000  inOutCubic   1.20   fog edge (lighthouse side) 500: fog → 0.6 · 3000: debtPulse · 6000: fogSweep (G)
//   5  too_good_deal    10000  outQuad      0.90   Pip                        600: offerScam → dialogue (auto-advance, REFUSE) · after close: ledgerFlash "TRUE COST"
//   6  ledger_lighthouse 10000 inOutCubic   1.40   lighthouse                 800: beam on + fogRecede + confetti · 5000: endSeason → Ledger Review
export const SHOTS = [];

export function createDemoMode(lg, opts = {}) {
  const game = lg.game, bus = lg.bus || game.bus, ui = lg.ui || opts.ui || null;
  const O = { seconds: 60, loop: true, hud: true, autoStart: false, startMode: 'endless', keys: true, cine: false, slowMo: true, ...opts };
  const D = {
    version: DEMO_VERSION, lg, game, bus, ui, opts: O, shots: SHOTS, seq: null, state: { running: false, shotIndex: -1, elapsed: 0, shotElapsed: 0, loops: 0, actions: 0, hudHidden: false, cine: false, log: [] },
    rig: { target: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), zoomFrom: 1, zoomTo: 1, prevFollow: null, prevZoom: 1, prevOffset: null, walk: null },
    get shot() { return D.state.shotIndex >= 0 ? SHOTS[D.state.shotIndex] : null; },
  };
  const log = (m) => { D.state.log.push(m); if (D.state.log.length > 200) D.state.log.shift(); };
  D.log = log;

  installMarket(D);   // D.ensureMarket()
  installRig(D);      // D.lookAt(x,z) · D.walkTo(x,z) · D.steer(dt) · D.release()
  installScript(D);   // D.seq (the 6-phase Sequence) · D.fire(acts)
  installModals(D);   // D.autoAdvance(dtReal): dialogue / ledger auto-advance while the demo runs
  installDom(D);      // D.toggleHud() · D.setCine() · key H / Esc · CSS (browser only)

  D.start = () => {
    if (D.state.running) return D;
    D.ensureMarket();
    const sb = lg.sb; if (!sb) { log('start: no sandbox'); return D; }
    D.rig.prevFollow = game.followTarget; D.rig.prevZoom = game.camera?.zoom ?? 1; D.rig.prevOffset = game.camera?.offset?.clone?.() || null;
    D.rig.target.copy(sb.hero.root.position); game.followTarget = D.rig.target;
    D.state.running = true; D.state.elapsed = 0; D.state.shotIndex = -1;
    D.seq.play(D); bus.emit('demo:start', { shots: SHOTS.length, seconds: O.seconds });
    return D;
  };
  D.stop = (why = 'stop') => {
    if (!D.state.running) return D;
    D.seq.stop(); D.state.running = false; D.release();
    if (D.rig.prevFollow !== undefined) game.followTarget = D.rig.prevFollow || lg.sb?.hero?.root?.position || null;
    if (game.camera) { game.camera.zoom = D.rig.prevZoom; if (D.rig.prevOffset) game.camera.offset.copy(D.rig.prevOffset); }
    if (D.state.hudHidden) D.toggleHud(false);
    bus.emit('demo:stop', { why, loops: D.state.loops, shots: D.state.actions }); log('stop: ' + why);
    return D;
  };
  D.update = (_dt, _g, dtReal) => {
    if (!D.state.running) return;
    const dt = dtReal ?? _dt; D.state.elapsed += dt; D.state.shotElapsed += dt;
    D.seq.update(dt);                                     // real time: shots keep their length even while a modal pauses the sandbox
    D.autoAdvance(dt);
    if (!game.paused) D.steer(dt);
  };
  D._system = game.add({ update: (dt, g, dtReal) => D.update(dt, g, dtReal) });
  D.destroy = () => { D.stop('destroy'); D.destroyDom?.(); const i = game.systems?.indexOf(D._system); if (i >= 0) game.systems.splice(i, 1); };
  if (O.autoStart) D.start();
  return D;
}

// ---- parts (filled in below, one per commit) -----------------------------------------------------------------------
// P1.1 — pre-built market. If lg has no run yet, start one (default 'endless': no story gate, scams off, so the script owns the
// beats). Then: clear the 3 starter stalls → load the 8 DEMO_MARKET stalls (L1–L3, no pay) → Spark = DEMO_SPARK → hire 2 helpers
// (sb.keys.hire = 10B P3 work loop) → a 12-Glimmer wave queued at the pier → Pip at the plaza facing the pier. Idempotent per run.
function installMarket(D) {
  const { lg, game } = D;
  D.ensureMarket = () => {
    if (!lg.sb) { if (lg.state === 'title' && lg.ui?.title?.hide) { /* title closes inside lg.start */ } lg.start(D.opts.startMode); }
    const sb = lg.sb; if (!sb || sb._demoMarket) return sb;
    sb._demoMarket = true;
    sb.build.clear();
    const n = sb.build.load(DEMO_MARKET);
    sb.eco.state.stalls = sb.build.placed.size; sb.cust.reroute();
    sb.eco.state.spark = Math.max(sb.eco.state.spark, DEMO_SPARK);
    for (let i = 0; i < DEMO_HELPERS; i++) sb.keys?.hire?.();
    sb.eco.state.spark = Math.max(sb.eco.state.spark, DEMO_SPARK);                  // helpers are "pre-paid" in the demo
    sb.cust.spawnWave(Math.max(3, sb.eco.state.season), DEMO_CUSTOMERS);
    sb.hero.root.position.set(0, 0, 1); sb.hero.facing = Math.PI; sb.hero.root.rotation.y = Math.PI;
    if (game.camera?.snapTo) game.camera.snapTo(sb.hero.root.position);
    lg.ui?.hud?.sync?.(sb.eco.state); lg.ui?.jars?.setBalances?.(sb.eco.state.jars); lg.ui?.build?.setSpark?.(sb.eco.state.spark);
    D.log(`market: ${n} stalls · ${sb.helpers.length} helpers · spark ${sb.eco.state.spark} · wave ${DEMO_CUSTOMERS}`);
    D.bus.emit('demo:market', { stalls: n, helpers: sb.helpers.length, spark: sb.eco.state.spark });
    return sb;
  };
}
function installRig(D) { D.lookAt = () => {}; D.walkTo = () => {}; D.steer = () => {}; D.release = () => {}; }
function installScript(D) { D.seq = new Sequence('demo'); D.fire = () => {}; }
function installModals(D) { D.autoAdvance = () => {}; }
function installDom(D) { D.toggleHud = () => {}; D.setCine = () => {}; }

export default createDemoMode;
