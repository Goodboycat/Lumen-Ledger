# LUMEN_extras — everything that is NOT needed to play or submit the game
Moved out of `LUMEN/` on 2026-10-21. Paths mirror the original layout (`game/...` ↔ `LUMEN/game/...`).
- `screenshots/` — reference + per-chat screenshots
- `README_pipeline.md` — the old multi-chat pipeline README (chain rules, Done table)
- `game/demo_*.html` — 20 standalone demos (copy into `LUMEN/game/` to run them; they import `src/`)
- `game/tests/`, `game/tools/` — headless checks, Playwright QA (qa_tutorial.mjs, qa_mobile.mjs…), QA shots, pipeline scripts
  (to run: copy `tests/` and `tools/` back into `LUMEN/game/`)
- `game/docs/` — HANDOFF_*.md, prompts/, plans, API_CONTRACTS, PERF, QA_MOBILE, audio prompts, doc screenshots · GAME_BIBLE.md, balance.md, story_outline.md, PLAY_BUGS.md (dev bug log), SUGGESTIONS.md (ideas list) — moved here 2026-10-26, not needed for the jam
