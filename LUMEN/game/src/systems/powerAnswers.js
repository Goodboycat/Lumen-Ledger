// T2b — every press of a power gets a visible answer (≤ 8 words, never a modal). Pure data + tiny helpers, no DOM, no three.
//   import { WHEN, deniedLine, lockedLine, words } from './powerAnswers.js';
// Game.js emits bus 'ability:answer' { name, text, kind } ('ok' | 'none' | 'cooldown' | 'busy' | 'blocked' | 'locked' | 'absorbed');
// ui/powerAnswer.js shows it as a small pill, ui/touch.js + ui/abilityChips.js emit the cooldown / locked ones themselves.
// `WHEN` = the "no target → what to do instead" line per power. data/tutor.json power cards may override it with `whenHint`.
export const SHORT = { coinMagnetDash: 'Magnet', bubbleShield: 'Shield', growthStomp: 'Stomp', ledgerFlash: 'Flash', haggleShout: 'Haggle', fogSweep: 'Sweep' };

export const WHEN = {
  coinMagnetDash: 'No coins near. Dash to a till.',
  bubbleShield: 'Shield is ready. Use at the storm warning.',
  growthStomp: 'No stalls to boost. Build one.',
  ledgerFlash: 'No deal open. Use near a stranger.',
  haggleShout: 'No customers. Wait by a stall.',
  fogSweep: 'No fog to sweep.',
};

/** why ∈ 'cooldown' | 'busy' | 'blocked' (sandbox:denied) → the line. `o.secondsLeft` (cooldown) · `o.reason` ('tray' | 'placing' | 'modal' | 'paused') for blocked. */
export function deniedLine(why, o = {}) {
  if (why === 'cooldown') return `Ready in ${Math.max(1, Math.ceil(+o.secondsLeft || 1))} s`;
  if (why === 'busy') return 'Finish the swing first';
  if (why === 'blocked') return o.reason === 'modal' ? 'Finish the talk first' : o.reason === 'paused' ? 'Game is paused' : 'Close the tray first';
  return 'Not now';
}
export const DENIED_WHYS = ['cooldown', 'busy', 'blocked'];

/** Locked chip: live ★ count. */
export function lockedLine({ stars, have } = {}) { return stars > 0 ? `Locked. Earn ★ at the Ledger (have ${have | 0}/${stars})` : 'Locked. Earn ★ at the Ledger'; }

export const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
