# HANDOFF 43A — Season scripts: `data/seasons.json` drives the scheduler (2026-11-03, CLOSED)

## Done
- `data/seasons.json` (S1–S10 + `endless.rotate [6..10]`) from the 43Z table. `src/systems/seasonScript.js`: `createSeasonScript(data|null)` →
  `SS.for(season)` (endless rotates), `SS.marks(season)` (sorted `{kind, at, payload}`), `SS.len(season)`, `SS.validate()` (in (0,1), trickle ascending,
  PLAN §6 consecutive-season rule `|d| ≥ 0.02` = **error**, scamKind npc|baron, rotate refs exist). `null` → legacy rows from `LEGACY_MARKS` (= old `SCHEDULER_MARKS`).
- `Game.js createSandbox`: `sb.seasons = createSeasonScript(opts.seasons)`; invalid json → log + legacy. `eco.config.seasonCurve` is rebuilt from
  `row.len` (70/90/110/130/150) unless `opts.seasonSeconds` / `opts.balance.seasonCurve` is given. `index.html` fetches `./data/seasons.json`
  (relative, itch-safe) and passes it through `createLumenGame → createSandbox`.
- `installScheduler`: one `S.fired` Set + `S.marks` per season; every mark fires once when `day01 ≥ at` with the same guards as before (trickle/wave wait
  for `modalOpen`, wave waits for `pendingOffer`, enemies disabled → no wave). `forceEvent` sets `sb.nextEvent` at season start. `scamKind 'baron'` → no
  NPC, no direct offer (43C does the Baron in person). Emits `season:mark {season, kind, at, payload}` and `season:novelty {season, id, at}`.
  Debug: every fired mark is pushed to `sb.log` as `S3 mark trickle@0.25` (headless or `debugKeys`).
- `tests/seasons.test.mjs` (4 pass) · `tools/gates/seasons.mjs` → `node tools/check.mjs --seasons` ("43A SEASON SCRIPTS") ALL OK.
- Bug found by the gate: `destroySandbox` never called `unlocks.destroy()` (41D) → 2 bus listeners (`eco:season`, `eco:win`) leaked per sandbox. Fixed.

## Missing
- P3 funnel re-measure (`funnel.mjs --synthetic 20`) not run — S1 row is byte-equal to the old marks so no change is expected; 43D re-measures anyway.
- `?season=N` is **seconds-per-season** (`seasonSeconds` override), not "start at season N" — unchanged; a start-season flag does not exist.

## Measured (headless, seasonSeconds 20, seed 7)
| season | marks fired | kinds |
|---|---|---|
| S1 | 3 | trickle×2, wave |
| S2 | 6 | trickle×2, warn, event(storm forced), wave, novelty stormWarning |
| S3 | 8 | trickle×3, warn, event, scam(npc), wave, novelty nightMarket |
| S4 | 7 | trickle×2, warn, event, scam(baron → no offer), wave, novelty baronVisit |
Fallback (no json): S1 `{trickle 2, warn, event, scam, wave}`, S2 no scam, no novelties — identical to pre-43A.

## Suspected
- `warn` fires in S1 of the **legacy** row (it always did; the real S1 row has `warn:null`). Harmless: `storm.warn()` only runs when `nextEvent === 'storm'`.
- `check.mjs --game/--sandbox` were green but they run on the legacy row (no `opts.seasons`); only `--seasons` exercises the json. 43B's gate should pass `seasons: data` too.

## Notes for the integrator (43B)
- Subscribe: `sb._offs.push(bus.on('season:novelty', ({ season, id }) => NOVELTIES[id]?.start(sb, season)))` and end on `eco:season`. The mark fires once
  per season (`S.fired` is reset when `eco.state.season` changes), so `start` is never called twice for the same season. `sb.sched.marks` lists the
  current season's marks if you need `at` ahead of time; `sb.seasons.for(season).novelty` gives `{id, at}`.
- Novelty kind has no guard (fires even with a modal open) — if 43B needs the "wait for modal" behaviour, add `if (modal) { ok = false; break; }` to the
  `novelty` case like trickle does.
- Load the json in headless tests with `readFileSync('data/seasons.json')` and pass `seasons: data` to `createSandbox` (see `tools/gates/seasons.mjs mkSb`).
