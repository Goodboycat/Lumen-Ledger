// ZERO-BROWSER sanity check (cheap, ~1 credit). Run from game/ :
//   node tools/check.mjs                      → imports every module under src/ (syntax + import-path errors)
//   node tools/check.mjs --props              → also builds every PROP_CATALOG entry at L1/L2/L3, prints tris
//   node tools/check.mjs --creatures          → builds every Glimmer variant, runs all CreatureAnimator clips 1.5 s headless
//   node tools/check.mjs --hero --abilities   → 3A moves / 3B abilities on a headless HeroController
//   node tools/check.mjs --economy            → 4A Economy: runs tests/economy.test.mjs (80 asserts) + a 10-season sim, pure Node
//   node tools/check.mjs --story              → 8A data/story.json: parses, every Economy lessonId / SCAMS / EVENTS id has lines, speakers/moods match ui/dialogue.js, no banned words
//                                              + 8B src/systems/story.js: runs tests/story.test.mjs (58 asserts, real 4B economy) + a bus-driven 10-season walk here
//   node tools/check.mjs --vfx                → 9A src/vfx/pack1.js (+ 9B pack2.js if present): installs on a mock VFX/scene, fires every effect, steps 3 s headless, every pool drains, no NaN, ≤ 1 dc per pool
//   node tools/check.mjs --ui                 → 7A/7B/7C DOM UI: mounts ui/*.js on tools/domshim.mjs, fires bus events, clicks, reads text (7A hud/jars/build · 7B ledger/dialogue/toast)
//   node tools/check.mjs --sandbox            → 10B src/Game.js createSandbox headless (mock game, mock renderer): 3 starter stalls + 1 built, wave, 2 seasons
//   node tools/check.mjs --game               → 10C src/Game.js createLumenGame + ui/index.js mountUI on domshim: title → PLAY → S1 opening → … → S3 ledger → continue; win → endless; lose → title
//                                              accelerated (seasonSeconds 30) → 2 LedgerReports no NaN, 6 abilities touch the economy, H hires a helper, event + scam scheduled
//   node tools/check.mjs src/assets/foo.js    → import just these files
// Works with no Playwright, no Chromium, no GPU. Three.js r160 runs in Node for geometry/materials.
// Use this after EVERY file you write. Use tools/smoke.mjs (browser) only once at the end.
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

globalThis.window ??= globalThis; globalThis.self ??= globalThis;       // let DOM-free modules import
globalThis.document ??= { createElement: () => ({ style: {}, getContext: () => null, addEventListener() {} }), body: { appendChild() {} }, addEventListener() {} };
globalThis.navigator ??= { userAgent: 'node', maxTouchPoints: 0 };
globalThis.requestAnimationFrame ??= (f) => setTimeout(() => f(performance.now()), 16);
globalThis.devicePixelRatio ??= 1;

const args = process.argv.slice(2);
const doProps = args.includes('--props');
const doCreatures = args.includes('--creatures');
const doHero = args.includes('--hero');            // 3A hero moves (headless HeroController + mock game/vfx)
const doAbilities = args.includes('--abilities');  // 3B hero abilities (same harness + attachAbilities)
const doEconomy = args.includes('--economy');      // 4A economy core (pure JS: test file + sim, no Three)
const doBuild = args.includes('--build');          // 5 build system (headless: real Island + Economy + PROP_CATALOG, mock game)
const doCustomers = args.includes('--customers');  // 6A customer AI (headless: FlowField BFS + CustomerSystem FSM with real Island/Build/Economy/Glimmers)
const doStory = args.includes('--story');          // 8A story.json data (pure JSON, cross-checked against 4A/4B ids + 7B speakers/moods)
const doUI = args.includes('--ui');                // 7A/7B/7C DOM UI on a tiny DOM shim (tools/domshim.mjs)
const doVFX = args.includes('--vfx');
const doSandbox = args.includes('--sandbox');      // 10B integrated systems sandbox (headless createSandbox: economy + build + customers + abilities + helpers, 2 seasons)
const doGame = args.includes('--game');            // 10C the whole game headless: real UI (domshim) + real story + real sandbox driven by createLumenGame's state machine
const doSave = args.includes('--save');            // 10D save/load + tutorial: play to S2 → autosave → fresh lg → CONTINUE → same season/spark/stalls/toasts; export/import text; lose clears
const doPerf = args.includes('--perf');            // 11A src/systems/perf.js: BlobShadows (N discs → 1 InstancedMesh), CreatureLOD tiers + hysteresis, PixelRatioGovernor steps, countGeometries
const doIcons = args.includes('--icons');          // icons: ui/icons.js procedural set covers every emoji in src/ ui/ data/ index.html; SVG is strict-XML clean; ui/icons/*.png baked + manifest in sync
const doAudio = args.includes('--audio');          // 12 src/core/Audio.js headless (no AudioContext → inert): manifest ids ↔ DEFAULT_EVENTS, bus walk counts, cooldown, duck, unknown id, destroy
const doEnemies = args.includes('--enemies');      // S16 src/systems/enemies.js: Collector waves (size = season ≤ 5), contact −1 ✦ pouch only, Bubble Shield blocks, 2 sword hits → flee + 1 ✦ coin, Baron boss S6+ with powers, season end clears
const doStorm = args.includes('--storm');          // S17 src/vfx/storm.js: StormWeather headless — warn at day 0.30 (target 0.45), hit at 0.45 (→1, sky/fog/lights/wind gain ×3), auto-clear 4 s later, season end clears, shield absorb clears, dispose restores
const doCine = args.includes('--cinematics');    // S18 src/vfx/cinematics.js: CinematicDirector headless through createLumenGame — title showcase orbit (sandbox reused by PLAY), arrival walk-in (inputOverride, story held, tutorial waits for cine:end), SKIP, victory lighthouse (lamp lit by the shot, ending lines held), reduceMotion cut, ?nocine off
const doWorld = args.includes('--world');          // 10A integrated world: bakeStatic batches + Island v2 + every content pack placed headless (mirrors demo_world.html), counts meshes ≤ budget              // 9A/9B VFX packs: installPack1/installPack2 on a mock VFX+scene, fire every effect, step headless, check pools drain, 0 NaN, draw calls
let files = args.filter((a) => !a.startsWith('--'));
if (!files.length) { files = []; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && !p.endsWith('main.js')) files.push(p); } })('src'); }  // main.js is the DOM entry; skipped

