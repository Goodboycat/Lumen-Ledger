// LUMEN 4A/4B — 10-season simulation, 3 strategies. Run from game/:
//   node tests/economy.sim.mjs [seed] [--base]      (--base = 4A BALANCE + skeleton content instead of 4B tuned)
//   node tests/economy.sim.mjs --sweep              (20 seeds × 3 strategies → win/lose season histogram, for balance.md)
// Strategies:
//   sensible  — build 1 stall/season while ≥ 40 Spark buffer, sell at fair price, repay debt first, then Save 40 % / Invest 15 % / Protect 10 %,
//               refuse every scam, buy stall L2 when cash-rich.
//   borrow    — take the max loan every season, build fast, sell cheap, spend 90 % of the pouch on "wants", accept every scam.
//   hoarder   — never borrows, never saves into jars (all Spark stays loose), prices 1.3× fair. Should drift: no fog relief → slow loss.
import { Economy, BALANCE } from '../src/systems/economy.js';
import { makeEconomy, EVENTS, pickEvent, BALANCE_TUNED } from '../src/systems/economyData.js';
import { EventBus } from '../src/core/EventBus.js';

const args = process.argv.slice(2);
const useBase = args.includes('--base');
const sweep = args.includes('--sweep');
const seasons70 = args.includes('--seasons70');   // 41C: per-season income/expenses S1–S5 at the curve lengths (sensible, seeds 1–5 mean)
const seed = +(args.find((a) => !a.startsWith('--')) ?? 1);
const types = Object.keys(BALANCE.glimmers);
const pad = (v, n = 7) => String(v).padStart(n);
const REPAY_BIG = +(process.env.REPAY_BIG || 0.85);
const stallsToBuild = ['fruit', 'tea', 'bread', 'flower', 'fish', 'toy'];

let overrideBalance = null;   // set by the tuner (tools) to try candidate BALANCE values
function makeEco(s) { return useBase ? new Economy(BALANCE, { bus: new EventBus(), seed: s, autoSeason: false }) : makeEconomy({ bus: new EventBus(), seed: s, autoSeason: false }, overrideBalance || BALANCE_TUNED); }

export const STRATEGIES = {
  // build AFTER selling (the pouch is fullest then), keep a 40 Spark buffer, repay debt before saving, then jar 40/15/10 %.
  sensible(eco, season, built) {
    const build = (buffer) => { while (built < stallsToBuild.length && eco.state.spark - eco.stallCost(stallsToBuild[built]) >= buffer) { eco.buyStall(stallsToBuild[built]); built++; } };
    build(built ? 40 : 0);                               // bootstrap: the first stall is bought with whatever is in the pouch
    const visits = 18 + 5 * built;
    const baseMul = eco.state.spark > 300 && eco.buyUpgrade('stallL2') ? 1.5 : 1;
    for (let i = 0; i < visits && built; i++) { const st = stallsToBuild[i % built]; eco.sell(st, types[(i * 7 + season) % types.length], eco.stallInfo(st).fair, { baseMul }); }
    if (season % 3 === 2) { eco.offerScam(); eco.refuseOffer(); }
    const ev = useBase ? 'storm' : pickEvent(eco, season); if (ev && season % 2 === 0) eco.applyEvent(ev);
    if (eco.state.debt > 0) eco.repay(Math.floor(eco.state.spark * (eco.state.debt > 300 ? REPAY_BIG : 0.6)));   // S74: the big inherited debt (1000+) is attacked harder than a small one
    build(40);                                           // reinvest the rest of the day's takings, keep a 40 Spark buffer
    const p = eco.state.spark; eco.allocate({ save: Math.floor(p * 0.4), invest: Math.floor(p * 0.15), protect: Math.floor(p * 0.1) });
    return built;
  },
  borrow(eco, season, built) {
    eco.takeLoan(Math.min(100, eco.config.maxLoan - eco.state.debt));
    while (built < stallsToBuild.length && eco.canAfford(eco.stallCost(stallsToBuild[built]))) { eco.buyStall(stallsToBuild[built]); built++; }
    const visits = 18 + 5 * built;
    for (let i = 0; i < visits && built; i++) { const st = stallsToBuild[i % built]; eco.sell(st, types[(i * 7 + season) % types.length], Math.max(1, Math.round(eco.stallInfo(st).fair * 0.6))); }
    if (season % 2 === 1) { eco.offerScam(); eco.acceptOffer(); }
    const ev = useBase ? 'storm' : pickEvent(eco, season); if (ev && season % 2 === 0) eco.applyEvent(ev);
    eco.spend(Math.floor(eco.state.spark * 0.9), 'wants');
    return built;
  },
  // builds up to 3 stalls, overprices 1.3×, repays slowly, NEVER puts Spark in a jar → no fog relief, no good interest.
  hoarder(eco, season, built) {
    while (built < 3 && eco.state.spark - eco.stallCost(stallsToBuild[built]) >= (built ? 20 : 0)) { eco.buyStall(stallsToBuild[built]); built++; }
    const visits = 18 + 5 * built;
    for (let i = 0; i < visits && built; i++) { const st = stallsToBuild[i % built]; eco.sell(st, types[(i * 7 + season) % types.length], Math.round(eco.stallInfo(st).fair * 1.3)); }
    const ev = useBase ? 'storm' : pickEvent(eco, season); if (ev && season % 2 === 0) eco.applyEvent(ev);
    if (eco.state.debt > 0) eco.repay(Math.floor(eco.state.spark * 0.3));
    return built;
  },
};

