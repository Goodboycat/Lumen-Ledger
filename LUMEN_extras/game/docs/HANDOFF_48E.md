# HANDOFF 48E — Jars are buildables (2026-11-04, CLOSED)

## Done
- [x] P1 `economyData.js` 4 catalog rows `jar_spend/save/invest/protect` (`category:'jar'`, cost 0, upkeep 0, 1×1, same props as old `JAR_IDS`) · `build.js` `owned()` makes jars unique (2nd `jar_save` → `canPlace false`, reason `duplicate`) · `ui/build.js` `CATEGORY_LABELS.jar = 'Jars'` is the FIRST tab, placed jar card wears ✓ not a level.
- [x] P1 `Game.js`: the `JAR_IDS.forEach(place …)` line is gone (no floating jar at (-8+i,3)); `W.jars = []`; `build:placed jar_*` → `jarsWorld.register` + `ui.jars.show`; `build:removed` → `unregister` + `hide`.
- [x] P1 `jarsWorld.js` `get(key)` / `unregister(key)` (balance → pouch in ONE place, DOM tag removed, `jars:removed {jar}`); `deposit` to an unregistered key → 0; consumers (`verbChain` Save lantern, `protectBark`, lanterns, `ui:jar:auto`) null-guarded.
- [x] P1 `ui/jars.js`: rows hidden until built, `show/hide`, no jars → panel collapsed + hidden entirely.
- [x] P2 `save.js` v4 (`synthesizeLegacyJars` on parse < v4, `snapJarsToLand` in `applySnapshot`) · `tests/save.test.mjs` 7 pass, wired into `--save`.
- [x] P2 `ui/jars.css` ≤ 700 px: body `overflow-y:auto` + bottom fade mask + 6 px chevron `::after`, hidden by `.scrolled/.collapsed/.empty` (one passive scroll listener). No words.
- [x] P2 gate `tools/gates/jarsworld.mjs` `48E JAR BUILDABLES` (place ×4, duplicate, deposit 10 → demolish → pouch +10 → re-place 0, no Protect jar → `eco:event` silent). API_CONTRACTS §jars 48E export added by the closing chat.
- `node tools/check.mjs --jarsworld --build --save --game --verbs` → ALL OK ✅ (verified by the closing chat).

## Missing
- P3 jar ghost showing the fill liquid at 0 / wobble on place: not done (cosmetic; `build.js` ghost uses the catalog prop as-is).
- `verbChain.js:43` comment still says `W.jars[1]` (code uses `jarsWorld.get('save')`) — comment only.

## Next chat
`bash tools/next.sh` → 48F (curiosity tutorial, DEEP). PLAY_BUGS 48B-2 (Settings → Title / Restart season) and 48D-1 (5 pre-existing flaky sims) still open.
