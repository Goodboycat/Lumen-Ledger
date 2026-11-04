// tools/gates/jarsworld.mjs — 42B headless gate: `node tools/check.mjs --jarsworld`  (section "42B JARS WORLD")
// "Budgeting is a walk, not a slider." Runs the REAL createSandbox (jars placed at (-8..-5, 3) by buildWorld) and proves:
//   • J.near(): hero at (−8, 3) → 'spend'; (−7, 3) → 'save'; (0, 0) → null; jars:near fires on change only
//   • pouch 35 at Save: interact() ×4 → 3 × jars:deposit 10 + 1 × 5; eco.state.jars.save += 35; pouch 0; a 5th tap → jars:empty, NO eco:denied
//   • withdraw: hold E ≥ HOLD_S at Invest mid-season → jars:locked + no delta; at Save → jars:withdraw 10 (repeat every REPEAT_S)
//   • walking away mid-hold releases the hold · spillPouch(0.1) on 100 ✦ → 8 (SPILL_CAP) ground tips, pouch 92
//   • the legacy ui:jar:apply path still rebalances (?sliders=1) · the jars panel mounted with domshim has 0 APPLY buttons by default
//   • 0 new meshes (jars already exist) · DOM tags ≤ 4 · destroySandbox → J.destroyed, 0 tags
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n42B JARS WORLD:');
  try {
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createSandbox, destroySandbox } = await imp('src/Game.js');
    const { DEPOSIT_STEP, NEAR_R, HOLD_S, REPEAT_S, SPILL_CAP, SPILL_FRAC, createJarsWorld } = await imp('src/systems/jarsWorld.js');
    if (DEPOSIT_STEP !== 10 || !(NEAR_R >= 1.2 && NEAR_R <= 1.5) || HOLD_S !== 0.6 || REPEAT_S !== 0.25 || SPILL_CAP !== 8 || SPILL_FRAC !== 0.1) throw new Error(`constants STEP ${DEPOSIT_STEP} NEAR ${NEAR_R} HOLD ${HOLD_S} REPEAT ${REPEAT_S} CAP ${SPILL_CAP}`);
    const meshCount = (scene) => { let n = 0; scene.traverse((o) => { if (o.isMesh) n++; }); return n; };
    const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {}, headless: true });

    const bus = new EventBus(); const scene = new THREE.Scene(); const game = mkGame(bus, scene);
    const ev = {}; const rec = (n) => bus.on(n, (p) => (ev[n] ||= []).push(p));
    ['jars:deposit', 'jars:withdraw', 'jars:near', 'jars:locked', 'jars:empty', 'jars:spill', 'eco:denied', 'eco:jar'].forEach(rec);
    const sb = createSandbox(game, { headless: true, seasonSeconds: 150, seed: 7 });
    if (sb.enemies) sb.enemies.enabled = false;
    const J = sb.jarsWorld; if (!J || typeof sb.interact !== 'function' || typeof sb.interactRelease !== 'function') throw new Error('sb.jarsWorld / sb.interact / sb.interactRelease missing');
    if (J.jars.size !== 4 || !['spend', 'save', 'invest', 'protect'].every((k) => J.jars.has(k))) throw new Error('jars map ' + [...J.jars.keys()].join(','));
    const meshes0 = meshCount(scene); const isCreature = (o) => { for (let p = o; p && p !== scene; p = p.parent) if (/^(cust_|helper|enemy|coll|baron)/.test(p.name || '')) return true; return false; }; const nonCreature = () => { let n = 0; scene.traverse((o) => { if (o.isMesh && !isCreature(o)) n++; }); return n; }; const meshesNC0 = nonCreature();
    const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); /* sb.update ticks J.update */ if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
    const run = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) step(); };
    const eco = sb.eco; const hp = sb.hero.root.position;
    const jarXZ = (id) => { const m = J.jars.get(id); return [m.position.x, m.position.z]; };

    // ---------------------------------------------------------------- 1. proximity
    hp.set(...[jarXZ('spend')[0], 0, jarXZ('spend')[1]]); step();
    if (J.near() !== 'spend') throw new Error(`near at spend jar → ${J.near()}`);
    hp.set(jarXZ('save')[0], 0, jarXZ('save')[1]); step();
    if (J.near() !== 'save') throw new Error(`near at save jar → ${J.near()}`);
    hp.set(0, 0, 0); step();
    if (J.near() !== null) throw new Error(`near at origin → ${J.near()}`);
    const nearSeq = (ev['jars:near'] || []).map((p) => String(p.jar));
    if (nearSeq.slice(-3).join(',') !== 'spend,save,null') throw new Error('jars:near sequence ' + nearSeq.join(','));
    const nearPip = (sb.hero.root.position.distanceTo(new THREE.Vector3(jarXZ('spend')[0], 0, jarXZ('spend')[1])));
    if (!(nearPip > NEAR_R)) throw new Error('origin is within NEAR_R of a jar — world layout changed');
    // 48D: Game.js landTap needs the jar meshes by id (tap on a jar → sb.interact()); near() must agree with the mesh positions
    const ids48 = J.ids(); if (ids48.length < 4 || !ids48.includes('spend') || !ids48.includes('save')) throw new Error('48D J.ids() ' + ids48.join(','));
    for (const id of ids48) { const m = J.meshOf(id); if (!m || !m.position) throw new Error('48D meshOf(' + id + ') has no position'); }
    { const m = J.meshOf('spend'); hp.set(m.position.x, 0, m.position.z); step(); if (J.near() !== 'spend') throw new Error('48D meshOf(spend) position is not near spend'); hp.set(0, 0, 0); step(); }

    // ---------------------------------------------------------------- 2. deposit: pouch 35 at Save → 10,10,10,5 then empty
    eco.state.spark = 35; const save0 = eco.state.jars.save; const denied0 = (ev['eco:denied'] || []).length;
    hp.set(jarXZ('save')[0], 0, jarXZ('save')[1]); step();
    const taps = []; for (let i = 0; i < 4; i++) { taps.push(sb.interact()); sb.interactRelease(); step(); }
    const deps = (ev['jars:deposit'] || []);
    if (deps.length !== 4 || deps.map((d) => d.amount).join(',') !== '10,10,10,5' || deps.some((d) => d.jar !== 'save')) throw new Error('deposit amounts ' + deps.map((d) => d.jar + ':' + d.amount).join(' '));
    if (taps.some((t) => t !== 'deposit')) throw new Error('interact results ' + taps.join(','));
    if (eco.state.jars.save !== save0 + 35 || eco.state.spark !== 0) throw new Error(`save ${save0}→${eco.state.jars.save}, pouch ${eco.state.spark}`);
    const r5 = sb.interact(); sb.interactRelease(); step();
    if (r5 !== 'empty' || (ev['jars:empty'] || []).length !== 1 || (ev['eco:denied'] || []).length !== denied0) throw new Error(`5th tap → ${r5}, empty ${(ev['jars:empty'] || []).length}, denied +${(ev['eco:denied'] || []).length - denied0}`);
    if (!(ev['eco:jar'] || []).length) throw new Error('eco:jar never fired — setFill sync path broken');
    const fillSave = J.jars.get('save').userData?.fill ?? J.jars.get('save').userData?.getFill?.();
    if (fillSave != null && !(fillSave > 0)) throw new Error('save jar fill still 0 after deposits');

    // ---------------------------------------------------------------- 3. withdraw: Invest locked mid-season, Save free (hold E)
    eco.state.jars.invest += 30; eco.state.jars.save = Math.max(eco.state.jars.save, 20);
    const inv0 = eco.state.jars.invest, pouchW0 = eco.state.spark;
    hp.set(jarXZ('invest')[0], 0, jarXZ('invest')[1]); step();
    const rI = sb.interact(); if (rI !== 'empty') throw new Error('press at invest with empty pouch → ' + rI);   // pouch 0 → nothing to deposit
    run(HOLD_S + 0.05);
    if ((ev['jars:locked'] || []).length < 1 || eco.state.jars.invest !== inv0 || (ev['jars:withdraw'] || []).length) throw new Error(`invest hold: locked ${(ev['jars:locked'] || []).length}, invest ${inv0}→${eco.state.jars.invest}, withdraw ${(ev['jars:withdraw'] || []).length}`);
    sb.interactRelease(); step();
    hp.set(jarXZ('save')[0], 0, jarXZ('save')[1]); step();
    const saveW0 = eco.state.jars.save; sb.interact(); run(HOLD_S + 0.05);
    const wd = ev['jars:withdraw'] || [];
    if (wd.length !== 1 || wd[0].jar !== 'save' || wd[0].amount !== DEPOSIT_STEP || eco.state.jars.save !== saveW0 - DEPOSIT_STEP || eco.state.spark !== pouchW0 + DEPOSIT_STEP) throw new Error(`save hold → ${JSON.stringify(wd)} save ${saveW0}→${eco.state.jars.save}`);
    run(REPEAT_S + 0.02); if (wd.length !== 2) throw new Error(`hold repeat after ${REPEAT_S}s → ${wd.length} withdraws`);
    // walking away mid-hold releases
    hp.set(0, 0, 0); run(REPEAT_S * 3); if (wd.length !== 2 || J.holding) throw new Error(`walk-away did not release (withdraws ${wd.length}, holding ${J.holding})`);
    sb.interactRelease();
    // a deposit made with the pouch refilled puts 10 back in save (press = deposit, release before HOLD_S → no withdraw)
    eco.state.spark = 10; hp.set(jarXZ('save')[0], 0, jarXZ('save')[1]); step(); sb.interact(); run(0.2); sb.interactRelease(); run(HOLD_S);
    if (deps.length !== 5 || wd.length !== 2) throw new Error(`tap-then-release: deposits ${deps.length} withdraws ${wd.length}`);

    // ---------------------------------------------------------------- 4. spillPouch (42C hook): 100 ✦ → min(10 %, 8) = 8 to the ground
    hp.set(0, 0, 0); step(); eco.state.spark = 100; const ground0 = sb.coins.length;
    const spilled = J.spillPouch(); if (spilled !== 8 || eco.state.spark !== 92 || (ev['jars:spill'] || []).length !== 1) throw new Error(`spill → ${spilled}, pouch ${eco.state.spark}`);
    if (!(sb.coins.length > ground0)) throw new Error('spill dropped no ground tips');
    if (J.spillPouch(0.1) !== 8 || eco.state.spark !== 84) throw new Error('second spill');
    eco.state.spark = 30; if (J.spillPouch() !== 3) throw new Error('10 % of 30 should spill 3');

    // ---------------------------------------------------------------- 5. budgets + destroy
    // 0 new meshes from J: customers spawn during the run (cust_*), so count everything that is NOT a creature. Jars were placed by buildWorld.
    if (nonCreature() !== meshesNC0) throw new Error(`+${nonCreature() - meshesNC0} non-creature meshes (J must add 0)`);
    if (J.tags.size > 4) throw new Error('DOM tags ' + J.tags.size);
    destroySandbox(sb);
    if (!J.destroyed || J.tags.size !== 0 || sb.jarsWorld) throw new Error('destroy left J alive');
    console.log(`  jarsWorld: near spend/save/null · 48D ids()/meshOf() · 35 ✦ → 10,10,10,5 + empty (no eco:denied) · Invest hold → locked · Save hold → 10 then repeat ${REPEAT_S}s · walk-away releases · spill 100→92 (cap 8) · +0 meshes · destroy  OK`);

    // ---------------------------------------------------------------- 6. pure unit: register a 5th jar (43 hook) on a mock eco
    {
      const b2 = new EventBus(); const mockEco = { state: { spark: 50, jars: { spend: 0, save: 0, invest: 0, protect: 0, festival: 0 }, ended: null }, allocate(d) { for (const k in d) { if (!(k in this.state.jars)) return false; this.state.jars[k] += d[k]; this.state.spark -= d[k]; } return true; }, withdraw(j, a) { const v = Math.min(a, this.state.jars[j]); this.state.jars[j] -= v; this.state.spark += v; return v; }, _addSpark(d) { this.state.spark += d; } };
      const mk = (x) => ({ position: new THREE.Vector3(x, 0, 0), userData: {} });
      const hero = { root: { position: new THREE.Vector3(20, 0, 0) } };
      const J2 = createJarsWorld({ bus: b2, eco: mockEco, jars: [mk(0), mk(2), mk(4), mk(6)], hero });
      J2.register('festival', mk(20)); if (J2.near() !== 'festival' || J2.deposit('festival') !== 10 || mockEco.state.jars.festival !== 10) throw new Error('register festival');
      if (J2.deposit('nope') !== 0) throw new Error('unknown jar should deposit 0');
      J2.destroy(); if (!J2.destroyed) throw new Error('J2 destroy');
      console.log('  jarsWorld pure: register("festival") → near + deposit 10 · unknown jar → 0  OK');
    }
  } catch (err) { bad++; console.log('  jarsWorld FAIL →', err.message.split('\n')[0]); if (process.env.LL_TRACE) console.log(err.stack); }

  // ---------------------------------------------------------------- 7. UI: panel defaults to summary (0 APPLY), ?sliders=1 legacy path still rebalances
  try {
    const { installDomShim } = await imp('tools/domshim.mjs'); const doc = installDomShim();
    if (!doc) throw new Error('domshim exposes no document');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { mountJars } = await imp('ui/jars.js');
    const bus = new EventBus(); const root = doc.createElement('div'); (doc.body || doc.documentElement || doc).appendChild?.(root);
    const sum = mountJars(root, { bus, pct: { spend: 40, save: 30, invest: 20, protect: 10 }, spark: 60 });
    const btns = [...sum.el.querySelectorAll('button')].filter((b) => /APPLY/i.test(b.textContent || ''));
    if (!sum.summary || btns.length !== 0) throw new Error(`summary mode: ${sum.summary}, APPLY buttons ${btns.length}`);
    const inputs = sum.el.querySelectorAll('input'); if (![...inputs].every((i) => i.disabled)) throw new Error('summary bars should be disabled');
    if (!sum.el.querySelector('.ll-jars-chip')) throw new Error('summary hint chip missing');
    bus.emit('eco:jar', { jars: { spend: 0, save: 40, invest: 0, protect: 0 } }); bus.emit('eco:spark', { spark: 60 });
    if (!/40/.test(sum.el.querySelector('.ll-jar.save .ll-jar-bal')?.textContent || '')) throw new Error('summary balances do not follow eco:jar');
    sum.destroy();
    const applied = []; bus.on('ui:jar:apply', (p) => applied.push(p));
    const leg = mountJars(root, { bus, pct: { spend: 40, save: 30, invest: 20, protect: 10 }, spark: 60, summary: false });
    if (leg.summary || ![...leg.el.querySelectorAll('button')].some((b) => /APPLY/i.test(b.textContent || ''))) throw new Error('legacy mode lost APPLY');
    leg.setPct({ save: 50 }); leg.apply(); if (applied.length !== 1 || applied[0].pct.save !== 50) throw new Error('legacy apply ' + JSON.stringify(applied));
    leg.destroy();
    console.log('  jars panel: default summary (0 APPLY, bars disabled, chip, eco:jar balances) · summary:false legacy APPLY → ui:jar:apply  OK');
  } catch (err) { bad++; console.log('  jars panel FAIL →', err.message.split('\n')[0]); }
  return bad;
}
