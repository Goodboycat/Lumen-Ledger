// tools/gates/till.mjs — 42A headless gate: `node tools/check.mjs --till`  (section "42A TILLS")
// "Customers pay the STALL, Pip collects." Runs the REAL createSandbox (customers walk, queue, pay) for one short season and proves:
//   • every eco:sale carries toTill:true and NO eco:spark with reason 'sale' fires — the pouch never moves on a sale
//   • Σ money kept on counters + lost/spilled overflow = Σ paid (nothing is created or vanishes between sale and counter)
//   • walking Pip to a counter front → till:collect how:'walk' and the pouch grows by exactly that amount
//   • coinMagnetDash next to another loaded till → how:'magnet'
//   • paying over the level-1 cap → till:full, amount ≤ cap, ≥ 2 ground coins spilled
//   • a scripted hero that empties every counter every 10 s keeps SALES Spark handled ≥ 0.8 (PLAN v6 §5) and all-in sparkHandled / sparkTotal ≥ 0.75 (S68: event windfalls are lump sums nobody collects)
//   • 0 new meshes (till stacks share the tip-coin InstancedMesh) · destroySandbox leaves the scene empty
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n42A TILLS:');
  try {
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createSandbox, destroySandbox, TILL_WALK, TILL_MAGNET } = await imp('src/Game.js');
    const { TILL_CAP, tillCap, createTills, SWEEP_TAX } = await imp('src/systems/till.js');
    if (!(TILL_WALK > 0) || !(TILL_MAGNET > TILL_WALK) || TILL_CAP !== 40 || tillCap(2) !== 60) throw new Error(`constants TILL_WALK ${TILL_WALK} TILL_MAGNET ${TILL_MAGNET} TILL_CAP ${TILL_CAP}`);
    const meshCount = (scene) => { let n = 0; scene.traverse((o) => { if (o.isMesh) n++; }); return n; };
    const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} });

    // ---------------------------------------------------------------- 1. one season: sales → counters, pouch untouched
    {
      const bus = new EventBus(); const scene = new THREE.Scene(); const game = mkGame(bus, scene);
      const ev = { sale: [], spark: [], change: [], collect: [], full: [], tip: [] }; bus.on('sandbox:tip', (p) => ev.tip.push(p));
      bus.on('eco:sale', (p) => ev.sale.push(p)); bus.on('eco:spark', (p) => ev.spark.push(p)); bus.on('till:change', (p) => ev.change.push(p)); bus.on('till:collect', (p) => ev.collect.push(p)); bus.on('till:full', (p) => ev.full.push(p));
      const sb = createSandbox(game, { headless: true, seasonSeconds: 70, seed: 3 });
      if (sb.enemies) sb.enemies.enabled = false;
      if (!sb.till || sb.cust.till !== sb.till) throw new Error('sb.till not wired into customers');
      const meshes0 = meshCount(scene);
      const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
      const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
      sb.hero.root.position.set(0, 0, 12);                       // park Pip far from every counter (no accidental walk-collect)
      const spark0 = sb.eco.state.spark;
      run(40);
      if (ev.sale.filter((s) => s.paid > 0).length < 3) throw new Error(`only ${ev.sale.length} sales in 40 s`);
      const notTill = ev.sale.filter((s) => !s.toTill); if (notTill.length) throw new Error(`${notTill.length} eco:sale without toTill`);
      const saleSpark = ev.spark.filter((p) => p.reason === 'sale'); if (saleSpark.length) throw new Error(`${saleSpark.length} eco:spark reason 'sale' — the pouch moved on a sale`);
      const paid = ev.sale.reduce((a, s) => a + (s.paid || 0), 0);
      const kept = ev.change.filter((c) => c.delta > 0).reduce((a, c) => a + c.delta, 0);
      const lost = (sb.stats.tillLost || 0) + (sb.stats.tillSpilled || 0);
      if (Math.abs(kept + lost - paid) > 0.05) throw new Error(`money gap: kept ${kept.toFixed(2)} + overflow ${lost.toFixed(2)} ≠ paid ${paid.toFixed(2)}`);
      if (sb.till.total() <= 0) throw new Error('no money on any counter after 40 s');
      // pouch may have grown only through tips Pip did not touch? No — Pip is parked; tips stay on the ground. Allow event income (eco:event) but never 'sale'.
      const pouchFromSales = ev.spark.filter((p) => p.delta > 0 && /^(sale|till:)/.test(p.reason || '')).reduce((a, p) => a + p.delta, 0);
      if (pouchFromSales !== 0) throw new Error(`pouch gained ${pouchFromSales} from sales/tills while Pip was parked`);
      // 0 new draw calls: till stacks live in the ONE 'tipCoins' InstancedMesh (indices after the ground coins); nothing named till/counter is added to the scene
      let coinMeshes = 0, tillObjs = 0; scene.traverse((o) => { if (o.isInstancedMesh && o.name === 'tipCoins') coinMeshes++; if (/till/i.test(o.name || '')) tillObjs++; });
      if (coinMeshes !== 1 || tillObjs !== 0) throw new Error(`coin InstancedMesh ×${coinMeshes}, till-named objects ${tillObjs}`);
      if (!(sb.tillCoins.length > 0) || sb.tillCoins.length > 8 * sb.till.tills.size) throw new Error(`tillCoins ${sb.tillCoins.length}`);
      sb.syncCoins(); if (sb.coinMesh.count !== sb.coins.length + Math.min(sb.tillCoins.length, sb.coinMesh.instanceMatrix.count - sb.coins.length)) throw new Error(`coinMesh.count ${sb.coinMesh.count} ≠ ground ${sb.coins.length} + till ${sb.tillCoins.length}`);
      const meshesMid = meshCount(scene), tillCoinsMid = sb.tillCoins.length;

      // ---------------------------------------------------------------- 2. walk collect
      const loaded = [...sb.till.tills.values()].filter((t) => t.amount > 0).sort((a, b) => b.amount - a.amount);
      if (loaded.length < 2) throw new Error('need 2 loaded tills, have ' + loaded.length);
      const [tA, tB] = loaded; const amtA = tA.amount, pouchA = sb.eco.state.spark, tips0 = ev.tip.length;
      sb.hero.root.position.set(tA.pos.x, 0, tA.pos.z + TILL_WALK * 0.5); step(); step();
      const tipsA = ev.tip.slice(tips0).reduce((a, t) => a + t.value, 0);   // ground tips next to the counter are picked up on the same walk (also 'handled' Spark)
      const walk = ev.collect.find((c) => c.stallId === tA.stallId && c.how === 'walk');
      if (!walk || Math.abs(walk.amount - amtA) > 0.01) throw new Error('walk collect ' + JSON.stringify(walk));
      if (Math.abs(sb.eco.state.spark - pouchA - amtA - tipsA) > 0.01) throw new Error(`pouch ${pouchA} → ${sb.eco.state.spark}, expected +${amtA} till +${tipsA} tips`);
      if (sb.till.get(tA.stallId).amount !== 0) throw new Error('till not emptied by walk');
      if ((sb.stats.tillCollected_walk || 0) < amtA) throw new Error('stats.tillCollected_walk');

      // ---------------------------------------------------------------- 3. magnet dash collect
      const amtB = sb.till.get(tB.stallId).amount, pouchB = sb.eco.state.spark;
      sb.hero.root.position.set(tB.pos.x + TILL_MAGNET * 0.8, 0, tB.pos.z); sb.hero.facing = Math.PI; sb.hero.root.rotation.y = Math.PI;
      sb.cooldown.coinMagnetDash = -99;
      if (!sb.ability('coinMagnetDash')) throw new Error('magnet refused (busy/locked)');
      run(2);
      const mag = ev.collect.find((c) => c.stallId === tB.stallId && c.how === 'magnet');
      if (!mag || Math.abs(mag.amount - amtB) > 0.01) throw new Error('magnet collect ' + JSON.stringify(mag) + ' (expected ' + amtB + ')');
      if (!(sb.eco.state.spark >= pouchB + amtB - 0.01)) throw new Error(`magnet pouch ${pouchB} → ${sb.eco.state.spark}`);

      // ---------------------------------------------------------------- 4. cap + spill
      sb.hero.root.position.set(0, 0, 12);
      const tC = tA; const cap = sb.till.cap(tC.stallId); if (cap !== tillCap(sb.till.get(tC.stallId).level)) throw new Error('cap ' + cap);
      const coins0 = sb.coins.length, full0 = ev.full.length;
      sb.till.pay(tC.stallId, cap - 20); sb.till.pay(tC.stallId, 45);        // 20 under cap, then 45 → 25 overflow → 12.5 spilled → coins
      if (ev.full.length !== full0 + 1 || ev.full[full0].stallId !== tC.stallId) throw new Error('till:full not emitted once');
      if (sb.till.get(tC.stallId).amount > cap) throw new Error('amount over cap ' + sb.till.get(tC.stallId).amount);
      if (sb.coins.length - coins0 < 2) throw new Error(`spill made ${sb.coins.length - coins0} ground coins`);
      if (!(sb.stats.tillSpilled > 0) || !(sb.stats.tillLost > 0)) throw new Error('stats tillSpilled/tillLost');
      const ledgerIncome0 = sb.eco.ledger.income;
      // ---------------------------------------------------------------- 5. season sweep → tax row, no double-count
      const onCounters = sb.till.total(); const pouchS = sb.eco.state.spark;
      const r = sb.eco.endSeason();
      if (!r || Math.abs((r.tillSwept || 0) - onCounters) > 0.01 || Math.abs((r.tillTax || 0) - Math.round(onCounters * SWEEP_TAX * 100) / 100) > 0.01) throw new Error(`sweep report swept ${r?.tillSwept} tax ${r?.tillTax} (counters ${onCounters})`);
      const sweepIn = ev.spark.filter((p) => p.reason === 'till:sweep').reduce((a, p) => a + p.delta, 0);   // endSeason also charges upkeep/interest, so judge the sweep by its own eco:spark
      if (Math.abs(sweepIn - (onCounters - r.tillTax)) > 0.02) throw new Error(`sweep credited ${sweepIn}, expected ${onCounters} − ${r.tillTax} (pouch ${pouchS} → ${sb.eco.state.spark})`);
      if (r.income !== ledgerIncome0) throw new Error(`sweep changed income ${ledgerIncome0} → ${r.income} (double count)`);
      if (sb.till.total() !== 0) throw new Error('counters not empty after sweep');
      console.log(`  season: ${ev.sale.length} sales all toTill · paid ${paid.toFixed(0)} = counters ${kept.toFixed(0)} + overflow ${lost.toFixed(1)} · pouch untouched · walk +${amtA} · magnet +${amtB} · cap ${cap} → FULL, ${sb.coins.length - coins0} coins spilled · sweep ${onCounters} − tax ${r.tillTax} · ${tillCoinsMid} stack coins in the shared tipCoins InstancedMesh (1 dc, +0 meshes from tills; ${meshesMid - meshes0} from Glimmers)  OK`);
      destroySandbox(sb);
      if (meshCount(scene) !== 0 || scene.children.length !== 0) throw new Error(`destroySandbox left ${meshCount(scene)} meshes`);
      if (sb.till.tills.size !== 0) throw new Error('tills not cleared on destroy');
    }

    // ---------------------------------------------------------------- 6. handled ratio: scripted hero empties every counter every 10 s
    {
      const bus = new EventBus(); const scene = new THREE.Scene(); const game = mkGame(bus, scene);
      let handled = 0, total = 0, windfall = 0; bus.on('eco:spark', (p) => { if (!(p?.delta > 0)) return; total += p.delta; if (/^event:/.test(p.reason || '')) windfall += p.delta; /* S68: event windfalls (festival ...) are lump sums paid to the pouch, nothing to collect */ if (/^(tip|till):/.test(p.reason || '')) handled += p.delta; });
      const sb = createSandbox(game, { headless: true, seasonSeconds: 70, seed: 7 });
      if (sb.enemies) sb.enemies.enabled = false;
      sb.hero.root.position.set(0, 0, 12);
      const dt = 1 / 30; let t = 0;
      const step = () => { game.time += dt; t += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
      let next = 10;
      while (sb.stats.seasons < 1 && t < 200) { step(); if (t >= next) { next += 10; for (const till of sb.till.all()) if (till.amount > 0) sb.till.collect(till.stallId, 'walk'); for (const c of sb.coins.slice()) sb.collectCoin(c, 'walk'); } }
      if (sb.stats.seasons < 1) throw new Error('season did not end');
      // S68: the 80 % bar judges SALES income (tips + tills), the part the hero can collect. Event windfalls are reported and only need the all-in 75 % bar.
      const sales = total - windfall, ratio = sales > 0 ? handled / sales : 0, allIn = total > 0 ? handled / total : 0;
      if (!(ratio >= 0.8)) throw new Error(`sales income through hands = ${handled.toFixed(0)}/${sales.toFixed(0)} = ${(ratio * 100).toFixed(1)} % < 80 %`);
      if (!(allIn >= 0.75)) throw new Error(`all-in sparkHandled/sparkTotal = ${handled.toFixed(0)}/${total.toFixed(0)} = ${(allIn * 100).toFixed(1)} % < 75 %`);
      console.log(`  ratio: scripted hero collects every 10 s → sales Spark through Pip's hands ${handled.toFixed(0)}/${sales.toFixed(0)} = ${(ratio * 100).toFixed(1)} % (≥ 80 %) · all-in incl. ${windfall.toFixed(0)} event windfall ${(allIn * 100).toFixed(1)} % (≥ 75 %)  OK`);
      destroySandbox(sb);
    }

    // ---------------------------------------------------------------- 7. pure till.js (no sandbox): helpers tick + refresh on removed stall
    {
      const bus = new EventBus(); const spark = { v: 0 }; const eco = { _addSpark: (a) => { spark.v += a; }, ledger: {}, state: {} };
      const stalls = [{ id: 'fruit', slots: { counter: { x: 1, z: 2 } }, level: 1 }];
      const spilled = []; const T = createTills({ bus, eco, build: { stalls: () => stalls }, coinLayer: { setStack() {}, clear() {}, spill: (p, v) => spilled.push(v) } });
      T.pay('fruit', 10); const h = { stall: { id: 'fruit' } };
      if (T.tickHelpers(11.9, [h]) !== 0 || T.tickHelpers(0.2, [h]) !== 10 || spark.v !== 10) throw new Error('helper tick');
      T.pay('fruit', 7); stalls.length = 0; T.refresh(); if (T.tills.size !== 0 || spark.v !== 17) throw new Error('refresh on removed stall');
      T.destroy();
      console.log('  till.js: helper empties its till after 12 s · removed stall → money to pouch, entry dropped  OK');
    }
  } catch (err) { bad++; console.log('  till FAIL →', err.message.split('\n')[0]); }
  return bad;
}