export function run(name, s, print = true, balance = null) {
  overrideBalance = balance;
  const eco = makeEco(s); let built = 0; let fogZero = null;
  if (print) console.log(`\n== ${name} (seed ${s}, ${useBase ? '4A base BALANCE' : '4B BALANCE_TUNED'}) · start spark ${eco.state.spark} debt ${eco.state.debt} fog ${eco.state.fog01}`);
  if (print) console.log(`${'S'.padStart(2)} ${pad('income')} ${pad('expens')} ${pad('+int')} ${pad('-int')} ${pad('debt')} ${pad('save')} ${pad('invest')} ${pad('prot')} ${pad('spark')} ${pad('fog')} ${pad('stars', 5)}  events / lesson`);
  for (let season = 1; season <= 12 && !eco.state.ended; season++) {
    built = STRATEGIES[name](eco, season, built);
    eco.tick(eco.seasonSecondsFor(season));
    const r = eco.endSeason();
    if (fogZero === null && r.fog01 <= 0) fogZero = r.season;
    if (print) console.log(`${pad(r.season, 2)} ${pad(r.income)} ${pad(r.expenses)} ${pad(r.interestEarned)} ${pad(r.interestPaid)} ${pad(r.debt)} ${pad(r.jars.save)} ${pad(r.jars.invest)} ${pad(r.jars.protect)} ${pad(r.spark)} ${pad(r.fog01.toFixed(2))} ${pad('★'.repeat(r.stars) || '-', 5)}  ${r.events.join(',') || '-'} / ${r.lessonId}`);
  }
  if (print) console.log(`result: ${eco.state.ended || 'still playing'} after ${eco.history.length} seasons · fog 0 at S${fogZero ?? '—'} · net worth ${eco.netWorth()} · stalls ${eco.state.stalls} · reputation ${eco.state.reputation.toFixed(2)}`);
  return { ended: eco.state.ended, seasons: eco.history.length, netWorth: eco.netWorth(), fogZero, stalls: eco.state.stalls };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (!isMain) { /* imported by a tuner / check.mjs: export only */ }
else if (seasons70) {
  // 41C: sensible strategy, seeds 1..5; per-season mean income / expenses / interest paid / net at the season-curve lengths.
  const N = 5, acc = {}; const origLog = console.log; console.log = () => {};
  for (let sd = 1; sd <= N; sd++) {
    overrideBalance = null; const eco = makeEco(sd); let built = 0;
    for (let season = 1; season <= 5 && !eco.state.ended; season++) {
      built = STRATEGIES.sensible(eco, season, built); eco.tick(eco.seasonSecondsFor(season)); const r = eco.endSeason();
      const a = acc[season] ||= { len: eco.seasonSecondsFor(season), scale: eco.seasonCostScale(season), inc: 0, exp: 0, intp: 0, spark: 0, n: 0 };
      a.inc += r.income; a.exp += r.expenses; a.intp += r.interestPaid; a.spark += r.spark; a.n++;
    }
  }
  console.log = origLog;
  console.log(`== --seasons70 · sensible · mean of seeds 1–${N} · cost scale = len/150`);
  console.log(`${pad('S', 2)} ${pad('len', 5)} ${pad('scale', 6)} ${pad('income')} ${pad('expens')} ${pad('-int')} ${pad('net')} ${pad('spark')} ${pad('✦/s', 6)}`);
  for (const [k, a] of Object.entries(acc)) console.log(`${pad(k, 2)} ${pad(a.len, 5)} ${pad(a.scale.toFixed(2), 6)} ${pad((a.inc / a.n).toFixed(0))} ${pad((a.exp / a.n).toFixed(0))} ${pad((a.intp / a.n).toFixed(0))} ${pad(((a.inc - a.exp - a.intp) / a.n).toFixed(0))} ${pad((a.spark / a.n).toFixed(0))} ${pad((a.inc / a.n / a.len).toFixed(2), 6)}`);
} else if (sweep) {
  for (const name of Object.keys(STRATEGIES)) {
    const hist = {}, fz = {};
    for (let s = 1; s <= 20; s++) { const r = run(name, s, false); const k = `${r.ended || 'open'}@${r.ended ? r.seasons : '12+'}`; hist[k] = (hist[k] || 0) + 1; const z = 'S' + (r.fogZero ?? '—'); fz[z] = (fz[z] || 0) + 1; }
    console.log(`${name.padEnd(9)} ${Object.entries(hist).sort().map(([k, v]) => `${k}×${v}`).join('  ')}   | fog→0 at: ${Object.entries(fz).sort().map(([k, v]) => `${k}×${v}`).join(' ')}`);
  }
} else {
  for (const name of Object.keys(STRATEGIES)) run(name, seed);
}
