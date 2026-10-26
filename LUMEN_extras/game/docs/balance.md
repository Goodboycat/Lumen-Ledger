# Balance — Lumen Ledger economy (Chat 4B)

Source of truth: `src/systems/economyData.js → BALANCE_TUNED` (spread over 4A `BALANCE`). Reproduce every number here with
`node tests/economy.sim.mjs [seed]` (3 strategies × 10–12 seasons) and `node tests/economy.sim.mjs --sweep` (20 seeds).
`node tools/check.mjs --economy` fails if the targets below drift.

## Targets (from the 4B prompt + GAME_BIBLE)
| Strategy | Target | Result (20 seeds) |
|---|---|---|
| **sensible** — fair prices, repay debt first, then jars 40 % Save / 15 % Invest / 10 % Protect, build ≤ 6 stalls with a 40 Spark buffer, refuse every Too-Good Deal | WIN at **S10 ± 1** | win@10 ×17 · win@11 ×3 · fog reaches 0 at S8–S11 |
| **borrow-everything** — max loan every season, sell at 0.6× fair, spend 90 % on wants, accept every scam | LOSE | lose@3 ×7 · lose@5 ×13 (debt > 2×maxLoan or fog 1.0) |
| **hoarder** — 3 stalls, 1.3× fair prices, never uses jars, repays slowly | slow LOSE (no fog relief) | lose@8 ×6 · lose@9 ×12 · lose@10 ×1 · open ×1 |

The story (10 lessons, one per season) therefore ends exactly when a well-played run lights the lighthouse. Fog 0 lands on
S9–S10 for most seeds, so the last 1–2 seasons are the "almost there" push, not a wait.

## What changed vs 4A `BALANCE` and why
| Key | 4A | 4B | Why |
|---|---|---|---|
| startSpark | 120 | **150** (was 100 until 2026-10-23, S01) | 100 left a first-time player at 0 Spark in S1 (income 66 vs expenses 221 in recording run 2). 150 = one stall + a buffer for the first repay; debt 260 and 20 % interest stay untouched so the Baron's scam still bites. Sweep at 150: sensible win@10 ×20/20, borrow lose@3–5, hoarder lose ≥ 8/10 |
| startDebt | 200 | **260** | sensible clears it at S3–4 instead of S2; S1–S3 lessons (budgeting, needs vs wants, emergency fund) happen *under* debt |
| startFog | 0.35 | **0.40** | with 4A values the sensible run hit fog 0 at S6–7 and waited |
| fogPerDebtSeason | 0.08 | **0.07** | hoarder lose moved from S7 to S8–10 (slower, visibly "drifting"), borrow still loses by S5 |
| fogRelief | 0.10 | **0.12** | with the higher start + later debt-free point, −0.12 (+0.02 extra with a Protect jar) lands fog 0 on S9–10 |
| saveThreshold | 150 | **200** | ≈ 3 seasons of upkeep with 6 stalls (14 + 6×7 = 56/season) + one stall: a real emergency fund |
| baseUpkeep / upkeepPerStall | 10 / 6 | **14 / 7** | expenses stay visible on the Ledger even with 6 stalls (56 vs 20 for 1 stall) |
| maxLoan | 600 | **500** | borrow-everything hits `debt > 2×maxLoan` (= lose) 1 season sooner |
| stalls.*.base | 2 / 1 / 3 | **0.7 – 2.2** | see per-stall table; needs-stalls stay volume, wants-stalls stay margin |

Untouched (4A values are right): savingsRate 5 %, loanRate 20 %, investMean 8 % ± 4 %, star rules, reputation drift, glimmer
tolerances/wallets, lessons order.