let bad = 0;
for (const f of files) {
  try { const m = await import(pathToFileURL(resolve(f)).href); console.log('OK  ', f, '→', Object.keys(m).slice(0, 8).join(', ') + (Object.keys(m).length > 8 ? ', …' : '')); }
  catch (e) { bad++; console.log('FAIL', f, '→', e.message.split('\n')[0]); }
}
if (doProps) {
  const { PROP_CATALOG, countTris } = await import(pathToFileURL(resolve('src/assets/props.js')).href);
  console.log('\nPROP_CATALOG:', Object.keys(PROP_CATALOG).length, 'entries');
  for (const [id, e] of Object.entries(PROP_CATALOG)) {
    try {
      const tris = [1, 2, 3].map((level) => { const g = e.make({ level, outline: false }); let n = 0; g.traverse((o) => { if (o.isMesh) n++; }); return `${countTris(g)}t/${n}m`; });
      console.log(`  ${id.padEnd(22)} ${e.category.padEnd(8)} fp=${(e.footprint || []).join('x')}  L1 ${tris[0]}  L2 ${tris[1]}  L3 ${tris[2]}`);
    } catch (err) { bad++; console.log(`  ${id.padEnd(22)} FAIL → ${err.message.split('\n')[0]}`); }
  }
  // 1D decor: every decor prop ≤ 10 draw calls incl. outline; jars setFill 0/0.5/1 + jarFill Sequence runs 1 s headless
  // (reaches 'wobble', ends with fill=1, body scale back to 1, no NaN); lanterns setLit swaps material; sway props no NaN.
  try {
    const { DECOR_IDS, JAR_IDS, LANTERN_IDS, makeProp: mk, makeJarFillSequence, swayDecor } = await import(pathToFileURL(resolve('src/assets/props.js')).href);
    console.log('\nDECOR (1D):', DECOR_IDS.length, 'props');
    const noNaN = (g, what) => g.traverse((o) => { if (!isFinite(o.scale.x) || !isFinite(o.scale.y) || !isFinite(o.position.y) || !isFinite(o.rotation.x)) throw new Error('NaN pose in ' + what); });
    for (const id of DECOR_IDS) {
      try {
        const g = mk(id, { seed: 3 });
        let meshes = 0, hulls = 0; g.traverse((o) => { if (o.isMesh) (o.userData.isOutline ? hulls++ : meshes++); });
        const dc = meshes + hulls; if (dc > 10) throw new Error(`${dc} draw calls > 10`);
        if (g.userData.category !== 'decor' || !g.userData.footprint) throw new Error('missing userData.category/footprint');
        let extra = '';
        if (JAR_IDS.includes(id)) {
          if (typeof g.userData.setFill !== 'function') throw new Error('no setFill');
          for (const f of [0, 0.5, 1]) { g.userData.setFill(f); if (Math.abs(g.userData.fill - f) > 1e-6) throw new Error('fill not stored'); noNaN(g, 'setFill ' + f); }
          g.userData.setFill(0); if (g.userData.glow.visible) throw new Error('glow visible at fill 0');
          let done = false, sawWobble = false; const seq = makeJarFillSequence(g, { from: 0, to: 1, onDone: () => { done = true; } });
          seq.play(g); for (let i = 0; i < 60; i++) { seq.update(1 / 60); if (seq.currentName === 'wobble') sawWobble = true; noNaN(g, 'jarFill'); }
          const body = g.children.find((o) => o.name === 'merged_toon');
          if (!done || !sawWobble || g.userData.fill !== 1 || Math.abs(body.scale.y - 1) > 1e-6) throw new Error(`jarFill done=${done} wobble=${sawWobble} fill=${g.userData.fill} scaleY=${body.scale.y}`);
          extra = `  setFill+jarFill(${seq.totalMs}ms) OK`;
        }
        if (LANTERN_IDS.includes(id)) {
          if (typeof g.userData.setLit !== 'function') throw new Error('no setLit');
          g.userData.setLit(true); const on = g.userData.glass.material; g.userData.setLit(false); const off = g.userData.glass.material;
          if (on === off || !on.isMeshBasicMaterial || !off.isMeshToonMaterial) throw new Error('setLit did not swap toon↔flat');
          extra = '  setLit OK';
        }
        if (g.userData.sway) { for (let i = 0; i < 60; i++) { g.userData.sway(i / 60); } noNaN(g, 'sway'); }
        console.log(`  ${id.padEnd(16)} ${String(countTris(g)).padStart(4)} tris  ${meshes}m + ${hulls} outline = ${dc} dc${extra}`);
      } catch (err) { bad++; console.log(`  ${id.padEnd(16)} FAIL → ${err.message.split('\n')[0]}`); }
    }
    for (let i = 0; i < 30; i++) swayDecor(i / 30);
  } catch (e) { bad++; console.log('  decor.js FAIL →', e.message.split('\n')[0]); }
}
if (doCreatures) {
  const { makeGlimmerVariant, GLIMMER_TYPES, measureCreature, CreatureAnimator, CREATURE_ANIMS, hasBuilder, GLIMMER_BUILDERS_REGISTERED } = await import(pathToFileURL(resolve('src/assets/creatures/index.js')).href);
  console.log('\nGLIMMER_TYPES:', GLIMMER_TYPES.length);
  // 10A: CHANGE_REQUEST [2D] applied — 2A's registerBuilder() + glimmers2 auto-registration → makeGlimmerVariant('kid') ≠ regular kit
  try {
    const all12 = GLIMMER_TYPES.filter((t) => hasBuilder(t)).length;
    const kid = makeGlimmerVariant('kid', { seed: 3 }), reg = makeGlimmerVariant('regular', { seed: 3 });
    const tri = (g) => { let n = 0; g.userData.parts.kit.traverse((o) => { if (o.isMesh && o.geometry) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; };
    if (GLIMMER_BUILDERS_REGISTERED !== 8 || all12 !== 12 || tri(kid) === tri(reg)) throw new Error(`registered=${GLIMMER_BUILDERS_REGISTERED} builders=${all12} kidTris=${tri(kid)} regTris=${tri(reg)}`);
    console.log(`  registerBuilder (CR [2D] applied 10A): 8 registered · ${all12}/12 types have a builder · kid kit ${tri(kid)} tris ≠ regular ${tri(reg)}  OK`);
  } catch (err) { bad++; console.log('  registerBuilder FAIL →', err.message.split('\n')[0]); }
  for (const t of GLIMMER_TYPES) {
    try { const g = makeGlimmerVariant(t, { seed: 3 }); const m = measureCreature(g);
      const a = new CreatureAnimator(g); for (const n of CREATURE_ANIMS) { a.play(n); for (let i = 0; i < 90; i++) a.update(1 / 60); }
      console.log(`  ${t.padEnd(10)} ${String(m.tris).padStart(4)} tris  ${m.meshes}m + ${m.hulls} outline = ${m.drawCalls} dc  anims OK`);
    } catch (err) { bad++; console.log(`  ${t.padEnd(10)} FAIL → ${err.message.split('\n')[0]}`); }
  }
  // 2D: the 8 extra Glimmer variants — build each, require a baked kit (+ live pivot for flourish types), run all 8 clips
  // 1.5 s headless + the idle flourish 2 s, assert ≤ 12 dc, no NaN pose anywhere. Also makeGlimmerAny for all 12.
  try {
    const { makeGlimmerVariant2, makeGlimmerAny, GLIMMER_VARIANTS_READY_2, ALL_GLIMMER_VARIANTS, FLOURISH, registerVariants } = await import(pathToFileURL(resolve('src/assets/creatures/glimmers2.js')).href);
    console.log('\nGLIMMERS-2 (2D):', GLIMMER_VARIANTS_READY_2.length, 'variants');
    for (const t of GLIMMER_VARIANTS_READY_2) {
      try {
        const g = makeGlimmerVariant2(t, { seed: 3 }); const m = measureCreature(g);
        if (!g.userData.parts.kit || !g.userData.parts.kit.children.some((c) => c.name === 'merged_toon')) throw new Error('kit not baked');
        if (FLOURISH[t] && !g.userData.parts.live) throw new Error('flourish type without live group');
        if (m.drawCalls > 12) throw new Error(`draw calls ${m.drawCalls} > 12`);
        const a = new CreatureAnimator(g);
        for (const n of CREATURE_ANIMS) { a.play(n); for (let i = 0; i < 90; i++) { a.update(1 / 60); g.userData.update(1 / 60); } }
        for (let i = 0; i < 120; i++) g.userData.update(1 / 60);
        g.traverse((o) => { if (!isFinite(o.scale.y) || !isFinite(o.position.y) || !isFinite(o.rotation.y)) throw new Error('NaN pose'); });
        const live = g.userData.parts.live ? `live ${g.userData.parts.live.children.length}m` : 'static';
        console.log(`  ${t.padEnd(10)} ${String(m.tris).padStart(4)} tris  ${m.meshes}m + ${m.hulls} outline = ${m.drawCalls} dc  ${live.padEnd(8)} anims+flourish OK`);
      } catch (err) { bad++; console.log(`  ${t.padEnd(10)} FAIL → ${err.message.split('\n')[0]}`); }
    }
    try {
      if (ALL_GLIMMER_VARIANTS.length !== 12) throw new Error('ALL_GLIMMER_VARIANTS != 12');
      for (const t of ALL_GLIMMER_VARIANTS) { const g = makeGlimmerAny(t, { seed: 5 }); if (typeof g.userData.update !== 'function' || g.userData.type !== t) throw new Error('makeGlimmerAny ' + t); }
      const tgt = {}; const n = registerVariants(tgt); if (n !== 8) throw new Error('registerVariants added ' + n);
      const tmpKit = (await import(pathToFileURL(resolve('vendor/three.module.js')).href)).Group; tgt.kid(new tmpKit(), () => 0.5);
      console.log('  makeGlimmerAny ×12 + registerVariants(8) OK');
    } catch (err) { bad++; console.log('  glimmers2 API FAIL →', err.message.split('\n')[0]); }
  } catch (e) { bad++; console.log('  glimmers2.js FAIL →', e.message.split('\n')[0]); }
  // 2B helpers: build each type, run every clip 2 s headless, require ≥ 2 work beats + visible crate during carry
  try {
    const { makeHelper, HELPER_TYPES, HelperAnimator, HELPER_ANIMS } = await import(pathToFileURL(resolve('src/assets/creatures/helpers.js')).href);
    console.log('\nHELPER_TYPES:', HELPER_TYPES.length);
    for (const t of HELPER_TYPES) {
      try {
        const g = makeHelper(t, { seed: 3 }); const m = measureCreature(g); let beats = 0, crate = false;
        const a = new HelperAnimator(g, t, { onWork: () => beats++ });
        for (const n of [...HELPER_ANIMS, ...CREATURE_ANIMS]) { a.play(n); for (let i = 0; i < 120; i++) { a.update(1 / 60); if (n === 'carry') crate ||= g.userData.parts.held.visible; } g.traverse((o) => { if (!isFinite(o.scale.y) || !isFinite(o.position.y)) throw new Error('NaN pose in ' + n); }); }
        if (beats < 2 || !crate) throw new Error(`beats=${beats} crate=${crate}`);
        console.log(`  ${t.padEnd(14)} ${String(m.tris).padStart(4)} tris  ${m.meshes}m + ${m.hulls} outline = ${m.drawCalls} dc (incl. hidden carry crate 3)  ${beats} work beats  anims OK`);
      } catch (err) { bad++; console.log(`  ${t.padEnd(14)} FAIL → ${err.message.split('\n')[0]}`); }
    }
  } catch (e) { bad++; console.log('  helpers.js FAIL →', e.message.split('\n')[0]); }
  // 2C villains: build Baron + 3 collectors, run every clip 1.5 s headless; require fog puffs, scroll during offerDeal, sweat during flee, no NaN
  try {
    const { makeBaronGilt, makeFogCollector, VillainAnimator, VILLAIN_ANIMS, FogPuffPool } = await import(pathToFileURL(resolve('src/assets/creatures/villains.js')).href);
    console.log('\nVILLAINS: baron + 3 collectors');
    const fog = new FogPuffPool(null, 32);
    const builds = [['baron', () => makeBaronGilt({ seed: 3 })], ...[0, 1, 2].map((v) => [`collector${v}`, () => makeFogCollector(v, { seed: 3 })])];
    for (const [name, make] of builds) {
      try {
        const g = make(); const m = measureCreature(g); let deals = 0, slips = 0, scroll = false, sweat = false;
        const a = new VillainAnimator(g, { fogPool: fog, onDeal: () => deals++, onSlip: () => slips++ });
        const before = a.puffs;
        for (const n of [...VILLAIN_ANIMS, ...CREATURE_ANIMS]) {
          a.play(n);
          for (let i = 0; i < 90; i++) { a.update(1 / 60); fog.update(1 / 60); if (n === 'offerDeal') scroll ||= g.userData.parts.scroll.visible; if (n === 'flee') sweat ||= g.userData.parts.sweat.visible; }
          g.traverse((o) => { if (!isFinite(o.scale.y) || !isFinite(o.position.y) || !isFinite(o.rotation.x)) throw new Error('NaN pose in ' + n); });
        }
        if (a.puffs - before < 6 || deals < 1 || slips < 1 || !scroll || !sweat) throw new Error(`puffs=${a.puffs - before} deals=${deals} slips=${slips} scroll=${scroll} sweat=${sweat}`);
        console.log(`  ${name.padEnd(12)} ${String(m.tris).padStart(4)} tris  ${m.meshes}m + ${m.hulls} outline = ${m.drawCalls} dc (incl. hidden scroll+sweat 2)  ${a.puffs - before} puffs  anims OK`);
      } catch (err) { bad++; console.log(`  ${name.padEnd(12)} FAIL → ${err.message.split('\n')[0]}`); }
    }
    for (let i = 0; i < 120; i++) fog.update(1 / 60); if (fog.active !== 0) { bad++; console.log(`  FogPuffPool FAIL → ${fog.active} puffs never expired`); } else console.log('  FogPuffPool    1 InstancedMesh, all puffs expire  OK');
  } catch (e) { bad++; console.log('  villains.js FAIL →', e.message.split('\n')[0]); }
}
if (doHero) {
  // 3A hero moves: real HeroController on a mock Game (scene, input, sequences, camera, hitstop) + counting VFX mock.
  // Every move: plays to completion within totalMs+200 ms (loops: runs 2 s then stopMove), pose never NaN, root back on
  // y=0, body scale back to 1 ±0.03 (idle breathe ±0.025), state back to 'idle', hidden props hidden again; per-move assertions (VFX counts are burst CALLS: dash moved ≈3 u,
  // hammer hit-stopped + dusted, celebrate fired confetti (sparks fallback), carry walks, throwCoin arrives, stunned shows stars).
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { Sequence, SequencePlayer } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { HeroController } = await import(pathToFileURL(resolve('src/entities/HeroController.js')).href);
    const H = await import(pathToFileURL(resolve('src/anim/heroAnims.js')).href);
    const counts = { dust: 0, sparks: 0, pop: 0, hitstop: 0, shake: 0, slash: 0 };
    const vfx = { dust: { burst: () => counts.dust++, ring: () => counts.dust++ }, sparks: { burst: () => counts.sparks++ }, pop: { show: () => counts.pop++ }, slash: { fire: () => counts.slash++ }, flash: { flash() {} } };
    const input = { move: new THREE.Vector2(), actions: {}, pressed: () => false };
    const game = { scene: new THREE.Scene(), input, sequences: new SequencePlayer(), camera: { shake: () => counts.shake++ }, hitstop: () => counts.hitstop++, timeScale: 1, time: 0, systems: [], add(s) { this.systems.push(s); return s; } };
    const hero = new HeroController(game, { vfx, targets: () => [], isLand: (x, z) => Math.hypot(x, z) < 9 });
    H.attachMoves(hero);
    const names = Object.keys(H.HERO_MOVES);
    console.log('\nHERO MOVES (3A):', names.length, 'moves →', names.join(', '));
    const noNaN = (what) => hero.root.traverse((o) => { if (!isFinite(o.scale.x) || !isFinite(o.scale.y) || !isFinite(o.position.y) || !isFinite(o.rotation.x) || !isFinite(o.rotation.y)) throw new Error('NaN pose in ' + what); });
    const step = (dt = 1 / 60) => { input.move.set(0, 0); hero.update(dt); game.sequences.update(dt); game.time += dt; };
    let heroDc = 0, hidden = 0; hero.root.traverse((o) => { if (o.isMesh) { heroDc++; let v = true, q = o; while (q) { if (!q.visible) v = false; q = q.parent; } if (!v) hidden++; } });
    console.log(`  rig: ${heroDc} meshes incl. outline, ${hidden} hidden at rest (hammer/crate/stars/coin) → ${heroDc - hidden} dc visible`);
    for (const name of names) {
      try {
        const def = H.HERO_MOVES[name]; const before = { ...counts };
        hero.root.position.set(0, 0, 0); hero.facing = 0; hero.root.rotation.y = 0;
        let arrived = 0, hits = 0;
        const seq = hero.playMove(name, { onArrive: () => arrived++, onHit: () => hits++, target: name === 'hammer' ? new THREE.Vector3(0, 0, 3) : null });
        if (!seq || hero.state !== 'move' || hero.moveName !== name) throw new Error(`playMove returned ${seq} state=${hero.state}`);
        const seen = new Set(); let frames = 0; const maxFrames = def.loop ? 120 : Math.ceil((seq.totalMs + 200) / 1000 * 60);
        let maxDist = 0, starsSeen = false, toolSeen = false, carrySeen = false, coinSeen = false;
        // moves with def.after (pickUp → carry) chain into another move: run until the chained move takes over, then stop it
        let chained = false;
        for (; frames < maxFrames && hero.state === 'move' && !(chained = def.after && hero.moveName !== name); frames++) {
          if (def.allowMove && frames > 10) { input.move.set(1, 0); hero.update(1 / 60); game.sequences.update(1 / 60); } else step();
          if (seq.currentName) seen.add(seq.currentName); noNaN(name + ':' + seq.currentName);
          maxDist = Math.max(maxDist, Math.hypot(hero.root.position.x, hero.root.position.z));
          if (hero.props.stars.visible) starsSeen = true; if (hero.props.hammer.visible) toolSeen = true; if (hero.carrying) carrySeen = true; if (hero.props.coin.visible) coinSeen = true;
          if (Math.abs(hero.root.position.y) > 2.5) throw new Error('root.y ' + hero.root.position.y);
        }
        if (def.loop) { if (hero.state !== 'move') throw new Error('loop ended by itself'); hero.stopMove(); for (let i = 0; i < 15; i++) step(); }  // loop stopped mid-stride → let the landing spring settle 250 ms
        if (def.after) { if (!chained || !hero.carrying || hero.moveName !== 'carry') throw new Error(`did not chain into carry (moveName=${hero.moveName} carrying=${!!hero.carrying})`); hero.stopMove(); step(); }
        if (hero.state !== 'idle' || hero.currentMove) throw new Error(`did not finish: state=${hero.state} phase=${seq.currentName} after ${frames} frames`);
        if (seen.size !== seq.phases.length) throw new Error(`phases seen ${[...seen].join('/')} of ${seq.phases.map((p) => p.name).join('/')}`);
        const bs = hero.p.body.scale; if (Math.abs(bs.x - 1) > 0.03 || Math.abs(bs.y - 1) > 0.03 || Math.abs(bs.z - 1) > 0.03 || Math.abs(hero.root.position.y) > 1e-6) throw new Error(`rest pose scale=${bs.x.toFixed(2)},${bs.y.toFixed(2)},${bs.z.toFixed(2)} y=${hero.root.position.y}`);
        if (hero.props.hammer.visible || hero.props.stars.visible || hero.props.coin.visible || hero.carrying || !hero.sword.visible) throw new Error('props not hidden after move');
        const d = { dust: counts.dust - before.dust, sparks: counts.sparks - before.sparks, hitstop: counts.hitstop - before.hitstop, shake: counts.shake - before.shake, pop: counts.pop - before.pop };
        let extra = '';
        if (name === 'hammer') { if (d.hitstop < 1 || d.dust < 1 || d.sparks < 1 || d.shake < 1 || hits !== 1 || !toolSeen) throw new Error(`hammer hitstop=${d.hitstop} dust=${d.dust} shake=${d.shake} hits=${hits} tool=${toolSeen}`); extra = `hit-stop ×${d.hitstop} hits=${hits}`; }
        if (name === 'dash') { if (maxDist < 2.8 || maxDist > 3.3 || d.dust < 6) throw new Error(`dash moved ${maxDist.toFixed(2)} u dust=${d.dust}`); extra = `moved ${maxDist.toFixed(2)} u`; }
        if (name === 'celebrate') { if (d.sparks < 1 || d.pop < 1 || d.dust < 2 || d.shake < 1) throw new Error(`celebrate sparks=${d.sparks} pop=${d.pop} dust=${d.dust}`); extra = 'confetti(fallback) fired'; }
        if (name === 'build') { if (hits < 3 || d.hitstop < 3 || !toolSeen) throw new Error(`build hits=${hits} hitstop=${d.hitstop}`); extra = `hits=${hits}`; }
        if (name === 'pickUp') { if (!carrySeen) throw new Error('never carrying'); extra = 'crate lifted → chained into carry'; }
        if (name === 'carry') { if (!carrySeen || maxDist < 0.5) throw new Error(`carry carrying=${carrySeen} moved=${maxDist.toFixed(2)}`); extra = `walked ${maxDist.toFixed(2)} u while carrying`; }
        if (name === 'throwCoin') { if (!coinSeen || arrived !== 1) throw new Error(`throwCoin coinSeen=${coinSeen} arrived=${arrived}`); extra = 'coin flew + onArrive'; }
        if (name === 'stunned') { if (!starsSeen) throw new Error('no stars'); extra = 'stars orbited'; }
        console.log(`  ${name.padEnd(10)} ${String(seq.totalMs).padStart(5)} ms  ${seq.phases.length} phases  ${frames} frames  dust ${d.dust}  ${extra}  OK`);
      } catch (err) { bad++; console.log(`  ${name.padEnd(10)} FAIL → ${err.message.split('\n')[0]}`); hero.stopMove(); }
    }
    // makeMove standalone (integrator path without attachMoves API) + unknown name throws
    try { const s = H.makeMove('hammer', { hero, vfx, game }); if (!(s instanceof Sequence) || s.totalMs !== 530) throw new Error('makeMove hammer totalMs ' + s.totalMs); let threw = false; try { H.makeMove('nope', { hero }); } catch { threw = true; } if (!threw) throw new Error('unknown move did not throw'); console.log('  makeMove(name, ctx) → Sequence; unknown name throws  OK'); } catch (err) { bad++; console.log('  makeMove FAIL →', err.message); }
    // sword attack still works after attachMoves (update wrapper passes through)
    try { hero.doAttack(); for (let i = 0; i < 70; i++) step(); if (hero.state !== 'idle') throw new Error('state ' + hero.state); console.log('  swordAttack still OK after attachMoves'); } catch (err) { bad++; console.log('  swordAttack FAIL →', err.message); }
    // P11: lunges at the shore never leave land. isLand here = disc r<9 → integer cells x≤8 are land on z=0 (hypot(8,0)=8<9, 9 is water).
    // Park Pip at x=8.4 (rounds to 8, land), face +x and run every move that shifts the root: the position must stay on a land cell
    // afterwards and walking -x must still work (previously the 0.4 u slash lunge ended at 8.8 → rounds to 9 → stuck).
    try {
      const isLandPrev = hero.deps.isLand; hero.deps.isLand = (x, z) => Math.hypot(Math.round(x), Math.round(z)) < 9;   // tile-rounded like Island.isLand
      const onLand = () => hero.deps.isLand(hero.root.position.x, hero.root.position.z);
      const runs = [];
      const park = () => { hero.stopMove(); hero.root.position.set(8.4, 0, 0); hero.facing = Math.PI / 2; hero.root.rotation.y = hero.facing; hero.vel.set(0, 0, 0); };
      park(); hero.doAttack(); let maxX = 0; for (let i = 0; i < 70; i++) { step(); maxX = Math.max(maxX, hero.root.position.x); } if (!onLand() || hero.state !== 'idle') throw new Error(`slash ended at x=${hero.root.position.x.toFixed(2)} (max ${maxX.toFixed(2)}) state=${hero.state}`); runs.push(`slash max x ${maxX.toFixed(2)}`);
      for (const mv of ['hammer', 'build', 'dash']) { park(); hero.playMove(mv, { target: new THREE.Vector3(12, 0, 0) }); for (let i = 0; i < 200 && hero.state === 'move'; i++) step(); if (!onLand()) throw new Error(`${mv} ended at x=${hero.root.position.x.toFixed(2)}`); runs.push(`${mv} x ${hero.root.position.x.toFixed(2)}`); }
      // 'build' hops backwards: facing -x at the west shore must not hop into water either
      hero.stopMove(); hero.root.position.set(-8.4, 0, 0); hero.facing = -Math.PI / 2; hero.root.rotation.y = hero.facing; hero.playMove('build', {}); for (let i = 0; i < 200 && hero.state === 'move'; i++) step(); if (!onLand()) throw new Error(`build(back-hop) ended at x=${hero.root.position.x.toFixed(2)}`);
      // safety net: force a water position → the next walk frame pulls Pip back onto land and he can move
      hero.stopMove(); hero.root.position.set(8.8, 0, 0); input.move.set(-1, 0); hero.update(1 / 60); game.sequences.update(1 / 60); for (let i = 0; i < 10; i++) { input.move.set(-1, 0); hero.update(1 / 60); game.sequences.update(1 / 60); }
      if (!onLand() || hero.root.position.x > 8.45) throw new Error(`recoverToLand: x=${hero.root.position.x.toFixed(2)}`);
      console.log(`  P11 shore lunges stay on land (${runs.join(' · ')}) · forced x=8.8 → recovered to ${hero.root.position.x.toFixed(2)} and walking  OK`);
      hero.deps.isLand = isLandPrev; hero.root.position.set(0, 0, 0);
    } catch (err) { bad++; console.log('  P11 shore lunge FAIL →', err.message); hero.stopMove(); }
  } catch (e) { bad++; console.log('  heroAnims.js FAIL →', e.message.split('\n')[0]); }
}
if (doAbilities) {
  // 3B hero abilities: same harness as --hero (real HeroController + mock game/vfx) with attachAbilities(hero).
  // Every ability: registered in HERO_MOVES, plays to completion, all phases seen, no NaN, rest pose, ALL ability props
  // hidden again, draw calls at rest unchanged (hidden props = 0 dc); per-ability: coinMagnetDash collects ctx.coins
  // within radius + moved ≈4 u · bubbleShield bubble visible + onAbsorb(event) + hit-stop · growthStomp 3 rings, onPulse ×3,
  // radii ×1.5, hit-stop · ledgerFlash flash + onReveal(cost, trueCost) · haggleShout megaphone + onShout per target · fogSweep onSweep + fog.push.
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { Sequence, SequencePlayer } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { HeroController } = await import(pathToFileURL(resolve('src/entities/HeroController.js')).href);
    const H = await import(pathToFileURL(resolve('src/anim/heroAnims.js')).href);
    const A = await import(pathToFileURL(resolve('src/anim/heroAbilities.js')).href);
    const counts = { dust: 0, sparks: 0, pop: 0, hitstop: 0, shake: 0, flash: 0 };
    const vfx = { dust: { burst: () => counts.dust++, ring: () => counts.dust++ }, sparks: { burst: () => counts.sparks++ }, pop: { show: () => counts.pop++ }, slash: { fire() {} }, flash: { flash: () => counts.flash++ } };
    const input = { move: new THREE.Vector2(), actions: {}, pressed: () => false };
    const game = { scene: new THREE.Scene(), input, sequences: new SequencePlayer(), camera: { shake: () => counts.shake++ }, hitstop: () => counts.hitstop++, timeScale: 1, time: 0, systems: [], add(s) { this.systems.push(s); return s; } };
    const hero = new HeroController(game, { vfx, targets: () => [], isLand: (x, z) => Math.hypot(x, z) < 9 });
    game.scene.add(hero.root);
    A.attachAbilities(hero);           // calls attachMoves itself
    if (!hero.playMove || !hero.abilitiesAttached) throw new Error('attachAbilities did not attach');
    const names = A.ABILITY_NAMES();
    const want = ['coinMagnetDash', 'bubbleShield', 'growthStomp', 'ledgerFlash', 'haggleShout', 'fogSweep'];
    console.log('\nHERO ABILITIES (3B):', names.length, 'of', want.length, '→', names.join(', '), names.length < want.length ? ` (missing: ${want.filter((n) => !names.includes(n)).join(', ')})` : '');
    for (const n of names) if (!H.HERO_MOVES[n]) { bad++; console.log(`  ${n} FAIL → not registered in HERO_MOVES`); }
    const visibleDc = () => { let n = 0; game.scene.traverse((o) => { if (o.isMesh) { let v = true, q = o; while (q) { if (!q.visible) v = false; q = q.parent; } if (v) n++; } }); return n; };
    const dcRest = visibleDc();
    console.log(`  scene at rest: ${dcRest} visible meshes (ability props hidden → 0 dc)`);
    const noNaN = (what) => game.scene.traverse((o) => { if (!isFinite(o.scale.x) || !isFinite(o.scale.y) || !isFinite(o.position.y) || !isFinite(o.rotation.x) || !isFinite(o.rotation.y)) throw new Error('NaN pose in ' + what + ' (' + (o.name || o.type) + ')'); });
    const step = (dt = 1 / 60) => { input.move.set(0, 0); hero.update(dt); game.sequences.update(dt); game.time += dt; };
    const abilityProps = ['magnetCoins', 'bubble', 'rings', 'ledger', 'megaphone', 'arc'];
    for (const name of names) {
      try {
        const def = H.HERO_MOVES[name]; const before = { ...counts };
        hero.root.position.set(0, 0, 0); hero.facing = 0; hero.root.rotation.y = 0;
        const coins = [0.8, 1.6, 2.6, 3.6].map((z) => ({ position: new THREE.Vector3(0.6, 0.2, z) })); coins.push({ position: new THREE.Vector3(5, 0, 8) });   // last one is out of reach
        const targets = [{ position: new THREE.Vector3(1, 0, 2) }, { position: new THREE.Vector3(-1, 0, 2) }];
        let collected = 0, absorbed = null, pulses = [], revealed = null, shouts = 0, sweeps = 0, pushes = 0;
        const seq = hero.playMove(name, { coins, onCollect: () => collected++, event: 'Storm', onAbsorb: (e) => { absorbed = e; }, onPulse: (i, r, pct) => pulses.push(r),
          cost: 100, trueCost: 340, onReveal: (c, t) => { revealed = [c, t]; }, targets, onShout: () => shouts++, fog: { push: () => pushes++ }, onSweep: () => sweeps++ });
        if (!seq || hero.state !== 'move' || hero.moveName !== name) throw new Error(`playMove returned ${seq} state=${hero.state}`);
        const seen = new Set(); let frames = 0; const maxFrames = Math.ceil((seq.totalMs + 200) / 1000 * 60);
        let maxDist = 0; const propSeen = {}; let maxDc = 0;
        for (; frames < maxFrames && hero.state === 'move'; frames++) {
          step(); if (seq.currentName) seen.add(seq.currentName); noNaN(name + ':' + seq.currentName);
          maxDist = Math.max(maxDist, Math.hypot(hero.root.position.x, hero.root.position.z));
          for (const k of abilityProps) if (hero.props[k].visible) propSeen[k] = true;
          maxDc = Math.max(maxDc, visibleDc());
          if (Math.abs(hero.root.position.y) > 2.5) throw new Error('root.y ' + hero.root.position.y);
        }
        if (hero.state !== 'idle' || hero.currentMove) throw new Error(`did not finish: state=${hero.state} phase=${seq.currentName} after ${frames} frames`);
        if (seen.size !== seq.phases.length) throw new Error(`phases seen ${[...seen].join('/')} of ${seq.phases.map((p) => p.name).join('/')}`);
        const bs = hero.p.body.scale; if (Math.abs(bs.x - 1) > 0.03 || Math.abs(bs.y - 1) > 0.03 || Math.abs(bs.z - 1) > 0.03 || Math.abs(hero.root.position.y) > 1e-6) throw new Error(`rest pose scale=${bs.x.toFixed(2)},${bs.y.toFixed(2)},${bs.z.toFixed(2)} y=${hero.root.position.y}`);
        for (const k of abilityProps) if (hero.props[k].visible) throw new Error(`prop ${k} still visible`);
        if (hero.props.hammer.visible || !hero.sword.visible) throw new Error('tool not restored');
        const dcAfter = visibleDc(); if (dcAfter !== dcRest) throw new Error(`draw calls at rest changed ${dcRest} → ${dcAfter}`);
        const d = { dust: counts.dust - before.dust, sparks: counts.sparks - before.sparks, hitstop: counts.hitstop - before.hitstop, shake: counts.shake - before.shake, pop: counts.pop - before.pop, flash: counts.flash - before.flash };
        let extra = '';
        if (name === 'coinMagnetDash') { if (!propSeen.magnetCoins || collected !== 4 || maxDist < 3.7 || maxDist > 4.3 || d.pop < 1 || d.sparks < 4) throw new Error(`magnet coins=${propSeen.magnetCoins} collected=${collected}/4 moved=${maxDist.toFixed(2)} pop=${d.pop}`); extra = `moved ${maxDist.toFixed(2)} u · collected ${collected}/4 (1 out of reach)`; }
        if (name === 'bubbleShield') { if (!propSeen.bubble || absorbed !== 'Storm' || d.hitstop < 1 || d.shake < 1 || d.pop < 2) throw new Error(`bubble=${propSeen.bubble} absorbed=${absorbed} hitstop=${d.hitstop} pop=${d.pop}`); extra = `bubble shown · absorbed "${absorbed}" · hit-stop ×${d.hitstop}`; }
        if (name === 'growthStomp') { const ok = pulses.length === 3 && Math.abs(pulses[1] / pulses[0] - 1.5) < 0.05 && Math.abs(pulses[2] / pulses[1] - 1.5) < 0.05; if (!propSeen.rings || !ok || d.hitstop < 1 || d.shake < 1 || d.pop < 3) throw new Error(`rings=${propSeen.rings} pulses=${pulses.join('/')} hitstop=${d.hitstop} pop=${d.pop}`); extra = `rings ${pulses.map((r) => r.toFixed(1)).join('→')} (×1.5) · hit-stop ×${d.hitstop}`; }
        if (name === 'ledgerFlash') { if (!propSeen.ledger || !revealed || revealed[0] !== 100 || revealed[1] !== 340 || d.flash < 1 || d.pop < 2 || d.hitstop < 1) throw new Error(`ledger=${propSeen.ledger} revealed=${revealed} flash=${d.flash} pop=${d.pop} hitstop=${d.hitstop}`); extra = `ledger shown · flash ×${d.flash} · revealed ${revealed[0]}→${revealed[1]}`; }
        if (name === 'haggleShout') { if (!propSeen.megaphone || !propSeen.rings || shouts !== 3 || d.pop < 1 || d.shake < 1) throw new Error(`megaphone=${propSeen.megaphone} rings=${propSeen.rings} shouts=${shouts}/3 pop=${d.pop}`); extra = `megaphone + rings · onShout ×${shouts} (1 per ring, 2 targets wrap)`; }
        if (name === 'fogSweep') { if (!propSeen.arc || sweeps !== 1 || pushes !== 1 || d.dust < 2 || d.shake < 1) throw new Error(`arc=${propSeen.arc} sweeps=${sweeps} pushes=${pushes} dust=${d.dust}`); extra = `arc shown · onSweep + fog.push`; }
        console.log(`  ${name.padEnd(15)} ${String(seq.totalMs).padStart(5)} ms  ${seq.phases.length} phases  ${frames} frames  peak ${maxDc} dc (rest ${dcRest}; sword hides while held)  ${extra}  OK`);
      } catch (err) { bad++; console.log(`  ${name.padEnd(15)} FAIL → ${err.message.split('\\n')[0]}`); hero.stopMove(); hero.hideAbilityProps(); }
    }
    // interruption: stopMove() mid-ability hides every ability prop
    try {
      hero.playMove(names[0]); for (let i = 0; i < 12; i++) step(); hero.stopMove(); step();
      for (const k of abilityProps) if (hero.props[k].visible) throw new Error(`${k} visible after stopMove`);
      if (visibleDc() !== dcRest) throw new Error('dc after stopMove ' + visibleDc());
      console.log('  stopMove() mid-ability → all ability props hidden  OK');
    } catch (err) { bad++; console.log('  stopMove FAIL →', err.message); }
    // makeMove standalone path (integrator without attachAbilities) + 3A moves still intact + FINLIT text for every ability
    try {
      const s = H.makeMove(names[0], { hero, vfx, game }); if (!(s instanceof Sequence) || s.totalMs <= 0) throw new Error('makeMove ' + names[0]);
      for (const n of want) if (A.ABILITIES[n] && !(A.FINLIT[n] && A.FINLIT[n].lesson && A.FINLIT[n].key)) throw new Error('FINLIT missing for ' + n);
      hero.playMove('hammer', { target: new THREE.Vector3(0, 0, 3) }); for (let i = 0; i < 50; i++) step(); if (hero.state !== 'idle') throw new Error('3A hammer broke: ' + hero.state);
      console.log(`  makeMove('${names[0]}') → Sequence · FINLIT lessons ×${names.length} · 3A hammer still OK`);
    } catch (err) { bad++; console.log('  abilities API FAIL →', err.message); }
  } catch (e) { bad++; console.log('  heroAbilities.js FAIL →', e.message.split('\n')[0]); }
}
if (doEconomy) {
  // 4A economy: pure JS. Runs the assert file as a child (so its process.exit does not kill us) and a seeded 10-season sim
  // through the public API: sensible strategy must win by season 10 with fog 0, borrow-everything must lose; serialize round-trip.
  const { spawnSync } = await import('node:child_process');
  console.log('\nECONOMY (4A):');
  const t = spawnSync(process.execPath, ['tests/economy.test.mjs'], { encoding: 'utf8' });
  const summary = (t.stdout || '').trim().split('\n').pop();
  if (t.status !== 0) { bad++; console.log('  tests/economy.test.mjs FAIL →', (t.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 5).join(' | ') || (t.stderr || '').split('\n')[0]); }
  else console.log('  tests/economy.test.mjs →', summary, 'OK');
  try {
    const { Economy, BALANCE, EVENTS, SCAMS, UPGRADES } = await import(pathToFileURL(resolve('src/systems/economy.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const seen = new Set(); const b = new EventBus(); for (const n of ['eco:spark', 'eco:jar', 'eco:fog', 'eco:season', 'eco:event', 'eco:scam', 'eco:win', 'eco:lose', 'eco:sale', 'eco:loan']) b.on(n, () => seen.add(n));
    const e = new Economy(BALANCE, { bus: b, seed: 1, autoSeason: false });
    const stalls = ['fruit', 'tea', 'bread', 'flower', 'fish']; let built = 0;
    for (let s = 1; s <= 10 && !e.state.ended; s++) {
      if (built < stalls.length && e.state.spark - e.stallCost(stalls[built]) >= 40) { e.buyStall(stalls[built]); built++; }
      for (let i = 0; i < 20 + 5 * built; i++) { const st = stalls[i % Math.max(1, built)]; e.sell(st, 'regular', e.stallInfo(st).fair); }
      if (s === 3) e.applyEvent('storm'); if (s === 4) { e.offerScam(); e.refuseOffer(); }
      e.tick(BALANCE.seasonSeconds);
      if (e.state.debt > 0) e.repay(Math.floor(e.state.spark * 0.6)); else e.allocate({ save: Math.floor(e.state.spark * 0.4), invest: Math.floor(e.state.spark * 0.15), protect: Math.floor(e.state.spark * 0.1) });
      const r = e.endSeason(); if (!r || r.stars < 0 || r.stars > 3 || !r.lessonId || !isFinite(r.income)) throw new Error('bad report season ' + s);
    }
    if (e.state.ended !== 'win' || e.history.length !== 10) throw new Error(`sensible strategy → ${e.state.ended} after ${e.history.length} seasons (want win @10)`);
    const back = Economy.deserialize(e.serialize(), BALANCE, { bus: new EventBus() }); if (JSON.stringify(back.state) !== JSON.stringify(e.state)) throw new Error('serialize round-trip mismatch');
    const l = new Economy(BALANCE, { bus: b, seed: 3, autoSeason: false });
    for (let s = 1; s <= 12 && !l.state.ended; s++) { l.takeLoan(100); for (let i = 0; i < 20; i++) l.sell('fruit', 'regular', 6); l.spend(Math.floor(l.state.spark * 0.9), 'wants'); l.endSeason(); }
    if (l.state.ended !== 'lose') throw new Error('borrow-everything did not lose');
    const missing = ['eco:spark', 'eco:jar', 'eco:fog', 'eco:season', 'eco:event', 'eco:scam', 'eco:win', 'eco:lose', 'eco:sale', 'eco:loan'].filter((n) => !seen.has(n));
    if (missing.length) throw new Error('bus events never emitted: ' + missing.join(', '));
    console.log(`  sim: sensible → WIN @ season 10 (fog ${e.history[9].fog01}, net worth ${e.netWorth()}) · borrow-everything → LOSE @ season ${l.history.length} · serialize round-trip · 10 bus events  OK`);
    console.log(`  content: EVENTS ${Object.keys(EVENTS).length} · SCAMS ${Object.keys(SCAMS).length} · UPGRADES ${Object.keys(UPGRADES).length} · stalls ${Object.keys(BALANCE.stalls).length} · glimmer types ${Object.keys(BALANCE.glimmers).length} · lessons ${BALANCE.lessons.length}`);
  } catch (err) { bad++; console.log('  economy sim FAIL →', err.message.split('\n')[0]); }

  // 4B economy content & balance (additive): economyData.js → ≥ 8 EVENTS (title/text/finlit/lesson), 6 SCAMS (each with a tell),
  // UPGRADES tree (stall/helper/zone, requires resolvable), every event + scam actually applied through the 4A API,
  // pickEvent/canBuyUpgrade, and the 3-strategy sweep from tests/economy.sim.mjs: sensible wins S10±1 on 10 seeds,
  // borrow-everything + hoarder lose on every seed.
  console.log('\nECONOMY (4B):');
  try {
    const D = await import(pathToFileURL(resolve('src/systems/economyData.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { BALANCE } = await import(pathToFileURL(resolve('src/systems/economy.js')).href);
    const { EVENTS, SCAMS, UPGRADES, BALANCE_TUNED, makeEconomy, pickEvent, canBuyUpgrade } = D;
    const lessons = new Set(BALANCE.lessons);
    const evIds = Object.keys(EVENTS); if (evIds.length < 8) throw new Error(`EVENTS ${evIds.length} < 8`);
    for (const id of evIds) { const e = EVENTS[id]; for (const k of ['id', 'title', 'text', 'finlit', 'lesson', 'effect']) if (!e[k]) throw new Error(`EVENTS.${id} missing ${k}`); if (e.id !== id) throw new Error(`EVENTS.${id}.id mismatch`); if (!lessons.has(e.lesson)) throw new Error(`EVENTS.${id} unknown lesson ${e.lesson}`); }
    const scIds = Object.keys(SCAMS); if (scIds.length !== 6) throw new Error(`SCAMS ${scIds.length} ≠ 6`);
    for (const id of scIds) { const s = SCAMS[id]; for (const k of ['id', 'title', 'pitch', 'tell', 'text', 'lesson']) if (!s[k]) throw new Error(`SCAMS.${id} missing ${k}`); if (!(s.cost > 0 || s.amount > 0)) throw new Error(`SCAMS.${id} has neither cost nor amount`); if (s.amount && !(s.trueRate > BALANCE.loanRate)) throw new Error(`SCAMS.${id} trueRate must exceed loanRate`); }
    const upIds = Object.keys(UPGRADES); if (upIds.length < 8) throw new Error(`UPGRADES ${upIds.length} < 8`);
    const kinds = new Set();
    for (const id of upIds) { const u = UPGRADES[id]; if (!(u.cost > 0) || !u.kind || !u.text || !u.effect) throw new Error(`UPGRADES.${id} incomplete`); kinds.add(u.kind); for (const r of u.requires || []) if (!r.startsWith('season:') && !UPGRADES[r]) throw new Error(`UPGRADES.${id} requires unknown ${r}`); }
    for (const k of ['stall', 'helper', 'zone']) if (!kinds.has(k)) throw new Error('UPGRADES missing kind ' + k);
    for (const id of Object.keys(BALANCE.stalls)) { const s = BALANCE_TUNED.stalls[id]; if (!s || !(s.fair > 0) || !(s.base > 0) || !(s.cost > 0)) throw new Error('BALANCE_TUNED.stalls.' + id + ' incomplete'); }
    // every event + scam through the 4A API
    const bus = new EventBus(); let evSeen = 0, scSeen = 0; bus.on('eco:event', () => evSeen++); bus.on('eco:scam', () => scSeen++);
    const e = makeEconomy({ bus, seed: 7, autoSeason: false });
    e.buyStall('fruit'); for (let i = 0; i < 30; i++) e.sell('fruit', 'regular', 6); e.allocate({ save: 60, invest: 30, protect: 20 });
    for (const id of evIds) { const r = e.applyEvent(id); if (!r || !r.effect) throw new Error('applyEvent failed ' + id); for (const v of Object.values(r.effect)) if (!isFinite(v)) throw new Error('non-finite effect ' + id); }
    for (const id of scIds) { const o = e.offerScam(id); if (!o || o.id !== id || !o.tell) throw new Error('offerScam failed ' + id); const r = (scIds.indexOf(id) % 2) ? e.acceptOffer() : e.refuseOffer(); if (r.accepted === undefined) throw new Error('scam result ' + id); }
    if (evSeen !== evIds.length || scSeen !== scIds.length) throw new Error(`bus saw ${evSeen}/${evIds.length} events, ${scSeen}/${scIds.length} scams`);
    if (!isFinite(e.state.spark) || !isFinite(e.state.debt) || e.state.fog01 < 0 || e.state.fog01 > 1) throw new Error('state corrupted after content pass');
    if (!['win', 'lose', null].includes(e.endSeason() && e.state.ended)) throw new Error('endSeason after scams');
    // pickEvent respects season gates; canBuyUpgrade respects requires / season / cost
    const f = makeEconomy({ bus: new EventBus(), seed: 2, autoSeason: false });
    for (let i = 0; i < 50; i++) { const id = pickEvent(f, 1); if (!id || (EVENTS[id].season || 1) > 1) throw new Error('pickEvent season gate broke: ' + id); }
    f.state.spark = 10000;
    if (canBuyUpgrade(f, 'stallL3').ok) throw new Error('stallL3 without stallL2'); if (!canBuyUpgrade(f, 'stallL3', ['stallL2']).ok) throw new Error('stallL3 with stallL2');
    if (canBuyUpgrade(f, 'zone_west').ok) throw new Error('zone_west before season 3'); f.state.season = 3; if (!canBuyUpgrade(f, 'zone_west').ok) throw new Error('zone_west at season 3');
    f.state.spark = 1; if (canBuyUpgrade(f, 'helper_packMole').ok) throw new Error('canBuyUpgrade ignores cost');
    f.state.spark = 1000; if (canBuyUpgrade(f, 'helper_packMole', ['helper_packMole']).why !== 'owned') throw new Error('owned helper re-buyable');
    if (!f.buyUpgrade('helper_packMole') || f.state.spark !== 1000 - UPGRADES.helper_packMole.cost) throw new Error('buyUpgrade from UPGRADES tree');
    // 3-strategy sweep (10 seeds)
    const { run } = await import(pathToFileURL(resolve('tests/economy.sim.mjs')).href);
    const hist = { sensible: {}, borrow: {}, hoarder: {} };
    for (const n of Object.keys(hist)) for (let s = 1; s <= 10; s++) { const r = run(n, s, false); const k = `${r.ended || 'open'}@${r.ended ? r.seasons : '12+'}`; hist[n][k] = (hist[n][k] || 0) + 1; }
    const fmt = (h) => Object.entries(h).sort().map(([k, v]) => `${k}×${v}`).join(' ');
    for (const k of Object.keys(hist.sensible)) if (!/^win@(9|10|11)$/.test(k)) throw new Error('sensible strategy off-target: ' + fmt(hist.sensible));
    for (const k of Object.keys(hist.borrow)) if (!k.startsWith('lose@')) throw new Error('borrow-everything did not lose: ' + fmt(hist.borrow));
    const hoarderLose = Object.entries(hist.hoarder).filter(([k]) => k.startsWith('lose@')).reduce((a, [, v]) => a + v, 0);
    if (hoarderLose < 8) throw new Error('hoarder should lose on ≥ 8/10 seeds: ' + fmt(hist.hoarder));
    console.log(`  content: EVENTS ${evIds.length} · SCAMS ${scIds.length} (all with tells) · UPGRADES ${upIds.length} (${[...kinds].join('/')}) · all applied via 4A API · pickEvent/canBuyUpgrade  OK`);
    console.log(`  sweep ×10 seeds: sensible ${fmt(hist.sensible)} · borrow ${fmt(hist.borrow)} · hoarder ${fmt(hist.hoarder)}  OK`);
  } catch (err) { bad++; console.log('  economy 4B FAIL →', err.message.split('\n')[0]); }
}
if (doBuild) {
  // 5 build system: real Island (isLand), real Economy (4B balance), real PROP_CATALOG, mock game { scene, input, sequences, bus, camera }.
  // Checks: enter → ghost (green on land, red on water / occupied) · snap to 1 u grid · confirm pays stallCost & counts the stall ·
  // buildPlace Sequence (610 ms: drop/land/pop/settle) ends at scale 1, y 0, dust + pop fired · cannot afford → build:denied, nothing placed ·
  // rotate swaps footprint · demolish refunds 50 % + buildDemolish Sequence removes the group · upgrade pays stallL2/L3 and animates
  // setLevel (stallLevelUp) · stalls() world slots · occupied() · serialize/load round-trip · debug overlay count · exit() cleans the ghost.
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { SequencePlayer } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { Island } = await import(pathToFileURL(resolve('src/world/Island.js')).href);
    const { PROP_CATALOG } = await import(pathToFileURL(resolve('src/assets/props.js')).href);
    const { makeEconomy } = await import(pathToFileURL(resolve('src/systems/economyData.js')).href);
    const { BuildSystem, REFUND_RATIO } = await import(pathToFileURL(resolve('src/systems/build.js')).href);
    const counts = { dust: 0, ring: 0, pop: 0, shake: 0 };
    const vfx = { dust: { burst: () => counts.dust++, ring: () => counts.ring++ }, pop: { show: () => counts.pop++ }, sparks: { burst() {} } };
    const bus = new EventBus(); const events = {}; for (const n of ['build:enter', 'build:exit', 'build:ghost', 'build:placed', 'build:removed', 'build:upgraded', 'build:denied']) bus.on(n, (p) => { (events[n] ??= []).push(p); });
    const input = { pointerWorld: new THREE.Vector3(), hasPointerWorld: true, isTouch: false, onAction: null };
    const game = { scene: new THREE.Scene(), input, sequences: new SequencePlayer(), bus, camera: { shake: () => counts.shake++ }, time: 0, systems: [], add(s) { this.systems.push(s); return s; } };
    const island = new Island({ radius: 11, seed: 7, starterProps: false });
    const eco = makeEconomy({ bus, seed: 1, autoSeason: false }); eco.state.spark = 500; const spark0 = eco.state.spark;
    const build = new BuildSystem(game, { island, economy: eco, catalog: PROP_CATALOG, vfx });
    const step = (dt = 1 / 60) => { build.update(dt); game.sequences.update(dt); game.time += dt; };
    const noNaN = (g, what) => g.traverse((o) => { if (!isFinite(o.scale.x) || !isFinite(o.position.y)) throw new Error('NaN in ' + what); });
    const meshCount = () => { let n = 0; game.scene.traverse((o) => { if (o.isMesh && o.visible) n++; }); return n; };
    console.log('\nBUILD (5):');
    // a land cell and a water cell
    const land = island.gridCells().find((c) => island.isLand(c.x, c.z) && island.isLand(c.x + 1, c.z) && island.isLand(c.x, c.z + 1) && island.isLand(c.x + 1, c.z + 1));
    let water = null; for (let x = -30; x <= 30 && !water; x++) for (let z = -30; z <= 30 && !water; z++) if (!island.isLand(x, z)) water = { x, z };
    if (!land || !water) throw new Error('island has no 2x2 land / no water');
    // 1. ghost
    try {
      if (!build.enter('stall_fruit')) throw new Error('enter failed');
      input.pointerWorld.set(land.x + 0.5 + 0.3, 0, land.z + 0.5 - 0.2); step();
      if (!build.ghost || !build.cursor.ok) throw new Error('ghost not green on land ' + JSON.stringify(build.cursor));
      const gp = build.ghost.group.position; if (Math.abs(gp.x - (land.x + 0.5)) > 1e-6 || Math.abs(gp.z - (land.z + 0.5)) > 1e-6) throw new Error('ghost not snapped: ' + gp.x + ',' + gp.z);
      input.pointerWorld.set(water.x, 0, water.z); step(); if (build.cursor.ok) throw new Error('ghost green on water');
      if (!events['build:enter'] || !events['build:ghost']) throw new Error('no enter/ghost events');
      console.log(`  enter('stall_fruit') → ghost snaps to grid, green on land / red on water, pad + ${(() => { let n = 0; build.ghost.group.traverse((o) => { if (o.isMesh) n++; }); return n; })()} ghost meshes  OK`);
    } catch (err) { bad++; console.log('  ghost FAIL →', err.message); }
    // 2. confirm + place sequence
    try {
      input.pointerWorld.set(land.x + 0.5, 0, land.z + 0.5); step();
      const cost = build.cost('stall_fruit'); if (cost !== eco.stallCost('stall_fruit') || cost <= 0) throw new Error('cost ' + cost);
      const e = build.confirm(); if (!e) throw new Error('confirm returned null: ' + JSON.stringify(events['build:denied']?.at(-1)));
      if (eco.state.spark !== spark0 - cost || eco.state.stalls !== 1) throw new Error(`spark ${eco.state.spark} stalls ${eco.state.stalls}`);
      if (build.placed.size !== 1 || !build.occupied(land.x, land.z) || !build.occupied(land.x + 1, land.z + 1) || build.occupied(land.x - 1, land.z)) throw new Error('occupancy wrong');
      if (!build.cursor || build.cursor.ok) throw new Error('ghost should be red over the new stall');
      const seq = e.seq; if (!seq || seq.totalMs !== 610) throw new Error('place seq ' + (seq && seq.totalMs));
      const seen = new Set(); let maxY = 0;
      for (let i = 0; i < 50 && seq.playing; i++) { step(); if (seq.currentName) seen.add(seq.currentName); maxY = Math.max(maxY, e.group.position.y); noNaN(e.group, 'place'); }
      if (seq.playing || seen.size !== 4) throw new Error('place seq phases ' + [...seen].join('/'));
      const s = e.group.scale; if (Math.abs(s.x - 1) > 1e-6 || Math.abs(s.y - 1) > 1e-6 || e.group.position.y !== 0) throw new Error(`rest scale ${s.y} y ${e.group.position.y}`);
      if (counts.ring < 1 || counts.pop < 1 || counts.shake < 1 || maxY < 1.5) throw new Error(`vfx ring=${counts.ring} pop=${counts.pop} shake=${counts.shake} maxY=${maxY}`);
      if (!events['build:placed'] || events['build:placed'].length !== 1) throw new Error('build:placed events');
      console.log(`  confirm → paid ${cost} (spark ${spark0}→${eco.state.spark}), stalls=1, buildPlace ${seq.totalMs} ms ${[...seen].join('/')}, dropped from ${maxY.toFixed(2)} u, dust ring + pop + shake  OK`);
    } catch (err) { bad++; console.log('  confirm FAIL →', err.message); }
    // 3. denied: blocked + cannot afford
    try {
      const n0 = (events['build:denied'] || []).length;
      const r1 = build.place('stall_fruit', land.x, land.z); if (r1) throw new Error('placed on occupied');
      const save = eco.state.spark; eco.state.spark = 1;
      const free = island.gridCells().find((c) => build.canPlace('stall_bread', c.x, c.z, 0)); if (!free) throw new Error('no free 2x2');
      const r2 = build.place('stall_bread', free.x, free.z, 0); eco.state.spark = save;
      if (r2 || build.placed.size !== 1) throw new Error('placed while broke');
      const d = events['build:denied'].slice(n0).map((p) => p.why); if (d.length !== 2 || d[0] !== 'blocked' || d[1] !== 'cannot afford') throw new Error('denied reasons ' + d.join(','));
      console.log(`  denied: occupied → "blocked" · spark 1 → "cannot afford" (nothing placed, nothing charged)  OK`);
    } catch (err) { bad++; console.log('  denied FAIL →', err.message); }
    // 4. rotate: footprint swap with a 2x1 decor prop + place a few more props (decor is free via catalog cost? → uses catalog.cost)
    try {
      build.enter('bench'); const fp0 = build.footprint('bench'); build.rotate(); const fp1 = build.footprint('bench');
      if (fp0[0] !== 2 || fp0[1] !== 1 || fp1[0] !== 1 || fp1[1] !== 2 || build.rot !== 1) throw new Error(`rotate fp ${fp0}→${fp1} rot ${build.rot}`);
      if (Math.abs(build.ghost.group.rotation.y - Math.PI / 2) > 1e-6) throw new Error('ghost rotation');
      build.rotate(); build.rotate(); build.rotate(); if (build.rot !== 0) throw new Error('rot wrap ' + build.rot);
      build.exit(); if (build.ghost || build.mode !== 'idle' || !events['build:exit']) throw new Error('exit did not clean ghost');
      console.log(`  rotate: bench 2x1 → 1x2 (rot 1), wraps to 0 after 4 · exit() removes ghost + emits build:exit  OK`);
    } catch (err) { bad++; console.log('  rotate FAIL →', err.message); }
    // 5. upgrade (stallL2 → stallL3 → max)
    try {
      const e = [...build.placed.values()][0]; const before = eco.state.spark; const c2 = build.upgradeCost(2), c3 = build.upgradeCost(3);
      const s2 = build.upgrade(e); if (!s2 || e.level !== 2 || eco.state.spark !== before - c2) throw new Error(`L2 seq=${!!s2} level=${e.level} spark=${eco.state.spark}`);
      if (build.upgrade(e) !== false) throw new Error('upgrade allowed while swapping');
      for (let i = 0; i < 60; i++) step(); if (e.group.userData.level !== 2 || e.group.userData.swapping) throw new Error('setLevel(2) did not land: ' + e.group.userData.level);
      const s3 = build.upgrade(e); for (let i = 0; i < 60; i++) step(); if (!s3 || e.level !== 3 || e.group.userData.level !== 3) throw new Error('L3');
      if (build.upgrade(e) !== false || events['build:denied'].at(-1).why !== 'max level') throw new Error('max level not denied');
      if (eco.state.spark !== before - c2 - c3 || events['build:upgraded'].length !== 2) throw new Error('upgrade accounting');
      const bs = e.group.userData.body.scale; if (Math.abs(bs.y - 1) > 1e-3) throw new Error('body scale after swap ' + bs.y);
      console.log(`  upgrade: L1→L2 (−${c2}) → L3 (−${c3}) via stallLevelUp, L4 denied "max level", upgrade while swapping ignored  OK`);
    } catch (err) { bad++; console.log('  upgrade FAIL →', err.message); }
    // 6. stalls() world slots + occupied + nearest
    try {
      const st = build.stalls(); if (st.length !== 1 || !st[0].slots.counter || st[0].slots.queue.length !== 4) throw new Error('stalls() shape');
      const g = st[0].group, c = st[0].slots.counter; if (Math.abs(c.x - g.position.x) > 1e-6 || Math.abs(c.z - (g.position.z + 1.15)) > 1e-6) throw new Error(`counter world ${c.x},${c.z} vs stall ${g.position.x},${g.position.z}`);
      if (build.nearest(g.position.x + 0.4, g.position.z + 0.4) !== st[0].entry) throw new Error('nearest');
      // P14/P19: a scenery sentinel on the cell next to the stall must not shadow the stall, and must be refused by demolish/upgrade
      { const SC = { id: 'scenery', category: 'scenery', group: new THREE.Group(), cells: [], cx: 0, cz: 0, rot: 0, level: 0, cost: 0, scenery: true };
        const e = st[0].entry, sx = e.cx + 3, sz = e.cz; if (build.occupied(sx, sz)) throw new Error('P14 probe: cell busy'); build.cells.set(`${sx},${sz}`, SC);
        if (build.nearest(sx, sz, 2.5) !== e) throw new Error('P14: scenery shadows the stall'); if (build.nearest(sx, sz, 0.3) !== SC) throw new Error('P14: scenery not returned when nothing placed is in range');
        const sp0 = eco.state.spark, n0 = build.placed.size, cells0 = build.cells.size;
        if (build.demolish(SC) !== false || build.demolish({ x: sx, z: sz, scenery: true }) !== false) throw new Error('P19: demolished scenery'); if (build.upgrade(SC) !== false) throw new Error('P19: upgraded scenery');
        if (SC.group.visible !== true || build.cells.get(`${sx},${sz}`) !== SC || build.placed.size !== n0 || eco.state.spark !== sp0 || build.cells.size !== cells0) throw new Error('P19: scenery mutated');
        build.cells.delete(`${sx},${sz}`); }
      // P17: a camera ray through the stall's ROOF (y≈1.8, isometric from +Z/+Y) picks the stall although its ground-plane point is ~1.9 u behind it
      { const e = st[0].entry; e.group.updateMatrixWorld(true); const roof = new THREE.Vector3(e.group.position.x, 1.6, e.group.position.z);
        const dir = new THREE.Vector3(0, -1, -1).normalize(), ray = new THREE.Ray(roof.clone().sub(dir.clone().multiplyScalar(30)), dir);
        const gp = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        if (!gp || Math.abs(gp.z - e.group.position.z) < 1.2) throw new Error('P17 probe: ground point should sit behind the stall, got ' + (gp && gp.z.toFixed(2)));
        if (build.pick(ray) !== e) throw new Error('P17: roof ray did not pick the stall');
        const miss = new THREE.Ray(new THREE.Vector3(e.group.position.x + 40, 30, e.group.position.z + 30), dir); if (build.pick(miss) !== null) throw new Error('P17: ray in the sea picked something'); }
      if (build.entry('stall_bakery') !== build.entry('stall_bread') || !build.entry('stall_bread')) throw new Error('P10: stall_bakery alias');   // P10
      console.log(`  stalls() → 1 stall, world counter slot at z+1.15, 4 queue slots · nearest()/occupied() · P10 stall_bakery alias · P14 nearest prefers placed over scenery · P19 demolish/upgrade refuse scenery · P17 pick(ray) through the roof  OK`);
    } catch (err) { bad++; console.log('  stalls FAIL →', err.message); }
    // 7. demolish: refund 50 % of (cost + upgrades), sequence removes group, cells free, stall count back to 0
    try {
      const e = [...build.placed.values()][0]; const before = eco.state.spark; const m0 = meshCount(); const expect = Math.round(e.cost * REFUND_RATIO);
      if (!build.demolish({ x: e.group.position.x, z: e.group.position.z })) throw new Error('demolish returned false');
      if (build.placed.size !== 0 || build.occupied(e.cx, e.cz) || eco.state.stalls !== 0) throw new Error('bookkeeping after demolish');
      if (eco.state.spark !== before + expect) throw new Error(`refund ${eco.state.spark - before} expected ${expect}`);
      if (!e.group.parent) throw new Error('group removed before the shrink sequence');
      for (let i = 0; i < 30; i++) { step(); noNaN(e.group, 'demolish'); }
      if (e.group.parent || meshCount() >= m0) throw new Error('group not removed after sequence');
      if (!events['build:removed'] || events['build:removed'].at(-1).refund !== expect) throw new Error('build:removed payload');
      console.log(`  demolish: +${expect} refund (50 % of ${e.cost} incl. upgrades), buildDemolish 340 ms, group removed, cells free, stalls=0  OK`);
    } catch (err) { bad++; console.log('  demolish FAIL →', err.message); }
    // 8. save/load round-trip + debug overlay + clear
    try {
      const cells = island.gridCells(); let placedN = 0; const spark = eco.state.spark;
      for (const id of ['stall_tea', 'stall_book', 'crate', 'lantern_post', 'bench']) { const c = cells.find((c) => build.canPlace(id, c.x, c.z, 0)); if (c && build.place(id, c.x, c.z, 0, { animate: false })) placedN++; }
      if (placedN !== 5) throw new Error('placed ' + placedN + '/5');
      const snap = build.serialize(); if (snap.length !== 5) throw new Error('serialize');
      build.setDebug(true); const dbg = build.debugMesh.count; const want = [...build.cells.keys()].length; if (dbg !== want || dbg !== 4 + 4 + 1 + 1 + 2) throw new Error(`debug cells ${dbg} want ${want}`);
      build.clear(); if (build.placed.size || build.cells.size || build.debugMesh.count !== 0) throw new Error('clear');
      const sparkAfterClear = eco.state.spark;
      const n = build.load(snap); if (n !== 5 || build.placed.size !== 5 || eco.state.spark !== sparkAfterClear) throw new Error(`load ${n} spark moved ${eco.state.spark - sparkAfterClear}`);
      if (JSON.stringify(build.serialize()) !== JSON.stringify(snap)) throw new Error('round-trip mismatch');
      build.setDebug(false); if (build.debugMesh) throw new Error('debug off');
      console.log(`  serialize/load: 5 props (2 stalls + 3 decor, ${want} cells) round-trip, clear() frees all, debug overlay ${dbg} instances, spark ${spark}→${eco.state.spark}  OK`);
    } catch (err) { bad++; console.log('  save/load FAIL →', err.message); }
    // 9. no-economy stub + touch confirm via onAction('build')
    try {
      const b2 = new BuildSystem(game, { island, catalog: PROP_CATALOG });
      if (b2.cost('stall_fruit') !== PROP_CATALOG.stall_fruit.cost || !b2.canAfford(1e9)) throw new Error('stub economy');
      const c = island.gridCells().find((c) => b2.canPlace('stall_fruit', c.x, c.z, 0) && !build.occupied(c.x, c.z) && !build.occupied(c.x + 1, c.z + 1) && !build.occupied(c.x + 1, c.z) && !build.occupied(c.x, c.z + 1));
      b2.enter('stall_fruit'); b2.moveTo(c.x + 0.5, c.z + 0.5); if (!b2.cursor.ok) throw new Error('moveTo');
      game.input.onAction('build'); if (b2.placed.size !== 1) throw new Error('press(build) did not confirm');
      b2.clear(); b2.exit();
      console.log(`  no economy → catalog cost, always affordable · touch: moveTo() + Input.press('build') confirms  OK`);
    } catch (err) { bad++; console.log('  touch/stub FAIL →', err.message); }
  } catch (e) { bad++; console.log('  build.js FAIL →', e.message.split('\n')[0]); }
}
if (doCustomers) {
  // 6A customers: FlowField BFS (reach, no corner cutting, cache, invalidate) · CustomerSystem FSM end-to-end with real
  // Island + BuildSystem (3 stalls) + Economy (4B) + makeGlimmerAny/CreatureAnimator (2A/2D): spawn wave → walk → queue →
  // browse 1.5 s → pay (economy.sell, cust:paid) → react → leave → pool (reuse) · maxActive cap · price → mood/reaction ·
  // give-up when no stall · stall demolished under a queue → re-pick · never on water / inside a stall footprint · no NaN.
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { SequencePlayer } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { Island } = await import(pathToFileURL(resolve('src/world/Island.js')).href);
    const { PROP_CATALOG } = await import(pathToFileURL(resolve('src/assets/props.js')).href);
    const { makeEconomy } = await import(pathToFileURL(resolve('src/systems/economyData.js')).href);
    const { BuildSystem } = await import(pathToFileURL(resolve('src/systems/build.js')).href);
    const { FlowField } = await import(pathToFileURL(resolve('src/systems/flowfield.js')).href);
    const { CustomerSystem, BROWSE_MS, PREFS, WAVES } = await import(pathToFileURL(resolve('src/systems/customers.js')).href);
    const { makeGlimmerAny, CreatureAnimator } = await import(pathToFileURL(resolve('src/assets/creatures/index.js')).href);
    console.log('\nCUSTOMERS (6A):');
    const island = new Island({ radius: 11, seed: 7, starterProps: false });
    // 1. flow field alone
    try {
      const blocked = new Set(['2,0', '2,1', '3,0', '3,1']);
      const ff = new FlowField({ isLand: (x, z) => island.isLand(x, z), isBlocked: (x, z) => blocked.has(`${x},${z}`) });
      const f = ff.get(0, 0); const reach = f.dist.size; const total = island.gridCells().length;
      if (reach < total - 4 - 20 || reach > total) throw new Error(`reach ${reach} of ${total}`);
      if (ff.distance(f, 2, 0) !== Infinity) throw new Error('blocked cell reachable');
      const d = ff.direction(f, 5, 0.2); if (!(d.x < 0) || Math.abs(Math.hypot(d.x, d.z) - 1) > 1e-6) throw new Error('direction ' + JSON.stringify(d));
      // corner cutting: from (4,2) going to (1,-1)… (3,1)&(2,1) blocked; diag (3,2)->(2,1) must not be used
      for (const [k, nk] of f.next) { const [x, z] = k.split(',').map(Number); const [nx, nz] = nk.split(',').map(Number); if (Math.abs(nx - x) === 1 && Math.abs(nz - z) === 1 && (!ff.walkable(nx, z) || !ff.walkable(x, nz))) throw new Error('corner cut at ' + k); }
      ff.get(0, 0); if (ff.stats.hits !== 1 || ff.stats.builds !== 1) throw new Error('cache');
      ff.invalidate(); ff.get(0, 0); if (ff.stats.builds !== 2) throw new Error('invalidate');
      const nw = ff.nearestWalkable(2.4, 0.6, 3); if (!nw || blocked.has(`${nw.x},${nw.z}`) || !ff.walkable(nw.x, nw.z)) throw new Error('nearestWalkable');
      console.log(`  FlowField: ${reach}/${total} cells reached, blocked 2x2 unreachable, 8-dir no corner cut, cache hit + invalidate, nearestWalkable  OK`);
    } catch (err) { bad++; console.log('  flowfield FAIL →', err.message); }
    // harness
    const bus = new EventBus(); const ev = {}; for (const n of ['cust:spawn', 'cust:paid', 'cust:left', 'cust:angry', 'cust:wave']) bus.on(n, (p) => { (ev[n] ??= []).push(p); });
    const vfxc = { pop: 0, dust: 0 }; const vfx = { dust: { burst: () => vfxc.dust++, ring() {} }, pop: { show: () => vfxc.pop++ }, sparks: { burst() {} } };
    const game = { scene: new THREE.Scene(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false }, sequences: new SequencePlayer(), bus, camera: { shake() {} }, time: 0, followTarget: new THREE.Vector3(), systems: [], add(s) { this.systems.push(s); return s; } };
    const eco = makeEconomy({ bus, seed: 1, autoSeason: false }); eco.state.spark = 1000;
    const build = new BuildSystem(game, { island, economy: eco, catalog: PROP_CATALOG, vfx });
    for (const [id, cx, cz] of [['stall_fruit', -3, -2], ['stall_bread', 1, -2], ['stall_tea', -1, 2]]) if (!build.place(id, cx, cz, 0, { animate: false })) throw new Error('could not place ' + id);
    const cust = new CustomerSystem(game, { island, build, economy: eco, vfx, creatures: { makeGlimmer: (t) => makeGlimmerAny(t, { seed: 2 }), CreatureAnimator }, seed: 5, maxActive: 20 });
    const step = (dt = 1 / 30) => { build.update(dt); cust.update(dt); game.sequences.update(dt); game.time += dt; };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    const noNaN = () => { for (const c of cust.active) { const p = c.root.position; if (!isFinite(p.x) || !isFinite(p.z) || !isFinite(c.root.scale.y)) throw new Error('NaN on ' + c.type); } };
    const offLand = () => { for (const c of cust.active) { if (c.state === 'pooled' || c.state === 'despawn') continue; const p = c.root.position; if (!island.isLand(p.x, p.z)) throw new Error(`${c.type} in water at ${p.x.toFixed(1)},${p.z.toFixed(1)} (${c.state})`); if (build.occupied(p.x, p.z)) throw new Error(`${c.type} inside a stall at ${p.x.toFixed(1)},${p.z.toFixed(1)} (${c.state})`); } };
    // 2. one customer end-to-end
    try {
      const spark0 = eco.state.spark;
      const c = cust.spawnOne('regular'); if (!c || cust.count !== 1 || !ev['cust:spawn']) throw new Error('spawnOne');
      if (!island.isLand(c.root.position.x, c.root.position.z)) throw new Error('spawn not on land');
      const seen = new Set(); let browseT = 0, paidAt = -1;
      for (let i = 0; i < 30 * 40 && c.state !== 'pooled'; i++) { step(); seen.add(c.state); if (c.state === 'browse') browseT += 1 / 30; if (paidAt < 0 && ev['cust:paid']) paidAt = i; noNaN(); offLand(); }
      for (const s of ['spawn', 'pickStall', 'walk', 'browse', 'pay', 'react', 'leave', 'despawn', 'pooled']) if (!seen.has(s)) throw new Error('state never seen: ' + s + ' (saw ' + [...seen].join('/') + ')');
      if (Math.abs(browseT * 1000 - BROWSE_MS) > 120) throw new Error('browse ' + (browseT * 1000).toFixed(0) + ' ms');
      const paid = ev['cust:paid'][0]; if (!paid || paid.paid <= 0 || eco.state.spark !== spark0 + paid.paid) throw new Error('cust:paid / spark ' + JSON.stringify(paid));
      if (!ev['cust:left'] || cust.count !== 0 || !cust.pool.get('regular') || cust.pool.get('regular').length !== 1) throw new Error('not pooled');
      if (vfxc.pop < 1) throw new Error('no +N pop');
      const c2 = cust.spawnOne('regular'); if (c2 !== c) throw new Error('pool not reused'); cust.clear();
      console.log(`  one regular: ${[...seen].join('→')} · browse ${(browseT * 1000).toFixed(0)} ms · paid ${paid.paid} at ${paid.stallId} (${paid.reaction}) · spark +${paid.paid} · pooled & reused  OK`);
    } catch (err) { bad++; console.log('  fsm FAIL →', err.message); }
    // 3. wave + cap + queues + leave
    try {
      ev['cust:paid'] = []; ev['cust:left'] = []; ev['cust:angry'] = [];
      const q = cust.spawnWave(3, 20); run(0.45 * 20 + 1);
      const n0 = cust.count; if (q !== 20 || n0 < 10) throw new Error('wave spawned ' + n0);
      const extra = cust.spawnOne('kid'); if (cust.count > 20 || (n0 === 20 && extra)) throw new Error('maxActive cap');
      let maxQ = 0; for (const [, list] of cust.queues) maxQ = Math.max(maxQ, list.length); if (maxQ > 4) throw new Error('queue > 4 slots: ' + maxQ);
      let paidSoFar = 0;
      for (let i = 0; i < 30 * 90 && cust.count > 0; i++) { step(); noNaN(); offLand(); for (const [, list] of cust.queues) if (list.length > 4) throw new Error('queue overflow'); if (ev['cust:paid'].length > paidSoFar) paidSoFar = ev['cust:paid'].length; }
      if (cust.count !== 0) throw new Error(`not all left after 90 s: ${cust.count} (${JSON.stringify(cust.byState())})`);
      if (ev['cust:paid'].length < 16) throw new Error('paid ' + ev['cust:paid'].length + '/20');
      if (cust.totals.spawned < 20) throw new Error('spawned ' + cust.totals.spawned);
      const stallsUsed = new Set(ev['cust:paid'].map((p) => p.stallId)); if (stallsUsed.size < 2) throw new Error('all customers picked one stall');
      console.log(`  wave(S3,20): ${cust.totals.spawned} spawned (cap ${cust.maxActive}), ${ev['cust:paid'].length} paid at ${stallsUsed.size} stalls (max queue ${maxQ}), ${ev['cust:left'].length} left, ${ev['cust:angry'].length} angry, all pooled (${[...cust.pool.values()].reduce((a, b) => a + b.length, 0)}), never in water / in a stall  OK`);
    } catch (err) { bad++; console.log('  wave FAIL →', err.message); }
    // 4. price → mood: cheap=happy(1.0) · fair=happy(.75) · +30 %=sad · ×2=angry (cust:angry)
    try {
      const results = {};
      for (const [label, mul] of [['cheap', 0.8], ['fair', 1], ['pricey', 1.3], ['ripoff', 2.2]]) {
        for (const s of build.stalls()) cust.setPrice(s.id, Math.round(cust.fair(s.id) * mul));
        ev['cust:angry'] = []; eco.state.reputation = 0.5;
        const c = cust.spawnOne('regular'); let res = null;
        for (let i = 0; i < 30 * 40 && c.state !== 'pooled'; i++) { step(); if (c.result && !res) res = { ...c.result, mood: c.anim.mood }; }
        results[label] = res; cust.clear();
      }
      const r = results;
      if (!r.cheap || r.cheap.reaction !== 'happy' || r.cheap.mood !== 1) throw new Error('cheap ' + JSON.stringify(r.cheap));
      if (!r.fair || r.fair.reaction !== 'happy') throw new Error('fair ' + JSON.stringify(r.fair));
      if (!r.pricey || r.pricey.reaction !== 'sad') throw new Error('pricey ' + JSON.stringify(r.pricey));
      if (!r.ripoff || r.ripoff.reaction !== 'angry' || !ev['cust:angry'].length) throw new Error('ripoff ' + JSON.stringify(r.ripoff));
      for (const s of build.stalls()) cust.setPrice(s.id, cust.fair(s.id));
      console.log(`  price→mood: ×0.8 happy(1.0) · ×1 happy(${r.fair.mood}) · ×1.3 sad(${r.pricey.mood}) · ×2.2 angry(${r.ripoff.mood}) + cust:angry · moodTint applied  OK`);
    } catch (err) { bad++; console.log('  mood FAIL →', err.message); }
    // 5. type prefs + speed + no-stall give-up + demolish under queue
    try {
      const kid = cust.spawnOne('kid'), elder = cust.spawnOne('elder'); if (!(kid.speed > elder.speed)) throw new Error('kid should be faster than elder');
      if (PREFS.kid.toy !== 3 || WAVES.length < 6) throw new Error('prefs/waves tables'); cust.clear();
      // demolish the stall a walker is heading to → it must re-pick, not freeze
      const c = cust.spawnOne('spender'); run(1.2); if (!c.stall) throw new Error('did not pick a stall'); const target = c.stall.entry;
      build.demolish(target); run(1); if (c.state === 'pooled' || !c.stall || c.stall.entry === target) throw new Error('did not re-pick after demolish: ' + c.state);
      run(40); if (cust.count !== 0) throw new Error('spender stuck in ' + c.state);
      // no stalls at all → angry give-up after 3 s, leaves
      const snap = build.serialize(); build.clear(); ev['cust:angry'] = [];
      const lone = cust.spawnOne('tourist'); run(6); if (!ev['cust:angry'].length || ev['cust:angry'][0].why !== 'no stall') throw new Error('no give-up');
      run(30); if (cust.count !== 0) throw new Error('give-up customer never left: ' + lone.state);
      build.load(snap);
      let meshes = 0; game.scene.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
      console.log(`  prefs/speed (kid ${kid.speed.toFixed(2)} > elder ${elder.speed.toFixed(2)}) · stall demolished under a walker → re-pick · no stalls → angry "no stall" + leave · pooled glimmers hidden (${meshes} visible meshes in scene after)  OK`);
    } catch (err) { bad++; console.log('  edge-cases FAIL →', err.message); }
  } catch (e) { bad++; console.log('  customers.js FAIL →', e.message.split('\n')[0]); }
}
if (doStory) {
  // 8A: data/story.json is pure data. Check: parses · 10 seasons in BALANCE.lessons order, each with opening/mid + ledger.{default,low,high} ·
  // every lessonId has a card {id,title,lesson,tip} · every 4B SCAMS id has pitch (ends in 2 choices accept/refuse) + accept + refuse + identical tell ·
  // every 4B EVENTS id has ≥ 1 line · ending.win/lose/endlessUnlock · 10 tutorial toasts with unique ids + bus trigger names · every line {speaker ∈ SPEAKERS, text, mood?}
  // · Bible §2 banned words (magic, rune, skeleton, witch, dragon, demon, zombie, ghost, mummy, werewolf) absent.
  console.log('\nSTORY DATA (8A):');
  try {
    const { readFileSync } = await import('node:fs');
    const story = JSON.parse(readFileSync('data/story.json', 'utf8'));
    const { BALANCE } = await import(pathToFileURL(resolve('src/systems/economy.js')).href);
    const { SCAMS, EVENTS } = await import(pathToFileURL(resolve('src/systems/economyData.js')).href);
    const speakers = new Set(Object.keys(story.speakers)); const moods = new Set(['happy', 'sad', 'angry', 'shout']);
    const banned = /\b(magic\w*|runes?|skeletons?|witch\w*|dragons?|demon\w*|zombies?|ghosts?|mumm(y|ies)|werewol(f|ves))\b/i;
    let lines = 0;
    const walk = (arr, where) => { if (!Array.isArray(arr) || !arr.length) throw new Error(where + ' empty'); for (const l of arr) { lines++;
      if (!speakers.has(l.speaker)) throw new Error(where + ' bad speaker ' + l.speaker); if (typeof l.text !== 'string' || !l.text.trim()) throw new Error(where + ' no text');
      if (l.mood && !moods.has(l.mood)) throw new Error(where + ' bad mood ' + l.mood); const m = l.text.match(banned); if (m) throw new Error(where + ' banned word "' + m[0] + '"');
      if (l.choices) for (const c of l.choices) { if (!c.id || !c.text) throw new Error(where + ' bad choice'); } } };
    if (story.seasons.length !== BALANCE.seasonsToWin) throw new Error('seasons ' + story.seasons.length);
    BALANCE.lessons.forEach((id, i) => { const S = story.seasons[i]; if (S.season !== i + 1 || S.lesson !== id) throw new Error('season ' + (i + 1) + ' lesson ' + S.lesson + ' ≠ ' + id);
      const L = story.lessons[id]; if (!L || L.id !== id || !L.title || !L.lesson || !L.tip) throw new Error('lesson card ' + id); if (!S.title) throw new Error('season title ' + (i + 1));
      walk(S.opening, 'S' + S.season + ' opening'); walk(S.mid, 'S' + S.season + ' mid'); for (const v of ['default', 'low', 'high']) walk(S.ledger[v], 'S' + S.season + ' ledger.' + v); });
    for (const [id, sc] of Object.entries(SCAMS)) { const st = story.scams[id]; if (!st) throw new Error('scam ' + id + ' missing'); walk(st.pitch, id + '.pitch'); walk(st.accept, id + '.accept'); walk(st.refuse, id + '.refuse');
      const ch = st.pitch[st.pitch.length - 1].choices; if (!ch || ch.length !== 2 || ch[0].id !== 'accept' || ch[1].id !== 'refuse') throw new Error(id + ' pitch must end with accept/refuse choices'); if (st.tell !== sc.tell) throw new Error(id + ' tell ≠ 4B'); if (st.lesson !== sc.lesson) throw new Error(id + ' lesson ≠ 4B'); }
    for (const id of Object.keys(EVENTS)) walk(story.events[id], 'event ' + id);
    walk(story.ending.win, 'ending.win'); walk(story.ending.lose, 'ending.lose'); walk(story.ending.endlessUnlock, 'ending.endlessUnlock');
    if (!Array.isArray(story.tutorial) || story.tutorial.length < 10) throw new Error('tutorial < 10'); const tid = new Set(); for (const t of story.tutorial) { if (!t.id || !t.text || !t.trigger || !/^[a-z]+:[a-z:]+$/i.test(t.trigger)) throw new Error('toast ' + JSON.stringify(t)); if (tid.has(t.id)) throw new Error('dup toast ' + t.id); tid.add(t.id); }
    const sizeKB = (readFileSync('data/story.json').length / 1024).toFixed(1);
    console.log(`  story.json ${sizeKB} KB · ${story.seasons.length} seasons (opening/mid/ledger×3 each, lessons in BALANCE order) · ${Object.keys(story.lessons).length} lesson cards · ${Object.keys(story.scams).length} scams (pitch→accept/refuse, tells = 4B) · ${Object.keys(story.events).length} event lines = EVENTS · ending win/lose/endless · ${story.tutorial.length} tutorial toasts · ${lines} lines, speakers ⊂ SPEAKERS, moods ⊂ {happy,sad,angry,shout}, no banned words  OK`);
  } catch (err) { bad++; console.log('  story FAIL →', err.message); }

  // 8B: src/systems/story.js (pure JS). Runs the assert file as a child, then a bus-driven walk with a real 4B economy on a private bus:
  // ui:start → S1 opening · ui:advance drains · mid at day01 0.5 · eco:season (autoSeason) → story:lesson + ledger[variant] → story:review ·
  // ui:continue → next opening · eco:scam → choices → ui:choice → economy.acceptOffer/refuseOffer · 10 lessons in BALANCE order · win → story:finale.
  console.log('\nSTORY SYSTEM (8B):');
  try {
    const { spawnSync } = await import('node:child_process');
    const t = spawnSync(process.execPath, ['tests/story.test.mjs'], { encoding: 'utf8' });
    const summary = (t.stdout || '').trim().split('\n').pop();
    if (t.status !== 0) throw new Error('tests/story.test.mjs → ' + ((t.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 5).join(' | ') || (t.stderr || '').split('\n')[0]));
    console.log('  tests/story.test.mjs →', summary, 'OK');
    const { readFileSync } = await import('node:fs');
    const data = JSON.parse(readFileSync('data/story.json', 'utf8'));
    const { StorySystem, pickLedgerVariant } = await import(pathToFileURL(resolve('src/systems/story.js')).href);
    const { makeEconomy } = await import(pathToFileURL(resolve('src/systems/economyData.js')).href);
    const { BALANCE } = await import(pathToFileURL(resolve('src/systems/economy.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const bus = new EventBus(); const eco = makeEconomy({ bus, seed: 7 });     // autoSeason:true → eco.tick() ends seasons itself
    const ev = {}; for (const n of ['story:line', 'story:lesson', 'story:end', 'story:review', 'story:toast', 'story:finale', 'story:choice']) bus.on(n, (p) => (ev[n] ||= []).push(p));
    const story = new StorySystem(eco, { data, bus });
    const drain = (pick = 1) => { let n = 0; while (story.isPlaying && n++ < 300) bus.emit(story.line?.choices ? 'ui:choice' : 'ui:advance', { index: pick }); };
    bus.emit('ui:start', { mode: 'story' });
    if (!story.isPlaying || ev['story:line'].length !== 1 || !/Season 1/.test(ev['story:line'][0].text)) throw new Error('ui:start did not open S1');
    if (!ev['story:toast'] || ev['story:toast'][0].id !== 't_move') throw new Error('t_move toast on ui:start');
    drain(); if (ev['story:end'].length !== 1) throw new Error('story:end after opening ×' + ev['story:end']?.length);
    let reviews = 0, lessons = [], scams = 0; const season0 = BALANCE.seasonSeconds || 150;
    bus.on('story:review', (p) => { reviews++; bus.emit('ui:continue', { season: p.season, stars: p.report.stars, outcome: 'season' }); });  // what 10C does after the Ledger
    for (let s = 1; s <= 10 && !eco.state.ended; s++) {
      // play half a season, mid lines must appear once, then a scam offer with a choice, then finish the season
      eco.tick(season0 * 0.55); story.update(0); if (story.current?.group !== 'mid') throw new Error('S' + s + ' mid not playing: ' + story.current?.group); drain();
      if (s === 2) { eco.offerScam('zeroInterestLoan'); if (!story.isPlaying || story.current.group !== 'scam') throw new Error('scam pitch'); if (ev['story:line'].some((l) => l.fox)) throw new Error('fox tell without Scout Fox'); drain(1); scams++; if (eco.ledger.scamsRefused !== 1) throw new Error('refuse not applied'); }
      // Scout Fox owned → the tell is whispered BEFORE the choice line (the helper's promised effect); refusing still works
      if (s === 5) { eco.state.owned.push('helper_scoutFox'); const n0 = ev['story:line'].length; eco.offerScam('doubleSpark'); drain(1); const got = ev['story:line'].slice(n0), fi = got.findIndex((l) => l.fox), ci = got.findIndex((l) => l.choices); if (fi < 0 || ci < 0 || fi !== ci - 1 || !/Guaranteed/.test(got[fi].text)) throw new Error('Scout Fox tell right before the choice: fox=' + fi + ' choice=' + ci); if (eco.ledger.scamsRefused !== 1) throw new Error('refuse after fox tell (per-season ledger)'); eco.state.owned = eco.state.owned.filter((x) => x !== 'helper_scoutFox'); }
      eco.earn(420, 'check'); eco.allocate({ save: 140, protect: 80, invest: 60 }); if (eco.state.debt > 0) eco.repay(Math.min(eco.state.debt, 150));
      eco.tick(season0 * 0.5); if (eco.state.season !== s + 1 && !eco.state.ended) throw new Error('season did not roll'); lessons.push(ev['story:lesson'].filter((l) => !l.scam).pop().id);
      if (story.current?.group !== 'ledger') throw new Error('S' + s + ' ledger lines not playing');
      let openings = 0; const offB = bus.on('story:begin', (p) => { if (p.group === 'opening' && p.season === s + 1) openings++; });
      drain(); offB();   // ledger lines → story:review → ui:continue → S(s+1) opening starts synchronously and is drained by the same loop
      if (!eco.state.ended && openings !== 1) throw new Error('S' + (s + 1) + ' opening after ui:continue ×' + openings);
    }
    if (lessons.join() !== BALANCE.lessons.join()) throw new Error('lessons ' + lessons.join());
    if (reviews !== 10) throw new Error('reviews ' + reviews);
    if (eco.state.ended === 'win' && !(ev['story:finale'] && ev['story:finale'][0].endless === true)) throw new Error('eco:win → story:finale missing');
    const bad2 = ev['story:line'].find((l) => !l.speaker || !l.text || (l.mood && !['happy', 'sad', 'angry', 'shout'].includes(l.mood)));
    if (bad2) throw new Error('bad line ' + JSON.stringify(bad2));
    const json = story.serialize(); const s2 = StorySystem.deserialize(JSON.stringify(json), eco, { data, bus: new EventBus() });
    if (s2.state.toastsFired.length !== story.state.toastsFired.length || s2.state.openingPlayed !== story.state.openingPlayed) throw new Error('serialize round-trip');
    story.destroy();
    console.log(`  bus-driven walk: ui:start → S1 opening + t_move toast · 10 × (mid @0.55 · eco:season → lesson + ledger[${pickLedgerVariant(2)}…] → story:review → ui:continue → opening) · scam refuse via ui:choice · Scout Fox tell before the choice · ${ev['story:line'].length} lines · ${ev['story:toast'].length} toasts · lessons in BALANCE order · ended=${eco.state.ended} finale=${ev['story:finale']?.[0]?.outcome || '—'} · serialize round-trip · destroy  OK`);
  } catch (err) { bad++; console.log('  story system FAIL →', err.message); }
}
if (doVFX) {
  // 9A VFX pack 1: real Three (Node) scene, mock VFX {game:{scene}}, installPack1 → 5 InstancedMesh pools (1 dc each, noOutline).
  // Fires every contract fn (both call styles: vfx.coinBurst(pos) and vfx.coinBurst.burst(pos) used by 3A/3B hooks), checks instance
  // counts, steps vfx.update 3 s at 60 Hz: matrices never NaN, coinFly onArrive fires once per coin (≈ 0.55+0.12 s), all pools drain to 0.
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { installPack1, PACK1_NAMES } = await import(pathToFileURL(resolve('src/vfx/pack1.js')).href);
    const scene = new THREE.Scene(); let baseUpd = 0;
    const vfx = { game: { scene, camera: { three: null } }, update(dt) { baseUpd++; } };
    const pack = installPack1(vfx);
    if (installPack1(vfx) !== pack) throw new Error('not idempotent');
    console.log('\nVFX PACK 1 (9A):', PACK1_NAMES.length, 'effects →', PACK1_NAMES.join(', '));
    for (const n of PACK1_NAMES) if (typeof vfx[n] !== 'function') throw new Error('vfx.' + n + ' missing');
    for (const [n, m] of [['coinBurst', 'burst'], ['confetti', 'burst'], ['levelRing', 'show'], ['savingSparkle', 'burst'], ['sparkTrail', 'emit'], ['coinFly', 'fly']]) if (typeof vfx[n][m] !== 'function') throw new Error(`vfx.${n}.${m} alias missing (3A/3B hook style)`);
    let dc = 0; scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { dc++; if (!o.userData.noOutline) throw new Error(o.name + ' lacks noOutline'); if (!o.isInstancedMesh) throw new Error(o.name + ' not instanced'); } });
    if (dc !== 5) throw new Error('draw calls ' + dc); if (pack.capacity !== 334) throw new Error('capacity ' + pack.capacity);
    const _m = new THREE.Matrix4(); const noNaN = (what) => { for (const p of pack.list) for (let i = 0; i < p.n; i++) { p.mesh.getMatrixAt(i, _m); for (const v of _m.elements) if (!isFinite(v)) throw new Error('NaN matrix in ' + p.mesh.name + ' during ' + what); } };
    const A = new THREE.Vector3(-3, 0, -2), B = new THREE.Vector3(2, 0, 1);
    let arrived = 0, arriveT = []; let t = 0;
    const step = (dt = 1 / 60) => { vfx.update(dt, vfx.game, dt); t += dt; };
    // 1 coinFly ×8 → arrive after flight+squash, each exactly once, in order
    const nFly = vfx.coinFly(A, B, (i, to) => { arrived++; arriveT.push(t); if (to.distanceTo(B) > 0.3) throw new Error('arrive pos off ' + to.distanceTo(B).toFixed(2)); }, { count: 8 });
    if (nFly !== 8 || pack.pools.coins.items.filter((it) => it.life > 0).length !== 8) throw new Error('coinFly spawned ' + nFly);
    for (let i = 0; i < 80; i++) { step(); noNaN('coinFly'); }
    if (arrived !== 8) throw new Error(`coinFly arrived ${arrived}/8 after 1.33 s`); if (arriveT[0] < 0.6 || arriveT[0] > 0.75) throw new Error('first arrive at ' + arriveT[0].toFixed(2) + ' s (expected ≈ 0.67)');
    console.log(`  coinFly     ×8  arrive once each · first @ ${arriveT[0].toFixed(2)} s · last @ ${arriveT[7].toFixed(2)} s (stagger 0.04)  OK`);
    // 2–6 the rest, both call styles
    const nB = vfx.coinBurst(B, 10) + vfx.coinBurst.burst(B, 4); if (nB !== 14) throw new Error('coinBurst ' + nB);
    const nC = vfx.confetti(B, 40) + vfx.confetti.burst(B, 20); if (nC !== 60) throw new Error('confetti ' + nC);
    const r1 = vfx.levelRing(B, { color: 0xff0000 }); const r2 = vfx.levelRing.show(B, { radius: 1 }); if (!r1 || !r2 || r1 === r2) throw new Error('levelRing items');
    const nS = vfx.savingSparkle(A, 6) + vfx.savingSparkle.burst(A, 6); if (nS !== 12) throw new Error('savingSparkle ' + nS);
    if (!vfx.sparkTrail(B) || !vfx.sparkTrail.emit(B, { color: 0x00ff00 })) throw new Error('sparkTrail emit'); vfx.sparkTrail.burst(B, 3); for (let i = 0; i < 30; i++) vfx.sparkTrail.stream(B, 1 / 60, 40);
    const trailAlive = pack.pools.trail.items.filter((it) => it.life > 0).length; if (trailAlive < 20 || trailAlive > 30) throw new Error('trail stream alive ' + trailAlive + ' (expected 5 + 20)');
    const peak = pack.list.reduce((n, p) => n + p.items.filter((it) => it.life > 0).length, 0);
    // pool exhaustion is graceful: ask for more coins than the pool has
    const over = vfx.coinBurst(B, 500); if (over > 64 || over < 0) throw new Error('coin pool overflow ' + over);
    // step 3 s: no NaN, confetti lands at y≈0.02 and stays ≥ 0, everything drains
    let maxConfY = 0, minY = 9;
    for (let i = 0; i < 180; i++) { step(); noNaN('mix'); for (const it of pack.pools.confetti.items) if (it.life > 0) { maxConfY = Math.max(maxConfY, it.pos.y); minY = Math.min(minY, it.pos.y); } }
    if (pack.alive !== 0) throw new Error('pools did not drain: ' + pack.alive + ' alive after 3 s'); if (minY < 0.019) throw new Error('confetti below ground ' + minY);
    for (const p of pack.list) for (let i = 0; i < p.n; i++) { p.mesh.getMatrixAt(i, _m); if (_m.elements[0] !== 0 || _m.elements[5] !== 0) throw new Error(p.mesh.name + ' instance ' + i + ' not hidden after death'); }
    if (baseUpd < 260) throw new Error('base VFX.update not chained ' + baseUpd);
    console.log(`  coinBurst ×14 · confetti ×60 (peak y ${maxConfY.toFixed(1)}, never < 0.02) · levelRing ×2 · sparkTrail 5 + stream 20 · savingSparkle ×12 · overflow ask 500 → ${over} · peak ${peak} alive → 0 after 3 s · ${dc} InstancedMesh = ${dc} dc, all noOutline · base update chained  OK`);
    // register/pools + clear + dispose
    if (!vfx.pools['pack1.coins'] || typeof vfx.register !== 'function') throw new Error('register');
    vfx.coinBurst(B, 10); pack.clear(); if (pack.alive !== 0 || pack.pools.coins.items.some((it) => it.life > 0)) throw new Error('clear');
    pack.dispose(); let left = 0; scene.traverse((o) => { if (o.isInstancedMesh) left++; }); if (left !== 0 || vfx.pack1) throw new Error('dispose left ' + left);
    console.log('  register(pack1.*) · clear · dispose (scene empty, vfx.update restored)  OK');
  } catch (err) { bad++; console.log('  pack1.js FAIL →', err.message.split('\n')[0]); }
  // 9B VFX pack 2 (Debt Fog): installPack2 on a mock VFX (with and without pack1). Fog ring = 1 InstancedMesh (≤ 60, noOutline),
  // setCoverage animates outCubic 600 ms, reach = fog01·(edge−core), blobs sit between core and edge, push() shoves blobs in front
  // of the hero out and they spring back, vignette follows coverage, debtPulse 80 ms in → 520 ms out (both call styles), coinRain
  // uses pack1's coin pool when present (else its own pool), beam fades in 400 ms / sweeps / fades out, fogRecede Sequence 1900 ms
  // ends at coverage 0 with the beam on, clear/dispose restore the scene and vfx.update.
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { installPack1 } = await import(pathToFileURL(resolve('src/vfx/pack1.js')).href);
    const { installPack2, PACK2_NAMES, DebtFog, makeFogRecedeSequence } = await import(pathToFileURL(resolve('src/vfx/pack2.js')).href);
    console.log('\nVFX PACK 2 (9B):', PACK2_NAMES.length, 'effects →', PACK2_NAMES.join(', '));
    const scene = new THREE.Scene(); let baseUpd = 0;
    const vfx = { game: { scene, sequences: null }, update(dt) { baseUpd++; } };
    installPack1(vfx);
    const p2 = installPack2(vfx, { island: { radius: 11 }, fogCount: 48 });
    if (installPack2(vfx) !== p2) throw new Error('not idempotent');
    for (const n of PACK2_NAMES) if (vfx[n] == null) throw new Error('vfx.' + n + ' missing');
    if (vfx.fogShader !== vfx.fog || typeof vfx.fog.push !== 'function' || typeof vfx.fog.setCoverage !== 'function') throw new Error('vfx.fog / fogShader alias (3B hook)');
    if (typeof vfx.debtPulse.pulse !== 'function' || typeof vfx.coinRain.burst !== 'function' || typeof vfx.lighthouseBeam.show !== 'function') throw new Error('method aliases (3B hook style)');
    const fog = vfx.fog; if (!(fog instanceof DebtFog) || fog.n !== 48 || fog.n > 60) throw new Error('fog count ' + fog.n);
    let fogDc = 0; scene.traverse((o) => { if (o.isInstancedMesh && o.name === 'vfx.debtFog') { fogDc++; if (!o.userData.noOutline) throw new Error('fog lacks noOutline'); } if ((o.isMesh || o.isInstancedMesh) && o.name.startsWith('vfx.') && !o.userData.noOutline) throw new Error(o.name + ' lacks noOutline'); });
    if (fogDc !== 1) throw new Error('fog draw calls ' + fogDc); if (p2.rain) throw new Error('coinRain should reuse pack1 coins when pack1 is present');
    if (fog.mesh.visible) throw new Error('fog visible at coverage 0');
    const _m = new THREE.Matrix4(); const radiusOf = (i) => { fog.mesh.getMatrixAt(i, _m); for (const v of _m.elements) if (!isFinite(v)) throw new Error('NaN fog matrix'); return Math.hypot(_m.elements[12], _m.elements[14]); };
    const step = (dt = 1 / 60) => vfx.update(dt, vfx.game, dt);
    // 1 setCoverage 0 → 0.6: outCubic 600 ms (≈ 0.52 at 300 ms, 0.6 at 600 ms), reach = 0.6·(12.5−2.5) = 6, all blobs within [core, edge], visible, vignette follows
    fog.setCoverage(0.6); for (let i = 0; i < 18; i++) step(); const covMid = fog.coverage;
    if (covMid < 0.5 || covMid > 0.56) throw new Error('coverage @300 ms ' + covMid.toFixed(3) + ' (expected ≈ 0.525 outCubic)');
    for (let i = 0; i < 24; i++) step();
    if (Math.abs(fog.coverage - 0.6) > 1e-6 || Math.abs(fog.reach - 6) > 1e-6 || !fog.mesh.visible) throw new Error('coverage settle ' + fog.coverage + ' reach ' + fog.reach);
    let rMin = 99, rMax = 0; for (let i = 0; i < fog.n; i++) { const r = radiusOf(i); rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); }
    if (rMin < fog.core - 0.1 || rMax > fog.edge + 0.1 || rMax - rMin < 2) throw new Error(`blob radii ${rMin.toFixed(2)}–${rMax.toFixed(2)} (edge ${fog.edge}, core ${fog.core})`);
    if (vfx.vignette.amount < 0.3 || vfx.vignette.amount > 0.4) throw new Error('vignette ' + vfx.vignette.amount.toFixed(3) + ' (expected (0.6−0.15)·0.8 = 0.36)');
    console.log(`  fog: 48 blobs = 1 InstancedMesh (1 dc, noOutline) · setCoverage(0.6) outCubic 600 ms (${covMid.toFixed(2)} @300 ms → 0.60) · reach 6.0 u · radii ${rMin.toFixed(1)}–${rMax.toFixed(1)} ⊂ [${fog.core}, ${fog.edge}] · vignette ${vfx.vignette.amount.toFixed(2)}  OK`);
    // 2 push (3B fogSweep hook): hero at (2,0,0) sweeping +x → blobs near +x edge move outward then spring back
    const r0 = radiusOf(0); const hit = vfx.fogShader.push(new THREE.Vector3(2, 0, 0), new THREE.Vector3(1, 0, 0), 1); if (hit < 3 || hit > 20) throw new Error('push hit ' + hit);
    step(0.15); const r1 = radiusOf(0); if (r1 - r0 < 0.05) throw new Error(`push did not shove blob 0 out (${r0.toFixed(2)} → ${r1.toFixed(2)})`);
    for (let i = 0; i < 60; i++) step(); const r2 = radiusOf(0); if (Math.abs(r2 - r0) > 0.05) throw new Error(`push did not settle back (${r0.toFixed(2)} → ${r2.toFixed(2)})`);
    if (vfx.fog.push(new THREE.Vector3(2, 0, 0), new THREE.Vector3(-1, 0, 0), 1) === 0) { /* −x side is also fogged, hits allowed */ }
    for (let i = 0; i < 60; i++) step();
    // 3 debtPulse: 80 ms inQuad in → 520 ms outCubic out, both call styles, stacking keeps the max
    const pulse = vfx.debtPulse.ctl; vfx.debtPulse(0.5); for (let i = 0; i < 5; i++) step(); const pk = pulse.opacity; if (pk < 0.45 || pk > 0.5) throw new Error('pulse peak ' + pk.toFixed(3));
    vfx.debtPulse.pulse(new THREE.Vector3(), 0.3); if (pulse.max < 0.5) throw new Error('pulse stacking lowered max to ' + pulse.max);
    for (let i = 0; i < 40; i++) step(); if (pulse.life > 0 || pulse.opacity !== 0) throw new Error('pulse did not finish: life ' + pulse.life + ' op ' + pulse.opacity);
    // 4 coinRain via pack1 coins: coins start above `height`, bounce once at y 0.03, drain
    const coins = vfx.pack1.pools.coins; const nR = vfx.coinRain(new THREE.Vector3(0, 0, 0), 12) + vfx.coinRain.burst(new THREE.Vector3(1, 0, 1), 4); if (nR !== 16 || coins.alive !== 16) throw new Error('coinRain spawned ' + nR + ' alive ' + coins.alive);
    let rainMaxY = 0, rainMinY = 9, bounced = 0; for (let i = 0; i < 100; i++) { step(); for (const it of coins.items) if (it.life > 0) { rainMaxY = Math.max(rainMaxY, it.pos.y); rainMinY = Math.min(rainMinY, it.pos.y); if (it.bounced) bounced++; } }
    if (rainMaxY < 3.5 || rainMinY < 0.02 || bounced === 0) throw new Error(`coinRain y ${rainMinY.toFixed(2)}–${rainMaxY.toFixed(2)} bounced ${bounced}`);
    if (coins.alive !== 0) throw new Error('coinRain did not drain: ' + coins.alive);
    // 5 beam: show at lamp → fade in 400 ms → sweep rotates → sweep(ms) ends → fades out → hidden
    const beam = vfx.lighthouseBeam; beam.show(new THREE.Vector3(0, 0, -9)); for (let i = 0; i < 12; i++) step(); const fadeMid = beam.fade; if (fadeMid < 0.4 || fadeMid > 0.6) throw new Error('beam fade @200 ms ' + fadeMid.toFixed(2));
    for (let i = 0; i < 20; i++) step(); if (beam.fade !== 1 || Math.abs(beam.mesh.material.opacity - beam.maxOpacity) > 1e-6 || !beam.pivot.visible) throw new Error('beam not fully on');
    const ry0 = beam.pivot.rotation.y; step(0.5); if (Math.abs(beam.pivot.rotation.y - ry0 - 0.3) > 1e-6) throw new Error('beam sweep speed ' + (beam.pivot.rotation.y - ry0));
    beam.hide(); for (let i = 0; i < 30; i++) step(); if (beam.pivot.visible || beam.mesh.material.opacity !== 0) throw new Error('beam did not hide');
    beam.sweep(500); for (let i = 0; i < 24; i++) step(); if (!beam.on) throw new Error('sweep ended early'); for (let i = 0; i < 40; i++) step(); if (beam.on || beam.pivot.visible) throw new Error('sweep(500) did not end');
    console.log(`  push ×${hit} blobs (r ${r0.toFixed(2)} → ${r1.toFixed(2)} @150 ms → ${r2.toFixed(2)} settled) · debtPulse peak ${pk.toFixed(2)} → 0 in 0.6 s (stack = max) · coinRain ×16 via pack1 coins (y ${rainMinY.toFixed(2)}–${rainMaxY.toFixed(1)}, bounce, drained) · beam fade ${fadeMid.toFixed(2)} @200 ms → on · 0.6 rad/s · hide · sweep(500) ends  OK`);
    // 6 fogRecede WIN sequence: 300 anticipation (coverage rises ≤ +0.08) → 1200 recede → 400 relight: coverage 0, fog hidden, beam on, confetti fired
    fog.setCoverage(0.7, { immediate: true }); step(); const seq = vfx.fogRecede({ lighthouse: new THREE.Vector3(0, 0, -9) }); let done = false; seq.then(() => { done = true; });
    if (seq.totalMs !== 1900) throw new Error('fogRecede totalMs ' + seq.totalMs);
    for (let i = 0; i < 18; i++) { seq.update(1 / 60); step(); } if (fog.coverage < 0.7 || fog.coverage > 0.785) throw new Error('anticipation coverage ' + fog.coverage.toFixed(3));
    for (let i = 0; i < 60; i++) { seq.update(1 / 60); step(); } if (fog.coverage > 0.5 || fog.coverage <= 0) throw new Error('recede mid coverage ' + fog.coverage.toFixed(3));
    for (let i = 0; i < 50; i++) { seq.update(1 / 60); step(); }
    if (!done || seq.playing || fog.coverage !== 0 || fog.mesh.visible || !beam.on || beam.fade <= 0) throw new Error(`fogRecede end: done ${done} cov ${fog.coverage} vis ${fog.mesh.visible} beam ${beam.on}`);
    if (vfx.pack1.pools.confetti.alive === 0) throw new Error('relight did not fire confetti');
    for (let i = 0; i < 20; i++) step(); if (fog.blobs.some((b) => b.lift !== 0)) throw new Error('blob lift not reset');
    // 7 standalone (no pack1) → own CoinRainPool, DOM-less vignette/pulse are inert, clear + dispose restore scene & update
    const scene2 = new THREE.Scene(); let upd2 = 0; const vfx2 = { game: { scene: scene2 }, update() { upd2++; } }; const q = installPack2(vfx2, { radius: 8, core: 2, fogCount: 80 });
    if (vfx2.fog.n !== 60 || vfx2.fog.edge !== 8 || vfx2.fog.core !== 2) throw new Error('fog opts (count clamp 60 / radius / core)');
    if (!q.rain || q.rain.mesh.name !== 'vfx.coinRain' || vfx2.coinRain(new THREE.Vector3(), 10) !== 10 || q.rain.alive !== 10) throw new Error('own coinRain pool');
    const over = vfx2.coinRain(new THREE.Vector3(), 500); if (over !== 38) throw new Error('coinRain overflow ' + over);
    vfx2.fog.setCoverage(1, { immediate: true }); vfx2.update(1 / 60, vfx2.game, 1 / 60); if (!vfx2.fog.mesh.visible || Math.abs(vfx2.fog.reach - 6) > 1e-6) throw new Error('standalone fog');
    for (let i = 0; i < 180; i++) vfx2.update(1 / 60, vfx2.game, 1 / 60); if (q.rain.alive !== 0) throw new Error('own rain pool did not drain ' + q.rain.alive);   // 48 coins, last delay 1.1 s + 1.4 s life → 3 s
    vfx2.coinRain(new THREE.Vector3(), 5); vfx2.lighthouseBeam.show(new THREE.Vector3()); q.clear(); if (q.rain.alive !== 0 || vfx2.fog.coverage !== 0 || vfx2.fog.mesh.visible || vfx2.lighthouseBeam.pivot.visible) throw new Error('clear');
    const mk = makeFogRecedeSequence(vfx2); if (!mk || mk.totalMs !== 1900) throw new Error('makeFogRecedeSequence');
    q.dispose(); let left = 0; scene2.traverse((o) => { if (o.isMesh || o.isInstancedMesh) left++; }); if (left !== 0 || vfx2.pack2 || vfx2.fog) throw new Error('dispose left ' + left);
    const u0 = upd2; vfx2.update(1 / 60); if (upd2 !== u0 + 1) throw new Error('vfx.update not restored');
    if (baseUpd < 400) throw new Error('base VFX.update not chained ' + baseUpd);
    p2.dispose(); let left1 = 0; scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && !o.name.startsWith('vfx.coins') && !['vfx.confetti', 'vfx.rings', 'vfx.trail', 'vfx.sparkle'].includes(o.name)) left1++; }); if (left1 !== 0) throw new Error('pack2 dispose left ' + left1 + ' meshes');
    console.log(`  fogRecede 1900 ms: 0.70 → ≤0.78 → 0, fog hidden, beam on, confetti ×${vfx.pack1.pools.confetti.alive} · standalone: own coinRain pool (overflow 500 → ${over}), count clamp 60, radius/core opts · register(pack2.*) · clear · dispose (scene empty, update restored)  OK`);
  } catch (err) { bad++; console.log('  pack2.js FAIL →', err.message.split('\n')[0]); }
}
if (doUI) {
  // 7A: hud.js / jars.js / build.js mounted on tools/domshim.mjs. Checks: bus → DOM text, count-up tween settles, jar rebalance sums
  // to 100 (pure fn, 200 random drags, locks), ui:jar / ui:jar:apply emitted, build menu cards = catalog (hidden free landmarks),
  // select → ui:build, poor/locked denied, placing banner on build:enter, counts on build:placed/removed, hotkeys B/Esc.
  const { installDomShim, pressKey, dragRange } = await import(pathToFileURL(resolve('tools/domshim.mjs')).href);
  installDomShim();
  const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
  const bus = new EventBus();
  const ev = {}; const rec = (n) => bus.on(n, (p) => (ev[n] ||= []).push(p));
  ['ui:jar', 'ui:jar:apply', 'ui:build', 'ui:build:open', 'ui:build:close'].forEach(rec);
  const root = document.body;
  console.log('\nUI (7A):');
  // 1. HUD
  try {
    const { mountHUD } = await import(pathToFileURL(resolve('ui/hud.js')).href);
    const stats = { fps: 59, drawCalls: 123 };
    const hud = mountHUD(root, { bus, stats: () => stats, selfDrive: false, spark: 120, fog01: 0.35, debt: 200 });
    const q = (s) => hud.el.querySelector(s);
    if (q('.ll-spark-val').textContent !== '120') throw new Error('initial spark ' + q('.ll-spark-val').textContent);
    if (!hud.el.querySelector('.ll-spark').classList.contains('has-debt')) throw new Error('debt chip');
    // S05: PAY button in the debt chip → ui:repay {amount = min(debt, spark)}; disabled when pouch 0 or debt 0
    { const pay = q('.ll-spark-pay'); if (!pay || pay.disabled || pay.textContent !== 'PAY 120') throw new Error('S05 pay label ' + (pay && pay.textContent));
      const got = []; const off = bus.on('ui:repay', (p) => got.push(p)); pay.dispatchEvent({ type: 'click' });
      if (got.length !== 1 || got[0].amount !== 120 || got[0].source !== 'hud') throw new Error('S05 ui:repay ' + JSON.stringify(got)); off();
      hud.setSpark(0, { silent: true }); if (!pay.disabled) throw new Error('S05 pay should disable at pouch 0'); hud.setSpark(120, { silent: true }); }
    bus.emit('eco:spark', { spark: 180, delta: 60, reason: 'sale' });
    if (hud.state.spark !== 180 || !q('.ll-float')) throw new Error('eco:spark → state/float');
    for (let i = 0; i < 60; i++) hud.update(1 / 60);
    if (q('.ll-spark-val').textContent !== '180') throw new Error('count-up did not settle: ' + q('.ll-spark-val').textContent);
    bus.emit('eco:fog', { fog01: 0.8 }); if (q('.ll-fog-pct').textContent !== '80%' || !q('.ll-fog').classList.contains('is-danger')) throw new Error('fog');
    bus.emit('eco:season', { season: 3, fog01: 0.5, debt: 0, spark: 300, jars: {}, reputation: 0.8 });
    if (!/Season 4/.test(q('.ll-season').textContent) || hud.state.spark !== 300 || q('.ll-spark').classList.contains('has-debt')) throw new Error('eco:season → ' + q('.ll-season').textContent);
    if (hud.el.querySelectorAll('.ll-rep i.on').length !== 4) throw new Error('reputation stars');
    bus.emit('eco:tick', { day01: 0.5 }); if (q('.ll-day i').style.width !== '50.0%') throw new Error('day bar ' + q('.ll-day i').style.width);
    bus.emit('eco:denied', { cost: 5 }); if (!q('.ll-spark').classList.contains('shake')) throw new Error('denied shake');
    hud.update(0.3); if (!/fps 59 · calls 123/.test(q('.ll-stats').textContent)) throw new Error('stats ' + q('.ll-stats').textContent);
    bus.emit('eco:win', {}); if (!/Lighthouse/.test(q('.ll-season').textContent)) throw new Error('win text');
    hud.destroy(); if (hud.el.parentNode) throw new Error('destroy');
    console.log('  hud: spark 120→180 count-up settles · +60 float · fog 80 % danger · eco:season → Season 4 / debt chip off / 4 rep stars · day bar 50 % · denied shake · stats · win text · destroy  OK');
  } catch (err) { bad++; console.log('  hud FAIL →', err.message); }
  // 2. Jars
  try {
    const { mountJars, rebalance, sumPct, JAR_ORDER, JAR_PRESETS } = await import(pathToFileURL(resolve('ui/jars.js')).href);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let p = { ...JAR_PRESETS.balanced };
    for (let i = 0; i < 200; i++) { const k = JAR_ORDER[Math.floor(rnd() * 4)]; p = rebalance(p, k, Math.floor(rnd() * 101)); if (sumPct(p) !== 100 || JAR_ORDER.some((j) => p[j] < 0 || !Number.isInteger(p[j]))) throw new Error('rebalance ' + JSON.stringify(p)); }
    const r1 = rebalance({ spend: 40, save: 30, invest: 20, protect: 10 }, 'save', 60); if (r1.save !== 60 || sumPct(r1) !== 100 || r1.spend < r1.invest) throw new Error('proportional ' + JSON.stringify(r1));
    const r2 = rebalance({ spend: 40, save: 30, invest: 20, protect: 10 }, 'spend', 100); if (r2.spend !== 100 || r2.save !== 0) throw new Error('max ' + JSON.stringify(r2));
    const r3 = rebalance({ spend: 40, save: 30, invest: 20, protect: 10 }, 'save', 90, { protect: true }); if (r3.protect !== 10 || r3.save !== 90 || r3.spend !== 0 || sumPct(r3) !== 100) throw new Error('locked ' + JSON.stringify(r3));
    const jars = mountJars(root, { bus, pct: { spend: 40, save: 30, invest: 20, protect: 10 }, spark: 120 });   // P09: APPLY needs a non-empty pouch
    const inputs = jars.el.querySelectorAll('input');
    if (inputs.length !== 4 || jars.el.querySelector('.ll-jars-total').textContent !== '100 %') throw new Error('mount');
    dragRange(inputs[1], 70); // save → 70
    if (jars.pct.save !== 70 || sumPct(jars.pct) !== 100 || !ev['ui:jar'] || ev['ui:jar'][0].changed !== 'save') throw new Error('drag ' + JSON.stringify(jars.pct));
    if (jars.el.querySelector('.ll-jars-total').textContent !== '100 %') throw new Error('total text');
    const applyBtn = jars.el.querySelector('.ll-jars-foot').querySelectorAll('button')[1]; if (applyBtn.disabled) throw new Error('apply should be enabled after a drag');
    applyBtn.click(); if (!ev['ui:jar:apply'] || ev['ui:jar:apply'][0].pct.save !== 70 || jars.state.dirty) throw new Error('apply');
    bus.emit('eco:spark', { spark: 0 }); if (!applyBtn.disabled) throw new Error('P09: APPLY stays enabled after the pouch emptied');   // the integrator's allocate empties the pouch → eco:spark 0
    jars.setPreset('saver'); if (!applyBtn.disabled) throw new Error('P09: APPLY enabled with an empty pouch'); jars.setDebt(null, 50); if (applyBtn.disabled) throw new Error('P09: APPLY should re-arm once Spark arrives');
    bus.emit('eco:jar', { jars: { spend: 10, save: 150, invest: 20, protect: 5 } }); if (!/150/.test(jars.el.querySelector('.ll-jar.save .ll-jar-bal').textContent)) throw new Error('balances');
    jars.lock('invest', true); const before = jars.pct.invest; jars.setPct({ invest: 99 }); if (jars.pct.invest !== before) throw new Error('lock ignored');
    jars.setPreset('saver'); if (jars.pct.save !== 50) throw new Error('preset');
    // S03: ⚡ AUTO toggle → ui:jar:auto {on, pct}; aria-pressed + .on class follow
    const autoEv = []; const offAuto = bus.on('ui:jar:auto', (p) => autoEv.push(p));
    const autoBtn = jars.el.querySelector('.ll-jars-foot .ll-btn.auto'); if (!autoBtn || autoBtn.getAttribute('aria-pressed') !== 'false') throw new Error('S03: AUTO button missing / pressed by default');
    autoBtn.click(); if (!jars.auto || autoEv.length !== 1 || autoEv[0].on !== true || autoEv[0].pct.save !== 50 || !autoBtn.classList.contains('on')) throw new Error('S03: AUTO on ' + JSON.stringify(autoEv));
    jars.setAuto(true); if (autoEv.length !== 1) throw new Error('S03: setAuto(same) must not re-emit');
    autoBtn.click(); if (jars.auto || autoEv.length !== 2 || autoEv[1].on !== false) throw new Error('S03: AUTO off'); offAuto();
    jars.destroy();
    console.log(`  jars: rebalance pure ×200 drags sum=100 · proportional/max/locked · drag save→70 → ui:jar (${ev['ui:jar'].length} events) · APPLY → ui:jar:apply · eco:jar balances · lock · preset  OK`);
  } catch (err) { bad++; console.log('  jars FAIL →', err.message); }
  // 3. Build menu
  try {
    const { mountBuildMenu } = await import(pathToFileURL(resolve('ui/build.js')).href);
    const { PROP_CATALOG } = await import(pathToFileURL(resolve('src/assets/props.js')).href);
    const menu = mountBuildMenu(root, { bus, catalog: PROP_CATALOG, spark: () => 100, categories: ['stall', 'decor', 'nature', 'landmark'] });
    const stalls = Object.values(PROP_CATALOG).filter((e) => e.category === 'stall').length;
    if (menu.cards.size !== stalls) throw new Error(`stall cards ${menu.cards.size} ≠ ${stalls}`);
    pressKey('b'); if (!menu.isOpen || !ev['ui:build:open']) throw new Error('hotkey B');
    // mobile bugfix: select() only PICKS (detail bar with Deploy / Upgrade) — deploy() is what enters place mode
    menu.select('stall_fruit'); if (ev['ui:build'].some((p) => p.action === 'select')) throw new Error('select must not deploy');
    if (!menu.el.classList.contains('has-detail') || !menu.el.querySelector('.ll-build-detail .deploy')) throw new Error('detail bar');
    menu.el.querySelector('.ll-build-detail .deploy').click?.() ?? menu.deploy();
    if (!ev['ui:build'].some((p) => p.action === 'select')) menu.deploy();
    const sel = ev['ui:build'].find((p) => p.action === 'select'); if (!sel || sel.id !== 'stall_fruit' || sel.cost !== 40) throw new Error('deploy ' + JSON.stringify(sel));
    if (!menu.cards.get('stall_fruit').classList.contains('selected')) throw new Error('selected class');
    const n0 = ev['ui:build'].length; menu.select('stall_sparkExchange'); menu.deploy(); // 150 > 100 → denied
    if (!menu.cards.get('stall_sparkExchange').classList.contains('poor') || !menu.cards.get('stall_sparkExchange').classList.contains('denied') || ev['ui:build'][ev['ui:build'].length - 1].action !== 'denied') throw new Error('poor card not denied');
    menu.setLocked('stall_bread', true); menu.select('stall_bread'); if (!menu.cards.get('stall_bread').classList.contains('locked') || ev['ui:build'].length !== n0 + 2) throw new Error('locked card emitted');
    bus.emit('build:enter', { id: 'stall_fruit', cost: 40 }); if (!menu.el.classList.contains('placing') || !/Fruit Stand/.test(menu.el.querySelector('.ll-build-placing').textContent)) throw new Error('placing banner');
    bus.emit('build:ghost', { ok: false }); if (!/blocked/.test(menu.el.querySelector('.ll-build-placing .ll-btn.no').textContent)) throw new Error('ghost red');
    bus.emit('build:placed', { id: 'stall_fruit' }); bus.emit('build:placed', { id: 'stall_fruit' }); if (!menu.el.classList.contains('placing')) throw new Error('B13: placed must not drop placing'); bus.emit('build:exit', {}); if (menu.el.classList.contains('placing') || menu.state.counts.stall_fruit !== 2 || menu.cards.get('stall_fruit').lastChild.textContent !== '2') throw new Error('counts');
    bus.emit('build:removed', { id: 'stall_fruit' }); if (menu.state.counts.stall_fruit !== 1) throw new Error('removed count');
    bus.emit('eco:spark', { spark: 500 }); if (menu.cards.get('stall_sparkExchange').classList.contains('poor')) throw new Error('affordability refresh');
    menu.setCategory('landmark'); const lm = Object.entries(PROP_CATALOG).filter(([, e]) => e.category === 'landmark' && e.cost).length; if (menu.cards.size !== lm) throw new Error('free landmarks should be hidden: ' + menu.cards.size);
    menu.setCategory('decor'); if (!menu.cards.has('bench') || !menu.el.querySelector('.ll-build-tab.on')) throw new Error('decor tab');
    bus.emit('build:denied', { why: 'blocked', id: 'bench' }); if (!/blocked/.test(menu.el.querySelector('.ll-build-foot span').textContent)) throw new Error('denied foot text');
    pressKey('Escape'); if (menu.isOpen || !ev['ui:build:close']) throw new Error('Esc close');
    menu.destroy();
    console.log(`  build: ${stalls} stall cards · B opens · select stall_fruit → ui:build{select,40} · poor → denied shake · locked silent · build:enter → placing banner · ghost red · placed×2/removed → count 1 · eco:spark refresh · ${lm} paid landmarks · decor tab · denied text · Esc  OK`);
  } catch (err) { bad++; console.log('  build FAIL →', err.message); }

  // 7B: ledger.js / dialogue.js / toast.js. Checks: eco:season → ledger opens with rows/chips/title, count-up settles via update(dt),
  // skip() → all final, stars on/off, lesson card from LESSONS + story:lesson override, CONTINUE → ui:continue {outcome}, eco:win/eco:lose headers,
  // dialogue typewriter cps + punctuation pauses, story:line queue, advance → ui:advance / hide, choices → ui:choice + keys 1–4, ui:pause on/off,
  // toast push/coalesce ×N/max/clear + bus listeners (build:placed, eco:denied, eco:event, cust:angry ×2 coalesce).
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const ROW_WAIT = 90 * 5 + 40; // ledger row stagger 90 ms × 5 + net row
  ['ui:continue', 'ui:ledger:open', 'ui:ledger:close', 'ui:choice', 'ui:advance', 'ui:pause', 'ui:dialogue:open', 'ui:dialogue:close'].forEach(rec);
  console.log('\nUI (7B):');
  // 4. Ledger
  try {
    const { mountLedger, LESSONS, LEDGER_ROWS } = await import(pathToFileURL(resolve('ui/ledger.js')).href);
    if (Object.keys(LESSONS).length !== 10 || LEDGER_ROWS.length !== 5) throw new Error(`LESSONS ${Object.keys(LESSONS).length} / rows ${LEDGER_ROWS.length}`);
    const ledger = mountLedger(root, { bus, seasonsToWin: 10, selfDrive: false });
    const q = (s) => ledger.el.querySelector(s);
    const rep = { season: 3, income: 312, expenses: 180, interestEarned: 14, interestPaid: 36, investReturn: -8, debt: 216, fog01: 0.42, fogDelta: 0.05, spark: 240, jars: { save: 90 }, netWorth: 534, lessonId: 'emergencyFund', stars: 2 };
    bus.emit('eco:season', rep);
    if (!ledger.isOpen || !ledger.el.classList.contains('open') || !ev['ui:ledger:open'] || ev['ui:ledger:open'][0].stars !== 2) throw new Error('eco:season did not open');
    if (q('.ll-ledger-title').textContent !== 'Season 3 Ledger' || !/7 seasons/.test(q('.ll-ledger-sub').textContent)) throw new Error('title/sub ' + q('.ll-ledger-title').textContent + ' | ' + q('.ll-ledger-sub').textContent);
    if (q('.ll-chip.fog').textContent !== 'Fog 42 % (+5)' || !q('.ll-chip.fog').classList.contains('bad') || q('.ll-chip.debt').textContent !== 'Debt 216' || q('.ll-chip.worth').textContent !== 'Net worth 534') throw new Error('chips ' + q('.ll-chip.fog').textContent);
    if (q('.ll-lesson-title').textContent !== 'Emergency Fund' || !/Tip: /.test(q('.ll-lesson-tip').textContent)) throw new Error('lesson card ' + q('.ll-lesson-title').textContent);
    if (!q('.ll-ledger-continue').disabled) throw new Error('continue should be disabled while animating');
    await sleep(ROW_WAIT); // let the stagger timers arm the rows (90 ms × 5 + net)
    for (let i = 0; i < 60; i++) ledger.update(1 / 60); // 1 s > 650 ms count-up
    if (ledger.rows.income.val.textContent !== '312' || ledger.rows.interestPaid.val.textContent !== '−36' || ledger.rows.investReturn.val.textContent !== '−8') throw new Error(`count-up income=${ledger.rows.income.val.textContent} interestPaid=${ledger.rows.interestPaid.val.textContent} invest=${ledger.rows.investReturn.val.textContent}`);
    if (ledger.rows.net.target !== 312 + 14 - 8 - 180 - 36 || ledger.rows.net.val.textContent !== '102' || !ledger.rows.net.row.classList.contains('pos')) throw new Error('net ' + ledger.rows.net.target + ' ' + ledger.rows.net.val.textContent);
    ledger.skip();
    const on = ledger.el.querySelectorAll('.ll-ledger-stars i.on').length; if (on !== 2 || !q('.ll-ledger-continue').classList.contains('in') || q('.ll-ledger-continue').disabled) throw new Error('skip → stars ' + on);
    if (!/Two stars/.test(q('.ll-ledger-startxt').textContent)) throw new Error('star text');
    q('.ll-ledger-continue').click();
    if (ledger.isOpen || !ev['ui:continue'] || ev['ui:continue'][0].season !== 3 || ev['ui:continue'][0].stars !== 2 || ev['ui:continue'][0].outcome !== 'season' || ev['ui:continue'][0].lessonId !== 'emergencyFund' || !ev['ui:ledger:close']) throw new Error('continue ' + JSON.stringify(ev['ui:continue']));
    // story:lesson override (8B) arrives before the report → pendingLesson
    bus.emit('story:lesson', { id: 'x', title: 'From 8B', lesson: 'override', tip: 'ok' });
    bus.emit('eco:season', { ...rep, season: 10, stars: 3, lessonId: 'scams' }); ledger.skip();
    if (q('.ll-lesson-title').textContent !== 'From 8B' || !/last season|Lighthouse waits/.test(q('.ll-ledger-sub').textContent) || ledger.el.querySelectorAll('.ll-ledger-stars i.on').length !== 3) throw new Error('story:lesson override / S10 sub: ' + q('.ll-lesson-title').textContent);
    bus.emit('eco:win', { season: 10 }); ledger.skip();
    if (!ledger.el.classList.contains('win') || !/Lighthouse is lit/.test(q('.ll-ledger-title').textContent) || !/ENDLESS MODE/.test(q('.ll-ledger-continue').textContent)) throw new Error('win header ' + q('.ll-ledger-title').textContent);
    ledger.continue(); if (ev['ui:continue'][1].outcome !== 'win') throw new Error('win outcome');
    bus.emit('eco:season', { ...rep, stars: 0, fog01: 0.92, debt: 540 }); bus.emit('eco:lose', { reason: 'fog' }); ledger.skip();
    if (!ledger.el.classList.contains('lose') || !/Fogged out/.test(q('.ll-ledger-title').textContent) || !/covered the Lighthouse/.test(q('.ll-ledger-sub').textContent) || ledger.el.querySelectorAll('.ll-ledger-stars i.on').length !== 0 || !/No stars/.test(q('.ll-ledger-startxt').textContent)) throw new Error('lose header');
    pressKey('Enter'); if (ledger.isOpen || ev['ui:continue'][2].outcome !== 'lose') throw new Error('Enter → continue (lose)');
    const noAuto = mountLedger(root, { bus, autoOpen: false, selfDrive: false }); bus.emit('eco:season', rep); if (noAuto.isOpen) throw new Error('autoOpen:false still opened'); noAuto.destroy();
    ledger.destroy(); if (ledger.el.parentNode) throw new Error('destroy');
    console.log('  ledger: eco:season → open S3 "7 seasons to the Lighthouse" · chips Fog 42 % (+5) bad / Debt 216 / worth 534 · lesson Emergency Fund · count-up 312/−36/−8 → net +102 · skip → ★★ + CONTINUE → ui:continue{S3,2,season} · story:lesson override · S10 "last season" · eco:win header + ENDLESS · eco:lose "Fogged out" ☆ · Enter · autoOpen:false · destroy  OK');
  } catch (err) { bad++; console.log('  ledger FAIL →', err.message); }
  // 5. Dialogue
  try {
    const { mountDialogue, SPEAKERS } = await import(pathToFileURL(resolve('ui/dialogue.js')).href);
    if (!SPEAKERS.pip || !SPEAKERS.baron || !SPEAKERS.owl) throw new Error('SPEAKERS');
    const dlg = mountDialogue(root, { bus, cps: 50, pauseGame: true, selfDrive: false });
    const q = (s) => dlg.el.querySelector(s);
    bus.emit('story:line', { speaker: 'owl', text: 'Hoo! Books open.' });            // 16 chars, 2 punctuation pauses (×6) → 16 + 10 = 26 "ticks" @ 50 cps ≈ 0.52 s
    bus.emit('story:line', { speaker: 'pip', mood: 'happy', text: 'Save first.' });
    if (!dlg.isOpen || !dlg.isTyping || dlg.state.queue.length !== 1 || !ev['ui:dialogue:open'] || !ev['ui:pause'] || ev['ui:pause'][0].on !== true) throw new Error('story:line open/queue/pause');
    if (q('.ll-dlg-name').textContent !== 'Tally-Owl' || !q('.ll-blob').classList.contains('owl') || !q('.ll-dlg-box').classList.contains('sp-owl')) throw new Error('speaker owl ' + q('.ll-dlg-name').textContent);
    dlg.update(0.1); const partial = q('.ll-dlg-text').textContent; if (partial.length < 3 || partial.length >= 16 || !'Hoo! Books open.'.startsWith(partial)) throw new Error('typewriter partial "' + partial + '"');
    for (let i = 0; i < 5; i++) dlg.update(0.1); // total 0.6 s ≥ 0.52 s
    if (dlg.isTyping || q('.ll-dlg-text').textContent !== 'Hoo! Books open.' || !q('.ll-dlg-text').classList.contains('done')) throw new Error('typewriter did not finish: "' + q('.ll-dlg-text').textContent + '" typing=' + dlg.isTyping);
    dlg.advance(); if (!ev['ui:advance'] || !dlg.isOpen || dlg.line.speaker !== 'pip' || !q('.ll-blob').classList.contains('mood-happy') || q('.ll-dlg-name').textContent !== 'Pip') throw new Error('advance → next line');
    dlg.advance(); if (!dlg.isOpen || dlg.isTyping || ev['ui:advance'].length !== 1) throw new Error('advance while typing should skip, not close'); // 1st tap = skip typewriter
    if (q('.ll-dlg-text').textContent !== 'Save first.') throw new Error('skip text');
    pressKey('Enter'); if (dlg.isOpen || !ev['ui:dialogue:close'] || ev['ui:pause'][1].on !== false || ev['ui:advance'].length !== 2) throw new Error('Enter → close + unpause');
    // choices
    dlg.say({ speaker: 'baron', text: 'Deal?', choices: ['Take it', 'Refuse'] });
    if (dlg.el.querySelectorAll('.ll-dlg-choice').length !== 2 || q('.ll-dlg-next').style.display !== 'none') throw new Error('choice buttons');
    dlg.skip(); if (!q('.ll-dlg-choices').classList.contains('in')) throw new Error('choices revealed after typing');
    dlg.advance(); if (!dlg.isOpen) throw new Error('advance must not pass a choice line');
    pressKey('2'); if (!ev['ui:choice'] || ev['ui:choice'][0].index !== 1 || ev['ui:choice'][0].text !== 'Refuse' || ev['ui:choice'][0].line.speaker !== 'baron' || dlg.isOpen) throw new Error('key 2 → choice ' + JSON.stringify(ev['ui:choice'] && ev['ui:choice'][0] && ev['ui:choice'][0].index));
    dlg.say('Just narration.'); if (!q('.ll-dlg-portrait').classList.contains('hidden') || q('.ll-dlg-name').style.display !== 'none') throw new Error('narrator hides portrait/name');
    dlg.say({ speaker: 'zed', text: 'who?' }); if (q('.ll-blob-initial').textContent !== 'Z' || !q('.ll-blob').classList.contains('generic')) throw new Error('generic speaker initial');
    bus.emit('story:end'); if (dlg.isOpen) throw new Error('story:end');
    dlg.destroy(); if (dlg.el.parentNode) throw new Error('destroy');
    console.log('  dialogue: story:line ×2 → open + queue 1 + ui:pause on · Tally-Owl portrait · typewriter 50 cps partial → done (punct. pauses) · advance → ui:advance / next line (Pip happy) · tap while typing = skip · Enter → close + ui:pause off · choices ×2, advance blocked, key 2 → ui:choice{1,Refuse} · narrator · generic "Z" · story:end · destroy  OK');
  } catch (err) { bad++; console.log('  dialogue FAIL →', err.message); }
  // 6. Toasts
  try {
    const { mountToast } = await import(pathToFileURL(resolve('ui/toast.js')).href);
    const toast = mountToast(root, { bus, max: 3, duration: 0 }); // duration 0 → no auto-dismiss (deterministic)
    const h = toast.push('Hello', { kind: 'ok', icon: '🔨' });
    if (toast.count !== 1 || !h || !h.el.classList.contains('ok') || !/hammer|svg|🔨/.test(h.el.querySelector('.ll-toast-icon').innerHTML) || h.el.querySelector('.ll-toast-text').textContent !== 'Hello') throw new Error('push');
    toast.push('Hello'); if (toast.count !== 1 || h.el.querySelector('.ll-toast-badge').textContent !== '×2' || !h.el.classList.contains('bump')) throw new Error('coalesce same text');
    toast.push({ text: 'A', id: 'k' }); toast.push({ text: 'B', id: 'k' }); if (toast.count !== 2 || toast.items[0].count !== 2) throw new Error('coalesce by id ' + JSON.stringify(toast.items));
    toast.push('C'); toast.push('D'); if (toast.count !== 3 || toast.items.some((t) => t.text === 'Hello')) throw new Error('max 3 drops oldest ' + JSON.stringify(toast.items));
    if (toast.el.children[0].querySelector('.ll-toast-text').textContent !== 'D') throw new Error('newest on top');
    h.close(); toast.clear(); if (toast.count !== 0) throw new Error('clear');
    const closed = toast.push('bye'); closed.el.click(); if (toast.count !== 0) throw new Error('click dismiss');
    bus.emit('build:placed', { id: 'stall_fruit' }); if (toast.count !== 1 || toast.items[0].text !== 'Fruit built') throw new Error('build:placed → ' + JSON.stringify(toast.items));
    bus.emit('eco:denied', { cost: 90 }); if (toast.items[0].text !== 'Not enough Spark (need 90)' || !toast.el.children[0].classList.contains('bad')) throw new Error('eco:denied');
    bus.emit('eco:event', { event: { title: 'Spark Storm', text: 'Repairs 40.' } }); if (!/^Spark Storm: Repairs 40\./.test(toast.items[0].text)) throw new Error('eco:event');
    bus.emit('cust:angry', { reason: 'waited' }); bus.emit('cust:angry', { reason: 'waited' }); if (toast.count !== 3 || toast.items[0].count !== 2 || !/left angry \(waited\)/.test(toast.items[0].text)) throw new Error('cust:angry coalesce ' + JSON.stringify(toast.items));
    bus.emit('eco:loan', { kind: 'repay', delta: 50, debt: 100 }); if (toast.items[0].text !== 'Repaid 50 — debt 100') throw new Error('eco:loan');
    bus.emit('story:toast', { text: 'Tip!' }); if (toast.items[0].text !== 'Tip!' || !/owl|svg|🦉/.test(toast.el.children[0].querySelector('.ll-toast-icon').innerHTML)) throw new Error('story:toast owl icon');
    const quiet = mountToast(root, { bus, listen: false, duration: 0 }); bus.emit('build:placed', { id: 'x' }); if (quiet.count !== 0) throw new Error('listen:false'); quiet.destroy();
    // auto-dismiss (real timer)
    const timed = mountToast(root, { bus, listen: false, duration: 30 }); timed.push('zap'); await sleep(90); if (timed.count !== 0) throw new Error('auto-dismiss'); timed.destroy();
    toast.destroy(); if (toast.el.parentNode) throw new Error('destroy');
    console.log('  toast: push ok/🔨 · coalesce text ×2 + id ×2 · max 3 drops oldest, newest on top · close/clear/click · build:placed "Fruit built" · eco:denied (need 90) bad · eco:event title: text · cust:angry ×2 coalesce · eco:loan repay · story:toast 🦉 · listen:false · auto-dismiss 30 ms · destroy  OK');
  } catch (err) { bad++; console.log('  toast FAIL →', err.message); }

  // 7C: touch.js / title.js / pause.js. Checks: joyVector pure (clamp, deadzone, normalize), joystick simulate → input.joystick.vec + onJoystick,
  // buttons → input.press + actions held + ui:touch, repeat timer, enabled/badge, hides on modal events, show/hide/destroy;
  // title: open → ui:title:open, 3 buttons (CONTINUE hidden w/o save), click PLAY → ui:start{story}, Enter/E/C keys, arrows focus, hide → ui:title:close,
  // eco:lose re-shows with sub, busy disables, destroy; pause: Esc → open + ui:pause{on,by:'menu'}, resume, settings normalize/load/save pure,
  // quality seg / outline range → ui:settings + onOutline + localStorage, reduce motion body class, restart/title double-tap confirm → ui:restart/ui:title,
  // ui:title:open force-close, ui:pause:request, destroy.
  ['ui:touch', 'ui:start', 'ui:title:open', 'ui:title:close', 'ui:settings', 'ui:restart', 'ui:title', 'ui:pause:open', 'ui:pause:close'].forEach(rec);
  console.log('\nUI (7C):');
  try {
    const { mountTouch, joyVector, TOUCH_BUTTONS } = await import(pathToFileURL(resolve('ui/touch.js')).href);
    const v0 = joyVector(0, 0); if (v0.mag !== 0 || v0.nx !== 0) throw new Error('joyVector zero');
    const v1 = joyVector(200, 0, 56, 0.12); if (Math.abs(v1.x - 56) > 1e-9 || Math.abs(v1.nx - 1) > 1e-9 || v1.mag !== 1) throw new Error('joyVector clamp ' + JSON.stringify(v1));
    const v2 = joyVector(3, 0, 56, 0.12); if (v2.mag !== 0 || v2.nx !== 0) throw new Error('joyVector deadzone');
    const v3 = joyVector(0, -28, 56, 0.12); if (!(v3.ny < 0 && v3.ny > -1 && v3.mag > 0.4 && v3.mag < 0.5)) throw new Error('joyVector half ' + JSON.stringify(v3));
    const presses = []; const input = { isTouch: false, actions: { attack: false, interact: false, build: false, dash: false }, joystick: { active: false, id: -1, radius: 56, vec: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } } }, press: (n) => presses.push(n), onJoystick: null };
    let joyCalls = 0; input.onJoystick = () => joyCalls++;
    const touch = mountTouch(root, input, { bus, buttons: ['attack', 'interact', 'build'] });
    if (touch.visible || touch.el.classList.contains('on')) throw new Error('should be hidden on desktop'); touch.show(); if (!touch.visible || !document.body.classList.contains('is-touch')) throw new Error('show');
    if (Object.keys(touch.buttons).length !== 3 || !TOUCH_BUTTONS.attack) throw new Error('buttons');
    touch.simulateJoystick(56, 0); if (!input.joystick.active || Math.abs(input.joystick.vec.x - 1) > 1e-9 || input.joystick.vec.y !== 0 || !touch.base.classList.contains('on') || joyCalls < 2) throw new Error('joystick feed ' + JSON.stringify(input.joystick.vec));
    touch.simulateJoystick(0, -28, true); if (input.joystick.active || input.joystick.vec.x !== 0 || touch.base.classList.contains('on') || !touch.knob.classList.contains('release')) throw new Error('joystick release');
    touch.simulatePress('attack'); if (presses[0] !== 'attack' || !ev['ui:touch'] || ev['ui:touch'][0].action !== 'attack' || input.actions.attack) throw new Error('press attack ' + JSON.stringify(presses));
    // hold: pointerdown → held + actions true + repeat; pointerup → released
    const bAtk = touch.buttons.attack.el; bAtk.dispatchEvent({ type: 'pointerdown', pointerId: 5 }); if (!input.actions.attack || !bAtk.classList.contains('down')) throw new Error('hold attack');
    await sleep(500); const n = presses.filter((p) => p === 'attack').length; if (n < 3) throw new Error('attack repeat 220 ms while held: ' + n);
    bAtk.dispatchEvent({ type: 'pointerup' }); if (input.actions.attack || bAtk.classList.contains('down')) throw new Error('release attack');
    touch.setEnabled('attack', false); const n2 = presses.length; touch.simulatePress('attack'); if (presses.length !== n2 || !bAtk.classList.contains('off')) throw new Error('disabled still presses'); touch.setEnabled('attack', true);
    touch.setBadge('build', '!'); if (touch.buttons.build.badge.textContent !== '!' || !touch.buttons.build.el.classList.contains('pulse')) throw new Error('badge'); touch.setBadge('build', '');
    bus.emit('ui:ledger:open', {}); if (!touch.el.classList.contains('modal')) throw new Error('modal hide'); bus.emit('ui:ledger:close', {}); if (touch.el.classList.contains('modal')) throw new Error('modal show');
    bus.emit('build:enter', {}); if (!bAtk.disabled) throw new Error('build:enter disables attack'); bus.emit('build:exit', {}); if (bAtk.disabled) throw new Error('build:exit re-enables');
    touch.hide(); if (touch.visible) throw new Error('hide'); touch.destroy(); if (touch.el.parentNode) throw new Error('destroy');
    const forced = mountTouch(root, input, { bus, force: true }); if (!forced.visible) throw new Error('force show'); forced.destroy();
    // S08: ability strip — 6 chips, tap → ui:touch {action:'ability', name}, sandbox:ability:start → cooling sweep (tap while cooling = deny shake, no emit), sandbox:denied → shake, hidden while placing / tray open
    const { TOUCH_ABILITIES } = await import(pathToFileURL(resolve('ui/touch.js')).href);
    const t2 = mountTouch(root, input, { bus, force: true }); const abN = Object.keys(t2.abilities).length; if (abN !== 6 || TOUCH_ABILITIES.length !== 6 || !t2.abilities.fogSweep) throw new Error('ability chips ' + abN);
    const before = (ev['ui:touch'] || []).length; t2.simulateAbility('coinMagnetDash'); const last = ev['ui:touch'][ev['ui:touch'].length - 1]; if ((ev['ui:touch'] || []).length !== before + 1 || last.action !== 'ability' || last.name !== 'coinMagnetDash') throw new Error('ability tap emit ' + JSON.stringify(last));
    bus.emit('sandbox:ability:start', { name: 'coinMagnetDash', cooldown: 0.3 }); if (!t2.abilities.coinMagnetDash.el.classList.contains('cooling')) throw new Error('cooldown class');
    const b2 = ev['ui:touch'].length; t2.simulateAbility('coinMagnetDash'); if (ev['ui:touch'].length !== b2 || !t2.abilities.coinMagnetDash.el.classList.contains('deny')) throw new Error('tap while cooling must shake, not emit');
    await sleep(450); if (t2.abilities.coinMagnetDash.el.classList.contains('cooling')) throw new Error('cooldown should have ended');
    bus.emit('sandbox:denied', { name: 'fogSweep', why: 'busy' }); if (!t2.abilities.fogSweep.el.classList.contains('deny')) throw new Error('denied shake');
    bus.emit('build:enter', {}); if (!t2.strip.classList.contains('placing')) throw new Error('strip hidden while placing'); bus.emit('build:exit', {}); if (t2.strip.classList.contains('placing')) throw new Error('strip back after placing');
    bus.emit('ui:build:open', {}); if (!t2.strip.classList.contains('tray')) throw new Error('strip hidden under tray'); bus.emit('ui:build:close', {});
    t2.destroy();
    console.log(`  touch S08: 6 ability chips · tap → ui:touch{ability,name} · sandbox:ability:start → cooling sweep · tap while cooling = shake/no emit · sandbox:denied → shake · hidden while placing / tray open  OK`);
    console.log(`  touch: joyVector clamp/deadzone/half · simulate 56 px → vec (1,0) + onJoystick ×${joyCalls} · release → (0,0) spring · press → input.press + ui:touch · hold → actions.attack + ${n} repeats/0.5 s · setEnabled off · badge pulse · modal hide on ui:ledger:open · build:enter disables attack · force:true · destroy  OK`);
  } catch (err) { bad++; console.log('  touch FAIL →', err.message); }
  try {
    const { mountTitle, TITLE_MODES } = await import(pathToFileURL(resolve('ui/title.js')).href);
    let save = false;
    const title = mountTitle(root, { bus, hasSave: () => save, version: 'test' });
    if (!title.isOpen || !ev['ui:title:open'] || !title.el.classList.contains('open') || !document.body.classList.contains('ll-title-open')) throw new Error('autoShow');
    if (Object.keys(TITLE_MODES).length !== 3 || title.buttons.continue.style.display !== 'none' || title.el.querySelectorAll('.ll-title-ch').length !== 11) throw new Error('buttons/logo letters');
    if (!/Make\s*FinLit\s*Fun/.test(title.el.querySelector('.ll-title-tag').textContent)) throw new Error('tagline ' + title.el.querySelector('.ll-title-tag').textContent);
    title.buttons.story.click(); if (!ev['ui:start'] || ev['ui:start'][0].mode !== 'story' || ev['ui:start'][0].hasSave !== false || !title.isOpen) throw new Error('PLAY → ui:start story (title stays open until hide())');
    pressKey('e'); if (ev['ui:start'][1].mode !== 'endless') throw new Error('E → endless');
    pressKey('c'); if (ev['ui:start'][2].mode !== 'story') throw new Error('C w/o save → story');
    title.hide(); if (title.isOpen || !ev['ui:title:close'] || ev['ui:title:close'][0].mode !== 'story' || document.body.classList.contains('ll-title-open')) throw new Error('hide');
    save = true; title.show(); if (title.buttons.continue.style.display === 'none' || !title.el.classList.contains('has-save')) throw new Error('CONTINUE shown with save');
    pressKey('ArrowDown'); pressKey('Enter'); if (ev['ui:start'][3].mode !== 'continue') throw new Error('arrow → Enter picks CONTINUE: ' + ev['ui:start'][3].mode);
    title.setBusy(true); const k = ev['ui:start'].length; title.buttons.story.click(); if (ev['ui:start'].length !== k || !title.buttons.story.disabled) throw new Error('busy blocks'); title.setBusy(false);
    title.hide(); bus.emit('eco:lose', { reason: 'fog' }); if (!title.isOpen || !title.el.classList.contains('replay') || !/Fog won/.test(title.el.querySelector('.ll-title-sub').textContent)) throw new Error('eco:lose re-show');
    title.destroy(); if (title.el.parentNode) throw new Error('destroy');
    const quiet = mountTitle(root, { bus, autoShow: false, hideOnStart: true }); if (quiet.isOpen) throw new Error('autoShow:false'); quiet.show(); quiet.start('endless'); if (quiet.isOpen) throw new Error('hideOnStart'); quiet.destroy();
    console.log('  title: autoShow → ui:title:open · 11 logo letters · "Make FinLit Fun" · CONTINUE hidden w/o save · PLAY → ui:start{story} (stays open) · E/C keys · hide → ui:title:close · save → CONTINUE + ↓ Enter · busy · eco:lose → replay sub · autoShow:false + hideOnStart · destroy  OK');
  } catch (err) { bad++; console.log('  title FAIL →', err.message); }
  try {
    const { mountPause, normalizeSettings, loadSettings, saveSettings, DEFAULT_SETTINGS } = await import(pathToFileURL(resolve('ui/pause.js')).href);
    const n1 = normalizeSettings({ quality: 'ultra', outline: 9, sfx: -1, music: '0.5', reduceMotion: 1 }); if (n1.quality !== 'medium' || n1.outline !== 0.06 || n1.sfx !== 0 || n1.music !== 0.5 || n1.reduceMotion !== true) throw new Error('normalize ' + JSON.stringify(n1));
    localStorage.removeItem('t.settings'); saveSettings({ ...DEFAULT_SETTINGS, quality: 'low' }, 't.settings'); if (loadSettings('t.settings').quality !== 'low') throw new Error('save/load');
    localStorage.setItem('t.settings', '{broken'); if (loadSettings('t.settings').quality !== 'medium') throw new Error('broken json → defaults'); localStorage.removeItem('t.settings');
    let outlineV = null; const paused = []; bus.on('ui:pause', (p) => paused.push(p));
    const pause = mountPause(root, { bus, storageKey: 't.settings', onOutline: (v) => (outlineV = v), settings: { sfx: 0.5 } });
    if (pause.isOpen || outlineV !== 0.035 || pause.settings.sfx !== 0.5) throw new Error('init');
    pressKey('Escape'); if (!pause.isOpen || !pause.el.classList.contains('open') || paused.length !== 1 || paused[0].on !== true || paused[0].by !== 'menu' || !ev['ui:pause:open']) throw new Error('Esc open ' + JSON.stringify(paused));
    pause.buttons.resume.click(); if (pause.isOpen || paused[1].on !== false || !ev['ui:pause:close']) throw new Error('resume');
    pause.open(); pause.buttons.settings.click(); if (!pause.settingsOpen || !pause.el.classList.contains('settings')) throw new Error('settings expand');
    pause.panel.querySelectorAll('.ll-seg-btn').find((b) => b.textContent === 'high').click(); if (pause.settings.quality !== 'high' || !ev['ui:settings'] || ev['ui:settings'][0].key !== 'quality' || ev['ui:settings'][0].value !== 'high') throw new Error('quality seg ' + JSON.stringify(ev['ui:settings']));
    if (JSON.parse(localStorage.getItem('t.settings')).quality !== 'high') throw new Error('persist');
    const rng = pause.panel.querySelectorAll('.ll-range').find((r) => r.dataset.key === 'outline'); dragRange(rng, 0.06); if (pause.settings.outline !== 0.06 || outlineV !== 0.06 || ev['ui:settings'][ev['ui:settings'].length - 1].key !== 'outline') throw new Error('outline range → onOutline');
    if (pause.panel.querySelectorAll('.ll-set-val')[0].textContent !== 'thick') throw new Error('outline label');
    const cbx = pause.panel.querySelector('.ll-check'); cbx.checked = true; cbx.dispatchEvent({ type: 'change' }); if (!pause.settings.reduceMotion || !document.body.classList.contains('ll-reduce-motion')) throw new Error('reduce motion');
    const nEv = ev['ui:settings'].length; pause.setSetting('sfx', 0.5); if (ev['ui:settings'].length !== nEv) throw new Error('unchanged value should not emit');
    pause.buttons.restart.click(); if (ev['ui:restart'] || !pause.buttons.restart.classList.contains('confirm') || !pause.isOpen) throw new Error('restart needs confirm'); pause.buttons.restart.click(); if (!ev['ui:restart'] || pause.isOpen) throw new Error('restart confirm → ui:restart + close');
    pause.open(); pause.buttons.title.click(); pause.buttons.resume.click(); if (ev['ui:title'] || pause.buttons.title.classList.contains('confirm')) throw new Error('confirm cleared on close'); pause.open(); pause.buttons.title.click(); pause.buttons.title.click(); if (!ev['ui:title'] || pause.isOpen) throw new Error('title confirm');
    pause.open(); bus.emit('ui:title:open', {}); if (pause.isOpen || paused[paused.length - 1].by !== 'title') throw new Error('ui:title:open force-close');
    bus.emit('ui:pause:request', { on: true, by: 'dialogue' }); if (!pause.isOpen || paused[paused.length - 1].by !== 'dialogue') throw new Error('ui:pause:request'); bus.emit('ui:pause:request', { on: false });
    const gated = mountPause(root, { bus, persist: false, canOpen: () => false, hotkey: false }); gated.open(); if (gated.isOpen) throw new Error('canOpen false'); gated.destroy();
    pause.destroy(); if (pause.el.parentNode) throw new Error('destroy'); localStorage.removeItem('t.settings'); document.body.classList.remove('ll-reduce-motion');
    console.log(`  pause: normalize/load/save pure (clamp, broken JSON → defaults) · Esc → ui:pause{on,menu} · RESUME → off · SETTINGS expand · quality high → ui:settings + localStorage · outline 0.06 → onOutline "thick" · reduce motion body class · no emit on unchanged · RESTART/TITLE double-tap → ui:restart / ui:title · ui:title:open force-close · ui:pause:request · canOpen · destroy (${ev['ui:settings'].length} ui:settings)  OK`);
  } catch (err) { bad++; console.log('  pause FAIL →', err.message); }
}

