// LUMEN 4A — headless economy test. Run from game/:  node tests/economy.test.mjs
// Prints PASS/FAIL per assert and exits 1 on any failure. No browser, no Three.
import { Economy, BALANCE, EVENTS, SCAMS, UPGRADES, demand, makeRng } from '../src/systems/economy.js';
import { EventBus } from '../src/core/EventBus.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('PASS', msg); } else { fail++; console.log('FAIL', msg); } };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const mk = (cfg = {}, opts = {}) => new Economy(cfg, { bus: new EventBus(), seed: 7, ...opts });

// ---- exports / initial state
ok(typeof Economy === 'function' && BALANCE && EVENTS && SCAMS && UPGRADES, 'exports: Economy, BALANCE, EVENTS, SCAMS, UPGRADES');
{
  const e = mk();
  const s = e.state;
  ok(s.spark === BALANCE.startSpark && s.debt === BALANCE.startDebt && near(s.fog01, BALANCE.startFog) && s.season === 1 && s.day01 === 0, 'initial state matches BALANCE');
  ok(['spend', 'save', 'invest', 'protect'].every((k) => s.jars[k] === 0), 'four jars start empty');
  ok(e.config !== BALANCE && JSON.stringify(e.config) === JSON.stringify(BALANCE), 'config is a deep copy of BALANCE (mutation-safe)');
  const e2 = mk({ startSpark: 999, stalls: { fruit: { fair: 100 } } });
  ok(e2.state.spark === 999 && e2.config.stalls.fruit.fair === 100 && e2.config.stalls.fruit.base === 2 && e2.config.stalls.bread.fair === 8, 'partial config deep-merges over BALANCE');
}

// ---- demand curve
{
  ok(near(demand(10, 10, 1, 1), 0.6), 'demand(price=fair) = 0.6 × base');
  ok(near(demand(1, 10, 1, 1), 1.5), 'demand clamps high at 1.5 (price = 0.1·fair)');
  ok(near(demand(20, 10, 1, 1), 0.1), 'demand clamps low at 0.1 (price = 2·fair)');
  ok(near(demand(10, 10, 2, 0.5), 0.6), 'demand scales with base × mood');
  ok(demand(10, 10, 1, 1, 1.5) > demand(10, 10, 1, 1, 1.0), 'higher tolerance (spender) → more demand at the same price');
  ok(demand(5, 0) === 0, 'demand with fair 0 → 0 (no divide by zero)');
}

// ---- tick / season clock
{
  const e = mk();
  e.tick(75); ok(near(e.state.day01, 0.5), 'tick(75 s) → day01 0.5 of a 150 s season');
  e.tick(74.9); ok(e.state.season === 1 && e.state.day01 < 1, 'just before season end still season 1');
  let seasonEv = null; e.bus.on('eco:season', (r) => { seasonEv = r; });
  e.tick(0.2); ok(e.state.season === 2 && seasonEv && seasonEv.season === 1 && near(e.state.day01, 0), 'tick past 150 s → endSeason() auto, eco:season emitted, season 2, day01 reset');
  const m = mk({}, { autoSeason: false }); m.tick(1000); ok(m.state.season === 1 && m.state.day01 === 1, 'autoSeason:false → clock parks at day01=1, season does not end');
  const t = mk(); t.tick(-5); t.tick(NaN); ok(t.state.day01 === 0, 'tick ignores negative / NaN dt');
}

