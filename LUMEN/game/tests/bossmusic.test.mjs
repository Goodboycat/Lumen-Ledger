// S74: boss-fight music layer (Audio.layer / stopLayer + bus wiring) and the Baron's hunt rules. Headless (no AudioContext): the layer records its intent.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const { EventBus } = await import('../src/core/EventBus.js');
const { createAudio } = await import('../src/core/Audio.js');
const { ENEMY_RULES, BARON_POWERS, baronPowersFor } = await import('../src/systems/enemies.js');
const manifest = JSON.parse(readFileSync(new URL('../audio/manifest.json', import.meta.url), 'utf8'));
const mk = async () => { const bus = new EventBus(); const a = createAudio({ bus }); await a.load(manifest); return { bus, a }; };

test('manifest has boss_fight (+ endless alt) as real files, looping layers with a bar length', () => {
  for (const id of ['boss_fight', 'boss_fight_endless']) {
    const m = manifest.music[id]; assert.ok(m, id); assert.equal(m.loop, true); assert.equal(m.layer, true); assert.ok(m.bar > 1.5 && m.bar < 3.5);
    assert.ok(existsSync(new URL('../audio/' + m.file, import.meta.url)), m.file + ' exists');
  }
  assert.equal(manifest.music.boss_fight.alt.island_endless, 'boss_fight_endless');
  // same tempo family as the main loops it rides on: 84 bpm (island_day) / 96 bpm (island_endless)
  assert.equal(manifest.music.island_day.synth.bpm, 84); assert.equal(manifest.music.island_endless.synth.bpm, 96);
  assert.ok(Math.abs(manifest.music.boss_fight.bar - 4 * 60 / 84) < 1e-3); assert.ok(Math.abs(manifest.music.boss_fight_endless.bar - 4 * 60 / 96) < 1e-3);
});
test('Baron wave starts the stem ON TOP of the island theme; a plain Collector wave does not', async () => {
  const { bus, a } = await mk(); bus.emit('game:start', {});
  assert.equal(a.state.currentMusic, 'island_day');
  bus.emit('enemy:wave', { season: 3, boss: false }); assert.equal(a.state.currentLayer, null, 'collectors only → no boss music');
  bus.emit('enemy:wave', { season: 6, boss: true }); assert.equal(a.state.currentLayer, 'boss_fight');
  assert.equal(a.state.currentMusic, 'island_day', 'the main music keeps playing under it');
  a.destroy();
});
test('the stem ends when the Baron is beaten, when he leaves, on lose and on title', async () => {
  const { bus, a } = await mk(); bus.emit('game:start', {});
  const on = () => bus.emit('enemy:wave', { season: 7, boss: true });
  on(); bus.emit('enemy:defeated', { kind: 'collector' }); assert.equal(a.state.currentLayer, 'boss_fight', 'a minion falling does not end the fight');
  bus.emit('enemy:defeated', { kind: 'baron' }); assert.equal(a.state.currentLayer, null);
  on(); bus.emit('enemy:home', { count: 1 }); assert.equal(a.state.currentLayer, null);
  on(); bus.emit('eco:lose', {}); assert.equal(a.state.currentLayer, null); assert.equal(a.state.currentMusic, 'fog_lose');
  bus.emit('game:start', {}); on(); bus.emit('game:title', {}); assert.equal(a.state.currentLayer, null);
  a.destroy();
});
test('victory / credits music never keeps a boss stem running; endless run picks the D stem', async () => {
  const { bus, a } = await mk(); bus.emit('game:start', {}); bus.emit('enemy:wave', { season: 10, boss: true });
  bus.emit('eco:win', {}); assert.equal(a.state.currentMusic, 'victory'); assert.equal(a.state.currentLayer, null);
  bus.emit('game:endless', {}); bus.emit('enemy:wave', { season: 11, boss: true }); assert.equal(a.state.currentLayer, 'boss_fight_endless');
  a.destroy();
});
test('layer() on an unknown id is false and does nothing', async () => { const { a } = await mk(); assert.equal(a.layer('nope'), false); assert.equal(a.state.currentLayer, null); a.destroy(); });

test('Baron rules: a hunter (faster than the old 1.1 plod, never faster than Pip), enrages, charge from S6', () => {
  const R = ENEMY_RULES.baron;
  assert.ok(R.speed >= 2.2 && R.speed <= ENEMY_RULES.collector.speed, 'hunt speed ' + R.speed);
  assert.ok(R.maxSpeed < 5.2, 'the hard cap (enraged + catch-up) is below Pip (5.2) so he can always be outrun'); assert.ok(R.maxSpeed >= R.speed * R.enrageMul, 'cap does not cancel the enrage');
  assert.ok(R.enrageAt >= 1 && R.enrageAt < R.hp); assert.ok(R.attackMax <= 3.2);
  assert.deepEqual(baronPowersFor(6), ['cannon', 'umbrella']); assert.equal(BARON_POWERS.find((p) => p.id === 'umbrella').season, 6);
  assert.equal(baronPowersFor(10).length, 5);
});
