// tools/gates/novelties43D.mjs — 43D headless gate, run by `node tools/check.mjs --novelties` after novelties.mjs
// Section "43D RAID DOUBLE + ROTATION":
//   1. raidDouble: arm sb.enemies via the novelty, spawnWave(6) → 2 Collectors in seek/raid with DIFFERENT target tills, #2 dazed (stagger),
//      bonk one mid-carry → raid:end why:'drop' ('recovered' path); novelty end → nextWaveOpts cleared.
//   2. Rotation: SS.for(7).novelty.id === 'nightMarket' · SS.for(12) === SS.for(7) · for(11..15) len 150 · gap rule across 10→11.
//   3. NEW chip: novelty:start ×2 same id (S3 + S7 nightMarket) → 1 hud:new · story serialize/deserialize keeps noveltiesSeen ·
//      save.js migrate v2 → { novelty:null, noveltiesSeen:[] }.
import { readFileSync } from 'node:fs';
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n43D RAID DOUBLE + ROTATION:');
  const THREE = await imp('vendor/three.module.js');
  const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
  const { EventBus } = await imp('src/core/EventBus.js');
  const { tweens } = await imp('src/anim/Tween.js');
  const { createSandbox, destroySandbox } = await imp('src/Game.js');
  const { NOVELTIES } = await imp('src/systems/novelties/index.js');
  const { RAID_DOUBLE } = await imp('src/systems/novelties/raidDouble.js');
  const { createSeasonScript, MARK_MIN_GAP } = await imp('src/systems/seasonScript.js');
  const { StorySystem } = await imp('src/systems/story.js');
  const { parseSnapshot, SAVE_VERSION } = await imp('src/systems/save.js');
  const data = JSON.parse(readFileSync(resolve('data/seasons.json'), 'utf8'));
  const story = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
  const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, stats: {}, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, remove(s) { const i = this.systems.indexOf(s); if (i >= 0) this.systems.splice(i, 1); }, hitstop() {} });
  const countListeners = (bus) => { let n = 0; const m = bus.listeners || bus.map || bus.handlers || bus._l || null; if (m instanceof Map) for (const v of m.values()) n += (v?.size ?? v?.length ?? 0); return n; };

  // ---- 1. raidDouble (hand-driven: seasonSeconds huge, season forced to 6, novelty started by the registry)
  try {
    if (!NOVELTIES.raidDouble) throw new Error('registry missing raidDouble');
    const bus = new EventBus(), scene = new THREE.Scene(), game = mkGame(bus, scene);
    game.lights = { key: { intensity: 1.6 }, hemi: { intensity: 0.75 } };
    const base = countListeners(bus);
    const ev = { starts: [], ends: [], rs: [], re: [], barks: [] };
    bus.on('novelty:start', (p) => ev.starts.push(p)); bus.on('novelty:end', (p) => ev.ends.push(p));
    bus.on('raid:start', (p) => ev.rs.push(p)); bus.on('raid:end', (p) => ev.re.push(p)); bus.on('story:bark', (p) => ev.barks.push(p));
    const sb = createSandbox(game, { headless: true, seed: 11, pierPays: false, seasons: data, storyData: story, seasonSeconds: 600 });
    const E = sb.enemies, T = sb.till; if (!E || !T || !sb.novelties) throw new Error('sb.enemies / sb.till / sb.novelties missing');
    E.enabled = false;
    const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
    // two stalls with money on the counters
    const stallIds = Object.keys(sb.build.catalog).filter((k) => sb.build.catalog[k].category === 'stall');
    let stalls = sb.build.stalls().filter((st) => !st.entry?.scenery);
    let k = 0; while (stalls.length < 2 && k < 6) { sb.build.place(stallIds[k % stallIds.length], 0, 2 + k * 3, 0, { animate: false, pay: false, silent: true }); stalls = sb.build.stalls().filter((st) => !st.entry?.scenery); k++; }
    if (stalls.length < 2) throw new Error('could not get 2 stalls');
    for (const st of stalls.slice(0, 2)) T.pay(st.id, 25, {});
    const tills = T.all().filter((t) => t.amount > 0); if (tills.length < 2) throw new Error('need 2 tills with money, have ' + tills.length);
    sb.hero.root.position.set(tills[0].pos.x + 12, 0, tills[0].pos.z + 12);   // Pip far away: no walk-collect, no shield
    sb.eco.state.season = 6; E.waveSeason = 0; E.enabled = true;
    sb.novelties.start('raidDouble', 6);
    if (sb.novelty?.id !== 'raidDouble') throw new Error('sb.novelty not raidDouble');
    if (!E.nextWaveOpts || E.nextWaveOpts.raiders !== 2 || !E.nextWaveOpts.distinct) throw new Error('wave not armed: ' + JSON.stringify(E.nextWaveOpts));
    if (!ev.barks.some((b) => b.speaker === 'owl' && /Two|shield/i.test(b.text))) throw new Error('no owl "two of them" bark');
    const wave = E.spawnWave(6);
    if (wave.length !== 2 || wave.some((c) => c.kind !== 'collector')) throw new Error(`wave → ${wave.length} (${wave.map((c) => c.kind)})`);
    const [a, b] = wave;
    if (!a.target || !b.target) throw new Error('a raider has no till target');
    const tA = a.target.stallId, tB = b.target.stallId; if (tA === tB) throw new Error('both raiders picked the same till ' + tA);
    if (!(b.stun >= RAID_DOUBLE.stagger - 1e-9) || a.stun > 0) throw new Error(`stagger: a.stun ${a.stun} b.stun ${b.stun}`);
    if (E.nextWaveOpts !== null) throw new Error('nextWaveOpts not consumed');
    // let them reach the counters + telegraph + carry; staggered → raid:start times ≥ stagger apart is NOT guaranteed (walk distance) but never simultaneous telegraphs
    let g = 0; while (!(a.state === 'carry' || b.state === 'carry') && g++ < 60 * 30) step();
    const carrier = a.state === 'carry' ? a : b.state === 'carry' ? b : null; if (!carrier) throw new Error(`no raider reached carry (a ${a.state}, b ${b.state})`);
    if (ev.rs.length < 1) throw new Error('no raid:start');
    const named = new Set(ev.rs.map((p) => p.stallId)); 
    // bonk the carrier → drops the loot → raid:end why:'drop' (ledger "recovered" path)
    const dir = new THREE.Vector3(1, 0, 0); E.hitEnemy(carrier, dir, 1);
    if (carrier.carry !== 0 || carrier.state !== 'seek' || !(carrier.stun > 0)) throw new Error(`after bonk: carry ${carrier.carry} state ${carrier.state} stun ${carrier.stun}`);
    if (!ev.re.some((p) => p.enemyId === carrier.id && p.why === 'drop')) throw new Error('raid:end drop missing: ' + JSON.stringify(ev.re));
    run(0.2);
    if (!ev.barks.some((b) => /One down|still carrying/i.test(b.text))) throw new Error('no "one down" bark after drop');
    // season end → novelty:end, nothing armed afterwards
    sb.novelties.end?.('raidDouble') ?? sb.novelties.stop?.();
    bus.emit('eco:season', { season: 7, prev: 6 });
    if (sb.novelty) throw new Error('novelty still active after eco:season');
    if (E.nextWaveOpts) throw new Error('nextWaveOpts still armed after end');
    destroySandbox(sb);
    const leaked = countListeners(bus) - base - 5;
    if (leaked > 0) throw new Error(`${leaked} leaked bus listeners after destroy`);
    console.log(`OK S6: raidDouble arms {raiders 2, distinct} · wave → 2 Collectors, tills ${tA} ≠ ${tB}, #2 dazed ${RAID_DOUBLE.stagger}s · ${named.size} raid:start · bonk carrier → drop + stun + bark · end → disarmed · 0 leaks`);
  } catch (e) { bad++; console.log('FAIL 43D raidDouble: ' + e.message); }

  // ---- 2. rotation S7–S10 + endless
  try {
    const SS = createSeasonScript(data);
    const r7 = SS.for(7), r12 = SS.for(12);
    if (r7.novelty?.id !== 'nightMarket') throw new Error(`S7 novelty ${r7.novelty?.id} (want nightMarket)`);
    if (r12.novelty?.id !== r7.novelty?.id || r12.wave !== r7.wave) throw new Error('S12 does not rotate to the S7 row');
    for (let s = 11; s <= 15; s++) if (SS.for(s).len !== 150) throw new Error(`S${s} len ${SS.for(s).len} (want 150)`);
    const ids = [6, 7, 8, 9, 10].map((s) => SS.for(s).novelty?.id); if (new Set(ids).size !== 5) throw new Error('S6–S10 novelties not all distinct: ' + ids);
    const num = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
    const bad2 = [];
    for (let s = 2; s <= 16; s++) { const p = SS.for(s - 1), c = SS.for(s); for (const kd of ['warn', 'event', 'scam', 'wave']) { const pv = num(p[kd]), cv = num(c[kd]); if (pv.length && cv.length && Math.abs(pv[0] - cv[0]) < MARK_MIN_GAP - 1e-9) bad2.push(`S${s} ${kd} ${cv[0]} ≈ S${s - 1} ${pv[0]}`); } const pn = p.novelty?.at, cn = c.novelty?.at; if (pn != null && cn != null && Math.abs(pn - cn) < MARK_MIN_GAP - 1e-9) bad2.push(`S${s} novelty.at`); }
    if (bad2.length) throw new Error('gap rule: ' + bad2.join(', '));
    console.log(`OK rotation: S7 nightMarket · S12 = S7 row · S11–15 len 150 · S6–10 novelties distinct (${ids.join(', ')}) · gap rule S1→S16 incl. 10→11 wrap`);
  } catch (e) { bad++; console.log('FAIL 43D rotation: ' + e.message); }

  // ---- 3. NEW chip once per id + noveltiesSeen save/migrate
  try {
    const bus = new EventBus(); const news = []; bus.on('hud:new', (p) => news.push(p));
    const st = new StorySystem(null, { bus, data: story, autoplay: true, tutorial: false });
    bus.emit('novelty:start', { id: 'nightMarket', label: 'Night market', season: 3 });
    bus.emit('novelty:start', { id: 'nightMarket', label: 'Night market', season: 7 });
    bus.emit('novelty:start', { id: 'raidDouble', label: 'Double raid', season: 6 });
    if (news.length !== 2) throw new Error(`hud:new ×${news.length} (want 2: nightMarket once + raidDouble)`);
    if (!/Night market/.test(news[0].text) || !/NEW/i.test(news[0].text)) throw new Error('chip text ' + news[0].text);
    const ser = st.serialize(); const st2 = StorySystem.deserialize(ser, null, { bus: new EventBus(), data: story, autoplay: false, tutorial: false });
    if (!st2.state.noveltiesSeen.includes('nightMarket') || !st2.state.noveltiesSeen.includes('raidDouble')) throw new Error('noveltiesSeen lost on deserialize: ' + JSON.stringify(st2.state.noveltiesSeen));
    st.destroy?.(); st2.destroy?.();
    if (!(SAVE_VERSION >= 3)) throw new Error('SAVE_VERSION ' + SAVE_VERSION);   // 43D introduced v3 (novelty fields); 48E bumped to v4 — the gate only needs ≥ 3
    const ECO = { state: { season: 3, spark: 10, jars: {} } };
    const v2 = parseSnapshot(JSON.stringify({ v: 2, t: 1, season: 3, midSeason: true, eco: ECO, build: [], story: { v: 1, state: {} }, jars: {}, helpers: [], abilities: ['dash', 'shield'], starsTotal: 2 }));
    if (!v2 || v2.novelty !== null || !Array.isArray(v2.noveltiesSeen) || v2.noveltiesSeen.length) throw new Error('v2 migrate → ' + JSON.stringify(v2 && { novelty: v2.novelty, seen: v2.noveltiesSeen }));
    const v3 = parseSnapshot(JSON.stringify({ v: 3, t: 1, season: 3, midSeason: true, eco: ECO, build: [], story: { v: 1, state: {} }, jars: {}, helpers: [], abilities: ['dash'], starsTotal: 0, novelty: 'nightMarket', noveltiesSeen: ['nightMarket'] }));
    if (!v3 || v3.novelty !== 'nightMarket' || v3.noveltiesSeen[0] !== 'nightMarket') throw new Error('v3 parse lost novelty');
    console.log('OK NEW chip: nightMarket S3+S7 → 1 chip, raidDouble → 1 · noveltiesSeen survives serialize · save v2 → {novelty:null, seen:[]} · v3 keeps novelty');
  } catch (e) { bad++; console.log('FAIL 43D new chip/save: ' + e.message); }
  return bad;
}