// ---- sell
{
  const e = mk();
  const before = e.state.spark;
  let sparkEv = 0, saleEv = null; e.bus.on('eco:spark', () => sparkEv++); e.bus.on('eco:sale', (s) => { saleEv = s; });
  const r = e.sell('stall_fruit', 'regular', 6);
  ok(r.fair === 6 && r.sold >= 0 && r.paid === r.sold * 6 && e.state.spark === before + r.paid, 'sell(stall_fruit @ fair) pays sold×price into pouch');
  ok(saleEv && saleEv.stallId === 'stall_fruit' && (r.paid === 0 || sparkEv === 1), 'sell emits eco:sale (+ eco:spark when paid > 0)');
  ok(r.mood > 0 && r.mood <= BALANCE.moodMax, 'sell returns mood in range');
  const bad = e.sell('stall_unicorn', 'regular', 5);
  ok(bad.paid === 0 && bad.error, 'sell unknown stall → paid 0 + error');
  // statistical: cheap sells more than gouging over many customers
  const cheap = mk(), gouge = mk();
  let uc = 0, ug = 0;
  for (let i = 0; i < 200; i++) { uc += cheap.sell('fruit', 'regular', 3).sold; ug += gouge.sell('fruit', 'regular', 12).sold; }
  ok(uc > ug * 3, `price 3 sells far more units than price 12 over 200 visits (${uc} vs ${ug})`);
  ok(gouge.state.reputation < cheap.state.reputation, 'gouging lowers reputation, fair prices raise it');
  const k = mk(); const kid = k.sell('toy', 'kid', 11);
  ok(kid.paid <= BALANCE.glimmers.kid.wallet, 'kid wallet caps the paid amount');
  const d = mk(); const def = d.sell('tea', 'regular'); ok(def.price === BALANCE.stalls.tea.fair, 'sell without price uses the fair price');
}

// ---- canAfford / spend
{
  const e = mk();
  ok(e.canAfford(120) && !e.canAfford(121), 'canAfford at the exact pouch boundary');
  let denied = null; e.bus.on('eco:denied', (d) => { denied = d; });
  ok(e.spend(50, 'test') && e.state.spark === 70 && e.ledger.expenses === 50, 'spend deducts + tracks expenses');
  ok(!e.spend(500, 'too much') && e.state.spark === 70 && denied && denied.cost === 500, 'spend over budget → false, eco:denied, pouch untouched');
  ok(e.stallCost('fruit') === 60 && e.buyStall('fruit') && e.state.stalls === 1 && e.state.spark === 10, 'buyStall pays the stall cost and counts the stall');
  ok(!e.buyStall('tool') && e.state.stalls === 1, 'buyStall refuses when unaffordable');
}

// ---- allocate
{
  const e = mk(); let jarEv = null; e.bus.on('eco:jar', (j) => { jarEv = j; });
  ok(e.allocate({ save: 50, protect: 20 }) && e.state.jars.save === 50 && e.state.jars.protect === 20 && e.state.spark === 50, 'allocate moves pouch → jars');
  ok(jarEv && jarEv.deltas.save === 50 && jarEv.jars.protect === 20, 'allocate emits eco:jar with deltas + jars');
  ok(e.allocate({ save: -30 }) && e.state.jars.save === 20 && e.state.spark === 80, 'allocate negative moves jar → pouch');
  ok(!e.allocate({ save: -100 }) && e.state.jars.save === 20, 'allocate refuses to overdraw a jar');
  ok(!e.allocate({ invest: 500 }) && e.state.spark === 80, 'allocate refuses more than the pouch holds');
  ok(!e.allocate({ gold: 5 }), 'allocate refuses unknown jar');
  ok(e.allocate({ save: 10, invest: -0 }) && e.state.jars.save === 30, 'allocate ignores zero deltas, applies the rest');
  ok(e.netWorth() === 70 + 30 + 20 - BALANCE.startDebt, 'netWorth = pouch + jars − debt');
}

