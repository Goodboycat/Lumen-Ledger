# HANDOFF 44C — Demand moves with the season (2026-11-03, IN PROGRESS)

## Done
- (nothing yet — plan committed first, rule 11)

## Missing (plan, in build order)
- P1: `data/seasons.json` `demand` on S2–S10 rows (one ≥ 1.3 HOT, one ≤ 0.7 COLD, hot/cold differ from previous season incl. 10→11 rotate)
- P1: `seasonScript.js` `SS.demandFor(season)` → {stallKind: mult} ({} for S1 / legacy) + validate
- P1: `economy.stallInfo(id).fair × demand` (one place)
- P1: `tests/seasons.test.mjs` +1 · `check.mjs --seasons` additive "44C SEASON DEMAND"
- P2: `customers.js` PREFS weight × demand at read time (floor 0.3) via one helper
- P2: sign HOT ▲ / COLD ▼ glyph next to 44A tint (Game.js wireEconomy) · Owl `barks.demand` once on `eco:season` + bus `season:demand {season, hot, cold}`
- P3: hero shot `screenshots/44C_hot.png`
