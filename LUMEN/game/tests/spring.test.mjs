// LUMEN S44 — JellySpring / setSquash stability regression. Run from game/:  node --test tests/spring.test.mjs   (no Three, no browser)
// Bug: at speed ×3 (game.timeScale 3) with maxDt 0.1 the spring was integrated with h = 0.15 s → semi-implicit Euler diverged
// (h·sqrt(k) > 2) and bodies stretched tall + wide, worst in Spark Storm (many kicks per second). Fixed by fixed sub-steps + clamps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JellySpring, setSquash } from '../src/anim/SquashStretch.js';

const fakeObj = () => ({ scale: { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } });

test('spring stays bounded at speed ×3 and 10 fps (dt 0.3 s)', () => {
  for (const [k, d] of [[220, 14], [240, 13], [260, 12]]) {
    const s = new JellySpring(k, d); s.kick(-1.1);
    let worst = 0; for (let f = 0; f < 120; f++) worst = Math.max(worst, Math.abs(s.update(0.3)));
    assert.ok(worst < 0.2, `k=${k} worst=${worst}`);
    assert.ok(s.settled, `k=${k} should settle`);
  }
});

test('spring kicked every frame (Spark Storm) never exceeds clamp', () => {
  const s = new JellySpring(260, 12); let worst = 0;
  for (let f = 0; f < 600; f++) { s.kick(-0.9); worst = Math.max(worst, Math.abs(s.update(0.05))); }
  assert.ok(worst <= 1.2, `worst=${worst}`);
});

test('spring behaviour at 60 fps ×1 is unchanged (overshoot then settle)', () => {
  const s = new JellySpring(240, 13); s.kick(-0.9);
  let minV = 0, maxV = 0; for (let f = 0; f < 240; f++) { const v = s.update(1 / 60); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
  assert.ok(minV < -0.03 && minV > -0.1, `squash ${minV}`); assert.ok(maxV > 0.005 && maxV < 0.05, `overshoot ${maxV}`); assert.ok(s.settled);
});

test('spring survives dt=0, NaN, huge dt', () => {
  const s = new JellySpring(); s.kick(-1); s.update(0); s.update(NaN); s.update(100);
  assert.ok(Number.isFinite(s.value) && Math.abs(s.value) <= 1.2);
});

test('setSquash clamps both ends and keeps volume', () => {
  const o = fakeObj();
  setSquash(o, 50); assert.equal(o.scale.y, 2.5); assert.ok(Math.abs(o.scale.x - 1 / Math.sqrt(2.5)) < 1e-9);
  setSquash(o, -3); assert.equal(o.scale.y, 0.3);
  setSquash(o, NaN); assert.equal(o.scale.y, 1); assert.equal(o.scale.x, 1);
  setSquash(o, 1.1); assert.ok(Math.abs(o.scale.y * o.scale.x * o.scale.z - 1) < 1e-9);
});