// ---- endSeason: interest, upkeep, stars, lesson
{
  const e = mk({ startDebt: 0, startFog: 0.5, startSpark: 500 });
  e.allocate({ save: 200, invest: 100 });
  for (let i = 0; i < 20; i++) e.sell('fruit', 'regular', 6);
  const r = e.endSeason();
  ok(r.interestEarned === 10 && e.state.jars.save === 210, 'savings earn 5 %/season (200 → 210)');
  ok(r.investRate >= 0.04 - 1e-9 && r.investRate <= 0.12 + 1e-9 && e.state.jars.invest === 100 + r.investReturn, 'invest returns 8 % ± 4 %');
  ok(r.interestPaid === 0 && r.upkeep === BALANCE.baseUpkeep, 'no debt → no interest paid; upkeep = base + per-stall');
  ok(r.lessonId === 'budgeting' && r.stars >= 0 && r.stars <= 3 && Number.isInteger(r.stars), 'report has lessonId (season 1 = budgeting) + stars 0..3');
  ok(r.season === 1 && e.state.season === 2 && e.history.length === 1 && e.ledger.income === 0, 'season advanced, history pushed, ledger reset');
  ok(near(r.fogDelta, -0.1) && near(e.state.fog01, 0.4), 'debt 0 & save ≥ threshold → fog −0.10');
  const dbt = mk({ startDebt: 100, startFog: 0.5 });
  const rd = dbt.endSeason();
  ok(rd.interestPaid === 20 && dbt.state.debt === 120, 'loan compounds 20 %/season (100 → 120)');
  ok(near(rd.fogDelta, 0.08) && near(dbt.state.fog01, 0.58), 'debt > 0 → fog +0.08/season');
  const rd2 = dbt.endSeason(); ok(rd2.interestPaid === 24 && dbt.state.debt === 144 && rd2.lessonId === 'needsVsWants', 'compounding: 120 → 144; season 2 lesson = needsVsWants');
  // stars: perfect season = 3
  const p = mk({ startDebt: 0, startFog: 0.5, startSpark: 1000 }); p.allocate({ save: 300 });
  for (let i = 0; i < 40; i++) p.sell('fruit', 'regular', 5);
  const rp = p.endSeason(); ok(rp.stars === 3, `perfect season (income, saved, no debt/fog growth) → 3 stars (got ${rp.stars})`);
  const z = mk({ startDebt: 300, startFog: 0.5 }); const rz = z.endSeason(); ok(rz.stars === 0, `idle season with debt → 0 stars (got ${rz.stars})`);
}

// ---- loans / repay
{
  const e = mk({ startDebt: 0 }); let loanEv = null; e.bus.on('eco:loan', (l) => { loanEv = l; });
  ok(e.takeLoan(100) && e.state.debt === 100 && e.state.spark === 220 && loanEv.kind === 'take', 'takeLoan adds debt + pouch');
  ok(!e.takeLoan(5) && !e.takeLoan(BALANCE.maxLoan), 'takeLoan refuses below minLoan / above maxLoan');
  ok(e.repay(60) === 60 && e.state.debt === 40 && e.state.spark === 160, 'repay reduces debt + pouch');
  ok(e.repay(1000) === 40 && e.state.debt === 0, 'repay is capped by debt');
  const poor = mk({ startDebt: 500, startSpark: 30 }); ok(poor.repay(100) === 30 && poor.state.spark === 0, 'repay is capped by pouch');
}

