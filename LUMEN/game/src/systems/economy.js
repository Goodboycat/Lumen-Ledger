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
  seasonSeconds: 150,            // one Season = 150 s of play (10 Seasons ≈ 25 min)
  seasonsToWin: 10,              // story run length
  startSpark: 120,               // Pip's pouch at the start
  startDebt: 200,                // the inherited Glowmarket debt (lesson 1: you cannot ignore it)
  startFog: 0.35,                // Debt Fog coverage at start (0..1)

  savingsRate: 0.05,             // GOOD interest: Save jar earns 5 %/season
  loanRate: 0.20,                // BAD interest: Baron loan costs 20 %/season, compounding
  investMean: 0.08,              // Invest jar: 8 % ± 4 % per season (can be negative in bad seasons w/ events)
  investSpread: 0.04,
  maxLoan: 600,                  // Baron will not lend more than this total principal
  minLoan: 10,

  fogPerDebtSeason: 0.08,        // fog grows +0.08 each season you end with debt > 0
  fogRelief: 0.10,               // fog shrinks −0.10 each season with debt == 0 AND save ≥ saveThreshold
  saveThreshold: 150,            // "emergency fund" size that pushes the fog back
  fogLoseAt: 1.0,                // lose when fog01 reaches this
  fogWinAt: 0.0,                 // win when fog01 is at/below this at season end (after season ≥ seasonsToWin... see isWin)
  winRequiresSeasons: true,      // true → must also reach season ≥ seasonsToWin ; false → fog 0 is enough (Endless)

  upkeepPerStall: 6,             // Spark per stall per season (expenses)
  baseUpkeep: 10,                // fixed cost of living per season

  protectAbsorb: 1.0,            // fraction of a loss the Protect jar can absorb (1 = full, up to jar balance)
  starIncomeGood: 1.25,          // stars: income ≥ expenses×this  → +1
  starSaveMin: 20,               // stars: saved ≥ this this season → +1  (or debt went down)
  // stars: 3rd star = no debt increase AND fog did not grow

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
    this.events = opts.events || EVENTS;
    this.scams = opts.scams || SCAMS;
    this.upgrades = opts.upgrades || UPGRADES;
    const c = this.config;
    this.state = {
      spark: c.startSpark,
      jars: { spend: 0, save: 0, invest: 0, protect: 0 },
      debt: c.startDebt,
      fog01: c.startFog,
      season: 1,
      day01: 0,
      reputation: 0.5,
      stalls: 0,                         // count of built stalls (BuildSystem calls addStall/removeStall) → upkeep
      stallUpkeepExtra: 0,               // BUGFIX C01: extra upkeep from upgraded stalls (L2 +3, L3 +6) — set by the integrator from BuildSystem
      owned: [],                         // BUGFIX C03: ids of one-time upgrades bought (helpers, zones) — saved with the state
      lighthouseLit: false,
      storyWon: false,                   // BUGFIX B19: the story victory fires ONCE; Endless never re-triggers it
      ended: null,                       // null | 'win' | 'lose'
    };
    this.ledger = this._freshLedger();   // running totals for the current season
    this.history = [];                   // LedgerReport per finished season
    this.pendingOffer = null;
  }

  _freshLedger() { return { income: 0, expenses: 0, interestEarned: 0, interestPaid: 0, saved: 0, invested: 0, protected: 0, absorbed: 0, loansTaken: 0, repaid: 0, sales: 0, units: 0, events: [], scamsAccepted: 0, scamsRefused: 0 }; }

  // ------------------------------------------------ time
  /** Advance the season clock. dt in SECONDS. Auto-ends the season at day01 ≥ 1 when autoSeason. */
  tick(dt) {
    if (this.state.ended || !(dt > 0)) return;
    this.state.day01 += dt / this.config.seasonSeconds;
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
    return this.config.stalls[key] || null;
  }
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
    const base = info.base * (opts.baseMul || 1) * this.levelMul(opts.level) * this.mod('baseMulAll', 1);
    const q = demand(price, info.fair, base, mood, g.tolerance);
    // deterministic rounding: integer part + Bernoulli on the fraction
    let sold = Math.floor(q); if (this.rng() < q - sold) sold++;
    let paid = round(sold * price);
    if (paid > g.wallet) { sold = Math.floor(g.wallet / Math.max(price, 1e-9)); paid = round(sold * price); }
    const ratio = price / info.fair;
    const happy = sold > 0 && ratio <= 1.1;
    // reputation drift
    const c = this.config;
    if (sold > 0 && ratio <= 1.1) this.state.reputation = clamp(this.state.reputation + c.repGainFair, 0, 1);
    else if (ratio >= 1.4 || sold === 0) this.state.reputation = clamp(this.state.reputation - c.repLossGouge, 0, 1);
    if (paid > 0) { this._addSpark(paid, 'sale'); this.ledger.income += paid; }
    this.ledger.sales++; this.ledger.units += sold;
    const out = { paid, mood: +mood.toFixed(3), sold, fair: info.fair, happy, stallId, glimmerType, price };
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
  stallCost(stallId) { const i = this.stallInfo(stallId); return i ? i.cost : Infinity; }
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
    return v;
  }
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
    this.state.debt -= amount; this.ledger.repaid += amount;
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
    const r = { spark: 0, absorbed: 0, debt: 0, fog: 0, reputation: 0, investPct: 0 };
    if (effect.spark < 0) { const o = this.applyLoss(-effect.spark, reason); r.spark = -(o.paid); r.absorbed = o.absorbed; r.debt = o.debt; }
    else if (effect.spark > 0) { this.earn(effect.spark, reason); r.spark = effect.spark; }
    if (effect.investPct) { const d = round(this.state.jars.invest * effect.investPct); this.state.jars.invest += d; r.investPct = effect.investPct; r.investDelta = d; this.bus.emit('eco:jar', { jars: { ...this.state.jars }, deltas: { invest: d } }); }
    if (effect.fog) { this._setFog(this.state.fog01 + effect.fog, reason); r.fog = effect.fog; }
    if (effect.reputation) { this.state.reputation = clamp(this.state.reputation + effect.reputation, 0, 1); r.reputation = effect.reputation; }
    if (effect.debt) { this.state.debt = Math.max(0, this.state.debt + round(effect.debt)); r.debt += effect.debt; }
    for (const k of JARS) if (effect.jars && effect.jars[k]) { this.state.jars[k] = Math.max(0, this.state.jars[k] + round(effect.jars[k])); }
    return r;
  }
  /** Fire a world event by id (from this.events). Returns the applied result or null. */
  applyEvent(eventId) {
    const ev = this.events[eventId]; if (!ev || this.state.ended) return null;
    const effect = typeof ev.effect === 'function' ? ev.effect(this, this.rng) : ev.effect;
    const result = this._applyEffect(effect, 'event:' + eventId);
    this.ledger.events.push(eventId);
    const out = { id: eventId, event: ev, effect: result };
    this.bus.emit('eco:event', out);
    return out;
  }
  /** Pick a random "Too-Good Deal" (or by id). Returns the offer object (also stored in pendingOffer) and emits 'eco:scam'. */
  offerScam(id) {
    const ids = Object.keys(this.scams); if (!ids.length) return null;
    const scam = this.scams[id] || this.scams[ids[Math.floor(this.rng() * ids.length)]];
    const offer = { ...scam, offeredAt: this.state.season, isScam: true };
    this.pendingOffer = offer;
    this.bus.emit('eco:scam', offer);
    return offer;
  }
  /**
   * Accept an offer. Scams hurt: `cost` is lost (Protect does NOT cover scams — lesson), `amount` loans come in at `trueRate`
   * (stored as debt + scamRate for the next endSeason). Returns { accepted:true, lostSpark, debtAdded } .
   */
  acceptOffer(offer = this.pendingOffer) {
    if (!offer) return { accepted: false };
    let lostSpark = 0, debtAdded = 0;
    if (offer.cost) { const paid = Math.min(this.state.spark, round(offer.cost)); if (paid) this._addSpark(-paid, 'scam:' + offer.id); this.ledger.expenses += paid; lostSpark = paid; if (offer.payout) this.earn(offer.payout, 'scam:payout'); }
    if (offer.amount) { this.state.debt += round(offer.amount); debtAdded = round(offer.amount); this._addSpark(offer.amount, 'scam:loan'); this.state.scamRate = Math.max(this.state.scamRate || 0, offer.trueRate || this.config.loanRate); this.bus.emit('eco:loan', { debt: this.state.debt, delta: debtAdded, kind: 'scam' }); }
    this.ledger.scamsAccepted++;
    this.state.reputation = clamp(this.state.reputation - 0.05, 0, 1);
    this.pendingOffer = null;
    const out = { accepted: true, id: offer.id, lostSpark, debtAdded, lesson: offer.lesson || 'scams', tell: offer.tell };
    this.bus.emit('eco:scamResult', out);
    return out;
  }
  /** Refuse the pending offer (Ledger Flash / player taps "No thanks") → small reputation + fog relief. */
  refuseOffer(offer = this.pendingOffer) {
    if (!offer) return { accepted: false };
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
    const c = this.config, s = this.state, L = this.ledger;
    const season = s.season;
    const debtBefore = s.debt, fogBefore = s.fog01;
    // GOOD interest
    const interestEarned = round(s.jars.save * (c.savingsRate + this.mod('interestBonus', 0)));   // + Tally Owl
    s.jars.save += interestEarned;
    // Invest: 8 % ± 4 %
    const investRate = c.investMean + (this.rng() * 2 - 1) * c.investSpread;
    const investReturn = round(s.jars.invest * investRate);
    s.jars.invest += investReturn;
    // BAD interest, compounding (scam loans use the hidden higher rate)
    const rate = s.scamRate ? Math.max(c.loanRate, s.scamRate) : c.loanRate;
    const interestPaid = round(s.debt * rate);
    s.debt += interestPaid;
    // upkeep (routine cost: pouch → Spend jar → forced debt; the Protect jar is for shocks, NOT rent)
    // BUGFIX C01: upgraded stalls cost their promised extra upkeep, Pack Mole cuts STALL upkeep −20 %, helpers are paid wages
    const stallUpkeep = round((c.upkeepPerStall * s.stalls + (s.stallUpkeepExtra || 0)) * this.mod('upkeepMul', 1));
    const wages = this.helperWages();
    const upkeep = c.baseUpkeep + stallUpkeep + wages;
    const repBonus = this.mod('reputationBonus', 0); if (repBonus) s.reputation = clamp(s.reputation + repBonus, 0, 1);   // Gardener Snail
    const upkeepRes = this.applyLoss(upkeep, 'upkeep', { useProtect: false });
    // fog rules
    let fogDelta = 0;
    if (s.debt > 0) fogDelta += c.fogPerDebtSeason;
    else if (s.jars.save >= c.saveThreshold) fogDelta -= c.fogRelief;
    if (s.debt === 0 && s.jars.protect > 0) fogDelta -= 0.02;          // insured & debt-free: a little extra push
    this._setFog(s.fog01 + fogDelta, 'season');
    // stars
    const income = L.income + interestEarned + Math.max(0, investReturn);
    const expenses = L.expenses + interestPaid;
    let stars = 0;
    if (income >= expenses * c.starIncomeGood) stars++;
    if (L.saved >= c.starSaveMin || (debtBefore > 0 && s.debt < debtBefore)) stars++;
    if (s.debt <= debtBefore && s.fog01 <= fogBefore) stars++;
    const report = {
      season, income, expenses, interestEarned, interestPaid, investReturn, investRate: +investRate.toFixed(3), upkeep, wages,
      upkeepDebt: upkeepRes.debt, saved: L.saved, invested: L.invested, protected: L.protected, absorbed: L.absorbed,
      loansTaken: L.loansTaken, repaid: L.repaid, sales: L.sales, units: L.units, events: L.events.slice(),
      scamsAccepted: L.scamsAccepted, scamsRefused: L.scamsRefused,
      debt: s.debt, debtBefore, fog01: s.fog01, fogDelta: +(s.fog01 - fogBefore).toFixed(4), spark: s.spark, jars: { ...s.jars },
      netWorth: this.netWorth(), reputation: +s.reputation.toFixed(3),
      lessonId: c.lessons[(season - 1) % c.lessons.length], stars,
    };
    this.history.push(report);
    this.ledger = this._freshLedger();
    s.season++; s.day01 = 0;
    this.bus.emit('eco:season', report);
    // win / lose
    if (this.isLose()) { s.ended = 'lose'; this.bus.emit('eco:lose', { season, reason: s.fog01 >= c.fogLoseAt ? 'fog' : 'debt' }); }
    else if (this.isWin()) { s.ended = 'win'; s.lighthouseLit = true; s.storyWon = true; this.bus.emit('eco:win', { season }); }
    return report;
  }
  isWin() {
    const c = this.config, s = this.state;
    if (s.ended === 'win') return true;
    if (c.endless) return false;                                       // BUGFIX B19: Endless (after a win or from the title) has no win gate
    if (s.fog01 > c.fogWinAt || s.debt > 0) return false;
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
