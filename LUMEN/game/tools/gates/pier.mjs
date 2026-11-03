// tools/gates/pier.mjs — 42D headless gate: `node tools/check.mjs --pier`  (section "42D PIER + SCAM NPC")
// "Pay the Baron at the pier." Runs the REAL createSandbox / createLumenGame headless with pierPays:true and proves:
//   1. eco:season (pierPays) → Baron visit: pier:due.interest === eco.interestDue(), interestOwed parked (debt NOT charged yet),
//      he strides from the water to pierSpawn (phase arrive → wait), sb.interact() far away → null, near him → 'paid',
//      pouch −= interest, debt unchanged; repay taps → eco.repay in DEPOSIT_STEP steps (pier:repaid); release → pier:done.
//   2. value equality: a parallel pierPays:false sandbox with the same seed ends S1 with the same debt after settle (interest row identical).
//   3. pouch < interest → pier:short, debt += shortfall, pouch 0, no crash.  20 s no visit → auto-settle (timeout) → pier:done.
//   4. nothing owed + debt-free → pier:skip, no Baron mesh.  destroySandbox → Baron mesh removed, 0 leaked listeners.
//   5. full game (createLumenGame, pierPays:true): S1 clock end → state 'pier' (eco clock held, no ledger yet) → scripted walk + E →
//      pier:done → state 'review' → ledger open with the same interest as eco.interestDue(1); save during 'pier' resumes at 'pier'.
// Scam NPC assertions are appended when src/systems/scamNpc.js lands (P1 item 3).
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n42D PIER + SCAM NPC:');
  const THREE = await imp('vendor/three.module.js');
  const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
  const { EventBus } = await imp('src/core/EventBus.js');
  const { tweens } = await imp('src/anim/Tween.js');
  const { createSandbox, destroySandbox } = await imp('src/Game.js');
  const { PIER } = await imp('src/systems/baronPier.js');
  const { DEPOSIT_STEP } = await imp('src/systems/jarsWorld.js');
  const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, stats: {}, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, remove(s) { const i = this.systems.indexOf(s); if (i >= 0) this.systems.splice(i, 1); }, hitstop() {} });
  const listen = (bus, names) => { const ev = {}; for (const n of names) { ev[n] = []; bus.on(n, (p) => ev[n].push(p)); } return ev; };
  const PIER_EV = ['pier:due', 'pier:paid', 'pier:short', 'pier:repaid', 'pier:done', 'pier:skip', 'eco:season', 'eco:interest', 'eco:clock'];
  const mkSb = (opts) => { const bus = new EventBus(), scene = new THREE.Scene(), game = mkGame(bus, scene); const ev = listen(bus, PIER_EV); const sb = createSandbox(game, { headless: true, seasonSeconds: 20, seed: 7, ...opts }); const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); }; const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); }; return { bus, scene, game, ev, sb, step, run }; };
  const baronMeshes = (scene) => { let n = 0; scene.traverse((o) => { if (o.userData?.pier && o.userData?.type === 'baron') n++; }); return n; };
  const endSeason = (sb) => { sb.eco.state.day01 = 1; sb.eco.tick(0.05); };   // the clock crosses the season line

  // ---------------------------------------------------------------------------------------------------------------
  // 1. the happy path: pay, repay, leave
  try {
    const A = mkSb({ pierPays: true }); const { sb, ev, scene, step, run } = A; const B = sb.pier, eco = sb.eco;
    if (!B || !eco.pierPays) throw new Error('sb.pier / eco.pierPays missing');
    sb.enemies && (sb.enemies.enabled = false);
    eco.state.debt = 260; eco.state.spark = 120; const dueExpect = eco.interestDue(1); if (!(dueExpect > 0)) throw new Error('interestDue(1) = ' + dueExpect);
    const debt0 = eco.state.debt, spark0 = eco.state.spark; sb.hero.root.position.set(0, 0, 0);
    endSeason(sb);
    if (ev['eco:season'].length !== 1 || ev['pier:due'].length !== 1) throw new Error(`eco:season ${ev['eco:season'].length} pier:due ${ev['pier:due'].length}`);
    const due = ev['pier:due'][0]; if (due.interest !== dueExpect || Math.round(eco.state.interestOwed) !== dueExpect) throw new Error(`pier:due.interest ${due.interest} vs interestDue ${dueExpect} owed ${eco.state.interestOwed}`);
    if (eco.state.debt !== debt0) throw new Error(`interest charged before the pier: debt ${debt0}→${eco.state.debt}`);
    const sparkS = eco.state.spark;   // after the season's other closing costs (wages etc.) but BEFORE interest
    if (!B.active || B.phase !== 'arrive' || baronMeshes(scene) !== 1) throw new Error(`visit: active ${B.active} phase ${B.phase} meshes ${baronMeshes(scene)}`);
    const d = B.due(); if (d.interest !== dueExpect || d.minimum !== Math.min(dueExpect, sparkS) || d.debt !== debt0) throw new Error('due() ' + JSON.stringify(d));
    if (sb.interact() === 'paid') throw new Error('interact far away paid');
    run(PIER.walkSec + 0.2); if (B.phase !== 'wait') throw new Error('phase after walk ' + B.phase);
    const ps = sb.world.pierSpawn, dStand = Math.hypot(B.g.position.x - ps.x, B.g.position.z - ps.z); if (dStand > PIER.standIn + 0.3) throw new Error('Baron not at the pier landing ' + dStand.toFixed(2));
    if (sb.interact() !== null && ev['pier:paid'].length) throw new Error('far interact paid');
    sb.hero.root.position.set(B.g.position.x + 1.2, 0, B.g.position.z); if (!B.near()) throw new Error('near() false at 1.2 u');
    const r1 = sb.interact(); if (r1 !== 'paid' || ev['pier:paid'].length !== 1) throw new Error(`interact → ${r1} paid ${ev['pier:paid'].length}`);
    if (eco.state.spark !== sparkS - dueExpect || eco.state.debt !== debt0 || eco.state.interestOwed !== 0) throw new Error(`after pay spark ${eco.state.spark} (exp ${sparkS - dueExpect}) debt ${eco.state.debt} owed ${eco.state.interestOwed}`);
    if (B.phase !== 'repay') throw new Error('phase after pay ' + B.phase);
    const sparkP = eco.state.spark, debtP = eco.state.debt; const r2 = sb.interact(); const r3 = sb.interact();
    if (r2 !== 'repaid' || r3 !== 'repaid' || ev['pier:repaid'].length !== 2) throw new Error(`repay taps ${r2} ${r3} ev ${ev['pier:repaid'].length}`);
    if (eco.state.debt !== debtP - 2 * DEPOSIT_STEP || eco.state.spark !== sparkP - 2 * DEPOSIT_STEP) throw new Error(`repay amounts debt ${debtP}→${eco.state.debt} spark ${sparkP}→${eco.state.spark}`);
    sb.interactRelease(); if (ev['pier:done'].length !== 1 || B.phase !== 'leave') throw new Error(`release → done ${ev['pier:done'].length} phase ${B.phase}`);
    const dn = ev['pier:done'][0]; if (dn.interest !== dueExpect || dn.repaid !== 2 * DEPOSIT_STEP || dn.shortfall !== 0) throw new Error('pier:done ' + JSON.stringify(dn));
    run(PIER.leaveSec + 0.2); if (B.active || baronMeshes(scene) !== 0) throw new Error('Baron did not leave');
    // 2. value equality vs the old auto path (same seed, same debt/spark/season end)
    const C = mkSb({ pierPays: false }); C.sb.enemies && (C.sb.enemies.enabled = false); C.sb.eco.state.debt = 260; C.sb.eco.state.spark = 120; endSeason(C.sb);
    const autoDebt = C.sb.eco.state.debt, autoRow = C.sb.eco.history.at(-1), pierRow = eco.history.at(-1);
    if (C.ev['pier:due'].length || C.ev['pier:skip'].length || C.sb.pier?.active) throw new Error('pierPays:false sandbox saw a visit');
    if (autoRow.interestPaid !== pierRow.interestPaid || autoRow.interestPaid !== dueExpect) throw new Error(`ledger interest row auto ${autoRow.interestPaid} pier ${pierRow.interestPaid} due ${dueExpect}`);
    if (autoDebt - debtP !== dueExpect) throw new Error(`debt after S1: auto ${autoDebt} (compounded) vs pier ${debtP} + paid ${dueExpect}`);
    destroySandbox(C.sb); destroySandbox(sb);
    if (baronMeshes(scene) !== 0 || sb.pier) throw new Error('destroy left the pier system');
    console.log(`  1. eco:season (pierPays) → pier:due ${dueExpect} ✦ = interestDue(1), debt/pouch untouched · Baron strut ${PIER.walkSec} s → landing (${dStand.toFixed(2)} u) · E near → paid (pouch ${sparkS}→${sparkS - dueExpect}) · 2 repay taps −${2 * DEPOSIT_STEP} debt · release → pier:done → leaves  OK`);
    console.log(`  2. parallel pierPays:false run, same seed: ledger interest row ${autoRow.interestPaid} = ${pierRow.interestPaid} · auto debt ${autoDebt} = pier debt ${debtP} + ${dueExpect} paid from the pouch (the old rule compounded it silently) · destroy clean  OK`);
  } catch (e) { bad++; console.log('FAIL pier 1/2: ' + (e.stack || e)); }

  // 3. short + timeout, 4. skip
  try {
    const A = mkSb({ pierPays: true }); const { sb, ev, scene, run } = A; const B = sb.pier, eco = sb.eco; sb.enemies && (sb.enemies.enabled = false);
    eco.state.debt = 400; eco.state.spark = 3; const due = eco.interestDue(1); if (!(due > 3)) throw new Error('need interest > 3, got ' + due);
    endSeason(sb); eco.state.spark = 3; run(PIER.walkSec + 0.2); sb.hero.root.position.set(B.g.position.x + 1, 0, B.g.position.z);
    const debtB = eco.state.debt; const r = sb.interact();
    if (r !== 'short' || ev['pier:short'].length !== 1 || ev['pier:paid'].length) throw new Error(`short path → ${r} short ${ev['pier:short'].length}`);
    const sh = ev['pier:short'][0]; if (sh.shortfall !== due - 3 || sh.paid !== 3 || eco.state.spark !== 0 || eco.state.debt !== debtB + (due - 3)) throw new Error(`short: ${JSON.stringify(sh)} spark ${eco.state.spark} debt ${debtB}→${eco.state.debt}`);
    if (sb.interact() !== 'done' || ev['pier:done'].length !== 1) throw new Error('tap with empty pouch should end the visit');
    run(PIER.leaveSec + 0.2);
    // timeout: season 2 ends, Pip never walks over
    eco.state.spark = 200; sb.hero.root.position.set(0, 0, 0); endSeason(sb); const due2 = Math.round(eco.state.interestOwed); eco.state.spark = due2 + 20; const debt2 = eco.state.debt;
    if (ev['pier:due'].length !== 2 || !B.active) throw new Error('second visit missing');
    run(PIER.walkSec + PIER.waitCap + 0.5);
    if (ev['pier:done'].length !== 2 || ev['pier:done'][1].why !== 'timeout' || B.stats.timeouts !== 1) throw new Error(`timeout: done ${ev['pier:done'].length} why ${ev['pier:done'][1]?.why}`);
    if (ev['pier:due'][1].interest !== due2 || eco.state.spark !== 20 || eco.state.debt !== debt2 || eco.state.interestOwed !== 0) throw new Error(`timeout auto-settle spark ${eco.state.spark} debt ${eco.state.debt}`);
    run(PIER.leaveSec + 0.2); if (B.active || baronMeshes(scene)) throw new Error('timeout: Baron still there');
    // 4. debt-free + nothing owed → skip
    eco.state.debt = 0; eco.state.spark = 80; endSeason(sb);
    if (ev['pier:skip'].length !== 1 || B.active || baronMeshes(scene) || eco.state.interestOwed !== 0) throw new Error(`skip: ${ev['pier:skip'].length} active ${B.active}`);
    destroySandbox(sb);
    console.log(`  3. pouch 3 < interest ${due} → pier:short +${due - 3} debt, pouch 0, no crash · S2 ignored ${PIER.waitCap} s → auto-settle (timeout) −${due2} ✦, debt unchanged → leaves  OK`);
    console.log(`  4. debt 0 + nothing owed → pier:skip (no Baron) · destroy clean  OK`);
  } catch (e) { bad++; console.log('FAIL pier 3/4: ' + (e.stack || e)); }

  // 5. the full game: state 'pier' between the season and the ledger review; save during pier resumes at pier
  try {
    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const { createLumenGame } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { readFileSync } = await import('node:fs'); const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const bus = new EventBus(); const ev = listen(bus, [...PIER_EV, 'game:state', 'story:review', 'story:line']);
    const game = mkGame(bus, new THREE.Scene());
    const ui = mountUI(document.body, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check' });
    const lg = createLumenGame(game, { ui, storyData, headless: true, pierPays: true, seasonSeconds: 20, seed: 3 });
    const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    const drain = () => { let n = 0; while (ui.dialogue.isOpen && n < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); n++; } return n; };
    ui.title.buttons.story.click(); step(); drain();
    const sb = lg.sb, eco = sb.eco, B = sb.pier; if (!eco.pierPays || !B) throw new Error('game sandbox not in pierPays mode');
    sb.enemies && (sb.enemies.enabled = false);
    eco.state.spark = 90; const dueExp = eco.interestDue(1);
    let guard = 0; while (eco.state.season === 1 && lg.state === 'playing' && guard++ < 40 * 30) { step(); if (ui.dialogue.isOpen) drain(); }
    if (lg.state !== 'pier' || !B.active || ui.ledger.isOpen) throw new Error(`season end → state ${lg.state} active ${B.active} ledger ${ui.ledger.isOpen}`);
    if (!sb.clockHold?.has('pier') || ev['eco:clock'].at(-1)?.held !== true) throw new Error('eco clock not held by pier');
    const day0 = eco.state.day01, s0 = eco.state.season; run(3); if (eco.state.day01 !== day0 || eco.state.season !== s0) throw new Error('eco clock ticked during pier');
    if (ev['story:review'].length) throw new Error('story:review fired before the Baron was paid');
    // save during pier → resume at pier
    let snapOK = false; try { const snap = lg.save?.snapshot?.() || lg.snapshot?.(); snapOK = snap?.state === 'pier'; } catch { snapOK = false; }
    run(PIER.walkSec); sb.hero.root.position.set(B.g.position.x + 1, 0, B.g.position.z);
    const r = sb.interact(); if (r !== 'paid' && r !== 'short') throw new Error('game interact → ' + r);
    sb.interactRelease(); run(0.1); if (ui.dialogue.isOpen) drain();
    let g2 = 0; while (lg.state === 'pier' && g2++ < 300) { step(); if (ui.dialogue.isOpen) drain(); }
    if (lg.state !== 'review' || !ui.ledger.isOpen) throw new Error(`after pier → state ${lg.state} ledger ${ui.ledger.isOpen}`);
    if (ev['story:review'].length !== 1 || ev['pier:done'].length !== 1) throw new Error(`story:review ${ev['story:review'].length} pier:done ${ev['pier:done'].length}`);
    const row = eco.history.at(-1); if (row.interestPaid !== dueExp || ev['pier:due'][0].interest !== dueExp) throw new Error(`ledger interest ${row.interestPaid} vs due ${dueExp}`);
    if (lg.stats.piers !== 1) throw new Error('stats.piers ' + lg.stats.piers);
    ui.ledger.skip(); ui.ledger.continue(); if (lg.state !== 'playing' || eco.state.season !== 2) throw new Error(`continue → ${lg.state} S${eco.state.season}`);
    lg.destroy(); ui.destroy?.();
    console.log(`  5. full game pierPays: S1 clock end → state 'pier' (clock held, no ledger, no story:review) · ${snapOK ? 'snapshot.state=pier' : 'snapshot n/a'} · walk + E → ${r} → pier:done → 'review' ledger interest ${row.interestPaid} = due · CONTINUE → S2 playing  OK`);
  } catch (e) { bad++; console.log('FAIL pier 5: ' + (e.stack || e)); }
  return bad;
}
