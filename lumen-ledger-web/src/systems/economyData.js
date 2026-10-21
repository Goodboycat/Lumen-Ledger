// LUMEN LEDGER — Economy content & balance (Chat 4B). PURE JS, no Three, no DOM.
// Exports the FULL content maps the game uses: EVENTS (10), SCAMS (6 Too-Good Deals), UPGRADES tree, tuned BALANCE_TUNED,
// plus `makeEconomy(opts)` which returns a 4A Economy wired with all of it. The 4A maps in economy.js stay as a 4-line skeleton.
//
// Lesson ids match BALANCE.lessons (8A/8B own the long-form story text; these short lines are for toasts / the Ledger card).
// Content rules (GAME_BIBLE §2): no magic words, villains are pompous Fog Collectors, no gambling. 16+ family friendly.

import { Economy, BALANCE } from './economy.js';

// ---------------------------------------------------------------- EVENTS (≥ 8) — effect keys: spark, investPct, fog, reputation, debt, jars
// `insurable: true` → the loss goes through the Protect jar (4A applyLoss). `season` = earliest season it may fire (story pacing).
export const EVENTS = {
  storm: { id: 'storm', title: 'Spark Storm', lesson: 'insurance', season: 2, insurable: true, weight: 3,
    effect: { spark: -45, fog: +0.03 },
    text: 'A squall tears through the Glowmarket. Awning repairs: 45 Spark.',
    finlit: 'Emergencies happen on a schedule you do not control. A Protect jar turns a disaster into a receipt.' },
  festival: { id: 'festival', title: 'Glow Festival', lesson: 'budgeting', season: 1, weight: 3,
    effect: { spark: +35, reputation: +0.08 },
    text: 'Lantern boats fill the bay. Glimmers everywhere! +35 Spark in tips.',
    finlit: 'Windfalls feel like free money. Budget them like any other income: some to Save first.' },
  collectorVisit: { id: 'collectorVisit', title: 'Collector Visit', lesson: 'planningForAGoal', season: 1, weight: 3,
    effect: { spark: -25 },
    text: 'A Fog Collector struts in waving a bill. "Market fee: 25 Spark. Due now, naturally."',
    finlit: 'Known bills are not surprises. Plan for them and they lose their power to scare you.' },
  sparkDip: { id: 'sparkDip', title: 'Spark Dip', lesson: 'diversification', season: 5, weight: 2,
    effect: { investPct: -0.15 },
    text: 'The Spark Exchange wobbles. Invest jar −15 % this season.',
    finlit: 'Investments go down as well as up. Never invest the Spark you need next season.' },
  sparkBoom: { id: 'sparkBoom', title: 'Spark Boom', lesson: 'compoundGrowth', season: 4, weight: 2,
    effect: { investPct: +0.20 },
    text: 'The Spark Exchange glows bright. Invest jar +20 %!',
    finlit: 'Growth on top of growth is compounding. The earlier you start, the bigger the snowball.' },
  leakyRoof: { id: 'leakyRoof', title: 'Leaky Roof', lesson: 'emergencyFund', season: 2, insurable: true, weight: 3,
    effect: { spark: -30 },
    text: 'Drip. Drip. The cottage roof gives up. 30 Spark to patch it.',
    finlit: 'An emergency fund of 3 seasons of upkeep means a leak is annoying, not ruinous.' },
  touristBoat: { id: 'touristBoat', title: 'Tourist Boat', lesson: 'needsVsWants', season: 3, weight: 2,
    effect: { reputation: +0.05, spark: +20 },
    text: 'A boat of Tourist Glimmers docks at the pier, wallets open.',
    finlit: 'Tourists buy wants, not needs. Price wants a little higher; keep needs fair.' },
  baronTax: { id: 'baronTax', title: 'Baron\'s "Fog Levy"', lesson: 'goodVsBadInterest', season: 3, weight: 2,
    effect: (eco) => ({ spark: -Math.round(10 + eco.state.debt * 0.05), fog: eco.state.debt > 0 ? +0.04 : 0 }),
    text: 'Baron Gilt invents a levy: 10 Spark plus 5 % of what you owe him. Debt-free? He mutters and leaves.',
    finlit: 'Debt gives other people power over your plans. Every Spark of debt costs more than its number.' },
  helperDay: { id: 'helperDay', title: 'Helper Appreciation Day', lesson: 'budgeting', season: 2, weight: 1,
    effect: { spark: -15, reputation: +0.06 },
    text: 'The helpers deserve a treat. 15 Spark of honey-cakes, and the whole market hums.',
    finlit: 'Some spending is an investment in people. Plan it, do not skip it.' },
  lighthouseFlicker: { id: 'lighthouseFlicker', title: 'Lighthouse Flicker', lesson: 'delayedGratification', season: 6, weight: 2,
    effect: (eco) => (eco.state.jars.save >= eco.config.saveThreshold ? { fog: -0.06 } : { fog: +0.02 }),
    text: 'The old lighthouse flickers. With a full Save jar it catches — the fog recoils. Without, the glow fades again.',
    finlit: 'Big goals are reached by many small, boring deposits. The lighthouse is lit by patience.' },
};

