# HANDOFF 43D — S6 double raid, rotation S7–10 + endless, close phase 43 (2026-11-03, CLOSED, S46)

## Done
- `src/systems/novelties/raidDouble.js` — S6 @0.64 arms `sb.enemies.nextWaveOpts = { raiders: 2, distinct: true, stagger: 2 }`; the wave mark @0.66 spawns. Owl barks: start ("Two of them — shield one, chase the other"), both stalls named on the 2nd `raid:start`, "One down" on a defeat/drop. `end()` disarms if the wave never fired; `start` is re-entrant (no re-arm when `E.waveSeason === season`).
- `src/systems/enemies.js` — `spawnWave(season, opts)`: `opts.raiders` → N Collectors (no Baron), `_claimed[]` keeps `raidTargets` distinct, raider #k `stun = k*stagger` so telegraphs (1.2 s each) never overlap; `enemy:wave {raiders}`.
- `data/seasons.json` — S6 novelty row (`raidDouble`, novelty .62 / wave .66) re-tuned so the consecutive-mark gap rule holds across the S10→S11 wrap; S7–S10 rotation rows + `endless.rotate ["6".."10"]` verified; `tests/seasons.test.mjs` +1 (5 pass): `for(12).novelty.id === for(7).novelty.id`, lens 150 for 11..15.
- `story.js` — `state.noveltiesSeen[]` + `onNovelty` on `novelty:start {id,label}` → `hud:new` once per id. `ui/hud.js` `newChip(text, 4000)` + `.ll-chip-new` (hud.css, 4 lines). `story.json barks.seasonNew` ("NEW: {label}") + `barks.seasonNovelty.raidDouble[3]`.
- `save.js` — v3 (`novelty`, `noveltiesSeen`), `validate` migrates v1/v2, `applySnapshot` re-starts the active novelty mid-season; scheduler skips the novelty mark if that novelty is already active. `--save` ALL OK.
- `tools/gates/novelties43D.mjs` "43D RAID DOUBLE + ROTATION" wired into `check.mjs --novelties`; full `node tools/check.mjs` ALL OK.
- Funnel re-measure: `docs/FUNNEL_BASELINE.md` "## 43D re-measure" (`--season 150`, not 5 — see note there). `GAME_VERSION`/`UI_VERSION = 'S46'`.
- Close docs: API_CONTRACTS "Novelties (43D)", this file, `Game_Bible S46.md`, `LUMEN/README.md` "Season scripts (43, S46)", README_pipeline rows 43Z–43D + Next.

## Missing
- P3 `tools/itch_zip.sh` run — see "Notes" (done by the closing chat if the row below says so; otherwise 44Z/45Z runs it first).
- `demo_novelties.html` never built (43B/43C/43D all skipped it; a browser session of S2–S6 is the only visual check and none was taken this phase — 0 screenshots in 43A–43D).
- Browser verification of the NEW chip, raidDouble's two staggered telegraphs and the Baron bark portrait is still outstanding (headless gates only).
- `economy.js` orphan `tooGoodLoan` fallback scam (43C note) still present.

## Measured
- Funnel 43D vs 42B (synthetic 20, 150 s seasons): reach firstStall/firstSale/firstCoin/S2/S3 = **100 % each (Δ 0)**; Spark-through-Pip's-hands **87.1 % vs 87.6 %** (−0.4, noise: S2 storm absorbs one event, S3 night market doubles spill); modalSeconds 0–90 s = 0.0. **reach S2 100 % ≥ 40 % → 44Z UNGATED.**
- Gate: S6 wave → 2 Collectors in `raid`, distinct `targetStallId`, second one dazed 2 s; bonk one → `recovered`; `novelty:end` at season end. NEW chip ×1 across S3 + S7 (nightMarket). Save mid-S3 → load → `start` called again, `noveltiesSeen` preserved.

## Suspected
- Two staggered telegraphs are beatable headlessly; whether a first-time player reads "shield one, chase the other" in time is unmeasured (no playtest). If S6 deaths spike, raise `stagger` to 3 s in `RAID_DOUBLE` — one constant.
- The rotation gives S11+ the S6 row first (double raid every 5th season forever); if endless feels samey, shuffle `endless.rotate` per run (seeded) — `SS.for` is the only reader.

## Notes for the integrator (44Z / 45Z)
- **44Z gate decision: UNGATED** (reach S2 100 %). Proceed with 44Z planning.
- 45Z: Bible §2 lines added by phase 43 — (1) one novelty per season, never two; (2) consecutive season marks never equal, min gap holds across the S10→S11 wrap; (3) two raiders must be beatable with one shield + one sword → telegraphs staggered ≥ 2 s, never simultaneous; (4) NEW chip is non-modal, 4 s, once per novelty id per run; (5) novelties re-enter cleanly on load (registry ends the previous one first).
- `hud:chip {id,text,on}` (43C) and `hud:new {id,text}` (43D) are the two generic HUD hooks; no new DOM for future chips.
- itch.io: `index.html` loads `data/seasons.json` and `data/story.json` by relative path (`fetch('data/...')`) — keep it that way, itch serves from a subfolder.
