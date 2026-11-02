# HANDOFF 41A — Opening 9 lines → 2 barks over the walk-in

## Done
- `data/story.json`: `seasons[0].opening` cut 9 → 2 lines; `barks.walkIn` (7 lines, ≤ 60 chars, at 0.6–8.8 s — walk-in cinematic is ≤ 9 s via `CINE.arrivalMax`), `barks.firstCoin/firstStall/firstDeposit` (1 line each). (previous chat, commit f461a21)

## Missing (plan — tick as they land)
- [ ] `src/systems/story.js`: kind `bark` — on `game:start {resumed:false}` schedule `barks.walkIn` by `at` using `update(dt)`; one-shot groups on `eco:spark reason tip:*` (firstCoin), `build:placed stall_*` (firstStall), `jars:deposit` (firstDeposit); `state.barksPlayed` serialized.
- [ ] `ui/bark.js` + `ui/bark.css`: `mountBarks({ bus, camera, container, worldToScreen }) → { bind, update(dt), destroy() }`; DOM bubble, projected from hero/owl/baron anchor, ttl 3.2 s, max 2, pointer-events none, aria-live polite, clamps in viewport.
- [ ] `ui/index.js`: mount + destroy + update lines; `Game.js`/`index.html` bind anchors (camera, hero, owl, baron getters).
- [ ] `tools/check.mjs --barks` (section `41A BARKS`).
- [ ] `demo_barks.html` (LUMEN_extras/game) keys 1–4.
- [ ] P2: `seasons[n].mid` → bark; openings 2–10 trimmed to ≤ 2 → `barks.seasonStart[n]`.
- [ ] P3: audio `bark` event.

## Measured
- (pending) modalSeconds(0–90 s) before/after via `funnel.mjs --synthetic 20`.

## Suspected
- none yet

## Notes for the integrator
- 41B hints should emit `story:bark {speaker, text, anchor, ttl}`; anchors: `'hero'|'owl'|'baron'|{x,y,z}`. Speaker → default anchor: pip→hero, owl→owl, baron→baron.
