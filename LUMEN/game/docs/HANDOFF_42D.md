# HANDOFF 42D — Pay the Baron at the pier; scams are NPCs (IN PROGRESS)

Resume file. Rows: README "Done" table has NO 42D row yet → this ID is HALF-DONE (next.sh reports it).

## Done (on origin/main)
- P1 step 1: economy `interestDue()` pure + `pierPays` mode (`state.interestOwed`, `settleInterest()`, `eco:interest`).
- P1 step 2: `src/systems/baronPier.js` — createBaronPier: arrive/wait/repay/leave, `due/near/interact/release/settle`, 20 s cap, `pier:*` events. Game.js `installPier`, `opts.pierPays`, `sb.interact` routes to the Baron.
- P1 step 3: Game.js `'pier'` state (GAME_STATES 6), `sb.holdClock('pier')`, save resumes at pier.
- P1 step 4: `tools/gates/pier.mjs` + `check --pier` ALL OK.
- P1 step 5 (this chat): `src/systems/scamNpc.js` — see below.

## Missing (in order)
1. ~~scamNpc.js~~ (written this chat — see Done once committed): spawn Collector in `pitch` state near plaza · pitch barks · `interact()` → `eco.offerScam()` · sword hit → flee + refuse · ledgerFlash ≤ 3 u → `scam:tell` · 25 s → refuse.
2. Game.js: scheduler scam mark → `sb.scamNpc.spawn()` instead of `eco.offerScam()` (headless/no-scene keeps the direct path so check.mjs 1382/1610 pass) · `sb.interact` falls through to `sb.scamNpc.interact()` · `sb.ability('ledgerFlash')` → `scamNpc.flash()`.
3. story.json: `pier` lines 2 per tier × {paid, short} (baronPier.js has FALLBACK) · scam lines tagged.
4. `tools/gates/pier.mjs`: append scam NPC assertions (scam:npc, no eco:scam until interact, flash → scam:tell, hit → refuse once + flee, 25 s → refuse once).
5. P2: hold-E repay HUD countdown; Baron portrait in dialogue. P3: coin on leaving.
6. API_CONTRACTS "Pier + scam NPCs (42D)" ≤ 6 lines · README row · close.

## Measured / Suspected / Notes
- (fill at close)
