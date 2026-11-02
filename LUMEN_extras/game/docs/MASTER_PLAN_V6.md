# MASTER PLAN v6 — "One game, not two" (2026-11-02). THE ONLY CURRENT PLAN.

> **STOP NOTICE (user decision, 2026-11-02).** Every update that was running or queued from **17 onward is frozen**:
> 17B 17C 17D 17E, 18Z–30Z (biomes, regions, puzzles, map, powers, Citadel, story v2 …), 13B trailer, 14 APK.
> **Do not continue them. Do not start them. Do not delete their files** (17A `Regions.js` + `regions.json` stay on disk, unused).
> `MASTER_PLAN_V5.md` is history. `README "## Next"` now lists only the v6 IDs. `next.sh` picks from there.
> Anything a future chat finds in `prompts/17*.md … 30*.md` is reference only.

## 0. Why (the diagnosis we are acting on — read once)
Analytics: 8.36 % CTR on the itch page, 56 plays, "not what players expected". The logo sells a cozy action-adventure
(lantern, coin, sword-and-hammer hero). The build delivers **two games stapled together**:
- **Game A — action**: 3-hit combo, dash, six abilities (Q W E R F G), Collectors, a 4-attack Baron. Real, good.
- **Game B — economy**: customers spawn on a timer (day 0 / 0.34 / 0.67), walk to stalls, pay via `economy.sell()`
  automatically into the pouch, leave. Event at 0.45, scam at 0.7, enemies at 0.7. Everything else resolves in a ledger.
- **Where they touch**: a Collector contact costs 1 ✦, defeating one drops 1 ✦, tips are 20 % of a sale on the ground.
  With S1 interest ≈ 39 and upkeep 14 + 7/stall, the whole action layer moves the economy by single digits.
  **Pip is a bystander in his own market.** Players feel it within two minutes.
- Every season has the identical shape → after S2 the player has seen the whole hand and we ask for 8 more repetitions
  (20 min; median web session is 5–8 min).
- Progression is all money; stars do nothing visible; six abilities given on frame one with no reason to use them.

**The four options the user asked about — all rejected** (recorded so no chat re-opens them):
longer seasons (no: the problem is empty seconds) · more randomness (no: unfelt randomness reads as unfair; the storm
warning at day 0.30 is the model — *readable* randomness) · more FinLit (no: it already dominates screen time; it is read,
not played) · delete more UI (no: HUD is lean; the pain is modal UI) · more islands (absolutely not before the first
90 s hold — this is why phases 17–30 are frozen).

## 1. The unifying idea: **make Spark physical**
Customers pay into the **stall's till**, not the pouch. Coins pile up on the counter. Pip runs over and collects
(coin-magnet dash becomes the verb). **Collectors raid tills**, not Pip → the sword has economic stakes.
**Jars are places**: pouch coins are at risk; walk to the Save jar, press E, deposit. Budgeting becomes a spatial
decision under time pressure. **Pay the Baron at the pier** at season's end — debt becomes an NPC you dread.
**Scams are Collector NPCs** you talk to or bonk; Ledger Flash reveals the tell on the one in front of you.
One idea, both halves need each other (Moonlighter / Dave the Diver / Overcooked: *the player is the bottleneck
through which the economy flows*). Everything already built is reused: `W.jars`, `pierSpawn`, the coin InstancedMesh,
`sb.dropTip`, `sb.collectCoin`, `EnemySystem`, `eco.allocate`, `eco.repay`.

**The test every chat applies before writing anything** (replaces "add or edit what?"):
*"What does the player do with their hands in the 20 seconds after the last thing they read?"*
If the answer is "wait for the customers", that is the bug, whatever UI/lore/land surrounds it.

