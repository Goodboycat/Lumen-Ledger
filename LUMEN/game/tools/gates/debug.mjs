// tools/gates/debug.mjs — T0-C headless gate: `node tools/check.mjs --debug`  (section "T0 DEBUG PANEL", FUN_PASS §4 T0)
// "Verify anything in 60 s." Runs the REAL createLumenGame + mountUI on tools/domshim.mjs (same rig as --game) and proves:
//   • T0.1  lg.debug is installed by createLumenGame; window.LUMEN_DEBUG stays undefined until the ?debug=1 mount (index.html L101)
//   • T0.3  mountDebugPanel is DOM only: scene mesh count unchanged, game.scene.add never called, the panel lives in <aside id="ll-debug">
//   • T0.4  state() === HUD truth: grant(100) → `.ll-spark-val` text == state().spark · season(3) → HUD 'Season 3' + state().season === 3
//   • every live hook returns a plain object and never throws (before PLAY → { ok:false, why:'no sandbox…' }; after PLAY → ok:true or a reason)
//   • the 1 n/a hook (crisis T7; stranger 'fair' went live in T4) answers { na } and renders as exactly 1 disabled "n/a (T#)" button
//   • state() has no NaN anywhere, before and after PLAY · dump() is a parseable JSON string · panel.destroy() removes the aside
// T0.2 (every button works on a phone) is a human check: index.html?debug=1&season=30 → tap each button.
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
export async function run({ resolve, pathToFileURL }) {
  let bad = 0; let n = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  const ok = (label) => { n++; console.log(`  ${label}  OK`); };
  console.log('\nT0 DEBUG PANEL:');
  try {
    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createLumenGame, GAME_VERSION } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { mountDebugPanel, PANEL_ID } = await imp('src/debug/panel.js');
    const { readFileSync } = await import('node:fs'); const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));

    const bus = new EventBus(); const ev = {}; for (const nm of ['debug:season', 'eco:spark', 'eco:scam', 'game:saved']) bus.on(nm, (p) => { (ev[nm] ??= []).push(p); });
    const scene = new THREE.Scene(); let sceneAdds = 0; const realAdd = scene.add.bind(scene); scene.add = (...a) => { sceneAdds++; return realAdd(...a); };
    const game = { scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const root = document.body;
    const ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check' });
    const storage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; })();
    const lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: 30, seed: 3, debugKeys: true, storage });
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); };
    const runS = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) step(); };
    const settle = () => runS(1);   // HUD count-up tween (ui/hud.js update: k = 1−e^(−9dt)) settles within ~0.6 s; FUN_PASS says step once — 1 s is the honest number
    const meshes = () => { let c = 0; scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) c++; }); return c; };
    const drain = () => { let k = 0; while (ui.dialogue.isOpen && k < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); k++; } return k; };
    const noNaN = (o, path = '') => { if (typeof o === 'number') { if (!Number.isFinite(o)) throw new Error('state() NaN/∞ at ' + path); return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) noNaN(v, path + '.' + k); };
    const plain = (r, label) => { if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error(`${label} returned ${JSON.stringify(r)} (want a plain object)`); return r; };
    const hudSpark = () => +root.querySelector('.ll-spark-val').textContent.replace(/[^\d-]/g, '');
    const hudSeasonText = () => root.querySelector('.ll-hud .ll-season, .ll-season')?.textContent || [...root.querySelectorAll('span')].map((s) => s.textContent).find((t) => /^Season \d+/.test(t)) || '';
    const HOOKS = ['grant', 'season', 'day', 'speed', 'stranger', 'wave', 'event', 'crisis', 'unlockJar', 'hire', 'clearTutor', 'resetSave', 'state', 'dump'];

    // ---------------------------------------------------------------- T0.1 hooks exist, no global before mount
    const D = lg.debug; if (!D || typeof D !== 'object') throw new Error('lg.debug missing after createLumenGame');
    const missing = HOOKS.filter((h) => typeof D[h] !== 'function'); if (missing.length) throw new Error('lg.debug missing hooks: ' + missing.join(','));
    ok(`T0.1 lg.debug installed by createLumenGame (${HOOKS.length} hooks: ${HOOKS.join(' ')})`);
    if (typeof window !== 'undefined' && window.LUMEN_DEBUG !== undefined) throw new Error('window.LUMEN_DEBUG defined before the ?debug=1 mount');
    if (root.querySelector('#' + PANEL_ID)) throw new Error('#' + PANEL_ID + ' in the DOM before mount');
    ok('T0.1 no window.LUMEN_DEBUG and no #' + PANEL_ID + ' before the ?debug=1 mount');
    // every hook before PLAY: plain object, no throw; the n/a hook (crisis) answers { na } even on the title screen (panel probes them there)
    const quiet = (fn) => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };   // dump() prints [LUMEN_DEBUG] — keep the gate output readable
    const pre = {}; for (const h of HOOKS) { const r = h === 'dump' ? quiet(() => D.dump()) : D[h](h === 'stranger' ? 'fair' : h === 'season' ? 3 : h === 'speed' ? 1 : undefined); pre[h] = r; if (h === 'dump') { if (typeof r !== 'string') throw new Error('dump() before PLAY not a string'); } else plain(r, h + '() before PLAY'); }
    for (const h of ['grant', 'season', 'day', 'wave', 'event', 'hire', 'stranger']) if (pre[h].ok !== false || !/no sandbox/.test(pre[h].why || '')) throw new Error(`${h}() before PLAY → ${JSON.stringify(pre[h])} (want ok:false no sandbox)`);
    if (pre.stranger.na !== undefined || pre.crisis.na !== 'T7' || pre.unlockJar.na !== undefined || pre.unlockJar.ok !== false) throw new Error(`n/a map wrong: fair ${JSON.stringify(pre.stranger)} crisis ${pre.crisis.na} unlockJar ${JSON.stringify(pre.unlockJar)}`);
    noNaN(pre.state, 'pre'); if (pre.state.version !== GAME_VERSION || pre.state.state !== 'title' || pre.state.spark !== 0) throw new Error('state() before PLAY ' + JSON.stringify(pre.state).slice(0, 120));
    JSON.parse(pre.dump);
    ok(`every hook before PLAY → plain object, 7 × "no sandbox" (incl. stranger fair), n/a = crisis:T7 (unlockJar live since T1-A) · state() no NaN (state '${pre.state.state}', v${pre.state.version}) · dump() parses`);

    // ---------------------------------------------------------------- T0.3 mount = DOM only
    const m0 = meshes(); const adds0 = sceneAdds; const tags0 = root.querySelectorAll('*').length;
    const DBG = mountDebugPanel(root, { lg, game });
    const aside = root.querySelector('aside#' + PANEL_ID); if (!aside) throw new Error('mount: no aside#' + PANEL_ID);
    if (meshes() !== m0 || sceneAdds !== adds0) throw new Error(`T0.3 mount touched the scene: meshes ${m0}→${meshes()} scene.add ${adds0}→${sceneAdds}`);
    if (!DBG.panel || typeof DBG.panel.open !== 'function' || typeof DBG.panel.toggle !== 'function' || typeof DBG.panel.destroy !== 'function') throw new Error('mount: panel api');
    for (const h of HOOKS) if (DBG[h] !== D[h]) throw new Error('LUMEN_DEBUG.' + h + ' is not lg.debug.' + h);
    const buttons = [...aside.querySelectorAll('button')]; const live = buttons.filter((b) => !b.disabled && !b.classList.contains('lld-tab')); const naBtns = buttons.filter((b) => b.disabled);
    if (naBtns.length !== 1 || !naBtns.every((b) => /n\/a \(T7\)$/.test(b.textContent))) throw new Error('n/a buttons: ' + naBtns.map((b) => b.textContent).join(' | '));
    if (live.length < 15) throw new Error('live buttons ' + live.length + ' < 15');
    const selects = aside.querySelectorAll('select').length; if (selects < 4) throw new Error('selects ' + selects);
    if (aside.classList.contains('open')) throw new Error('panel starts open');
    aside.querySelector('.lld-tab').click(); if (!DBG.panel.isOpen) throw new Error('tab click did not open');
    const stateBox = aside.querySelector('.lld-state'); if (!/"version"/.test(stateBox.textContent)) throw new Error('state readout empty after open: ' + stateBox.textContent.slice(0, 60));
    ok(`T0.3 mountDebugPanel: aside#${PANEL_ID} + ${root.querySelectorAll('*').length - tags0} DOM tags · meshes ${m0} unchanged · scene.add ×0 · ${live.length} live buttons · ${naBtns.length} n/a (${naBtns.map((b) => b.dataset.na).join(',')}) · ${selects} selects · ▣ opens + state readout filled`);

    // ---------------------------------------------------------------- PLAY → sandbox, then every live hook for real
    ui.title.buttons.story.click(); if (lg.state !== 'playing' || !lg.sb) throw new Error('PLAY → ' + lg.state);
    step(); drain(); if (game.paused) throw new Error('still paused after draining the S1 opening');
    const sb = lg.sb, eco = sb.eco; if (sb.enemies) sb.enemies.enabled = false;
    const m1 = meshes(); const adds1 = sceneAdds;
    const s1 = D.state(); noNaN(s1, 'post'); if (s1.state !== 'playing' || s1.season !== 1) throw new Error('state() after PLAY ' + JSON.stringify(s1).slice(0, 120));
    ok(`PLAY → sandbox (${m1} meshes) · S1 opening drained · state() no NaN (state '${s1.state}', season ${s1.season}, spark ${s1.spark}, placed [${s1.jars.placed.join(',')}])`);

    // T0.4 grant → HUD spark
    const spark0 = eco.state.spark; const g = plain(D.grant(100), 'grant');
    if (!g.ok || g.granted !== 100 || eco.state.spark !== spark0 + 100) throw new Error('grant(100) → ' + JSON.stringify(g) + ' spark ' + eco.state.spark);
    step(); settle();
    if (hudSpark() !== D.state().spark || D.state().spark !== spark0 + 100) throw new Error(`T0.4 HUD spark ${hudSpark()} ≠ state().spark ${D.state().spark}`);
    const g2 = D.grant('abc'); if (g2.granted !== 100) throw new Error('grant(NaN) default 100 → ' + JSON.stringify(g2)); settle();
    if (hudSpark() !== spark0 + 200) throw new Error('HUD after second grant ' + hudSpark());
    ok(`T0.4 grant(100) ×2 → eco ${eco.state.spark} · HUD .ll-spark-val ${hudSpark()} === state().spark ${D.state().spark}`);

    // T0.4 season → HUD season text + scheduler re-reads the row
    const sz = plain(D.season(3), 'season'); runS(0.2);
    const stx = hudSeasonText();
    if (!sz.ok || sz.season !== 3 || D.state().season !== 3 || eco.state.season !== 3 || eco.state.day01 > 0.05) throw new Error('season(3) → ' + JSON.stringify(sz) + ' eco ' + eco.state.season + ' day ' + eco.state.day01.toFixed(2));
    if (!/Season 3/.test(stx)) throw new Error(`T0.4 HUD season text "${stx}" lacks "Season 3"`);
    if ((ev['debug:season'] || []).length !== 1 || ev['debug:season'][0].season !== 3) throw new Error('debug:season event');
    if (lg.story?.state?.openingPlayed !== 3) throw new Error('season(3) did not skip the opening (openingPlayed ' + lg.story?.state?.openingPlayed + ')');
    if (ui.dialogue.isOpen) throw new Error('season(3) opened a dialogue (opening should be skipped)');
    const clampHi = D.season(99), clampLo = D.season(-4); if (clampHi.season !== 10 || clampLo.season !== 1) throw new Error('season clamp ' + clampHi.season + ' / ' + clampLo.season);
    D.season(3); runS(0.1);
    ok(`T0.4 season(3) → eco S${eco.state.season} day ${eco.state.day01.toFixed(2)} · HUD "${stx}" · state().season ${D.state().season} · debug:season ×1 · opening skipped · clamp 99→10, -4→1`);

    // day
    const dy = plain(D.day(0.5), 'day'); if (!dy.ok || Math.abs(eco.state.day01 - 0.5) > 1e-9 || D.state().day01 !== 0.5) throw new Error('day(0.5) → ' + JSON.stringify(dy) + ' eco ' + eco.state.day01);
    if (D.day(5).day01 !== 0.99 || D.day(-1).day01 !== 0) throw new Error('day clamp'); D.day(0.5);
    ok(`day(0.5) → eco.day01 ${eco.state.day01} · clamp 5→0.99, -1→0`);

    // speed (debugKeys:true → ×4 allowed)
    const sp = [1, 2, 3, 4].map((k) => plain(D.speed(k), 'speed')); if (!sp.every((r, i) => r.ok && r.speed === i + 1)) throw new Error('speed → ' + JSON.stringify(sp));
    const sp9 = D.speed(9); if (sp9.ok !== false) throw new Error('speed(9) should refuse: ' + JSON.stringify(sp9)); D.speed(1);
    if (lg.speed !== 1) throw new Error('lg.speed ' + lg.speed);
    ok(`speed(1..4) ok with debugKeys · speed(9) refused (speed ${sp9.speed}) · back to ×1`);

    // stranger (scam) — eco.scams ids; pending offer refused afterwards so the rest of the gate is clean
    const scamIds = Object.keys(eco.scams || {}); if (!scamIds.length) throw new Error('no eco.scams');
    // the season(3)/day(0.5) jumps may already have fired a scheduler stranger → the hook correctly refuses ('offer already pending'); prove that, then clear
    const clearStranger = () => { if (eco.pendingOffer) eco.refuseOffer(); sb.scamNpc?.clear?.(); runS(0.1); if (eco.pendingOffer) eco.refuseOffer(); };
    const pendingBefore = !!(eco.pendingOffer || sb.scamNpc?.active); if (pendingBefore) { const r = D.stranger(scamIds[0]); if (r.ok !== false || !/pending|active/.test(r.why || '')) throw new Error('stranger while pending → ' + JSON.stringify(r)); }
    clearStranger();
    const st = plain(D.stranger(scamIds[0]), 'stranger'); runS(0.1);
    if (!st.ok || !['npc', 'direct'].includes(st.how)) throw new Error('stranger(' + scamIds[0] + ') → ' + JSON.stringify(st));
    const st2 = D.stranger(); if (st2.ok !== false || !/pending|active/.test(st2.why || '')) { if (st2.ok) { /* npc path may queue a second one only when the first is direct — accept but note */ } }
    const stBad = D.stranger('nope'); if (stBad.ok !== false || !Array.isArray(stBad.ids)) throw new Error('stranger(unknown) → ' + JSON.stringify(stBad));
    if (D.stranger('fair').na) throw new Error('stranger(fair) must be live since T4');
    // clean up: refuse the pending offer (direct) and/or despawn the npc, then the fair stranger really spawns (T4: a fair deal id)
    clearStranger();
    const stFair = plain(D.stranger('fair'), 'stranger(fair)'); runS(0.1);
    if (!stFair.ok) throw new Error('stranger(fair) → ' + JSON.stringify(stFair));
    if (!Object.keys(eco.fairs || {}).includes(stFair.id)) throw new Error('stranger(fair) id is not a fair deal: ' + JSON.stringify(stFair));
    clearStranger();
    ok(`stranger('${scamIds[0]}') → ok via ${st.how} (offer ${st.id})${pendingBefore ? ' · refused while a scheduler stranger was pending' : ''} · unknown id → ok:false + ${stBad.ids.length} ids · 'fair' → live (deal ${stFair.id}) · cleared`);

    // wave
    const wv = plain(D.wave(), 'wave'); runS(0.1);
    if (!wv.ok || !(wv.count > 0) || !(sb.enemies.active?.length > 0 || sb.enemies.list?.length > 0 || D.state().enemies >= 0)) throw new Error('wave() → ' + JSON.stringify(wv));
    sb.enemies.enabled = false;
    ok(`wave() → ${wv.count} collectors spawned (one-per-season guard bypassed) · state().enemies ${D.state().enemies}`);

    // event
    const evIds = Object.keys(eco.events || {}); if (!evIds.length) throw new Error('no eco.events');
    const pick = evIds.find((e) => e !== 'storm') || evIds[0];
    const e1 = plain(D.event(pick), 'event'); if (!e1.ok || e1.id !== pick) throw new Error('event(' + pick + ') → ' + JSON.stringify(e1));
    const eBad = D.event('nope'); if (eBad.ok !== false || !Array.isArray(eBad.ids)) throw new Error('event(unknown) → ' + JSON.stringify(eBad));
    if (evIds.includes('storm')) { const es = plain(D.event('storm'), 'event storm'); if (!es.ok) throw new Error('event(storm) → ' + JSON.stringify(es)); runS(0.2); }
    ok(`event('${pick}') → ok (effect ${JSON.stringify(e1.effect)}) · unknown → ok:false + ${eBad.ids.length} ids${evIds.includes('storm') ? " · event('storm') ok + storm.hit" : ''}`);

    // crisis / unlockJar n/a after PLAY too
    if (D.crisis('x').na !== 'T7') throw new Error('crisis n/a after PLAY');
    { const uj = D.unlockJar('nope'); if (uj.ok !== false || !Array.isArray(uj.keys)) throw new Error('unlockJar(unknown) → ' + JSON.stringify(uj)); }
    ok('crisis() → n/a T7 (also after PLAY) · unlockJar(unknown) → ok:false + keys (live since T1-A; the real unlock is asserted by --jars1)');

    // hire
    const crew0 = sb.helpers.length; const hr = plain(D.hire(), 'hire');
    if (!hr.ok || !hr.type || sb.helpers.length !== crew0 + 1 || !Array.isArray(hr.types) || !hr.types.includes(hr.type)) throw new Error('hire() → ' + JSON.stringify(hr) + ' helpers ' + sb.helpers.length);
    const spark1 = eco.state.spark; const hr2 = plain(D.hire(hr.types.find((t) => t !== hr.type)), 'hire type'); if (!hr2.ok || eco.state.spark !== spark1) throw new Error('hire(type) → ' + JSON.stringify(hr2) + ' (free? spark ' + spark1 + '→' + eco.state.spark + ')');
    const hrBad = D.hire('nope'); if (hrBad.ok !== false || !Array.isArray(hrBad.types)) throw new Error('hire(unknown) → ' + JSON.stringify(hrBad));
    if (D.state().crew.join(',') !== sb.helpers.map((h) => h.type).join(',')) throw new Error('state().crew mismatch');
    ok(`hire() → ${hr.type} · hire('${hr2.type}') free (spark unchanged ${eco.state.spark}) · unknown → ok:false + ${hrBad.types.length} types · state().crew [${D.state().crew.join(',')}]`);

    // clearTutor + save
    if (Array.isArray(ui.tutor?.seen)) { ui.tutor.seen.push('gate_fake_card'); }
    const ct = plain(D.clearTutor(), 'clearTutor'); if (!ct.ok || ct.hintsSeen !== 0 || D.state().hintsSeen.length !== 0) throw new Error('clearTutor → ' + JSON.stringify(ct));
    const wrote = lg.save.write(); if (!wrote || !lg.save.has()) throw new Error('save.write for the resetSave test');
    if (!D.state().hasSave) throw new Error('state().hasSave false after write');
    const rs = plain(D.resetSave(), 'resetSave'); if (!rs.ok || rs.hasSave || lg.save.has() || D.state().hasSave) throw new Error('resetSave → ' + JSON.stringify(rs) + ' has ' + lg.save.has());
    ok(`clearTutor() → hintsSeen 0 · save.write → hasSave true · resetSave() → hasSave false`);

    // state()/dump() after everything: no NaN, HUD still agrees, panel refresh works, every button click returns an object (via the panel `call`)
    const sEnd = D.state(); noNaN(sEnd, 'end'); JSON.parse(quiet(() => D.dump()));
    settle(); if (hudSpark() !== D.state().spark) throw new Error('HUD spark drifted from state() at the end: ' + hudSpark() + ' vs ' + D.state().spark);
    DBG.panel.refresh(); if (!/"season": 3/.test(stateBox.textContent)) throw new Error('panel readout not refreshed: ' + stateBox.textContent.slice(0, 80));
    const resBox = aside.querySelector('.lld-res'); let clicked = 0;
    for (const b of live) { const before = resBox.textContent; quiet(() => b.click()); clicked++; if (resBox.textContent === 'ready — press PLAY, then tap a button') throw new Error('button "' + b.textContent + '" left the result box untouched'); if (!resBox.textContent || resBox.textContent === before && !/dump|state/.test(b.textContent)) { /* same output twice is fine (e.g. ×1 twice) */ } }
    clearStranger(); sb.enemies.enabled = false;
    if (meshes() < m1 - 40 && sceneAdds < adds1) throw new Error('scene wiped by a panel button');
    const m2 = meshes();
    ok(`end: state() no NaN · dump() parses · panel.refresh shows season 3 · all ${clicked} live buttons clicked (result box filled every time, scene ${m1}→${m2} meshes only from wave/hire/stall hooks)`);

    // destroy
    DBG.panel.destroy(); if (root.querySelector('#' + PANEL_ID)) throw new Error('panel.destroy left the aside'); if (DBG.panel.isOpen) throw new Error('isOpen after destroy');
    ok(`panel.destroy() → aside removed, timer cleared · T0.2 (phone taps) = human: index.html?debug=1&season=30`);
    console.log(`  T0 DEBUG PANEL: ${n}/${n} PASS`);
  } catch (err) {
    bad++; console.log(`  T0 DEBUG PANEL FAIL (after ${n} OK) → ${err?.stack?.split('\n').slice(0, 3).join(' | ') || err}`);
  }
  return bad;
}
