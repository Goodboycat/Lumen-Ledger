// src/systems/novelties/index.js — 43B novelty registry. One active novelty per sandbox.
// Novelty interface: { id, start(sb, season), update(sb, dt), end(sb), dispose() }  (all optional but id)
// NOVELTIES[id] → factory() → instance.  installNovelties(sb) in Game.js: `season:novelty` → start, `eco:season` → end, destroy → dispose.
// bus: novelty:start {id, season} · novelty:end {id}.  sb.novelty = active instance or null.
import { createStormWarning } from './stormWarning.js';
import { createNightMarket } from './nightMarket.js';
import { createBaronVisit } from './baronVisit.js';   // 43C
import { createPickyGlimmer } from './pickyGlimmer.js';   // 43C
import { createRaidDouble } from './raidDouble.js';   // 43D

// 43D: short labels for the HUD "NEW: …" chip (story.js emits hud:new the first time each id starts; story.state.noveltiesSeen)
export const NOVELTY_LABELS = { stormWarning: 'Storm warning', nightMarket: 'Night market', baronVisit: 'Baron visit', pickyGlimmer: 'Picky Glimmers', raidDouble: 'Double raid' };
export const NOVELTIES = { stormWarning: createStormWarning, nightMarket: createNightMarket, baronVisit: createBaronVisit, pickyGlimmer: createPickyGlimmer, raidDouble: createRaidDouble };

export function createNoveltyRegistry(sb) {
  const bus = sb.game.bus; const R = { active: null };
  R.start = (id, season) => {
    const make = NOVELTIES[id]; if (!make) { sb.log?.push(`novelty ${id} unknown`); return null; }
    R.end();
    const n = make(); R.active = n; sb.novelty = n;
    try { n.start?.(sb, season); } catch (e) { sb.log?.push(`novelty ${id} start failed: ${e.message}`); }
    bus.emit('novelty:start', { id, season, label: NOVELTY_LABELS[id] || id }); sb.log?.push(`S${season} novelty:start ${id}`);
    return n;
  };
  R.end = () => { const n = R.active; if (!n) return; R.active = null; sb.novelty = null; n.end?.(sb); n.dispose?.(); bus.emit('novelty:end', { id: n.id }); };
  R.update = (dt) => { R.active?.update?.(sb, dt); };
  R.dispose = () => { const n = R.active; R.active = null; sb.novelty = null; if (n) { n.end?.(sb); n.dispose?.(); } };
  return R;
}