## 2. How the plan is written (same two-level mechanism as v5 §0)
- This file = the index. `docs/prompts/<ID>_*.md` = the full prompt in `_FORMAT_V2.md` (≤ 60 lines, P1/P2/P3).
- IDs are `40A`-style (two digits + A–D) because `tools/next.sh` matches `[0-9]{1,2}[A-D]?`. **Never use E–Z suffixes.**
- Phases 40–42 prompts are written (this chat). 43–45 have a `<N>Z_plan_phase.md` each (a Z-chat writes the rest).
- Reading rule for an ID chat: START_HERE → this file §0–§1 → its own prompt → only the API_CONTRACTS / HANDOFF sections it names.
- Chain rules unchanged (START_HERE, CHAIN RULE v4.1): one message per chat, `wip.sh` after every file, push always.
- **Credits**: each ID is sized so P1 closes in ≤ 25 credits. No full-game screenshot playthroughs; use `check.mjs` gates and
  `tools/play.mjs` scripted slices (≤ 6 shots).

## 3. Phase map (sequential; IDs inside a phase sequential unless marked ∥)
| Phase | Theme | IDs | Est. chats |
|---|---|---|---|
| 40 | **Instrument first** — funnel telemetry (title→PLAY, first stall, first sale, S2, S3, quit point) so every later change is measured | 40A 40B | 2 |
| 41 | **First 90 seconds** — opening 9→2 barks over the walk-in, diegetic verb tutorial, S1 = 70 s dense + Collector in S1, 2 abilities at start / 4 earned by stars | 41A 41B 41C 41D | 5 |
| 42 | **Couple the two games (physical Spark)** — tills, jars as places, Collectors raid tills, Baron at the pier + scam NPCs | 42A 42B 42C 42D | 6 |
| 43 | **Break the season template** — data-driven season scripts; each season adds one new thing (S2 storm warning, S3 night market, S4 Baron shows his face, S5 picky Glimmer, …) | 43Z → 43A–43D | 5 |
| 44 | **Depth, only after S2 retention proves the loop** — readable pricing bubbles, stall-type × customer-type interplay, THEN islands (un-freeze 17B+ here if ever) | 44Z → 44A–44D | 5 |
| 45 | **Ship v3** — itch page/zip, Game_Bible, re-measure the funnel vs 40A baseline, trailer (13B) and APK (14) leave standby here | 45Z → 45A–45C | 3 |

**README "## Next" order** = `40A 40B 41A 41B 41C 41D 42A 42B 42C 42D 43Z 44Z 45Z`. A Z appends its IDs right after itself.