// ---------------------------------------------------------------- SCAMS — 6 "Too-Good Deals", each with a tell-tale sign
// 4A acceptOffer: `cost` is lost (payout usually 0), `amount` is a loan at hidden `trueRate`. `tell` is what Ledger Flash reveals.
export const SCAMS = {
  zeroInterestLoan: { id: 'zeroInterestLoan', title: 'Zero-Interest* Loan', lesson: 'scams', amount: 150, trueRate: 0.35,
    pitch: 'Baron Gilt, beaming: "150 Spark, zero interest!* Sign here."',
    tell: 'The asterisk. *Zero for one season, then 35 % per season — compounding.',
    text: '150 Spark now at "zero" interest. The fine print says 35 %/season from Season 2.' },
  doubleSpark: { id: 'doubleSpark', title: 'Double Your Spark!', lesson: 'scams', cost: 80, payout: 0,
    pitch: 'A glittering Collector: "Hand me 80 Spark, get 160 back next season. GUARANTEED."',
    tell: '"Guaranteed" returns do not exist. Anyone who guarantees growth is selling something else.',
    text: 'Give 80 Spark, receive nothing. Ever.' },
  luckyLantern: { id: 'luckyLantern', title: 'Lucky Lantern Raffle', lesson: 'scams', cost: 40, payout: 0,
    pitch: '"Only 40 Spark a ticket! Someone has to win the golden lantern!"',
    tell: 'Urgency + a prize you cannot inspect. If you must act NOW, the deal is built for you to not think.',
    text: '40 Spark for a ticket to a raffle with no draw date.' },
  foggyInsurance: { id: 'foggyInsurance', title: 'Fog-Proof Insurance', lesson: 'insurance', cost: 60, payout: 0,
    pitch: '"Pay 60 Spark once and the fog can never touch your stalls. Trust me."',
    tell: 'No written terms, no claims process. Real insurance names exactly what it covers and how to claim.',
    text: '60 Spark for a "policy" that is one sentence long.' },
  premiumStallKit: { id: 'premiumStallKit', title: 'Premium Stall Kit', lesson: 'needsVsWants', cost: 120, payout: 0,
    pitch: '"Upgrade ALL your stalls at once with this kit. Normally 400, today only 120!"',
    tell: 'A fake "normal" price. Compare against what the Tool Smith actually charges (L2 = 90).',
    text: '120 Spark for a crate of painted sticks.' },
  quickFlip: { id: 'quickFlip', title: 'Quick-Flip Spark Notes', lesson: 'diversification', cost: 100, payout: 30,
    pitch: '"Buy these Spark Notes for 100, I personally know they flip for 300 by sunset."',
    tell: '"I personally know" is not a plan. Insider tips from strangers are the oldest Too-Good Deal.',
    text: 'Pay 100 Spark, the notes are worth 30 by sunset. −70 net.' },
};

// ---------------------------------------------------------------- UPGRADES tree — stall levels, helpers, zone unlocks
// `kind` lets BuildSystem / UI group them. `requires` = other upgrade ids (or 'season:N') that must be owned first.
export const UPGRADES = {
  // stall levels (per stall; BuildSystem passes baseMul to eco.sell)
  stallL2: { id: 'stallL2', kind: 'stall', cost: 90, requires: [], effect: { baseMul: 1.5, upkeep: +3 }, text: 'Stall level 2: +50 % units sold, +3 upkeep', lesson: 'compoundGrowth' },
  stallL3: { id: 'stallL3', kind: 'stall', cost: 180, requires: ['stallL2'], effect: { baseMul: 2.2, upkeep: +6 }, text: 'Stall level 3: +120 % units sold, +6 upkeep', lesson: 'compoundGrowth' },
  // helpers (hire cost once + upkeep per season)
  helper_tallyOwl: { id: 'helper_tallyOwl', kind: 'helper', cost: 80, upkeep: 4, requires: [], effect: { interestBonus: 0.01 }, text: 'Tally Owl: Save jar earns +1 %/season', lesson: 'goodVsBadInterest' },
  helper_packMole: { id: 'helper_packMole', kind: 'helper', cost: 70, upkeep: 4, requires: [], effect: { upkeepMul: 0.8 }, text: 'Pack Mole: stall upkeep −20 %', lesson: 'budgeting' },
  helper_sparkBee: { id: 'helper_sparkBee', kind: 'helper', cost: 90, upkeep: 5, requires: ['season:3'], effect: { baseMulAll: 1.1 }, text: 'Spark Bee: every stall sells +10 %', lesson: 'compoundGrowth' },
  helper_guardTortoise: { id: 'helper_guardTortoise', kind: 'helper', cost: 100, upkeep: 5, requires: ['season:3'], effect: { protectBonus: 0.5 }, text: 'Guard Tortoise: Protect jar absorbs 50 % more', lesson: 'insurance' },
  helper_scoutFox: { id: 'helper_scoutFox', kind: 'helper', cost: 110, upkeep: 5, requires: ['season:4'], effect: { revealScams: true }, text: 'Scout Fox: sniffs out Too-Good Deals (shows the tell)', lesson: 'scams' },
  helper_gardenerSnail: { id: 'helper_gardenerSnail', kind: 'helper', cost: 60, upkeep: 3, requires: [], effect: { reputationBonus: 0.01 }, text: 'Gardener Snail: reputation +0.01/season', lesson: 'delayedGratification' },
  // zone unlocks (Island v2: west, east, far/lighthouse)
  zone_west: { id: 'zone_west', kind: 'zone', cost: 250, requires: ['season:3'], effect: { zone: 1 }, text: 'Unlock the West Meadow (flower & tea trade)', lesson: 'planningForAGoal' },
  zone_east: { id: 'zone_east', kind: 'zone', cost: 350, requires: ['zone_west'], effect: { zone: 2 }, text: 'Unlock the East Shore (fish & pier)', lesson: 'planningForAGoal' },
  zone_far: { id: 'zone_far', kind: 'zone', cost: 500, requires: ['zone_east', 'season:7'], effect: { zone: 3 }, text: 'Unlock the Far Point — the Lighthouse', lesson: 'delayedGratification' },
};

