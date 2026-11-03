// tools/gates/raid.mjs — 42C headless gate: `node tools/check.mjs --raid`  (section "42C RAIDS")
// "Collectors raid TILLS, not Pip." Runs the REAL createSandbox (headless) and proves the enemies.js FSM seek → raid → carry → escape/drop:
//   • a Collector that lands while a till holds money SEEKS it (state 'seek', target = richest till ≤ range) instead of chasing Pip
//   • at the counter it telegraphs (state 'raid', raid:start, telegraph 1.2 s), then takes min(till, 6 + season) → state 'carry' + raid:take + till:change how:'raid'
//   • carrying it walks to the pier at speed × 0.8; stepping off → raid:escaped, ledger.raided += amount, stats.escaped++
//   • a sword hit while carrying → DROPS everything as ground tips (sandbox:tip Σ = carried), raid:drop, stun, state 'seek'
//   • a sword hit mid-raid → raid:cancel, the till keeps its money (refund path)
//   • Bubble Shield with Pip ≤ 2 u of the till → immune → raider re-targets / cancels ('shield')
//   • contact with Pip → pouch SPILLS (jars:spill, ground tips), eco.spark never goes below 0, jars untouched
//   • no till in range → old chase behaviour (state 'chase'); sendHome mid-carry → escape accounted
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n42C RAIDS:');
  try {
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createSandbox, destroySandbox } = await imp('src/Game.js');
    const { ENEMY_RULES, ACTIVE_STATES } = await imp('src/systems/enemies.js');
    const RR = ENEMY_RULES.raid;
    if (!RR || !(RR.range > 0) || !(RR.telegraph > 0) || !ACTIVE_STATES?.has('carry')) throw new Error('ENEMY_RULES.raid / ACTIVE_STATES missing');
    const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} });
    const bus = new EventBus(); const scene = new THREE.Scene(); const game = mkGame(bus, scene);
    const ev = {}; for (const n of ['raid:start', 'raid:take', 'raid:drop', 'raid:cancel', 'raid:escaped', 'raid:threat', 'raid:end', 'till:change', 'sandbox:tip', 'jars:spill', 'enemy:heroHit']) { ev[n] = []; bus.on(n, (p) => ev[n].push(p)); }
    const sb = createSandbox(game, { headless: true, seasonSeconds: 600, seed: 5 });
    const E = sb.enemies, T = sb.till; if (!E || !T) throw new Error('sb.enemies / sb.till missing');
    if (E.tills !== T) throw new Error('enemies.tills getter does not resolve to sb.till');
    E.enabled = false;                                          // we spawn by hand
    const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    // need a placed stall with a till. Use the first stall the sandbox already has (scenery/bakery) or place one.
    // tills are created lazily by T.pay → pick a placed stall (the sandbox pre-spawns some; else place one) and pay its till
    let stall = sb.build.stalls().find((st) => !st.entry?.scenery) || sb.build.stalls()[0];
    if (!stall) { const id = Object.keys(sb.build.catalog).find((k) => sb.build.catalog[k].category === 'stall'); sb.build.place(id, 0, 2, 0, { animate: false, pay: false, silent: true }); stall = sb.build.stalls()[0]; }
    if (!stall) throw new Error('no stall to raid');
    T.pay(stall.id, 1, {}); T.collect(stall.id, 'test'); const tills = T.all();
    if (!tills.length) throw new Error('no till to raid');
    const till = tills[0]; const farX = till.pos.x + 11, farZ = till.pos.z;                          // park Pip far from the till (no walk-collect, no shield)
    sb.hero.root.position.set(farX, 0, farZ);
    const spawnOne = () => { E.enabled = true; E.waveSeason = 0; const w = E.spawnWave(1); E.enabled = false; if (w.length !== 1) throw new Error('spawnWave(1) → ' + w.length); return w[0]; };
    const spark = (n) => { sb.eco.state.spark = n; };

    // ---------------------------------------------------------------- 1. seek → raid → carry → escape
    T.pay(till.stallId, 20, {}); if (T.get(till.stallId).amount !== 20) throw new Error('pay');
    let c = spawnOne();
    if (c.state !== 'seek' || c.target?.stallId !== till.stallId) throw new Error(`landed state ${c.state} target ${c.target?.stallId}`);
    let t0 = game.time; let guard = 0; while (c.state === 'seek' && guard++ < 60 * 30) step();
    if (c.state !== 'raid') throw new Error(`never reached the counter (state ${c.state}, dist ${Math.hypot(c.g.position.x - till.pos.x, c.g.position.z - till.pos.z).toFixed(1)})`);
    if (ev['raid:start'].length !== 1 || ev['raid:start'][0].stallId !== till.stallId || ev['raid:start'][0].telegraph !== RR.telegraph) throw new Error('raid:start ' + JSON.stringify(ev['raid:start'][0]));
    const tRaid = game.time, amtRaid = T.get(till.stallId).amount; run(RR.telegraph * 0.5); if (c.state !== 'raid' || T.get(till.stallId).amount < amtRaid) throw new Error(`took money before the telegraph ended (${amtRaid} → ${T.get(till.stallId).amount})`);   // customers may still top it up
    guard = 0; while (c.state === 'raid' && guard++ < 90) step();
    if (c.state !== 'carry') throw new Error('after telegraph state ' + c.state);
    const want = RR.takeBase + 1, tk = ev['raid:take'][0]; if (c.carry !== want || !tk || tk.amount !== want || tk.stallId !== till.stallId) throw new Error(`carry ${c.carry} (want ${want}) take ${JSON.stringify(tk)}`);
    if (!(game.time - tRaid >= RR.telegraph - dt * 2)) throw new Error('telegraph too short ' + (game.time - tRaid).toFixed(2));
    if (ev['raid:take'].length !== 1 || ev['raid:take'][0].amount !== want) throw new Error('raid:take ' + JSON.stringify(ev['raid:take'][0]));
    if (!ev['till:change'].some((p) => p.how === 'raid' && p.delta === -want)) throw new Error('till:change how:raid missing');
    if (!ev['raid:threat'].length || ev['raid:threat'].at(-1).state !== 'carry' || ev['raid:threat'].at(-1).amount !== want) throw new Error('raid:threat ' + JSON.stringify(ev['raid:threat'].at(-1)));
    // carry speed ≈ speed × carryMul towards the pier
    const p0 = c.g.position.clone(); run(1); const moved = p0.distanceTo(c.g.position); const R = E.rulesFor(c);
    if (!(moved > R.speed * RR.carryMul * 0.5) || moved > R.speed * 1.05) throw new Error(`carry speed ${moved.toFixed(2)} u/s (walk ${R.speed})`);
    const raided0 = sb.eco.ledger.raided || 0, exp0 = sb.eco.ledger.expenses || 0;
    guard = 0; while (E.list.includes(c) && guard++ < 40 * 30) step();
    if (E.list.includes(c)) throw new Error('carrier never left (state ' + c.state + ')');
    if (ev['raid:escaped'].length !== 1 || ev['raid:escaped'][0].amount !== want) throw new Error('raid:escaped ' + JSON.stringify(ev['raid:escaped']));
    if ((sb.eco.ledger.raided || 0) - raided0 !== want || (sb.eco.ledger.expenses || 0) - exp0 !== want || E.stats.escaped !== 1 || E.stats.raided !== want) throw new Error(`ledger raided ${sb.eco.ledger.raided} expenses ${sb.eco.ledger.expenses} stats ${JSON.stringify(E.stats)}`);
    if (!ev['raid:end'].some((p) => p.why === 'escaped')) throw new Error('raid:end escaped missing');
    console.log(`  seek ${c.target ? '→ ' + c.target.stallId : ''} · raid telegraph ${RR.telegraph}s · take ${want} ✦ → carry ${moved.toFixed(1)} u/s → pier → escaped (ledger.raided +${want})  OK`);

    // ---------------------------------------------------------------- 2. hit while carrying → drops everything as ground tips
    for (const k in ev) ev[k].length = 0; E.clear();
    T.collect(till.stallId, 'test'); T.pay(till.stallId, 30, {});
    c = spawnOne(); c.hp = c.maxHp = 2;   // S1 Collectors have 1 hp (a hit = defeat, which also drops) — test the survive-and-drop path
    guard = 0; while (c.state !== 'carry' && guard++ < 90 * 30) step(); if (c.state !== 'carry') throw new Error('2: no carry');
    const carried = c.carry, tips0 = ev['sandbox:tip'].length, ground0 = sb.coins.length;
    const dir = new THREE.Vector3(1, 0, 0); if (!E.hitEnemy(c, dir, 1)) throw new Error('2: hit refused while carrying');
    if (c.carry !== 0 || c.state !== 'seek' || !(c.stun > 0)) throw new Error(`2: after hit carry ${c.carry} state ${c.state} stun ${c.stun}`);
    const dropped = sb.coins.slice(ground0).reduce((a, k) => a + (k.value || 0), 0);
    if (Math.abs(dropped - carried) > 0.01 || sb.coins.length - ground0 > RR.dropCoins) throw new Error(`2: dropped ${dropped} in ${sb.coins.length - ground0} coins, carried ${carried}`);
    if (ev['raid:drop'].length !== 1 || ev['raid:drop'][0].amount !== carried || E.stats.raidDrops !== 1 || E.stats.recovered !== carried) throw new Error('2: raid:drop ' + JSON.stringify(ev['raid:drop'][0]));
    if ((sb.eco.ledger.recovered || 0) !== carried) throw new Error('2: ledger.recovered ' + sb.eco.ledger.recovered);
    // stunned: does not move for dropStun
    c.knock.set(0, 0, 0); const q0 = c.g.position.clone(); run(RR.dropStun * 0.8);   // knockback slide aside, a stunned raider does not steer if (q0.distanceTo(c.g.position) > 0.05) throw new Error('2: moved while stunned');
    // Pip walks over the drops → picks them up (money recovered). Raider removed first, or its contact spills the pouch again (correct, but noisy here).
    E.clear(); const tipsB = ev['sandbox:tip'].length, dropPos = sb.coins[ground0]; sb.hero.root.position.set(dropPos.position.x, 0, dropPos.position.z); run(0.5);
    if (!(ev['sandbox:tip'].length > tipsB)) throw new Error('2: Pip could not pick up the dropped coins');
    sb.hero.root.position.set(farX, 0, farZ);
    console.log(`  hit while carrying → dropped ${carried} ✦ as ${Math.min(RR.dropCoins, Math.round(carried / 2))} ground tips · stun ${RR.dropStun}s · Pip recovers  OK`);

    // ---------------------------------------------------------------- 3. hit mid-raid → cancel, till keeps money
    for (const k in ev) ev[k].length = 0; E.clear(); for (const k of sb.coins.splice(0)) void k;
    T.collect(till.stallId, 'test'); T.pay(till.stallId, 25, {});
    c = spawnOne(); c.hp = c.maxHp = 2; guard = 0; while (c.state !== 'raid' && guard++ < 90 * 30) step(); if (c.state !== 'raid') throw new Error('3: no raid');
    run(RR.telegraph * 0.4); E.hitEnemy(c, dir, 1);
    if (c.state !== 'seek' || T.get(till.stallId).amount !== 25 || ev['raid:cancel'].length !== 1 || ev['raid:cancel'][0].why !== 'hit' || E.stats.raidsCancelled !== 1) throw new Error(`3: state ${c.state} till ${T.get(till.stallId).amount} cancel ${JSON.stringify(ev['raid:cancel'])}`);
    console.log('  hit mid-telegraph → raid:cancel, till keeps 25 ✦  OK');

    // ---------------------------------------------------------------- 4. Bubble Shield with Pip at the till → immune → cancel 'shield' → chase (no other till)
    for (const k in ev) ev[k].length = 0; E.clear();
    c = spawnOne(); guard = 0; while (c.state !== 'raid' && guard++ < 90 * 30) step(); if (c.state !== 'raid') throw new Error('4: no raid');
    sb.hero.root.position.set(till.pos.x + 0.5, 0, till.pos.z + 1.2); sb.shield.until = game.time + 5; step(); step();
    if (c.state === 'raid' || c.state === 'carry' || T.get(till.stallId).amount !== 25) throw new Error(`4: shield did not protect (state ${c.state}, till ${T.get(till.stallId).amount})`);
    if (!ev['raid:cancel'].some((p) => p.why === 'shield')) throw new Error('4: cancel why ' + JSON.stringify(ev['raid:cancel']));
    // The live sandbox has other tills that customers keep paying into → the raider legitimately re-targets a NON-shielded till
    // (seek/raid/carry with target ≠ the shielded one). Only with no other money anywhere does it fall back to chasing Pip.
    run(RR.retarget + 0.2);
    const others = T.all().filter((t) => t.stallId !== till.stallId && t.amount > 0).length;
    const retargeted = ACTIVE_STATES.has(c.state) && c.target && c.target.stallId !== till.stallId;
    if (!(c.state === 'chase' || retargeted)) throw new Error(`4: shielded till still targeted (state ${c.state}, target ${c.target?.stallId}, other tills with money ${others})`);
    if (T.get(till.stallId).amount !== 25) throw new Error('4: shielded till lost money ' + T.get(till.stallId).amount);
    const branch = c.state === 'chase' ? 'chase (no other till)' : `re-target → ${c.target.stallId}`;
    sb.shield.until = -1; sb.hero.root.position.set(farX, 0, farZ); run(RR.retarget + 0.2);
    if (!ACTIVE_STATES.has(c.state) && c.state !== 'chase') throw new Error('4: shield down → raider should be active again, state ' + c.state);
    console.log(`  Bubble Shield + Pip ≤ 2 u of the till → immune → cancel(shield) → ${branch} → shield down → ${c.state}  OK`);

    // ---------------------------------------------------------------- 5. contact spills the pouch (never subtracts, never below 0, jars untouched)
    for (const k in ev) ev[k].length = 0; E.clear(); c = spawnOne();
    spark(30); sb.eco.state.jars.save = 50; c.g.position.copy(sb.hero.root.position); c.hitAt = -99; const g0 = sb.coins.length; run(0.2);
    const sp = ev['jars:spill'][0]; if (!sp || sb.eco.state.spark !== 30 - sp.amount || sp.amount < 1 || sp.amount > 8 || sb.eco.state.jars.save !== 50) throw new Error(`5: spill ${JSON.stringify(sp)} spark ${sb.eco.state.spark}`);
    if (!(sb.coins.length > g0) || Math.abs(sb.coins.slice(g0).reduce((a, k) => a + k.value, 0) - sp.amount) > 0.01) throw new Error('5: spilled coins not on the ground');
    if (!ev['enemy:heroHit'].length || ev['enemy:heroHit'][0].spark !== 0 || ev['enemy:heroHit'][0].spilled !== sp.amount) throw new Error('5: enemy:heroHit ' + JSON.stringify(ev['enemy:heroHit'][0]));
    spark(0); c.hitAt = -99; run(0.2); if (sb.eco.state.spark !== 0 || sb.eco.state.debt < 0) throw new Error('5: below zero');
    console.log(`  contact → pouch spills ${sp.amount} ✦ to the ground (jars untouched, 0 ✦ → nothing)  OK`);

    // ---------------------------------------------------------------- 6. no till in range → chase; sendHome mid-carry → escape accounted
    for (const k in ev) ev[k].length = 0; E.clear(); sb.hero.root.position.set(farX, 0, farZ);
    for (const t of T.all()) T.collect(t.stallId, 'test');   // EVERY till empty (customers top up the other stalls during 1–5)
    c = spawnOne(); if (c.state !== 'chase') throw new Error('6: empty tills → should chase, state ' + c.state);
    T.pay(till.stallId, 12, {}); run(RR.retarget + 0.2); if (c.state !== 'seek') throw new Error('6: a till filled up → should seek, state ' + c.state);
    guard = 0; while (c.state !== 'carry' && guard++ < 90 * 30) step(); if (c.state !== 'carry') throw new Error(`6: no carry (state ${c.state} target ${c.target?.stallId} tills ${JSON.stringify(T.all().map((t) => [t.stallId, t.amount]))} inList ${E.list.includes(c)} hp ${c.hp} pos ${c.g.position.x.toFixed(1)},${c.g.position.z.toFixed(1)} counter ${JSON.stringify(E._counterPoint(c.target))} hero ${farX},${farZ} land ${sb.island?.isLand?.(c.g.position.x, c.g.position.z)})`);
    const carried6 = c.carry; const n = E.sendHome(); if (n !== 1 || c.state !== 'home') throw new Error('6: sendHome ' + n + ' ' + c.state);
    guard = 0; while (E.list.includes(c) && guard++ < 40 * 30) step();
    if (E.list.includes(c) || ev['raid:escaped'].length !== 1 || ev['raid:escaped'][0].amount !== carried6) throw new Error('6: season-end carrier should still escape with the loot ' + JSON.stringify(ev['raid:escaped']));
    console.log(`  empty tills → chase · till filled → seek · sendHome mid-carry → walks off with ${carried6} ✦ (raid:escaped)  OK`);

    // ---------------------------------------------------------------- 6b. P2: a seeking Collector ≤ 3 u of Pip is talkable → enemy:talk (42D attaches the pitch)
    ev['enemy:talk'] = []; bus.on('enemy:talk', (p) => ev['enemy:talk'].push(p));
    T.pay(till.stallId, 12, {}); c = spawnOne(); if (c.state !== 'seek') throw new Error('6b: expected seek, state ' + c.state);
    sb.hero.root.position.set(c.g.position.x + 1.5, 0, c.g.position.z); if (E.talkable(3) !== c || !E.talk(3) || ev['enemy:talk'].length !== 1 || ev['enemy:talk'][0].enemyId !== c.id) throw new Error('6b: talk ' + JSON.stringify(ev['enemy:talk']));
    sb.hero.root.position.set(c.g.position.x + 6, 0, c.g.position.z); if (E.talkable(3) || E.talk(3) || ev['enemy:talk'].length !== 1) throw new Error('6b: talk out of range should be null');
    if (typeof sb.interact === 'function') { sb.hero.root.position.set(c.g.position.x + 1.5, 0, c.g.position.z); if (sb.interact() !== 'talk' || ev['enemy:talk'].length !== 2) throw new Error('6b: sb.interact() should route to talk'); sb.interactRelease?.(); }
    console.log('  P2 enemy:talk — seeking Collector ≤ 3 u → sb.interact() = "talk", 6 u → null  OK');

    // ---------------------------------------------------------------- 7. clean destroy
    E.clear(); destroySandbox(sb); let left = 0; scene.traverse((o) => { if (o.isMesh) left++; });
    if (left) throw new Error('destroy left ' + left + ' meshes');
    console.log(`  stats ${JSON.stringify(E.stats)} · destroy clean  OK`);
  } catch (err) { bad++; console.log('  raid FAIL →', err.message.split('\n')[0]); if (process.env.RAID_TRACE) console.log(err.stack); }
  return bad;
}
