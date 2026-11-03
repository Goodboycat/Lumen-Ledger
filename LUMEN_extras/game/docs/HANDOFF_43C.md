# HANDOFF 43C — Novelties: S4 Baron in person, S5 picky Glimmer (2026-11-03, CLOSED)

## Done
- `src/systems/novelties/baronVisit.js` — S4 @0.64: Baron (42D `makeBaronGilt` + `VillainAnimator` via `sb.creatures`, headless = bare Group) struts 2.5 s to `BARON.spot`, taunt loop every 4.2 s, states `walk → pitch → offered → flee/leave → off`. `V.near()` / `V.interact()` → `eco.offerScam('zeroInterestLoan')` + pitch bark (speaker `baron` → 7B portrait); `V.flash()` (ledgerFlash ≤ 3 u) → `scam:tell {id, tell, baron:true}` + Owl bark; `V.targets()` exposes him as a sword target while pitching → hit = `slipOnCoin` + `refuseOffer` once + `scam:refused {baron:true}` + flee 2 s; 25 s timeout → refuse + leave. `end()` removes the mesh (`userData.visit`), `dispose()` releases bus listeners. `make()` is synchronous (the gate steps the clock synchronously; an async model load broke the `pitch` assert).
- `src/systems/novelties/pickyGlimmer.js` — S5 @0.20: `cust.spawnType('critic')` at `at` and `at + 0.30` (`PICKY = { second: 0.30, count: 2 }`), `novelty:critic {n, day}`, Owl bark once on the first `customer:priceCheck` (refusal → "walked / Overpriced" line).
- `customers.js` — `spawnType(type)` (queues a pending spawn if the pool is empty) + `critic` priceCheck in `_settle`: bubble `story:bark {kind:'price', ok, text:'fair 12 · yours 15 ✗'}`, bus `customer:priceCheck {id, stallId, price, fair, ok, double}`; refuses when `price > fair × 1.1` (no `eco.sell`), buys qty 2 when `≤ fair`. `ui/bark.js` + `bark.css` `price` variant (red ✗ / green ✓).
- `Game.js` — `sb.interact()` falls through to `sb.novelty.near()/interact()`; ledgerFlash calls `sb.novelty.flash?.()`; sword targets include `sb.novelty.targets?.()`; `sb.creatures = { makeBaronGilt, VillainAnimator }` (empty headless). Scheduler honours `scamKind:'baron'` (no Collector, no direct offer in S4).
- `data/story.json` — `barks.seasonNovelty.baronVisit[3]` / `pickyGlimmer[3]` + `baron.visit` pitch lines.
- `ui/hud.js` — generic `hud:chip {id, text, on}` listener (`.ll-chips` column under the pier chip, `.ll-chip`); nightMarket's chip (43B "Missing") is now visible. 43D's rotation NEW chip can emit the same event.
- `tools/gates/novelties.mjs` "43C BARON VISIT + PICKY" + `check.mjs --novelties` ALL OK; full `node tools/check.mjs` ALL OK.

## Missing
- P3 floating "*" sprite above the Baron's hat while pitching — not done (the tell is spoken by the Owl on Ledger Flash instead).
- `demo_novelties.html` — still not built (43B did not ship it either).
- Baron pitch portrait: `speaker:'baron'` is passed; whether `ui/dialogue.js` shows the 42D portrait for barks (not only dialogue) was not verified in a browser (0 screenshots this chat — credits).
- `economy.js` still contains an orphan `tooGoodLoan` entry in its fallback scams table (line ~111); `story.json` scams use `zeroInterestLoan`. Harmless, but one of the two names should go (43D or a cleanup chat).

## Measured
- Gate: S4 start @ day 0.64 · `scam:npc` ×0 in S4 · interact → pendingOffer `zeroInterestLoan` · flash tell = "The asterisk. *Zero for one season, then 35 % per season — compounding." · hit → `scam:refused` ×1, state `flee`, mesh gone ≤ 3 s · `novelty:end` on `eco:season`.
- S5 start @ 0.20 · 2 critics · stall at fair×1.3 → `ok:false`, no sale, red bubble, Owl bark · stall at fair → `ok:true, double`, 2 `eco.sell` calls (qty 2), green bubble · destroy → 0 leaked listeners.

## Suspected
- `BARON.scam` was `'tooGoodLoan'` (a name that only exists in economy.js's fallback table) — with story.json loaded `offerScam` silently fell back to a RANDOM scam. Fixed to `zeroInterestLoan`; if story.json's scam ids ever change, the Baron silently pitches a random deal again → consider asserting `eco.scams[BARON.scam]` in the gate (it does now, indirectly, via the pendingOffer id check).
- Critic double-qty sale goes through `eco.sell` twice (not one sell with qty 2) — ledger shows two lines. Intended-enough; noted for the ledger UI.

## Notes for the integrator (43D)
- `novelty.start` re-entrancy: registry `R.start` ends the previous novelty first; `baronVisit.start` creates a fresh `V.g` each time and `pickyGlimmer.start` resets `P.spawned = 0` — both are safe to start again in the endless rotation. `cust.spawnType` queues when the pool is dry.
- Emit `hud:chip {id:'new', text:'NEW — …', on:true}` for the rotation chip; `on:false` removes it. No new DOM needed.
- Rotation must keep `scamKind:'baron'` only on seasons whose novelty is `baronVisit`, otherwise S-rows get neither a Collector nor a Baron.
