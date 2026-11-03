// src/systems/novelties/pickyGlimmer.js — 43C S5 novelty. At `at` (S5 0.20) and again at `at`+0.30 (day01) a `critic` Glimmer is spawned
// (cust.spawnType('critic')). The critic's price check lives in customers.js _settle (bubble kind:'price' + bus customer:priceCheck); this file
// only schedules the two spawns and lets the Owl explain the lesson ONCE on the first visible refusal ("fair price" — Bible §2: never a silent lost sale).
export const PICKY = { second: 0.30, count: 2 };
export function createPickyGlimmer() {
  const P = { id: 'pickyGlimmer', at0: 0, spawned: 0, owlSaid: 0, offs: [], sb: null };
  const bark = (sb, i, fb) => { const b = sb.storyData?.barks?.seasonNovelty?.pickyGlimmer?.[i]; const t = b ? (b.text || b) : fb; if (t) sb.game.bus.emit('story:bark', { speaker: 'owl', text: t, anchor: 'owl', ttl: b?.ttl || 3 }); };
  const spawn = (sb) => { P.spawned++; sb.cust?.spawnType?.('critic'); sb.game.bus.emit('novelty:critic', { n: P.spawned, day: sb.eco?.state?.day01 ?? 0 }); };
  P.start = (sb) => {
    P.sb = sb; P.at0 = sb.eco?.state?.day01 ?? 0; P.spawned = 0; P.owlSaid = 0;
    bark(sb, 0, 'A critic is coming. She reads prices like I read ledgers.');
    spawn(sb);
    P.offs.push(sb.game.bus.on('customer:priceCheck', (p) => { if (P.owlSaid) return; P.owlSaid = 1;
      if (p?.ok) bark(sb, 2, 'Fair price, said out loud. That is how you keep a Glimmer.'); else bark(sb, 1, 'She walked. Overpriced is a sale you never see.'); }));
  };
  P.update = (sb) => { if (P.spawned < PICKY.count && (sb.eco?.state?.day01 ?? 0) >= P.at0 + PICKY.second) spawn(sb); };
  P.end = () => {};
  P.dispose = () => { for (const f of P.offs) f?.(); P.offs.length = 0; P.sb = null; };
  return P;
}
