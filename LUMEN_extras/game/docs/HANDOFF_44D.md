# HANDOFF 44D — Close phase 44 (2026-11-03, chats 44D-1 + 44D-2)

## Done
- [x] P1 `node tools/check.mjs` → ALL OK (no regressions in 44A–44C files).
- [x] P1 Funnel re-measure: `tools/shots/funnel_synthetic_44D.json` + `--compare` vs 43D → `docs/FUNNEL_BASELINE.md` "## 44D re-measure". Reach S2 100 % ≥ 40 %, Spark-through-hands 86.3 % ≥ 80 % → **45Z UNGATED** written in `README_pipeline.md` "## Next".
- [x] P1 Islands decision: **NO** (see below).
- [x] P2 `GAME_VERSION`/`UI_VERSION = 'S47'` (src/Game.js, ui/index.js).
- [x] P2 44A/44B/44C "Missing" closed: `tools/hero_shot_44.mjs` → `screenshots/44_hot_sign.png`, `44_hot_sign_before.png`, `44_price_bubble.png`; the HOT/COLD glyph was measured floating 0.43 u above the awning and moved to `(0.56, −0.32, 0.1)` beside the board; `ui/build.js` stall detail "HOT/COLD this season ×m" via `api.demandOf`.
- [x] P2 `LUMEN_extras/Game_Bible S47.md` (table 44Z–44D, player-facing summary, §2 rules 1–5 from HANDOFF_44Z, measured, islands, gates).
- [x] P2 `LUMEN/README.md` "## Readable market (44, S47)" paragraph · `README_pipeline.md` row 44D (44Z–44C rows were already there).
- [x] P3 `bash tools/itch_zip.sh` → `/tmp/LumenLedger_itch.zip` 9.7 MB / 336 files, `index.html` at zip root, `data/seasons.json` included and fetched by relative path (`fetch('./data/seasons.json')`) → loads on itch.

## Missing
- API_CONTRACTS "Pricing/Wants/Demand (44)" consolidation not needed — 44A/44B/44C each wrote their own section (`## Pricing (44A)`, `## Wants (44B)`, `## Season demand (44C)`); no gaps found.
- Real-browser funnel (`play.mjs --script funnel`) still not run; all funnel numbers are the synthetic headless player. Real-human reach-S2 needs itch telemetry (`?telemetry=<url>`) — 45Z decides whether to wire a free endpoint.
- Touch long-press on a sign (hold E = −1) unverified on a device (44A Missing carried).

## Measured (funnel 44D vs 43D vs 42B, synthetic 20, 150 s seasons)
| metric | 42B | 43D | 44D |
|---|---|---|---|
| reach firstStall / firstSale / coinInHand / S2 / S3 | 100 % | 100 % | 100 % |
| firstSale median | 7.19 s | 7.19 s | 7.10 s |
| Spark through Pip's hands | 87.6 % | 87.1 % | **86.3 %** |
| modalSeconds 0–90 s | 0.0 | 0.0 | 0.0 |
Δ −0.8 pt hands = 44B `noStall` leaves + 44C COLD kinds selling less → a bit more Spark arrives via trickle/event. Within noise; gate holds.

## Islands decision (MASTER_PLAN_V6 §3 "THEN islands")
**NO.** 17B–17E / 18Z–30Z stay frozen through the 2026-11-15 jam; phase 45 ships v3 on the one island. Overturn condition (real reach S3 ≥ 40 % AND ≥ 10 chats of credit before Nov 12) not met: only synthetic data exists and credits are short. Revisit after the jam, not before.

## Notes for 45Z (ship phase plan)
Ship list, in order:
1. **Itch page**: copy from `game/docs/ITCH_PAGE.md` (fill the `[bracket]` names, 6 screenshots — `LUMEN_extras/game/docs/screenshots/44_*.png` + earlier hero shots cover 3; need title, ledger, raid).
2. **Zip**: `bash tools/itch_zip.sh` (already green; 9.7 MB — mostly `vendor/` three.js + audio; fine for itch's 1 GB limit). Itch settings: HTML, "This file will be played in the browser", viewport 1280×720, fullscreen button on, mobile friendly on (11B QA).
3. **SUBMISSION_CHECKLIST.md**: walk the 10 quality gates; record each as ✅/❌ with the date.
4. **Trailer 13B / APK 14**: standby — decide at 45Z by remaining credits; default skip (jam deliverable is the HTML5 build + page).
5. **Telemetry**: optional `?telemetry=<url>` beacon to a free endpoint so the first real reach-S2 number exists before the jam closes.
6. 45Z should keep "no new systems" — phase 45 is polish + ship: title screen footer `S47`, loading screen, one playtest pass with `PLAY_BUGS.md`.
