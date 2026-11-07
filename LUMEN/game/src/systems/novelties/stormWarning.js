// src/systems/novelties/stormWarning.js — 43B S2 novelty. At `at`: sky darkens 25 % (key/hemi), storm.warn(), Owl bark, Protect jar tag pulses.
// S2's event is forced `storm` by data/seasons.json (43A forceEvent). Follow-up bark on eco:event: absorbed → "Insurance paid off", else the repair cost.
// No modal, no new meshes. Survivable without Protect (the debt grows, and the Owl says so). Lights restored in end().
export const STORM_WARNING = { darken: 0.25, ramp: 2.0 };
const pick = (sb, key, i) => { const a = sb.storyData?.barks?.seasonNovelty?.[key]; return a && a.length ? (a[i % a.length]?.text ?? a[i % a.length]) : null; };
export function createStormWarning() {
  const N = { id: 'stormWarning', base: null, k: 0, offs: [], warned: false };
  const bark = (sb, text, ttl = 3) => text && sb.game.bus.emit('story:bark', { speaker: 'owl', text, anchor: 'owl', ttl });
  N.start = (sb, season) => {
    const L = sb.game.lights; N.base = { key: L?.key?.intensity ?? 1.6, hemi: L?.hemi?.intensity ?? 0.75 }; N.k = 0;
    if (sb.storm && !N.warned && sb.storm.phase !== 'warn' && sb.storm.phase !== 'storm') { sb.storm.warn(); N.warned = true; sb.stats && (sb.stats.stormWarn = (sb.stats.stormWarn || 0) + 1); }
    bark(sb, pick(sb, 'stormWarning', 0) || 'Clouds on the water. Fill the Protect jar.', 3.2);
    sb.jarsWorld?.highlight?.('protect', true);
    const bus = sb.game.bus;
    bus.emit('hud:chip', { id: 'storm', icon: 'stormmark', text: 'STORM COMING: fill Protect', on: true, alert: true }); N.chip = true;   // S59-I: the drawn stormmark marker
    N.offs.push(bus.on('eco:event', (p) => {
      if (p?.id !== 'storm') return; sb.jarsWorld?.highlight?.('protect', false);
      chipOff(sb);
      const abs = p.effect?.absorbed || 0;
      if (abs > 0) bark(sb, pick(sb, 'stormWarning', 1) || 'Insurance paid off.', 3);
      else { const cost = Math.abs(p.effect?.spark ?? p.effect?.debt ?? 0) | 0; bark(sb, (pick(sb, 'stormWarning', 2) || 'Repairs: {cost} ✦ on the debt.').replace('{cost}', String(cost)), 3.4); }
    }));
  };
  const chipOff = (sb) => { if (N.chip) { sb.game.bus.emit('hud:chip', { id: 'storm', on: false }); N.chip = false; } };
  N.update = (sb, dt) => {
    if (!N.base) return; N.k = Math.min(1, N.k + dt / STORM_WARNING.ramp);
    // the storm vfx owns the lights once it ramps (its own base snapshot) — only darken while the storm is still idle/warn with low intensity
    const st = sb.storm; if (st && st.intensity > 0.05) return;
    const L = sb.game.lights, d = 1 - STORM_WARNING.darken * N.k;
    if (L?.key) L.key.intensity = N.base.key * d; if (L?.hemi) L.hemi.intensity = N.base.hemi * d;
  };
  N.end = (sb) => { const L = sb.game.lights; if (N.base && sb.storm?.phase !== 'storm') { if (L?.key) L.key.intensity = N.base.key; if (L?.hemi) L.hemi.intensity = N.base.hemi; } sb.jarsWorld?.highlight?.('protect', false); chipOff(sb); };
  N.dispose = () => { for (const f of N.offs) f(); N.offs = []; N.base = null; };
  return N;
}
