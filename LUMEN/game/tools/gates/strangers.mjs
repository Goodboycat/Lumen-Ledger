// tools/gates/strangers.mjs — T4 (S57) headless gate: `node tools/check.mjs --strangers`  (section "T4 STRANGERS")
// FUN_PASS T4 "Scammers exist in the world", proven on the REAL createSandbox (scamNpcs:true, real data/seasons.json) with no browser:
//   T4.1 fresh game: the first stranger walks in during SEASON 1, is a 'fair' one, and its model id is a stranger species (never 'collector')
//   T4.2 (swords never resolve a stranger) lives in tools/gates/pier.mjs section 6 — re-asserted here with 10 combat:miss beside a stranger
//   T4.3 debug-spawn each of the 6 scam ids + 'fair': the stranger spawns, its marker (ui/stranger.js place()) is ON screen as a bell or an EDGE ARROW,
//        and from 10 u away the marker is findable (arrow with a metre readout when off-screen)
//   T4.4 timeout: stays 25–40 s, leaves, NO penalty (spark/debt/fog/scamsRefused untouched) and NO reward
//   T4.5 10-season run: ≥ 10 strangers, ≥ 3 'fair', ≥ 5 distinct scam ids, ≥ 1 in 3 is fair, every season ≤ 2
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
import { readFileSync } from 'node:fs';
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\nT4 STRANGERS:');
  const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
  const THREE = await imp('vendor/three.module.js');
  const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
  const { EventBus } = await imp('src/core/EventBus.js');
  const { tweens } = await imp('src/anim/Tween.js');
  const { createSandbox, destroySandbox } = await imp('src/Game.js');
  const { SCAM } = await imp('src/systems/scamNpc.js');
  const { mountStranger, STRANGER_UI } = await imp('ui/stranger.js');
  const seasons = JSON.parse(readFileSync(resolve('data/seasons.json'), 'utf8'));
  const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, stats: {}, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, remove(s) { const i = this.systems.indexOf(s); if (i >= 0) this.systems.splice(i, 1); }, hitstop() {} });
  const EV = ['scam:npc', 'scam:leave', 'scam:refused', 'scam:whiff', 'eco:scam', 'eco:fair', 'eco:scamResult', 'eco:fairResult', 'eco:season'];
  const mk = (opts = {}) => {
    const bus = new EventBus(), scene = new THREE.Scene(), game = mkGame(bus, scene); const ev = {}; for (const n of EV) { ev[n] = []; bus.on(n, (p) => ev[n].push(p)); }
    const sb = createSandbox(game, { headless: true, seed: 11, pierPays: false, scamNpcs: true, seasons, seasonSeconds: 40, ...opts }); sb.enemies && (sb.enemies.enabled = false);
    const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); };
    const run = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) step(); };
    return { bus, scene, game, sb, ev, step, run };
  };
  // a fake camera looking down at the island from the south (matrices only — ui/stranger.js place() hand-rolls the projection)
  const mkCam = (W, H) => { const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 200); cam.position.set(0, 14, 11); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true); cam.updateProjectionMatrix(); return cam; };

  // ------------------------------------------------------------------ T4.1 first stranger inside Season 1, fair, not a Collector
  try {
    const A = mk(); const { sb, ev, game } = A; sb.hero.root.position.set(0, 0, 12);
    if (!sb.scamNpc || !sb.scamNpcs) throw new Error('sb.scamNpc missing');
    let first = null; for (let i = 0; i < 30 * 200 && !ev['scam:npc'].length && sb.eco.state.season === 1; i++) { A.step(); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); }
    first = ev['scam:npc'][0]; if (!first) throw new Error('no stranger during Season 1 (season ' + sb.eco.state.season + ', t ' + game.time.toFixed(0) + ' s)');
    if (first.season !== 1) throw new Error('first stranger season ' + first.season);
    if (first.kind !== 'fair') throw new Error('first stranger is a ' + first.kind + ' (S1 = the fair contrast)');
    if (/collector/i.test(first.model || '') || !/^stranger\d$/.test(first.model || '')) throw new Error('model id ' + first.model);
    let collectors = 0; A.scene.traverse((o) => { if (o.userData?.type === 'collector') collectors++; }); if (collectors) throw new Error('a Collector mesh is in the scene ' + collectors);
    if (!sb.eco.fairs?.[first.id]) throw new Error('first stranger id is not a fair deal: ' + first.id);
    console.log(`  T4.1 first stranger: Season 1, '${first.id}' (fair), model '${first.model}' ≠ collector, appears at t ${game.time.toFixed(1)} s  OK`);
    destroySandbox(sb);
  } catch (e) { bad++; console.log('  FAIL T4.1: ' + (e.stack || e)); }

  // ------------------------------------------------------------------ T4.2 (re-asserted) 10 swings beside a stranger resolve nothing
  try {
    const A = mk(); const { sb, ev, step } = A; sb.hero.root.position.set(0, 0, 12);
    if (!sb.scamNpc.spawn('fair')) throw new Error('spawn(fair) failed');
    A.run(SCAM.walkSec + 0.3); const N = sb.scamNpc; if (N.state !== 'pitch') throw new Error('state ' + N.state);
    sb.hero.root.position.set(N.g.position.x + 1.2, 0, N.g.position.z);
    const before = JSON.stringify([sb.eco.state.spark, sb.eco.state.debt, sb.eco.ledger.scamsRefused, sb.eco.fairStats]);
    for (let i = 0; i < 10; i++) { sb.game.bus.emit('combat:miss', { combo: i }); step(); step(); }
    if (!['pitch', 'offered'].includes(N.state) || ev['scam:refused'].length || N.stats.whiffs !== 10) throw new Error(`state ${N.state} refused ${ev['scam:refused'].length} whiffs ${N.stats.whiffs}`);
    if (before !== JSON.stringify([sb.eco.state.spark, sb.eco.state.debt, sb.eco.ledger.scamsRefused, sb.eco.fairStats])) throw new Error('swings changed the economy');
    if (N.targets().length) throw new Error('stranger is a sword target');
    console.log('  T4.2 10 sword swings beside a fair stranger: 10 whiffs, still here, economy untouched, not a target  OK'); destroySandbox(sb);
  } catch (e) { bad++; console.log('  FAIL T4.2: ' + (e.stack || e)); }

  // ------------------------------------------------------------------ T4.3 every deal spawns + marker findable from 10 u
  try {
    const A0 = mk(); const ids = [...Object.keys(A0.sb.eco.scams), 'fair']; destroySandbox(A0.sb);
    if (Object.keys(A0.sb.eco.scams || {}).length !== 6 && ids.length < 7) throw new Error('want 6 scam ids + fair, have ' + ids.join(','));
    const W = 844, H = 390;   // phone landscape
    const cam = mkCam(W, H); const root = document.createElement('div'); root.clientWidth = W; root.clientHeight = H; document.body.append?.(root);
    const A = mk(); const { sb, bus } = A; sb.hero.root.position.set(0, 0, 0); sb.holdClock('gate', true);   // the S1 scheduler stranger must not race the debug spawns
    const mkr = mountStranger(root, { bus }); mkr.bind({ camera: cam, scam: () => sb.scamNpc, hero: () => sb.hero });
    const seen = []; let arrowSeen = 0, bellSeen = 0;
    for (const id of ids) {
      sb.scamNpc.clear(); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); A.run(0.2);
      const D = id === 'fair' ? 'fair' : id; if (!sb.scamNpc.spawn(D)) throw new Error('spawn(' + D + ') refused');
      const N = sb.scamNpc; if (N.kind !== (id === 'fair' ? 'fair' : 'scam')) throw new Error(`${id}: kind ${N.kind}`);
      // marker at the pier (just spawned) and at the plaza, for Pip standing 10 u away on the far side
      for (const where of ['pier', 'plaza']) {
        if (where === 'plaza') A.run(SCAM.walkSec + 0.2);
        const g = N.g.position, far = { x: g.x, z: g.z + 10 }; sb.hero.root.position.set(far.x, 0, far.z);
        const r = mkr.place({ x: g.x, y: g.y, z: g.z }, sb.hero.root.position, W, H, cam); if (!r) throw new Error(id + ': place() null');
        if (!Number.isFinite(r.x) || !Number.isFinite(r.y)) throw new Error(`${id}@${where}: marker NaN`);
        if (r.on) { bellSeen++; if (r.x < 0 || r.x > W || r.y < STRANGER_UI.top || r.y > H) throw new Error(`${id}@${where}: bell off-canvas or under the HUD row (y ${r.y.toFixed(0)})`); }
        else { arrowSeen++; if (r.x < STRANGER_UI.edge - 1 || r.x > W - STRANGER_UI.edge + 1 || r.y < STRANGER_UI.top - 1 || r.y > H - STRANGER_UI.bottom + 1) throw new Error(`${id}@${where}: arrow outside the safe ring (clear of HUD + buttons) (${r.x.toFixed(0)},${r.y.toFixed(0)})`); if (Math.abs(r.d - 10) > 0.5) throw new Error(`${id}@${where}: arrow metres ${r.d}`); }
        mkr.update(); if (!mkr.shown) throw new Error(`${id}@${where}: update() showed no marker (state ${N.state})`);
        if (mkr.shown === 'arrow' && !/\d+ m$/.test(mkr.arrow.querySelector('.ll-stranger-dist')?.textContent || mkr.arrow.children?.[2]?.textContent || '')) throw new Error(`${id}@${where}: arrow has no metre readout`);
      }
      seen.push(id);
    }
    // marker hides when talking / leaving and under a modal flag
    sb.scamNpc.clear(); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); sb.scamNpc.spawn('fair'); A.run(SCAM.walkSec + 0.2); mkr.update(); if (!mkr.shown) throw new Error('marker missing while pitching');
    sb.hero.root.position.set(sb.scamNpc.g.position.x + 1, 0, sb.scamNpc.g.position.z); sb.interact(); mkr.update(); if (mkr.shown) throw new Error('marker still shown while the deal is on the table');
    mkr.destroy();
    console.log(`  T4.3 ${seen.length} spawns (${seen.join(', ')}): each has a finder marker from 10 u (${bellSeen} bell · ${arrowSeen} edge arrow with metres) · marker hides during the talk  OK`);
    destroySandbox(sb);
  } catch (e) { bad++; console.log('  FAIL T4.3: ' + (e.stack || e)); }

  // ------------------------------------------------------------------ T4.4 timeout: leaves, no penalty, no reward
  try {
    for (const kind of ['fair', undefined]) {
      const A = mk({ seasonSeconds: 400 }); const { sb, ev } = A; sb.hero.root.position.set(0, 0, 12); sb.holdClock('gate', true);
      const e = sb.eco; const snap = () => JSON.stringify([e.state.spark, e.state.debt, +e.state.fog01.toFixed(4), e.ledger.scamsRefused, e.ledger.expenses, e.fairStats.accepted, e.fairStats.refused])   // reputation is customer-driven (sales move it), not stranger-driven;
      const s0 = snap(); if (!sb.scamNpc.spawn(kind)) throw new Error('spawn failed'); const N = sb.scamNpc;
      if (N.stay < SCAM.stay[0] || N.stay > SCAM.stay[1]) throw new Error('stay ' + N.stay + ' outside ' + SCAM.stay);
      A.run(SCAM.walkSec + N.stay - 1); if (!N.active || N.state === 'leave') throw new Error('left too early (stay ' + N.stay.toFixed(1) + ')');
      A.run(1.6); if (N.state !== 'leave' && N.active) throw new Error('did not start leaving: ' + N.state);
      A.run(SCAM.leaveSec + 0.4); if (N.active) throw new Error('still active');
      if (snap() !== s0) throw new Error('timeout changed the economy: ' + s0 + ' → ' + snap());
      if (ev['eco:scam'].length || ev['eco:fair'].length || sb.eco.pendingOffer) throw new Error('a deal was offered without Pip talking');
      const lv = ev['scam:leave'][0]; if (!lv || lv.why !== 'timeout') throw new Error('scam:leave ' + JSON.stringify(lv));
      destroySandbox(sb);
    }
    console.log(`  T4.4 timeout after ${SCAM.stay[0]}–${SCAM.stay[1]} s (per stranger): leaves quietly, spark/debt/fog/rep/ledger identical, no offer, no reward (fair + scam)  OK`);
  } catch (e) { bad++; console.log('  FAIL T4.4: ' + (e.stack || e)); }

  // ------------------------------------------------------------------ T4.5 10-season run
  try {
    const A = mk({ seasonSeconds: undefined }); const { sb, ev, step, game } = A; sb.hero.root.position.set(0, 0, 12); sb.eco.state.spark = 5000;   // real row lengths (seasons.json len)
    const per = {}; A.bus.on('scam:npc', (p) => { per[p.season] = (per[p.season] || 0) + 1; });
    let guard = 0; const keepSolvent = () => { sb.eco.state.debt = 0; sb.eco.state.spark = Math.max(sb.eco.state.spark, 5000); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };   // a passive player loses to debt in S8 (that is T6's job) — T4.5 measures strangers, not survival
    while (sb.eco.state.season < 10 && !sb.eco.state.ended && guard++ < 30 * 60 * 25) { step(); keepSolvent(); }
    // finish season 10's stranger window (the stranger mark fires well before the season line)
    for (let i = 0; i < 30 * 160 && !sb.eco.state.ended; i++) { step(); keepSolvent(); }
    const all = ev['scam:npc']; const fair = all.filter((p) => p.kind === 'fair'), scam = all.filter((p) => p.kind === 'scam'); const distinct = new Set(scam.map((p) => p.id));
    if (all.length < 10) throw new Error(`strangers ${all.length} < 10 (per season ${JSON.stringify(per)})`);
    if (fair.length < 3) throw new Error('fair ' + fair.length + ' < 3');
    if (distinct.size < 5) throw new Error('distinct scam ids ' + distinct.size + ' < 5: ' + [...distinct].join(','));
    if (fair.length * 3 < all.length) throw new Error(`fair ${fair.length} of ${all.length} is below 1 in 3`);
    for (const [s, n] of Object.entries(per)) if (n > 2) throw new Error(`season ${s} has ${n} strangers (max 2)`);
    if (!per[1] || !per[2]) throw new Error('S1/S2 missing a stranger ' + JSON.stringify(per));
    console.log(`  T4.5 10-season run: ${all.length} strangers (${fair.length} fair · ${scam.length} scam) · ${distinct.size} distinct scam ids · per season ${JSON.stringify(per)} · game ${(game.time / 60).toFixed(1)} min  OK`);
    destroySandbox(sb);
  } catch (e) { bad++; console.log('  FAIL T4.5: ' + (e.stack || e)); }

  console.log(bad ? `  T4 STRANGERS: ${bad} FAIL` : '  T4 STRANGERS: 5/5 PASS');
  return bad;
}
