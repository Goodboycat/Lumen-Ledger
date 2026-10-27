// tools/gates/knockback.mjs — S32 headless gate: `node tools/check.mjs --knockback`
// Proves the three S32 pieces without a browser:
//   1. CreatureAnimator.hit → real knockback: slides AWAY from the attacker, exponential decay (KNOCK_DECAY), total travel
//      ≈ 0.9 u at power 1, `knocked` opens then closes (KNOCK_STUN), canStand clamp (water wall → slide stops / axis-slides).
//   2. CustomerSystem is knockback-aware: a walking customer that is hit stays on walkable cells, pauses steering while
//      knocked, then re-paths (field rebuilt) and still arrives / pays; a browsing customer walks back to its slot.
//   3. Helpers are sword targets (createSandbox): helperTargets hit → slide + 'helper:hit' event + walk back to seat → 'work'.
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  const THREE = await imp('vendor/three.module.js');
  console.log('\nKNOCKBACK (S32):');

  // ---------------------------------------------------------------------------------------------------------------
  // 1. animator physics
  try {
    const { makeGlimmerAny, CreatureAnimator } = await imp('src/assets/creatures/index.js');
    const { KNOCK_SPEED, KNOCK_DECAY, KNOCK_STUN } = await imp('src/assets/creatures/animator.js');
    const mk = (opts) => { const g = makeGlimmerAny('regular', { seed: 4 }); g.position.set(0, 0, 0); return { g, a: new CreatureAnimator(g, opts) }; };
    const dt = 1 / 60;
    // a) free slide, attacker at -x → target slides +x, decays, stops
    { const { g, a } = mk({});
      a.hit(new THREE.Vector3(1, 0, 0), 1);
      if (!a.knocked || a.knockT < KNOCK_STUN - 1e-6) throw new Error('knocked window not opened');
      const sp0 = a.knock.length(); if (Math.abs(sp0 - KNOCK_SPEED) > 1e-6) throw new Error(`initial speed ${sp0}`);
      let maxZ = 0, prevX = 0, monotonic = true, framesKnocked = 0;
      for (let i = 0; i < 120; i++) { a.update(dt); if (a.knocked) framesKnocked++; maxZ = Math.max(maxZ, Math.abs(g.position.z)); if (g.position.x < prevX - 1e-9) monotonic = false; prevX = g.position.x; }
      const travel = g.position.x, expect = KNOCK_SPEED / KNOCK_DECAY;   // continuous-decay integral ≈ v0/λ
      if (!(travel > expect * 0.75 && travel < expect * 1.15)) throw new Error(`travel ${travel.toFixed(3)} vs ≈${expect.toFixed(3)}`);
      if (maxZ > 1e-6 || !monotonic) throw new Error('slide not straight / reversed');
      if (a.knocked) throw new Error('still knocked after 2 s');
      if (framesKnocked < KNOCK_STUN * 60 - 2) throw new Error(`stun too short ${framesKnocked} frames`);
      if (a.knock.lengthSq() !== 0) throw new Error('knock vector not zeroed');
      // power scales distance & stun, clamps stun ×2
      const { g: g2, a: a2 } = mk({}); a2.hit(new THREE.Vector3(1, 0, 0), 2); const st2 = a2.knockT; for (let i = 0; i < 180; i++) a2.update(dt);
      if (!(g2.position.x > travel * 1.7) || Math.abs(st2 - KNOCK_STUN * 2) > 1e-6) throw new Error(`power 2: travel ${g2.position.x.toFixed(2)} stun ${st2}`);
      const { a: a3 } = mk({}); a3.hit(new THREE.Vector3(1, 0, 0), 5); if (Math.abs(a3.knockT - KNOCK_STUN * 2) > 1e-6) throw new Error('stun not clamped at ×2');
      // facing: looks back toward the attacker (−x)
      const { a: a4 } = mk({}); a4.hit(new THREE.Vector3(1, 0, 0), 1); for (let i = 0; i < 30; i++) a4.update(dt);
      if (!(a4.facing.x < -0.9)) throw new Error('does not face attacker ' + a4.facing.x.toFixed(2));
      // y ignored, zero dir → no slide but still the squash reaction
      const { g: g5, a: a5 } = mk({}); a5.hit(new THREE.Vector3(0, 1, 0), 1); for (let i = 0; i < 30; i++) a5.update(dt); if (g5.position.lengthSq() > 1e-9) throw new Error('vertical dir moved the root');
      const { a: a6 } = mk({}); a6.hit(null, 1); if (a6.knocked) throw new Error('null dir knocked');
      console.log(`  slide: ${travel.toFixed(2)} u at power 1 (≈${expect.toFixed(2)}), straight, stun ${framesKnocked} f, power 2 → ${g2.position.x.toFixed(2)} u, faces attacker, y/null dir ignored  OK`);
    }
    // b) land clamp: wall at x ≥ 0.4 → slide stops at the wall; diagonal → z keeps sliding (axis clamp)
    { const { g, a } = mk({ canStand: (x) => x < 0.4 });
      a.hit(new THREE.Vector3(1, 0, 0), 1); for (let i = 0; i < 120; i++) a.update(dt);
      if (g.position.x >= 0.4 || g.position.x < 0.3) throw new Error(`wall clamp x=${g.position.x.toFixed(3)}`);
      if (a.knocked) throw new Error('stuck knocked at wall');
      const { g: gd, a: ad } = mk({ canStand: (x) => x < 0.2 });
      ad.hit(new THREE.Vector3(1, 0, 1), 1); for (let i = 0; i < 120; i++) ad.update(dt);
      if (gd.position.x >= 0.2 || !(gd.position.z > 0.4)) throw new Error(`diagonal clamp x=${gd.position.x.toFixed(2)} z=${gd.position.z.toFixed(2)}`);
      const { g: gw, a: aw } = mk({ canStand: () => false });
      aw.hit(new THREE.Vector3(1, 0, 0), 1); aw.update(dt); if (gw.position.lengthSq() > 1e-9 || aw.knock.lengthSq() !== 0) throw new Error('blocked everywhere still moved');
      console.log(`  canStand clamp: wall stops at x=${g.position.x.toFixed(2)} (<0.4), diagonal slides along z=${gd.position.z.toFixed(2)}, fully blocked = no move  OK`);
    }
  } catch (err) { bad++; console.log('  animator FAIL →', err.message.split('\n')[0]); }

  // ---------------------------------------------------------------------------------------------------------------
  // 2. customers: knock a walker + a browser, require walkable positions, re-path, payment still happens
  try {
    const { SequencePlayer } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { Island } = await imp('src/world/Island.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { makeEconomy } = await imp('src/systems/economyData.js');
    const { BuildSystem } = await imp('src/systems/build.js');
    const { CustomerSystem } = await imp('src/systems/customers.js');
    const { makeGlimmerAny, CreatureAnimator } = await imp('src/assets/creatures/index.js');
    const island = new Island({ radius: 11, seed: 7, starterProps: false });
    const bus = new EventBus(); const ev = {}; for (const n of ['cust:paid', 'cust:left', 'cust:angry']) bus.on(n, (p) => { (ev[n] ??= []).push(p); });
    const vfx = { dust: { burst() {}, ring() {} }, pop: { show() {} }, sparks: { burst() {} } };
    const game = { scene: new THREE.Scene(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false }, sequences: new SequencePlayer(), bus, camera: { shake() {} }, time: 0, followTarget: new THREE.Vector3(), systems: [], add(s) { this.systems.push(s); return s; } };
    const eco = makeEconomy({ bus, seed: 1, autoSeason: false }); eco.state.spark = 1000;
    const build = new BuildSystem(game, { island, economy: eco, catalog: PROP_CATALOG, vfx });
    for (const [id, cx, cz] of [['stall_fruit', -3, -2], ['stall_bread', 1, -2], ['stall_tea', -1, 2]]) if (!build.place(id, cx, cz, 0, { animate: false })) throw new Error('could not place ' + id);
    const cust = new CustomerSystem(game, { island, build, economy: eco, vfx, creatures: { makeGlimmer: (t) => makeGlimmerAny(t, { seed: 2 }), CreatureAnimator }, seed: 5, maxActive: 20 });
    const step = (dt = 1 / 30) => { build.update(dt); cust.update(dt); game.sequences.update(dt); game.time += dt; };
    const live = () => cust.active.filter((c) => c.state !== 'pooled' && c.state !== 'despawn');
    const walkableAll = (what) => { for (const c of live()) { const p = c.root.position; if (!isFinite(p.x) || !isFinite(p.z)) throw new Error('NaN ' + what); if (!island.isLand(p.x, p.z)) throw new Error(`${c.type} in water (${c.state}) ${what}`); if (build.occupied(p.x, p.z)?.id?.startsWith?.('stall_')) throw new Error(`${c.type} inside stall (${c.state}) ${what}`); } };
    const hitAll = (power = 1) => { let n = 0; for (const c of live()) { if (!c.anim) continue; const d = new THREE.Vector3(c.root.position.x - 0, 0, c.root.position.z - 0); if (d.lengthSq() < 1e-6) d.set(1, 0, 0); c.anim.hit(d, power); n++; } return n; };   // Pip at origin shoves everyone outward
    // spawn a wave, let them start walking
    cust.spawnWave(3); for (let i = 0; i < 90; i++) step();
    const walker = live().find((c) => c.state === 'walk');
    if (!walker) throw new Error('no walking customer after 3 s (' + live().map((c) => c.state).join(',') + ')');
    if (!walker.anim.canStand) throw new Error('customer animator has no canStand clamp');
    const before = walker.root.position.clone(); const hadField = !!walker.field;
    const n = hitAll(1); if (n < 1) throw new Error('nothing to hit');
    step(); if (!walker.anim.knocked) throw new Error('walker not knocked'); if (walker.field) throw new Error('field not dropped on hit');
    let kf = 0; while (walker.anim.knocked && kf < 120) { step(); kf++; walkableAll('during slide'); }
    if (kf === 0 || kf >= 120) throw new Error('slide frames ' + kf);
    const moved = before.distanceTo(walker.root.position); if (!(moved > 0.15)) throw new Error(`walker barely moved ${moved.toFixed(2)} (hadField ${hadField})`);
    for (let i = 0; i < 30; i++) step(); walkableAll('after slide');
    if (walker.state === 'walk' && !walker.field) throw new Error('walker did not re-path');
    // keep shoving everyone every 2 s for 20 s; nobody may leave walkable ground, no NaN, and sales still happen
    let shoves = 0; for (let s = 0; s < 20 * 30; s++) { if (s % 60 === 0) { hitAll(1 + (s / 60) % 2); shoves++; } step(); if (s % 7 === 0) walkableAll('t=' + (s / 30).toFixed(1)); }
    for (let i = 0; i < 15 * 30; i++) step();
    walkableAll('end');
    if (!(ev['cust:paid']?.length > 0)) throw new Error('no sale after knockbacks');
    // browse case: find someone browsing / queued, shove them away > ARRIVE_R*2, they must come back to their slot
    let browser = null; for (let i = 0; i < 20 * 30 && !browser; i++) { step(); browser = live().find((c) => (c.state === 'browse' || c.state === 'queue') && c.target); }
    let backMsg = 'n/a';
    if (browser) {
      const slot = { x: browser.target.x, z: browser.target.z }; const st0 = browser.state;
      const away = new THREE.Vector3(browser.root.position.x - 0, 0, browser.root.position.z - 0); if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
      browser.anim.hit(away, 2); let reWalked = false; let minD = Infinity;
      for (let i = 0; i < 8 * 30; i++) { step(); if (browser.state === 'walk') reWalked = true; const d = Math.hypot(browser.target?.x - browser.root.position.x || 0, browser.target?.z - browser.root.position.z || 0); if (browser.state !== 'walk' && browser.state !== 'leave') minD = Math.min(minD, d); if (browser.state === 'leave' || browser.state === 'pooled') break; }
      walkableAll('browser back');
      if (!reWalked && !(minD < 0.6)) throw new Error(`${st0}er never walked back (state ${browser.state}, minD ${minD.toFixed(2)})`);
      backMsg = `${st0} → shoved ×2 → walk back (${reWalked ? 'walk state seen' : 'slide stayed in slot'}), ends ${browser.state}`;
    }
    console.log(`  customers: walker knocked ${kf} f (moved ${moved.toFixed(2)} u, field dropped → re-pathed), ${shoves} wave-shoves, always on walkable cells, ${ev['cust:paid'].length} sales · ${backMsg}  OK`);
  } catch (err) { bad++; console.log('  customers FAIL →', err.message.split('\n')[0]); }

  // ---------------------------------------------------------------------------------------------------------------
  // 3. helpers as sword targets inside createSandbox
  try {
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createSandbox } = await imp('src/Game.js');
    const bus = new EventBus(); const ev = {}; for (const n of ['helper:hit', 'sandbox:hired']) bus.on(n, (p) => { (ev[n] ??= []).push(p); });
    const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const sb = createSandbox(game, { headless: true, seasonSeconds: 300, seed: 3 });
    const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); };
    sb.eco.state.spark = 999; const h = sb.keys.hire(); if (!h || !h.seat || !h.anim.canStand) throw new Error('hire / seat / canStand');
    for (let i = 0; i < 30; i++) step();
    if (h.anim.current !== 'work' && h.stall) throw new Error('helper not working: ' + h.anim.current);
    // helpers are in the hero's target list
    const targets = sb.hero.deps.targets(); const tgt = targets.find((t) => t.helper === h); if (!tgt) throw new Error('helper missing from sword targets');
    // Glimmer targets exclude pooled/despawning
    if (targets.some((t) => sb.cust.active.find((c) => c.root === t.root && (c.state === 'pooled' || c.state === 'despawn')))) throw new Error('pooled customer in targets');
    const seat = { x: h.seat.x, z: h.seat.z };
    const dir = new THREE.Vector3(1, 0, 0.3); tgt.hit(dir, 1); step();
    if (!h.returning || !h.anim.knocked || !(ev['helper:hit']?.length === 1)) throw new Error('hit did not register');
    let kf = 0, far = 0; while (h.anim.knocked && kf < 120) { step(); kf++; far = Math.max(far, Math.hypot(h.g.position.x - seat.x, h.g.position.z - seat.z)); if (!sb.island.isLand(h.g.position.x, h.g.position.z)) throw new Error('helper slid into water'); const occ = sb.build.occupied(h.g.position.x, h.g.position.z); if (occ && occ !== h.stall && occ.id?.startsWith?.('stall_')) throw new Error('helper slid into another stall'); }
    if (!(far > 0.25)) throw new Error(`helper barely slid ${far.toFixed(2)}`);
    let walked = false, back = false; for (let i = 0; i < 6 * 30; i++) { step(); if (h.anim.current === 'walk') walked = true; if (!h.returning) { back = true; break; } }
    const dSeat = Math.hypot(h.g.position.x - seat.x, h.g.position.z - seat.z);
    if (!walked || !back || dSeat > 0.05 || h.anim.current !== (h.stall ? 'work' : 'idle')) throw new Error(`walk back: walked ${walked} back ${back} d ${dSeat.toFixed(2)} anim ${h.anim.current}`);
    // 3 hits → 2 ouch pops max rule is cosmetic; just check the counter and no spark cost
    // own-stall cell allowed (seat sits inside it), other stalls + water blocked
    if (!h.anim.canStand(seat.x, seat.z) || h.anim.canStand(99, 99)) throw new Error('canStand: seat must be standable, open sea not');
    const other = [...sb.build.placed.values()].find((e) => e !== h.stall && e.id.startsWith('stall_')); if (other && h.anim.canStand(other.group.position.x, other.group.position.z)) throw new Error('canStand allows another stall');
    const spark = sb.eco.state.spark; tgt.hit(dir, 1); tgt.hit(dir, 1); if (h.hitCount !== 3 || sb.eco.state.spark !== spark) throw new Error('hitCount / spark cost');
    for (let i = 0; i < 8 * 30; i++) step(); if (h.returning || h.anim.knocked) throw new Error('helper stuck after multi-hit');
    console.log(`  helpers: in targets, hit → slide ${far.toFixed(2)} u in ${kf} f (land + no-stall), 'helper:hit' ×${ev['helper:hit'].length}, walk back → seat (d ${dSeat.toFixed(2)}) → '${h.anim.current}', no Spark cost  OK`);
  } catch (err) { bad++; console.log('  helpers FAIL →', err.message.split('\n')[0]); }

  return bad;
}
