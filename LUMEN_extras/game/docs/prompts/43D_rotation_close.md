# Chat 43D — S6 double raid, rotation S7–10 + endless, close phase 43
Needs: 43A–43C · 42C enemies.js raid FSM · 41D unlocks (ledger NEW card pattern) · 40B funnel.mjs      Blocked-by: 43C
Owned (only these files): src/systems/novelties/raidDouble.js (new), src/systems/novelties/index.js (1 line), src/systems/enemies.js (`spawnWave(season, {raiders:2})` option ≤ 10 lines), data/seasons.json (S6–S10 + endless rows verified), data/story.json (`barks.seasonNovelty.raidDouble[]` 3 · `barks.seasonNew` 1 generic line), ui/hud.js + hud.css (`NEW` chip ≤ 15 lines, non-modal, 4 s), src/systems/save.js (≤ 5 lines: `novelty` id in snapshot → resume calls `start` again), src/Game.js (GAME_VERSION/UI_VERSION → `S46`), docs/FUNNEL_BASELINE.md (new section), tools/check.mjs (`--novelties` additive), LUMEN_extras/README_pipeline.md (rows 43Z 43A 43B 43C 43D), LUMEN/README.md (phase 43 paragraph), Game_Bible S46.md
Read (max 6 credits): START_HERE.md → HANDOFF_43Z.md → HANDOFF_43C.md "Notes" → this → enemies.js spawnWave + raid target pick → save.js snapshot shape → funnel.mjs usage header
Export (API_CONTRACTS "Novelties (43D)", ≤ 6 lines):
  `raidDouble`: S6 wave spawns two Collectors that pick **two different tills** (enemies.js `raidTargets` excludes the one already claimed); Owl bark "Two of them — shield one, chase the other"; HUD raid chip shows both.
  Rotation: seasons.json S7–S10 reuse novelties (table in HANDOFF_43Z); `endless.rotate` cycles S6→S10 rows; `SS.for(11+)` → rotate[(s-6) % 5] with `len 150`.
  `hud.newChip(text)` 4 s "NEW: Night market" on every `novelty:start` (first time per id only; `story.state.noveltiesSeen[]` saved).
  Save v3: `{ …v2, novelty: id|null, noveltiesSeen[] }`; load → if mid-season and `novelty` set → `start(sb, season)` re-entrant (43C note).

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 20 credits)
- `raidDouble.js` + enemies.js two-target option; `seasons.json` S6 novelty row wired; `--novelties` asserts.
- Rotation + endless verified by `tests/seasons.test.mjs` (43A file — add 1 test, allowed) and `--seasons`.
- `hud.newChip` + `noveltiesSeen` in story state; save v3 with migrate (v2 → `novelty:null`, `noveltiesSeen:[]`); `--save` ALL OK.
### P2 — should ship (≈ 12 credits)
- Close phase 43: README_pipeline Done rows for 43Z–43D; LUMEN/README.md "## Season scripts (43, S46)" paragraph; `GAME_VERSION='S46'`; `Game_Bible S46.md` (copy S44's structure); `HANDOFF_43D.md`.
- `node tools/funnel.mjs --synthetic 20 --season 5 --out tools/shots/funnel_synthetic_43D.json` → `docs/FUNNEL_BASELINE.md` "## 43D" table vs the 42B numbers. If `reach S2 ≥ 40 %` write **"44Z UNGATED"** in README_pipeline Next; else write the blocker and the suspected cause.
### P3 — nice to have (≈ 5 credits)
- `bash tools/itch_zip.sh` → confirm `lumen-ledger-web.zip` builds and index.html loads `data/seasons.json` by relative path (itch.io serves from a subfolder: never absolute `/data/...`).

## Demo page: none (uses 43B's demo_novelties if present, key 6).

## check.mjs section `--novelties` (additive asserts; sub-name `43D RAID DOUBLE + ROTATION`)
- headless S6 wave → 2 Collectors in `raid` with different `targetStallId`; bonk one → `recovered`; season end → `novelty:end`.
- `SS.for(7).novelty.id === 'nightMarket'`, `SS.for(12).novelty.id === SS.for(7).novelty.id`, `for(11..15)` lens all 150, consecutive-mark rule still holds across 10→11.
- `novelty:start` → `hud.newChip` called once per id across two seasons with the same novelty (S3 + S7 nightMarket → 1 chip); save/load mid-S3 → `start` called again, `noveltiesSeen` preserved.
- Full `node tools/check.mjs` (all flags) ALL OK before closing.

## Budgets: second Collector ≤ 12 dc · NEW chip DOM only.
## Content rules that bite here (Bible §2): two raiders must still be beatable with one shield + sword (telegraph 1.2 s each, staggered by 2 s — never simultaneous).
## Handoff `docs/HANDOFF_43D.md`: Done / Missing / Measured (funnel 43D vs 42B, reach-S2 %) / Suspected / Notes for the integrator (44Z gate decision, 45Z: Bible §2 lines added by 43).
