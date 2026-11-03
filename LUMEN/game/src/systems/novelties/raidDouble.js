// src/systems/novelties/raidDouble.js — 43D S6 novelty. Arms the season wave so TWO Collectors land and raid TWO DIFFERENT tills
// (enemies.js `spawnWave(season, { raiders: 2, distinct: true, stagger: 2 })`): the second raider is dazed `stagger` s on landing so the
// two 1.2 s telegraphs never overlap (Bible §2: beatable with one shield + one sword). Owl bark at start, a second bark on the first
// raid:start naming both stalls. seasons.json S6 fires the novelty @0.64, the wave @0.66 — the novelty only ARMS, the wave mark spawns.
// Save/load after the wave: `start` is re-entrant and harmless (spawnWave guards waveSeason).
export const RAID_DOUBLE = { raiders: 2, stagger: 2.0, distinct: true };
const pick = (sb, i) => { const a = sb.storyData?.barks?.seasonNovelty?.raidDouble; const b = a && a[i % a.length]; return b ? (b.text || b) : null; };
export function createRaidDouble() {
  const N = { id: 'raidDouble', offs: [], armed: false, seen: [], said2: false };
  const bark = (sb, text, ttl = 3) => text && sb.game.bus.emit('story:bark', { speaker: 'owl', text, anchor: 'owl', ttl, group: 'raidDouble' });
  N.start = (sb, season) => {
    N.seen = []; N.said2 = false;
    const E = sb.enemies;
    if (E) {
      if (E.waveSeason !== season) { E.nextWaveOpts = { ...RAID_DOUBLE }; N.armed = true; }   // wave not spawned yet this season → arm it
      else N.armed = false;                                                                 // resumed after the wave: nothing to arm
    }
    bark(sb, pick(sb, 0) || 'Two of them — shield one, chase the other.', 3.4);
    const bus = sb.game.bus;
    N.offs.push(bus.on('raid:start', (p) => {
      if (!p || N.seen.includes(p.stallId)) return; N.seen.push(p.stallId);
      if (N.seen.length === 2 && !N.said2) { N.said2 = true; bark(sb, (pick(sb, 1) || 'Both tills: {a} and {b}. Pick the richer one.').replace('{a}', E?._stallName?.(N.seen[0]) || 'one').replace('{b}', E?._stallName?.(N.seen[1]) || 'two'), 3.2); }
    }));
    N.offs.push(bus.on('raid:end', (p) => { if (p?.why === 'defeat' || p?.why === 'drop') bark(sb, pick(sb, 2) || 'One down. The other is still carrying.', 2.6); }));
    bus.emit('novelty:raidDouble', { season, armed: N.armed });
  };
  N.update = () => {};
  N.end = (sb) => { const E = sb.enemies; if (E && E.nextWaveOpts && N.armed && E.waveSeason !== sb.eco?.state?.season) E.nextWaveOpts = null; N.armed = false; };
  N.dispose = () => { for (const f of N.offs) f?.(); N.offs.length = 0; };
  return N;
}
