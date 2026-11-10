// LUMEN LEDGER — Economy core (Chat 4A). PURE JS: no Three, no DOM. Imports only ../core/EventBus.js.
// Contract: docs/API_CONTRACTS.md §B Economy. Tested headless by tests/economy.test.mjs + tools/check.mjs --economy.
//
// Money model (all amounts are Spark, integers after rounding):
//   state.spark            = loose Spark in Pip's pouch (what customers pay goes here, what you build with comes from here)
//   state.jars.{spend,save,invest,protect}  = Spark allocated into the four FinLit jars (allocate() moves pouch ↔ jars)
//   state.debt             = Baron Gilt loan principal (compounds 20 %/season)
//   state.fog01            = Debt Fog coverage 0..1 (lose at ≥ 1, win needs ≤ 0 + lighthouse)
//   state.season / day01   = season index (1-based) / progress 0..1 through the current 150 s season
//   state.reputation       = 0..1 customer goodwill (fair prices raise it, rip-offs lower it) → mood multiplier
//
// Demand curve (per sale): sold = base × clamp(1.6 − price / fair, 0.1, 1.5) × mood.
//   price == fair → 0.6·base·mood ; price == 0.1·fair → 1.5 (clamped) ; price ≥ 1.5·fair → 0.1.
//   The result is a *probability-ish* quantity; sell() converts it to units with deterministic rounding
//   (integer part + fractional part via seeded RNG) so tests are reproducible with a seed.
//
// Season flow: tick(dt) advances day01; when day01 ≥ 1 the system auto-calls endSeason() unless config.autoSeason=false
// (the integrator will usually call endSeason() itself from the Ledger Review button).
//
// Events on bus (docs/API_CONTRACTS.md): 'eco:spark' {spark,delta,reason} · 'eco:jar' {jars,deltas} · 'eco:fog' {fog01,delta,reason}
//   'eco:season' LedgerReport · 'eco:event' {id,event,effect} · 'eco:scam' offer · 'eco:win' {season} · 'eco:lose' {season,reason}
//   plus 'eco:sale' {stallId,glimmerType,price,paid,sold,mood} and 'eco:loan' {debt,delta,kind}.

import { bus as defaultBus } from '../core/EventBus.js';

// ---------------------------------------------------------------- BALANCE (Chat 4B may override via constructor config)
export const BALANCE = {
  seasonSeconds: 150,            // fallback / test override (opts.seasonSeconds or config.seasonSeconds wins when seasonCurve is absent or seasonSecondsOverride is set)
  seasonCurve: [70, 90, 110, 130, 150],   // 41C: S1 = 70 s dense tutorial season, S2 90 … S5+ 150 (seasonSecondsFor(season))
  seasonScaleInterest: false,    // 41C: also scale debt interest by the season length (default off — hoarder would stop losing)
  seasonScaleCosts: true,        // 41C: per-season upkeep (+ interest if seasonScaleInterest) scale by seasonSecondsFor(s)/150 for S1–S4 (shorter season = less rent/interest due)
  seasonsToWin: 10,              // story run length
  startSpark: 120,               // Pip's pouch at the start
  startDebt: 200,                // the inherited Glowmarket debt (lesson 1: you cannot ignore it)
  startFog: 0.35,                // Debt Fog coverage at start (0..1)

  savingsRate: 0.05,             // GOOD interest: Save jar earns 5 %/season
  loanRate: 0.20,                // BAD interest: Baron loan costs 20 %/season, compounding
  season1RateMul: 1,             // S01/P03: multiplier on the Baron's rate in Season 1 only (BALANCE_TUNED halves it — the tutorial season should not bury a first-time kid)
  investMean: 0.08,              // Invest jar: 8 % ± 4 % per season (can be negative in bad seasons w/ events)
  investSpread: 0.04,
  maxLoan: 600,                  // Baron will not lend more than this total principal
  minLoan: 10,

  fogPerDebtSeason: 0.08,        // fog grows +0.08 each season you end with debt > 0
  fogRelief: 0.10,               // fog shrinks −0.10 each season with debt == 0 AND save ≥ saveThreshold
  fogPaydown: 0,                 // S74: fog shrinks by this when you still owe but ENDED the season with LESS debt than you started it (net paydown, after interest). 0 = off (old rule)
  fogPaydownMin: 0,              // S74: ...and the net paydown is at least this fraction of the season-start debt (0.04 = 4 %)
  saveThreshold: 150,            // "emergency fund" size that pushes the fog back
  fogLoseAt: 1.0,                // lose when fog01 reaches this
  fogWinAt: 0.0,                 // win when fog01 is at/below this at season end (after season ≥ seasonsToWin... see isWin)
  winFogMax: 0,                  // S76: the fog level a debt-free player may still carry into the win (default 0 = fog must be gone; BALANCE_TUNED raises it: clearing the Baron's debt IS the ending, the lighthouse cinematic lifts the fog)
  winRequiresSeasons: true,      // true → must also reach season ≥ seasonsToWin ; false → fog 0 is enough (Endless)

  upkeepPerStall: 6,             // Spark per stall per season (expenses)
  baseUpkeep: 10,                // fixed cost of living per season

  protectAbsorb: 1.0,            // fraction of a loss the Protect jar can absorb (1 = full, up to jar balance)
  starIncomeGood: 1.25,          // stars: income ≥ expenses×this  → +1
  starSaveMin: 20,               // stars: saved ≥ this this season → +1  (or debt went down)
  // stars: 3rd star = debt did not go up AND (fog did not grow OR you repaid >= the interest charged)  (S66-C)

  repGainFair: 0.02,             // reputation per fair sale (price ≤ 1.1·fair)
  repLossGouge: 0.05,            // reputation lost per rip-off (price ≥ 1.4·fair)
  moodMin: 0.4, moodMax: 1.3,    // mood multiplier range

  stalls: {                      // per-stall fair prices + base units per customer visit (4B tunes these)
    fruit:         { fair: 6,  base: 2,  cost: 60  },
    bread:         { fair: 8,  base: 2,  cost: 80  },
    lantern:       { fair: 14, base: 1,  cost: 120 },
    fish:          { fair: 10, base: 2,  cost: 90  },
    flower:        { fair: 7,  base: 2,  cost: 70  },
    tool:          { fair: 18, base: 1,  cost: 150 },
    cloth:         { fair: 15, base: 1,  cost: 130 },
    pottery:       { fair: 12, base: 1,  cost: 110 },
    toy:           { fair: 11, base: 2,  cost: 100 },
    tea:           { fair: 5,  base: 3,  cost: 60  },
    book:          { fair: 13, base: 1,  cost: 120 },
    sparkExchange: { fair: 20, base: 1,  cost: 250 },
  },
  glimmers: {                    // per-customer-type multipliers: priceTolerance stretches the demand curve, wallet caps the paid amount
    regular:   { tolerance: 1.0, wallet: 30,  moodBias: 0    },
    saver:     { tolerance: 0.8, wallet: 25,  moodBias: 0    },
    spender:   { tolerance: 1.4, wallet: 60,  moodBias: 0.1  },
    impulse:   { tolerance: 1.3, wallet: 40,  moodBias: 0.1  },
    haggler:   { tolerance: 0.7, wallet: 35,  moodBias: -0.1 },
    vip:       { tolerance: 1.6, wallet: 120, moodBias: 0.1  },
    kid:       { tolerance: 0.9, wallet: 10,  moodBias: 0.2  },
    elder:     { tolerance: 0.9, wallet: 30,  moodBias: 0    },
    tourist:   { tolerance: 1.3, wallet: 50,  moodBias: 0.1  },
    critic:    { tolerance: 0.9, wallet: 35,  moodBias: -0.2 },
    collector: { tolerance: 1.5, wallet: 80,  moodBias: 0    },
    newbie:    { tolerance: 1.1, wallet: 20,  moodBias: 0.1  },
  },
  lessons: [                     // lessonId per season (1-based index → lessons[season-1]); 8A/8B own the text
    'budgeting', 'needsVsWants', 'emergencyFund', 'goodVsBadInterest', 'scams',
    'compoundGrowth', 'insurance', 'diversification', 'delayedGratification', 'planningForAGoal',
  ],
};

