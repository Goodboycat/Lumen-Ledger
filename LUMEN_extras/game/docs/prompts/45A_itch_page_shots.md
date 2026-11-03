# Chat 45A — Itch page + 6 ship screenshots
Needs: 44D      Blocked-by: 45Z
Owned (only these files): tools/hero_shots.mjs (`--ship` script; reuse `tools/hero_shot_44.mjs` boot/frame), game/docs/ITCH_PAGE.md, LUMEN_extras/game/docs/screenshots/45_ship/{1_title,2_market,3_raid,4_jar,5_ledger,6_pier}.png + cover.png (630×500), HANDOFF_45A.md
Read (max 5 credits): START_HERE.md → HANDOFF_45Z.md → this → ITCH_PAGE.md §1 §5 → hero_shot_44.mjs (skim boot/frame only)
Export (API_CONTRACTS): none — docs + screenshots only.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 20 credits)
- `tools/hero_shots.mjs --ship [n]`: boots `index.html` headless at 1280×720 (`bash tools/setup_browser.sh` once, Playwright), `?debug=0&mute`, skips title via `window.game` → `ui:start`, then per shot: 2 market — force S3 (`sb.seasons`/`eco.state.season=3`, `eco:season`), wait ≥ 2 customers settle, ≥ 1 `.ll-bark.price` + HOT glyph visible · 3 raid — `enemies.spawnWave(6,{raiders:2,distinct:true})`, wait for `carry` + red RAID chip + edge arrow · 5 ledger — `eco.endSeason()` → review modal · 6 pier — enter `'pier'` state with ≥ 10 s left on the `pier:tick`. One PNG per shot, ≤ 6 browser screenshots total; commit each PNG as it lands.
- `ITCH_PAGE.md`: fill the 2 `[bracket]` names (team = "Goodboycat", engine credit three.js r1xx from `vendor/`); §5 shot list → the 6 file names above; "Good to know" + 3 S45–S47 bullets (seasons each add one novelty; prices readable ♥/✓/✗ + HOT/COLD sign; tills can be raided — collect your coins).
### P2 — should ship (≈ 8 credits)
- 1 title + 4 jar shots (Pip ≤ 1.3 u from the Protect jar, `.ll-jar-tag` visible). Cover 630×500: crop of `2_market.png` via the Playwright page `canvas` (`page.screenshot({clip})`), no new art.
- ITCH_PAGE §1 "Form fields": viewport 1280×720, fullscreen button ON, mobile friendly ON, "Embed in page", classification Game · Educational, tags `finlit`, `economy`, `3d`, `browser`, `jam`.
### P3 — nice to have
- GIF-free "devlog seed" §4: 5 lines on what S40–S47 changed for the player (from Game_Bible S44/S46/S47 "What the player sees").

## Demo page: none — screenshots are the proof.
## check.mjs section: none (no code change). Run `node tools/check.mjs --game` once to prove nothing regressed from the harness edit.
## Budgets: 6 browser screenshots, 0 video. If `setup_browser.sh` fails twice → record under Missing, finish ITCH_PAGE text, stop.
## Content rules that bite here: Ship rule 1 (relative paths; the shots come from `index.html`, not a demo page) · Ship rule 4 (no system added while framing a shot — only `window.game` calls).
## Handoff `docs/HANDOFF_45A.md`: Done / Missing / Measured (shot list → files, what each shows) / Notes for 45B (which scene forced what; any visual bug seen → PLAY_BUGS row ids).
