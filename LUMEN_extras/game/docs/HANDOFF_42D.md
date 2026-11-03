# HANDOFF 42D — Pay the Baron at the pier; scams are NPCs (CLOSED 2026-11-03, chat S45)

## Done (all on origin/main)
- P1 steps 1-6 (previous chats): economy `pierPays`, `baronPier.js`, Game.js `'pier'` state + `holdClock`, `tools/gates/pier.mjs`, `scamNpc.js`, Game.js `installScamNpc`.
- P1 step 7 (this chat): pier gate section 6 — scam NPC assertions (spawn at mark, no eco:scam until talk, dialogue refuse → leaves, flash → scam:tell, hit → refused once + flee + mesh gone, 25 s timeout, season end clears, no leaks). The 20 s test season ended before the 25 s timeout → the gate holds the eco clock (`sb.holdClock('gate')`) for that case.
- P1 step 8: `data/story.json` `pier { paid, short, repaid } × { t1, t2, t3 }`; `createSandbox(opts.storyData)` → `installPier` passes `{ data }` so the Baron barks from story.json (FALLBACK kept). First repay tap → `repaid` bark.
- P2: HUD `.ll-pier-chip` (ui/hud.js + hud.css) — "⚓ BARON AT THE PIER — N ✦ due · 20 s" countdown from `pier:tick` (baronPier emits ≤ 1 Hz while waiting), turns green on paid/short with the repay hint, updates on `pier:repaid`, hides on `pier:done` / `pier:skip` / `game:start`. `pier:due` now carries `waitCap`.
- API_CONTRACTS "Pier + scam NPCs (42D)" · README_pipeline row · 42D struck from Next.

## Missing
- P3: coin flick when the Baron leaves; Baron portrait in the dialogue card (he only barks — no modal).
- Browser smoke of the pier flow (the chip, the Baron model at the pier, bark anchors) not run — credits. All headless gates ALL OK (`--pier --story --ui --game`).

## Measured
- `check --pier`: S1 interest 39 ✦ = interestDue(1); pier debt 260 + 39 paid from the pouch vs auto path 299 (identical ledger row); short case +57 debt; full game S1 → pier → review ledger interest 45 = due.

## Suspected (not touched)
- `PIER.waitCap` 20 s may be short on mobile with the plaza far from the pier (walk ≈ 6-8 s). If first-player funnel shows `timeout` settles > 30 %, raise to 30 s (one constant, gate uses PIER.waitCap).
- The scam NPC and the Baron can both stand near the pier spawn in odd seasons; `SCAM.spots` are plaza-side so they do not overlap, but `sb.interact()` prefers the Baron.

## Notes for the integrator
- `sb.interact()` order: jar > till > Baron > scam NPC > enemy talk. New interactables go after the Baron.
