// src/systems/novelties/index.js — 43B novelty registry. One active novelty per sandbox.
// Novelty interface: { id, start(sb, season), update(sb, dt), end(sb), dispose() }  (all optional but id)
// NOVELTIES[id] → factory() → instance.  installNovelties(sb) in Game.js: `season:novelty` → start, `eco:season` → end, destroy → dispose.
// bus: novelty:start {id, season} · novelty:end {id}.  sb.novelty = active instance or null.
import { createStormWarning } from './stormWarning.js';
import { createNightMarket } from './nightMarket.js';

export const NOVELTIES = { stormWarning: createStormWarning, nightMarket: createNightMarket };

export function createNoveltyRegistry(sb) {
  const bus = sb.game.bus; const R = { active: null };
  R.start = (id, season) => {
    const make = NOVELTIES[id]; if (!make) { sb.log?.push(`novelty ${id} unknown`); return null; }
    R.end();
    const n = make(); R.active = n; sb.novelty = n;
    try { n.start?.(sb, season); } catch (e) { sb.log?.push(`novelty ${id} start failed: ${e.message}`); }
    bus.emit('novelty:start', { id, season }); sb.log?.push(`S${season} novelty:start ${id}`);
    return n;
  };
  R.end = () => { const n = R.active; if (!n) return; R.active = null; sb.novelty = null; n.end?.(sb); n.dispose?.(); bus.emit('novelty:end', { id: n.id }); };
  R.update = (dt) => { R.active?.update?.(sb, dt); };
  R.dispose = () => { const n = R.active; R.active = null; sb.novelty = null; if (n) { n.end?.(sb); n.dispose?.(); } };
  return R;
}
