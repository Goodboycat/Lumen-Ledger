// LUMEN 43A — season scripts (data/seasons.json). Run from game/:  node --test tests/seasons.test.mjs   (no Three, no browser)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSeasonScript, LEGACY_MARKS, MARK_MIN_GAP } from '../src/systems/seasonScript.js';

const data = JSON.parse(readFileSync(new URL('../data/seasons.json', import.meta.url), 'utf8'));

test('shipped seasons.json validates', () => {
  const SS = createSeasonScript(data);
  assert.deepEqual(SS.validate(), []);
  assert.equal(SS.legacy, false); assert.equal(SS.maxSeason, 10);
});

test('S1 row equals the legacy SCHEDULER_MARKS (tutorial season unchanged)', () => {
  const r = createSeasonScript(data).for(1), L = createSeasonScript(null).for(1);
  assert.deepEqual(r.trickle, LEGACY_MARKS.trickle); assert.equal(r.wave, LEGACY_MARKS.wave(1)); assert.equal(r.len, 70);
  assert.equal(L.wave, 0.55); assert.equal(L.scam, 0.7); assert.equal(createSeasonScript(null).for(2).scam, null);
});

test('no mark kind repeats the previous season (PLAN §6) and the validator catches a repeat', () => {
  const SS = createSeasonScript(data);
  for (let s = 2; s <= 10; s++) {
    const a = SS.for(s), b = SS.for(s - 1);
    for (const k of ['warn', 'event', 'scam', 'wave']) if (a[k] != null && b[k] != null) assert.ok(Math.abs(a[k] - b[k]) >= MARK_MIN_GAP, `S${s} ${k}`);
  }
  const bad = JSON.parse(JSON.stringify(data)); bad.seasons['3'].wave = bad.seasons['2'].wave;
  assert.ok(createSeasonScript(bad).validate().some((e) => /S3: wave/.test(e)));
});

test('endless rotation S11+ cycles rows 6..10 with len 150; marks() sorted', () => {
  const SS = createSeasonScript(data);
  assert.equal(SS.for(11).key, '6'); assert.equal(SS.for(12).novelty.id, SS.for(7).novelty.id); assert.equal(SS.for(15).key, '10'); assert.equal(SS.for(16).key, '6');
  for (let s = 11; s <= 16; s++) assert.equal(SS.len(s), 150);
  const m = SS.marks(3); for (let i = 1; i < m.length; i++) assert.ok(m[i].at >= m[i - 1].at);
  assert.ok(m.some((x) => x.kind === 'novelty' && x.payload.id === 'nightMarket'));
  assert.equal(SS.marks(2).find((x) => x.kind === 'event').payload.forceEvent, 'storm');
});

// 43D: rotation S7–S10 reuses the four 43B/43C novelties, S6 is raidDouble (novelty mark BEFORE the wave mark), endless rows all len 150,
// and the consecutive-mark rule also holds across the wrap S10 → S11 (= row 6) so the endless loop never repeats a beat.
test('43D rotation: S6 raidDouble arms before the wave, S7–10 novelty table, wrap 10→11 obeys the gap rule', () => {
  const SS = createSeasonScript(data);
  assert.equal(SS.for(6).novelty.id, 'raidDouble'); assert.ok(SS.for(6).novelty.at < SS.for(6).wave, 'S6 novelty must precede the wave');
  assert.deepEqual([7, 8, 9, 10].map((s) => SS.for(s).novelty.id), ['nightMarket', 'stormWarning', 'pickyGlimmer', 'baronVisit']);
  assert.equal(SS.for(7).novelty.id, SS.for(12).novelty.id); assert.equal(SS.for(8).forceEvent, 'storm');
  for (let s = 11; s <= 15; s++) { assert.equal(SS.for(s).len, 150); assert.equal(SS.for(s).rotated, true); }
  for (const s of [4, 8, 10]) assert.equal(SS.for(s).scamKind, 'baron'); assert.equal(SS.for(11).scamKind, null);
  const a = SS.for(10), b = SS.for(11);
  const ma = { warn: a.warn, event: a.event, scam: a.scam, wave: a.wave, novelty: a.novelty?.at }, mb = { warn: b.warn, event: b.event, scam: b.scam, wave: b.wave, novelty: b.novelty?.at };
  a.trickle.forEach((v, i) => { ma['trickle' + i] = v; }); b.trickle.forEach((v, i) => { mb['trickle' + i] = v; });
  for (const k of Object.keys(ma)) if (ma[k] != null && mb[k] != null) assert.ok(Math.abs(ma[k] - mb[k]) >= MARK_MIN_GAP, `wrap S10→S11 ${k} ${ma[k]} vs ${mb[k]}`);
  const m = SS.marks(11); for (let i = 1; i < m.length; i++) assert.ok(m[i].at >= m[i - 1].at);
});