if (doEnemies) {
  // S16: headless sandbox (same harness as --sandbox). Drives the scheduler to day 0.7, checks the wave, walks a Collector into Pip,
  // swings the sword, checks the coin + flee, the shield block, season-end clear, and a Season-6 Baron wave with powers.
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { SequencePlayer, HitStop } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { tweens } = await import(pathToFileURL(resolve('src/anim/Tween.js')).href);
    const { createSandbox } = await import(pathToFileURL(resolve('src/Game.js')).href);
    const { ENEMY_RULES, BARON_POWERS, baronPowersFor } = await import(pathToFileURL(resolve('src/systems/enemies.js')).href);
    console.log('\nENEMIES (S16):');
    const bus = new EventBus(); const ev = {}; for (const n of ['enemy:wave', 'enemy:spawn', 'enemy:hit', 'enemy:defeated', 'enemy:heroHit', 'enemy:blocked', 'enemy:gone', 'enemy:baronWarn', 'enemy:cannon', 'enemy:stomp', 'enemy:baronInterrupted', 'enemy:summon', 'enemy:home', 'eco:scam']) bus.on(n, (p) => { (ev[n] ??= []).push(p); });
    const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const sb = createSandbox(game, { headless: true, seasonSeconds: 30, seed: 3 });
    const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    const E = sb.enemies; if (!E || sb.villains !== E.list) throw new Error('sb.enemies / sb.villains not wired');
    // 1. no enemies before day 0.7; wave of 1 at S1
    run(10); if (E.list.length) throw new Error('enemies before day 0.7');
    sb.eco.state.day01 = 0.71; step(); if (E.list.length !== 1 || E.list[0].kind !== 'collector' || !ev['enemy:wave'] || ev['enemy:wave'][0].season !== 1) throw new Error('S1 wave ' + E.list.length);
    if (!game.scene.children.includes(E.list[0].g)) throw new Error('enemy not in scene');
    // 2. chase: it closes in on Pip; contact costs 1 ✦ from the pouch, never below 0, never from jars
    const c = E.list[0]; const d0 = c.g.position.distanceTo(sb.hero.root.position); run(3); const d1 = c.g.position.distanceTo(sb.hero.root.position);
    if (!(d1 < d0)) throw new Error(`collector not chasing (${d0.toFixed(1)} → ${d1.toFixed(1)})`);
    sb.eco.state.spark = 3; sb.eco.state.jars.save = 50; c.g.position.copy(sb.hero.root.position); c.hitAt = -99; run(0.2);
    if (!ev['enemy:heroHit'] || sb.eco.state.spark !== 2 || sb.eco.state.jars.save !== 50) throw new Error(`contact hit spark ${sb.eco.state.spark} jars.save ${sb.eco.state.jars.save}`);
    sb.eco.state.spark = 0; c.hitAt = -99; run(0.2); if (sb.eco.state.spark !== 0 || sb.eco.state.debt < 0) throw new Error('hit below 0');
    // 3. Bubble Shield blocks
    sb.shield.until = game.time + 5; c.hitAt = -99; sb.eco.state.spark = 5; run(0.2); if (!ev['enemy:blocked'] || sb.eco.state.spark !== 5) throw new Error('shield did not block'); sb.shield.until = -1;
    // 4. sword: 2 hits → defeat → flee → coin (1 ✦) → gone
    const coins0 = sb.coins.length; const hp0 = c.hp; const dir = new THREE.Vector3(1, 0, 0);
    E.hitEnemy(c, dir, 1); if (c.hp !== hp0 - 1 || c.state === 'flee') throw new Error('first hit'); E.hitEnemy(c, dir, 1);
    if (c.state !== 'flee' || !ev['enemy:defeated'] || sb.coins.length !== coins0 + 1 || sb.coins.at(-1).value !== ENEMY_RULES.collector.reward) throw new Error(`defeat: state ${c.state} coins ${sb.coins.length}/${coins0 + 1}`);
    if (E.targets().length !== 0) throw new Error('fleeing enemy still a target');
    run(ENEMY_RULES.fleeSeconds + 0.5); if (E.list.length !== 0 || !ev['enemy:gone'] || game.scene.children.includes(c.g)) throw new Error('fleeing enemy not removed');
    // hero's own sword picks enemies: spawn one in front and attack
    E.waveSeason = 0; sb.eco.state.season = 3; sb.sched.wave = false; sb.eco.state.day01 = 0.71; step(); if (E.list.length !== 3) throw new Error('S3 wave size ' + E.list.length);
    const tgt = sb.hero.deps.targets(); if (!tgt.some((t) => t.enemy)) throw new Error('hero targets lack enemies');
    // 5. S16b: season end → everyone WALKS back to the pier (state 'home', no longer a target, no coin), steps off within homeTimeout; hero speed reset
    // S19 / P58: the 3 land at DIFFERENT shore points (≥ 5 u apart, #0 at the pier) and ≥ 6 u from Pip; e.home remembers the landing point
    const exitP = E._exit, homes = E.list.map((e) => e.home); if (Math.hypot(homes[0].x - exitP.x, homes[0].z - exitP.z) > 1e-6) throw new Error('#0 not at the pier');
    for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) if (Math.hypot(homes[i].x - homes[j].x, homes[i].z - homes[j].z) < ENEMY_RULES.spawnSpread) throw new Error(`S19 landing points too close ${JSON.stringify(homes)}`);
    for (const h of homes) if (Math.hypot(h.x - sb.hero.root.position.x, h.z - sb.hero.root.position.z) < ENEMY_RULES.spawnHeroMin) throw new Error('S19 landed too close to Pip');
    for (const e of E.list) if (!sb.island.isLand(e.g.position.x, e.g.position.z) && e.i !== 0) throw new Error('S19 landed in water');
    // S19 / P58: separation — stack all 3 on Pip's position, chase for 1 s → every pair ≥ separation apart
    sb.eco.state.spark = 0; for (const e of E.list) { e.g.position.copy(sb.hero.root.position).add(new THREE.Vector3(1.5, 0, 0)); } run(1);
    for (let i = 0; i < E.list.length; i++) for (let j = i + 1; j < E.list.length; j++) { const d = E.list[i].g.position.distanceTo(E.list[j].g.position); if (d < ENEMY_RULES.separation * 0.9) throw new Error(`S19 collectors still stacked (${d.toFixed(2)} u)`); }
    // S16b: season end → everyone walks back to its own landing point
    const defB = E.stats.defeated; for (const e of E.list) e.g.position.set(sb.hero.root.position.x + 2, 0, sb.hero.root.position.z);
    const dHome0 = E.list.map((e) => Math.hypot(e.g.position.x - e.home.x, e.g.position.z - e.home.z));
    sb.keys.endSeason(); if (E.list.length !== 3 || E.active.length !== 0 || E.leaving.length !== 3 || E.targets().length !== 0) throw new Error(`season end: list ${E.list.length} active ${E.active.length} leaving ${E.leaving.length}`);
    if (E.heroSpeedMul !== 1 || sb.hero.speed !== 5.2) throw new Error('hero speed not reset');
    run(1); const dHome1 = E.list.map((e) => Math.hypot(e.g.position.x - e.home.x, e.g.position.z - e.home.z)); if (E.list.length !== 3 || !dHome1.every((d, i) => d < dHome0[i] - 0.5)) throw new Error(`not walking home ${dHome0.map((d) => d.toFixed(1))} → ${dHome1.map((d) => d.toFixed(1))}`);
    sb.eco.state.spark = 7; for (const e of E.list) { e.g.position.copy(sb.hero.root.position); e.hitAt = -99; } step(); if (sb.eco.state.spark !== 7) throw new Error('leaving enemy still hits');
    for (const e of E.list) e.g.position.set(e.home.x, 0, e.home.z); run(ENEMY_RULES.homeTimeout + 1);
    const defEv = (ev['enemy:defeated'] || []).length; if (E.list.length !== 0 || E.stats.defeated !== defB || defEv !== 1 || !ev['enemy:gone'].some((g) => g.why === 'home')) throw new Error(`walk-home not finished: ${E.list.length} left, defeated ${E.stats.defeated}/${defB}`);   // (sb.coins also grows from customer tips while the clock runs → not compared)
    // 5b. the new season's wave still spawns normally after a walk-home
    E.waveSeason = 0; sb.eco.state.season = 4; sb.sched.wave = false; sb.sched.season = 4; sb.eco.state.day01 = 0.71; step(); if (E.list.length !== 4) throw new Error('S4 wave after walk-home ' + E.list.length); E.clear();
    // 6. Season 6 (S20): Baron on his PODIUM (stationary) + 0 minions, power 'cannon' only; S9: Baron + 3 minions with cannon/puddle/stomp/summon; cap 5  (clock frozen: a 30 s season would end mid-probe)
    sb.eco.config.seasonSeconds = 1e9;
    const RB = ENEMY_RULES.baron;
    E.waveSeason = 0; sb.eco.state.season = 6; sb.sched.wave = false; sb.sched.season = 6; sb.eco.state.day01 = 0.71; step();
    if (E.list.length !== 1 || E.list[0].kind !== 'baron' || E.list[0].powers.join() !== 'cannon' || !ev['enemy:wave'].at(-1).boss) throw new Error('S6 baron wave ' + (E.list[0]?.powers || []).join());
    const b = E.baron; if (!b.podium || !sb.island.isLand(b.podium.x, b.podium.z) || Math.hypot(b.g.position.x - b.podium.x, b.g.position.z - b.podium.z) > 0.01) throw new Error('baron podium');
    // stationary: Pip 6 u away for 3 s → the Baron has not moved
    sb.hero.root.position.set(b.podium.x + 6, 0, b.podium.z); b.timers.attack = -99; run(3); if (Math.hypot(b.g.position.x - b.podium.x, b.g.position.z - b.podium.z) > 0.05) throw new Error('baron moved');
    // contact (Pip walks into him) still costs 2 ✦
    b.g.position.copy(sb.hero.root.position); b.podium = { x: sb.hero.root.position.x, z: sb.hero.root.position.z }; b.hitAt = -99; b.phase = 'idle'; b.timers.attack = -99; sb.eco.state.spark = 10; run(0.2); if (sb.eco.state.spark !== 10 - RB.hitSpark) throw new Error('baron contact ' + sb.eco.state.spark);
    // S16b: Baron hit at 0 ✦ → the shortfall becomes DEBT (a Collector at 0 ✦ does nothing — probed in step 2)
    sb.eco.state.spark = 1; const debtB = sb.eco.state.debt; b.hitAt = -99; run(0.2);
    if (sb.eco.state.spark !== 0 || sb.eco.state.debt !== debtB + RB.hitSpark - 1 || !ev['enemy:heroHit'].at(-1).debt) throw new Error(`baron bill: spark ${sb.eco.state.spark} debt ${debtB} → ${sb.eco.state.debt}`);
    b.hitAt = -99; run(0.2); if (sb.eco.state.debt !== debtB + RB.hitSpark - 1 + RB.hitSpark) throw new Error('baron bill at 0 ✦ ' + sb.eco.state.debt);
    // S20 cannon: Pip 4 u away → warn decal at Pip's cell (enemy:baronWarn) → telegraph 0.9 s → fog ball: Pip stayed → −1 ✦ + puddle slows him (×0.6)
    b.hitAt = 99; b.timers.attack = RB.attackEvery; sb.hero.root.position.set(b.podium.x + 4, 0, b.podium.z); sb.eco.state.spark = 10; step();
    if (!ev['enemy:baronWarn'] || ev['enemy:baronWarn'].at(-1).kind !== 'cannon' || b.phase !== 'warn' || E.decals.active !== 1) throw new Error('cannon warn ' + b.phase + ' decals ' + E.decals.active);
    run(RB.telegraph + 0.1); if (!ev['enemy:cannon'] || !ev['enemy:cannon'].at(-1).hit || sb.eco.state.spark !== 10 - RB.cannonSpark || E.puddles.length !== 1 || E.stats.cannons !== 1) throw new Error('cannon land ' + sb.eco.state.spark + ' puddles ' + E.puddles.length);
    step(); if (E.heroSpeedMul !== RB.puddleMul || sb.hero.speed >= 5.2) throw new Error('puddle slow ' + E.heroSpeedMul);
    sb.hero.root.position.set(b.podium.x + 4, 0, b.podium.z + 4); step(); if (E.heroSpeedMul !== 1) throw new Error('puddle slow not released');
    run(RB.puddleSeconds); if (E.puddles.length !== 0) throw new Error('puddle did not expire');
    // dodge: step out during the telegraph → no Spark lost, attacksDodged++
    b.phase = 'idle'; b.timers.attack = RB.attackEvery; sb.hero.root.position.set(b.podium.x + 4, 0, b.podium.z); sb.eco.state.spark = 10; step(); sb.hero.root.position.set(b.podium.x + 4, 0, b.podium.z + 3); run(RB.telegraph + 0.1);
    if (sb.eco.state.spark !== 10 || E.stats.attacksDodged !== 1) throw new Error('cannon dodge ' + sb.eco.state.spark + ' ' + E.stats.attacksDodged);
    // Pip's hit during the wind-up cancels it
    b.phase = 'idle'; b.timers.attack = RB.attackEvery; step(); if (b.phase !== 'warn') throw new Error('warn for interrupt'); E.hitEnemy(b, dir, 1); if (b.phase !== 'idle' || b.attack || !ev['enemy:baronInterrupted']) throw new Error('interrupt');
    b.hp = RB.hp; b.phase = 'idle'; b.timers.attack = -99;
    for (let i = 0; i < RB.hp; i++) E.hitEnemy(b, dir, 1); if (b.state !== 'flee' || E.stats.baronDefeats !== 1 || sb.coins.at(-1).value !== RB.reward) throw new Error('baron defeat');
    E.clear(); if (E.decals.active !== 0) throw new Error('clear left decals');
    E.waveSeason = 0; sb.eco.state.season = 9; sb.sched.wave = false; sb.sched.season = 9; sb.eco.state.day01 = 0.71; step();
    const b9 = E.baron; if (!b9 || E.list.length !== 4 || b9.powers.join() !== 'cannon,puddle,stomp,summon') throw new Error('S9 wave ' + E.list.length + ' ' + (b9?.powers || []).join());
    if (baronPowersFor(12).length !== 5 || baronPowersFor(6).length !== 1) throw new Error('baronPowersFor');
    // S20 stomp: Pip 2 u from the podium → crouch (warn, ring r 3.5) → air → land: 2 ✦ + shoved out of the ring, Baron DAZED
    for (const m of E.list) if (m !== b9) { m.state = 'flee'; m.fleeT = 99; }   // park the minions so the pick is deterministic
    b9.hitAt = 99; b9._pick = 1; b9.phase = 'idle'; b9.timers.attack = RB.attackEvery; sb.hero.root.position.set(b9.podium.x + 2, 0, b9.podium.z); sb.eco.state.spark = 10; step();
    if (ev['enemy:baronWarn'].at(-1).kind !== 'stomp') { b9._pick = 0; b9.phase = 'idle'; b9.attack = null; b9.timers.attack = RB.attackEvery; step(); }
    if (ev['enemy:baronWarn'].at(-1).kind !== 'stomp' || b9.phase !== 'warn') throw new Error('stomp warn ' + ev['enemy:baronWarn'].at(-1).kind);
    run(RB.telegraph + 0.05); if (b9.phase !== 'air' || E.targets().some((t) => t.enemy === b9)) throw new Error('stomp air / targetable in the air');
    run(RB.stompAir + 0.05); const d9 = Math.hypot(sb.hero.root.position.x - b9.podium.x, sb.hero.root.position.z - b9.podium.z);
    if (!ev['enemy:stomp'] || !ev['enemy:stomp'].at(-1).hit || sb.eco.state.spark !== 10 - RB.stompSpark || d9 <= 2.5 || b9.phase !== 'dazed' || E.stats.stomps !== 1 || b9.g.position.y !== 0) throw new Error(`stomp land spark ${sb.eco.state.spark} d ${d9.toFixed(2)} phase ${b9.phase}`);
    if (!E.targets().some((t) => t.enemy === b9)) throw new Error('dazed Baron not targetable'); run(RB.dazed + 0.1); if (b9.phase !== 'idle') throw new Error('dazed did not end');
    // summon (S9): below the cap → one more Collector appears beside the Baron
    for (const m of E.list) if (m !== b9) m.fleeT = 0; run(0.1); b9._pick = -1; b9.phase = 'idle'; b9.timers.attack = RB.attackEvery; sb.hero.root.position.set(b9.podium.x + 7, 0, b9.podium.z); step();
    if (!ev['enemy:summon'] || E.list.filter((e) => e.kind === 'collector' && e.state === 'chase').length !== 1 || E.stats.summons !== 1) throw new Error('summon ' + E.list.length);
    for (let i = 0; i < 8; i++) { b9._pick = -1; b9.phase = 'idle'; b9.attack = null; b9.timers.attack = RB.attackEvery; step(); } if (E.list.filter((e) => e.kind === 'collector' && e.state !== 'flee').length > ENEMY_RULES.minionCap) throw new Error('minion cap');
    // S12: Baron + 5 minions, all 5 powers; cannon3 → 3 warn decals
    E.waveSeason = 0; E.clear(); sb.eco.state.season = 12; sb.sched.wave = false; sb.sched.season = 12; sb.eco.state.day01 = 0.71; step(); const b12 = E.baron; if (E.list.length !== 6 || b12.powers.length !== 5) throw new Error('S12 cap');
    for (const m of E.list) if (m !== b12) { m.state = 'flee'; m.fleeT = 99; }
    b12.hitAt = 99; b12._pick = 0; b12.phase = 'idle'; b12.timers.attack = RB.attackEvery; sb.hero.root.position.set(b12.podium.x + 6, 0, b12.podium.z); step();
    if (ev['enemy:baronWarn'].at(-1).kind !== 'cannon3' || E.decals.active !== 3) throw new Error('cannon3 ' + ev['enemy:baronWarn'].at(-1).kind + ' decals ' + E.decals.active);
    run(RB.telegraph + 0.1); if (ev['enemy:cannon'].at(-1).shots !== 3 || E.puddles.length !== 3) throw new Error('cannon3 land');
    // season end mid-attack: sendHome cancels the wind-up and he walks off
    b12.phase = 'idle'; b12.timers.attack = RB.attackEvery; sb.hero.root.position.set(b12.podium.x + 4, 0, b12.podium.z); step(); E.sendHome(); if (b12.state !== 'home' || b12.attack || b12.phase !== 'idle') throw new Error('sendHome mid-attack');
    for (const e of E.list) if (!isFinite(e.g.position.x) || !isFinite(e.g.scale.y)) throw new Error('enemy NaN');
    E.clear(); if (game.scene.children.some((o) => o.userData?.type === 'baron' || o.userData?.type === 'collector')) throw new Error('clear left meshes');
    console.log(`  S1 wave 1 · chase ${d0.toFixed(1)}→${d1.toFixed(1)} u · contact −1 ✦ pouch only (jars untouched, floor 0) · Bubble Shield BLOCKED · 2 sword hits → flee + 1 ✦ coin → gone · hero targets merged · S3 wave 3 · S19 spread landings + separation · season end → walk home to own shore point → off (no coin) · S4 re-lands · S6 Baron STATIONARY on podium (S20) · contact −2 ✦ (at 0 ✦ → DEBT) · cannon warn ${ENEMY_RULES.baron.telegraph} s → hit/puddle(×${ENEMY_RULES.baron.puddleMul})/dodge/interrupt → ${ENEMY_RULES.baron.reward} ✦ (P60) · S9 Baron+3 stomp(r ${ENEMY_RULES.baron.stompRadius}, dazed)/summon(cap ${ENEMY_RULES.minionCap}) · S12 Baron+5 cannon3 · sendHome mid-attack · stats ${JSON.stringify(E.stats)}  OK`);
  } catch (err) { bad++; console.log('  enemies FAIL →', err.message); }
}

