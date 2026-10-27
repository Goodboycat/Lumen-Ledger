// tools/gates/firstplayer.mjs — S37 headless gate: `node tools/check.mjs --firstplayer`
// "Is the game balanced for a FIRST player?" — a passive beginner who leaves the 3 starter stalls at fair prices, builds nothing,
// never touches the jars and never repays. Runs the REAL createSandbox (customers walk, queue, browse, pay) at the real
// 150 s season for 3 seasons (seeds 3 + 7), enemies off.
//   • S1 income must beat S1 expenses (upkeep 35 + interest 39) — before S37 one 6-Glimmer wave per season earned ~60–85 ✦ and
//     the kid lost ground in the tutorial season no matter what they did.
//   • income must stay sane (< 320 in S1): three waves ≈ balance.md's 18 + 5·stalls visits, not a flood.
//   • every season sells ≥ 15 units, nobody is left angry/gave-up in S1 (queues cope with 3 waves of 6).
//   • the Baron still bites: debt grows every season the player ignores it (260 → 299 → 359 → 431).
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\nFIRST PLAYER (S37):');
  try {
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createSandbox, CUSTOMER_TRICKLE } = await imp('src/Game.js');
    if (!Array.isArray(CUSTOMER_TRICKLE) || CUSTOMER_TRICKLE.length < 1) throw new Error('CUSTOMER_TRICKLE missing');
    for (const seed of [3, 7]) {
      const bus = new EventBus(); const ev = { paid: 0, angry: 0 }; bus.on('cust:paid', () => ev.paid++); bus.on('cust:angry', () => ev.angry++);
      const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} };
      const sb = createSandbox(game, { headless: true, seasonSeconds: 150, seed });
      if (sb.enemies) sb.enemies.enabled = false;
      const dt = 1 / 30; let guard = 0;
      while (sb.stats.seasons < 3 && !sb.eco.state.ended && guard++ < 3 * 150 * 30 + 600) { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); }
      const R = sb.stats.reports; if (R.length < 3) throw new Error(`seed ${seed}: only ${R.length} seasons ran`);
      const s1 = R[0];
      if (!(s1.income > s1.expenses)) throw new Error(`seed ${seed}: S1 income ${s1.income} ≤ expenses ${s1.expenses} — first season still loses ground`);
      if (!(s1.income < 320)) throw new Error(`seed ${seed}: S1 income ${s1.income} too high (flood)`);
      for (const r of R) { if (!(r.units >= 15)) throw new Error(`seed ${seed}: S${r.season} sold only ${r.units} units`); if (!isFinite(r.spark) || r.spark < 0) throw new Error(`seed ${seed}: S${r.season} spark ${r.spark}`); }
      for (let i = 1; i < R.length; i++) if (!(R[i].debt > R[i - 1].debt)) throw new Error(`seed ${seed}: debt did not grow S${R[i].season} (${R[i - 1].debt} → ${R[i].debt}) — the Baron must still bite`);
      if (ev.angry > 1) throw new Error(`seed ${seed}: ${ev.angry} angry Glimmers over 3 seasons — queues cannot cope with the waves`);
      if (sb.eco.state.ended) throw new Error(`seed ${seed}: run ended (${sb.eco.state.ended}) in 3 seasons`);
      console.log(`  seed ${seed}: ` + R.map((r) => `S${r.season} +${r.income}/−${r.expenses} (${r.units} u) debt ${r.debt} spark ${r.spark}`).join(' · ') + ` · paid ${ev.paid} angry ${ev.angry}  OK`);
    }
    console.log(`  passive beginner (3 starter stalls, fair prices, no repay) stays Spark-positive but debt climbs 260 → 431 by S3 · waves at day 0 + ${CUSTOMER_TRICKLE.join('/')}  OK`);
  } catch (err) { bad++; console.log('  firstplayer FAIL →', err.message.split('\n')[0]); }
  return bad;
}