// ---------------------------------------------------------------- content maps (skeletons; Chat 4B fills economyData.js and merges)
// effect: a function (eco, rng) → { spark?, jars?, debt?, fog?, reputation?, text } applied by applyEvent via eco._applyEffect.
export const EVENTS = {
  storm:       { id: 'storm',       title: 'Spark Storm',        lesson: 'insurance',      effect: { spark: -40, fog: +0.03 }, insurable: true,
                 text: 'A storm knocks over the awnings. Repairs cost 40 Spark — unless the Protect jar covers it.' },
  festival:    { id: 'festival',    title: 'Glow Festival',      lesson: 'budgeting',      effect: { reputation: +0.1, spark: +30 },
                 text: 'Visitors flood the Glowmarket! Sales glow for a season.' },
  taxDay:      { id: 'taxDay',      title: 'Collector Visit',    lesson: 'planningForAGoal', effect: { spark: -25 }, insurable: false,
                 text: 'A Fog Collector struts in with a bill. 25 Spark, due now.' },
  marketCrash: { id: 'marketCrash', title: 'Spark Dip',          lesson: 'diversification', effect: { investPct: -0.15 },
                 text: 'The Spark Exchange dips. Invest jar loses 15 %.' },
};
const SCAM_RECENT = 4;   // S85: how many of the latest scams pickScam() avoids
export const SCAMS = {
  tooGoodLoan: { id: 'tooGoodLoan', title: 'Zero-Interest* Loan', tell: 'the asterisk', trueRate: 0.35, amount: 150,
                 text: 'Baron Gilt offers 150 Spark at "zero" interest*. (*35 %/season after Season 1.)',
                 lesson: 'scams' },
  doubleSpark: { id: 'doubleSpark', title: 'Double Your Spark!', tell: 'guaranteed returns', cost: 80, payout: 0,
                 text: 'A shiny Collector promises to double any Spark you hand over. Guaranteed!', lesson: 'scams' },
};
export const UPGRADES = {
  stallL2: { id: 'stallL2', cost: 90,  effect: { baseMul: 1.5 }, text: 'Stall level 2: +50 % units sold' },
  stallL3: { id: 'stallL3', cost: 180, effect: { baseMul: 2.2 }, text: 'Stall level 3: +120 % units sold' },
};

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const round = (v) => Math.round(v);
// Tiny seeded RNG (mulberry32) so tests are reproducible. seed undefined → Math.random.
export function makeRng(seed) {
  if (seed === undefined || seed === null) return Math.random;
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Pure demand curve. Returns units (float) for one customer visit. Exported so 6A/7A can preview demand. */
export function demand(price, fair, base = 1, mood = 1, tolerance = 1) {
  if (!(fair > 0)) return 0;
  const ratio = price / (fair * tolerance);
  return base * clamp(1.6 - ratio, 0.1, 1.5) * mood;
}

const JARS = ['spend', 'save', 'invest', 'protect'];

// ---------------------------------------------------------------- Economy
export class Economy {
  /**
   * @param {object} config  BALANCE-shaped (partial allowed, deep-merged over BALANCE)
   * @param {object} opts    { bus, seed, autoSeason=true, events=EVENTS, scams=SCAMS, upgrades=UPGRADES }
   */
  constructor(config = BALANCE, opts = {}) {
    this.config = mergeConfig(BALANCE, config);
    this.bus = opts.bus || defaultBus;
    this.rng = makeRng(opts.seed);
    this.autoSeason = opts.autoSeason !== false;
    this.demandFn = typeof opts.demandFn === 'function' ? opts.demandFn : null;   // 44C: (kind, season) → mult; stallInfo().fair × mult (Game.js wires sb.seasons.demandFor)
    this.events = opts.events || EVENTS;
    this.scams = opts.scams || SCAMS;
    this.fairs = opts.fairs || {};          // T4: genuinely fair stranger deals (economyData FAIRS); {} in bare Economy instances
    this.fairStats = { accepted: 0, refused: 0 };
    this.upgrades = opts.upgrades || UPGRADES;
    this.pierPays = opts.pierPays === true;   // 42D: interest is collected by the Baron at the pier (held in state.interestOwed until settleInterest()); default false = old auto path
    const c = this.config;
    this.state = {
      spark: c.startSpark,
      jars: { spend: 0, save: 0, invest: 0, protect: 0 },
      debt: c.startDebt,
      interestOwed: 0,                   // 42D: interest waiting to be settled at the pier (pierPays mode only)
      fog01: c.startFog,
      season: 1,
      day01: 0,
      reputation: 0.5,
      stalls: 0,                         // count of built stalls (BuildSystem calls addStall/removeStall) → upkeep
      stallUpkeepExtra: 0,               // BUGFIX C01: extra upkeep from upgraded stalls (L2 +3, L3 +6) — set by the integrator from BuildSystem
      boons: [],                         // S67: Boon Draft picks [{id, since, left|null, lock, fx}] (fx copied in, so a save needs no lookup table)
      boonFree: 0,                       // S67: bad events still to be absorbed for free (Emergency Pouch / Overdraft Cover)
      owned: [],                         // BUGFIX C03: ids of one-time upgrades bought (helpers, zones) — saved with the state
      lighthouseLit: false,
      storyWon: false,                   // BUGFIX B19: the story victory fires ONCE; Endless never re-triggers it
      ended: null,                       // null | 'win' | 'lose'
    };
    this.ledger = this._freshLedger();   // running totals for the current season
    this.history = [];                   // LedgerReport per finished season
    this.pendingOffer = null;
  }

  _freshLedger() { return { debtStart: this.state ? this.state.debt : 0, income: 0, expenses: 0, interestEarned: 0, interestPaid: 0, saved: 0, invested: 0, protected: 0, absorbed: 0, exposed: 0, loansTaken: 0, repaid: 0, sales: 0, units: 0, events: [], scamsAccepted: 0, scamsRefused: 0, raided: 0, recovered: 0 }; }   // 42C raided/recovered

  // ------------------------------------------------ time
  /** 41C: length in seconds of `season`. config.seasonSecondsOverride (set by createSandbox opts.seasonSeconds / tests) wins, else the
   *  curve (S ≥ curve.length → last entry), else the flat config.seasonSeconds (old saves / --base). Pure. */
  seasonSecondsFor(season = this.state?.season || 1) { return seasonSecondsFor(this.config, season); }
  /** 41C: cost multiplier for per-season interest + upkeep = seasonSecondsFor(s)/150 (S1 0.47, S2 0.6, S3 0.73, S4 0.87, S5+ 1). */
  seasonCostScale(season = this.state?.season || 1) { return this.config.seasonScaleCosts === false ? 1 : Math.min(1, this.seasonSecondsFor(season) / 150); }

  /** Advance the season clock. dt in SECONDS. Auto-ends the season at day01 ≥ 1 when autoSeason. */
  tick(dt) {
    if (this.state.ended || !(dt > 0)) return;
    this.state.day01 += dt / this.seasonSecondsFor(this.state.season);
    if (this.state.day01 >= 1) {
      if (this.autoSeason) this.endSeason();
      else this.state.day01 = 1;
    }
  }

  // ------------------------------------------------ money in
  /** Mood multiplier for a customer type (reputation-driven). 0.4..1.3 */
  mood(glimmerType = 'regular') {
    const g = this.config.glimmers[glimmerType] || this.config.glimmers.regular;
    const c = this.config;
    return clamp(0.6 + this.state.reputation * 0.8 + g.moodBias, c.moodMin, c.moodMax);
  }
  /** Stall config by id: accepts 'fruit' or 'stall_fruit'. */
  stallInfo(stallId) {
    const key = String(stallId).replace(/^stall_/, '');
    const base = this.config.stalls[key] || null; if (!base) return null;
    const m = this.demandFn ? +this.demandFn(key, this.state.season) : 1;   // 44C: ONE place where season demand multiplies the fair price (mood thresholds + 43C critic rule follow)
    return m > 0 && m !== 1 ? { ...base, fair: Math.max(1, Math.round(base.fair * m)), baseFair: base.fair, demand: m } : base;
  }
  /** 44C: season demand multiplier for a stall kind ('fruit' or 'stall_fruit'); 1 when no demandFn / S1 / legacy. */
  demandOf(stallId) { const m = this.demandFn ? +this.demandFn(String(stallId).replace(/^stall_/, ''), this.state.season) : 1; return m > 0 ? m : 1; }
  /**
   * One customer visit. Returns { paid, mood, sold, fair, happy }.
   * paid is added to state.spark and ledger.income. Emits 'eco:sale' and 'eco:spark'.
   */
  sell(stallId, glimmerType = 'regular', price, opts = {}) {
    const info = this.stallInfo(stallId);
    if (!info) return { paid: 0, mood: 0, sold: 0, fair: 0, happy: false, error: 'unknown stall ' + stallId };
    const g = this.config.glimmers[glimmerType] || this.config.glimmers.regular;
    if (price === undefined || price === null) price = info.fair;
    price = Math.max(0, +price || 0);
    const mood = this.mood(glimmerType);
    // BUGFIX B10/C01: opts.level (stall level 1–3) applies the stallL2/L3 baseMul; owned helpers apply baseMulAll (Spark Bee)
    const base = info.base * (opts.baseMul || 1) * this.levelMul(opts.level) * this.mod('baseMulAll', 1) * this.boonGrowMul();
    const q = demand(price, info.fair, base, mood, g.tolerance);
    // deterministic rounding: integer part + Bernoulli on the fraction
    let sold = Math.floor(q); if (this.rng() < q - sold) sold++;
    let paid = round(sold * price);
    if (paid > g.wallet) { sold = Math.floor(g.wallet / Math.max(price, 1e-9)); paid = round(sold * price); }
    const ratio = price / info.fair;
    const happy = sold > 0 && ratio <= 1.1;
    // reputation drift
    const c = this.config;
    if (sold > 0 && ratio <= 1.1) this.state.reputation = clamp(this.state.reputation + c.repGainFair * this.mod('repGainMul', 1), 0, 1);
    else if (ratio >= 1.4 || sold === 0) this.state.reputation = clamp(this.state.reputation - c.repLossGouge * this.mod('repLossMul', 1), 0, 1);
    // 42A: opts.toTill → the money lands on the stall's counter (till.js), NOT in the pouch. The ledger still counts the sale
    //   (sales/units/income) — the ledger reports sales, the pouch reports cash; that difference IS the lesson. Pouch += only on T.collect.
    const toTill = !!opts.toTill;
    if (paid > 0) { if (!toTill) this._addSpark(paid, 'sale'); this.ledger.income += paid; }
    this.ledger.sales++; this.ledger.units += sold;
    const out = { paid, amount: paid, mood: +mood.toFixed(3), sold, fair: info.fair, happy, stallId, glimmerType, price, toTill, ok: sold > 0 };
    this.bus.emit('eco:sale', out);
    return out;
  }

  // ------------------------------------------------ money out
  canAfford(cost) { return cost <= this.state.spark + 1e-9; }
  /** Spend from the pouch. Returns true on success; false (and 'eco:denied') when unaffordable. */
  spend(cost, reason = 'spend') {
    cost = Math.max(0, round(+cost || 0));
    if (!this.canAfford(cost)) { this.bus.emit('eco:denied', { cost, reason, spark: this.state.spark }); return false; }
    this._addSpark(-cost, reason);
    this.ledger.expenses += cost;
    return true;
  }
  /** Earn into the pouch (quests, helpers, VFX coin pickups). */
  earn(amount, reason = 'earn') { amount = round(+amount || 0); if (amount <= 0) return; this._addSpark(amount, reason); this.ledger.income += amount; }
  _addSpark(delta, reason) {
    this.state.spark = round(this.state.spark + delta);
    this.bus.emit('eco:spark', { spark: this.state.spark, delta, reason });
  }
  addStall(n = 1) { this.state.stalls = Math.max(0, this.state.stalls + n); }
  removeStall(n = 1) { this.addStall(-n); }
  stallCost(stallId) { const i = this.stallInfo(stallId); return i ? Math.max(1, Math.round(i.cost * this.mod('stallCostMul', 1))) : Infinity; }   // S67: Cheap Credit / Careful Saver change the price
  /** Convenience for BuildSystem: pay for a stall and count it. */
  buyStall(stallId) { const cost = this.stallCost(stallId); if (!this.spend(cost, 'build:' + stallId)) return false; this.addStall(1); return true; }

  /** Sales multiplier for a stall level (1 → 1, 2 → stallL2.baseMul, 3 → stallL3.baseMul). */
  levelMul(level = 1) {
    const lv = Math.round(+level || 1); if (lv <= 1) return 1;
    const u = this.upgrades[lv === 2 ? 'stallL2' : 'stallL3'];
    return (u && u.effect && u.effect.baseMul) || 1;
  }
  /** Extra upkeep per season for one stall at `level` (stallL2/L3 effect.upkeep). */
  levelUpkeep(level = 1) {
    const lv = Math.round(+level || 1); if (lv <= 1) return 0;
    const u = this.upgrades[lv === 2 ? 'stallL2' : 'stallL3'];
    return (u && u.effect && +u.effect.upkeep) || 0;
  }
  // ------------------------------------------------ owned one-time upgrades (helpers / zones) — BUGFIX C01/C03
  owns(id) { return (this.state.owned || []).includes(id); }
  /** Combined modifier `key` over every owned upgrade's effect (multiplicative for *Mul keys, additive otherwise). */
  mod(key, dflt = 0) {
    const mul = /Mul/.test(key); let v = dflt;
    for (const id of this.state.owned || []) {
      const e = this.upgrades[id] && this.upgrades[id].effect; if (!e || e[key] === undefined) continue;
      if (typeof e[key] === 'boolean') { if (e[key]) v = true; continue; }
      v = mul ? v * e[key] : v + e[key];
    }
    for (const b of this.state.boons || []) {   // S67: Boon Draft effects use the same keys (*Mul multiply, the rest add)
      const e = b && b.fx; if (!e || e[key] === undefined) continue;
      if (typeof e[key] === 'boolean') { if (e[key]) v = true; continue; }
      v = mul ? v * e[key] : v + e[key];
    }
    return v;
  }
  /** S67: Snowball-style growth: every boon with `grow` adds that fraction per season it has stood (1 + grow·(age+1)). */
  boonGrowMul() { let m = 1; const now = this.state.season; for (const b of this.state.boons || []) if (b && b.grow) m *= 1 + b.grow * (Math.max(0, now - (b.since ?? now)) + 1); return m; }
  /** S67: true while a locking boon (Index Fund) keeps the Invest jar closed. */
  investLocked() { const now = this.state.season; return (this.state.boons || []).some((b) => b && b.fx && b.fx.lockInvest && now - (b.since ?? now) < (b.lock || 0)); }
  /** S67: seasons left on the lock (0 = open). */
  investLockLeft() { const now = this.state.season; let n = 0; for (const b of this.state.boons || []) if (b && b.fx && b.fx.lockInvest) n = Math.max(n, (b.lock || 0) - (now - (b.since ?? now))); return Math.max(0, n); }
  /** Seasonal wages of owned helpers. */
  helperWages() { let n = 0; for (const id of this.state.owned || []) { const u = this.upgrades[id]; if (u && u.kind === 'helper') n += +u.upkeep || 0; } return n; }
  /** Why an upgrade cannot be bought right now (null = it can). Stall levels are repeatable (bought per stall by BuildSystem). */
  upgradeBlocker(upgradeId) {
    const u = this.upgrades[upgradeId]; if (!u) return 'unknown';
    if (u.kind && u.kind !== 'stall' && this.owns(upgradeId)) return 'owned';
    for (const req of u.requires || []) {
      if (String(req).startsWith('season:')) { if (this.state.season < +String(req).slice(7)) return 'from season ' + String(req).slice(7); }
      else if (u.kind !== 'stall' && !this.owns(req)) return 'needs ' + req;
    }
    if (!this.canAfford(u.cost)) return 'cost';
    return null;
  }

  // ------------------------------------------------ jars
  /**
   * Move Spark between the pouch and the jars. jarDeltas = { save: +50, spend: -10, ... } (positive = pouch → jar).
   * Validation: unknown jar / NaN → false; a jar cannot go negative; the pouch cannot go negative (net of all deltas).
   * Returns true when applied; emits 'eco:jar'.
   */
  allocate(jarDeltas = {}) {
    const deltas = {};
    let net = 0;
    for (const [k, v] of Object.entries(jarDeltas)) {
      if (!JARS.includes(k)) { this.bus.emit('eco:denied', { reason: 'unknown jar ' + k }); return false; }
      const d = round(+v || 0); if (!isFinite(d)) { this.bus.emit('eco:denied', { reason: 'bad amount ' + k }); return false; }
      if (d === 0) continue;
      if (k === 'invest' && d < 0 && this.investLocked()) { this.bus.emit('eco:denied', { reason: 'locked', jar: 'invest', seasonsLeft: this.investLockLeft() }); return false; }   // S67: Index Fund
      if (this.state.jars[k] + d < 0) { this.bus.emit('eco:denied', { reason: 'jar ' + k + ' would go negative' }); return false; }
      deltas[k] = d; net += d;
    }
    if (net > this.state.spark) { this.bus.emit('eco:denied', { reason: 'not enough Spark', cost: net, spark: this.state.spark }); return false; }
    for (const [k, d] of Object.entries(deltas)) {
      this.state.jars[k] += d;
      if (k === 'save' && d > 0) this.ledger.saved += d;
      if (k === 'invest' && d > 0) this.ledger.invested += d;
      if (k === 'protect' && d > 0) this.ledger.protected += d;
    }
    if (net !== 0) this._addSpark(-net, 'allocate');
    this.bus.emit('eco:jar', { jars: { ...this.state.jars }, deltas });
    return true;
  }
  /**
   * BUGFIX B11: take Spark OUT of a jar back into the pouch (the player-facing "withdraw"). Capped by the jar balance.
   * Returns the amount moved (0 = nothing). Emits eco:jar + eco:spark (via allocate).
   */
  withdraw(jar, amount) {
    if (!JARS.includes(jar)) { this.bus.emit('eco:denied', { reason: 'unknown jar ' + jar }); return 0; }
    const a = Math.min(round(+amount || 0), this.state.jars[jar]);
    if (!(a > 0)) { this.bus.emit('eco:denied', { reason: 'jar ' + jar + ' is empty' }); return 0; }
    return this.allocate({ [jar]: -a }) ? a : 0;
  }
  /** Sum of pouch + all jars − debt. */
  netWorth() { const j = this.state.jars; return this.state.spark + j.spend + j.save + j.invest + j.protect - this.state.debt; }

  // ------------------------------------------------ loans (BAD interest)
  /** 42D: pure — the loan interest the Baron is owed at the end of `season` (same rule the auto path used: loanRate or the hidden scam rate,
   *  S01 gentler S1, optional 41C season scaling). 0 when debt-free. */
  interestDue(season = this.state.season) {
    const c = this.config, s = this.state;
    const rate = Math.max(0, (s.scamRate ? Math.max(c.loanRate, s.scamRate) : c.loanRate) + this.mod('loanRateAdd', 0)) * (season === 1 ? (c.season1RateMul ?? 1) : 1) * (c.seasonScaleInterest ? this.seasonCostScale(season) : 1);
    return round(Math.max(0, s.debt) * rate);
  }
  /** 42D (pierPays mode): pay `state.interestOwed` from the pouch; what the pouch cannot cover is added to the debt (the Baron says so aloud).
   *  Emits eco:interest {owed, paid, shortfall, debt}. Returns { paid, shortfall }. No-op when nothing is owed. */
  settleInterest() {
    const s = this.state, owed = round(s.interestOwed || 0);
    if (owed <= 0) { s.interestOwed = 0; return { paid: 0, shortfall: 0 }; }
    const paid = round(Math.min(owed, Math.max(0, s.spark))), shortfall = owed - paid;
    if (paid > 0) this._addSpark(-paid, 'interest');
    if (shortfall > 0) s.debt += shortfall;
    s.interestOwed = 0;
    const pr = this._pierReport(); if (pr) { pr.pier.paid += paid; pr.pier.shortfall += shortfall; }   // S70: closePier() re-scores the stars with this
    this.bus.emit('eco:interest', { owed, paid, shortfall, debt: s.debt });
    if (shortfall > 0) this.bus.emit('eco:loan', { debt: s.debt, delta: shortfall, kind: 'interest' });
    return { paid, shortfall };
  }
  takeLoan(amount) {
    const c = this.config; amount = round(+amount || 0);
    if (this.state.ended || amount < c.minLoan || this.state.debt + amount > c.maxLoan) { this.bus.emit('eco:denied', { reason: 'loan refused', amount, debt: this.state.debt }); return false; }
    this.state.debt += amount; this.ledger.loansTaken += amount;
    this._addSpark(amount, 'loan');
    this.bus.emit('eco:loan', { debt: this.state.debt, delta: amount, kind: 'take' });
    return true;
  }
  repay(amount) {
    amount = round(Math.min(+amount || 0, this.state.debt, this.state.spark));
    if (this.state.ended === 'lose' || amount <= 0) { this.bus.emit('eco:denied', { reason: this.state.debt <= 0 ? 'no debt to repay' : 'nothing to repay with', cost: 0, spark: this.state.spark }); return 0; }
    this.state.debt -= amount;
    const pr = this._pierReport(); if (pr) { pr.repaid += amount; pr.pier.repaid += amount; } else this.ledger.repaid += amount;   // S70 fix: repaid AT THE PIER counts for the season that just closed (it used to land in the next season's ledger)
    // BUGFIX C04: the scam's hidden rate died with the scam debt. Without this a later HONEST loan still compounded at trueRate.
    if (this.state.debt <= 0) { this.state.debt = 0; this.state.scamRate = 0; }
    this._addSpark(-amount, 'repay');
    this.bus.emit('eco:loan', { debt: this.state.debt, delta: -amount, kind: 'repay' });
    return amount;
  }

  // ------------------------------------------------ losses → Protect jar absorbs
  /**
   * Apply a loss of `amount` Spark. Protect jar absorbs up to protectAbsorb × amount (capped by its balance),
   * the rest comes from the pouch, then the Spend jar, then becomes debt. Returns { absorbed, paid, debt }.
   */
  applyLoss(amount, reason = 'loss', { useProtect = true } = {}) {
    amount = round(Math.max(0, +amount || 0)); if (!amount) return { absorbed: 0, paid: 0, debt: 0 };
    const j = this.state.jars;
    // BUGFIX C01: Guard Tortoise (protectBonus) lets the Protect jar absorb more of a shock (still capped by the loss and the balance)
    const absorbed = useProtect ? Math.min(j.protect, amount, round(amount * this.config.protectAbsorb * (1 + this.mod('protectBonus', 0)))) : 0;
    j.protect -= absorbed; this.ledger.absorbed += absorbed;
    let rest = amount - absorbed;
    const fromPouch = Math.min(rest, Math.max(0, this.state.spark)); if (fromPouch) this._addSpark(-fromPouch, reason); rest -= fromPouch;
    const fromSpend = Math.min(rest, j.spend); j.spend -= fromSpend; rest -= fromSpend;
    if (rest > 0) { this.state.debt += rest; this.bus.emit('eco:loan', { debt: this.state.debt, delta: rest, kind: 'forced' }); }
    this.ledger.expenses += amount - absorbed;
    if (absorbed || fromSpend) this.bus.emit('eco:jar', { jars: { ...j }, deltas: { protect: -absorbed, spend: -fromSpend } });
    return { absorbed, paid: fromPouch + fromSpend, debt: rest };
  }

  // ------------------------------------------------ events & scams (P3 skeleton — 4B fills content)
  _applyEffect(effect = {}, reason = 'event') {
    const r = { spark: 0, absorbed: 0, debt: 0, fog: 0, reputation: 0, investPct: 0, exposed: 0 };
    if (effect.spark < 0) {
      const o = this.applyLoss(-effect.spark, reason); r.spark = -(o.paid); r.absorbed = o.absorbed; r.debt = o.debt;
      // S15: "exposure" — the share of the damage Protect did NOT cover also scatters Save/Invest by exposeJars × uncovered/damage.
      //   Full Protect ⇒ 0 lost from the jars; empty Protect ⇒ the full exposeJars fraction. Spend/Protect semantics unchanged.
      if (effect.exposeJars > 0) {
        const damage = -effect.spark, uncovered01 = Math.max(0, Math.min(1, (damage - o.absorbed) / damage));
        const pct = effect.exposeJars * uncovered01, j = this.state.jars, deltas = {};
        for (const k of ['save', 'invest']) { const d = round(j[k] * pct); if (d > 0) { j[k] -= d; deltas[k] = -d; r.exposed += d; } }
        if (r.exposed) { this.ledger.exposed = (this.ledger.exposed || 0) + r.exposed; this.ledger.expenses += r.exposed; this.bus.emit('eco:jar', { jars: { ...j }, deltas, reason: 'exposed' }); }
      }
    }
    else if (effect.spark > 0) { this.earn(effect.spark, reason); r.spark = effect.spark; }
    if (effect.investPct) { const d = round(this.state.jars.invest * effect.investPct); this.state.jars.invest += d; r.investPct = effect.investPct; r.investDelta = d; this.bus.emit('eco:jar', { jars: { ...this.state.jars }, deltas: { invest: d } }); }
    if (effect.fog) { this._setFog(this.state.fog01 + effect.fog, reason); r.fog = effect.fog; }
    if (effect.reputation) { this.state.reputation = clamp(this.state.reputation + effect.reputation, 0, 1); r.reputation = effect.reputation; }
    if (effect.debt) {
      const before = this.state.debt; this.state.debt = Math.max(0, before + round(effect.debt)); r.debt += effect.debt;
      if (this.state.debt <= 0) this.state.scamRate = 0;                                                         // BUGFIX C04 (see repay)
      // BUGFIX C05: event debt changes never told the UI → jars panel debt row / PAY button stayed stale until the season closed
      if (this.state.debt !== before) this.bus.emit('eco:loan', { debt: this.state.debt, delta: this.state.debt - before, kind: effect.debt > 0 ? 'forced' : 'repay' });
    }
    for (const k of JARS) if (effect.jars && effect.jars[k]) { this.state.jars[k] = Math.max(0, this.state.jars[k] + round(effect.jars[k])); }
    return r;
  }
  /** Fire a world event by id (from this.events). Returns the applied result or null. */
  applyEvent(eventId) {
    const ev = this.events[eventId]; if (!ev || this.state.ended) return null;
    const effect = typeof ev.effect === 'function' ? ev.effect(this, this.rng) : ev.effect;
    if ((this.state.boonFree || 0) > 0 && effect && effect.spark < 0) {   // S67: a boon pays for this bad event (the price was paid when you picked it)
      this.state.boonFree--; this.ledger.events.push(eventId);
      const out = { id: eventId, event: ev, effect: { spark: 0, absorbed: 0, debt: 0, fog: 0, reputation: 0, investPct: 0, exposed: 0 }, boon: true };
      this.bus.emit('eco:absorbed', { id: eventId, event: ev, boon: true }); this.bus.emit('eco:event', out);
      return out;
    }
    const result = this._applyEffect(effect, 'event:' + eventId);
    this.ledger.events.push(eventId);
    const out = { id: eventId, event: ev, effect: result };
    this.bus.emit('eco:event', out);
    return out;
  }
  /** S85 (user: \"the scams repeat too often\"): the NEXT scam id. Season-aware (`minSeason` <= season), never one of the last SCAM_RECENT offered while another
   *  choice exists, and unmet deals come first. opts: { baron: true } -> only deals flagged `baron` (the Baron's own visit) · { exclude: [ids] }. Uses this.rng (seeded). */
  pickScam({ baron = false, exclude = [] } = {}) {
    const all = Object.keys(this.scams); if (!all.length) return null;
    const s = this.state, floor = Math.min(...all.map((id) => this.scams[id].minSeason || 1)), season = Math.max(s.season || 1, floor);   // floor: a season earlier than the easiest deal still gets the EASIEST deals, never the hardest ones
    let ids = all.filter((id) => (this.scams[id].minSeason || 1) <= season && !exclude.includes(id));
    if (baron) { const b = ids.filter((id) => this.scams[id].baron); if (b.length) ids = b; }
    if (!ids.length) ids = all.filter((id) => !exclude.includes(id));
    if (!ids.length) ids = all;
    const recent = s.recentScams || [], n = Math.min(SCAM_RECENT, ids.length - 1);
    let pool = ids.filter((id) => !recent.slice(-Math.max(0, n)).includes(id)); if (!pool.length) pool = ids;
    const met = s.scamsMet || [], fresh = pool.filter((id) => !met.includes(id)); if (fresh.length) pool = fresh;
    return pool[Math.floor(this.rng() * pool.length)];
  }
  /** S85: remember a scam that was put in front of the player (a stranger walking in counts too: skipping it does not make it come back next). */
  noteScam(id) {
    if (!id) return; const s = this.state; s.recentScams = s.recentScams || []; s.scamsMet = s.scamsMet || [];
    if (s.recentScams[s.recentScams.length - 1] !== id) { s.recentScams.push(id); if (s.recentScams.length > 12) s.recentScams.shift(); }
    if (!s.scamsMet.includes(id)) s.scamsMet.push(id);
  }
  /** Pick a random "Too-Good Deal" (or by id). Returns the offer object (also stored in pendingOffer) and emits 'eco:scam'. */
  offerScam(id, { by = null } = {}) {
    const ids = Object.keys(this.scams); if (!ids.length) return null;
    const scam = this.scams[id] || this.scams[this.pickScam()];
    this.noteScam(scam.id);
    const offer = { ...scam, offeredAt: this.state.season, isScam: true, by };
    this.pendingOffer = offer;
    this.bus.emit('eco:scam', offer);
    return offer;
  }
  /** T4: a genuinely fair stranger deal (this.fairs). Emits 'eco:fair' (NOT 'eco:scam' — no scam counters, no scam audio). Same pendingOffer slot as a scam. */
  offerFair(id, { by = 'stranger' } = {}) {
    const ids = Object.keys(this.fairs || {}); if (!ids.length) return null;
    const fair = this.fairs[id] || this.fairs[ids[Math.floor(this.rng() * ids.length)]];
    const offer = { ...fair, offeredAt: this.state.season, isFair: true, by };
    this.pendingOffer = offer;
    this.bus.emit('eco:fair', offer);
    return offer;
  }
  _acceptFair(offer) {
    let lostSpark = 0;
    if (offer.cost) { const paid = Math.min(this.state.spark, round(offer.cost)); if (paid) this._addSpark(-paid, 'fair:' + offer.id); this.ledger.expenses += paid; lostSpark = paid; }
    if (offer.payout) this.earn(offer.payout, 'fair:payout');
    this.fairStats.accepted++; this.pendingOffer = null;
    const out = { accepted: true, fair: true, id: offer.id, lostSpark, gained: round(offer.payout || 0), net: round((offer.payout || 0) - lostSpark), terms: offer.terms };
    this.bus.emit('eco:fairResult', out); return out;
  }
  _refuseFair(offer) { this.fairStats.refused++; this.pendingOffer = null; const out = { accepted: false, refused: true, fair: true, id: offer.id, terms: offer.terms }; this.bus.emit('eco:fairResult', out); return out; }
  /**
   * Accept an offer. Scams hurt: `cost` is lost (Protect does NOT cover scams — lesson), `amount` loans come in at `trueRate`
   * (stored as debt + scamRate for the next endSeason). Returns { accepted:true, lostSpark, debtAdded } .
   */
  acceptOffer(offer = this.pendingOffer) {
    if (!offer) return { accepted: false };
    if (offer.isFair) return this._acceptFair(offer);
    let lostSpark = 0, debtAdded = 0;
    if (offer.cost) { const paid = Math.min(this.state.spark, round(offer.cost)); if (paid) this._addSpark(-paid, 'scam:' + offer.id); this.ledger.expenses += paid; lostSpark = paid; if (offer.payout) this.earn(offer.payout, 'scam:payout'); }
    if (offer.amount) { this.state.debt += round(offer.amount); debtAdded = round(offer.amount); this._addSpark(offer.amount, 'scam:loan'); this.state.scamRate = Math.max(this.state.scamRate || 0, offer.trueRate || this.config.loanRate); this.bus.emit('eco:loan', { debt: this.state.debt, delta: debtAdded, kind: 'scam' }); }
    if (offer.recurring && offer.recurring.amount > 0) { const sub = { id: offer.id, amount: round(offer.recurring.amount), left: Math.max(1, offer.recurring.seasons | 0) }; this.state.subs = [...(this.state.subs || []), sub]; }   // S85: the "free" trial renews by itself (freeTrial)
    this.ledger.scamsAccepted++;
    this.state.reputation = clamp(this.state.reputation - 0.05, 0, 1);
    this.pendingOffer = null;
    const out = { accepted: true, id: offer.id, lostSpark, debtAdded, recurring: offer.recurring || null, lesson: offer.lesson || 'scams', tell: offer.tell };
    this.bus.emit('eco:scamResult', out);
    return out;
  }
  /** Refuse the pending offer (Ledger Flash / player taps "No thanks") → small reputation + fog relief. */
  refuseOffer(offer = this.pendingOffer) {
    if (!offer) return { accepted: false };
    if (offer.isFair) return this._refuseFair(offer);
    this.ledger.scamsRefused++;
    this._setFog(this.state.fog01 - 0.02, 'scam refused');
    this.pendingOffer = null;
    const out = { accepted: false, refused: true, id: offer.id, tell: offer.tell };
    this.bus.emit('eco:scamResult', out);
    return out;
  }
  /**
   * Buy an upgrade by id from this.upgrades. Returns the upgrade or null.
   * BUGFIX C03: prerequisites (other upgrades / season gates) and one-time ownership are enforced HERE, before any Spark moves;
   * a refusal emits eco:denied {why} and costs nothing. One-time upgrades (helpers, zones) are recorded in state.owned.
   */
  buyUpgrade(upgradeId) {
    const u = this.upgrades[upgradeId]; if (!u) return null;
    const why = this.upgradeBlocker(upgradeId);
    if (why && why !== 'cost') { this.bus.emit('eco:denied', { reason: why, why, id: upgradeId, cost: u.cost, spark: this.state.spark }); return null; }
    if (!this.spend(u.cost, 'upgrade:' + upgradeId)) return null;
    if (u.kind && u.kind !== 'stall') this.state.owned = [...(this.state.owned || []), upgradeId];
    this.bus.emit('eco:upgrade', { id: upgradeId, upgrade: u });
    return u;
  }
  /** Grant an upgrade without paying (save restore). Idempotent. */
  grantUpgrade(upgradeId) { const u = this.upgrades[upgradeId]; if (!u || this.owns(upgradeId)) return null; if (u.kind && u.kind !== 'stall') this.state.owned = [...(this.state.owned || []), upgradeId]; return u; }

  // ------------------------------------------------ fog
  _setFog(v, reason) {
    const prev = this.state.fog01; this.state.fog01 = clamp(+v.toFixed(4), 0, 1);
    if (this.state.fog01 !== prev) this.bus.emit('eco:fog', { fog01: this.state.fog01, delta: +(this.state.fog01 - prev).toFixed(4), reason });
  }
  /** External fog push (Fog Sweep ability, lighthouse). strength 0..1 → −strength×0.05 fog. */
  pushFog(strength = 1) { this._setFog(this.state.fog01 - 0.05 * strength, 'push'); }

  // ------------------------------------------------ season end → LedgerReport
  /**
   * Close the season: interest on Save (+5 %), Invest (8 % ± 4 %), loan (+20 % compounding), upkeep, fog rules,
   * stars 0..3, lessonId. Pushes to history, emits 'eco:season', then checks win/lose. Returns the LedgerReport.
   */
  endSeason() {
    if (this.state.ended) return this.history[this.history.length - 1] || null;
    this.closePier('next');   // S70: a pier report left open (no pier system / skipped) is closed before the next one is written
    const c = this.config, s = this.state, L = this.ledger;
    const season = s.season;
    const debtBefore = s.debt, fogBefore = s.fog01;
    // GOOD interest
    const interestEarned = round(s.jars.save * (c.savingsRate + this.mod('interestBonus', 0)));   // + Tally Owl
    s.jars.save += interestEarned;
    // Invest: 8 % ± 4 %
    const investRate = c.investMean + this.mod('investBonus', 0) + (this.rng() * 2 - 1) * c.investSpread * this.mod('investSpreadMul', 1);   // S67: Index Fund / Bold Bet
    const investReturn = round(s.jars.invest * investRate);
    s.jars.invest += investReturn;
    // BAD interest, compounding (scam loans use the hidden higher rate)
    const kS = this.seasonCostScale(season);   // 41C: shorter season → proportionally less interest + upkeep due (balance.md "Season curve")
    const interestPaid = this.interestDue(season);
    if (this.pierPays) s.interestOwed = interestPaid;   // 42D: the Baron collects it at the pier (settleInterest) — pouch first, shortfall → debt
    else s.debt += interestPaid;                        // old auto path (headless tests, no-pier mode): compounds silently
    // upkeep (routine cost: pouch → Spend jar → forced debt; the Protect jar is for shocks, NOT rent)
    // BUGFIX C01: upgraded stalls cost their promised extra upkeep, Pack Mole cuts STALL upkeep −20 %, helpers are paid wages
    const stallUpkeep = round((c.upkeepPerStall * s.stalls + (s.stallUpkeepExtra || 0) + this.mod('stallUpkeepAdd', 0) * s.stalls) * this.mod('upkeepMul', 1));   // S67: stallUpkeepAdd (Snowball)
    const wages = this.helperWages();
    const upkeep = round((c.baseUpkeep + stallUpkeep + wages) * kS);   // 41C: scaled by the season length
    const repBonus = this.mod('reputationBonus', 0); if (repBonus) s.reputation = clamp(s.reputation + repBonus, 0, 1);   // Gardener Snail
    const upkeepRes = this.applyLoss(upkeep, 'upkeep', { useProtect: false });
    let subCost = 0;   // S85: auto-renewing "free trial" fees (freeTrial) — routine cost like upkeep, Protect does not cover it, counts as an expense for the stars
    if (s.subs && s.subs.length) { for (const x of s.subs) { subCost += x.amount; x.left--; } s.subs = s.subs.filter((x) => x.left > 0); if (subCost > 0) { this.applyLoss(subCost, 'subscription', { useProtect: false }); this.bus.emit('eco:subscription', { amount: subCost, season, left: s.subs.length }); } }
    // fog rules
    let fogDelta = 0;
    const _ds = L.debtStart ?? (debtBefore + L.repaid - L.loansTaken);   // S74: debt when the season began
    const paydownOk = (c.fogPaydown || 0) > 0 && s.debt > 0 && _ds > 0 && (_ds - s.debt) >= _ds * (c.fogPaydownMin || 0) && s.debt < _ds - 1e-9;
    if (paydownOk) fogDelta -= c.fogPaydown;                            // S74: you are really paying the Baron down → the fog backs off a little
    else if (s.debt > 0) fogDelta += c.fogPerDebtSeason;
    else if (s.jars.save >= c.saveThreshold) fogDelta -= c.fogRelief;
    if (s.debt === 0 && s.jars.protect > 0) fogDelta -= 0.02;          // insured & debt-free: a little extra push
    this._setFog(s.fog01 + fogDelta, 'season');
    // stars
    const income = L.income + interestEarned + Math.max(0, investReturn);
    const expenses = L.expenses + interestPaid;
    // S66-C: fair 3rd star. Old rule (fog flat) was unreachable while ANY debt stood: the fog grows each season you end with debt.
    // Now: the debt did not go up AND you either held the fog or repaid at least the interest the Baron charged this season.
    const debtStart = L.debtStart ?? (debtBefore + L.repaid - L.loansTaken);   // debt when the season began (debtBefore is read AFTER this season's repayments)
    const fogHeld = s.fog01 <= fogBefore + 1e-9;
    const { stars, goals } = this._scoreSeason({ income, expenses, saved: L.saved, debtBefore, debtNow: s.debt, debtStart, fogHeld, repaid: L.repaid, interest: interestPaid, interestCleared: false });
    // S70: with the Baron at the pier the interest is still unpaid HERE. Mark the report open: pier payments (settleInterest / repay) are added to it
    // and closePier() re-scores the stars (before pier:done, so the ledger the player sees is final). Provisional stars = the old rule.
    const pierPending = this.pierPays && (s.debt > 0 || (s.interestOwed || 0) > 0);
    const report = {
      season, income, expenses, interestEarned, interestPaid, investReturn, investRate: +investRate.toFixed(3), upkeep, wages, subscription: subCost, tillTax: L.tillTax || 0, tillSwept: L.tillSwept || 0,   // 42A
      upkeepDebt: upkeepRes.debt, saved: L.saved, invested: L.invested, protected: L.protected, absorbed: L.absorbed,
      loansTaken: L.loansTaken, repaid: L.repaid, sales: L.sales, units: L.units, events: L.events.slice(),
      scamsAccepted: L.scamsAccepted, scamsRefused: L.scamsRefused, raided: L.raided || 0, recovered: L.recovered || 0,   // 42C
      debt: s.debt, debtBefore, interestOwed: s.interestOwed || 0, fog01: s.fog01, fogDelta: +(s.fog01 - fogBefore).toFixed(4), spark: s.spark, jars: { ...s.jars },
      netWorth: this.netWorth(), reputation: +s.reputation.toFixed(3),
      lessonId: c.lessons[(season - 1) % c.lessons.length], stars, goals, starSaveMin: c.starSaveMin, starIncomeGood: c.starIncomeGood,
      debtStart, fogHeld, ...(pierPending ? { pier: { pending: true, paid: 0, shortfall: 0, repaid: 0 } } : {}),
    };
    this.history.push(report);
    this.ledger = this._freshLedger();
    s.season++; s.day01 = 0;
    if (s.boons && s.boons.length) { const keep = s.boons.filter((b) => !(b && b.until != null && s.season >= b.until)); if (keep.length !== s.boons.length) { this.bus.emit('boon:expired', { ids: s.boons.filter((b) => !keep.includes(b)).map((b) => b.id), season: s.season }); s.boons = keep; } }   // S67: timed boons run out
    report.seasonSeconds = this.seasonSecondsFor(s.season);   // 41C: NEXT season's length so the HUD day bar scales
    this.bus.emit('eco:season', report);
    // win / lose
    if (this.isLose() || this.isWin()) this.closePier('end');   // S70: win / lose → no Baron visit follows, the report is final before eco:win / eco:lose
    if (this.isLose()) { s.ended = 'lose'; this.bus.emit('eco:lose', { season, reason: s.fog01 >= c.fogLoseAt ? 'fog' : 'debt' }); }
    else if (this.isWin()) { s.ended = 'win'; s.lighthouseLit = true; s.storyWon = true; this.bus.emit('eco:win', { season }); }
    return report;
  }
  /** S70: the three star goals. Pure (no state). `interestCleared` = the Baron's interest for the season was paid in full at the pier.
   *  Used by endSeason (provisional while the Baron still waits) and closePier (final). */
  _scoreSeason({ income, expenses, saved, debtBefore, debtNow, debtStart, fogHeld, repaid, interest, interestCleared = false }) {
    const c = this.config;
    const debtHeld = debtNow <= debtStart + 1e-9, paidInterest = repaid + 1e-9 >= interest || !!interestCleared;
    const goals = [
      { id: 'income', ok: income + 1e-9 >= expenses * c.starIncomeGood, income: round(income), expenses: round(expenses), need: Math.ceil(expenses * c.starIncomeGood - 1e-9) },   // S87: the numbers travel with the goal so the Ledger can SHOW the 1.25x check
      { id: 'save', ok: saved >= c.starSaveMin || (debtBefore > 0 && debtNow < debtBefore) },
      { id: 'debt', ok: debtHeld && (fogHeld || paidInterest), debtHeld, fogHeld, paidInterest, debtStart, interest, repaid },
    ];
    return { stars: goals.filter((g) => g.ok).length, goals };
  }
  /** S70: the report of the season the Baron is still collecting for (pierPays) — null when none is open. */
  _pierReport() {
    const r = this.history[this.history.length - 1];
    return r && r.pier && r.pier.pending && !this.state.ended ? r : null;
  }
  /** S70 BUGFIX: "I paid the Baron 45 and it did not count as a star". With pierPays the stars were scored the instant the clock ended, BEFORE the
   *  Baron was paid, so the interest you then paid at the pier (and any debt you repaid there) never counted. The Baron's visit is part of the
   *  season: baronPier calls this just before `pier:done`; the report is re-scored in place (stars, goals, debt, pouch, net worth) and
   *  `eco:stars {season, stars, from, report}` is emitted (unlocks add the stars here, the story swaps its ledger variant). Idempotent.
   *  why: 'done' | 'idle' | 'timeout' | … (re-reads the live state) · 'next' (stale report: scores it, does not touch its money snapshot). */
  closePier(why = 'done') {
    const r = this.history[this.history.length - 1];
    if (!r || !r.pier || !r.pier.pending) return null;
    const s = this.state, p = r.pier, from = r.stars; p.pending = false; p.why = why;
    if (why !== 'next') { r.debt = s.debt; r.spark = s.spark; r.jars = { ...s.jars }; r.interestOwed = s.interestOwed || 0; r.netWorth = this.netWorth(); }
    const cleared = p.shortfall <= 0 && p.paid + 1e-9 >= r.interestPaid;
    const { stars, goals } = this._scoreSeason({ income: r.income, expenses: r.expenses, saved: r.saved, debtBefore: r.debtBefore, debtNow: r.debt, debtStart: r.debtStart, fogHeld: r.fogHeld, repaid: r.repaid, interest: r.interestPaid, interestCleared: cleared });
    r.stars = stars; r.goals = goals; r.pier.cleared = cleared;
    // S87 BUGFIX ("I paid the Baron in season 3, got the check, but no star"): the NEW season's ledger took its debtStart the instant the old season closed, BEFORE the pier.
    // A shortfall at the pier (or any debt that landed after) then looked like "debt went up" in the NEXT season, so paying in full later could never earn the debt star.
    // The next season really starts when the Baron leaves: re-base it on the debt as it stands now (minus what was borrowed / plus what was repaid inside the new ledger).
    if (why !== 'next' && this.ledger) this.ledger.debtStart = s.debt + (this.ledger.repaid || 0) - (this.ledger.loansTaken || 0);
    this.bus.emit('eco:stars', { season: r.season, stars, from, report: r, why });
    return r;
  }
  /** S76 BUGFIX ("I paid the whole debt in S10, the Baron ran, but the season kept going - no cinematic, no dialogue"): isWin() was only read inside endSeason(),
   *  i.e. BEFORE the Baron's pier visit, when the debt was still owed. Debt cleared AT the pier never re-checked the gate. baronPier.done() now calls this right after
   *  closePier(): the run is won when the season that just closed was the last one (or later) and nothing is owed. Emits eco:win once. */
  tryWin() {
    const s = this.state; if (s.ended) return false;
    if (!this.isWin()) return false;
    s.ended = 'win'; s.lighthouseLit = true; s.storyWon = true; this.bus.emit('eco:win', { season: Math.max(1, s.season - 1) });
    return true;
  }
  isWin() {
    const c = this.config, s = this.state;
    if (s.ended === 'win') return true;
    if (c.endless) return false;                                       // BUGFIX B19: Endless (after a win or from the title) has no win gate
    if (s.fog01 > Math.max(c.fogWinAt, c.winFogMax || 0) || s.debt > 0) return false;
    return c.winRequiresSeasons ? s.season > c.seasonsToWin : true;   // season has already advanced past the last one
  }
  isLose() {
    const c = this.config, s = this.state;
    if (s.ended === 'lose') return true;
    return s.fog01 >= c.fogLoseAt || s.debt > c.maxLoan * 2;
  }

  // ------------------------------------------------ save / load
  serialize() {
    return JSON.stringify({ v: 1, state: this.state, ledger: this.ledger, history: this.history, pendingOffer: this.pendingOffer });
  }
  static deserialize(json, config = BALANCE, opts = {}) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    const eco = new Economy(config, opts);
    if (d && d.state) { eco.state = { ...eco.state, ...d.state, jars: { ...eco.state.jars, ...(d.state.jars || {}) } }; }
    if (d && d.ledger) eco.ledger = { ...eco._freshLedger(), ...d.ledger };
    if (d && Array.isArray(d.history)) eco.history = d.history;
    eco.pendingOffer = (d && d.pendingOffer) || null;
    return eco;
  }
  /** Snapshot for HUD (7A): cheap plain object. */
  summary() { const s = this.state; return { spark: s.spark, jars: { ...s.jars }, debt: s.debt, fog01: s.fog01, season: s.season, day01: +s.day01.toFixed(4), reputation: +s.reputation.toFixed(3), netWorth: this.netWorth(), ended: s.ended }; }
}

/** 41C pure helper: seconds for `season` given a BALANCE-shaped config (see Economy#seasonSecondsFor). */
export function seasonSecondsFor(config, season = 1) {
  if (config.seasonSecondsOverride > 0) return config.seasonSecondsOverride;
  const cv = config.seasonCurve;
  if (Array.isArray(cv) && cv.length) return cv[Math.min(cv.length, Math.max(1, season | 0)) - 1];
  return config.seasonSeconds || 150;
}

function mergeConfig(base, over) {
  if (!over || over === base) return deepClone(base);
  const out = deepClone(base);
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = mergeConfig(out[k], v);
    else out[k] = Array.isArray(v) ? v.slice() : v;
  }
  return out;
}
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

export default Economy;