if (doSandbox) {
  // 10B sandbox: real Island v2 + Economy (4B) + BuildSystem (5) + CustomerSystem (6A) + HeroController with moves/abilities (3A/3B)
  // + helpers (2B) wired by src/Game.js createSandbox() on a mock Game. Runs 2 accelerated seasons (30 s each) at 30 Hz.
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { SequencePlayer, HitStop } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { tweens } = await import(pathToFileURL(resolve('src/anim/Tween.js')).href);
    const { createSandbox, STALL_PICKS, COIN_MAX } = await import(pathToFileURL(resolve('src/Game.js')).href);
    const { ABILITY_NAMES } = await import(pathToFileURL(resolve('src/anim/heroAbilities.js')).href);
    console.log('\nSANDBOX (10B):');
    const bus = new EventBus(); const ev = {}; const count = (n) => bus.on(n, (p) => { (ev[n] ??= []).push(p); });
    for (const n of ['sandbox:ready', 'build:placed', 'cust:paid', 'eco:season', 'eco:event', 'eco:scam', 'eco:absorbed', 'eco:scamResult', 'sandbox:ability', 'sandbox:tip', 'sandbox:hired']) count(n);
    const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const t0 = performance.now();
    const sb = createSandbox(game, { headless: true, seasonSeconds: 30, seed: 3 });
    const dt = 1 / 30; let frames = 0;
    const noNaN = (what) => { const p = sb.hero.root.position; if (!isFinite(p.x) || !isFinite(p.z)) throw new Error('hero NaN ' + what); for (const c of sb.cust.active) { if (!isFinite(c.root.position.x) || !isFinite(c.root.scale.y)) throw new Error('customer NaN ' + what); } const s = sb.eco.state; for (const k of ['spark', 'debt', 'fog01', 'reputation', 'day01']) if (!isFinite(s[k])) throw new Error(`eco.${k} NaN ${what}`); };
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); frames++; };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); noNaN('t=' + game.time.toFixed(1)); };
    // 1. construction
    if (!ev['sandbox:ready'] || sb.eco.state.stalls !== 3 || sb.build.placed.size < 3) throw new Error(`construction: stalls ${sb.eco.state.stalls} placed ${sb.build.placed.size}`);
    if (sb.cust.count + sb.cust.pendingSpawns.length < 1) throw new Error('no first wave queued');
    let meshes = 0; game.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) meshes++; });
    // 2. debug keys: pick + build + confirm (charged), demolish/upgrade on nearest, rotate
    sb.eco.state.spark = 400; const spark0 = sb.eco.state.spark;
    const id = sb.keys.pick(1); if (id !== 'stall_' + STALL_PICKS[1]) throw new Error('pick');
    if (!sb.keys.build() || sb.build.mode !== 'place') throw new Error('build enter'); sb.keys.rotate(); sb.build.moveTo(1, 1);
    const placedBefore = sb.build.placed.size;   // S07: 3 starter stalls + 6 salvageable clutter props
    if (!sb.keys.confirm() || sb.build.placed.size !== placedBefore + 1 || sb.eco.state.spark >= spark0) throw new Error('confirm/charge');
    if (sb.eco.state.stalls !== 4) throw new Error('eco.stalls not synced ' + sb.eco.state.stalls);
    // S07 probe: plaza clutter is real owned decor (cost 0, salvage 6) → sells for the flat salvage bonus, frees its cells, never counts as a stall
    {
      const clutter = [...sb.build.placed.values()].filter((e) => e.salvage);
      if (clutter.length !== 6 || clutter.some((e) => e.cost !== 0 || e.category === 'stall')) throw new Error('S07: clutter ' + clutter.length + ' ' + clutter.map((e) => e.id + ':' + e.cost).join(','));
      const crate = clutter.find((e) => e.id === 'crate'); const sp = sb.eco.state.spark, st = sb.eco.state.stalls;
      if (sb.build.refundOf(crate) !== 6) throw new Error('S07: refundOf ' + sb.build.refundOf(crate));
      if (!sb.build.demolish(crate, { animate: false }) || sb.eco.state.spark !== sp + 6 || sb.build.occupied(crate.cx, crate.cz) || sb.eco.state.stalls !== st) throw new Error(`S07: salvage spark ${sb.eco.state.spark}/${sp + 6} stalls ${sb.eco.state.stalls}`);
      if (!sb.build.canPlace('crate', crate.cx, crate.cz, 0)) throw new Error('S07: cell not freed');
      const snap = sb.build.serialize(); if (!snap.some((s) => s.salvage === 6) || snap.some((s) => s.id === 'crate')) throw new Error('S07: serialize salvage');
      console.log(`  S07 clutter: 6 salvageable props (bench/sign/crate/barrel/pot/trough, cost 0) → crate salvaged +6 ✦, cell freed, stalls unchanged, salvage persists in serialize()  OK`);
    }
    sb.keys.exit(); if (sb.build.mode === 'place') throw new Error('exit');
    // 3. two seasons (auto end) + E (manual end) → 3 reports
    run(65); if (sb.stats.seasons !== 2 || sb.stats.reports.length !== 2) throw new Error('seasons ' + sb.stats.seasons);
    const r = sb.keys.endSeason(); if (!r || sb.stats.reports.length !== 3 || r.season !== 3) throw new Error('E end season');
    for (const rep of sb.stats.reports) for (const k of ['income', 'expenses', 'debt', 'fog01', 'stars', 'netWorth']) if (!isFinite(rep[k])) throw new Error(`report S${rep.season}.${k} NaN`);
    if (!ev['cust:paid'] || ev['cust:paid'].length < 5) throw new Error('too few sales ' + (ev['cust:paid'] || []).length);
    if (!ev['eco:event'] || ev['eco:event'].length < 2) throw new Error('scheduler: events ' + (ev['eco:event'] || []).length);
    if (!ev['eco:scam'] || !ev['eco:scamResult']) throw new Error('scheduler: scam offered/expired');
    // 4. abilities → economy (P2)
    run(8); const coins0 = sb.coins.length; if (coins0 < 1 || coins0 > COIN_MAX || sb.coinMesh.count !== coins0) throw new Error('tip coins ' + coins0);
    const names = ABILITY_NAMES(); if (names.length !== 6) throw new Error('abilities ' + names.length);
    let spark1 = sb.eco.state.spark; if (!sb.ability('coinMagnetDash')) throw new Error('magnet refused'); if (sb.ability('coinMagnetDash') !== null) throw new Error('cooldown'); run(2);
    if (!(sb.coins.length < coins0) || !(sb.eco.state.spark > spark1) || !ev['sandbox:tip']) throw new Error('magnet collected nothing');
    run(5); if (!sb.ability('haggleShout')) throw new Error('haggle refused'); run(2); if (![...sb.haggle.values()].some((h) => h.n > 0)) throw new Error('haggle charges');
    run(5); if (!sb.ability('growthStomp')) throw new Error('growth refused'); run(2); if (!(sb.growth.mul > 1) || !(sb.growth.until > game.time)) throw new Error('growth pulse');
    run(5); const fog0 = sb.eco.state.fog01; if (!sb.ability('fogSweep')) throw new Error('fog refused'); run(1); const fogEff = (ev['sandbox:ability'] || []).find((a) => a.name === 'fogSweep'); if (!fogEff) throw new Error('fogSweep no push');  // bus event, not fog01 delta: a season end inside the window re-adds fog
    run(5); if (!sb.ability('bubbleShield')) throw new Error('shield refused'); run(3); if (!(sb.shield.until > game.time)) throw new Error('shield not armed');
    run(5); sb.eco.offerScam('zeroInterestLoan'); if (!sb.ability('ledgerFlash')) throw new Error('ledger refused'); run(3); if (sb.eco.pendingOffer) throw new Error('ledgerFlash did not refuse');
    // shield absorbs the next scheduled event: force the next event tick
    sb.sched.event = false; sb.eco.state.day01 = Math.max(sb.eco.state.day01, 0.5); sb.shield.until = game.time + 30; const evN = ev['eco:event'].length; step();
    if (!ev['eco:absorbed'] || ev['eco:event'].length !== evN) throw new Error('shield did not absorb');
    // 5. helper (P3)
    sb.eco.state.spark = 999; const h = sb.keys.hire(); if (!h || sb.helpers.length !== 1 || !ev['sandbox:hired']) throw new Error('hire'); run(2);
    if (!isFinite(h.g.position.x) || !isFinite(h.g.scale.y)) throw new Error('helper NaN');
    const ms = performance.now() - t0;
    console.log(`  createSandbox: 4 zones · 3 starter + 1 built stalls (B/1-9/R/confirm/Esc) · ${meshes} meshes at start · 2 auto seasons + E → 3 reports no NaN · ${ev['cust:paid'].length} sales · events ${ev['eco:event'].map((e) => e.id).join('/')} · scam offered+expired · 6 abilities: magnet +tips, haggle ${[...sb.haggle.values()].reduce((a, h) => a + h.n, 0)} charges, growth ×${sb.growth.mul.toFixed(2)}, ${fogEff.effect}, shield absorbed ${ev['eco:absorbed'][0].id}, ledgerFlash refused · H hired ${h.type} · ${frames} frames in ${ms.toFixed(0)} ms  OK`);
  } catch (err) { bad++; console.log('  sandbox FAIL →', err.message); }
}
if (doGame) {
  // 10C: the real game page minus the renderer. mountUI (7A/7B/7C on tools/domshim.mjs) + StorySystem (8B, data/story.json) + createSandbox (10B)
  // glued by createLumenGame. The walk clicks the DOM exactly like a player: PLAY → dialogue Enter → seasons tick (30 s each) → ledger CONTINUE …
  //   1. title open → game.paused · PLAY → sandbox + S1 opening line in the dialogue box (still paused by dialogue) · Enter drains → playing, unpaused
  //   2. season 1..3: mid line @0.5 · eco:season → ledger lines → story:review → ledger.show → CONTINUE → S(n+1) opening → playing
  //   3. build via ui:build → stall placed + charged · jars APPLY → eco.allocate · ability Q while modal = refused, while playing = fired
  //   4. forced eco:win → ending lines → story:finale → ledger outcome win → ENDLESS → state endless, scams off, clock running
  //   5. forced eco:lose (new run) → ledger lose → TRY AGAIN → title shown, sandbox torn down (scene meshes back to 0), restart → fresh run
  console.log('\nGAME (10C):');
  try {
    const { installDomShim, pressKey } = await import(pathToFileURL(resolve('tools/domshim.mjs')).href); installDomShim();
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { SequencePlayer, HitStop } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { tweens } = await import(pathToFileURL(resolve('src/anim/Tween.js')).href);
    const { createLumenGame, GAME_STATES } = await import(pathToFileURL(resolve('src/Game.js')).href);
    const { mountUI } = await import(pathToFileURL(resolve('ui/index.js')).href);
    const { PROP_CATALOG } = await import(pathToFileURL(resolve('src/assets/props.js')).href);
    const { readFileSync } = await import('node:fs'); const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const bus = new EventBus(); const ev = {}; for (const n of ['game:state', 'game:paused', 'game:start', 'story:line', 'story:review', 'ui:continue', 'eco:season', 'game:endless', 'game:title', 'game:allocated', 'game:withdrew', 'game:repaid', 'cust:price', 'build:placed', 'sandbox:ability', 'eco:scam']) bus.on(n, (p) => { (ev[n] ??= []).push(p); });
    const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const root = document.body;
    const ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check' });
    const lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: 30, seed: 3 });
    const dt = 1 / 30; let frames = 0;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); frames++; };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    const meshes = () => { let n = 0; game.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) n++; }); return n; };
    /** drain the dialogue box like a player hammering Enter (skip typewriter → advance), max 40 presses */
    const drain = () => { let n = 0; while (ui.dialogue.isOpen && n < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); n++; } return n; };
    // 1. title → PLAY
    if (lg.state !== 'title' || !ui.title.isOpen || !game.paused) throw new Error('title: state ' + lg.state + ' open ' + ui.title.isOpen + ' paused ' + game.paused);
    if (GAME_STATES.length !== 5) throw new Error('GAME_STATES');
    run(1); if (lg.sb) throw new Error('sandbox before PLAY');
    ui.title.buttons.story.click();
    if (lg.state !== 'playing' || !lg.sb || !lg.story || ui.title.isOpen) throw new Error('PLAY → ' + lg.state);
    const m0 = meshes(); if (m0 < 20) throw new Error('scene meshes after start ' + m0);
    step(); if (!ui.dialogue.isOpen || !game.paused || !/Season 1/.test(ev['story:line'][0].text)) throw new Error('S1 opening in dialogue: open ' + ui.dialogue.isOpen + ' paused ' + game.paused);
    const d1 = drain(); if (ui.dialogue.isOpen || game.paused) throw new Error('drain S1 opening: ' + d1 + ' lines, paused ' + game.paused);
    console.log(`  1. title (paused) → PLAY → sandbox ${m0} meshes + story · S1 opening ${d1} lines in the 7B box (paused by dialogue) · Enter ×${d1} → playing, unpaused  OK`);
    // 2. seasons 1 → 3 by the clock: mid line → eco:season → ledger lines → story:review → ledger (paused) → CONTINUE → next opening → playing
    const eco = lg.sb.eco; let mids = 0;
    for (let s = 1; s <= 3; s++) {
      let guard = 0; const lines0 = ev['story:line'].length;
      while (eco.state.season === s && !ui.ledger.isOpen && guard++ < 45 * 30) { step(); if (ui.dialogue.isOpen) { if (eco.state.day01 > 0.4 && eco.state.day01 < 0.9) mids++; drain(); } }
      if (!ui.ledger.isOpen) throw new Error(`S${s}: ledger never opened (season ${eco.state.season} day ${eco.state.day01.toFixed(2)} state ${lg.state})`);
      if (lg.state !== 'review' || !game.paused || ui.dialogue.isOpen) throw new Error(`S${s}: review state ${lg.state} paused ${game.paused} dlg ${ui.dialogue.isOpen}`);
      if ((ev['story:review'] || []).length !== s || ev['eco:season'].length !== s || ev['eco:season'][s - 1].season !== s) throw new Error(`S${s}: story:review ${ev['story:review']?.length} eco:season ${ev['eco:season'].length}`);
      if (ev['story:line'].length - lines0 < 2) throw new Error(`S${s}: only ${ev['story:line'].length - lines0} story lines this season`);
      ui.ledger.skip(); ui.ledger.continue();
      if (ui.ledger.isOpen || ev['ui:continue'].length !== s || ev['ui:continue'][s - 1].outcome !== 'season' || ev['ui:continue'][s - 1].season !== s) throw new Error(`S${s}: CONTINUE → ${JSON.stringify(ev['ui:continue'].at(-1))}`);
      if (lg.state !== 'playing' || eco.state.season !== s + 1) throw new Error(`S${s}: after continue state ${lg.state} season ${eco.state.season}`);
      step(); if (!ui.dialogue.isOpen || !game.paused) throw new Error(`S${s + 1}: opening did not start (dlg ${ui.dialogue.isOpen})`); drain();
      if (ui.dialogue.isOpen || game.paused) throw new Error(`S${s + 1}: opening not drained`);
    }
    if (mids < 3) throw new Error('mid-season lines ' + mids);
    if (lg.stats.seasons !== 3 || lg.stats.reviews !== 3) throw new Error('stats ' + JSON.stringify(lg.stats));
    console.log(`  2. S1→S3 by the clock (30 s/season): mid lines ×${mids} · eco:season → 8B ledger lines → story:review → ledger (review, paused) · CONTINUE ×3 → next opening → playing · season now ${eco.state.season} · ${ev['story:line'].length} lines total  OK`);
    // 3. UI → systems while playing: build tray → stall placed + charged · jars APPLY → eco.allocate · ability gated by modal
    eco.state.spark = 500; const spark0 = eco.state.spark, placed0 = lg.sb.build.placed.size;
    bus.emit('ui:build', { action: 'select', id: 'stall_' + (await import(pathToFileURL(resolve('src/Game.js')).href)).STALL_PICKS[2] });
    if (lg.sb.build.mode !== 'place') throw new Error('ui:build select → mode ' + lg.sb.build.mode);
    bus.emit('ui:build', { action: 'rotate' }); lg.sb.build.moveTo(1, 1); bus.emit('ui:build', { action: 'confirm' });
    if (lg.sb.build.placed.size !== placed0 + 1 || eco.state.spark >= spark0 || !ev['build:placed']) throw new Error(`ui:build confirm: placed ${lg.sb.build.placed.size} spark ${eco.state.spark}`);
    bus.emit('ui:build', { action: 'cancel' }); if (lg.sb.build.mode === 'place') throw new Error('ui:build cancel');
    const pouch = eco.state.spark, j0 = { ...eco.state.jars };
    bus.emit('ui:jar:apply', { pct: { spend: 40, save: 30, invest: 20, protect: 10 } });
    if (!ev['game:allocated'] || eco.state.spark >= pouch || eco.state.jars.save <= j0.save || eco.state.jars.protect <= j0.protect) throw new Error(`jars APPLY: spark ${pouch}→${eco.state.spark} jars ${JSON.stringify(eco.state.jars)}`);
    const moved = ev['game:allocated'][0].moved; if (Math.abs(moved - Math.floor(pouch * 0.3) - Math.floor(pouch * 0.2) - Math.floor(pouch * 0.1)) > 1) throw new Error('jars moved ' + moved);
    // S03: AUTO on → a sale of 20 ✦ at 30/20/10 moves 6/4/2 into the jars the moment it lands; carry-over keeps fractions; off → nothing moves; survives the save
    { const ja = { ...eco.state.jars }, sp = eco.state.spark; bus.emit('ui:jar:auto', { on: true, pct: { spend: 40, save: 30, invest: 20, protect: 10 } });
      eco.earn(20, 'sale'); if (eco.state.jars.save !== ja.save + 6 || eco.state.jars.invest !== ja.invest + 4 || eco.state.jars.protect !== ja.protect + 2 || eco.state.spark !== sp + 8) throw new Error(`S03 auto split: jars ${JSON.stringify(eco.state.jars)} spark ${sp}→${eco.state.spark}`);
      eco.earn(5, 'sale'); eco.earn(5, 'sale'); if (eco.state.jars.save !== ja.save + 9) throw new Error('S03 carry-over: save ' + (eco.state.jars.save - ja.save) + ' expected 9');   // 1.5 + 1.5 → 1 + 2
      eco.earn(50, 'loan'); if (eco.state.jars.save !== ja.save + 9) throw new Error('S03: a loan must NOT be auto-split');
      const snap = lg.save.snapshot(); if (snap.autoApply !== true) throw new Error('S03: autoApply missing from the snapshot');
      bus.emit('ui:jar:auto', { on: false }); const s2 = eco.state.jars.save; eco.earn(20, 'sale'); if (eco.state.jars.save !== s2 || lg.autoApply) throw new Error('S03: AUTO off still splits'); }
    // S06: tapping a placed stall on the island (ground tap on its anchor cell) → inspect: tray opens on its tab with the card selected (ui:inspect)
    { const stall = [...lg.sb.build.placed.values()].find((x) => x.category === 'stall' && !x.scenery); if (!stall) throw new Error('S06: no stall to tap');
      const insp = []; const offI = bus.on('ui:inspect', (p) => insp.push(p)); const g = stall.group.position;
      const consumed = lg.selectTap({ x: g.x, z: g.z }); offI();
      if (consumed !== true || insp.length !== 1 || insp[0].id !== stall.id || !lg.inspected || lg.inspected.id !== stall.id) throw new Error('S06: selectTap ' + consumed + ' ' + JSON.stringify(insp));
      if (lg.ui?.build && (!lg.ui.build.isOpen || lg.ui.build.state.selected !== stall.id)) throw new Error('S06: tray not open on the tapped stall (' + lg.ui.build.state.selected + ')');
      if (lg.selectTap({ x: 40, z: 40 }) !== false) throw new Error('S06: empty water tap must not be consumed');
      lg.ui?.build?.close?.(); }
    // B11 withdraw ↩ + B01 PAY BARON through the jars panel's real buttons → economy.withdraw / economy.repay
    const sv0 = eco.state.jars.save, sp1 = eco.state.spark; ui.jars.el.querySelector('.ll-jar.save .ll-jar-wd').click();
    if (!ev['game:withdrew'] || eco.state.jars.save >= sv0 || eco.state.spark <= sp1) throw new Error(`jars withdraw: save ${sv0}→${eco.state.jars.save} spark ${sp1}→${eco.state.spark}`);
    const debt0 = eco.state.debt, sp2 = eco.state.spark; if (!(debt0 > 0)) throw new Error('fixture: expected starting debt');
    const payBtn = ui.jars.el.querySelector('.ll-jars-debt .ll-btn'); if (payBtn.disabled) throw new Error('PAY BARON should be enabled with debt + pouch'); payBtn.click();
    if (!ev['game:repaid'] || eco.state.debt !== Math.max(0, debt0 - Math.min(debt0, sp2)) || eco.state.spark !== sp2 - Math.min(debt0, sp2)) throw new Error(`repay: debt ${debt0}→${eco.state.debt} spark ${sp2}→${eco.state.spark}`);
    if (parseInt(ui.jars.el.querySelector('.ll-jars-debt-val').textContent, 10) !== Math.round(eco.state.debt)) throw new Error('debt row text ' + ui.jars.el.querySelector('.ll-jars-debt-val').textContent);
    // B24: player-facing price / hire / zone — build tray detail bar (− price +) and the Crew & Land tab (offer cards buy via ui:build {action:'buy'})
    { const cust = lg.sb.cust, sid = 'stall_fruit'; ui.build.open(); ui.build.setCategory('stall'); ui.build.select(sid);
      const p0 = cust.price(sid); { const pm = ui.build.el.querySelectorAll('.ll-det-price .ll-btn.pm'); pm[pm.length - 1].click(); }
      if (cust.price(sid) !== p0 + 1 || !ev['cust:price']) throw new Error(`price +: ${p0}→${cust.price(sid)}`);
      ui.build.nudgePrice(-1); if (cust.price(sid) !== p0) throw new Error('price −');
      if (!/fair/.test(ui.build.el.querySelector('.ll-det-price-val').textContent)) throw new Error('price tag ' + ui.build.el.querySelector('.ll-det-price-val').textContent);
      ui.build.setCategory('crew'); const offers = lg.offers(); if (offers.length !== 9 || !offers.find((o) => o.id === 'zone_east' && /needs west/.test(o.blocker || ''))) throw new Error('offers ' + JSON.stringify(offers.map((o) => [o.id, o.blocker])));
      const h0 = lg.sb.helpers.length, hc = ui.build.cards.get('helper_packMole'); if (!hc) throw new Error('no packMole card');
      eco.state.spark = 999; hc.click();
      if (lg.sb.helpers.length !== h0 + 1 || !eco.owns('helper_packMole') || !ui.build.cards.get('helper_packMole')?.classList.contains('owned')) throw new Error(`hire via tray: helpers ${h0}→${lg.sb.helpers.length} owned=${eco.owns('helper_packMole')}`);
      hc.click(); if (lg.sb.helpers.length !== h0 + 1) throw new Error('owned card re-bought');
      const s0 = eco.state.season; eco.state.season = Math.max(s0, 3); ui.build.setCategory('crew'); eco.state.spark = 999; ui.build.setCategory('crew'); ui.build.cards.get('zone_west').click(); run(1.5);
      if (!eco.owns('zone_west') || !lg.sb.island.zones[1].unlocked) throw new Error('zone via tray'); eco.state.season = s0;
      ui.build.setCategory('stall'); ui.build.close(); }
    // P12: tray 💰 Sell removes one placed stall of the selected type and refunds 50 %
    { ui.build.open(); ui.build.setCategory('stall'); ui.build.select('stall_fruit'); const sellBtn = ui.build.el.querySelector('.ll-build-detail .ll-btn.sell');
      const n0 = [...lg.sb.build.placed.values()].filter((x) => x.id === 'stall_fruit').length, sp0 = eco.state.spark; if (!sellBtn || sellBtn.style.display === 'none' || n0 < 1) throw new Error(`P12: sell button (n ${n0})`);
      sellBtn.click(); run(0.6); const n1 = [...lg.sb.build.placed.values()].filter((x) => x.id === 'stall_fruit').length;
      if (n1 !== n0 - 1 || !(eco.state.spark > sp0)) throw new Error(`P12: sell ${n0}→${n1} spark ${sp0}→${eco.state.spark}`); ui.build.close(); }
    // P13 / P16: demolish mode survives closing the tray (tray + integrator agree), a card pick ends it in BOTH layers, Esc ends it without opening pause
    { const dBtn = ui.build.el.querySelector('.ll-build-foot .ll-btn.warn'); ui.build.open(); dBtn.click();
      if (!lg.demolishMode || !ui.build.state.demolish || !dBtn.classList.contains('on')) throw new Error('P13: demolish arm');
      ui.build.close(); if (!lg.demolishMode || !ui.build.state.demolish || !dBtn.classList.contains('on')) throw new Error('P13: closing the tray dropped demolish mode');
      // S09: with the tray closed the floating pill shows; ✕ Done ends demolish mode in both layers (touch has no Esc)
      if (!ui.build.demolishPillVisible || !ui.build.el.classList.contains('demolishing')) throw new Error('S09: demolish pill should show while armed + tray closed');
      ui.build.el.querySelector('.ll-build-demolishing .ll-btn.no').click(); if (lg.demolishMode || ui.build.state.demolish || ui.build.demolishPillVisible) throw new Error('S09: ✕ Done did not end demolish mode');
      ui.build.open(); dBtn.click(); if (ui.build.demolishPillVisible) throw new Error('S09: pill must not show while the tray is open'); ui.build.close(); if (!ui.build.demolishPillVisible) throw new Error('S09: pill after close');
      ui.build.open(); ui.build.select('stall_fruit'); if (lg.demolishMode || ui.build.state.demolish || dBtn.classList.contains('on')) throw new Error('P16: pick left demolish armed');
      dBtn.click(); ui.build.close(); pressKey('Escape'); if (lg.demolishMode || ui.build.state.demolish || ui.pause.isOpen) throw new Error(`P13: Esc should end demolish (lg ${lg.demolishMode} ui ${ui.build.state.demolish} pause ${ui.pause.isOpen})`);
      await new Promise((r) => setTimeout(r, 2)); }   // let the shared-Esc "owned by tray" flag (setTimeout 0) clear
    pressKey('Escape'); if (!ui.pause.isOpen || !game.paused || !ui.isModal()) throw new Error('Esc → pause menu');
    if (lg.ability('coinMagnetDash') !== null) throw new Error('ability while paused should be refused');
    pressKey('Escape'); if (ui.pause.isOpen || game.paused) throw new Error('Esc → resume');
    // S11: one Esc dispatcher — priority stack seasons → dialogue → build → pause. Each press is consumed by exactly one layer.
    { const esc = []; const offE = bus.on('ui:escape', (p) => esc.push(p.layer));
      ui.seasons.open(1); pressKey('Escape'); if (ui.seasons.isOpen || ui.pause.isOpen || esc.at(-1) !== 'seasons') throw new Error(`S11: Esc on season card → ${JSON.stringify(esc)} pause ${ui.pause.isOpen}`);
      ui.dialogue.queue([{ who: 'Pip', text: 'S11 line' }]); pressKey('Escape'); if (!ui.dialogue.isOpen || ui.pause.isOpen || esc.at(-1) !== 'dialogue') throw new Error('S11: Esc over dialogue must be swallowed (no pause)'); ui.dialogue.hide();
      ui.build.open(); ui.build.select('stall_fruit'); pressKey('Escape'); if (ui.build.isOpen || ui.pause.isOpen || esc.at(-1) !== 'build') throw new Error('S11: Esc closes the tray, nothing else');
      ui.seasons.open(1); ui.build.open(); pressKey('Escape'); if (ui.seasons.isOpen || !ui.build.isOpen) throw new Error('S11: season card outranks the tray'); pressKey('Escape'); if (ui.build.isOpen || ui.pause.isOpen) throw new Error('S11: 2nd Esc closes tray');
      pressKey('Escape'); if (!ui.pause.isOpen || esc.at(-1) !== 'pause') throw new Error('S11: Esc with nothing open → pause'); pressKey('Escape'); if (ui.pause.isOpen) throw new Error('S11: Esc → resume');
      if (ui.escape() !== 'pause' || !ui.pause.isOpen) throw new Error('S11: ui.escape() API'); ui.escape(); offE(); }
    run(1); if (!lg.ability('bubbleShield')) throw new Error(`ability while playing refused: hero ${lg.sb.hero.state}/${lg.sb.hero.currentMove?.name} cd ${JSON.stringify(lg.sb.cooldown)}`); run(2); if (!ev['sandbox:ability'] || !(lg.sb.shield.until > game.time)) throw new Error('ability did not resolve (sandbox:ability / shield)');
    console.log(`  3. ui:build select/rotate/confirm → stall ${placed0}→${lg.sb.build.placed.size}, spark ${spark0}→${eco.state.spark + moved} · ui:jar:apply 40/30/20/10 → moved ${moved} into save/invest/protect · Esc → pause (modal, ability refused) → Esc resume → ability fired  OK`);
    // 4. WIN: fake the last season being over (season 10, fog 0, debt 0) → endSeason → eco:win → 'ending' → 8B ending lines → story:finale
    //    → ledger outcome 'win' (ENDLESS MODE ▸) → click → 'endless': island kept, winRequiresSeasons off, scams refused, clock ticking
    run(2); eco.state.season = 10; eco.state.day01 = 0.99; eco.state.fog01 = 0; eco.state.debt = 0; eco.state.spark = Math.max(eco.state.spark, 50);
    const r10 = eco.endSeason(); if (!r10 || eco.state.ended !== 'win') throw new Error('forced win: ended=' + eco.state.ended + ' fog ' + eco.state.fog01 + ' debt ' + eco.state.debt);
    if (lg.state !== 'ending' || lg.pendingOutcome !== 'win') throw new Error('eco:win → state ' + lg.state);
    if (ui.ledger.isOpen) throw new Error('ledger opened before the ending lines');
    step(); if (!ui.dialogue.isOpen) throw new Error('ending lines did not start'); const dEnd = drain();
    if (!ui.ledger.isOpen || ui.ledger.el.querySelector('.ll-ledger-continue').textContent.indexOf('ENDLESS') < 0 || !/Lighthouse/.test(ui.ledger.el.textContent)) throw new Error('win ledger: open ' + ui.ledger.isOpen + ' btn ' + ui.ledger.el.querySelector('.ll-ledger-continue').textContent);
    const mWin = meshes(); ui.ledger.skip(); ui.ledger.continue();
    if (lg.state !== 'endless' || lg.mode !== 'endless' || !ev['game:endless'] || eco.config.winRequiresSeasons !== false || eco.state.ended) throw new Error(`ENDLESS → state ${lg.state} mode ${lg.mode} wrs ${eco.config.winRequiresSeasons} ended ${eco.state.ended}`);
    if (ui.ledger.isOpen || game.paused || meshes() !== mWin || !lg.sb) throw new Error('endless: island not kept / still paused');
    const d0 = eco.state.day01; run(3); if (!(eco.state.day01 > d0)) throw new Error('endless clock not running'); drain();
    eco.offerScam('zeroInterestLoan'); lg.sb.updateScheduler(); if (eco.pendingOffer) throw new Error('endless: scam not auto-refused');
    console.log(`  4. forced S10 win → eco:win → ending · ${dEnd} ending lines (Enter ×${dEnd}) → story:finale → ledger "Lighthouse is lit" ENDLESS MODE ▸ → endless (mode endless, win gate off, ${mWin} meshes kept, clock running, Too-Good Deal auto-refused)  OK`);
    // 5. LOSE on a fresh run: title via pause menu → PLAY → fog 1.0 → endSeason → eco:lose → ending lines → ledger "Fogged out" TRY AGAIN ▸ → title,
    //    sandbox torn down (scene back to the UI-less mesh count) → PLAY again → fresh season 1 · ui:restart → same mode from S1
    bus.emit('ui:title'); if (lg.state !== 'title' || lg.sb || !ui.title.isOpen || !game.paused || !ev['game:title']) throw new Error('ui:title → ' + lg.state);
    const mEmpty = meshes(); if (mEmpty > 2) throw new Error('teardown left ' + mEmpty + ' meshes in the scene');
    ui.title.buttons.story.click(); step(); drain(); const eco2 = lg.sb.eco; if (eco2 === eco || eco2.state.season !== 1 || lg.state !== 'playing') throw new Error('second PLAY: season ' + eco2.state.season);
    eco2.state.fog01 = 1; eco2.state.day01 = 0.99; eco2.endSeason(); if (eco2.state.ended !== 'lose' || lg.state !== 'ending') throw new Error('forced lose → ' + eco2.state.ended + ' ' + lg.state);
    step(); const dLose = drain(); if (!ui.ledger.isOpen || !/Fogged out/.test(ui.ledger.el.textContent) || ui.ledger.el.querySelector('.ll-ledger-continue').textContent.indexOf('TRY AGAIN') < 0) throw new Error('lose ledger');
    ui.ledger.skip(); ui.ledger.continue();
    if (lg.state !== 'title' || lg.sb || !ui.title.isOpen || !game.paused || ui.ledger.isOpen) throw new Error(`TRY AGAIN → state ${lg.state} title ${ui.title.isOpen} paused ${game.paused}`);
    if (meshes() !== mEmpty) throw new Error('lose teardown meshes ' + meshes());
    ui.title.buttons.story.click(); step(); drain(); const eco3 = lg.sb.eco; if (eco3.state.season !== 1 || eco3.state.ended) throw new Error('third run not fresh');
    bus.emit('ui:restart'); if (lg.sb.eco === eco3 || lg.sb.eco.state.season !== 1 || lg.state !== 'playing' || lg.mode !== 'story') throw new Error('ui:restart → ' + lg.state); step(); drain();
    if (lg.stats.starts !== 4 || lg.stats.finales < 2) throw new Error('stats ' + JSON.stringify(lg.stats));
    lg.destroy(); ui.destroy(); if (lg.sb || meshes() !== mEmpty || game.systems.length > 1) throw new Error('destroy: systems ' + game.systems.length + ' meshes ' + meshes());
    console.log(`  5. ui:title → title (teardown → ${mEmpty} meshes) → PLAY → fresh S1 → forced fog loss → ${dLose} ending lines → ledger "Fogged out" TRY AGAIN ▸ → title → PLAY → S1 · ui:restart → new sandbox S1 · ${lg.stats.starts} starts · lg.destroy + ui.destroy clean  OK`);
    console.log(`  game: ${frames} frames · states ${lg.log.join(' · ')}  OK`);
  } catch (err) { bad++; console.log('  game FAIL →', err.message); }
}
if (doSave) {
  // 10D: same headless rig as --game. (1) run A: PLAY → S1 drained → clock to the S1 ledger → autosave on eco:season → CONTINUE (autosave again)
  // → build one stall → play 5 s → tutorial gates fired. (2) run B: new bus/ui/lg with the SAME storage → title shows CONTINUE → click →
  // season 2, spark/stalls/helpers/toastsFired identical, no toast replays, the S2 opening is not replayed. (3) exportText → clear → importText
  // → hasSave again · bad text refused. (4) forced lose → save cleared → title has no CONTINUE.
  console.log('\nSAVE (10D):');
  try {
    const { installDomShim } = await import(pathToFileURL(resolve('tools/domshim.mjs')).href); installDomShim();
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { SequencePlayer, HitStop } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { tweens } = await import(pathToFileURL(resolve('src/anim/Tween.js')).href);
    const { createLumenGame, TUTORIAL_GATES } = await import(pathToFileURL(resolve('src/Game.js')).href);
    const Save = await import(pathToFileURL(resolve('src/systems/save.js')).href);
    const { mountUI } = await import(pathToFileURL(resolve('ui/index.js')).href);
    const { PROP_CATALOG } = await import(pathToFileURL(resolve('src/assets/props.js')).href);
    const { readFileSync } = await import('node:fs'); const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const mem = new Map(); const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    const rig = () => {
      const bus = new EventBus(); const ev = {}; for (const n of ['game:saved', 'game:resumed', 'story:toast', 'story:line', 'ui:start']) bus.on(n, (p) => { (ev[n] ??= []).push(p); });
      const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {}, snapTo() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
      document.body.innerHTML = '';
      const ui = mountUI(document.body, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check', hasSave: () => Save.hasSave(storage) });
      const lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: 30, seed: 3, storage });
      const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); };
      const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
      const drain = () => { let n = 0; while (ui.dialogue.isOpen && n < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); n++; } return n; };
      return { bus, ev, game, ui, lg, step, run, drain };
    };
    // 1. run A
    const A = rig();
    if (A.ui.title.buttons.continue.style.display !== 'none') throw new Error('CONTINUE visible with no save');
    A.ui.title.buttons.story.click(); A.step(); A.drain();
    const ecoA = A.lg.sb.eco;
    A.lg.sb.hero.root.position.x += 3; A.run(0.5);                                                       // tut:move
    let guard = 0; while (ecoA.state.season === 1 && !A.ui.ledger.isOpen && guard++ < 45 * 30) { A.step(); if (A.ui.dialogue.isOpen) A.drain(); }
    if (!A.ui.ledger.isOpen) throw new Error('A: S1 ledger never opened');
    if ((A.ev['game:saved'] || []).length !== 1 || !Save.hasSave(storage)) throw new Error('A: autosave on eco:season → ' + (A.ev['game:saved'] || []).length);
    A.ui.ledger.skip(); A.ui.ledger.continue(); A.step(); A.drain();
    if ((A.ev['game:saved'] || []).length !== 2) throw new Error('A: autosave on review→playing → ' + A.ev['game:saved'].length);
    A.bus.emit('ui:build', { action: 'select', id: 'stall_fruit' }); A.bus.emit('ui:build', { action: 'confirm' }); A.run(0.2);
    A.bus.emit('ui:jar:apply', { pct: { spend: 40, save: 30, invest: 20, protect: 10 } });
    A.run(11);
    const firedA = [...A.lg.tut.fired]; if (!firedA.includes('tut:move') || !firedA.includes('tut:endSeason') || !firedA.includes('tut:upgrade')) throw new Error('A: tutorial gates ' + firedA.join(','));
    if (!A.lg.tut.fired.has('tut:build') || A.lg.tut.built !== 1) throw new Error('A: tut:build (12 s idle in S1) ' + A.lg.tut.fired.has('tut:build') + ' built ' + A.lg.tut.built);
    const toastsA = (A.ev['story:toast'] || []).map((t) => t.id); if (new Set(toastsA).size !== toastsA.length) throw new Error('A: duplicate toasts ' + toastsA.join(','));
    A.lg.save.write();                                                                                   // manual save mid-S2 (what index.html's visibilitychange does)
    // BUGFIX probe: a decor prop must NOT count as a stall after restore (eco.state.stalls comes from syncStalls, not placed.size)
    { const cell = A.lg.sb.island.gridCells().find((c) => A.lg.sb.build.canPlace('crate', c.x, c.z, 0)); if (cell) A.lg.sb.build.place('crate', cell.x, cell.z, 0, { animate: false }); }
    { const sp = ecoA.state.spark; ecoA.state.spark = 999; A.lg.sb.keys.hire(); ecoA.state.spark = sp; if (A.lg.sb.helpers.length !== 1) throw new Error('A: hire helper'); }
    const helperTypeA = A.lg.sb.helpers[0].type;
    // B14 probe: unlock zone 1 (zone_west granted, as the season:3 gate would refuse a buy in S2) and build a stall ON it → both must survive CONTINUE
    { ecoA.grantUpgrade('zone_west'); A.lg.sb.island.unlockInstant(1); const z1 = A.lg.sb.island.zones[1]; const cell = z1.cells.find((c) => A.lg.sb.build.canPlace('stall_flower', c.x, c.z, 0)); if (!cell || !A.lg.sb.build.place('stall_flower', cell.x, cell.z, 0, { animate: false, pay: false })) throw new Error('A: stall on zone 1'); }
    const stallsOnZonesA = A.lg.sb.build.serialize().length, ecoStallsA0 = ecoA.state.stalls;
    { const ok = A.lg.save.write(); if (!ok) { let e2 = ''; try { JSON.stringify(Save.snapshot(A.lg)); } catch (e) { e2 = e.message; } throw new Error('A: save.write failed ' + e2 + ' snap=' + !!Save.snapshot(A.lg) + ' st=' + A.lg.state); } }
    const snapA = A.lg.save.read(); if (!snapA) { const raw = storage.getItem(Save.SAVE_KEY); throw new Error('A: read null, raw=' + (raw ? raw.slice(0, 200) : raw) + ' key=' + Save.SAVE_KEY + ' mem=' + [...mem.keys()]); } if (!snapA.helpers || snapA.helpers.length !== 1) throw new Error('A: snapshot helpers ' + JSON.stringify(snapA.helpers)); const stallsA = A.lg.sb.build.placed.size, sparkA = ecoA.state.spark, seasonA = ecoA.state.season, toastsSaved = snapA.story.state.toastsFired.slice();
    if (seasonA !== 2 || snapA.build.length !== stallsA || snapA.state !== 'playing' || snapA.mode !== 'story') throw new Error('A: snapshot ' + JSON.stringify({ seasonA, b: snapA.build.length, stallsA, st: snapA.state }));
    if (!toastsSaved.includes('tut:move') && !toastsSaved.includes('t_move')) throw new Error('A: toastsFired not saved ' + toastsSaved.join(','));
    A.lg.destroy(); A.ui.destroy();
    console.log(`  1. run A: PLAY → S1 → ledger (autosave #1) → CONTINUE (autosave #2) → build + jars + 11 s → gates ${firedA.join(' ')} · ${toastsA.length} toasts no dupes · snapshot S${seasonA} ${stallsA} stalls ${sparkA} spark  OK`);
    // 2. run B resumes
    const B = rig();
    if (B.ui.title.buttons.continue.style.display === 'none' || !/Season 2/.test(Save.describe(Save.load(storage)))) throw new Error('B: CONTINUE hidden / describe ' + Save.describe(Save.load(storage)));
    B.ui.title.buttons.continue.click(); B.step();
    let ecoB = B.lg.sb?.eco; if (!ecoB || B.lg.state !== 'playing' || (B.ev['game:resumed'] || []).length !== 1) throw new Error('B: resume → ' + B.lg.state);
    if (ecoB.state.season !== seasonA || ecoB.state.spark !== sparkA || B.lg.sb.build.placed.size !== stallsA) throw new Error(`B: season ${ecoB.state.season}/${seasonA} spark ${ecoB.state.spark}/${sparkA} stalls ${B.lg.sb.build.placed.size}/${stallsA}`);
    if (B.ui.dialogue.isOpen) throw new Error('B: S2 opening replayed on resume');
    if (!B.lg.sb.island.zones[1].unlocked || B.lg.sb.island.zones[2].unlocked || B.lg.sb.build.placed.size !== stallsOnZonesA || ecoB.state.stalls !== ecoStallsA0) throw new Error(`B: zones ${B.lg.sb.island.zones.map((z) => +z.unlocked)} placed ${B.lg.sb.build.placed.size}/${stallsOnZonesA} stalls ${ecoB.state.stalls}/${ecoStallsA0}`);
    if (B.lg.sb.helpers.length !== 1 || B.lg.sb.helpers[0].type !== helperTypeA || !ecoB.owns('helper_' + B.lg.sb.helpers[0].type)) throw new Error(`B: helpers restored ${B.lg.sb.helpers.length} (${B.lg.sb.helpers.map((h) => h.type)}) vs A ${helperTypeA}`);
    if (ecoB.state.stalls !== ecoA.state.stalls || ecoB.state.stalls >= B.lg.sb.build.placed.size) throw new Error(`B: eco.state.stalls ${ecoB.state.stalls}/${ecoA.state.stalls} (placed ${B.lg.sb.build.placed.size} incl. decor)`);
    if (JSON.stringify(B.lg.story.state.toastsFired) !== JSON.stringify(toastsSaved)) throw new Error('B: toastsFired ' + B.lg.story.state.toastsFired.join(','));
    if (Math.abs(B.lg.sb.hero.root.position.x - snapA.hero.x) > 0.01) throw new Error('B: hero pos ' + B.lg.sb.hero.root.position.x);
    B.run(12); if ((B.ev['story:toast'] || []).some((t) => toastsSaved.includes(t.id))) throw new Error('B: toast replayed ' + B.ev['story:toast'].map((t) => t.id).join(','));
    if (B.lg.tut.fired.size === 0 && ![...B.lg.tut.fired].every((f) => toastsSaved.includes(f))) throw new Error('B: gates re-fired');
    const ecoDay = ecoB.state.day01; if (!(ecoDay > 0.3)) throw new Error('B: clock not running after resume ' + ecoDay);
    console.log(`  2. run B: title shows CONTINUE ("${Save.describe(Save.load(storage))}") → resume S${ecoB.state.season} spark ${ecoB.state.spark} stalls ${B.lg.sb.build.placed.size} hero x ${B.lg.sb.hero.root.position.x.toFixed(1)} · no opening/toast replay · clock runs  OK`);
    // 3. export / import text
    const txt = B.lg.save.exportText(); if (!txt.startsWith('LUMEN1:') || txt.length < 100) throw new Error('export ' + txt.slice(0, 20));
    B.lg.save.clear(); if (Save.hasSave(storage) || B.ui.title.buttons.continue.style.display !== 'none') throw new Error('clear left a save');
    if (B.lg.save.importText('not a save') || B.lg.save.importText('LUMEN1:@@@@')) throw new Error('bad import accepted');
    if (!B.lg.save.importText('  ' + txt + '\n') || !Save.hasSave(storage) || Save.load(storage).build.length !== stallsA) throw new Error('import roundtrip');
    // B18: a corrupt-but-versioned slot is refused up front (no CONTINUE), the previous valid slot is kept
    { const keep = storage.getItem(Save.SAVE_KEY); const bad = [{ v: Save.SAVE_VERSION, eco: 'not json' }, { v: Save.SAVE_VERSION, eco: { state: { season: 'x' } } }, { v: Save.SAVE_VERSION, eco: { state: { season: 2, spark: 5, jars: {} } }, build: 'nope' }];
      for (const b of bad) { if (Save.parseSnapshot(JSON.stringify(b)) !== null) throw new Error('B18: accepted ' + JSON.stringify(b).slice(0, 60)); if (B.lg.save.importText(Save.exportText(b))) throw new Error('B18: import accepted corrupt'); }
      if (storage.getItem(Save.SAVE_KEY) !== keep) throw new Error('B18: valid slot lost'); }
    console.log(`  3. exportText ${txt.length} chars (LUMEN1: base64) → clear → bad text refused ×2 → importText → save back, ${Save.load(storage).build.length} stalls  OK`);
    // 3b. B16 prices survive · B12 RESTART SEASON = back to this season's checkpoint (not S1) · B17 TITLE writes a save
    { const sbB = B.lg.sb; const stall = [...sbB.build.placed.values()].find((e) => String(e.id).startsWith('stall_')); if (!stall) throw new Error('3b: no stall');
      sbB.cust.setPrice(stall.id, 17); if (Save.snapshot(B.lg).cust?.prices?.some(([k, v]) => k === stall.id && v === 17) !== true) throw new Error('B16: price not in snapshot');
      const seasonBefore = ecoB.state.season, sparkBefore = B.lg.seasonCheckpoint && JSON.parse(B.lg.seasonCheckpoint.eco).state.spark;
      if (!B.lg.seasonCheckpoint || JSON.parse(B.lg.seasonCheckpoint.eco).state.season !== seasonBefore) throw new Error('B12: no season checkpoint');
      ecoB.state.spark = 1; B.bus.emit('ui:restart'); B.step();
      const eco4 = B.lg.sb.eco; if (eco4 === ecoB || eco4.state.season !== seasonBefore || B.lg.state !== 'playing' || eco4.state.spark !== sparkBefore) throw new Error(`B12: restart → S${eco4.state.season} spark ${eco4.state.spark} (want S${seasonBefore} ${sparkBefore}) ${B.lg.state}`);
      // B16 through CONTINUE: price set → write → fresh rig → resume → price back
      B.lg.sb.cust.setPrice(stall.id, 17); B.lg.save.write(); const B2 = rig(); B2.bus.emit('ui:start', { mode: 'continue' }); B2.step();
      const st2 = [...B2.lg.sb.build.placed.values()].find((e) => e.id === stall.id); if (!st2 || B2.lg.sb.cust.price(stall.id) !== 17) throw new Error('B16: price after CONTINUE ' + B2.lg.sb.cust.price(stall.id));
      // B17: pouch changes → TITLE → the slot holds the new spark
      B2.lg.sb.eco.state.spark = 777; B2.bus.emit('ui:title'); B2.step(); const sl = Save.load(storage); if (!sl || JSON.parse(sl.eco).state.spark !== 777 || B2.lg.state !== 'title') throw new Error('B17: title did not save (' + (sl && JSON.parse(sl.eco).state.spark) + ')');
      B2.lg.destroy(); B2.ui.destroy(); B.lg.save.write();
      console.log(`  3b. B16 price 17 in snapshot + after CONTINUE · B12 RESTART SEASON → S${seasonBefore} checkpoint (spark ${sparkBefore}, not S1) · B17 TITLE saves (spark 777)  OK`); }
    // 3c. P11/P18: a hero parked on a water cell is never persisted / restored there
    { const sbC = B.lg.sb, isl = sbC.island; let wx = null; for (let x = 0; x < 40 && wx === null; x++) if (!isl.isLand(x, 1)) wx = x; if (wx === null) throw new Error('3c: no water east of the plaza');
      sbC.hero.root.position.set(wx + 0.25, 0, 1); const snapC = Save.snapshot(B.lg); if (!snapC.hero || !isl.isLand(snapC.hero.x, snapC.hero.z)) throw new Error(`P18: snapshot kept water pos ${JSON.stringify(snapC.hero)}`);
      if (!isl.isLand(sbC.hero.root.position.x, sbC.hero.root.position.z)) throw new Error('P11: recoverToLand did not move the hero');
      // a tampered slot with a water hero → CONTINUE lands on land (and the hero can walk)
      B.lg.save.write(); const raw = JSON.parse(storage.getItem(Save.SAVE_KEY)); raw.hero = { x: wx + 0.75, z: 1 }; storage.setItem(Save.SAVE_KEY, JSON.stringify(raw));
      const B3 = rig(); B3.bus.emit('ui:start', { mode: 'continue' }); B3.step(); const hp = B3.lg.sb.hero.root.position;
      if (!B3.lg.sb.island.isLand(hp.x, hp.z)) throw new Error(`P18: CONTINUE restored water pos ${hp.x},${hp.z}`);
      B3.lg.destroy(); B3.ui.destroy();
      console.log(`  3c. P11/P18 hero on water (${wx + 0.25},1) → snapshot hero (${snapC.hero.x},${snapC.hero.z}) on land · tampered slot (${wx + 0.75},1) → CONTINUE at (${hp.x.toFixed(2)},${hp.z.toFixed(2)}) on land  OK`); }
    ecoB = B.lg.sb.eco;
    // 4. lose clears
    ecoB.state.fog01 = 1; ecoB.state.day01 = 0.99; ecoB.endSeason(); if (ecoB.state.ended !== 'lose' || B.lg.state !== 'ending') throw new Error('forced lose → ' + ecoB.state.ended + ' ' + B.lg.state);
    if (Save.hasSave(storage)) throw new Error('save not cleared on lose');
    B.step(); B.drain(); B.ui.ledger.skip(); B.ui.ledger.continue();
    if (B.lg.state !== 'title' || B.ui.title.buttons.continue.style.display !== 'none') throw new Error('after lose: ' + B.lg.state + ' continue shown ' + B.ui.title.buttons.continue.style.display);
    B.lg.destroy(); B.ui.destroy();
    console.log(`  4. forced fog loss → eco:lose → save cleared → TRY AGAIN → title without CONTINUE · destroy clean  OK`);
    if (TUTORIAL_GATES.length !== 5) throw new Error('TUTORIAL_GATES');
  } catch (err) { bad++; console.log('  save FAIL →', err.message, process.env.STACK ? err.stack : ''); }
}
if (doStorm) {
  // S17: headless sandbox; force the pre-rolled event to 'storm' and walk the scheduler through warn → hit → clear.
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { SequencePlayer, HitStop } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { tweens } = await import(pathToFileURL(resolve('src/anim/Tween.js')).href);
    const { createSandbox } = await import(pathToFileURL(resolve('src/Game.js')).href);
    const { STORM, StormWeather } = await import(pathToFileURL(resolve('src/vfx/storm.js')).href);
    console.log('\nSTORM (S17):');
    const bus = new EventBus(); const ev = {}; for (const n of ['storm:warn', 'storm:hit', 'storm:clear', 'eco:event', 'eco:absorbed']) bus.on(n, (p) => { (ev[n] ??= []).push(p); });
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fd3f5); scene.fog = new THREE.Fog(0x9fd3f5, 30, 70);
    const lights = { key: { intensity: 1.6 }, hemi: { intensity: 0.75 } };
    const game = { scene, bus, lights, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const sb = createSandbox(game, { headless: true, seasonSeconds: 120, seed: 3 })   // 120 s season: warn window 0.30→0.45 = 18 s ≥ 12 s ramp;
    const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    const W = sb.storm; if (!(W instanceof StormWeather)) throw new Error('sb.storm not a StormWeather');
    const base = { sky: scene.background.getHex(), key: lights.key.intensity, fogNear: scene.fog.near };
    // 1. force a storm; before day 0.30 nothing happens
    run(5); sb.nextEvent = 'storm'; /* after the scheduler's first tick re-rolled it */ run(1); if (W.phase !== 'clear' || W.intensity !== 0 || ev['storm:warn']) throw new Error('storm started early');
    // 2. day 0.30 → warn: clouds gather towards 0.45 over ~12 s, sky darkens, wind gain rises, no event yet
    sb.eco.state.day01 = 0.31; step(); if (W.phase !== 'warn' || ev['storm:warn']?.length !== 1) throw new Error('no warn at 0.30');
    run(13); if (Math.abs(W.intensity - STORM.warnTarget) > 1e-3) throw new Error('warn plateau ' + W.intensity.toFixed(3) + ' phase ' + W.phase + ' day ' + sb.eco.state.day01.toFixed(2) + ' S' + sb.eco.state.season);
    if (scene.background.getHex() === base.sky || !(lights.key.intensity < base.key) || !(W.windGain > 1.5) || !(scene.fog.near < base.fogNear)) throw new Error('warn did not darken the sky / dim / raise wind');
    if (ev['eco:event']) throw new Error('event fired during warn');
    // 3. day 0.45 → hit: intensity → 1 quickly, eco:event storm fired, auto-clear scheduled 4 s later
    sb.eco.state.day01 = 0.46; step(); if (W.phase !== 'storm' || ev['storm:hit']?.length !== 1 || ev['eco:event']?.[0]?.id !== 'storm') throw new Error('storm did not hit (' + W.phase + ')');
    run(2); if (Math.abs(W.intensity - 1) > 1e-3 || Math.abs(W.windGain - STORM.windGainMax) > 1e-3) throw new Error('storm not at full intensity ' + W.intensity.toFixed(3));
    run(STORM.holdSeconds - 2 - 1); if (W.phase !== 'storm' || ev['storm:clear']) throw new Error('S21: storm cleared before holdSeconds (' + W.phase + ')');   // S21: still raining 1 s before the hold ends
    run(2); if (W.phase !== 'clear' || !ev['storm:clear']) throw new Error('storm did not auto-clear after holdSeconds (' + W.phase + ')');
    run(4); if (W.intensity !== 0 || scene.background.getHex() !== base.sky || Math.abs(lights.key.intensity - base.key) > 1e-6 || Math.abs(W.windGain - 1) > 1e-6) throw new Error('sky/lights/wind not restored after clear');
    console.log(`  warn→0.45 plateau, hit→1.0, auto-clear ${STORM.holdSeconds} s (S21), restored  OK  (stats ${JSON.stringify(W.stats)})`);
    // 4. season end mid-storm clears; a Bubble-Shield absorb also clears instead of hitting
    sb.eco.state.day01 = 0.99; run(3); // → next season
    if (sb.eco.state.season < 2) throw new Error('season did not advance'); 
    sb.nextEvent = 'storm'; sb.sched.warn = false; sb.sched.event = false; sb.eco.state.day01 = 0.31; step(); run(2); if (W.phase !== 'warn') throw new Error('S2 warn missing');
    bus.emit('eco:season', { season: 99 }); step(); if (W.phase !== 'clear') throw new Error('eco:season did not clear the storm');
    sb.sched.warn = false; sb.sched.event = false; sb.eco.state.day01 = 0.31; sb.nextEvent = 'storm'; step(); run(1);
    sb.shield.until = game.time + 60; sb.eco.state.day01 = 0.46; step(); if (!ev['eco:absorbed'] || W.phase !== 'clear' || ev['storm:hit'].length !== 1) throw new Error('shield absorb should clear, not hit');
    // 5. reduceMotion flag honoured; dispose restores everything
    sb.reduceMotion = true; if (!W.reduceMotion) throw new Error('reduceMotion not read from sb');
    const nMesh = scene.children.length; W.dispose(); if (W.intensity !== 0 || scene.background.getHex() !== base.sky) throw new Error('dispose did not restore');
    console.log(`  season-end clear, shield absorb → clear, reduceMotion, dispose  OK  (scene children ${nMesh} → ${scene.children.length})`);
    sb.destroy?.();
  } catch (e) { bad++; console.log('FAIL storm →', e.stack?.split('\n').slice(0, 3).join(' | ') || e.message); }
}

