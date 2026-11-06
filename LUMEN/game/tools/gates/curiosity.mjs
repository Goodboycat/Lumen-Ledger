// tools/gates/curiosity.mjs — T2 headless gate: `node tools/check.mjs --curiosity`  (section "T2 CURIOSITY", FUN_PASS §4 T2 + §7.A)
// 1) tests/curiosity.test.mjs (unit: approach / linger / repeat / done→never / queue 2 / far tap / ping / born grace)
// 2) REAL createLumenGame + mountUI(tutorData) on tools/domshim.mjs:
//    T2.G1 registry sees the world (stall + sign) and announces nothing at start
//    T2.1  walk into a stall's radius → 'stall:any' card ≤ 1.5 s after entering, none before
//    T2.4  tap a FAR Collector → its card + world pointer; blocked (dialogue open) → no card
//    T2.5  every card ≤ 60 chars + icon · counts survive snapshot → JSON → parse → resume (old tutorSeen-only save = each id once)
//    T2.6  pointerdown on every [data-guide] HUD element → its card at once, repeated taps repeat (no cap)
//    T2.7  pause → GUIDE: sheet lists every card, unmet rows grey, header "N / M met" follows what was shown
//    T2.8  coverage: every id the wire can answer (GUIDE_HINTS + HUD_GUIDES + live registry hints) and every [data-guide] in the DOM has a card
// Exports run({ resolve, pathToFileURL }) → number of failures.
export async function run({ resolve, pathToFileURL }) {
  let bad = 0; let n = 0; let cleanup = null; let lg = null, ui = null;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  const ok = (label) => { n++; console.log(`  ${label}  OK`); };
  console.log('\nT2 CURIOSITY:');
  try {
    const { spawnSync } = await import('node:child_process');
    const t = spawnSync(process.execPath, ['--test', 'tests/curiosity.test.mjs'], { encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL' });
    const pass = /^# pass (\d+)/m.exec(t.stdout || '')?.[1], fail = /^# fail (\d+)/m.exec(t.stdout || '')?.[1];
    if (t.status !== 0 || fail !== '0') throw new Error('tests/curiosity.test.mjs FAIL → ' + (t.stdout || '').split('\n').filter((l) => l.startsWith('not ok')).slice(0, 5).join(' | '));
    ok(`T2 CURIOSITY (unit): tests/curiosity.test.mjs → ${pass} pass, 0 fail (approach ≤ 1.5 s · repeat ≤ 3 · done → never · queue of 2 · far tap · ping · born grace)`);

    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createLumenGame } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { GUIDE_HINTS, HUD_GUIDES } = await imp('src/systems/curiosityWire.js');
    const Save = await imp('src/systems/save.js');
    const { readFileSync } = await import('node:fs');
    const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const tutorData = JSON.parse(readFileSync(resolve('data/tutor.json'), 'utf8'));

    const bus = new EventBus(); const ev = {}; for (const nm of ['tutor:shown', 'tutor:dismissed', 'curious', 'curious:ping']) bus.on(nm, (p) => { (ev[nm] ??= []).push(p); });
    const scene = new THREE.Scene();
    const game = { scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const root = document.body; cleanup = () => { try { lg?.destroy?.(); } catch { /* ok */ } try { ui?.destroy?.(); } catch { /* ok */ } for (const el of [...root.children]) el.remove?.(); };
    ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check', tutorData, tutorSeen: [], tutorCounts: {} });
    const storage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; })();
    lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: 150, seed: 3, debugKeys: true, storage, verbs: false });
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); };
    const runS = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) step(); };
    const drain = () => { let k = 0; while (ui.dialogue.isOpen && k < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); k++; } return k; };
    const eq = (a, b, label) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
    const tut = ui.tutor; if (!tut) throw new Error('ui.tutor not mounted (tutorData missing)');
    const shownIds = () => (ev['tutor:shown'] || []).map((e) => e.id);
    const clearUp = () => { tut.dismiss('test'); tut.queued.slice(); runS(0.5); };
    const fresh = () => { tut.dismiss('test'); tut.clear(); for (const k of Object.keys(ev)) ev[k].length = 0; };
    const textOf = () => document.querySelector('.ll-tutor-txt')?.textContent || '';

    ui.title.buttons.story.click(); if (lg.state !== 'playing' || !lg.sb) throw new Error('PLAY → ' + lg.state);
    step(); drain(); if (game.paused) throw new Error('still paused after the S1 opening');
    const sb = lg.sb, eco = sb.eco; if (sb.enemies) sb.enemies.enabled = false;
    const hp = sb.hero.root.position; const C = lg.curiosity; if (!C) throw new Error('lg.curiosity missing');
    eco._addSpark(500 - eco.state.spark, 'test');

    // ---- T2.G1 + T2.1: a stall far from Pip; Pip walks into its radius
    hp.set(0, 0, 0); step(); runS(0.6);
    { const cands = [[-3, -2], [3, -2], [-3, 3], [3, 3], [0, -4], [0, 4], [-5, 0], [5, 0]]; const sid = ['stall_fruit', 'stall_bread', 'stall_tea', 'stall_flower'].find((id) => !sb.build.placeBlocker(id) && sb.build.entry(id)); if (!sid) throw new Error('no free stall type: ' + JSON.stringify([...sb.build.placed.values()].map((e) => e.id))); const c = cands.find(([x, z]) => sb.build.canPlace(sid, x, z, 0)); if (!c) throw new Error('no cell for ' + sid + ' (tried ' + cands.length + '; placed ' + JSON.stringify([...sb.build.placed.values()].map((e) => e.id)) + ')');
      if (!sb.build.place(sid, c[0], c[1], 0, { animate: false })) throw new Error('could not place ' + sid); hp.set(c[0] + 8, 0, c[1] + 6); step(); }
    runS(1);
    const ids = C.things().map((t) => t.id); const stallId = ids.find((i) => i.startsWith('stall:')); const signId = ids.find((i) => i.startsWith('sign:'));
    if (!stallId || !signId) throw new Error('registry does not see the stall/sign: ' + JSON.stringify(ids));
    fresh(); runS(1); eq(shownIds(), [], 'T2.G1 nothing announced while Pip is far');
    ok(`T2.G1 registry sees ${C.size} things (${stallId}, ${signId}) · nothing announced at start`);

    const T = C.get(stallId); const sdir = { x: hp.x - T.x, z: hp.z - T.z }; const sl = Math.hypot(sdir.x, sdir.z);
    const at = (d) => hp.set(T.x + sdir.x / sl * d, 0, T.z + sdir.z / sl * d);
    at(T.radius + 0.6); step(); runS(0.5); eq(shownIds(), [], 'T2.1 just outside the radius → nothing');
    at(T.radius - 0.3); let waited = 0; while (!shownIds().length && waited < 3) { step(); waited += dt; }
    if (!shownIds().length) throw new Error('T2.1 no card after entering the radius (3 s): ' + JSON.stringify({ curious: (ev['curious'] || []).length, blocked: lg.guideBlocked?.(), state: lg.state, paused: game.paused, modal: ui.isModal?.(), pending: !!eco.pendingOffer, verbsStep: lg.verbs?.step, cine: lg.cine?.active, hero: [hp.x, hp.z], thing: [T.x, T.z, T.radius, T.inside], d: Math.hypot(hp.x - T.x, hp.z - T.z), cur: tut.current })); if (waited > 1.5) throw new Error('T2.1 card took ' + waited.toFixed(2) + ' s');
    eq(shownIds()[0], 'stall:any', 'T2.1 first card'); if (!/stall|till|customers/i.test(textOf())) throw new Error('card text: ' + textOf());
    ok(`T2.1 walked into the stall radius (${T.radius} u) → 'stall:any' card after ${waited.toFixed(2)} s ("${textOf()}")`);

    // ---- T2.4 far Collector tap + blocked
    clearUp(); fresh(); hp.set(0, 0, 0); step(); runS(0.6);
    const px = (z) => ({ x: z.x, z: z.z });
    sb.enemies.enabled = true; sb.enemies.waveSeason = null; const sp = sb.enemies.spawnWave(eco.state.season); sb.enemies.enabled = false; runS(0.6);
    const en = C.things().find((t) => t.id.startsWith('enemy:')); if (!en) throw new Error('T2.4 no enemy registered after spawnWave: ' + JSON.stringify(C.things().map((t) => t.id)) + ' sp=' + JSON.stringify(sp));
    const far = Math.hypot(en.x - hp.x, en.z - hp.z); const wasPing = (ev['curious:ping'] || []).length;
    clearUp(); fresh(); const h = lg.guideTap(px(en)); if (h !== true) throw new Error('T2.4 guideTap on a Collector not consumed: ' + h);
    if (shownIds().at(-1) !== 'enemy:collector') throw new Error('T2.4 card ' + shownIds()); if (!document.querySelector('.ll-tutor-hand')) throw new Error('hand element missing');
    ok(`T2.4 tapped a Collector ${far.toFixed(1)} u away → 'enemy:collector' card + hand (pings seen at landing: ${wasPing})`);
    clearUp(); fresh();
    lg.story?.state && ui.dialogue.open?.({ lines: [{ who: 'owl', text: 'hi' }] }); const dlgOpen = ui.dialogue.isOpen;
    if (dlgOpen) { C.tap(px(en)); eq(shownIds(), [], 'T2.4 no card while a dialogue is open'); drain(); ok('T2.4 dialogue open → a tap on the Collector shows nothing'); }
    else { const b = lg.guideBlocked; ui.pause.open(); if (!lg.guideBlocked()) throw new Error('guideBlocked false while paused'); C.tap(px(en)); eq(shownIds(), [], 'T2.4 no card while paused'); ui.pause.close(); void b; ok('T2.4 pause/modal open → a tap on the Collector shows nothing (dialogue.open unavailable on the shim)'); }
    for (const e of [...(sb.enemies.list || [])]) { try { e.root?.removeFromParent?.(); } catch { /* ok */ } } sb.enemies.list.length = 0; runS(0.6);

    // ---- T2.5 text/icon rules + persistence
    for (const c of tutorData.cards) { if (String(c.text || '').length > 60) throw new Error(c.id + ' text > 60'); if (!c.icon) throw new Error(c.id + ' no icon'); }
    clearUp(); fresh(); tut.ask('jar:save'); tut.dismiss('t'); tut.ask('jar:save'); tut.dismiss('t'); tut.ask('stall:any'); tut.dismiss('t'); tut.retire('till:coins');
    const snap = lg.save.snapshot(); if (!snap.tutorCounts || !(snap.tutorCounts['jar:save'] >= 2) || snap.tutorCounts['till:coins'] !== 99) throw new Error('snapshot.tutorCounts ' + JSON.stringify(snap.tutorCounts));
    const parsed = Save.parseSnapshot(JSON.stringify(snap)); eq(parsed.tutorCounts, snap.tutorCounts, 'T2.5 parse keeps counts');
    const old = JSON.parse(JSON.stringify(snap)); delete old.tutorCounts; old.tutorSeen = ['jar:save', 'onBuildOpen']; const op = Save.parseSnapshot(JSON.stringify(old)); eq(op.tutorCounts, {}, 'T2.5 old save → {}'); eq(op.tutorSeen, ['jar:save', 'onBuildOpen'], 'T2.5 old tutorSeen survives');
    const bad1 = JSON.parse(JSON.stringify(snap)); bad1.tutorCounts = { 'jar:save': 'x', a: -3, b: 2.7, c: 500 }; const bp = Save.parseSnapshot(JSON.stringify(bad1)); eq(bp.tutorCounts, { b: 2, c: 99 }, 'T2.5 junk counts sanitized');
    lg.toTitle?.('check'); storage.setItem(Save.SAVE_KEY, JSON.stringify(snap)); if (!lg.resume(parsed)) throw new Error('resume failed'); step(); drain(); game.paused = false; if (lg.sb?.enemies) lg.sb.enemies.enabled = false;
    if (!(ui.tutor.counts['jar:save'] >= 2) || ui.tutor.counts['till:coins'] !== 99) throw new Error('counts after resume ' + JSON.stringify(ui.tutor.counts));
    ui.tutor.dismiss('test'); for (const k of Object.keys(ev)) ev[k].length = 0; ui.tutor.offer('till:coins'); eq(shownIds(), [], 'T2.5 a card retired by doing it stays retired after reload (counts restored, NOT cleared)');
    ok(`T2.5 all ${tutorData.cards.length} cards ≤ 60 chars with an icon · counts {jar:save:${snap.tutorCounts['jar:save']}, till:coins:99} survive snapshot → JSON → resume · old tutorSeen-only save → {} (ids count once) · junk sanitized`);

    // ---- T2.6 HUD taps
    const sb2 = lg.sb; sb2.hero.root.position.set(0, 0, 0); step();
    const tap = (node) => { window.dispatchEvent({ type: 'pointerdown', target: node, bubbles: true }); };
    const guideNodes = []; { const walk = (nd) => { for (const c of nd.children || []) { if (c.dataset && c.dataset.guide) guideNodes.push(c); walk(c); } }; walk(document.body); }   // domshim's dataset is a plain object: [data-guide] selectors cannot match, so walk the tree
    const guides = [...new Set(guideNodes.map((e) => e.dataset.guide))]; if (guides.length < 4) throw new Error('HUD [data-guide] ids: ' + guides);
    for (const g of guides) {
      const node = guideNodes.find((e) => e.dataset.guide === g); ui.tutor.dismiss('t'); fresh(); tap(node);
      if (ui.tutor.current !== g) throw new Error(`T2.6 tap ${g} → current ${ui.tutor.current}`); tap(node); eq(shownIds().filter((i) => i === g).length, 1, `T2.6 ${g} second tap keeps the card up`);
      ui.tutor.dismiss('t'); tap(node); eq(shownIds().filter((i) => i === g).length, 2, `T2.6 ${g} re-ask after dismiss`);
    }
    ok(`T2.6 pointerdown on ${guides.length} HUD things (${guides.join(', ')}) → card at once, every time, no cap`);

    // ---- T2.8 coverage
    const have = new Set(tutorData.cards.map((c) => c.id)); const wanted = [...GUIDE_HINTS, ...HUD_GUIDES, ...guides, ...(lg.curiosity?.hints() || [])];
    const missing = [...new Set(wanted)].filter((i) => !have.has(i)); if (missing.length) throw new Error('T2.8 ids without a card: ' + missing.join(', '));
    const anyTarget = tutorData.cards.filter((c) => c.target).map((c) => c.target).filter((t) => !have.has(t)); if (anyTarget.length) throw new Error('T2.8 card target without card: ' + anyTarget);
    ok(`T2.8 coverage: ${new Set(wanted).size} guide ids (${GUIDE_HINTS.length} wire + ${HUD_GUIDES.length} HUD + live registry) all have a card of ${have.size}`);

    // ---- T2.7 codex
    const cx = ui.guideCodex; if (!cx) throw new Error('ui.guideCodex missing'); ui.tutor.clear(); ui.tutor.ask('jar:save'); ui.tutor.dismiss('t'); ui.tutor.ask('stall:any'); ui.tutor.dismiss('t');
    ui.pause.open(); ui.pause.buttons.guide.click(); if (!cx.isOpen) throw new Error('GUIDE button did not open the codex');
    const rows = cx.list.querySelectorAll('.ll-codex-row'); const list = ui.tutor.list(); eq(rows.length, list.length, 'T2.7 row count = cards'); const metRows = rows.filter((r) => r.classList.contains('met')).length;
    eq(metRows, 2, 'T2.7 met rows'); if (!/^2 \/ \d+ met$/.test(cx.count.textContent)) throw new Error('header ' + cx.count.textContent); eq(cx.summary().total, list.length, 'T2.7 total');
    if (rows.filter((r) => r.classList.contains('unmet')).some((r) => /\d/.test(r.querySelector('.ll-codex-txt').textContent) && !/found/.test(r.querySelector('.ll-codex-txt').textContent))) throw new Error('unmet row leaks text');
    if (ui.tutor.ask('till:coins')) throw new Error('T2.7 a card was shown while the pause menu is open'); ui.tutor.merge({ counts: { 'till:coins': 1 } }); cx.render();   // ask() is refused under a modal (correct); a card met earlier is simulated through merge if (!/^3 \/ \d+ met$/.test(cx.count.textContent)) throw new Error('header after 3rd ' + cx.count.textContent);
    if (ui.escape() !== 'codex' || cx.isOpen) throw new Error('Esc did not close the codex first'); if (!ui.pause.isOpen) throw new Error('Esc closed the pause menu too'); ui.pause.close(); if (cx.isOpen) throw new Error('codex open after pause close');
    ok(`T2.7 pause → GUIDE opens the codex: ${rows.length} rows (2 met, rest grey) · header "${cx.count.textContent}" follows play · Esc closes the codex before the pause menu`);

    console.log(`  T2 CURIOSITY: ${n}/${n} PASS`);
  } catch (err) {
    bad++; console.log(`  T2 CURIOSITY FAIL (after ${n} OK) → ${err?.stack?.split('\n').slice(0, 3).join(' | ') || err}`);
  }
  finally { cleanup?.(); }
  return bad;
}
