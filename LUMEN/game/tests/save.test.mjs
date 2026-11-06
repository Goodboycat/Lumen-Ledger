// 48E SAVE v4 — node --test tests/save.test.mjs  (run by `node tools/check.mjs --save`). Pure Node, no three.js.
// A v3 save had 4 implicit jars (balances in eco.state.jars, no build entries). v4 = jars are buildables:
//   parseSnapshot(v3) → 4 jar_* build entries at the legacy row (-8+i, 3), balances untouched, v stays 3 until re-saved
//   snapJarsToLand(build, isLand) → every jar not on land moves +1 z (≤ 6 tries) so no legacy save shows a floating jar
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, migrateJarsUnlocked, synthesizeLegacyJars, snapJarsToLand, SAVE_VERSION, SAVE_VERSIONS_OK, LEGACY_JAR_ROW, JAR_SNAP_TRIES } from '../src/systems/save.js';

const v3 = (extra = {}) => ({
  v: 3, at: 1, version: 'S48', mode: 'story', state: 'playing', seasonsToWin: 10,
  eco: JSON.stringify({ state: { season: 2, spark: 63, jars: { spend: 0, save: 40, invest: 20, protect: 10 }, debt: 0 } }),
  build: [{ id: 'stall_fruit', cx: 2, cz: 2, rot: 0, level: 1, cost: 60 }],
  story: null, helpers: [], jars: null, ...extra,
});

test('constants: SAVE_VERSION 4, v1–v4 accepted, 4-row legacy layout', () => {
  assert.equal(SAVE_VERSION, 4);
  assert.deepEqual(SAVE_VERSIONS_OK, [1, 2, 3, 4]);
  assert.deepEqual(LEGACY_JAR_ROW.map((r) => r[0]), ['jar_spend', 'jar_save', 'jar_invest', 'jar_protect']);
  assert.equal(JAR_SNAP_TRIES, 6);
});

test('v3 → parseSnapshot synthesizes 4 jar_* build entries; balances equal; stall kept', () => {
  const d = parseSnapshot(JSON.stringify(v3()));
  assert.ok(d, 'v3 parses');
  const jars = d.build.filter((e) => e.id.startsWith('jar_'));
  assert.equal(jars.length, 4);
  assert.deepEqual(jars.map((e) => [e.id, e.cx, e.cz]), [['jar_spend', -8, 3], ['jar_save', -7, 3], ['jar_invest', -6, 3], ['jar_protect', -5, 3]]);
  assert.ok(jars.every((e) => e.cost === 0 && e.level === 1 && e.legacyJar === true));
  assert.equal(d.build.filter((e) => e.id === 'stall_fruit').length, 1, 'stall entry kept');
  const eco = JSON.parse(d.eco);
  assert.deepEqual(eco.state.jars, { spend: 0, save: 40, invest: 20, protect: 10 }, 'balances untouched');
  assert.equal(d.jarsMigrated, true);
});

test('v3 with no build[] at all still gets the 4 jars', () => {
  const d = parseSnapshot(JSON.stringify(v3({ build: undefined })));
  assert.ok(d); assert.equal(d.build.filter((e) => e.id.startsWith('jar_')).length, 4);
});

test('v4 save is left alone: no synthesized jars, no duplicate when jars already present', () => {
  const own = [{ id: 'jar_save', cx: 1, cz: 1, rot: 0, level: 1, cost: 0 }];
  const d4 = parseSnapshot(JSON.stringify(v3({ v: 4, build: own })));
  assert.ok(d4); assert.equal(d4.build.length, 1); assert.equal(d4.jarsMigrated, undefined);
  // a v3 that (somehow) already carries a jar entry is not re-synthesized either
  const d3 = parseSnapshot(JSON.stringify(v3({ build: own })));
  assert.equal(d3.build.filter((e) => e.id.startsWith('jar_')).length, 1);
  assert.equal(synthesizeLegacyJars({ build: own.slice() }), 0);
});

test('snapJarsToLand: water cells move +1 z until land (≤ 6), land cells stay, non-jars untouched', () => {
  const land = new Set(['-8,5', '-7,3', '-6,9', '2,2']);                      // spend needs +2, save is fine, invest needs +6, protect never (south)
  const isLand = (x, z) => land.has(`${x},${z}`);
  const d = parseSnapshot(JSON.stringify(v3()));
  const moved = snapJarsToLand(d.build, isLand);
  const at = (id) => { const e = d.build.find((e) => e.id === id); return [e.cx, e.cz]; };
  assert.deepEqual(at('jar_spend'), [-8, 5]);
  assert.deepEqual(at('jar_save'), [-7, 3]);
  assert.deepEqual(at('jar_invest'), [-6, 9]);
  assert.deepEqual(at('stall_fruit'), [2, 2], 'stall never moves');
  assert.ok(moved >= 2);
  // protect: nothing south within 6 → tries north, then east; with nothing anywhere it stays where it was (build.load will then drop/deny it, never float a jar on purpose)
  assert.deepEqual(at('jar_protect'), [-5, 3]);
});

