# Chat 43A — Season scripts: data/seasons.json drives the scheduler
Needs: 41C (season curve) · 42C/42D (raid, scamNpc marks)      Blocked-by: 43Z
Owned (only these files): data/seasons.json (new), src/systems/seasonScript.js (new), src/Game.js (installScheduler reads the script ≤ 30 lines changed; `SCHEDULER_MARKS` stays as fallback), tests/seasons.test.mjs (new), tools/gates/seasons.mjs (new), tools/check.mjs (additive `--seasons`)
Read (max 6 credits): START_HERE.md → HANDOFF_43Z.md (the table) → this → Game.js 270–312 (installScheduler) → economy.js seasonSecondsFor
Export (API_CONTRACTS "Season scripts (43A)", ≤ 6 lines):
  `data/seasons.json` = `{ version:1, seasons:{ "1":{ len, trickle:[], warn, event, forceEvent?, scam, scamKind:'npc'|'baron'|null, wave, novelty:{id,at}|null }, …, "endless":{ rotate:["6","7","8","9","10"] } } }`
  `createSeasonScript(data) → SS` · `SS.for(season) → row` (endless rotates) · `SS.validate() → [errors]` (no mark equal to previous season's same mark, all in (0,1), trickle ascending) · `SS.marks(season) → sorted [{kind, at, payload}]`
  `installScheduler` iterates `SS.marks(season)` instead of hard-coded ifs; fires `bus.emit('season:mark', {season, kind, at})` and for `novelty` kind `bus.emit('season:novelty', {season, id})` (43B+ listen; 43A does nothing else).
  `seasonSecondsFor` reads `row.len` when a script is loaded (BALANCE.seasonCurve stays fallback).

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 20 credits)
- `data/seasons.json` from the 43Z table (S1–S10 + endless). `seasonScript.js` pure: load, `for`, `marks`, `validate`. `tests/seasons.test.mjs` 4 tests (validate OK · S1 row equals SCHEDULER_MARKS · no two consecutive equal marks · endless rotation).
- `Game.js`: `createSandbox` loads the script (`opts.seasons` object or fetch `data/seasons.json` like story.json; headless without it → fallback built from SCHEDULER_MARKS). Scheduler loop: one `fired` Set per season; each mark fires once when `day01 >= at`, same guards as today (modalOpen, pendingOffer, enemies.enabled). `forceEvent` sets `sb.nextEvent`.
- `check.mjs --seasons` (below). `--game --sandbox --pier --raid` still ALL OK.
### P2 — should ship (≈ 8 credits)
- Scheduler debug log `S3 mark trickle@0.25`; `?season=N` URL flag already exists → confirm it picks row N; `sb.log` lists marks.
### P3 — nice to have (≈ 4 credits)
- `tools/funnel.mjs --synthetic 20` rerun → `tools/shots/funnel_synthetic_43A.json`, numbers in the HANDOFF (expect no change: S1 row = old marks).

## Demo page: none — pure logic, `tests/seasons.test.mjs`.

## check.mjs section `--seasons` (additive; name it `43A SEASON SCRIPTS`)
- validate() = [] on the shipped json · S1 marks equal legacy `SCHEDULER_MARKS` within 1e-9 · headless game S1→S3 on the game-time clock fires every mark exactly once per season (count `season:mark`) · `season:novelty` emitted for S2 (`stormWarning`) and S3 (`nightMarket`) · fallback path (no json) still fires trickle×2, wave, event · destroy → 0 leaks.

## Budgets: none (data + logic).
## Content rules that bite here: PLAN §6 "nothing at the same mark two seasons in a row" is a validate() error, not a warning.
## Handoff `docs/HANDOFF_43A.md`: Done / Missing / Measured (marks fired per season) / Suspected / Notes for the integrator (43B: how to subscribe to `season:novelty`, the `fired` Set reset).