// ---- Protect jar absorbs losses
{
  const e = mk({ startDebt: 0, startSpark: 100 }); e.allocate({ protect: 30 });
  const r = e.applyLoss(50, 'storm');
  ok(r.absorbed === 30 && r.paid === 20 && e.state.jars.protect === 0 && e.state.spark === 50 && e.state.debt === 0, 'Protect absorbs 30 of a 50 loss, pouch pays 20');
  const broke = mk({ startDebt: 0, startSpark: 10 }); const rb = broke.applyLoss(40, 'storm');
  ok(rb.paid === 10 && rb.debt === 30 && broke.state.debt === 30, 'uncovered loss becomes forced debt');
  const ev = mk({ startDebt: 0, startSpark: 100 }); ev.allocate({ protect: 40 }); let evEv = null; ev.bus.on('eco:event', (x) => { evEv = x; });
  const res = ev.applyEvent('storm');
  ok(res && evEv && evEv.id === 'storm' && res.effect.absorbed === 40 && ev.state.spark === 60 && ev.ledger.events[0] === 'storm', 'applyEvent(storm): Protect absorbs 40, pouch pays 0 (spark −40 → 60), fog +0.03, eco:event emitted');
  ok(ev.applyEvent('nope') === null, 'applyEvent unknown id → null');
  // S15: exposure — uncovered share of an insurable loss scatters exposeJars × that share from Save + Invest
  const EXPO = { gust: { id: 'gust', title: 'Gust', effect: { spark: -40, exposeJars: 0.10 }, insurable: true } };
  const x0 = mk({ startDebt: 0, startSpark: 300 }, { events: EXPO }); x0.allocate({ save: 100, invest: 50 });                 // Protect empty → full 10 %
  const rx0 = x0.applyEvent('gust');
  ok(rx0.effect.exposed === 15 && x0.state.jars.save === 90 && x0.state.jars.invest === 45 && x0.ledger.exposed === 15, 'exposure: empty Protect → 10 % of Save (−10) and Invest (−5) scattered');
  const x1 = mk({ startDebt: 0, startSpark: 300 }, { events: EXPO }); x1.allocate({ save: 100, invest: 50, protect: 40 });    // Protect covers all → 0 %
  const rx1 = x1.applyEvent('gust');
  ok(rx1.effect.exposed === 0 && x1.state.jars.save === 100 && x1.state.jars.invest === 50, 'exposure: full Protect → Save/Invest untouched');
  const x2 = mk({ startDebt: 0, startSpark: 300 }, { events: EXPO }); x2.allocate({ save: 100, invest: 50, protect: 20 });    // half covered → 5 %
  const rx2 = x2.applyEvent('gust');
  ok(rx2.effect.exposed === 8 && x2.state.jars.save === 95 && x2.state.jars.invest === 47, 'exposure: half Protect → 5 % (Save −5, Invest −3 rounded)');
  const x3 = mk({ startDebt: 0, startSpark: 300 }, { events: { plain: { id: 'plain', effect: { spark: -40 } } } }); x3.allocate({ save: 100 }); x3.applyEvent('plain');
  ok(x3.state.jars.save === 100, 'events without exposeJars never touch Save/Invest');
  const f = mk(); f.applyEvent('festival'); ok(f.state.spark === 150 && f.state.reputation > 0.5, 'applyEvent(festival): +30 Spark, reputation up');
}

// ---- scams
{
  const e = mk({ startDebt: 0 }); let scamEv = null; e.bus.on('eco:scam', (o) => { scamEv = o; });
  const offer = e.offerScam('tooGoodLoan');
  ok(offer && offer.isScam && scamEv === offer && e.pendingOffer === offer && offer.tell, 'offerScam returns + emits an offer with a tell-tale sign');
  const acc = e.acceptOffer();
  ok(acc.accepted && e.state.debt === 150 && e.state.spark === 270 && e.state.scamRate === 0.35 && e.pendingOffer === null, 'acceptOffer(tooGoodLoan): +150 debt at hidden 35 % rate');
  const r = e.endSeason(); ok(r.interestPaid === Math.round(150 * 0.35), 'scam loan compounds at its true 35 % rate');
  const d = mk(); d.offerScam('doubleSpark'); const a2 = d.acceptOffer(); ok(a2.lostSpark === 80 && d.state.spark === 40, 'acceptOffer(doubleSpark): 80 Spark gone, no payout');
  const n = mk(); n.offerScam(); const fogB = n.state.fog01; const ref = n.refuseOffer(); ok(ref.refused && n.state.fog01 < fogB && n.ledger.scamsRefused === 1, 'refuseOffer: fog −0.02, counted');
  const rnd = mk(); const o2 = rnd.offerScam(); ok(o2 && SCAMS[o2.id], 'offerScam() with no id picks a random scam');
}

