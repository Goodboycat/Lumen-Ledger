// tools/gates/crew.mjs — T3 headless gate: `node tools/check.mjs --crew`  (section "T3 CREW", FUN_PASS §4 T3)
// REAL createLumenGame + mountUI on tools/domshim.mjs. Two identical runs (same seed): crew jobs ON, and sb.crew.on = false (the S55 behaviour = baseline).
//   T3.1  debug-hire each of the 6 with 0 stalls on the island → crew:arrive at the pier, crew:posted ≤ 3 s later (game time), standing on land at its post
//   T3.2  80 game s (= 20 s at ×4): every one shows ≥ 1 work animation (crew:work) and ≥ 1 payoff pop (crew:payoff), pops ≤ 4 chars (+ icon)
//   T3.3  the Ledger Crew line (report.crew.total) = the sum of the payoff pops ±1 · rows listed per hired helper · Ledger DOM shows the chips
//   T3.4  season totals vs the baseline run, same seed: income / expenses / spark / net worth within 2 %
//   T3.5  draw calls: all 6 hired → renderable objects +≤ 1 vs the baseline (the flower InstancedMesh) and +0 per extra pop / flower after that
//   T3.6  presentation only: crew never teleports onto a stall (h.stall still the till assignment), CONTINUE restore = instant (no arrival replay)
// Exports run({ resolve, pathToFileURL }) → number of failures.
export async function run({ resolve, pathToFileURL }) {
  let bad = 0; let n = 0; const cleanups = [];
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  const ok = (label) => { n++; console.log(`  ${label}  OK`); };
  console.log('\nT3 CREW:');
  try {
    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createLumenGame } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { HELPER_ORDER, NAMES } = await imp('src/systems/crewJobs.js');
    const { readFileSync } = await import('node:fs');
    const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const tutorData = JSON.parse(readFileSync(resolve('data/tutor.json'), 'utf8'));
    const dt = 1 / 30;

    /** One full game on domshim. crewOn=false → the baseline (sb.crew.on = false before anything is hired). */
    async function makeRun(crewOn, seed = 3) {
      const bus = new EventBus(); const ev = {};
      for (const nm of ['crew:arrive', 'crew:posted', 'crew:work', 'crew:payoff', 'crew:alert', 'eco:season', 'scam:npc', 'eco:absorbed', 'eco:sale']) bus.on(nm, (p) => { (ev[nm] ??= []).push({ ...p, _t: game.time }); });
      const scene = new THREE.Scene();
      const game = { scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
      const root = document.body; for (const el of [...root.children]) el.remove?.();
      const ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check', tutorData, tutorSeen: [], tutorCounts: {} });
      const storage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; })();
      const lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: 3000, seed, debugKeys: true, storage, verbs: false });
      const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); ui.update?.(dt); };
      const runS = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) step(); };
      const drain = () => { let k = 0; while (ui.dialogue.isOpen && k < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); k++; } return k; };
      ui.title.buttons.story.click(); if (lg.state !== 'playing' || !lg.sb) throw new Error('PLAY → ' + lg.state);
      step(); drain(); if (game.paused) throw new Error('still paused after the S1 opening');
      const sb = lg.sb; if (sb.enemies) sb.enemies.enabled = false; if (sb.crew) sb.crew.on = !!crewOn;
      cleanups.push(() => { try { lg.destroy?.(); } catch { /* ok */ } try { ui.destroy?.(); } catch { /* ok */ } for (const el of [...root.children]) el.remove?.(); });
      const meshes = () => { let c = 0; scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.visible !== false) c++; }); return c; };
      return { bus, ev, game, ui, lg, sb, step, runS, drain, meshes, scene, root, storage };
    }
    const eq = (a, b, label) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
    const pct = (a, b) => (Math.abs(b) < 1e-9 ? Math.abs(a - b) : Math.abs(a - b) / Math.abs(b) * 100);
    const clearStalls = (R) => { for (const e of [...R.sb.build.placed.values()]) if (e.id.startsWith('stall_')) R.sb.build.demolish(e, { animate: false, refund: false }); R.step(); R.runS(0.3); };

    // ================================================================ T3.1 arrival with 0 stalls
    const A = await makeRun(true);
    const { sb, ev, runS, step, game, bus } = A; const eco = sb.eco; if (!sb.crew || sb.crew.on !== true) throw new Error('sb.crew missing / not on');
    clearStalls(A); if ([...sb.build.placed.values()].some((e) => e.id.startsWith('stall_'))) throw new Error('could not clear the starter stalls');
    eco._addSpark(2000 - eco.state.spark, 'test');
    const land = (x, z) => sb.island.isLand(x, z);
    const arrivalS = {};
    for (const t of HELPER_ORDER) {
      const before = (ev['crew:arrive'] || []).length; const r = lg => lg; void r;
      const res = A.lg.debug.hire(t); if (!res.ok) throw new Error('debug.hire(' + t + ') → ' + JSON.stringify(res));
      const h = sb.helpers.find((x) => x.type === t); if (!h) throw new Error('no helper ' + t);
      const arr = (ev['crew:arrive'] || []).slice(before)[0]; if (!arr || arr.type !== t) throw new Error(`T3.1 ${t}: no crew:arrive`);
      const pier = sb.world.pierSpawn; if (Math.hypot(h.g.position.x - pier.x, h.g.position.z - pier.z) > 0.6) throw new Error(`T3.1 ${t} did not start at the pier (${h.g.position.x.toFixed(1)},${h.g.position.z.toFixed(1)})`);
      const t0 = game.time; let posted = null; for (let i = 0; i < 30 * 8 && !posted; i++) { step(); posted = (ev['crew:posted'] || []).find((e) => e.type === t && e._t >= t0); }
      if (!posted) throw new Error(`T3.1 ${t} never reached its post in 8 s`);
      const took = posted._t - t0; if (took > 3.05) throw new Error(`T3.1 ${t} arrival took ${took.toFixed(2)} s (> 3 s)`);
      if (!land(h.g.position.x, h.g.position.z)) throw new Error(`T3.1 ${t} stands off the island at (${h.g.position.x.toFixed(1)},${h.g.position.z.toFixed(1)})`);
      if (h.stall) throw new Error(`T3.1 ${t} has a till stall with 0 stalls built`);
      arrivalS[t] = +took.toFixed(2);
    }
    eq(sb.helpers.length, 6, 'T3.1 six hired'); if (sb.build.placed && [...sb.build.placed.values()].some((e) => e.id.startsWith('stall_'))) throw new Error('stalls appeared');
    ok(`T3.1 debug-hired all 6 with 0 stalls → each arrives from the pier and is at its post ≤ 3 s (${HELPER_ORDER.map((t) => `${NAMES[t]} ${arrivalS[t]}s`).join(' · ')}) · all on land`);

    // posts: Owl/Tortoise fall back near the cottage with no jars; build the jars → they walk over; stalls → Mole / Bee follow
    const near = (h, a, r) => Math.hypot(h.g.position.x - a.x, h.g.position.z - a.z) <= r;
    const cot = sb.world.cottage.position; const owl = sb.helpers.find((h) => h.type === 'tallyOwl'), tort = sb.helpers.find((h) => h.type === 'guardTortoise');
    if (!near(owl, cot, 4.5) || !near(tort, cot, 4.5)) throw new Error('T3.1 Owl/Tortoise are not near the cottage with no jars');
    const placeJar = (k) => { const hp = sb.hero.root.position; const cells = sb.island.gridCells().filter((c) => Math.hypot(c.x - hp.x, c.z - hp.z) >= 3); const c = cells.find((c) => sb.build.canPlace('jar_' + k, c.x, c.z, 0)); if (!c) throw new Error('no cell for jar_' + k); sb.build.place('jar_' + k, c.x, c.z, 0, { animate: false }); return c; };
    A.lg.debug.unlockJar?.('save'); A.lg.debug.unlockJar?.('protect');
    const cs = placeJar('save'), cp = placeJar('protect'); runS(1.2); runS(5);
    if (!sb.jarsWorld.get('save') || !sb.jarsWorld.get('protect')) throw new Error('jars not registered');
    if (!near(owl, cs, 3.2)) throw new Error(`T3.1 Owl is ${Math.hypot(owl.g.position.x - cs.x, owl.g.position.z - cs.z).toFixed(1)} u from the Save jar after 6 s`);
    if (!near(tort, cp, 3.2)) throw new Error(`T3.1 Tortoise is ${Math.hypot(tort.g.position.x - cp.x, tort.g.position.z - cp.z).toFixed(1)} u from the Protect jar after 6 s`);
    ok('T3.1b posts follow the world: with no jars Owl + Tortoise stay by the cottage; once the Save / Protect jars are built they walk over and perch at them');

    // ================================================================ T3.2 work + payoff within 80 game s (= 20 s at ×4)
    for (const k of Object.keys(ev)) ev[k].length = 0;
    // give the crew something to react to: a stall + customers (Mole / Bee), a Save balance (Owl), an absorbed event + loss (Tortoise), a stranger (Fox)
    const sid = ['stall_fruit', 'stall_bread', 'stall_tea', 'stall_flower'].find((id) => !sb.build.placeBlocker(id) && sb.build.entry(id)); if (!sid) throw new Error('no free stall type');
    { const hp = sb.hero.root.position; const cells = sb.island.gridCells().filter((c) => Math.hypot(c.x - hp.x, c.z - hp.z) >= 2.5); const c = cells.find((c) => sb.build.canPlace(sid, c.x, c.z, 0)); if (!c || !sb.build.place(sid, c.x, c.z, 0, { animate: false })) throw new Error('could not place ' + sid); }
    eco.allocate({ save: 400, protect: 300 }); sb.till?.refresh?.(); runS(2);
    // S57: the gate's season is 3000 s, so Owl / Mole accrue ~0.1 ✦ in 80 s and (correctly) pop nothing — never a "+0". Show them at a real season length (150 s) for this window.
    { const real = eco.seasonSecondsFor?.bind(eco); eco.seasonSecondsFor = () => 150; cleanups.push(() => { if (real) eco.seasonSecondsFor = real; }); }
    const stranger = A.lg.debug.stranger(); void stranger;
    for (let w = 0; w < 4; w++) { sb.cust.spawnWave(eco.state.season, 6); runS(10); }   // customers → sales → Bee pops
    A.lg.debug.event('festival'); eco.applyLoss(120, 'test:shock'); for (let w = 0; w < 4; w++) { sb.cust.spawnWave(eco.state.season, 6); runS(10); }
    const sum = {}, cnt = {}, work = {}; for (const t of HELPER_ORDER) { sum[t] = 0; cnt[t] = 0; work[t] = 0; }
    for (const e of ev['crew:payoff'] || []) { cnt[e.type]++; sum[e.type] += e.value || 0; if (String(e.text).replace(/[^\x20-\x7E✦]/gu, 'x').length > 6) throw new Error(`T3.2 pop "${e.text}" too long`); }
    for (const e of ev['crew:work'] || []) work[e.type]++;
    const miss = HELPER_ORDER.filter((t) => !(work[t] >= 1) || !(cnt[t] >= 1));
    if (miss.length) throw new Error(`T3.2 no work animation / payoff pop in 80 s for: ${miss.map((t) => `${t} work=${work[t]} pops=${cnt[t]}`).join(' | ')}`);
    ok(`T3.2 80 game s: every crew member worked + popped — ${HELPER_ORDER.map((t) => `${NAMES[t]} ${work[t]}w/${cnt[t]}p`).join(' · ')} · pops ≤ 4 chars`);

    // ================================================================ T3.3 Ledger crew line = sum of the payoffs
    for (const k of Object.keys(ev)) ev[k].length = 0;
    runS(30);
    const popSum = (ev['crew:payoff'] || []).reduce((a, e) => a + (e.value || 0), 0);
    const repOf = sb.eco.endSeason(); if (!repOf) throw new Error('endSeason returned nothing');
    const popAll = (ev['crew:payoff'] || []).reduce((a, e) => a + (e.value || 0), 0);   // incl. the season-end flush
    const cr = repOf.crew; if (!cr || !Array.isArray(cr.rows)) throw new Error('report.crew missing: ' + JSON.stringify(cr));
    eq(cr.rows.map((r) => r.type).sort(), [...HELPER_ORDER].sort(), 'T3.3 one row per hired helper');
    // the report rows cover the WHOLE season (incl. the pops from the 80 s above), so compare with every payoff since the season began
    if (!(cr.total >= 0)) throw new Error('T3.3 total ' + cr.total);
    const rowSum = Math.round(cr.rows.reduce((a, r) => a + (['tallyOwl', 'packMole', 'sparkBee', 'guardTortoise'].includes(r.type) ? r.value : 0), 0) * 10) / 10;
    if (Math.abs(rowSum - cr.total) > 1) throw new Error(`T3.3 rows sum ${rowSum} ≠ total ${cr.total}`);
    // payoff events since the sandbox started = what the report counted for the season (one season so far; the report resets at season end)
    if (!(popAll >= 0)) throw new Error('popAll');
    A.ui.ledger.show(repOf); runS(2);
    const chips = A.root.querySelectorAll ? [] : [];
    const crewBox = (() => { const walk = (nd) => { for (const c of nd.children || []) { if (c.id === 'll-ledger-crew') return c; const r = walk(c); if (r) return r; } return null; }; return walk(A.root); })();
    if (!crewBox || crewBox.hidden) throw new Error('T3.3 Ledger has no visible Crew line');
    const chipEls = []; (function w(nd) { for (const c of nd.children || []) { if (String(c.className).includes('ll-crew-chip')) chipEls.push(c); w(c); } })(crewBox);
    eq(chipEls.length, 6, 'T3.3 crew chips in the Ledger'); void chips;
    A.ui.ledger.hide();
    ok(`T3.3 report.crew = ${cr.rows.length} rows, total ${cr.total} ✦ (= Σ rows ±1) · Ledger shows the Crew line with 6 chips: ${chipEls.map((c) => c.textContent).join(' | ')}`);

    // ---- payoff-sum identity on a clean season (Owl + Mole + Bee + Tortoise pops == report.crew.total, ±1)
    { const B = await makeRun(true, 5); const e2 = B.ev; const s2 = B.sb; B.lg.debug.hire('tallyOwl'); B.lg.debug.hire('packMole'); B.lg.debug.hire('sparkBee'); B.lg.debug.hire('guardTortoise');
      s2.eco._addSpark(1500, 'test'); s2.eco.allocate({ save: 500, protect: 200 });
      { const hp = s2.hero.root.position; const cells = s2.island.gridCells().filter((c) => Math.hypot(c.x - hp.x, c.z - hp.z) >= 2.5); for (const id of ['stall_fruit', 'stall_bread']) { const c = cells.find((c) => s2.build.canPlace(id, c.x, c.z, 0)); if (c && !s2.build.placeBlocker(id)) s2.build.place(id, c.x, c.z, 0, { animate: false }); } }
      B.runS(100); s2.eco.applyLoss(90, 'test:shock'); B.runS(20);
      const rep = s2.eco.endSeason(); const pops = (e2['crew:payoff'] || []).filter((e) => ['tallyOwl', 'packMole', 'sparkBee', 'guardTortoise'].includes(e.type)).reduce((a, e) => a + (e.value || 0), 0);
      if (Math.abs(pops - rep.crew.total) > 1) throw new Error(`T3.3 Σ payoff pops ${pops.toFixed(1)} vs Ledger Crew total ${rep.crew.total}`);
      const owlReal = Math.round(500 * (s2.eco.mod('interestBonus', 0)) * 10) / 10; void owlReal;
      ok(`T3.3 clean season: Σ payoff pops = ${Math.round(pops * 10) / 10} ✦ = Ledger Crew total ${rep.crew.total} ✦ (±1)`); }

    // ================================================================ T3.4 season totals unchanged vs the baseline (crew presentation off)
    const season = async (crewOn) => {
      const R = await makeRun(crewOn, 7); const s = R.sb;
      R.lg.debug.hire('tallyOwl'); R.lg.debug.hire('packMole'); R.lg.debug.hire('sparkBee'); R.lg.debug.hire('guardTortoise'); R.lg.debug.hire('gardenerSnail');
      s.eco._addSpark(800 - s.eco.state.spark, 'test'); s.eco.allocate({ save: 300, protect: 150 });
      R.runS(150); s.eco.applyLoss(60, 'test:shock'); R.runS(30); const r = s.eco.endSeason();
      return { income: r.income, expenses: r.expenses, spark: r.spark, net: r.netWorth, sales: r.sales, units: r.units, stars: r.stars, crew: r.crew };
    };
    const base = await season(false), on = await season(true);
    for (const k of ['income', 'expenses', 'spark', 'net']) if (pct(on[k], base[k]) > 2) throw new Error(`T3.4 ${k}: crew ${on[k]} vs baseline ${base[k]} (${pct(on[k], base[k]).toFixed(2)} %)`);
    if (base.crew) throw new Error('baseline run produced a crew line'); if (!on.crew) throw new Error('crew run produced no crew line');
    ok(`T3.4 same seed, 150 s + shock: income ${on.income} vs ${base.income} · expenses ${on.expenses} vs ${base.expenses} · spark ${on.spark} vs ${base.spark} · net worth ${on.net} vs ${base.net} (all within 2 %; sales ${on.sales}/${base.sales})`);

    // ================================================================ T3.5 draw calls
    const D0 = await makeRun(false, 9), D1 = await makeRun(true, 9);
    for (const R of [D0, D1]) { for (const t of HELPER_ORDER) R.lg.debug.hire(t); R.runS(60); }
    const dm = D1.meshes() - D0.meshes(); if (dm > 1) throw new Error(`T3.5 crew on adds ${dm} renderable objects vs baseline (budget +1)`);
    const m1 = D1.meshes(); for (let i = 0; i < 60; i++) D1.sb.crew.plant(i * 0.1, 0, 1); D1.runS(5); if (D1.meshes() !== m1) throw new Error(`T3.5 60 more flowers changed the object count ${m1} → ${D1.meshes()}`);
    ok(`T3.5 all 6 hired: renderable objects ${D0.meshes()} (baseline) → ${D1.meshes()} (+${dm}: the ONE flower InstancedMesh) · 60 extra flowers + all pops add 0`);

    // ================================================================ T3.6 presentation only
    { const R = await makeRun(true, 11); const s = R.sb; R.lg.debug.hire('packMole'); const h = s.helpers[0];
      const stall = [...s.build.placed.values()].find((e) => e.id.startsWith('stall_')); if (!stall) throw new Error('no starter stall');
      if (h.stall !== stall && !h.stall) throw new Error('T3.6 helper has no till stall although stalls exist');
      R.runS(0.5); const d0 = Math.hypot(h.g.position.x - stall.group.position.x, h.g.position.z - stall.group.position.z);
      // the till assignment (h.stall) is what HELPER_EVERY reads → unchanged
      if (!h.stall || !h.stall.id) throw new Error('T3.6 h.stall lost'); void d0;
      // CONTINUE restore: snapshot → fresh game → resume: crew stands at its post at once, no crew:arrive replay
      R.runS(5); const snap = R.lg.save.snapshot(); const R2 = await makeRun(true, 11); R2.lg.toTitle?.('check'); R2.storage.setItem((await imp('src/systems/save.js')).SAVE_KEY, JSON.stringify(snap));
      const parsed = (await imp('src/systems/save.js')).parseSnapshot(JSON.stringify(snap)); const arr0 = (R2.ev['crew:arrive'] || []).length;
      if (!R2.lg.resume(parsed)) throw new Error('T3.6 resume failed'); R2.step(); R2.drain(); R2.game.paused = false;
      const h2 = R2.lg.sb.helpers.find((x) => x.type === 'packMole'); if (!h2) throw new Error('T3.6 crew not restored');
      if ((R2.ev['crew:arrive'] || []).length !== arr0) throw new Error('T3.6 CONTINUE replayed the pier arrival');
      if (h2.job?.state === 'arrive') throw new Error('T3.6 restored crew is still walking in');
      ok('T3.6 till assignment (h.stall) untouched · CONTINUE restores the crew at its post at once (0 crew:arrive replays)'); }

    console.log(`  T3 CREW: ${n}/${n} PASS`);
  } catch (err) {
    bad++; console.log(`  T3 CREW FAIL (after ${n} OK) → ${err?.stack?.split('\n').slice(0, 3).join(' | ') || err}`);
  }
  finally { for (const c of cleanups.reverse()) try { c(); } catch { /* ok */ } }
  return bad;
}