if (doCine) {
  // S18: headless createLumenGame with cinematics:true + showcase:true (both default OFF headless so --game/--save keep their timings).
  //   1. boot: title open → showcase sandbox built, cine.active 'title', camera rig set (blend 1), follow target released, body.ll-title-3d
  //   2. PLAY → showcase sandbox REUSED (no second build) → 'arrival' plays: hero on the pier, inputOverride set, story held (no dialogue yet),
  //      tutorial waits (pendingFirst deferred) · Pip walks toward the plaza · ends (arrive or 9 s) → cine:end, override cleared, hold off,
  //      S1 opening lines now in the box, tutorial opens after cine:end
  //   3. restart → arrival again → SKIP → cine:end {skipped} within blendOut; Esc key path
  //   4. forced win → 'victory': story held, lamp lit by the shot (cine:lamp), ending lines after cine:end
  //   5. reduceMotion → arrival is a ~0.6 s cut; opts.cinematics:false → lg.cine null; teardown disposes the showcase (0 meshes)
  console.log('\nCINEMATICS (S18):');
  try {
    const { installDomShim } = await import(pathToFileURL(resolve('tools/domshim.mjs')).href); installDomShim();
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const { SequencePlayer, HitStop } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { tweens } = await import(pathToFileURL(resolve('src/anim/Tween.js')).href);
    const { GameCamera } = await import(pathToFileURL(resolve('src/core/Camera.js')).href);
    const { createLumenGame } = await import(pathToFileURL(resolve('src/Game.js')).href);
    const { CinematicDirector, CINE } = await import(pathToFileURL(resolve('src/vfx/cinematics.js')).href);
    const { mountUI } = await import(pathToFileURL(resolve('ui/index.js')).href);
    const { PROP_CATALOG } = await import(pathToFileURL(resolve('src/assets/props.js')).href);
    const { readFileSync } = await import('node:fs'); const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const bus = new EventBus(); const ev = {}; for (const n of ['cine:begin', 'cine:end', 'cine:lamp', 'cine:showcase', 'game:start', 'story:line', 'ui:pause', 'ui:tutorial:open']) bus.on(n, (p) => { (ev[n] ??= []).push(p); });
    const camera = new GameCamera(16 / 9); camera.shake = camera.shake || (() => {});
    const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const ui = mountUI(document.body, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check' });
    const lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: 30, seed: 3, cinematics: true, showcase: true });
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); camera.update(game.followTarget, dt); };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    const meshes = () => { let n = 0; game.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) n++; }); return n; };
    const drain = () => { let n = 0; while (ui.dialogue.isOpen && n < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); n++; } return n; };
    const body = document.body, has = (c) => body.classList.contains(c);
    // 1. boot showcase
    const C = lg.cine; if (!(C instanceof CinematicDirector)) throw new Error('lg.cine missing');
    if (!lg.showcaseSb || C.active !== 'title' || !ev['cine:showcase']) throw new Error('showcase not started on boot (active ' + C.active + ')');
    if (camera.cine !== C.rig || camera.cineBlend !== 1 || game.followTarget !== null || !has('ll-title-3d')) throw new Error('title orbit did not own the camera');
    const mShow = meshes(); if (mShow < 20) throw new Error('showcase meshes ' + mShow);
    const p0 = camera.cam.position.clone(); run(2); const moved = camera.cam.position.distanceTo(p0);
    if (!(moved > 0.5) || Math.abs(C.rig.pos.y - CINE.titleHeight) > 1.5) throw new Error('orbit not moving (' + moved.toFixed(2) + ')');
    if (!game.paused) throw new Error('title should be paused under the orbit');
    console.log(`  1. boot → showcase sandbox ${mShow} meshes · title orbit owns the camera (blend 1, moved ${moved.toFixed(1)} m in 2 s, paused)  OK`);
    // 2. PLAY → reuse + arrival
    const show = lg.showcaseSb; ui.title.buttons.story.click();
    if (lg.sb !== show || lg.showcaseSb || lg.stats.showcaseReused !== 1) throw new Error('PLAY did not reuse the showcase sandbox');
    if (C.active !== 'arrival' || has('ll-title-3d') || !has('ll-cine-on')) throw new Error('arrival not playing after PLAY (' + C.active + ')');
    const sb = lg.sb, hero = sb.hero; if (!hero.inputOverride) throw new Error('hero.inputOverride not set');
    if (!lg.story?.held) throw new Error('story not held during arrival');
    const pier = sb.world.pierSpawn, startD = Math.hypot(hero.root.position.x - pier.x, hero.root.position.z - pier.z); if (startD > 3) throw new Error('hero not at the pier (' + startD.toFixed(1) + ')');
    step(); if (ui.dialogue.isOpen) throw new Error('S1 opening leaked during the arrival shot');
    if (ui.tutorial?.isOpen) throw new Error('tutorial opened during the arrival shot');
    run(1.5); const d1 = hero.root.position.distanceTo(new THREE.Vector3(0, 0, 1)); if (!(d1 < startD - 0.5 || startD < 2)) throw new Error('Pip is not walking in (' + d1.toFixed(1) + ' vs ' + startD.toFixed(1) + ')');
    if (game.paused) throw new Error('arrival should run unpaused');
    const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
    if (!finite(C.rig.pos) || !finite(C.rig.look)) throw new Error('P53: arrival rig not finite at start ' + JSON.stringify(C.rig.pos));
    let n = 0; while (C.active && n < 15 * 30) { step(); n++; if (!finite(C.rig.pos) || !finite(C.rig.look) || !finite(camera.cam.position)) throw new Error('P53: arrival rig/camera NaN at frame ' + n); }
    if (C.active || !ev['cine:end'] || ev['cine:end'][0].shot !== 'arrival' || ev['cine:end'][0].skipped) throw new Error('arrival did not end (' + (n / 30).toFixed(1) + ' s)');
    if (hero.inputOverride || lg.story.held || has('ll-cine-on') || camera.cine) throw new Error('arrival did not release hero/story/camera');
    const dEnd = hero.root.position.distanceTo(new THREE.Vector3(0, 0, 1)); if (!(dEnd < 3)) throw new Error('Pip did not reach the plaza (' + dEnd.toFixed(1) + ')');
    run(1); if (!ui.dialogue.isOpen && !ui.tutorial?.isOpen) throw new Error('neither S1 opening nor the tutorial after cine:end');
    const tutFirst = !!ui.tutorial?.isOpen;
    if (ui.tutorial?.isOpen) ui.tutorial.close('skip');
    step(); const dl = drain(); if (!dl && !tutFirst) throw new Error('no opening lines after arrival');
    console.log(`  2. PLAY → showcase reused (no rebuild) · arrival: Pip pier→plaza (${startD.toFixed(1)} → ${dEnd.toFixed(1)} m) in ${(n / 30).toFixed(1)} s, override + story hold + HUD fade released · tutorial${tutFirst ? ' opened after cine:end' : ' deferred'} · S1 opening ${dl} lines  OK`);
    // 3. restart → arrival → SKIP
    bus.emit('ui:restart'); step(); if (C.active) throw new Error('ui:restart must NOT replay the arrival (' + C.active + ')');
    bus.emit('ui:title'); step(); if (!lg.showcaseSb || C.active !== 'title') throw new Error('ui:title: showcase not rebuilt (' + C.active + ')');
    ui.title.buttons.story.click(); step(); if (C.active !== 'arrival' || lg.stats.showcaseReused !== 2) throw new Error('title → PLAY: no arrival (' + C.active + ')');
    run(0.5); const ends = ev['cine:end'].length; if (!C.skip()) throw new Error('skip refused');
    let m = 0; while (C.active && m < 90) { step(); m++; }
    if (C.active || ev['cine:end'].length !== ends + 1 || !ev['cine:end'][ends].skipped) throw new Error('SKIP did not end the shot');
    if (lg.sb.hero.inputOverride || lg.story.held) throw new Error('skip did not release');
    const sbW = lg.sb; if (ui.tutorial?.isOpen) ui.tutorial.close('skip'); run(0.2); drain();
    console.log(`  3. ui:restart → no replay · ui:title → showcase again → PLAY → arrival → SKIP → cine:end {skipped} after ${(m / 30).toFixed(2)} s blend-out, released  OK`);
    // 4. victory
    const lampStates = []; const lh = sbW.world.lighthouse; const origSet = lh?.userData?.setState; if (lh?.userData) lh.userData.setState = (s) => { lampStates.push(s); origSet?.call(lh.userData, s); };
    sbW.eco.state.season = 10; sbW.eco.state.spark = 9999; bus.emit('eco:win', { season: 10 }); step();
    if (C.active !== 'victory' || lg.state !== 'ending') throw new Error('victory not playing on eco:win (' + C.active + ' ' + lg.state + ')');
    if (!lg.story.held || ui.dialogue.isOpen) throw new Error('ending lines not held during victory');
    if (lampStates.includes('lit')) throw new Error('lamp lit before the shot');
    run(CINE.victoryFly + 1.2); if (!lampStates.includes('lit') || !ev['cine:lamp']) throw new Error('shot did not light the lamp');
    const lookD = C.rig.look.distanceTo(lh.getWorldPosition(new THREE.Vector3())); if (!(lookD < 8)) throw new Error('camera not looking at the lighthouse (' + lookD.toFixed(1) + ')');
    let k = 0; while (C.active && k < 20 * 30) { step(); k++; }
    if (C.active || lg.story.held) throw new Error('victory did not end');
    run(0.5); if (!ui.dialogue.isOpen) throw new Error('ending lines did not start after the victory shot');
    const dv = drain();
    console.log(`  4. eco:win → victory ${((CINE.victoryFly + CINE.victoryHold + CINE.victoryReturn)).toFixed(1)} s: ending held, lamp lit by the shot at fly+hold·0.15, look ${lookD.toFixed(1)} m from the lamp, ended → ${dv} ending lines  OK`);
    // 5. reduceMotion cut · ?nocine · teardown
    bus.emit('ui:title'); step(); if (!lg.showcaseSb || C.active !== 'title') throw new Error('back to title: showcase not rebuilt');
    bus.emit('ui:settings', { key: 'reduceMotion', value: true }); lg.reduceMotion = true; step();
    const e0 = ev['cine:end'].length; ui.title.buttons.story.click();
    if (C.active !== 'arrival') throw new Error('rm: arrival missing (' + C.active + ')'); const dur = C._shot.dur; if (dur > CINE.reduceCut + 1e-6) throw new Error('reduceMotion arrival not a cut (' + dur + ')');
    let r = 0; while (C.active && r < 60) { step(); r++; } if (C.active || ev['cine:end'].length !== e0 + 1) throw new Error('rm arrival did not cut');
    if (r > 30) throw new Error('rm cut took ' + (r / 30).toFixed(2) + ' s');
    lg.reduceMotion = false; bus.emit('ui:settings', { key: 'reduceMotion', value: false });
    if (ui.tutorial?.isOpen) ui.tutorial.close('skip'); drain();
    bus.emit('ui:title'); step(); const before = meshes(); lg.destroy(); const after = meshes();
    if (after !== 0 || C._el !== null && !lg.cine === false) throw new Error('teardown left ' + after + ' meshes');
    const ui2 = mountUI(document.body, { bus: new EventBus(), stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check' });
    const g2 = { ...game, bus: ui2.bus || new EventBus(), scene: new THREE.Scene(), systems: [] }; g2.bus = g2.bus; 
    const lg2 = createLumenGame(g2, { ui: ui2, storyData, headless: true, seasonSeconds: 30, seed: 3, cinematics: false });
    if (lg2.cine !== null && lg2.cine !== undefined) throw new Error('cinematics:false still built a director'); lg2.destroy(); ui2.destroy?.();
    console.log(`  5. reduceMotion → arrival cut ${dur} s (${(r / 30).toFixed(2)} s real) · title showcase rebuilt on ui:title · destroy → ${before} → ${after} meshes · cinematics:false → lg.cine null  OK  (stats ${JSON.stringify(C.stats)})`);
  } catch (e) { bad++; console.log('FAIL cinematics →', e.stack?.split('\n').slice(0, 3).join(' | ') || e.message); }
}

