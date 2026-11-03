# Chat 43C — Novelties: S4 Baron in person, S5 picky Glimmer
Needs: 43B (registry) · 42D baronPier.js (makeBaron, strut/taunt/offerDeal) · 42D scamNpc.js · 7B dialogue portraits · customers.js types      Blocked-by: 43B
Owned (only these files): src/systems/novelties/baronVisit.js (new), src/systems/novelties/pickyGlimmer.js (new), src/systems/novelties/index.js (2 registry lines), src/systems/customers.js (type `critic` gets `priceCheck` ≤ 15 lines; a spawn-one-of-type API `spawnType(type)` ≤ 8 lines if missing), data/story.json (`barks.seasonNovelty.baronVisit[]` 3 · `pickyGlimmer[]` 3 · `baron.visit` pitch 2 lines with `tell`), ui/bark.js (price-check bubble variant `kind:'price'` ≤ 10 lines), tools/gates/novelties.mjs (additive section), tools/check.mjs (`--novelties` grows)
Read (max 6 credits): START_HERE.md → HANDOFF_43Z.md → HANDOFF_43B.md "Notes" → this → baronPier.js (Baron spawn/walk reuse) → scamNpc.js (offer/talk/refuse/tell flow) → customers.js type table (lines 60–70) + buy decision → ui/bark.js
Export (API_CONTRACTS "Novelties (43C)", ≤ 6 lines):
  `baronVisit`: at `at` (S4 0.64) the Baron himself (non-hostile, reuse 42D makeBaron path) struts to the plaza centre, `taunt`, and **replaces the scam mark**: `sb.interact()` near him → `eco.offerScam('tooGoodLoan')` + pitch barks with the Baron portrait (7B) → `ui:choice` as today; Ledger Flash ≤ 3 u → `scam:tell`; sword hit → `slipOnCoin` + refuse + flee; 25 s → refuse. S4's scam row in seasons.json is `scamKind:'baron'` → scheduler skips scamNpc that season.
  `pickyGlimmer`: at `at` (S5 0.20) `cust.spawnType('critic')` ×2 over the season; a critic walks to a stall, shows a **price-check bubble** (`bark kind:'price'`: "fair 12 · yours 15 ✗") and refuses when `price > fair × 1.1`, buys ×2 qty when `≤ fair`. Bus `customer:priceCheck {stallId, price, fair, ok}`. Owl bark once on first refusal.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `baronVisit.js`: spawn via the baronPier Baron factory (do not duplicate the model code), strut 2.5 s, idle taunt loop; interact → offer; hit → refuse/flee; timeout; `end()` sends him off-screen then disposes; `scamKind:'baron'` honoured in scheduler (43A exposes the row).
- `pickyGlimmer.js`: `spawnType('critic')` at `at` and `at + 0.3`; `priceCheck` in customers.js buy decision for type `critic` (emit, bubble via `bus.emit('story:bark', {kind:'price', anchor, text, ttl:2.5})`).
- story.json lines; `check.mjs --novelties` additive asserts (below).
### P2 — should ship (≈ 10 credits)
- Baron pitch uses the dialogue portrait (`ui/dialogue.js` already has portraits; just pass `speaker:'baron'`). Critic's "✓ fair" bubble green when the price is fair (positive feedback, not only refusal).
### P3 — nice to have (≈ 5 credits)
- Baron drops the asterisk as a 3D "*" sprite that floats above his hat while pitching (≤ 1 dc) — the visible tell.

## Demo page: extend `game/demo_novelties.html` if 43B shipped it (keys 4/5), else none.

## check.mjs section `--novelties` (additive asserts; sub-name `43C BARON VISIT + PICKY`)
- headless S4 (`season=4` start): at ≥ 0.64 `novelty:start baronVisit`, no `scam:npc`; scripted `interact()` near him → `eco:scam` pendingOffer `tooGoodLoan`; `ability('ledgerFlash')` ≤ 3 u → `scam:tell`; hit → `refuseOffer` once + state `flee`; season end → `novelty:end`, Baron mesh removed, 0 leaks.
- S5: two `critic` spawns; stall priced at fair×1.3 → `customer:priceCheck ok:false` + no sale; priced at fair → `ok:true` and qty 2 sale in the ledger.
- `--seasons --pier --customers --game` still ALL OK.

## Budgets: Baron ≤ 24 dc (shared with 42D) · critic = a Glimmer ≤ 12 dc · price bubble DOM only.
## Content rules that bite here (Bible §2): the Baron's deal is always refusable without penalty; the critic teaches fair price by refusing visibly, never by silent lost sales.
## Handoff `docs/HANDOFF_43C.md`: Done / Missing / Measured / Suspected / Notes for the integrator (43D: rotation needs `novelty.start` to be re-entrant across seasons).
