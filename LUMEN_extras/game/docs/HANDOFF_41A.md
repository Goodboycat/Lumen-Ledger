# HANDOFF 41A — Opening 9 lines → 2 barks over the walk-in (COMPLETE except real-browser measurement)

## Done (all pushed to origin/main)
- `data/story.json`: `seasons[0].opening` 9 → 2 lines; `barks.walkIn` (7 lines ≤ 60 chars, at 0.6–8.8 s); `barks.firstCoin/firstStall/firstDeposit` (1 line each). (f461a21)
- `src/systems/story.js`: kind `bark` — `bark(line, group)`, `barkGroup(name, sub)`, timed timers via `update(dt)`, one-shots on `eco:spark tip:*` / `build:placed stall_*` / `jars:deposit`, `state.barksPlayed` serialized. (76b61c2)
- `ui/bark.js` + `ui/bark.css`: `mountBarks({bus, camera, container, worldToScreen})` — projected DOM bubbles, max 2, ttl 3.2 s, viewport clamp, aria-live polite; mounted in `ui/index.js`, anchors bound in `index.html`. (a4c67f9)
- `tools/check.mjs --barks` → `tools/checks/barks.mjs` (section `41A BARKS`). (f1a8d5e, 3658b31)
- **P2** (5cd0480): `seasons[n].mid` lines fire as barks at day01 ≥ 0.5 (first immediately, rest +3.4 s; `opts.midModal` restores the dialogue group). Openings S2–S10 trimmed to narrator title + 1 Owl line; the cut lines live condensed in `barks.seasonStart[n]` (33 lines ≤ 60 chars, at 0.8/4.2/7.6/11.0 s) and fire after the opening group closes. `tests/story.test.mjs` (59 pass) and `check.mjs --story` walk updated.
- `check.mjs --game`: S1-opening assert used the stale `/Season 1/` regex (from the 9-line opening) → now `speaker === 'owl'`. `--game` passes again.
- **P3**: `src/core/Audio.js` `'story:bark'` → speaker voice hum (`VOICE_SFX[speaker] || dlg_blip`, vol 0.45, cooldown 0.25, no duck). `--audio` passes.

## Measured (synthetic regression harness, `node tools/funnel.mjs --synthetic 20`)
`tools/funnel.mjs --compare tools/shots/funnel_synthetic_2026-11-02.json tools/shots/funnel_synthetic_41A.json`:
firstStall 30.03 → 30.03 s · firstSale 7.42 → 7.19 s · s2 150.5 → 150.2 s · s3 300.8 → 300.3 s · **modalSeconds 0.1 → 0.0** (mid modal gone). No balance change.
Real-browser modalSeconds (human reading speed) still unmeasured — needs `play.mjs --script funnel` (Playwright) or the itch build; see FUNNEL_BASELINE.md.

## Not done / open
- [ ] `LUMEN_extras/game/demo_barks.html` (keys 1–4 fire walkIn / firstCoin / mid / seasonStart) — nice-to-have, the `--barks` gate covers the logic headless.
- [ ] Real-browser screenshot of a bark bubble over Pip during the walk-in (hero_shots.mjs) for the itch page.
- [ ] 41B diegetic tutorial should emit `story:bark {speaker, text, anchor, ttl}` instead of overlay text (prompt: `docs/prompts/41B_diegetic_tutorial.md`).

## Suspected
- none. All gates run this chat: `--story --barks --game --audio` → ALL OK.

## Notes for the integrator
- Bark anchors: `'hero'|'owl'|'baron'|{x,y,z}`; speaker → default anchor pip→hero, owl→owl, baron→baron, others→hero.
- `barkGroup(name, sub)` keys `barksPlayed` as `name:sub` so each season's `seasonStart` fires once per save.
