# HANDOFF 43Z — Plan phase 43 "Break the season template" (2026-11-03, docs only, no code)

## Why
Every season today runs the same `SCHEDULER_MARKS` (trickle 0.34/0.67 · warn 0.30 · event 0.45 · scam 0.70 · wave 0.55|0.70).
MASTER_PLAN_V6 §6: *"nothing in a season is at the same day01 mark two seasons in a row"* and *"each season adds one new thing"*.
Phase 43 moves the marks into **`data/seasons.json`** (one script per season, S1–S10 + `endless`) and gives S2–S5 one **novelty** each.
No new modal (PLAN §6): novelties are world things + barks + at most one HUD chip.

## Season-script table (the contract 43A implements, 43B/43C fill)
`day01` marks. Trickle = extra customer waves (first wave always at 0). `—` = none that season. Novelty `at` is also a mark.

| S | len s | trickle        | warn | event | scam (odd) / Baron | wave     | novelty (id @ at)                 | what the player learns |
|---|-------|----------------|------|-------|--------------------|----------|-----------------------------------|------------------------|
| 1 | 70    | 0.34 0.67      | —    | —     | —  (verb chain)    | 0.55     | —                                 | verbs (41B)            |
| 2 | 90    | 0.30 0.62      | 0.22 | 0.48  | —                  | 0.72     | `stormWarning` @0.22 (forced storm, Owl bark "fill Protect") | insurance = Protect jar |
| 3 | 110   | 0.25 0.55 0.80 | 0.35 | 0.40  | scamNpc 0.66       | 0.75     | `nightMarket` @0.60 (lights dim, lanterns, ×1.3 spend, till spill ×2) | collect tills before dark |
| 4 | 130   | 0.33 0.58      | 0.28 | 0.52  | **Baron in person** 0.64 | 0.70 | `baronVisit` @0.64 (Baron pitches `tooGoodLoan` himself, portrait, taunt) | read the asterisk |
| 5 | 150   | 0.28 0.52 0.76 | 0.31 | 0.44  | scamNpc 0.68       | 0.73     | `pickyGlimmer` @0.20 (critic customer, price-check bubble, refuses > fair×1.1) | fair pricing |
| 6 | 150   | 0.30 0.60      | 0.26 | 0.50  | Baron hostile (16/S16) | 0.66 | `raidDouble` @0.66 (two Collectors raid two tills) | tills vs shield |
| 7 | 150   | 0.27 0.54 0.81 | 0.33 | 0.46  | scamNpc 0.70       | 0.74     | `nightMarket`                     | —                      |
| 8 | 150   | 0.32 0.57      | 0.24 | 0.42  | Baron 0.62         | 0.71     | `stormWarning`                    | —                      |
| 9 | 150   | 0.29 0.53 0.78 | 0.30 | 0.49  | scamNpc 0.67       | 0.76     | `pickyGlimmer`                    | —                      |
| 10| 150   | 0.31 0.61      | 0.27 | 0.45  | Baron 0.65         | 0.69     | `baronVisit` (finale taunt)       | —                      |
| endless | 150 | rotate S6–S10 rows | | | | | rotate novelties S6→S10 | — |

Rule check (43A gate): for every mark kind, `marks[S][kind] !== marks[S-1][kind]` (abs diff ≥ 0.02). Event ids still come from `pickEvent` except S2 (forced `storm`).

## 43A–43D (prompts in `docs/prompts/43*.md`)
- **43A** `data/seasons.json` + `src/systems/seasonScript.js` (load/validate/`marksFor(season)`/`noveltyFor`), scheduler reads the script, `season:novelty` bus event, `check.mjs --seasons`. Pure refactor + data; no novelty behaviour yet.
- **43B** novelties `stormWarning` (S2) + `nightMarket` (S3): `src/systems/novelties/stormWarning.js`, `nightMarket.js`, registry `novelties/index.js`.
- **43C** novelties `baronVisit` (S4) + `pickyGlimmer` (S5).
- **43D** `raidDouble` (S6), rotation S7–10 + endless, barks `seasonNovelty[id]`, HUD "NEW" chip (non-modal), save compat, funnel re-measure vs FUNNEL_BASELINE, close phase 43 (S46 version, Game_Bible).

## Notes for the integrator
- All current constants stay as **fallback** when `data/seasons.json` is missing (headless tests / old demos) — `SCHEDULER_MARKS` is not deleted in 43A, it becomes the S1 row's source of truth check.
- Novelty modules share one tiny interface: `{ id, start(sb, season), update(sb, dt), end(sb), dispose() }`; the scheduler calls `start` at `at`, `end` on `eco:season`.
- 44Z is gated: do **not** start 44 before `funnel.mjs --synthetic 20` after 43D is in FUNNEL_BASELINE (needs ≥ 40 % reach S2).
