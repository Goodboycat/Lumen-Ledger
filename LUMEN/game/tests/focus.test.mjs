import test from 'node:test'; import assert from 'node:assert/strict';
import { createFocus, FOCUS_COST, GAP_S, GAIN_CAP } from '../src/systems/focus.js';
test('starts full, spend drops it, gap blocks a second press', () => {
  const f = createFocus(); assert.equal(f.value, 100);
  assert.equal(f.spend('bubbleShield').ok, true); assert.equal(f.value, 100 - FOCUS_COST.bubbleShield);
  const c = f.check('coinMagnetDash'); assert.equal(c.ok, false); assert.equal(c.why, 'gap');
  f.tick(GAP_S + 0.01); assert.equal(f.check('coinMagnetDash').ok, true);
});
test('not enough focus says need/have and costs nothing', () => {
  const f = createFocus({ start: 10 }); const r = f.spend('fogSweep'); assert.equal(r.ok, false); assert.equal(r.why, 'focus'); assert.equal(r.need, 45); assert.equal(r.have, 10); assert.equal(f.value, 10);
});
test('regen +0.67/s (S75: 3x slower), capped at max, boon multiplier', () => {
  const f = createFocus({ start: 0 }); f.tick(30); assert.equal(Math.round(f.value), 20); f.tick(30, 1.5); assert.equal(Math.round(f.value), 50); f.tick(999); assert.equal(f.value, 100);
});
test('good habits refill, each source capped per season, newSeason resets', () => {
  const f = createFocus({ start: 0 }); let sum = 0; for (let i = 0; i < 50; i++) sum += f.gain('sale'); assert.equal(sum, GAIN_CAP.sale);
  assert.equal(f.gain('save'), 10); assert.equal(f.gain('scam'), 15); assert.equal(f.gain('nonsense'), 0);
  f.newSeason(); assert.equal(f.gain('sale'), 4);
});
test('gain never overfills; refill() restores', () => {
  const f = createFocus({ start: 98 }); assert.equal(f.gain('scam'), 2); assert.equal(f.value, 100);
  f.spend('growthStomp'); f.refill(); assert.equal(f.value, 100); assert.equal(f.check('growthStomp').ok, true);
});
test('every ability has a cost and the full bar affords at most 3 big powers', () => {
  assert.equal(Object.keys(FOCUS_COST).length, 6); const f = createFocus(); let n = 0; for (const k of ['fogSweep', 'bubbleShield', 'growthStomp', 'haggleShout']) { f.tick(1); if (f.spend(k).ok) n++; }
  assert.ok(n >= 2 && n <= 3, 'S75: regen is 3x slower, so a full bar affords 2-3 big powers in a row, never 4 (got ' + n + ')');
});
