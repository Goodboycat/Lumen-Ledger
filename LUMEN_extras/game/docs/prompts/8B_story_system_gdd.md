# Chat 8B — Story system (pure JS) + GDD
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) incl. 8A + 4A
Owned (only these files): game/src/systems/story.js, game/docs/GDD.md, game/tests/story.test.mjs
Read (API_CONTRACTS): §B Story, Economy events
Export: exactly §B Story

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- StorySystem: loads story.json, onSeasonStart/End, next(), choose(i), emits story:line/lesson/end. Node test.
### P2 — should ship (≈ 25 credits)
- GDD.md (jam requirement): pitch, loop, FinLit mapping table, controls, art direction, scope, team/credits placeholder. 2–3 pages.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Branching on stars, endless mode text.

## Demo page `game/tests/story.test.mjs`
Node test walks 10 seasons.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs tests/story.test.mjs --shots --close`.

## Handoff `docs/HANDOFF_8B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