## 4. ID index (one line each; owned files; the prompt has the rest)
| ID | Deliverable | Owned files | Needs |
|---|---|---|---|
| 40A | `src/systems/telemetry.js` — pure funnel recorder on the bus (title→PLAY, t-to-first-stall, t-to-first-sale, reached S2/S3, quit point, session s), localStorage ring buffer, `?telemetry=` endpoint POST (itch-safe, off by default), `export()` | src/systems/telemetry.js, Game.js (installTelemetry, ≤ 15 lines), tests/telemetry.test.mjs, check.mjs `--telemetry` | 10C |
| 40B | `tools/funnel.mjs` — reads exported telemetry JSON → funnel table (% reaching each step, median times, quit histogram by day01/season) + `docs/FUNNEL_BASELINE.md` with the S44 numbers from a scripted `play.mjs --script funnel` run | tools/funnel.mjs, tools/play.mjs (script `funnel`), docs/FUNNEL_BASELINE.md | 40A |
| 41A | Opening 9 → 2 lines, played as **barks** (speech bubbles over Pip/Owl, non-modal) during the walk-in cinematic; `story.json` `seasons[0].opening` trimmed, the cut lines moved to `barks` | data/story.json, src/systems/story.js (bark kind), ui/bark.js + bark.css (new), ui/index.js (mount line) | 8B S18 |
| 41B | **Diegetic tutorial**: no 11-step overlay. Verb chain move → pick up a coin → bonk a crate → place a stall → deposit in a jar; each step ≤ 10 s, each changes the world; one floating hint at a time; season clock starts after the chain | ui/tutorial.js (rewrite), ui/tutorial.css, Game.js installTutorialGates (replace), data/story.json `tutorial` | 41A 42B-stub |
| 41C | **Season 1 = 70 s and dense**, scale 70 → 150 by S5 (`seasonSecondsFor(season)` in balance); customer waves and the first **Collector in S1** rescheduled on the shorter clock; interest/upkeep re-tuned by the sim | src/systems/economy.js (config fn), economyData.js BALANCE, Game.js installScheduler, enemies.js (S1 wave), tests/economy.sim.mjs, docs/balance.md | 40A |
| 41D | **Two abilities at start** (dash, shield); growthStomp / ledgerFlash / haggleShout / fogSweep **earned**: 3 ★ on a ledger unlocks the next; HUD ability chips locked/unlocked; ledger shows "NEW ABILITY" card; save v2 field | Game.js (ABILITY_KEYS gate), src/systems/save.js (v2 `abilities`), ui/hud.js (chips), ui/ledger.js (unlock card), check.mjs `--unlocks` | 41C |
| 42A | **Tills**: `economy.sell()` credits `stall.till` not the pouch; coins stack visibly on the counter (reuse coin InstancedMesh, ≤ 8 visible per stall + a count chip); Pip collects by touch / magnet dash → `eco.earn`; till overflow cap → coins spill as ground tips | src/systems/till.js (new), customers.js (pay target), Game.js (coin layer), ui/hud.js (till total), check.mjs `--till` | 41C |
| 42B | **Jars are places**: E near a jar deposits pouch → that jar (`eco.allocate` delta); hold E withdraws; jar fill mesh already exists (`setFill`); pouch coins are **at risk** (Collector contact knocks 10 % to the ground); the jar slider panel becomes read-only summary | src/systems/jarsWorld.js (new), Game.js (interact key), ui/jars.js (summary mode), ui/hud.js (pouch vs banked), check.mjs `--jarsworld` | 42A |
| 42C | **Collectors raid tills**: `EnemySystem` targets the richest till, steals up to N ✦/contact, carries it visibly (coin on head), drops it when hit; defeating one returns the stolen coins; tells + threat arrow on HUD | src/systems/enemies.js (target/carry states), src/systems/till.js (steal/refund), ui/hud.js (threat arrow), check.mjs `--raid` | 42A |
| 42D | **Baron at the pier + scam NPCs**: season end → Baron stands at `pierSpawn`; walking to him with E hands over interest/repayment physically (`eco.repay`), ledger opens after; Too-Good Deal = a Collector NPC near the plaza (talk E → pitch, choice; bonk → it flees; ledgerFlash near it reveals the tell) | src/systems/baronPier.js (new), src/systems/scamNpc.js (new), Game.js installSeasonLoop (hook), story.json scam lines (speaker tags), check.mjs `--pier` | 42B 42C |
| 43Z | Plan phase 43: `data/seasons.json` season scripts (per-season marks + one novelty each), 43A–43D prompts | docs only | 42D |
| 44Z | Plan phase 44 (gated on `FUNNEL_BASELINE` vs 45-style re-measure: ≥ 40 % reach S2 before any depth work) | docs only | 43D |
| 45Z | Plan ship v3 + un-standby 13B/14 | docs only | 44D |

## 5. Measurable goals (40B measures the baseline, 45 re-measures)
| Metric (scripted + real itch telemetry) | S44 baseline | v6 target |
|---|---|---|
| Time from PLAY to first stall placed | measure | ≤ 45 s |
| Time to first coin **in hand** (not auto-credited) | n/a (auto) | ≤ 20 s |
| Players reaching Season 2 | measure | ≥ 60 % |
| Players reaching Season 3 | measure | ≥ 40 % |
| Share of Spark that passed through Pip's hands (tills + tips) / total income | ≈ 5 % | ≥ 80 % |
| Modal seconds in the first 90 s (dialogue + tutorial lock + ledger) | ≈ 50 s | ≤ 10 s |
| Abilities used in S1–S2 (any of the 4 earned) | ≈ 0 | ≥ 1 per run |

## 6. Rules that bite in v6 (add to Bible §2 at 45)
- A Spark number may only change because of something the player **sees happen in the world** (coin, jar, Baron, Collector). Ledger-only deltas are a bug from 42A on (interest excepted; it is paid at the pier in 42D).
- No new modal in phases 41–43. Barks, bubbles, world hints only. The ledger is the single modal and it must show a reward (★ → ability).
- Seasons scale 70 → 150 s; nothing in a season is at the same day01 mark two seasons in a row (43).
- Keep frozen 17A code compiling; `check.mjs --regions` stays green but is not a v6 gate.