## Per-stall fair price · base units · build cost
| Stall | fair | base | cost | role |
|---|---|---|---|---|
| tea | 5 | 2.2 | 55 | cheapest, highest volume — the S1 bootstrap stall |
| fruit | 6 | 1.6 | 60 | the other S1 option (needs) |
| bread | 8 | 1.5 | 80 | needs |
| flower | 7 | 1.5 | 70 | wants, West Meadow |
| fish | 10 | 1.4 | 95 | East Shore |
| toy | 11 | 1.3 | 100 | kids/tourists |
| lantern | 14 | 0.9 | 120 | wants, high margin |
| pottery | 12 | 0.9 | 110 | wants |
| book | 13 | 0.9 | 120 | elders/critics |
| cloth | 15 | 0.8 | 130 | wants |
| tool | 18 | 0.8 | 150 | late |
| sparkExchange | 20 | 0.7 | 250 | late, lesson 8 (diversification) |

Rule of thumb for 6A/7A: expected Spark per visit at fair price ≈ `0.6 × base × fair × mood` → tea 6.6, fruit 5.8, bread 7.2,
lantern 7.6, tool 8.6, sparkExchange 8.4 (mood 1). So a late stall is worth ~1.4× an early one per customer, and costs ~3×.
Payback ≈ cost / (visits × that) → with 10 visits/season a tea stall pays back in < 1 season, a tool stall in ~2.

## Events (10) — `EVENTS`, picked by `pickEvent(eco, season)` (weighted, season-gated)
| id | from S | weight | effect | insurable | lesson |
|---|---|---|---|---|---|
| festival | 1 | 3 | +35 Spark, rep +0.08 | — | budgeting |
| collectorVisit | 1 | 3 | −25 Spark | no (a known bill) | planningForAGoal |
| storm | 2 | 3 | −45 Spark, fog +0.03 | yes | insurance |
| leakyRoof | 2 | 3 | −30 Spark | yes | emergencyFund |
| helperDay | 2 | 1 | −15 Spark, rep +0.06 | — | budgeting |
| touristBoat | 3 | 2 | +20 Spark, rep +0.05 | — | needsVsWants |
| baronTax | 3 | 2 | −(10 + 5 % of debt), fog +0.04 if in debt | — | goodVsBadInterest |
| sparkBoom | 4 | 2 | Invest +20 % | — | compoundGrowth |
| sparkDip | 5 | 2 | Invest −15 % | — | diversification |
| lighthouseFlicker | 6 | 2 | fog −0.06 if Save ≥ threshold, else +0.02 | — | delayedGratification |

Sum of loss events ≈ 30–45 Spark; the Protect jar in the sensible run holds 20–100, so one shock per season is absorbed, two are
not — which is the lesson. Negative-Spark events go through `applyLoss` (Protect → pouch → Spend → forced debt).
Recommended cadence for 10B: **one event per season**, rolled at day01 ≈ 0.5, never on S1 before the first sale.

## Too-Good Deals (6) — `SCAMS`, `offerScam(id?)` → `acceptOffer()` / `refuseOffer()`
| id | hook | true cost | the tell (Ledger Flash / Scout Fox reveals it) |
|---|---|---|---|
| zeroInterestLoan | 150 Spark "zero interest*" | loan at 35 %/season compounding | the asterisk |
| doubleSpark | pay 80, get 160 "GUARANTEED" | −80 | "guaranteed" returns |
| luckyLantern | 40 Spark raffle ticket | −40 | urgency + a prize you cannot inspect |
| foggyInsurance | 60 Spark "fog-proof" policy | −60 | no written terms, no claims process |
| premiumStallKit | 120 for "all stalls upgraded, normally 400" | −120 | a fake "normal" price (real L2 = 90) |
| quickFlip | 100 for notes that "flip for 300" | −70 net (payout 30) | "I personally know" — a stranger's insider tip |

Scam losses are **never** absorbed by Protect (4A rule). Refusing gives fog −0.02. Recommended cadence: one offer on S2, S4, S5,
S7, S9 (season 5 is the scams lesson — offer two).

