# Chat 44C — Demand moves with the season: seasons.json `demand`, HOT/COLD sign tags, Owl names the hot stall
Needs: 43A seasonScript.js (`SS.for(season)`) · 44A sign tint · 44B PREFS read site · economy.stallInfo(id).fair      Blocked-by: 44B
Owned (only these files): data/seasons.json (`demand` on S2–S10 rows; S1 none), src/systems/seasonScript.js (`demandFor(season) → {stallId: mult}` ≤ 10 lines + validate: 0.3 ≤ mult ≤ 2, hot/cold ids differ from the previous season), src/systems/economy.js (`stallInfo().fair × demand` ≤ 8 lines, one place), src/systems/customers.js (PREFS weight × demand at read time ≤ 6 lines), stall sign HOT/COLD glyph (≤ 10 lines in 44A's sign module), data/story.json (`barks.demand[]` 3 templates "{what} season — they pay more"), tests/seasons.test.mjs (+1 test), tools/check.mjs (`--seasons` additive asserts)
Read (max 5 credits): START_HERE.md → HANDOFF_44Z.md → HANDOFF_44B.md "Notes" → this → seasonScript.js → economy.stallInfo → 44A sign module
Export (API_CONTRACTS "Demand (44C)", ≤ 5 lines):
  `seasons.json` row: `"demand": { "<stallId>": mult }` (one ≥ 1.3 = HOT, one ≤ 0.7 = COLD; endless rotates with the row).
  `SS.demandFor(season)` → map (empty for S1 / legacy). `economy.stallInfo(id).fair` is multiplied → mood thresholds + 43C critic rule follow for free.
  PREFS weights × demand at read time (floor 0.3 — Bible rule 4). Sign: HOT (▲ gold) / COLD (▼ blue) glyph next to the 44A tint.
  `eco:season` → Owl bark `barks.demand` once naming the HOT stall; bus `season:demand {season, hot, cold}`.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 (≈ 16 credits): `demand` rows S2–S10 + `demandFor` + validate; fair ×; `tests/seasons.test.mjs` +1; `--seasons` asserts.
### P2 (≈ 10 credits): PREFS × at read; sign HOT/COLD glyph; Owl bark + `season:demand`.
### P3: hero shot of a HOT sign → `screenshots/44C_hot.png`.

## check.mjs `--seasons` additive (sub-name `44C SEASON DEMAND`)
- `SS.demandFor(1)` = {} · `for(2..10)` each has exactly one mult ≥ 1.3 and one ≤ 0.7 · hot(S) ≠ hot(S-1) and cold(S) ≠ cold(S-1) incl. 10→11.
- S with `tea: 1.5`: `stallInfo('tea').fair` ×1.5; price unchanged → ratio drops → a `saver` at tea reacts `'love'`; elder PREFS tea 2.5 → 3.75 at read.
- `eco:season` → 1 `season:demand` + 1 Owl bark. Full `node tools/check.mjs` ALL OK.

## Budgets: sign glyph ≤ 1 sprite or DOM chip per stall; 0 new geometry.
## Content rules: demand is visible before it bites (sign at season start + Owl once). No PREFS weight ever reaches 0.
## Handoff `docs/HANDOFF_44C.md`: Done / Missing / Measured / Notes for 44D (funnel flags, which shots to take).
