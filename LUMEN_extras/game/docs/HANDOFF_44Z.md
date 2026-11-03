# HANDOFF 44Z — Plan phase 44 "Depth, only after S2 retention proves the loop" (2026-11-03, docs only, no code)

## Gate
MASTER_PLAN_V6 §4: 44Z is gated on `reach S2 ≥ 40 %`. `FUNNEL_BASELINE.md` "43D re-measure": reach S2 **100 %** (synthetic 20, 150 s seasons), Spark-through-hands 87.1 %. **Gate passed → phase 44 open.** (Caveat: synthetic script, not real itch telemetry — 45 re-measures with real players.)

## Why
Prices exist (`cust.setPrice`, B24 build-panel control) and 12 customer types have `PREFS` (customers.js:45) — but a player never SEES either. Mood is a colour pop after the sale; preferences are invisible; a stall nobody wants simply earns less with no explanation. Phase 44 makes pricing and the stall×customer fit **readable in the world** (barks/bubbles/signs — PLAN §6: no new modal), then lets `seasons.json` move demand so every season has a pricing decision. **Islands (17B+) stay frozen**: deadline 2026-11-15 is 12 days away; 44D decides formally, the default is NO.

## Phase table (the contract 44A–44D implement)
| ID | Deliverable (one line) | Owned files | Needs |
|---|---|---|---|
| 44A | **Readable pricing**: every customer's `react` state emits a price bubble (reuse 43C `story:bark {kind:'price'}`: ✓ fair / ♥ bargain / ✗ too dear, with the price, ≤ 2 on screen, 1 in 2 customers after S1); stall sign colour = price vs fair (green ≤ 0.9 · white ≤ 1.1 · amber ≤ 1.4 · red); Owl bark once after 3 angry at one stall ("Three walked off — drop the price a notch"); **in-world price change**: E on a stall sign → `+/−` (same `ui:price` event the build panel sends) | src/systems/customers.js (`_settle` emit ≤ 10 lines), ui/bark.js (3 glyph classes), src/world/props.js or stall sign module (sign tint ≤ 15 lines), src/Game.js (`sb.interact` → sign ≤ 12 lines), data/story.json (`barks.pricing[]` 3), tools/gates/pricing.mjs, check.mjs `--pricing` | 43C bark kind:'price', B24 `ui:price` |
| 44B | **Wants are visible**: a customer in `pickStall` shows a want glyph (its top `PREFS` stall icon, 1.2 s, reuse bark anchor); no stall for the want → `cust:left {result:'noStall', want}` + sad glyph; Owl bark once per missing want per season ("Elders want tea. Nobody sells tea."); build panel: a stall type shows "wanted by: elder, critic" (text from PREFS, no new DOM beyond one line) | src/systems/customers.js (`pickStall` want + noStall ≤ 20 lines), ui/bark.js (`kind:'want'` icon bubble), data/story.json (`barks.wants` template), ui/build.js (1 line), tools/gates/wants.mjs, check.mjs `--wants` | 44A |
| 44C | **Demand moves with the season** (data-driven): `seasons.json` row optional `demand: { tea: 1.5, toy: 0.6 }` → `economy.stallInfo(id).fair` × and `PREFS` weight ×; stall sign gets a HOT / COLD tag (sign tint from 44A + 1 glyph); Owl bark at season start names the hot stall ("Lantern season — they will pay more"); S2–S10 rows filled (one hot, one cold each, never the same two seasons in a row — 43Z gap rule extended); endless rotates with the row | data/seasons.json (`demand` rows), src/systems/seasonScript.js (`demandFor(season)` ≤ 10 lines), src/systems/economy.js (`fair` × ≤ 8 lines), src/systems/customers.js (PREFS × ≤ 6 lines), data/story.json (`barks.demand[]`), tests/seasons.test.mjs (+1), check.mjs `--seasons` additive | 44A 44B 43A |
| 44D | **Close phase 44**: islands decision recorded (default NO — Bible §6 stays frozen); funnel re-measure vs 43D (`--season 150`, synthetic 20) + 2 browser screenshots (price bubble, want glyph) via `tools/hero_shots.mjs` if credits allow; `GAME_VERSION/UI_VERSION='S47'`; `Game_Bible S47.md`; API_CONTRACTS "Pricing (44)"; README_pipeline rows 44Z–44D; **45Z UNGATED** if full check ALL OK and hands ≥ 80 % | docs, Game.js/ui/index.js version strings, FUNNEL_BASELINE.md | 44C |

## Rules that bite (Bible §2 candidates, 45Z collects them)
1. A price bubble is a reaction, never a prompt: ≤ 2 on screen, never blocks input, never pauses.
2. Every number the player can change (price) must be changeable **in the world** (E on the sign), the panel is the second way.
3. Demand multipliers are visible before they bite: HOT/COLD tag on the sign at season start, Owl says it once.
4. No stall type may be wanted by zero types in any season (`demand` cannot push a PREFS weight to 0; floor 0.3).
5. Phase 44 adds no modal, no new panel, no new ability.

## Notes for the integrator
- `story:bark {kind:'price'}` (43C) already renders `.ll-bark.price.ok|.bad`; 44A adds `.love` and makes the text glyph-first (`✓ 12`, not a sentence) — critics keep the full "fair 12 · yours 15" line.
- `cust.fair(stallId)` reads `economy.stallInfo(id).fair`; 44C multiplies there (one place) so mood thresholds (0.9 / 1.1 / 1.4) stay in ratio space and the 43C critic rule (`> fair×1.1`) follows automatically.
- `PREFS` weights are read in `_pickStall` (customers.js:224) — 44C multiplies at read time, never mutates the table.
- Stall sign mesh lives with the stall prop (S29–S31 upgrades); if there is no per-stall sign material handy, tint the price chip the build panel already draws and record it under Missing — do not build a new sign.
- Budgets: +0 draw calls for bubbles (DOM), sign tint = material colour change only, no new geometry.
- Credits: 43B/43C/43D each ran out before the demo page. Phase 44 prompts have **no demo page**; the gate + one hero shot in 44D is the visual proof.
