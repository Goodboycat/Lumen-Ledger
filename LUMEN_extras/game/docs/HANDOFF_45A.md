# HANDOFF 45A — Itch page + 6 ship screenshots (2026-11-03/04, two chats: 45A-1 harness + shots, 45A-2 docs + re-shoot)

## Done
- [x] P1 `tools/hero_shots.mjs --ship [n]` — boots the real `index.html` headless (Playwright 1280×720, `?mute&notutorial&nocine&season=600`), skips the title via `ui:start`, dismisses dialogue, hides the touch pad, forces each scene with `window.game` / `sb()` calls only (Ship rule 4), one `page.screenshot` per shot. `--ship 2,3` shoots a subset; `7` = cover only.
- [x] P1 Shots → `LUMEN_extras/game/docs/screenshots/45_ship/` (pass 3, 2026-11-04, `errors: none`):
  `1_title.png` (title open, 3 buttons) · `2_market.png` (S3 forced, 11 customers, 2 settled, HOT glyph `"hot"`) · `3_raid.png` (two distinct Collectors, states `seek`+`carry`, chip "CARRYING 8 — bonk it!") · `4_jar.png` (Pip 1.17 u from the Protect jar, `near:"protect"`, tag visible) · `5_ledger.png` (real `eco.endSeason()` report → Ledger Review modal open) · `6_pier.png` (state `pier`, phase `wait`, 19 s left) · `cover.png` 630×500 clip of the market frame.
- [x] P1 `ITCH_PAGE.md`: `[bracket]` names filled (team **Goodboycat**, engine **Three.js r160** vendored), "Good to know" + 3 S45–S47 bullets, §5 replaced by the real 6-file shot list with scene-forced column + itch captions, cover note.
- [x] P2 `ITCH_PAGE.md` §1 form fields: viewport 1280×720, fullscreen ON, mobile friendly ON, Embed in page, Game · Educational, tags `finlit economy 3d browser jam …`, cover/screenshot/trailer rows point at the 45_ship files.
- [x] P3 `ITCH_PAGE.md` §4 devlog seed — 5 player-facing lines for S44 (no stretch) / S45–S46 (one novelty per season) / S47 (readable prices · reacting customers · raidable tills), sourced from Game_Bible S44/S46/S47.
- [x] Fix found while framing: `?debug=0` is truthy for `params.has('debug')` → the fps·calls pill and the bottom-left stats line were in every pass-1/2 shot. Harness now passes no `debug` key at all; all 7 files re-shot. `node tools/check.mjs` → ALL OK after the harness edit.

## Missing
- Shot 3: `arrow:false` at capture time — the edge arrow only shows when the raider is off-screen; both Collectors were in frame, so the RAID chip is the visible threat cue (caption adjusted; no code touched).
- Shot 2: `priceBarks: 0` in pass 3 (2 barks landed but neither was a `.ll-bark.price` at the exact frame); the HOT glyph and the ♥/✓/✗ signs ARE in frame. If 45B wants a guaranteed price bubble, loop until `priceBarks ≥ 1` with a longer cap (20 × 1.5 s was not enough with 11 customers browsing).
- Shot 4: the tag that read back was `Save · 0 ✦` (nearest tag in DOM order) although `near` was `protect` — cosmetic in the harness readout only; the PNG shows Pip at the Protect jar.
- No GIF, no trailer (13B standby per 45Z).

## Measured
| shot | file | size | state at capture |
|---|---|---|---|
| 1 | 1_title.png | 246 KB | `titleOpen:true, btns:3` |
| 2 | 2_market.png | 638 KB | `customers:11, settled:2, barks:2, glyph:"hot"` |
| cover | cover.png | 114 KB | clip x325 y110 630×500 of shot 2 |
| 3 | 3_raid.png | 699 KB | `states:["seek","carry"], carry:true, chip:"CARRYING 8 — bonk it!"` |
| 4 | 4_jar.png | 555 KB | `near:"protect", dist:1.17` |
| 5 | 5_ledger.png | 441 KB | `open:true, modal:true`, rows Sales/Save interest/Invest/Expenses/Loan interest |
| 6 | 6_pier.png | 590 KB | `state:"pier", phase:"wait", left:19` |
Total 3.2 MB. Full `--ship` run ≈ 4 min 15 s wall, 7 screenshots.

## Notes for 45B
- Re-shoot command: `cd LUMEN/game && bash tools/setup_browser.sh && NODE_PATH=tools/node_modules node tools/hero_shots.mjs --ship` (setup ≈ 30 s when the apt libs are cached).
- The market frame carries a "BARON AT THE PIER — repay? · 17 s" chip plus `debt 300 / PAY 150` in the HUD even on a fresh `season=600` run because the pierPays flow arms at boot; harmless for the page but 45B's funnel run should confirm a real S1 does not show a pier countdown before the first bell (if it does → PLAY_BUGS row).
- Ledger shot shows all-zero rows at ~8 s of play (sales had not landed in `eco` yet — tills hold coins until collected, S47). For a richer ledger, 45B can collect tills first (`sb.tills?.collectAll?.()` if present) or wait ≥ 30 s; not worth a harness change for the page.
- Visual bugs seen in the shots: none blocking. Minor: the Owl/jar hint card ("FinLit Jars · walk to a jar by the cottage") overlaps the top-right of shot 2 — it is the live tutorial hint, acceptable.
