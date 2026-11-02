# HANDOFF 41B — Diegetic verb chain (DONE, minimal scope, user re-opened by name 2026-11-02)

## Done
- `src/systems/verbChain.js` (new, ~110 lines): `installVerbChain(lg) → lg.verbs`. Steps `move → coin → bonk → stall → deposit`.
  - move: hero ≥ 3 u · coin: `sb.dropTip` 2 u ahead, done when picked up · bonk: any sword swing (`combat:hit|combat:miss`), then 3 coins drop
  - stall: `build:placed stall_*` (non-silent) · deposit: `ui:jar:apply` (42B swaps this to "walk to Save jar, press E": edit only `SETUP/DONE.deposit`)
  - One hint chip `#verb-hint` (keycap + ≤ 40-char text), pulses at 10 s, auto-completes at 25 s with Owl toast "Later, then.". Skip chip `#verb-skip` bottom-right (44 px).
  - No overlay, no keydown swallowing, no `ui:pause`. **Season clock frozen** while the chain runs (wraps `sb.eco.tick`).
  - Old 10D gates `tut:move/build/jars` are marked fired when the chain starts (no duplicate nudges). `endSeason`/`upgrade` gates still run.
  - Persisted in `lg.story.state.verbStep` (-1 = done) → a mid-chain save resumes at that step; a done save never replays.
  - bus: `tut:step {id,index}` · `tut:done {seconds, skipped}` · `tut:skip {at}`. Hint text overridable via `story.json` `verbs: [{id, hint}]` (optional, not added yet).
- `src/Game.js`: 3 lines (import, `installVerbChain(lg)` after `installTutorialGates`, `lg.verbs?.update?.(dt)` in the unpaused tick).
- `index.html`: chain is the default first-run tutorial. Old 11-step overlay (`ui/tutorial.js`) only with `?oldtutorial`; `?notutorial` / `?autoplay` disable both.
- `tests/verbs.test.mjs` + `node tools/check.mjs --verbs` (3 tests: scripted chain ≤ 60 s with eco frozen then advancing; idle path → 5 × "Later, then."; skip / resume / destroy → 0 listeners).

## Activation rule (important for other checks)
Chain only auto-starts when `opts.verbs === true`, OR in a real browser (not headless, not domshim) with `opts.verbs !== false`, story mode, season 1.
This is why `--game` / `--telemetry` (domshim) are unaffected — verified ALL OK after the change.

## Missing (deliberately cut to stay small)
- No crate prop for `bonk` (any swing counts). No highlighted free build cell / pre-selected fruit stall in the tray. Hint is screen-fixed, not anchored to the target in 3D.
- `ui/tutorial.js` NOT deleted (kept behind `?oldtutorial`). `tools/qa_tutorial.mjs` not updated (tests the old overlay — run it with `?oldtutorial` if needed).
- `funnel.mjs --synthetic 20` not measured.

## Checked
`check.mjs --verbs` OK · `--game` OK · `--telemetry` OK · browser load of `index.html?nocine`: no JS errors.

## Notes for the integrator
- 41C: the S1 clock now starts at `tut:done` (eco is frozen before). 41D (save v2): serialize `story.state.verbStep` as `verbStep`.
