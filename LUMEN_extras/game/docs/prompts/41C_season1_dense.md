# Chat 41C — Season 1 = 70 s and dense, Collector in S1
Needs: 4A/4B economy + sim · 10B installScheduler · S16 enemies · S37 CUSTOMER_TRICKLE · 41B (`tut:done` starts the clock)      Blocked-by: 41B
Owned (only these files): src/systems/economy.js (`seasonSecondsFor(season)` + config use, ≤ 20 lines), src/systems/economyData.js (BALANCE rows), src/Game.js installScheduler (marks as fractions of the season — already day01 — plus the S1 wave), src/systems/enemies.js (`ENEMY_RULES` S1 row: 1 Collector, hp 1), tests/economy.sim.mjs (+ `--seasons70` strategy), docs/balance.md (new section), check.mjs (`--sandbox` asserts updated additively)
Read (max 6 credits): START_HERE.md → MASTER_PLAN_V6.md §0, §3 → this → economy.js lines 20–60 (config) + 170–200 (tick) → Game.js 247–275 (scheduler) → enemies.js 1–60 (rules) → docs/balance.md "tuned on" paragraph
Export (API_CONTRACTS "Season length (41C)", ≤ 4 lines):
  `BALANCE.seasonSeconds` becomes `BALANCE.seasonCurve = [70, 90, 110, 130, 150]` (S ≥ 5 → 150); `economy.seasonSecondsFor(season)` pure; `config.seasonSeconds` kept as an override for tests (`opts.seasonSeconds` wins when set).
  `eco:season` payload gains `seasonSeconds` (next season's length) so the HUD day bar scales.
  Scheduler marks stay day01 fractions: waves 0 / 0.34 / 0.67, warn 0.30, event 0.45, scam 0.70, Collectors 0.70 — **S1 Collector at 0.55** (one, hp 1, drops 2 ✦) so the sword has a job before the first ledger.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 20 credits)
- `economy.js`: `seasonSecondsFor(s)`; `tick` divides by the current season's length; `_endSeason` / `eco:season` includes the next length. Default `BALANCE.seasonCurve` as above; `seasonSeconds:150` stays as a fallback when the curve is absent (old saves / tests passing `seasonSeconds`).
- Re-tune the money so S1 is *winnable but tight* at 70 s: interest and upkeep are per season (not per second) so the shorter season means **less income per season** — scale `loanRate` per-season interest and `upkeep` by `seasonSecondsFor(s)/150` for S1–S4 (document the formula in balance.md). Run `tests/economy.sim.mjs` (sensible / borrow / hoarder) and keep the existing win-rate bands (sensible wins ≈ 17/20 seeds, borrow & hoarder lose); adjust `startSpark`/`debt` only if the bands break.
- `enemies.js`: `spawnWave(1)` returns one Collector (hp 1, contact 1 ✦, defeat drops 2 ✦) — currently S1 has none (verify). Keep S2+ as is.
- `Game.js installScheduler`: S1 wave at day01 ≥ 0.55; S ≥ 2 unchanged (0.70). The toast `tut:collector` (41B's reduced set) fires with it: "A Collector! Space to bonk."
- `check.mjs --sandbox` additive asserts: S1 length 70 s (`eco.state.day01` reaches 1 after 70 simulated s), S5 = 150, `enemy:wave` S1 count 1 at day ≈ 0.55, HUD receives `seasonSeconds`.
### P2 — should ship (≈ 10 credits)
- HUD day bar (ui/hud.js is 7A's; add ≤ 5 lines there, allowed) shows the shorter bar and a "70 s" chip on S1 only.
- `tests/economy.sim.mjs --seasons70`: prints per-season income/expenses for S1–S5 at the curve lengths; paste into balance.md.
### P3 — nice to have (≈ 5 credits)
- Save v1 compatibility: a snapshot with `seasonSeconds:150` from S44 resumes and the *next* season uses the curve.

## Demo page: none — `index.html?debug` shows season length in the stats line.

## check.mjs section: additive asserts inside `SANDBOX (10B)` and `GAME (10C)` runs (do not add a new flag): S1 ends at 70 s · S2 at 90 s · the economy sim bands hold (`--economy` already runs the sim).

## Budgets: 0 new meshes (one Collector already budgeted).
## Content rules that bite here: the Collector in S1 must be beatable by a first-time player (hp 1, slow 1.6 u/s, no contact damage for the first 2 s after spawn, telegraphed by the existing fogPuff).
## Handoff `docs/HANDOFF_41C.md`: Done / Missing / Measured (sim bands before/after; S1 income at 70 s) / Suspected / Notes for the integrator (41D reads stars from `eco:season`; 42A/42C rely on the S1 Collector existing; 43 will move the marks per season — keep them in ONE table at the top of installScheduler).