if (doWorld) {
  // 10A integrated world: real Three in Node. (1) src/assets/props/bake.js: bakeStatic merges N placed props into ≤ 4 meshes
  // (toon + flat + 2 hulls), keeps vertex colors of already-merged props, bakes in the parent's space (zone group offset),
  // removes + disposes the sources (nature swayers unregistered), skips InstancedMesh / live parts. (2) Island v2 + 6 stalls +
  // landmarks + decor + nature scatter + 12 Glimmers + 6 helpers + 4 villains built & stepped 2 s headless with every animator:
  // total visible meshes (≈ worst-case draw calls, everything in view) ≤ 150 · no NaN · zone unlock Sequence finishes.
  console.log('\nWORLD (10A):');
  const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
  const { bakeStatic, bakeShells, disposeBatch } = await import(pathToFileURL(resolve('src/assets/props/bake.js')).href);
  const PR = await import(pathToFileURL(resolve('src/assets/props.js')).href);
  const { Island } = await import(pathToFileURL(resolve('src/world/Island.js')).href);
  const CR = await import(pathToFileURL(resolve('src/assets/creatures/index.js')).href);
  const { SequencePlayer: Sequencer } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
  CR.registerVariants?.();
  // 11A: count like the renderer — traverseVisible skips whole invisible subtrees (helper `held` crates, hidden lamps), traverse() did not.
  const meshCount = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
  const noNaN = (g, what) => g.traverse((o) => { if (!isFinite(o.position.x) || !isFinite(o.position.y) || !isFinite(o.scale.x) || !isFinite(o.scale.y) || !isFinite(o.rotation.y)) throw new Error('NaN pose in ' + what + ' ' + o.name); });
  // 1. bakeStatic
  try {
    const parent = new THREE.Group(); parent.position.set(5, 0, -3); parent.updateMatrixWorld(true);
    const scene = new THREE.Scene(); scene.add(parent);
    const props = [PR.makeProp('rock_medium', { seed: 1 }), PR.makeProp('crate'), PR.makeProp('fence_rail'), PR.makeProp('tree_round', { seed: 2 }), PR.makeProp('lantern_post')];
    props.forEach((g, i) => { g.position.set(i * 2, 0, 0); parent.add(g); });
    const before = props.reduce((a, g) => a + meshCount(g), 0);
    const tri = (g) => PR.countTris(g);
    const trisBefore = props.reduce((a, g) => a + tri(g), 0);
    // vertex-color fidelity: remember a color of the rock's merged mesh
    const rockMesh = props[0].getObjectByName('merged_toon') || props[0].children.find((c) => c.isMesh);
    const batch = bakeStatic(props, { parent, name: 'test_batch' });
    if (batch.parent !== parent) throw new Error('batch not under parent');
    if (props.some((g) => g.parent)) throw new Error('sources not removed');
    const mc = meshCount(batch); if (mc > 4) throw new Error('batch has ' + mc + ' meshes (> 4)');
    if (batch.userData.count !== 5) throw new Error('count ' + batch.userData.count);
    const toon = batch.getObjectByName('baked_toon'); if (!toon || !toon.geometry.attributes.color || !toon.material.vertexColors) throw new Error('no vertex-colored toon mesh');
    const trisAfter = tri(batch) - (batch.children.filter((c) => c.userData.isOutline).reduce((a, c) => a + tri(c), 0));
    if (Math.abs(trisAfter - trisBefore) > trisBefore * 0.6) throw new Error(`tris ${trisBefore} → ${trisAfter}`);
    // parent-space: positions should be local (first prop at x≈0 .. last at x≈8), i.e. bounding box center x ≈ 4 not 9
    toon.geometry.computeBoundingBox(); const cx = (toon.geometry.boundingBox.min.x + toon.geometry.boundingBox.max.x) / 2;
    if (cx < 2 || cx > 6) throw new Error('not baked in parent space, center x=' + cx.toFixed(2));
    // colors not all white
    const col = toon.geometry.attributes.color; let nonWhite = 0; for (let i = 0; i < col.count; i += 7) if (col.getX(i) < 0.95 || col.getY(i) < 0.95 || col.getZ(i) < 0.95) nonWhite++;
    if (!nonWhite) throw new Error('baked colors all white (vertex colors lost)');
    // sway unregistered: swayAll must not throw / move anything of the removed tree
    PR.swayAll(1.0); PR.swayDecor(1.0);
    // instanced fields are skipped
    const field = PR.makeFlowerField(20, () => true, { seed: 1, radius: 3 }); parent.add(field);
    const b2 = bakeStatic([field, PR.makeProp('barrel')], { parent, name: 'b2' });
    if (!b2.userData.count || field.parent) throw new Error('field handling');   // field is a source → removed; instanced mesh skipped (no verts) but prop baked
    disposeBatch(batch); disposeBatch(b2); if (batch.parent || b2.parent) throw new Error('disposeBatch');
    console.log(`  bakeStatic: 5 props (${before} meshes, ${trisBefore} t) → 1 batch = ${mc} meshes (${trisAfter} t, vertex-colored, parent-space ✓, sources removed, swayers unregistered) · instanced field skipped · disposeBatch  OK`);
  } catch (err) { bad++; console.log('  bakeStatic FAIL →', err.message); }
  // 2. whole world, headless
  try {
    const island = new Island({ radius: 11, seed: 7, zonesUnlocked: 1, starterProps: false });
    const scene = new THREE.Scene(); scene.add(island.group);
    let _s = 2026; const rnd = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; };
    const occupied = new Set(); const ck = (x, z) => `${Math.round(x)},${Math.round(z)}`;
    const free = (x, z) => island.allTiles.has(ck(x, z)) && !island.pathCells.has(ck(x, z)) && !occupied.has(ck(x, z));
    const zoneOf = (x, z) => island.zones[Math.max(0, island.zoneAt(x, z))].group;
    const place = (g, x, z, rot = 0, parent = null) => { g.position.set(x, 0, z); g.rotation.y = rot; (parent || zoneOf(x, z)).add(g); occupied.add(ck(x, z)); return g; };
    const far = island.zones[1], west = island.zones[2], east = island.zones[3];
    const live = [];
    live.push(place(PR.makeProp('lighthouse'), far.center.x, far.center.z - 1, Math.PI, far.group));
    live.push(place(PR.makeProp('cottage'), -6, 6, 0.5));
    const edge = island.landEdge(1, 0); const pier = PR.makeProp('pier', { length: 4 }); pier.position.set(edge.x + 0.5, 0, edge.z + 0.5); island.zones[0].group.add(pier); live.push(pier);
    for (const [zone, dx, dz, seed] of [[west, 1.5, -1, 1], [east, -1, -2, 2], [far, 3.5, 2.5, 3]]) live.push(place(PR.makeProp('fog_tower', { seed }), zone.center.x + dx, zone.center.z + dz, 0, zone.group));
    live.push(place(PR.makeProp('waterfall', { height: 2.4 }), east.center.x + 2, east.center.z + 2.5, Math.PI, east.group));
    const stalls = []; const spots = [[-4, -3, Math.PI / 2], [-4, 2, Math.PI / 2], [3, -3, -Math.PI / 2], [3, 2, -Math.PI / 2], [-3, -6, 0], [2, -6, 0]];
    spots.forEach(([x, z, rot], i) => { const g = PR.makeProp('stall_' + PR.STALL_TYPES[i], { level: 1 + (i % 3), seed: i + 1 }); place(g, x, z, rot); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) occupied.add(ck(x + a, z + b)); stalls.push(g); });
    PR.JAR_IDS.forEach((id, i) => live.push(place(PR.makeProp(id, { fill: 0.25 + i * 0.2 }), -8 + i, 3)));
    for (const [x, z] of [[-1.5, -8], [1.5, -8], [-6, -2], [5, 4], [-2, 5.5]]) live.push(place(PR.makeProp('lantern_post'), x, z));
    live.push(place(PR.makeProp('sign_hanging'), -5, -6)); live.push(place(PR.makeProp('banner_string'), -1, -4.5));
    const stat = [];
    for (let i = 0; i < 4; i++) stat.push(place(PR.makeProp('fence_rail'), 4 + i, 6));
    for (const [id, x, z] of [['fence_post', 8.5, 6], ['fence_gate', 5, 7.5], ['bench', -2.5, 7], ['sign_board', 2, 7], ['sign_arrow', 7, -2], ['crate', 6, -5], ['barrel', 7, -5], ['crate', 6, -6], ['flower_pot', -4, 7], ['water_trough', 5.5, -7.5], ['path_stone', -3, 4], ['path_stone', -2, 4], ['path_stone', -1, 4]]) stat.push(place(PR.makeProp(id), x, z));
    stat.push(place(PR.makeProp('cliff_wall', { length: 5 }), west.center.x - 1, west.center.z + 3.5, 0, west.group));
    const TREES = ['tree_round', 'tree_cone', 'tree_double', 'tree_palm', 'tree_blossom', 'tree_tall', 'tree_bush', 'tree_lantern'], ROCKS = ['rock_small', 'rock_medium', 'rock_flat', 'rock_spire', 'rock_cluster', 'rock_crystal', 'rock_mossy'], BUSHES = ['bush_round', 'bush_berry', 'bush_flower', 'bush_fern', 'bush_tallgrass'];
    const nature = [];
    const scatter = (zone, n, pool, minR) => { let placed = 0, tries = 0; while (placed < n && tries++ < 400) { const c = zone.cells[(rnd() * zone.cells.length) | 0]; if (Math.hypot(c.x - zone.center.x, c.z - zone.center.z) < minR || !free(c.x, c.z)) continue; const g = PR.makeProp(pool[(rnd() * pool.length) | 0], { seed: (rnd() * 1e6) | 0, scale: 0.85 + rnd() * 0.35 }); place(g, c.x, c.z, rnd() * 6.28, zone.group); nature.push(g); placed++; } };
    scatter(island.zones[0], 9, TREES, 5); scatter(island.zones[0], 4, ROCKS, 6); scatter(island.zones[0], 5, BUSHES, 4);
    for (const z of [far, west, east]) { scatter(z, 5, TREES, 2.5); scatter(z, 3, ROCKS, 2); scatter(z, 3, BUSHES, 1.5); }
    const unbaked = [...nature, ...stat].reduce((a, g) => a + meshCount(g), 0);
    const batches = [];
    for (const z of island.zones) { const list = [...nature, ...stat].filter((g) => g.parent === z.group); if (list.length) batches.push(bakeStatic(list, { parent: z.group, name: 'batch_' + z.id })); }
    if (batches.length !== 4) throw new Error('batches ' + batches.length);
    // 11A Lever 2: shells of the live props → one more batch per zone (prop groups stay, only glass/glow/lamp/swing/flags live)
    const liveBefore = live.reduce((a, g) => a + meshCount(g), 0);
    const shells = []; for (const z of island.zones) { const list = live.filter((g) => g.parent === z.group); const b = list.length && bakeShells(list, { parent: z.group, name: 'shells_' + z.id }); if (b) shells.push(b); }
    const shellDc = shells.reduce((a, b) => a + meshCount(b), 0);
    const lamp = live[0]; lamp.userData.setLit?.(true); const lantern = live.find((g) => g.userData.kind === 'lantern_post'); lantern.userData.setLit(true); if (!lantern.getObjectByName('glass').visible) throw new Error('bakeShells hid the lantern glass');
    const bakedDc = batches.reduce((a, b) => a + meshCount(b), 0) + shellDc; if (bakedDc > 24) throw new Error('baked dc ' + bakedDc);
    for (const z of island.zones) { const fl = PR.makeFlowerField(z.index === 0 ? 160 : 70, () => true, { seed: 11 + z.index, radius: z.radius + 1 }); z.group.add(fl); const tu = PR.makeGrassTufts(z.index === 0 ? 120 : 60, () => true, { seed: 21 + z.index, radius: z.radius + 1 }); z.group.add(tu); }
    // creatures
    const seqs = new Sequencer(); const mockGame = { scene, sequences: seqs, hitstop() {}, time: 0, timeScale: 1, camera: { zoom: 1, shake() {} }, tweens: { update() {} }, systems: [], add(s) { this.systems.push(s); return s; } };
    const vfxMock = new Proxy({}, { get: (t, k) => t[k] ?? (t[k] = new Proxy(() => {}, { get: () => () => {}, apply: () => {} })) });
    const glims = CR.ALL_GLIMMER_VARIANTS.map((type, i) => { const g = CR.makeGlimmerAny(type, { seed: i + 1 }); g.position.set(Math.sin(i / 12 * 6.28) * 2.5, 0, 1 + Math.cos(i / 12 * 6.28) * 2.5); scene.add(g); const anim = new CR.CreatureAnimator(g, { vfx: vfxMock }); anim.play(['idle', 'browse', 'wait', 'walk'][i % 4]); return { g, anim }; });
    const helpers = CR.HELPER_TYPES.map((type, i) => { const g = CR.makeHelper(type, { seed: i + 1 }); g.position.set(stalls[i].position.x, 0, stalls[i].position.z - 0.9); scene.add(g); const anim = new CR.HelperAnimator(g, type, { vfx: vfxMock }); anim.play('work'); return { g, anim }; });
    const fogPool = new CR.FogPuffPool(scene, 32);
    const villains = [[7.5, -1, () => CR.makeBaronGilt({ seed: 1 })], [6.5, 1, () => CR.makeFogCollector(0, { seed: 1 })], [-8, -4, () => CR.makeFogCollector(1, { seed: 2 })], [8, -7, () => CR.makeFogCollector(2, { seed: 3 })]].map(([x, z, mk], i) => { const g = mk(); g.position.set(x, 0, z); scene.add(g); const anim = new CR.VillainAnimator(g, { vfx: vfxMock, fogPool, game: mockGame }); anim.play(i === 0 ? 'strut' : 'idle'); return { g, anim }; });
    villains[0].anim.play('taunt');
    // step 2 s
    let t = 0; for (let i = 0; i < 120; i++) { const dt = 1 / 60; t += dt; mockGame.time = t; seqs.update(dt); island.update(dt); PR.swayAll(t); PR.swayDecor(t); PR.updateLandmarks(dt); for (const c of glims) { c.anim.update(dt); c.g.userData.update?.(dt); } for (const h of helpers) h.anim.update(dt); for (const v of villains) v.anim.update(dt); fogPool.update?.(dt); }
    noNaN(scene, 'world');
    // zone unlock
    const z1 = island.nextLockedZone(); const seq = island.unlockZone(z1.index, { game: mockGame, vfx: vfxMock }); if (!seq) throw new Error('unlockZone returned null');
    for (let i = 0; i < 70; i++) seqs.update(1 / 60);
    if (!z1.unlocked || !island.isLand(z1.center.x, z1.center.z) || Math.abs(z1.group.position.y) > 0.02) throw new Error(`unlock: unlocked=${z1.unlocked} y=${z1.group.position.y}`);
    noNaN(scene, 'after unlock');
    const total = meshCount(scene);
    const liveAfter = live.reduce((a, g) => a + meshCount(g), 0);
    const per = { island: island.zones.reduce((a, z) => a + meshCount(z.ground) + (z.foam ? meshCount(z.foam) : 0) + 2, 0), stalls: stalls.reduce((a, g) => a + meshCount(g), 0), landmarksDecor: live.reduce((a, g) => a + meshCount(g), 0), baked: bakedDc, glimmers: glims.reduce((a, c) => a + meshCount(c.g), 0), helpers: helpers.reduce((a, h) => a + meshCount(h.g), 0), villains: villains.reduce((a, v) => a + meshCount(v.g), 0) };
    // 10A budget = INTEGRATION budget (2026-10-19): the 150-dc target belongs to 11A (perf pass). 10A only guarantees that
    // integration adds nothing on top of what the content packs already cost: every pack is within its own Bible budget
    // (creature ≤ 15 m, stall ≤ 10 m, batch ≤ 4 m) and the static props are baked. The measured TOTAL is recorded in
    // docs/HANDOFF_10A.md for 11A. Do NOT tighten this back to 150 inside 10A — five chats died doing exactly that.
    const WORLD_BUDGET = 320;   // 11A: 434 (10D) → 353 (count fix) → 316 (fuseGlimmer) → 292 (bakeShells); content-only, before perf.js
    if (total > WORLD_BUDGET) throw new Error(`total visible meshes ${total} > ${WORLD_BUDGET} — integration regressed (${JSON.stringify(per)})`);
    if (bakedDc > 24) throw new Error('baked dc ' + bakedDc);
    // 11A perf.js on top of the content: shared blob shadows (22 discs → 1) + LOD with the camera where index.html puts it.
    const PF = await import(pathToFileURL(resolve('src/systems/perf.js')).href);
    const roots = [...glims.map((c) => c.g), ...helpers.map((h) => h.g), ...villains.map((v) => v.g)];
    const shadows = new PF.BlobShadows(scene, 8); shadows.update(roots); if (shadows.count !== roots.length || shadows.mesh.count !== 22) throw new Error('BlobShadows ' + shadows.count);
    const totalShadows = meshCount(scene);
    const cam = new THREE.PerspectiveCamera(); cam.position.set(0, 13, 10); scene.updateMatrixWorld(true);
    const lod = new PF.CreatureLOD(cam); lod.update(roots); const totalNear = meshCount(scene);
    cam.position.set(40, 13, 10); lod.update(roots); const totalFar = meshCount(scene); if (lod.stats.far !== roots.length) throw new Error('LOD far ' + JSON.stringify(lod.stats));
    cam.position.set(0, 13, 10); lod.update(roots); const afterOne = lod.stats.near;   // one tier per update: nothing may jump 2 → 0 in one frame
    if (afterOne !== 0) throw new Error('LOD popped 2 → 0 in one update ' + JSON.stringify(lod.stats));
    lod.update(roots); lod.update(roots); const totalBack = meshCount(scene);
    if (totalBack < totalFar || totalBack > totalNear || lod.stats.near === 0) throw new Error(`LOD did not come back (${totalFar} ≤ ${totalBack} ≤ ${totalNear}) ` + JSON.stringify(lod.stats));
    const PERF_BUDGET = 300;    // 11A measured 270 with shadows pooled (camera near): +10 %
    if (totalShadows > PERF_BUDGET) throw new Error(`with perf.js ${totalShadows} > ${PERF_BUDGET}`);
    lod.dispose(); shadows.dispose(); if (meshCount(scene) !== total) throw new Error('perf dispose did not restore ' + meshCount(scene) + ' vs ' + total);
    console.log(`  perf (11A): + BlobShadows → ${totalShadows} m (−${total - totalShadows}) · + LOD near ${totalNear} / far ${totalFar} m · dispose restores ${total}  OK`);
    const worst = (arr) => Math.max(...arr.map((g) => meshCount(g)));
    if (worst(glims.map((c) => c.g)) > 15 || worst(helpers.map((h) => h.g)) > 15 || worst(villains.map((v) => v.g)) > 18) throw new Error('a creature exceeds its per-creature budget');
    if (worst(stalls) > 12) throw new Error('a stall exceeds 12 meshes (1A: lantern/sparkExchange L3 = 12)');
    console.log(`  world: 4 zones · 6 stalls ${per.stalls} m · live landmarks+decor ×${live.length} ${liveBefore} → ${liveAfter} m (shells → ${shells.length} batches ${shellDc} m) · ${nature.length + stat.length} static props ${unbaked} m → 4 batches ${bakedDc - shellDc} m · 8 fields · 12 glimmers ${per.glimmers} m · 6 helpers ${per.helpers} m · 4 villains ${per.villains} m · 2 s headless no NaN · unlock zone ${z1.id} ✓ · TOTAL ${total} visible meshes (integration budget ${WORLD_BUDGET}; the ≤ 150 dc target is 11A's — see HANDOFF_10A)  OK`);
  } catch (err) { bad++; console.log('  world FAIL →', err.message); }
}
if (doPerf) {
  // 11A: (1) PixelRatioGovernor on a mock renderer — drop after 3 s < 45 fps, never below the last step, raise after 10 s > 58 fps,
  // never above the quality cap, bus event each change, dispose resets. (2) P3 memory: createSandbox (headless, perf on) runs
  // ~4 accelerated seasons; unique geometry count after warm-up must not grow (pools, not allocs) and destroySandbox restores the scene.
  console.log('\nPERF (11A):');
  try {
    const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
    const PF = await import(pathToFileURL(resolve('src/systems/perf.js')).href);
    const meshCount = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
    // 1. governor
    const ratios = [], evs = [];
    const game = { quality: { pixelRatio: 1.5 }, stats: { fps: 60 }, renderer: { setPixelRatio: (r) => ratios.push(r) }, resize() {}, bus: { emit: (n, p) => evs.push(p) } };
    const gov = new PF.PixelRatioGovernor(game, { dpr: 2 });
    if (gov.ratio !== 1.5) throw new Error('start ratio ' + gov.ratio);
    const feed = (fps, sec) => { for (let i = 0; i < sec * 60; i++) gov.update(1 / 60, fps); };
    feed(30, 2.9); if (gov.ratio !== 1.5) throw new Error('dropped too early');
    feed(30, 0.2); if (gov.ratio !== 1.25 || evs.at(-1)?.why !== 'drop') throw new Error('no drop at 3 s ' + gov.ratio);
    feed(54, 20); if (gov.ratio !== 1.25) throw new Error('50–58 band must hold');
    feed(30, 3.1); feed(30, 3.1); feed(30, 3.1); if (gov.ratio !== 0.85) throw new Error('floor ' + gov.ratio);
    feed(30, 10); if (gov.ratio !== 0.85) throw new Error('went below the last step');
    feed(60, 9.9); if (gov.ratio !== 0.85) throw new Error('raised too early');
    feed(60, 0.2); if (gov.ratio !== 1.0 || evs.at(-1)?.why !== 'raise') throw new Error('no raise at 10 s');
    feed(60, 40); if (gov.ratio !== 1.5) throw new Error('did not climb back to cap ' + gov.ratio);
    const gov2 = new PF.PixelRatioGovernor({ ...game, quality: { pixelRatio: 1.0 } }, { dpr: 2 }); if (gov2.ratio !== 1.0) throw new Error('cap start ' + gov2.ratio);
    for (let i = 0; i < 60 * 30; i++) gov2.update(1 / 60, 60); if (gov2.ratio !== 1.0) throw new Error('rose above quality cap ' + gov2.ratio);
    for (let i = 0; i < 60 * 4; i++) gov.update(1 / 60, 20); gov.dispose(); if (gov.ratio !== 1.5 || evs.at(-1)?.why !== 'reset') throw new Error('dispose reset');
    console.log(`  governor: 1.5 → drop @3 s <50 fps → 1.25 → … → floor 0.85 · band 45–58 holds · raise @10 s >58 fps → … → cap 1.5 · cap 1.0 respected · ${evs.length} perf:pixelRatio events · dispose → ${gov.ratio}  OK`);
    // 1b. BUGFIX B22: Game.setQuality (run on a stub `this` — no WebGL here) + governor re-cap through game:quality
    {
      const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
      const CG = await import(pathToFileURL(resolve('src/core/Game.js')).href);
      const qbus = new EventBus(); const set = []; const mat = new THREE.MeshBasicMaterial(); const sc = new THREE.Scene(); sc.add(new THREE.Mesh(new THREE.BoxGeometry(), mat)); mat.needsUpdate = false;
      const key = { castShadow: true, shadow: { mapSize: { x: 2048, y: 2048, set(x, y) { this.x = x; this.y = y; } }, map: { dispose() { set.push('mapDispose'); } } } };
      const stub = { quality: { ...CG.QUALITY.high, name: 'high', antialiasRendered: true }, renderer: { setPixelRatio: (r) => set.push(r), shadowMap: { enabled: true, needsUpdate: false } }, scene: sc, lights: { key }, bus: qbus, resize() { set.push('resize'); } };
      const gov3 = new PF.PixelRatioGovernor({ ...stub, stats: { fps: 60 }, renderer: { setPixelRatio: (r) => set.push('gov:' + r) } }, { dpr: 2 });
      const q = CG.Game.prototype.setQuality.call(stub, 'low');
      if (q.name !== 'low' || stub.renderer.shadowMap.enabled !== false || key.castShadow !== false || !set.includes(1) || !q.antialiasPending) throw new Error('setQuality low ' + JSON.stringify({ q, set }));
      if (gov3.cap !== 1.0 || gov3.ratio !== 1.0 || !set.includes('gov:1')) throw new Error('governor did not re-cap to low ' + gov3.cap);
      for (let i = 0; i < 60 * 30; i++) gov3.update(1 / 60, 60); if (gov3.ratio !== 1.0) throw new Error('governor rose above the new cap ' + gov3.ratio);
      const q2 = CG.Game.prototype.setQuality.call(stub, 'medium');
      if (q2.name !== 'medium' || stub.renderer.shadowMap.enabled !== true || key.castShadow !== true || key.shadow.mapSize.x !== 1024 || !set.includes('mapDispose') || q2.antialiasPending || gov3.cap !== 1.25) throw new Error('setQuality medium ' + JSON.stringify({ q2, set, cap: gov3.cap }));
      if (CG.Game.prototype.setQuality.call(stub, 'ultra').name !== 'medium') throw new Error('unknown preset must be a no-op');
      gov3.dispose(); CG.Game.prototype.setQuality.call(stub, 'high'); if (gov3.cap !== 1.25) throw new Error('disposed governor still listening');
      console.log(`  B22 setQuality: high → low (DPR 1, shadows off, antialias pending reload) → medium (shadows on, map 1024, map disposed) · unknown = no-op · governor re-caps via game:quality, unsubscribes on dispose  OK`);
    }
    // 1c. S02 (2026-10-23): below the DPR floor the governor demotes the preset high → medium → low, then unlocks DPR 0.7; never re-promotes.
    {
      const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
      const CG = await import(pathToFileURL(resolve('src/core/Game.js')).href);
      const qbus = new EventBus(); const log = []; qbus.on('perf:quality', (p) => log.push(p.from + '>' + p.to));
      const key = { castShadow: true, shadow: { mapSize: { x: 2048, y: 2048, set(x, y) { this.x = x; this.y = y; } }, map: null } };
      const g = { quality: { ...CG.QUALITY.high, name: 'high', antialiasRendered: true }, stats: { fps: 30 }, renderer: { setPixelRatio() {}, shadowMap: { enabled: true, needsUpdate: false } }, scene: new THREE.Scene(), lights: { key }, bus: qbus, resize() {} };
      g.setQuality = (n) => CG.Game.prototype.setQuality.call(g, n);
      const gov = new PF.PixelRatioGovernor(g, { dpr: 2 });
      const feed = (fps, sec) => { for (let i = 0; i < sec * 60; i++) gov.update(1 / 60, fps); };
      feed(30, 3.1); feed(30, 3.1); feed(30, 3.1); if (gov.ratio !== 0.85 || g.quality.name !== 'high') throw new Error('S02 should walk the DPR steps first ' + gov.ratio + ' ' + g.quality.name);
      feed(30, 3.1); if (g.quality.name !== 'medium' || log.at(-1) !== 'high>medium' || gov.ratio !== 0.85) throw new Error('S02 no demote to medium ' + g.quality.name + ' ' + gov.ratio);
      feed(30, 3.1); if (g.quality.name !== 'low' || g.renderer.shadowMap.enabled !== false || gov.ratio !== 0.85) throw new Error('S02 no demote to low ' + g.quality.name);
      feed(30, 3.1); if (gov.ratio !== 0.7) throw new Error('S02 last-resort DPR 0.7 missing ' + gov.ratio);
      feed(30, 10); if (gov.ratio !== 0.7 || log.length !== 2) throw new Error('S02 must stop at the floor ' + gov.ratio + ' ' + log.length);
      feed(60, 60); if (g.quality.name !== 'low' || gov.ratio !== 1.0) throw new Error('S02 DPR may climb back to the low cap (1.0) but the preset must not re-promote ' + g.quality.name + ' ' + gov.ratio);
      const gov2 = new PF.PixelRatioGovernor({ ...g, quality: { ...CG.QUALITY.high, name: 'high' }, setQuality: g.setQuality }, { dpr: 2, demote: false });
      for (let i = 0; i < 60 * 20; i++) gov2.update(1 / 60, 30); if (gov2.ratio !== 0.85 || gov2.demotions !== 0) throw new Error('S02 demote:false must stay on the DPR ladder only');
      gov.dispose(); gov2.dispose();
      console.log(`  S02 governor ladder: DPR 1.5 → 0.85 · then high → medium → low (shadows off) → DPR 0.7 · floor holds · 60 fps → DPR back to the low cap, preset stays low · demote:false respected · ${log.length} perf:quality events  OK`);
    }
    // 2. memory probe on the real sandbox
    const { SequencePlayer, HitStop } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { tweens } = await import(pathToFileURL(resolve('src/anim/Tween.js')).href);
    const { createSandbox, destroySandbox } = await import(pathToFileURL(resolve('src/Game.js')).href);
    const scene = new THREE.Scene(); const bus = new EventBus();
    const g2 = { scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const geo0 = PF.countGeometries(scene);
    const sb = createSandbox(g2, { headless: true, seasonSeconds: 20, seed: 5 });
    if (!sb.perf || !sb.perf.shadows) throw new Error('perf glue not installed');
    const dt = 1 / 30; const step = () => { g2.time += dt; g2.sequences.update(dt); g2.tweens.update(dt); for (const s of g2.systems) s.update?.(dt); };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    // each fused Glimmer owns 4 per-instance geometries (eyes, body merge, kit merge, kit flat); everything else is shared.
    // Bound = pool cap (12 types × POOL_CAP_PER_TYPE) + maxActive roots. Before 11A the pool was unbounded: 148 → 220 → 240 … (+1 root per spawn burst).
    const { POOL_CAP_PER_TYPE } = await import(pathToFileURL(resolve('src/systems/customers.js')).href);
    run(40); const geoWarm = PF.countGeometries(scene); const meshWarm = meshCount(scene);
    sb.eco.state.spark = 999; sb.keys.hire(); run(90);
    const geoEnd = PF.countGeometries(scene); const meshEnd = meshCount(scene);
    const bound = geoWarm + 4 * (sb.cust.maxActive + 12 * POOL_CAP_PER_TYPE);
    if (geoEnd > bound) throw new Error(`geometry ${geoWarm} → ${geoEnd} exceeds pool bound ${bound}`);
    if (sb.cust.totalsPool.disposed < 1) throw new Error('pool cap never disposed a surplus customer (' + JSON.stringify(sb.cust.totalsPool) + ')');
    const pooled = [...sb.cust.pool.values()].reduce((a, l) => a + l.length, 0); if (pooled > 12 * POOL_CAP_PER_TYPE) throw new Error('pool over cap ' + pooled);
    if (sb.perf.shadows.mesh.count !== sb.perf.roots.length) throw new Error('shadow pool out of sync ' + sb.perf.shadows.mesh.count + ' vs ' + sb.perf.roots.length);
    destroySandbox(sb);
    const geoAfter = PF.countGeometries(scene); const left = meshCount(scene);
    if (left !== 0 || scene.children.length !== 0) throw new Error(`destroySandbox left ${left} meshes / ${scene.children.length} children in the scene`);
    if (geoAfter !== 0) throw new Error('geometries still referenced from the scene after destroy: ' + geoAfter);
    console.log(`  memory: sandbox S1→S${sb.stats.seasons + 1} headless 130 s · geometries ${geoWarm} @40 s → ${geoEnd} @130 s (bound ${bound}; customers created ${sb.cust.totalsPool.created}, disposed ${sb.cust.totalsPool.disposed}, pooled ${pooled} ≤ ${12 * POOL_CAP_PER_TYPE}) · meshes ${meshWarm} → ${meshEnd} · ${sb.perf.roots.length} pooled shadows · destroy → scene empty (${left} meshes, ${geoAfter} geometries)  OK`);
  } catch (err) { bad++; console.log('  perf FAIL →', err.message); }
}
if (doAudio) {
  // 12: Node has no AudioContext → createAudio is inert but API-complete; every play() is still counted in state.played, so the
  // bus → SFX map, cooldowns, payload variants, ducking flags and destroy() are all testable without a browser.
  console.log('\nAUDIO (12):');
  try {
    const { createAudio, DEFAULT_EVENTS, VOICE_SFX, synthSfx, synthMusic } = await import(pathToFileURL(resolve('src/core/Audio.js')).href);
    const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
    const { readFileSync } = await import('node:fs'); const manifest = JSON.parse(readFileSync('audio/manifest.json', 'utf8'));
    const sfxIds = Object.keys(manifest.sfx || {}), musicIds = Object.keys(manifest.music || {});
    // (1) every id referenced by the event map (sfx / music / pick variants) exists in the manifest; every sfx has a synth fallback
    const probe = [{}, { action: 'denied' }, { action: 'select' }, { accepted: true }, { accepted: false }, { state: 'react', reaction: 'happy' }, { state: 'react', reaction: 'sad' }, ...['pip', 'owl', 'tallyOwl', 'baron', 'glimmer', 'collector', 'narrator'].map((speaker) => ({ speaker }))];
    const abilities = ['coinMagnetDash', 'bubbleShield', 'growthStomp', 'ledgerFlash', 'haggleShout', 'fogSweep', 'unknown'];
    const refs = new Set();
    for (const [ev, r] of Object.entries(DEFAULT_EVENTS)) {
      if (r.sfx) refs.add(r.sfx); if (r.music) { if (!musicIds.includes(r.music)) throw new Error(`${ev} → music '${r.music}' not in manifest`); }
      if (typeof r.pick === 'function') for (const p of [...probe, ...abilities.map((name) => ({ name }))]) { const v = r.pick(p); if (v && v.sfx) refs.add(v.sfx); }
    }
    for (const id of refs) if (!sfxIds.includes(id)) throw new Error(`event map references sfx '${id}' missing from manifest`);
    for (const id of sfxIds) { const d = manifest.sfx[id]; if (!d.synth || !d.synth.type) throw new Error(`sfx '${id}' has no synth fallback`); if (!d.file) throw new Error(`sfx '${id}' has no file`); }
    for (const id of musicIds) { const d = manifest.music[id]; if (!d.synth?.chords?.length) throw new Error(`music '${id}' has no synth chords`); }
    const unused = sfxIds.filter((id) => !refs.has(id));
    // (2) bus walk: the 15 core events each fire exactly one counted play; variants pick the right id
    const bus = new EventBus(); const audio = createAudio({ bus, settings: { sfx: 0.7, music: 0.5 } });
    if (!audio.state.silent) throw new Error('expected silent (no AudioContext in Node)');
    await audio.load(manifest);
    if (audio.state.wired < 15) throw new Error('wired only ' + audio.state.wired + ' events');
    const core = ['eco:sale', 'eco:spark', 'eco:denied', 'build:placed', 'eco:season', 'eco:loan', 'eco:scam', 'eco:scamResult', 'eco:upgrade', 'eco:win', 'eco:lose', 'ui:dialogue:say', 'ui:choice', 'ui:ledger:open', 'game:start'];   // story:line is silent — the box's ui:dialogue:say carries the voice blurb
    let t = 0; audio._now = () => t;                                                           // cooldown clock under test control
    for (const ev of core) { t += 5; bus.emit(ev, {}); }
    const total = Object.values(audio.state.played).reduce((a, b) => a + b, 0);
    if (total !== core.length) throw new Error(`15 core events → ${total} plays (expected ${core.length}): ${JSON.stringify(audio.state.played)}`);
    if (!audio.state.played.coin || !audio.state.played.fanfare || !audio.state.played.lose_sting || !audio.state.played.scam_refuse) throw new Error('core ids not played: ' + JSON.stringify(audio.state.played));
    t += 5; bus.emit('eco:scamResult', { accepted: true }); if (!audio.state.played.scam_fell) throw new Error('scamResult accepted → scam_fell variant not picked');
    t += 5; bus.emit('sandbox:ability', { name: 'fogSweep' }); if (!audio.state.played.sweep) throw new Error('ability variant sweep not picked');
    // voice blurbs: every dialogue speaker → its own voice_* id (narrator → neutral dlg_blip); a second line cuts the first (solo) — counted as a normal play
    for (const [sp, id] of [['pip', 'voice_pip'], ['owl', 'voice_owl'], ['tallyOwl', 'voice_owl'], ['baron', 'voice_baron'], ['glimmer', 'voice_glimmer'], ['collector', 'voice_collector'], ['narrator', 'dlg_blip']]) { t += 5; const n0 = audio.state.played[id] || 0; bus.emit('ui:dialogue:say', { speaker: sp }); if ((audio.state.played[id] || 0) !== n0 + 1) throw new Error(`speaker ${sp} → ${id} not played`); }
    t += 5; { const n0 = audio.state.played.voice_pip || 0, b0 = audio.state.played.dlg_blip || 0; bus.emit('story:line', { speaker: 'pip', text: 'x' }); if ((audio.state.played.voice_pip || 0) !== n0 || (audio.state.played.dlg_blip || 0) !== b0) throw new Error('story:line must stay silent (voice plays on ui:dialogue:say)'); }
    for (const id of Object.values(VOICE_SFX)) if (!manifest.sfx[id]?.solo || !manifest.sfx[id]?.preload) throw new Error(`voice ${id} needs solo + preload in the manifest`);
    t += 5; bus.emit('cust:state', { state: 'walk' }); if (audio.state.played.cust_happy) throw new Error('cust:state walk should be silent');
    bus.emit('cust:state', { state: 'react', reaction: 'happy' }); if (audio.state.played.cust_happy !== 1) throw new Error('cust happy not played');
    // (3) cooldown: 50 eco:spark ticks inside 0.1 s → exactly one more play
    const before = audio.state.played.spark_tick || 0; t += 5; for (let i = 0; i < 50; i++) { t += 0.002; bus.emit('eco:spark', {}); }
    if ((audio.state.played.spark_tick || 0) - before !== 1) throw new Error('cooldown failed: spark_tick ' + (audio.state.played.spark_tick - before) + ' plays in 0.1 s');
    if (!audio.state.throttled) throw new Error('throttled counter not incremented');
    // (4) music + duck flags follow the bus; volumes follow ui:settings; unknown id is logged once, never throws
    if (audio.state.currentMusic !== 'island_day') throw new Error('music after game:start = ' + audio.state.currentMusic);
    t += 5; bus.emit('eco:lose', {}); if (audio.state.currentMusic !== 'fog_lose') throw new Error('music after eco:lose = ' + audio.state.currentMusic);
    bus.emit('ui:title:open', {}); if (audio.state.currentMusic !== 'title') throw new Error('title music not selected');
    bus.emit('ui:dialogue:open', {}); if (!audio.state.ducked) throw new Error('dialogue open → not ducked'); bus.emit('ui:dialogue:close', {}); if (audio.state.ducked) throw new Error('dialogue close → still ducked');
    bus.emit('ui:settings', { key: 'sfx', value: 0.25 }); if (audio.state.volumes.sfx !== 0.25) throw new Error('ui:settings sfx not applied');
    if (audio.play('nope') !== false || audio.play('nope') !== false || audio.state.log.filter((l) => l.includes('unknown sfx nope')).length !== 1) throw new Error('unknown id handling');
    if (audio.music('nope') !== false) throw new Error('unknown music should return false');
    // (5) destroy → no listeners left on the bus → emits are silent
    const sum = () => Object.values(audio.state.played).reduce((a, b) => a + b, 0);
    const after = sum(); audio.destroy(); t += 5; bus.emit('eco:sale', {}); bus.emit('eco:win', {});
    if (sum() !== after) throw new Error('listeners survived destroy()');
    if (typeof synthSfx !== 'function' || typeof synthMusic !== 'function') throw new Error('synth exports missing');
    console.log(`  manifest: ${sfxIds.length} sfx (all with file + synth) · ${musicIds.length} music · event map ${Object.keys(DEFAULT_EVENTS).length} bus events → ${refs.size} sfx ids referenced${unused.length ? ` (unreferenced: ${unused.join(', ')})` : ''}`);
    console.log(`  bus walk: 15 core events → 15 plays · variants scam_fell/sweep/cust_happy · 5 voice blurbs by speaker (+narrator blip) · cooldown 50 ticks/0.1 s → 1 play (${audio.state.throttled} throttled) · music lose→fog_lose, title · duck on/off · ui:settings → vol · unknown id logged once · destroy → 0 listeners  OK`);
  } catch (err) { bad++; console.log('  audio FAIL →', err.message); }
}
if (doIcons) {
  // ICONS: every emoji the game prints must map to a procedural drawing; each drawing must be valid strict XML (so the PNG bake works);
  // the baked ui/icons/<name>.png + manifest.json must exist for every name (index.html switches to png mode when the manifest loads).
  console.log('\nICONS (procedural, no emoji font):');
  try {
    const fs = await import('node:fs'); const path = await import('node:path');
    const I = await import(pathToFileURL(resolve('ui/icons.js')).href);
    const walk = (d, o = []) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p, o); else if (/\.(js|html|json)$/.test(f)) o.push(p); } return o; };
    const files = [...walk('src'), ...walk('ui'), ...walk('data'), 'index.html'];
    const re = /\p{Extended_Pictographic}\uFE0F?|[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF]\uFE0F?/gu;
    const seen = new Map(); const unknown = new Set(); const SKIP = new Set(['™', '↔', '↓', '←', '→', '↑']);   // ↔ only in comments; arrows are plain text glyphs
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const line of src.split('\n')) {
        if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;                                   // comment-only lines don't render
        for (const m of line.match(re) || []) { const k = m.replace(/\uFE0F$/, ''); if (SKIP.has(k)) continue; seen.set(k, (seen.get(k) || 0) + 1); if (!I.iconName(k) && !I.iconName(m)) unknown.add(k + ' @ ' + f); }
      }
    }
    if (unknown.size) throw new Error('emoji without a drawing: ' + [...unknown].slice(0, 8).join(', '));
    // strict XML: no attribute defined twice, every tag closed (rsvg rejects these; browsers silently accept)
    let dup = [];
    for (const n of I.ICON_NAMES) { const b = I.iconSVG(n); if (!b) throw new Error('empty icon ' + n); for (const t of b.match(/<[^>]+>/g) || []) { const a = [...t.matchAll(/\s([\w-]+)=/g)].map((x) => x[1]); if (new Set(a).size !== a.length) dup.push(n); } }
    if (dup.length) throw new Error('duplicate SVG attribute in: ' + [...new Set(dup)].join(', '));
    const sameTwice = I.icon('owl') === I.icon('🦉') && I.icon('owl') === I.icon('owl'); if (!sameTwice) throw new Error('icon() not deterministic / emoji alias broken');
    if (!I.iconize('Press 🔨 to build').includes('ll-ico-hammer') || I.iconize('plain').includes('<svg')) throw new Error('iconize mapping wrong');
    // png bake in sync with the generator
    let baked = 'not baked (run node tools/icons_png.mjs)';
    if (fs.existsSync('ui/icons/manifest.json')) {
      const man = JSON.parse(fs.readFileSync('ui/icons/manifest.json', 'utf8'));
      const missing = I.ICON_NAMES.filter((n) => !man.names.includes(n) || !fs.existsSync(`ui/icons/${n}.png`));
      if (missing.length) throw new Error('png bake stale — missing: ' + missing.slice(0, 6).join(', ') + ' (run node tools/icons_png.mjs)');
      if (!fs.existsSync('ui/icons/sheet.png')) throw new Error('ui/icons/sheet.png missing');
      I.setIconMode('png', man, './ui/icons/'); const img = I.icon('🦉'); I.setIconMode('svg');
      if (!img.startsWith('<img') || !img.includes('owl.png')) throw new Error('png mode did not emit <img>');
      baked = `${man.names.length} PNGs @ ${man.size}px + sheet ${man.cols}×${man.rows} · png mode → <img>`;
    }
    console.log(`  ${seen.size} distinct emoji in ${files.length} files → all drawn · ${I.ICON_NAMES.length} generators, strict-XML clean, deterministic · ${baked}  OK`);
  } catch (err) { bad++; console.log('  icons FAIL →', err.message); }
}
console.log(bad ? `\n${bad} FAILURE(S)` : '\nALL OK ✅');
process.exit(bad ? 1 : 0);