// ---------------------------------------------------------------- BALANCE_TUNED — see docs/balance.md for the reasoning + sim tables
export const BALANCE_TUNED = {
  ...BALANCE,
  startSpark: 100,
  startDebt: 260,            // the inherited debt is the first-season antagonist (sensible clears it by S3–4)
  startFog: 0.40,
  fogPerDebtSeason: 0.07,    // each season ended in debt: +0.07 (borrow-everything hits 1.0 at S3–5, hoarder at S8–10)
  fogRelief: 0.12,           // debt-free + Save ≥ saveThreshold: −0.12 (+0.02 with a Protect jar) → fog 0 lands at S9–10, win at S10 (17/20 seeds) or S11
  saveThreshold: 200,        // ≈ 3 seasons of upkeep with 6 stalls (14 + 6×7 = 56) + one more stall
  baseUpkeep: 14,
  upkeepPerStall: 7,
  maxLoan: 500,
  stalls: {
    ...BALANCE.stalls,
    fruit:         { fair: 6,  base: 1.6, cost: 60  },
    bread:         { fair: 8,  base: 1.5, cost: 80  },
    tea:           { fair: 5,  base: 2.2, cost: 55  },
    flower:        { fair: 7,  base: 1.5, cost: 70  },
    fish:          { fair: 10, base: 1.4, cost: 95  },
    lantern:       { fair: 14, base: 0.9, cost: 120 },
    toy:           { fair: 11, base: 1.3, cost: 100 },
    pottery:       { fair: 12, base: 0.9, cost: 110 },
    book:          { fair: 13, base: 0.9, cost: 120 },
    cloth:         { fair: 15, base: 0.8, cost: 130 },
    tool:          { fair: 18, base: 0.8, cost: 150 },
    sparkExchange: { fair: 20, base: 0.7, cost: 250 },
  },
};

// ---------------------------------------------------------------- helpers
export const EVENT_IDS = Object.keys(EVENTS);
export const SCAM_IDS = Object.keys(SCAMS);
export const UPGRADE_IDS = Object.keys(UPGRADES);

/** Pick a weighted random event allowed in `season` (uses eco.rng for determinism). Returns id or null. */
export function pickEvent(eco, season = eco.state.season) {
  const pool = EVENT_IDS.filter((id) => (EVENTS[id].season || 1) <= season);
  if (!pool.length) return null;
  const total = pool.reduce((s, id) => s + (EVENTS[id].weight || 1), 0);
  let r = eco.rng() * total;
  for (const id of pool) { r -= EVENTS[id].weight || 1; if (r <= 0) return id; }
  return pool[pool.length - 1];
}

/** True when `upgradeId` can be bought now (requires satisfied, affordable, not owned). `owned` = Set/array of owned ids. */
export function canBuyUpgrade(eco, upgradeId, owned = []) {
  const u = UPGRADES[upgradeId]; if (!u) return { ok: false, why: 'unknown' };
  const has = (id) => (owned instanceof Set ? owned.has(id) : owned.includes(id));
  if (u.kind !== 'stall' && has(upgradeId)) return { ok: false, why: 'owned' };
  for (const req of u.requires || []) {
    if (req.startsWith('season:')) { if (eco.state.season < +req.slice(7)) return { ok: false, why: req }; }
    else if (!has(req)) return { ok: false, why: 'needs ' + req };
  }
  if (!eco.canAfford(u.cost)) return { ok: false, why: 'cost' };
  return { ok: true };
}

/** Factory: a 4A Economy wired with the full 4B content and tuned balance. opts → Economy opts ({ bus, seed, autoSeason }). */
export function makeEconomy(opts = {}, balance = BALANCE_TUNED) {
  return new Economy(balance, { events: EVENTS, scams: SCAMS, upgrades: UPGRADES, ...opts });
}

export default { EVENTS, SCAMS, UPGRADES, BALANCE_TUNED, makeEconomy, pickEvent, canBuyUpgrade };
