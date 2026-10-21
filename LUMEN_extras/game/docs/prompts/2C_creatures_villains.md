# Chat 2C — Creatures: Baron Gilt & Fog Collectors
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) + 2A work (already in the folder) if available
Owned (only these files): game/src/assets/creatures/villains.js, game/demo_villains.html
Read (API_CONTRACTS): §A glimmer.js, Sequencer, SquashStretch, VFX · §B Creatures
Export: `makeBaronGilt()`, `makeFogCollector(variant 0..2)`, `VillainAnimator(root)` with strut/taunt/offerDeal/flee/slipOnCoin/fogPuff

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Baron Gilt: tall purple blob lord, gold top hat, monocle, cane, cape, coin-purse belt. Comic, pompous — never scary. strut (loop) + taunt (hat tip 700 ms).
### P2 — should ship (≈ 25 credits)
- 3 Fog Collectors (fat/tall/tiny, clerk visors, clipboards, sacks). offerDeal (scroll 600), flee (fast waddle + sweat drops).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- slipOnCoin (comic fall 900 ms, hit-stop 60), fogPuff (purple spheres from cane via small pool).

## Demo page `game/demo_villains.html`
Baron + 3 collectors; keys cycle anims.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_villains.html --shots --close`.

## Handoff `docs/HANDOFF_2C.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