## Upgrades tree (11) — `UPGRADES`, `canBuyUpgrade(eco, id, owned)`
| kind | id | cost | upkeep | requires | effect (consumer) |
|---|---|---|---|---|---|
| stall | stallL2 | 90 | +3 | — | `baseMul 1.5` → pass to `eco.sell(..., { baseMul })` (BuildSystem) |
| stall | stallL3 | 180 | +6 | stallL2 | `baseMul 2.2` |
| helper | helper_gardenerSnail | 60 | 3 | — | reputation +0.01/season |
| helper | helper_packMole | 70 | 4 | — | upkeep ×0.8 |
| helper | helper_tallyOwl | 80 | 4 | — | Save +1 %/season |
| helper | helper_sparkBee | 90 | 5 | season 3 | all stalls baseMul ×1.1 |
| helper | helper_guardTortoise | 100 | 5 | season 3 | Protect absorbs ×1.5 |
| helper | helper_scoutFox | 110 | 5 | season 4 | shows the scam `tell` before you choose |
| zone | zone_west | 250 | — | season 3 | Island zone 1 |
| zone | zone_east | 350 | — | zone_west | Island zone 2 |
| zone | zone_far | 500 | — | zone_east, season 7 | zone 3 — the Lighthouse |

Helper/zone effects are *data*: 4A `buyUpgrade` only charges the cost and emits `eco:upgrade`; 10B applies `effect` (e.g. add
`upkeep` to its own helper-upkeep tally, multiply `baseMul`). Stall upgrades are per stall (not deduplicated by `canBuyUpgrade`).
Price ladder: by S4 a sensible run has ~150–250 loose Spark after jars → one helper or L2 per season, West zone at S5–6, Far
Point at S8–9, which is when fog is 0.1–0.2 — the lighthouse unlock and the win line up.

## Seed-1 tables (`node tests/economy.sim.mjs 1`)
```
sensible · start spark 150 debt 260 fog 0.40
 S  income  expens    +int    -int    debt    save  invest    prot   spark     fog stars  events / lesson
 1     177     107       2      26     158      36      13       8      11    0.47    ★★  - / budgeting
 2     208      52       3       9      52      70      25       7       8    0.52    ★★  leakyRoof / needsVsWants
 3     169      83       5       0       5     100      36      13       0    0.59    ★★  - / emergencyFund
 4     286     192       7       0       0     154      58      24       2    0.57   ★★★  festival / goodVsBadInterest
 5     347     251      10       0       6     219      84      37       0    0.62    ★★  - / scams
 6     500      56      20       0       0     425     161      58     109    0.48   ★★★  collectorVisit / compoundGrowth
 7     524      56      33       0       0     690     268     116     147    0.34   ★★★  - / insurance
 8     503      56      46       0       0     963     389     142     144    0.18   ★★★  leakyRoof / diversification
 9     611      56      61       0       0    1279     539     205     170    0.04   ★★★  - / delayedGratification
10     652      56      78       0       0    1633     804     274     186    0.00   ★★★  sparkBoom / planningForAGoal
→ WIN after 10 seasons · net worth 2897 · 6 stalls
borrow  → LOSE after 5 seasons (debt 1079 > 2×500) · hoarder → LOSE after 9 seasons (fog 1.0, net worth 85)
```
For comparison, the same strategies on 4A `BALANCE` (`--base`): sensible fog 0 at **S7** (then waits), hoarder **never loses**.

## Knobs for a later pass (mobile / playtest)
- Too hard → `fogRelief 0.13` or `startFog 0.35` (both keep win@10 on 20/20 seeds in the sweep). Too easy → `fogPerDebtSeason 0.08`.
- Real players sell fewer units than the sim (18 + 5/stall visits per season). If playtests show S10 misses, lower `saveThreshold`
  to 150 first — it moves fog 0 by about one season without touching the debt lesson.
- `winRequiresSeasons: false` gives Endless mode: fog 0 + debt 0 wins immediately (≈ S8–9 for sensible).
