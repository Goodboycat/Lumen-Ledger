// S80-A2: expected units per visit at price=fair, by stall and customer type (pure economy, no sim).  node tools/probe_s80_demand.mjs [season=6]
import { launch, startStory } from './rig76.mjs';
const SEASON = +process.argv[2] || 6;
const { p, b } = await launch(844, 390); await startStory(p);
const r = await p.evaluate((SEASON) => {
  const E = lg.sb.eco; E.state.season = SEASON; const out = {};
  const types = Object.keys(E.config.glimmers);
  for (const k of ['fruit','bread','tea','tool','book','sparkExchange','toy','flower']) {
    const i = E.stallInfo(k); out[k] = { fair: i.fair, dem: i.demand ?? 1 };
    for (const t of types) { const g = E.config.glimmers[t]; const mood = E.mood(t); const base = i.base * E.mod('baseMulAll', 1) * E.boonGrowMul();
      const ratio = i.fair / (i.fair * g.tolerance); const q = base * Math.min(1.5, Math.max(0.1, 1.6 - ratio)) * mood; const cap = Math.floor(g.wallet / i.fair);
      out[k][t] = +Math.min(q, cap + 0.99).toFixed(2); }
  }
  return { out, rep: E.state.reputation, base: E.boonGrowMul() };
}, SEASON);
console.log('rep', r.rep, 'boonGrow', r.base);
for (const [k, v] of Object.entries(r.out)) console.log(k.padEnd(14), JSON.stringify(v));
await b.close();