test('snapJarsToLand falls back north, then east; idempotent', () => {
  const north = (x, z) => x === -5 && z === 1;
  const b1 = [{ id: 'jar_protect', cx: -5, cz: 3 }];
  assert.equal(snapJarsToLand(b1, north), 1); assert.deepEqual([b1[0].cx, b1[0].cz], [-5, 1]);
  assert.equal(snapJarsToLand(b1, north), 0, 'second pass moves nothing');
  const east = (x, z) => x === -1 && z === 3;
  const b2 = [{ id: 'jar_protect', cx: -5, cz: 3 }];
  assert.equal(snapJarsToLand(b2, east), 1); assert.deepEqual([b2[0].cx, b2[0].cz], [-1, 3]);
  assert.equal(snapJarsToLand(null, east), 0); assert.equal(snapJarsToLand(b2, null), 0);
});

test('all 4 legacy jars snapped onto land when the row is half water (the real world shape: z=3 is water at x ≤ -7)', () => {
  const isLand = (x, z) => !(z === 3 && x <= -7) && z <= 4;                   // row 3 is water for x ≤ -7, row 4 is land
  const d = parseSnapshot(JSON.stringify(v3()));
  snapJarsToLand(d.build, isLand);
  for (const e of d.build.filter((e) => e.id.startsWith('jar_'))) assert.ok(isLand(e.cx, e.cz), `${e.id} on land at ${e.cx},${e.cz}`);
  assert.deepEqual(d.build.find((e) => e.id === 'jar_spend').cz, 4);
  assert.deepEqual(d.build.find((e) => e.id === 'jar_invest').cz, 3);
});

// 48F — tutorSeen (curiosity cards shown once per profile) rides in the v4 snapshot; old / bad lists degrade to [] (never a dropped slot)
test('48F tutorSeen: v3 save → [], v4 list kept, non-string list → [], garbage → [] (slot still parses)', () => {
  assert.deepEqual(parseSnapshot(JSON.stringify(v3())).tutorSeen, []);
  assert.deepEqual(parseSnapshot(JSON.stringify(v3({ v: 4, tutorSeen: ['onBuildOpen', 'verb:move'] }))).tutorSeen, ['onBuildOpen', 'verb:move']);
  assert.deepEqual(parseSnapshot(JSON.stringify(v3({ v: 4, tutorSeen: ['ok', 7] }))).tutorSeen, []);
  const d = parseSnapshot(JSON.stringify(v3({ v: 4, tutorSeen: 'nope' }))); assert.ok(d, 'still a valid slot'); assert.deepEqual(d.tutorSeen, []);
});

// ---- T1-C (FUN_PASS §4 T1.5): jarsUnlocked is an additive v4 field; legacy saves count every jar they already use as unlocked.
test('T1.5 v4 save carrying jarsUnlocked keeps exactly that list (+ spend), unknown keys dropped', () => {
  const d = parseSnapshot(JSON.stringify({ ...v3(), v: 4, jarsUnlocked: ['save', 'bogus'] }));
  assert.ok(d); assert.deepEqual(d.jarsUnlocked, ['spend', 'save']);
  assert.equal(SAVE_VERSION, 4, 'additive field: no version bump');
});
test('T1.5 legacy v3 save (4 implicit jars, season 1) → all four unlocked via the synthesized jar_* entries', () => {
  const d = parseSnapshot(JSON.stringify(v3()));
  assert.ok(d); assert.deepEqual(d.jarsUnlocked, ['spend', 'save', 'invest', 'protect']);
});
test('T1.5 v4 save WITHOUT the field: placed jars + progress + funded jars count as unlocked', () => {
  const base = { ...v3(), v: 4 };
  const mk = (build, season, jars) => { const e = JSON.parse(base.eco); e.state.season = season; e.state.jars = jars; return { ...base, build, eco: JSON.stringify(e) }; };
  const z = { spend: 0, save: 0, invest: 0, protect: 0 };
  assert.deepEqual(parseSnapshot(JSON.stringify(mk([{ id: 'stall_fruit', cx: 1, cz: 1 }], 1, z))).jarsUnlocked, ['spend'], 'fresh season-1 profile: only Spend');
  assert.deepEqual(parseSnapshot(JSON.stringify(mk([{ id: 'jar_save', cx: 1, cz: 1 }], 1, z))).jarsUnlocked, ['spend', 'save'], 'a placed Save jar counts');
  assert.deepEqual(parseSnapshot(JSON.stringify(mk([{ id: 'stall_fruit', cx: 1, cz: 1 }], 2, z))).jarsUnlocked, ['spend', 'save', 'protect'], 'season 2 → Save + Protect already earned');
  assert.deepEqual(parseSnapshot(JSON.stringify(mk([{ id: 'stall_fruit', cx: 1, cz: 1 }], 3, z))).jarsUnlocked, ['spend', 'save', 'invest', 'protect'], 'season 3 → all four');
  assert.deepEqual(parseSnapshot(JSON.stringify(mk([{ id: 'stall_fruit', cx: 1, cz: 1 }], 1, { ...z, invest: 5 }))).jarsUnlocked, ['spend', 'invest'], 'a funded jar was usable');
});
test('T1.5 migrateJarsUnlocked tolerates garbage (non-array / non-string entries) without throwing', () => {
  assert.deepEqual(migrateJarsUnlocked({ jarsUnlocked: 'save' }), ['spend']);
  assert.deepEqual(migrateJarsUnlocked({ jarsUnlocked: ['save', 3] }), ['spend']);
  assert.deepEqual(migrateJarsUnlocked(null), ['spend']);
});