// ---- upgrades
{
  const e = mk({ startSpark: 100 }); const u = e.buyUpgrade('stallL2'); ok(u && e.state.spark === 10 && e.buyUpgrade('stallL3') === null, 'buyUpgrade pays cost; refuses when broke');
  const b = mk(); const r1 = b.sell('fruit', 'regular', 1, { baseMul: 2.2 }); ok(r1.sold >= 0, 'sell accepts baseMul (stall level) option');
}

// ---- win / lose
{
  const w = mk({ startDebt: 0, startFog: 0.0, seasonsToWin: 2 }); let win = null; w.bus.on('eco:win', (x) => { win = x; });
  w.endSeason(); ok(!w.isWin() && !win, 'season 1 of 2 with fog 0 → not yet a win');
  w.endSeason(); ok(w.isWin() && win && win.season === 2 && w.state.ended === 'win' && w.state.lighthouseLit, 'after season 2 with fog 0 & no debt → win + lighthouse lit');
  const after = w.endSeason(); ok(after === w.history[1] && w.state.season === 3, 'endSeason after the game ended is a no-op (returns last report)');
  const endless = mk({ startDebt: 0, startFog: 0.0, winRequiresSeasons: false }); ok(endless.isWin(), 'winRequiresSeasons:false → fog 0 + no debt wins immediately (Endless)');
  const l = mk({ startDebt: 400, startFog: 0.95 }); let lose = null; l.bus.on('eco:lose', (x) => { lose = x; });
  l.endSeason(); ok(l.isLose() && lose && lose.reason === 'fog' && l.state.ended === 'lose', 'fog reaching 1.0 → lose (eco:lose reason fog)');
  const dead = mk({ startDebt: 400, startFog: 0.95 }); dead.endSeason(); const sp = dead.state.spark; dead.tick(10); ok(dead.state.day01 === 0 && dead.state.spark === sp, 'tick is a no-op after the game ended');
  const nf = mk({ startDebt: 0, startFog: 0.5 }); ok(!nf.isWin() && !nf.isLose(), 'mid-game: neither win nor lose');
}

// ---- serialize / deserialize
{
  const e = mk({ startSpark: 300 }); e.allocate({ save: 100, invest: 50 }); e.takeLoan(50); e.sell('fruit', 'regular', 6); e.endSeason(); e.tick(30); e.offerScam('doubleSpark');
  const json = e.serialize();
  ok(typeof json === 'string' && JSON.parse(json).v === 1, 'serialize → versioned JSON string');
  const back = Economy.deserialize(json, {}, { bus: new EventBus(), seed: 7 });
  ok(JSON.stringify(back.state) === JSON.stringify(e.state) && back.history.length === 1 && back.pendingOffer && back.pendingOffer.id === 'doubleSpark' && back.ledger.income === e.ledger.income, 'deserialize restores state, history, ledger, pendingOffer');
  ok(back.sell('fruit', 'regular', 6).fair === 6 && back.summary().season === 2, 'deserialized economy keeps working (sell + summary)');
  const empty = Economy.deserialize('{}', {}, { bus: new EventBus() }); ok(empty.state.spark === BALANCE.startSpark, 'deserialize of {} → fresh economy');
}

// ---- determinism + bus isolation
{
  const a = new Economy(BALANCE, { bus: new EventBus(), seed: 42 }), b = new Economy(BALANCE, { bus: new EventBus(), seed: 42 });
  let same = true; for (let i = 0; i < 50; i++) if (a.sell('fruit', 'regular', 4).sold !== b.sell('fruit', 'regular', 4).sold) same = false;
  ok(same && a.endSeason().investReturn === b.endSeason().investReturn, 'same seed → identical sales + invest returns (reproducible)');
  const r = makeRng(1); const v = r(); ok(v >= 0 && v < 1 && r() !== v, 'makeRng yields [0,1) values');
  const fresh = mk(); fresh.pushFog(1); ok(near(fresh.state.fog01, BALANCE.startFog - 0.05), 'pushFog(1) → fog −0.05 (Fog Sweep hook)');
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
