# Chat 44D — Close phase 44: islands decision, funnel re-measure, S47, Bible, 45Z gate
Needs: 44A–44C · 40B funnel.mjs · tools/hero_shots.mjs      Blocked-by: 44C
Owned (only these files): src/Game.js + ui/index.js (`GAME_VERSION`/`UI_VERSION = 'S47'` only), docs/FUNNEL_BASELINE.md ("## 44D re-measure"), LUMEN/README.md ("## Readable market (44, S47)" paragraph), LUMEN_extras/Game_Bible S47.md (copy S46's structure), LUMEN_extras/README_pipeline.md (rows 44Z–44D + Next), API_CONTRACTS.md ("Pricing/Wants/Demand (44)" consolidated ≤ 8 lines if 44A–44C left gaps), HANDOFF_44D.md
Read (max 5 credits): START_HERE.md → HANDOFF_44Z.md → HANDOFF_44A/B/C.md "Missing" → this → FUNNEL_BASELINE.md "43D"

## Build in THIS order. wip.sh after EVERY file.
### P1 (≈ 12 credits)
- `node tools/check.mjs` ALL OK (fix only in 44A–44C-owned files if something regressed; ≤ 2 attempts, else record under Missing).
- `node tools/funnel.mjs --synthetic 20 --season 150 --quiet --out tools/shots/funnel_synthetic_44D.json` + `--compare` vs 43D → FUNNEL_BASELINE "## 44D" table. Hands ≥ 80 % and reach S2 ≥ 40 % → write **"45Z UNGATED"** in README_pipeline Next; else the blocker + suspected cause.
- **Islands decision** (MASTER_PLAN_V6 §3 "THEN islands"): record in HANDOFF_44D + Bible S47. Default **NO** — 17B+ stay frozen through the 2026-11-15 jam; 45 ships v3 on one island. Only overturn if the funnel shows S3 reach ≥ 40 % AND ≥ 10 chats of credit remain before Nov 12.
### P2 (≈ 10 credits)
- Versions S47 · Bible S47 (table 44Z–44D, §2 lines from HANDOFF_44Z "Rules that bite") · README paragraph · README_pipeline rows + Next (`… ~~44D~~ 45Z`).
- 2 hero shots if 44A–44C did not take them (`tools/hero_shots.mjs`, ≤ 6 credits total): price bubble + HOT sign → `LUMEN_extras/game/docs/screenshots/44_*.png`.
### P3
- `bash tools/itch_zip.sh` → zip builds; spot-check `data/seasons.json` `demand` rows load by relative path.

## Handoff `docs/HANDOFF_44D.md`: Done / Missing / Measured (funnel 44D vs 43D vs 42B) / Islands decision / Notes for 45Z (ship list: itch page copy from `game/docs/ITCH_PAGE.md`, SUBMISSION_CHECKLIST, trailer 13B + APK 14 standby decision).
