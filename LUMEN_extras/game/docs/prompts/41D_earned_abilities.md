# Chat 41D — Two abilities at start, four earned by stars
Needs: 3B abilities · 10B `sb.ability` · 7B ledger · 10D save · 41C      Blocked-by: 41C
Owned (only these files): src/Game.js (`ABILITY_UNLOCKS` table + gate in the Q/W/E/R/F/G wiring, ≤ 40 lines), src/systems/save.js (`SAVE_VERSION` 2, field `abilities:string[]`, migrate v1 → start set), ui/hud.js (ability chips: 6 slots, locked = dimmed + ★ cost), ui/ledger.js ("NEW ABILITY" card after the stars count-up), data/story.json (`abilityUnlock` 4 lines), check.mjs (additive `--unlocks`)
Read (max 6 credits): START_HERE.md → MASTER_PLAN_V6.md §0, §5 → this → Game.js 478 (ABILITY_KEYS) + 707–760 (installRunWires ability part) → ui/ledger.js header → save.js header → heroAbilities.js FINLIT table (names + key + lesson text)
Export (API_CONTRACTS "Unlocks (41D)", ≤ 5 lines):
  `ABILITY_START = ['coinMagnetDash','bubbleShield']` · `ABILITY_UNLOCKS = [{ id:'growthStomp', stars:3 }, { id:'ledgerFlash', stars:6 }, { id:'haggleShout', stars:9 }, { id:'fogSweep', stars:12 }]` (cumulative ★ over the run; 3 ★ per ledger max → one unlock per perfect season, S4 at worst-case pace)
  `sb.abilities: Set<string>` (unlocked) · `sb.ability(name)` returns `'locked'` when not unlocked (no effect, HUD chip shakes) · bus `ability:unlock {id, stars}` · `eco.state.starsTotal` (sum of ledger stars; add in Game.js from `eco:season`, not in economy.js)
  save v2: `{ abilities:[...], starsTotal }`; v1 → `ABILITY_START` + starsTotal 0.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 20 credits)
- `Game.js`: `sb.abilities = new Set(ABILITY_START)`; the key wiring checks it; on `eco:season {report}` add `report.stars` to `starsTotal`, unlock every `ABILITY_UNLOCKS` row now reached (in order, max one per season so each ledger can show one card), emit `ability:unlock`. The S1 Collector (41C) + tills (42A) are what make the two starters matter: dash collects, shield absorbs.
- `ui/ledger.js`: after the stars count-up, if an `ability:unlock` arrived for this review, show a card "NEW ABILITY — <name> [<key>]" with the FINLIT one-liner from heroAbilities (lesson text already exists) — the ledger becomes a reward screen. CONTINUE unchanged.
- `ui/hud.js`: six chips in key order; locked chips dim with "★3" etc.; unlocked pop (existing coin-pop CSS); pressing a locked key shakes the chip (no toast).
- `save.js` v2 + migration + `describe()` prints the ability count. `applySnapshot` restores `sb.abilities`.
- `check.mjs --unlocks` (below).
### P2 — should ship (≈ 10 credits)
- Touch pad (7C): the 3 hold-able buttons map to attack / dash / shield only; earned abilities appear as small chips above the pad as they unlock (ui/touch.js ≤ 15 lines, allowed).
- `story.json abilityUnlock[id]`: one Owl bark per unlock ("Stomp when the market is quiet — growth takes time."), fired via 41A barks on `ability:unlock` when the review closes.
### P3 — nice to have (≈ 5 credits)
- Endless mode: all six unlocked (endless is a post-win playground).

## Demo page: none — `index.html?debug` prints `abilities` + `starsTotal`.

## check.mjs section `--unlocks` (additive; name it `41D UNLOCKS`)
- fresh sandbox: `sb.abilities.size === 2`; `sb.ability('growthStomp') === 'locked'`, no `vfx` call, no cooldown set.
- feed `eco:season` reports with stars 3, 3, 3, 3 → unlock order growthStomp (3), ledgerFlash (6), haggleShout (9), fogSweep (12); 4 `ability:unlock` events; a 2-star season unlocks nothing.
- save v2 round-trip keeps the set; a v1 snapshot migrates to the 2 starters; `ledger` mock shows the card once per unlock.

## Budgets: 0 meshes. HUD chips are DOM.
## Content rules that bite here: an unlock names the *action* it rewards ("3 ★ ledger"), never a Spark price; locked keys do nothing silently harmful (no accidental cooldown burn).
## Handoff `docs/HANDOFF_41D.md`: Done / Missing / Measured (`funnel.mjs --synthetic 20`: abilities used in S1–S2 — target ≥ 1) / Suspected / Notes for the integrator (42A: dash is the collect verb; 42C: shield protects the till you stand at).
