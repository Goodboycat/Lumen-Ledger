# Chat 8A — Story data (JSON only)
Needs: GAME_BIBLE.md only
Owned (only these files): game/data/story.json, game/docs/story_outline.md
Read (API_CONTRACTS): §B Story shape
Export: story.json

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Seasons 1–5: opening / mid / ledger lines (Pip, Tally-Owl, Baron), 5 FinLit lesson cards (title, 2-sentence lesson, 1 tip), 3 Baron scam pitches with tells.
### P2 — should ship (≈ 25 credits)
- Seasons 6–10 + ending (lighthouse relit) + endless unlock text.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Alternate lines for 0–1 star vs 3 stars, 10 tutorial toasts.

## Demo page `game/docs/story_outline.md`
No page — validate with `node -e "JSON.parse(require('fs').readFileSync('data/story.json'))"`.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs docs/story_outline.md --shots --close`.

## Handoff `docs/HANDOFF_8A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
