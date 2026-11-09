// tools/gates/jars1.mjs — T1 headless gate: `node tools/check.mjs --jars1`  (section "T1 JARS", FUN_PASS §4 T1)
// REAL createLumenGame + mountUI on tools/domshim.mjs (same rig as --debug). Proves:
//   • T1.1  fresh PLAY → the tray's Jars tab lists NO jar (S66-A: Spend is the pouch); state().jars.unlocked === ['spend']
//   • T1.2  unlockJar('save') → jars:unlocked ×1, tray = save · eco:season{season:2} → invest listed · novelty:start{id:'stormWarning'} → protect listed
//           (wrong payloads do NOT unlock) · a rule fires once only
//   • T1.3  (T1-B) Save placed ≥ 5 u from Pip, lg.landTap({x,z}) → Pip walks over and 10 ✦ move in within 6 s, hero ≤ 1.3 u, inputOverride released
//           · a far tap on a jar is NOT swallowed · a tap on empty land still opens the tray · stick input / timeout / pause cancel the walk
//   • T1.4  two jars: deposit into one → the other unchanged · remove one → only its balance returns to the pouch
//   • T1.5  snapshot v4 carries jarsUnlocked → JSON → resume restores unlocks + placed jars, tray = unlocked, no replayed NEW reveals · legacy snapshot (field missing) derives from placed jars
//   • T1.6  Invest withdraw mid-season → 0 moved + jars:locked · onLocked card says "Invest is locked until the Ledger."
//   • T1.7  verb chain without a Save jar (tests/verbs.test.mjs, run by --verbs): unlocks Save, hints "Build the Save jar", done on deposit, no 25 s wait.
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
export async function run({ resolve, pathToFileURL }) {
  let bad = 0; let n = 0; let cleanup = null; let lg = null, ui = null;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  const ok = (label) => { n++; console.log(`  ${label}  OK`); };
  console.log('\nT1 JARS:');
  try {
    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createLumenGame } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { readFileSync } = await import('node:fs'); const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));

    const bus = new EventBus(); const ev = {}; for (const nm of ['jars:unlocked', 'jars:deposit', 'jars:autowalk', 'jars:removed', 'jars:locked', 'ui:tap:land']) bus.on(nm, (p) => { (ev[nm] ??= []).push(p); });
    const scene = new THREE.Scene();
    const game = { scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const root = document.body; cleanup = () => { try { lg?.destroy?.(); } catch { /* ok */ } try { ui?.destroy?.(); } catch { /* ok */ } for (const el of [...root.children]) el.remove?.(); };   // gates share one domshim document: leave it empty for the next gate (--debug reads the FIRST .ll-spark-val)
    ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check' });
    const storage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; })();
    lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: 150, seed: 3, debugKeys: true, storage });
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); };
    const runS = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) step(); };
    const drain = () => { let k = 0; while (ui.dialogue.isOpen && k < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); k++; } return k; };
    const eq = (a, b, label) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };

    ui.title.buttons.story.click(); if (lg.state !== 'playing' || !lg.sb) throw new Error('PLAY → ' + lg.state);
    step(); drain(); if (game.paused) throw new Error('still paused after draining the S1 opening');
    const sb = lg.sb, eco = sb.eco; if (sb.enemies) sb.enemies.enabled = false;
    if (!sb.jarUnlocks) throw new Error('sb.jarUnlocks missing');
    const hp = sb.hero.root.position; const listed = () => ui.build.listed('jar').slice().sort();

    // ---- T1.1
    eq(listed(), [], 'T1.1 tray jars on a fresh game (S66-A: Spend is the pouch, no Spend jar to build)');
    eq(lg.debug.state().jars.unlocked, ['spend'], 'T1.1 state().jars.unlocked');
    ok('T1.1 fresh game: tray lists no jar (Spend = pouch) · state().jars.unlocked = [spend]');

    // ---- T1.2
    let r = lg.debug.unlockJar('save'); if (!r.ok) throw new Error('unlockJar(save) ' + JSON.stringify(r));
    eq(listed(), ['jar_save'], 'T1.2 tray after unlockJar(save)'); eq((ev['jars:unlocked'] || []).length, 1, 'T1.2 jars:unlocked count');
    if (lg.debug.unlockJar('save').ok !== false || (ev['jars:unlocked'] || []).length !== 1) throw new Error('T1.2 second unlock of save must be a no-op');
    // rule payloads: standalone createJarUnlocks on its OWN bus (a synthetic eco:season / novelty:start on the game bus would open story dialogues)
    { const { createJarUnlocks } = await imp('src/systems/jarUnlocks.js'); const b2 = new EventBus(); const got = []; b2.on('jars:unlocked', (p) => got.push(p.jar));
      const jsonRules = JSON.parse(readFileSync(resolve('data/jars.json'), 'utf8')); const U = createJarUnlocks({ bus: b2, data: jsonRules });
      eq(U.unlocked(), ['spend'], 'T1.2 standalone start state');
      b2.emit('eco:season', { season: 1 }); b2.emit('novelty:start', { id: 'baronVisit' }); eq(got, [], 'T1.2 wrong payloads must not unlock');
      b2.emit('till:collect', {}); b2.emit('novelty:start', { id: 'stormWarning' }); b2.emit('eco:season', { season: 2 });
      eq(got, ['save', 'protect', 'invest'], 'T1.2 rules: till:collect → save · stormWarning → protect · eco:season 2 → invest');
      b2.emit('till:collect', {}); b2.emit('eco:season', { season: 2 }); eq(got.length, 3, 'T1.2 each rule fires once'); U.destroy(); }
    lg.debug.unlockJar('protect'); lg.debug.unlockJar('invest');
    eq(listed(), ['jar_invest', 'jar_protect', 'jar_save'], 'T1.2 tray with all three buildable jars unlocked'); eq((ev['jars:unlocked'] || []).map((e) => e.jar), ['save', 'protect', 'invest'], 'T1.2 unlock events');
    ok('T1.2 unlockJar(save) → 1 event, tray save · (data/jars.json rules, own bus) wrong payloads ignored, till:collect → save, stormWarning → protect, eco:season 2 → invest, once each · tray lists all 3 buildable jars');

    // ---- place jars on land cells (cost 0), far enough from the hero
    const place = (k, minD, maxD = 99) => { const cells = sb.island.gridCells().filter((c) => { const d = Math.hypot(c.x - hp.x, c.z - hp.z); return d >= minD && d <= maxD; }); const c = cells.find((c) => sb.build.canPlace('jar_' + k, c.x, c.z, 0)); if (!c) throw new Error('no cell for jar_' + k); const rr = sb.build.place?.('jar_' + k, c.x, c.z, 0) ?? sb.build.placeAt?.('jar_' + k, c.x, c.z, 0); return { c, rr }; };
    hp.set(0, 0, 0); step();
    const { c: cs } = place('save', 5, 8); const J = sb.jarsWorld; if (!J.get('save')) throw new Error('jar_save not registered after place');
    const jp = J.get('save').position; const dist0 = Math.hypot(jp.x - hp.x, jp.z - hp.z); if (dist0 < 4) throw new Error('save jar only ' + dist0 + ' u away');
    eco._addSpark(40 - eco.state.spark, 'test'); const pouch0 = Math.floor(eco.state.spark); const save0 = eco.state.jars.save || 0;

    // ---- T1.3
    const handled = lg.landTap({ x: jp.x, z: jp.z }); if (handled !== true) throw new Error('far jar tap not handled: ' + JSON.stringify({ paused: game.paused, modal: ui.isModal?.(), title: ui.title?.isOpen, ledger: ui.ledger?.isOpen, dlg: ui.dialogue?.isOpen, pause: ui.pause?.isOpen, mode: sb.build.mode, demo: lg.demolishMode, ids: J.ids(), jp: [jp.x, jp.z] }));
    if (!sb.autoWalk || sb.autoWalk.jar !== 'save') throw new Error('far jar tap did not start an auto-walk');
    if (hp.x === 0 && hp.z === 0 && sb.hero.inputOverride == null) throw new Error('no override');
    let t = 0; while (sb.autoWalk && t < 8) { step(); t += dt; }
    if (sb.autoWalk) throw new Error('auto-walk still running after 8 s');
    const dEnd = Math.hypot(jp.x - hp.x, jp.z - hp.z);
    const aw = (ev['jars:autowalk'] || []); const last = aw[aw.length - 1];
    if (!last || last.why !== 'arrived') throw new Error('walk ended: ' + JSON.stringify(last) + ' (t=' + t.toFixed(1) + 's, dist ' + dEnd.toFixed(2) + ')');
    if (t > 6.05) throw new Error('walk took ' + t.toFixed(2) + ' s');
    if (dEnd > 1.3 + 1e-6) throw new Error('arrived but ' + dEnd.toFixed(2) + ' u away');
    eq(eco.state.jars.save - save0, 10, 'T1.3 Save balance delta'); eq(pouch0 - Math.floor(eco.state.spark) , 10, 'T1.3 pouch delta');
    if (sb.hero.inputOverride !== null) throw new Error('inputOverride not released'); if (!(ev['jars:deposit'] || []).some((e) => e.jar === 'save' && e.amount === 10)) throw new Error('no jars:deposit 10');
    ok(`T1.3 tap far Save (${dist0.toFixed(1)} u) → Pip walked ${t.toFixed(1)} s, stopped ${dEnd.toFixed(2)} u away, 10 ✦ moved in (pouch ${pouch0}→${Math.floor(eco.state.spark)}), override released`);

    // already near: a tap deposits at once (no walk)
    const a0 = (ev['jars:autowalk'] || []).length; const s1 = eco.state.jars.save; lg.landTap({ x: jp.x, z: jp.z }); if (sb.autoWalk || (ev['jars:autowalk'] || []).length !== a0) throw new Error('near tap started a walk'); eq(eco.state.jars.save - s1, 10, 'near tap deposit');
    ok('T1.3 tap on a jar while standing at it → deposit at once, no walk');

    // cancels
    const farAgain = () => { hp.set(0, 0, 0); sb.hero.vel?.set?.(0, 0, 0); step(); };
    farAgain(); lg.landTap({ x: jp.x, z: jp.z }); if (!sb.autoWalk) throw new Error('cancel test: no walk'); game.input.move.set(1, 0); step(); game.input.move.set(0, 0);
    if (sb.autoWalk || sb.hero.inputOverride !== null) throw new Error('stick input did not cancel the walk');
    farAgain(); lg.landTap({ x: jp.x, z: jp.z }); game.paused = true; step(); game.paused = false; step();
    if (sb.autoWalk) throw new Error('pause did not cancel the walk');
    // timeout: walled-in target → stand the hero where it cannot progress by swapping to an unreachable jar position is fragile; assert the constant path instead
    farAgain(); lg.landTap({ x: jp.x, z: jp.z }); sb.autoWalk.t = 5.99; step(); step(); if (sb.autoWalk) throw new Error('timeout did not end the walk'); eq((ev['jars:autowalk'] || []).slice(-1)[0].why, 'timeout', 'timeout reason');
    ok('T1.3 stick input · pause · 6 s timeout each cancel the walk and release the override');

    // cinematic owns Pip → refuse
    farAgain(); const cine = { move: { x: 0, y: 0 } }; sb.hero.inputOverride = cine; if (sb.startAutoWalk('save') !== false) throw new Error('walk took the override from a cinematic'); sb.hero.inputOverride = null;
    ok('T1.3 a cinematic-owned hero is never hijacked');

    // empty land tap still opens the tray, water tap does nothing
    // S64-A tap grace: a land tap right after a modal closed (0.7 s real time) is swallowed on purpose → prove it, then let the window expire (the gate's drain() just closed a dialogue)
    lg.modalClosedAt = performance.now(); { const before = (ev['ui:tap:land'] || []).length; if (lg.landTap({ x: 0, z: 0 }) !== false || ui.build.isOpen || (ev['ui:tap:land'] || []).length !== before) throw new Error('S64-A: a land tap inside the 0.7 s grace window must be swallowed'); }
    lg.modalClosedAt = 0;
    farAgain(); const emptyCell = sb.island.gridCells().find((c) => Math.hypot(c.x - jp.x, c.z - jp.z) > 3 && Math.hypot(c.x - hp.x, c.z - hp.z) > 2); const tapsBefore = (ev['ui:tap:land'] || []).length;
    // S75: tapping empty ground NEVER opens the build tray (user request). No tap event, no tray, no walk from landTap.
    const h2 = lg.landTap({ x: emptyCell.x, z: emptyCell.z }); if (h2 !== false || (ev['ui:tap:land'] || []).length !== tapsBefore || ui.build.isOpen) throw new Error('S75: an empty-land tap must NOT open the tray');
    if (sb.autoWalk) throw new Error('land tap started a walk');
    ok('T1.3 (S75) empty-land tap does NOT open the build tray, no walk');

    // ---- T1.4 two jars
    farAgain(); place('protect', 3, 9); const sp = J.get('protect').position; hp.set(sp.x, 0, sp.z); step(); eco._addSpark(60 - eco.state.spark, 'test');
    const saveBal = eco.state.jars.save; J.press(); J.release(); eq(eco.state.jars.save, saveBal, 'T1.4 other jar unchanged'); if ((eco.state.jars.protect || 0) < 10) throw new Error('protect deposit missing');
    const spendBal = eco.state.jars.protect; const pouchB = Math.floor(eco.state.spark);
    const e0 = (ev['jars:removed'] || []).length; { const ent = [...sb.build.placed.values()].find((e) => e.id === 'jar_save'); if (!ent) throw new Error('no jar_save build entry'); sb.build.demolish(ent, { animate: false, refund: false }); }   // the real removal path (build:removed → unregister)
    if (J.get('save')) throw new Error('jar_save still registered after demolish'); const rem = (ev['jars:removed'] || []).slice(e0)[0];
    eq(rem.refunded, saveBal, 'T1.4 refund = only the removed jar balance'); eq(eco.state.jars.protect, spendBal, 'T1.4 other jar balance after remove'); eq(Math.floor(eco.state.spark), pouchB + saveBal, 'T1.4 pouch after remove');
    ok(`T1.4 deposit into Protect leaves Save at ${saveBal} · removing Save returns only its ${saveBal} ✦ to the pouch, Protect stays ${spendBal}`);

    // ---- T1.6 Invest refuses withdrawal mid-season (jars:locked), balance untouched
    { farAgain(); place('invest', 3, 9); const ip = J.get('invest').position; hp.set(ip.x, 0, ip.z); step(); eco._addSpark(30, 'test'); J.press(); J.release();
      const inv = eco.state.jars.invest; if (!(inv >= 10)) throw new Error('invest deposit missing'); const lk0 = (ev['jars:locked'] || []).length;
      const w = J.withdraw('invest'); if (w !== 0 || eco.state.jars.invest !== inv) throw new Error('invest withdrawal not refused mid-season'); if ((ev['jars:locked'] || []).length !== lk0 + 1) throw new Error('no jars:locked');
      const tutorJson = JSON.parse(readFileSync(resolve('data/tutor.json'), 'utf8')); const lockCard = tutorJson.cards.find((c) => c.id === 'onLocked'); if (!lockCard || !/locked until the Ledger/i.test(lockCard.text) || lockCard.text.length > 60) throw new Error('onLocked text: ' + lockCard?.text);
      ok(`T1.6 Invest withdraw mid-season → 0 moved, jars:locked ×1, balance stays ${inv} · onLocked card "${lockCard.text}"`); }

    // ---- T1.8 (S62-A) placing ANY item ends the placing mode (a jar used to leave a permanently red 'place another' ghost behind)
    { const B = sb.build; eco._addSpark(300 - eco.state.spark, 'test'); const armed = (id) => { if (!B.enter(id) || B.mode !== 'place' || !B.ghost) throw new Error('T1.8 enter ' + id); };
      const cellFor = (id) => { const c = sb.island.gridCells().find((c) => Math.hypot(c.x - hp.x, c.z - hp.z) >= 2 && B.canPlace(id, c.x, c.z, 0)); if (!c) throw new Error('T1.8 no cell for ' + id); return c; };
      const jarId = ['jar_save', 'jar_protect', 'jar_invest'].find((id) => !B.owned(id)); if (!jarId) throw new Error('T1.8 every jar already placed');
      armed(jarId); let c = cellFor(jarId); B.moveTo(c.x, c.z); if (!B.confirm()) throw new Error('T1.8 jar confirm');
      eq([B.mode, !!B.ghost, ui.build.st?.placing ?? null], ['idle', false, null], 'T1.8 after placing a jar');
      const n0 = B.placed.size; if (B.confirm() !== null || B.placed.size !== n0) throw new Error('T1.8 a 2nd confirm after the jar must do nothing');
      const tree = Object.keys(PROP_CATALOG).find((id) => /^tree_/.test(id) && !B.owned(id)); armed(tree); c = cellFor(tree); B.moveTo(c.x, c.z); if (!B.confirm()) throw new Error('T1.8 decor confirm');
      eq([B.mode, !!B.ghost], ['idle', false], 'T1.8 after placing decor');
      ok(`T1.8 (S62-A) placing a jar (${jarId}) or decor (${tree}) ends placing at once: mode idle, no ghost, a 2nd confirm places nothing`); }

    // ---- T1.5 reload keeps unlocks + placed jars (real snapshot → JSON → resume)
    { const Save = await imp('src/systems/save.js'); const unl = sb.jarUnlocks.serialize(); const placed = J.ids().slice().sort();
      const snap = lg.save.snapshot(); eq(snap.jarsUnlocked, unl, 'T1.5 snapshot.jarsUnlocked'); eq(snap.v, 4, 'T1.5 SAVE_VERSION stays 4');
      const parsed = Save.parseSnapshot(JSON.stringify(snap)); eq(parsed.jarsUnlocked, unl, 'T1.5 parse keeps jarsUnlocked');
      const evBefore = (ev['jars:unlocked'] || []).length;
      lg.toTitle?.('check'); storage.setItem(Save.SAVE_KEY, JSON.stringify(snap)); const resumed = lg.resume(parsed); if (!resumed) throw new Error('resume failed'); step(); drain(); game.paused = false;
      const sb2 = lg.sb; if (!sb2 || sb2.jarUnlocks === sb.jarUnlocks) throw new Error('resume did not build a new sandbox'); if (sb2.enemies) sb2.enemies.enabled = false;
      eq(sb2.jarUnlocks.serialize(), unl, 'T1.5 unlocks after resume'); eq(sb2.jarsWorld.ids().slice().sort(), placed, 'T1.5 placed jars after resume'); eq(ui.build.listed('jar').slice().sort(), unl.filter((k) => k !== 'spend').map((k) => 'jar_' + k).sort(), 'T1.5 tray after resume (S66-A: Spend = pouch, never a tray card)');
      eq((ev['jars:unlocked'] || []).slice(evBefore).filter((e) => e.how !== 'restore').length, 0, 'T1.5 resume must not replay NEW reveals');
      // legacy: same snapshot without the field, v3 → the placed jars + season progress count
      const legacy = JSON.parse(JSON.stringify(snap)); delete legacy.jarsUnlocked; legacy.v = 3; const lp = Save.parseSnapshot(JSON.stringify(legacy)); if (!lp) throw new Error('legacy v3 snapshot rejected');
      if (!lp.jarsUnlocked.includes('spend') || !placed.every((k) => lp.jarsUnlocked.includes(k))) throw new Error('legacy: placed jars not unlocked: ' + lp.jarsUnlocked);
      ok(`T1.5 snapshot v4 jarsUnlocked [${unl}] → JSON → resume: same unlocks, same placed jars [${placed}], tray = unlocked, no replayed reveals · legacy (field missing, v3) → [${lp.jarsUnlocked}]`); }

    console.log(`  T1 JARS: ${n}/${n} PASS`);
  } catch (err) {
    bad++; console.log(`  T1 JARS FAIL (after ${n} OK) → ${err?.stack?.split('\n').slice(0, 3).join(' | ') || err}`);
  }
  finally { cleanup?.(); }
  return bad;
}
