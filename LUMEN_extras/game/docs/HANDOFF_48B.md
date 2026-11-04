# HANDOFF 48B — Bark diet + no bubble over Pip's head (2026-11-04, CLOSED)

## Done
- [x] P1 `ui/bark.js`: `anchor:'hero'` dropped; unresolved anchor (owl/baron not bound, undefined object) dropped — the fixed-bottom fallback bubble branch is deleted; `mountBarks(root, {max:1, gapS:6})` → 1 word bubble + ≥ 6 s gap; glyph pool stays 2 (D4: glyphs are not text).
- [x] P1 `src/Game.js`: `bus.on('jars:locked' … story:bark)` line deleted (jar wobble in jarsWorld.js is the feedback).
- [x] P1 `data/story.json` `barks.walkIn` 7 → 2 (first + last kept). 3 demand/wants barks trimmed to ≤ 60 chars.
- [x] P1 `src/systems/story.js` `bark()`: every word bark id plays once per run via `state.barksPlayed` (pricing/wants/demand stay repeatable).
- [x] P2 `tools/checks/barks.mjs` block `48B BARK DIET`: hero → 0 bubbles · owl-before-bind → 0 · two word barks 1 s apart → 1 · walkIn.length === 2. Data loop skips non-line entries (`wantsWho` name map) — pre-existing latent bug.
- [x] P3 grep audit: novelties (raidDouble, stormWarning, pickyGlimmer…) use `'owl'`; scamNpc/baronPier/verbChain use `{x,y,z}`; the only `'hero'` string left is the bark.js header comment. No anchor fixes needed.

## Missing
- nothing. `node tools/check.mjs --barks --story --quiet` → 0 FAIL.

## Next chat
`bash tools/next.sh` → 48C (semi-transparent warnings + icon art + glimmer blue). Also user-reported: lighthouse referenced in dialogue but absent in world; Settings → Title / Restart season do nothing (see PLAY_BUGS 48B-1/48B-2).
