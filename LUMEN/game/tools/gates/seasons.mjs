// tools/gates/seasons.mjs — 43A headless gate: `node tools/check.mjs --seasons`  (section "43A SEASON SCRIPTS")
// Proves, with the REAL createSandbox on the game-time clock (no browser):
//   1. shipped data/seasons.json validates (SS.validate() === []) and its S1 row equals the legacy SCHEDULER_MARKS within 1e-9.
//   2. a headless sandbox fed the script fires EVERY mark of S1→S3 exactly once per season (count `season:mark` per season/kind
//      against SS.marks(season)), emits `season:novelty` for S2 (stormWarning) and S3 (nightMarket), forces S2's event to `storm`
//      (sb.nextEvent at the start of S2 + the S2 event log line), skips the direct offer on a `baron` scamKind (S4 row), and
//      the sandbox season lengths follow row.len (eco.seasonSecondsFor(1..3) = 70/90/110) when no seasonSeconds override is given.
//   3. fallback path (no json): legacy marks still fire trickle×2 + wave (+ event/warn/scam on odd seasons), no novelty, S2 no scam.
//   4. destroySandbox → 0 leaked bus listeners.
// Exports run({ resolve, pathToFileURL }) → number of failures (check.mjs adds it to `bad`).
import { readFileSync } from 'node:fs';
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n43A SEASON SCRIPTS:');
  const THREE = await imp('vendor/three.module.js');
  const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
  const { EventBus } = await imp('src/core/EventBus.js');
  const { tweens } = await imp('src/anim/Tween.js');
  const { createSandbox, destroySandbox, SCHEDULER_MARKS } = await imp('src/Game.js');
  const { createSeasonScript, LEGACY_MARKS } = await imp('src/systems/seasonScript.js');
  const data = JSON.parse(readFileSync(resolve('data/seasons.json'), 'utf8'));
  const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, stats: {}, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, remove(s) { const i = this.systems.indexOf(s); if (i >= 0) this.systems.splice(i, 1); }, hitstop() {} });
  const countListeners = (bus) => { let n = 0; const m = bus.listeners || bus.map || bus.handlers || bus._l || null; if (m instanceof Map) for (const v of m.values()) n += (v?.size ?? v?.length ?? 0); else if (m && typeof m === 'object') for (const k of Object.keys(m)) n += (m[k]?.size ?? m[k]?.length ?? 0); return n; };
  const mkSb = (opts) => {
    const bus = new EventBus(), scene = new THREE.Scene(), game = mkGame(bus, scene);
    const base = countListeners(bus);
    const marks = {}, novel = [], seasonsEv = [];
    bus.on('season:mark', (p) => { const k = `${p.season}:${p.kind}`; marks[k] = (marks[k] || 0) + 1; });
    bus.on('season:novelty', (p) => novel.push(p));
    bus.on('eco:season', (p) => seasonsEv.push(p));
    const sb = createSandbox(game, { headless: true, seed: 7, pierPays: false, ...opts });
    sb.enemies && (sb.enemies.enabled = true);
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
    const runUntilSeason = (n, maxSec = 600) => { for (let i = 0; i < maxSec * 30 && sb.eco.state.season < n && !sb.eco.state.ended; i++) step(); };
    return { bus, scene, game, sb, step, runUntilSeason, marks, novel, seasonsEv, base };
  };
  const expectedCounts = (SS, season) => { const c = {}; for (const m of SS.marks(season)) c[m.kind] = (c[m.kind] || 0) + 1; return c; };
  const gotCounts = (marks, season) => { const c = {}; for (const k of Object.keys(marks)) { const [s, kind] = k.split(':'); if (Number(s) === season) c[kind] = marks[k]; } return c; };
  const same = (a, b) => JSON.stringify(Object.keys(a).sort().map((k) => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]]));

  // 1. data + S1 == legacy
  try {
    const SS = createSeasonScript(data); const errs = SS.validate();
    if (errs.length) throw new Error('validate: ' + errs.join(' | '));
    const r1 = SS.for(1);
    r1.trickle.forEach((v, i) => { if (Math.abs(v - SCHEDULER_MARKS.trickle[i]) > 1e-9) throw new Error(`S1 trickle[${i}] ${v} ≠ ${SCHEDULER_MARKS.trickle[i]}`); });
    if (Math.abs(r1.wave - SCHEDULER_MARKS.wave(1)) > 1e-9) throw new Error(`S1 wave ${r1.wave} ≠ ${SCHEDULER_MARKS.wave(1)}`);
    if (LEGACY_MARKS.scam !== SCHEDULER_MARKS.scam || LEGACY_MARKS.event !== SCHEDULER_MARKS.event || LEGACY_MARKS.warn !== SCHEDULER_MARKS.warn) throw new Error('LEGACY_MARKS drifted from SCHEDULER_MARKS');
    for (let s = 2; s <= 10; s++) { const a = SS.for(s), b = SS.for(s - 1); for (const k of ['warn', 'event', 'scam', 'wave']) if (a[k] != null && b[k] != null && Math.abs(a[k] - b[k]) < 0.02) throw new Error(`S${s} ${k} repeats S${s - 1}`); }
    console.log(`OK data: seasons.json validates (S1–${SS.maxSeason} + endless ${SS.rotate.join(',')}), S1 row = legacy SCHEDULER_MARKS, no consecutive repeat`);
  } catch (e) { bad++; console.log('FAIL data: ' + e.message); }

  // 2. real sandbox S1→S3 (+ S4 start) with the script on a fast clock
  try {
    const SS = createSeasonScript(data);
    const A = mkSb({ seasons: data, seasonSeconds: 20 }); const { sb, marks, novel, seasonsEv, bus, base } = A;
    if (sb.seasons.legacy) throw new Error('sandbox fell back to legacy script');
    const measured = [];
    for (let s = 1; s <= 3; s++) {
      if (sb.eco.state.season !== s) throw new Error(`season ${sb.eco.state.season} ≠ ${s} before run`);
      if (s === 2 && sb.nextEvent !== 'storm') throw new Error(`S2 forceEvent: nextEvent ${sb.nextEvent}`);
      A.runUntilSeason(s + 1);
      const exp = expectedCounts(SS, s), got = gotCounts(marks, s);
      if (!same(exp, got)) throw new Error(`S${s} marks fired ${JSON.stringify(got)} expected ${JSON.stringify(exp)} · log ${sb.log.filter((l) => l.startsWith('S' + s)).join(' / ')}`);
      measured.push(`S${s}=${Object.values(got).reduce((a, b) => a + b, 0)}`);
    }
    if (seasonsEv.length !== 3) throw new Error(`eco:season ${seasonsEv.length} ≠ 3`);
    const nov = novel.map((n) => `${n.season}:${n.id}`); if (!nov.includes('2:stormWarning') || !nov.includes('3:nightMarket') || novel.length !== 2) throw new Error('season:novelty ' + JSON.stringify(nov));
    if (!sb.log.some((l) => /^S2 (event storm|storm ABSORBED|storm clouds)/.test(l)) && !sb.log.some((l) => l.startsWith('S2 event storm'))) throw new Error('S2 forced storm not in log: ' + sb.log.filter((l) => l.startsWith('S2')).join(' / '));
    // S4 row: scamKind baron → no direct offer, no NPC; still counted as a mark
    sb.enemies && (sb.enemies.enabled = false);
    let offers = 0; const off = bus.on('eco:offer', () => offers++);
    A.runUntilSeason(5);
    const got4 = gotCounts(marks, 4), exp4 = expectedCounts(SS, 4); if (!same(exp4, got4)) throw new Error(`S4 marks ${JSON.stringify(got4)} expected ${JSON.stringify(exp4)}`);
    if (offers !== 0 || sb.eco.pendingOffer) throw new Error(`S4 baron scamKind still offered a deal (${offers})`);
    off?.();
    // destroy → no leaks
    destroySandbox(sb); const after = countListeners(bus);
    if (after > base + 3) throw new Error(`leaked listeners: ${after - base - 3}`);   // +3 = this gate's own listeners
    console.log(`OK sandbox: every mark once per season (${measured.join(' ')}), novelties ${nov.join(' ')}, S2 forced storm, S4 baron scamKind = no offer, destroy → 0 leaks`);
  } catch (e) { bad++; console.log('FAIL sandbox: ' + e.message); }

  // 2b. lengths follow row.len without an override
  try {
    const B = mkSb({ seasons: data }); const eco = B.sb.eco; const got = [1, 2, 3, 4, 5, 6].map((s) => eco.seasonSecondsFor(s)); const exp = [70, 90, 110, 130, 150, 150];
    if (got.join() !== exp.join()) throw new Error(`seasonSecondsFor ${got.join()} ≠ ${exp.join()}`);
    const C = mkSb({ seasons: data, seasonSeconds: 20 }); if (C.sb.eco.seasonSecondsFor(1) !== 20) throw new Error('seasonSeconds override lost: ' + C.sb.eco.seasonSecondsFor(1));
    destroySandbox(B.sb); destroySandbox(C.sb);
    console.log(`OK lengths: seasonSecondsFor = ${got.join('/')} from row.len; opts.seasonSeconds still overrides`);
  } catch (e) { bad++; console.log('FAIL lengths: ' + e.message); }

  // 3. fallback (no json) = legacy behaviour
  try {
    const F = mkSb({ seasons: null, seasonSeconds: 20 }); const { sb, marks, novel } = F;
    if (!sb.seasons.legacy) throw new Error('expected legacy script');
    F.runUntilSeason(3);
    const c1 = gotCounts(marks, 1), c2 = gotCounts(marks, 2);
    if (c1.trickle !== 2 || c1.wave !== 1 || c1.event !== 1 || c1.warn !== 1 || c1.scam !== 1) throw new Error('S1 legacy ' + JSON.stringify(c1));
    if (c2.trickle !== 2 || c2.wave !== 1 || c2.event !== 1 || c2.scam) throw new Error('S2 legacy ' + JSON.stringify(c2));
    if (novel.length) throw new Error('legacy emitted novelties');
    destroySandbox(sb);
    console.log(`OK fallback (no seasons.json): legacy marks ${JSON.stringify(c1)}, S2 no scam, no novelties`);
  } catch (e) { bad++; console.log('FAIL fallback: ' + e.message); }
  return bad;
}
