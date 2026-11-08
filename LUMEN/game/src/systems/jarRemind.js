// LUMEN LEDGER — S59-H jar reminder. Pure JS: no Three, no DOM. One tiny timer, zero per-frame allocation.
//
//   import { createJarRemind } from './jarRemind.js';
//   const R = createJarRemind({ bus, unlocked: () => ['spend','save'], placed: () => ['spend'], season: () => 1,
//                               blocked: () => false, quiet: () => false, delay: 20, nextDelay: 3 });
//   R.update(dt)  (game clock, unpaused seconds) · R.missing() → ['save'] · R.told → how many reminders were sent · R.destroy()
//
// User ask (S59-H): "tell the player to add the other jars; if they ignore it, tell again at the next season."
//   • a jar UNLOCKS (jars:unlocked, not a silent restore)  → after `delay` s of play with it still not placed → ONE reminder
//   • the next Season starts (ui:continue {outcome:'season'}) and a jar is still missing                       → ONE more reminder after `nextDelay` s
//   • at most one reminder per season; none while a dialogue / modal / cinematic is up (`blocked`) or the verb chain is talking (`quiet`):
//     the timer simply waits and fires on the first free tick.
//   • placing every unlocked jar clears the timer; a placed jar never nags again.
// Output: bus `curious:ping {id:'jar:add', hint:'jar:add', text}` — ui/tutor.js answers it with the card `jar:add` (data/tutor.json), showing `text`
//   (names the missing jars). No hero position → the cloud hand points at the Build button / Jars tab (card `point`).
export const JAR_NAMES = { spend: 'Spend', save: 'Save', protect: 'Protect', invest: 'Invest' };
const ORDER = ['save', 'protect', 'invest'];   // S66-A: Spend is the pouch, never a jar to place

/** PURE: the one-line reminder (≤ 60 chars) naming the missing jars. `names` = jar keys, in any order. */
export function remindText(names) {
  const ks = ORDER.filter((k) => names.includes(k)); if (!ks.length) return '';
  const w = ks.map((k) => JAR_NAMES[k]);
  const list = w.length === 1 ? w[0] : w.slice(0, -1).join(', ') + ' + ' + w[w.length - 1];
  const t = `Add your ${list} jar${w.length > 1 ? 's' : ''}: Build, Jars tab.`;
  return t.length <= 60 ? t : `Add the ${w.length} new jars: Build, Jars tab.`;
}

export function createJarRemind(opts = {}) {
  const bus = opts.bus; const cfg = { delay: 20, nextDelay: 3, poll: 1, ...opts };
  const offs = []; let timer = null, told = 0, lastSeason = -1, poll = 0, destroyed = false;
  const missing = () => { let u = [], p = []; try { u = opts.unlocked?.() || []; p = opts.placed?.() || []; } catch (_) { return []; } return u.filter((k) => ORDER.includes(k) && !p.includes(k)); };
  const seasonNow = () => { try { return opts.season?.() ?? 0; } catch (_) { return 0; } };
  const arm = (s) => { if (timer == null || s < timer) timer = s; };
  const api = {
    missing, get told() { return told; }, get pending() { return timer != null; },
    update(dt) {
      if (destroyed || timer == null) return;
      timer -= Math.max(0, +dt || 0); if (timer > 0) return;
      const m = missing(); if (!m.length) { timer = null; return; }                                      // everything placed meanwhile → nothing to say
      const s = seasonNow(); if (s === lastSeason) { timer = null; return; }                              // one reminder per season
      let busy = false; try { busy = !!(opts.blocked?.() || opts.quiet?.()); } catch (_) { busy = false; }
      if (busy) { timer = cfg.poll; return; }                                                              // wait for a free moment (dialogue / chain / modal)
      lastSeason = s; told++; timer = null;
      bus?.emit?.('curious:ping', { id: 'jar:add', hint: 'jar:add', text: remindText(m), missing: m, season: s });
    },
    destroy() { destroyed = true; for (const f of offs) { try { f(); } catch (_) {} } offs.length = 0; timer = null; },
  };
  if (bus?.on) {
    offs.push(bus.on('jars:unlocked', (p) => { if (!p || p.how === 'restore' || p.how === 'start') return; arm(cfg.delay); }));
    offs.push(bus.on('ui:continue', (p) => { if (p?.outcome === 'season' && missing().length) arm(cfg.nextDelay); }));
    offs.push(bus.on('build:placed', (p) => { if (String(p?.id || '').startsWith('jar_') && !missing().length) timer = null; }));
    offs.push(bus.on('game:title', () => { timer = null; }));
  }
  return api;
}

export default createJarRemind;
