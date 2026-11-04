# FUNNEL_BASELINE — S44 numbers (MASTER_PLAN_V6 §5), measured 2026-11-02 by Chat 40B

**What this is.** The numbers Chat 45 compares against. Every number below is a *measurement*, never an estimate; what could not be measured says so and why. Re-measure with the exact commands given — same N, same season length.

## How it was measured
| Run | Command (from `LUMEN/game/`) | Clock | Sees UI timing? |
|---|---|---|---|
| **Synthetic headless** (this file's numbers) | `node tools/funnel.mjs --synthetic 20 --quiet --out tools/shots/funnel_synthetic_2026-11-02.json --md` | **game-time** (30 fps fixed step, `opts.telemetryNow`), season 150 s (real default) | **No** — dialogue is auto-advanced in the same frame, tutorial overlay is not mounted headless. So `modalSeconds`, `tFirstStall` are *script* values, not human. |
| Real browser (P2) | `node tools/play.mjs --script funnel --runs 3` | wall clock | yes — **not measured** this chat (sandbox had no Playwright browser installed; `tools/setup_browser.sh` costs ≈ 10 credits; left for 45 or a chat with budget) |
| Real itch players | `window.lumenTelemetry.export()` → paste into `node tools/funnel.mjs sessions.json --md` | wall clock | yes — **not measured** (game not yet published with 40A telemetry) |

Scripted "average player" (`tools/funnel.mjs synthetic()`): PLAY (story) → dialogue auto-advanced → **one** player-placed stall at t = 30 s (first unowned type, first free cell near (1,1), spark topped to 400 if short) → ledgers skipped → runs until Season 3 (or 420 s cap) → back to title. Seeds 1–20. 17 s wall for 20 runs.

## S44 baseline — PLAN §5 table
| Metric | S44 baseline (synthetic, n=20) | How | v6 target |
|---|---|---|---|
| Time from PLAY to first stall placed | **30.03 s** median (scripted — the script places at 30 s; a human value needs P2) | `steps.firstStall` | ≤ 45 s |
| Time to first coin **in hand** | **never** (0/20 sessions; `firstCoinInHand` n/a) — no `tip:*`/`till:*` earn exists before 42A | `steps.firstCoinInHand` | ≤ 20 s |
| Players reaching Season 2 | **100 %** (20/20) at median **150.50 s** — scripted players never quit; real % needs itch telemetry | `steps.s2` | ≥ 60 % |
| Players reaching Season 3 | **100 %** (20/20) at median **300.83 s** — same caveat | `steps.s3` | ≥ 40 % |
| Share of Spark through Pip's hands / total income | **0.0 %** (0 / 367 spark mean per session; 20/20 sessions had sales) | `sparkHandled/sparkTotal` | ≥ 80 % |
| Modal seconds in first 90 s | **0.1 s** (headless: dialogue closes same frame; **real value not measured** — PLAN's "≈ 50 s" stays an estimate until P2) | `modalSeconds` | ≤ 10 s |
| Abilities used in S1–S2 | **not measured** — 40A has no ability mark; 41D must add `telemetry:mark('firstAbility')` or an `ability:*` listener | — | ≥ 1 per run |
| Time to first sale (not in PLAN, free from the data) | **7.42 s** median (starter stalls sell to the first wave) | `steps.firstSale` | — |

Raw funnel (same run, `--md` output):

| step | reached | % | median t (s) |
|---|---|---|---|
| play | 20 | 100 % | 0.00 |
| firstStall | 20 | 100 % | 30.03 |
| firstSale | 20 | 100 % | 7.42 |
| firstCoinInHand | 0 | 0 % | n/a |
| s2 | 20 | 100 % | 150.50 |
| s3 | 20 | 100 % | 300.83 |

Quit histogram: `S3 d0.0 title` 20/20 (the script quits to title on reaching S3). Mean seasons played 2.0.

## Reading the numbers honestly
- The **two numbers that are real** in this table are *Spark through Pip's hands = 0.0 %* and *first coin in hand = never*: they come from the economy, not the script. They are the v6 lever (42A tills, 42B jars).
- *firstStall = 30 s*, *S2/S3 = 100 %*, *modalSeconds = 0.1 s* are properties of the script. Their job is to be a **regression harness**: 41A–41D re-run the exact command and paste `node tools/funnel.mjs --compare tools/shots/funnel_synthetic_2026-11-02.json <new>.json` in their HANDOFF. A change in `firstSale` or `sparkTotal` there is a balance change; a change in `s2`/`s3` time is a season-length change (41C expects s2 → 70.5 s).
- Human values (tFirstStall, modalSeconds, quit decile) need either P2 (`play.mjs --script funnel`, Playwright, 3 runs ≈ 6 screenshots) or the itch build. Both are open.

## Files
- `tools/funnel.mjs` — report (`<json|->`, `--md`), `--synthetic N [--season S] [--out f] [--quiet]`, `--compare a b [--md]`.
- `tests/fixtures/funnel.json` — 3 synthetic sessions (20 s seasons) used by `check.mjs --telemetry` as a smoke.
- `tools/shots/funnel_synthetic_2026-11-02.json` — the 20 sessions behind this table (compare target for 41A–41D, 45).

## 43D re-measure (2026-11-03, after phase 43 season scripts + 5 novelties)
`node tools/funnel.mjs --synthetic 20 --season 150 --quiet --out tools/shots/funnel_synthetic_43D.json` then `--compare tools/shots/funnel_synthetic_42B.json tools/shots/funnel_synthetic_43D.json`.
(The 43D prompt said `--season 5`; that flag is *seasonSeconds*, and a 5 s season makes the scripted 30 s stall placement impossible — not comparable. 150 s = the 42B run.)

| metric | 42B | 43D | Δ |
|---|---|---|---|
| firstStall / firstSale / firstCoinInHand / s2 / s3 reached | 100 % each | 100 % each | 0 |
| firstStall median | 30.03 s | 30.03 s | 0 (scripted) |
| firstSale median | 7.19 s | 7.19 s | 0 |
| firstCoinInHand median | 150.20 s | 150.20 s | 0 (script collects at season end) |
| s2 / s3 median | 150.20 / 300.33 s | 150.20 / 300.33 s | 0 |
| **Spark through Pip's hands** | **87.6 %** | **87.1 %** | −0.4 (noise: S2 storm novelty darkens + absorbs one event; S3 night market doubles spill) |
| modalSeconds (0–90 s) | 0.0 | 0.0 | 0 |

Reading: phase 43 changed *what happens inside* a season (storm warning, night market, Baron visit, picky critics, double raid, rotation) without touching the first-90-seconds funnel or the Spark-through-hands lever. **Reach S2 = 100 % ≥ 40 % → 44Z UNGATED.** Real-human reach-S2 still needs the itch build telemetry (`?telemetry=<url>`).

## 44D re-measure (2026-11-03, after phase 44 readable market: price bubbles, sign tint, wants, season demand)
`node tools/funnel.mjs --synthetic 20 --season 150 --quiet --out tools/shots/funnel_synthetic_44D.json` then `--compare tools/shots/funnel_synthetic_43D.json tools/shots/funnel_synthetic_44D.json`.

| metric | 42B | 43D | 44D | Δ 44D−43D |
|---|---|---|---|---|
| firstStall / firstSale / firstCoinInHand / s2 / s3 reached | 100 % each | 100 % each | 100 % each | 0 |
| firstStall median | 30.03 s | 30.03 s | 30.03 s | 0 (scripted) |
| firstSale median | 7.19 s | 7.19 s | 7.10 s | −0.09 |
| firstCoinInHand median | 150.20 s | 150.20 s | 150.20 s | 0 (script collects at season end) |
| s2 / s3 median | 150.20 / 300.33 s | 150.20 / 300.33 s | 150.20 / 300.33 s | 0 |
| **Spark through Pip's hands** | **87.6 %** | **87.1 %** | **86.3 %** | −0.8 (44B `noStall` leaves + 44C COLD kinds sell less → a bit more Spark arrives as trickle/event instead of sales) |
| modalSeconds (0–90 s) | 0.0 | 0.0 | 0.0 | 0 |

Reading: phase 44 made prices, wants and seasonal demand *readable* without touching the first-90-seconds funnel. Hands 86.3 % ≥ 80 % and reach S2 100 % ≥ 40 % → **45Z UNGATED**. Reach S3 is 100 % on the synthetic player, but the islands decision (HANDOFF_44D) stays **NO** — the credit condition (≥ 10 chats before Nov 12) is not met and the real-human reach-S2 still needs itch telemetry (`?telemetry=<url>`).

## 45B browser (2026-11-04) — first REAL-browser row (Playwright headless Chromium, SwiftShader GL, 1280×720, `?mute`, ×3)
`NODE_PATH=tools/node_modules node tools/play.mjs --script funnel` → `window.lumenTelemetry.export()` → `tools/shots/funnel_browser_45B.json` → `node tools/funnel.mjs tools/shots/funnel_browser_45B.json --md`. n = 1 session, 238 s wall clock, quit = back to title by the harness.

| step | 44D synthetic (n=20, game-time) | **45B browser** (n=1, wall clock) | reading |
|---|---|---|---|
| play | 0.00 s | **0.00 s** | PLAY via Enter on the title works (title → S1 opening dialogue). |
| firstStall | 30.03 s (scripted) | **not reached** | the harness's `B` + `1` at ~30 s landed while the S1 opening dialogue was still open (dialogue eats keys) → no stall placed in 238 s. **Finding 45B-1.** |
| firstSale | 7.10 s | **55.53 s** | starter stalls sell to the first wave only after the opening dialogue is drained (~43 s of dialogue in a real browser vs 0 s headless). |
| firstCoinInHand | 150.20 s (script collects at season end) | **95.27 s** (`tip:walk`) | real: Pip walked over a dropped tip — the 42A tip loop works in a browser. |
| s2 / s3 | 150.20 / 300.33 s | **not reached** | two causes, both measured (see Suspected): (1) the 41B verb chain **freezes the season clock** (`sb.eco.tick` is a no-op while `V.step >= 0`) and auto-advances one verb per 25 s → up to 125 s with `day01 = 0`; (2) SwiftShader renders at **fps ≈ 1**, `core/Game.js maxDt = 0.1` clamps every frame to 0.1 s game-time → the game ran at ≈ 1/10 wall-clock speed even at ×3. 238 s wall ≈ 24–70 s game time. |
| Spark through Pip's hands | 86.3 % | **100 %** (3 / 3) | only the 3 verb-chain reward coins were earned; nothing from stalls — not comparable. |
| modalSeconds (0–90 s) | 0.0 s | **0.0 s** | ❗ telemetry did not count the ~43 s of S1 opening dialogue (probe: `ui.dialogue.isOpen = true` at 21 s and 43 s). `modalSeconds` only sums `ui:modal` ledger time, not `dialogue`. **Finding 45B-2** — PLAN's "≈ 50 s" estimate is still the best number for dialogue. |

**Caption / honesty:** this is a *harness* number, not a human one. The sandbox GPU is SwiftShader; at fps ≈ 1 the funnel can't reach S2 in the 2.5 min budget regardless of game design. The row is still the first real evidence of two things the synthetic run can never see: the opening dialogue holds the player ~43 s before anything sells, and `modalSeconds` under-reports it. Re-run `tools/play.mjs --script funnel` on a machine with a real GPU (fps 60) for a comparable S2/S3 row — the harness is reusable (P3 done).
