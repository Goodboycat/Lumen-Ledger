# Chat 42D — Pay the Baron at the pier; scams are NPCs
Needs: 2C Baron Gilt model + VillainAnimator (strut/taunt/offerDeal/flee) · 10C installSeasonLoop (review state) · 4A `eco.repay`/`offerScam`/`acceptOffer`/`refuseOffer` · 8B scam scripts · 42B `interact` · 42C `enemy:talk`      Blocked-by: 42C
Owned (only these files): src/systems/baronPier.js (new), src/systems/scamNpc.js (new), src/Game.js (installSeasonLoop hook ≤ 30 lines; scheduler scam mark → spawn NPC instead of `eco.offerScam()` directly), data/story.json (scam lines get `speaker:'collector'` + `tell` field already in 4B; 2 Baron pier lines per season tier), ui/dialogue.js (anchor option ≤ 10 lines), check.mjs (additive `--pier`)
Read (max 8 credits): START_HERE.md → MASTER_PLAN_V6.md §1, §6 → this → Game.js 910–955 (season loop) + 251–275 (scheduler scam mark) + 335–346 (ledgerFlash) → economy.js 337–360 (repay) + scam section → story.js scam pitch → ui:choice flow → villains.js Baron API (makeBaron, animator clips)
Export (API_CONTRACTS "Pier + scam NPCs (42D)", ≤ 6 lines):
  `createBaronPier({ bus, eco, world, hero, vfx, dialogue }) → B` · on `eco:season` (state → `review` is **deferred**): the Baron strides to `pierSpawn`, HUD shows "Pay the Baron: interest N ✦ (+ repay?)" · `B.due()` → `{interest, minimum}` · `interact()` near him → pays `interest` from the pouch (coinFly), then optional repay in `DEPOSIT_STEP` taps (hold E) → `eco.repay`; `B.done()` → the ledger opens (unchanged 7B) · if the pouch cannot cover interest: the shortfall is added to debt with a Baron taunt (the old silent rule, now spoken) · 20 s cap, then auto-settle.
  `createScamNpc({ bus, eco, story, enemies, hero }) → S` · scheduler's scam mark spawns a **Collector NPC in `pitch` state** near the plaza (not hostile) · `interact()` → `eco.offerScam()` + the 8B pitch as a bark chain anchored to it → `ui:choice` as today (accept/refuse) · sword hit → `refuseOffer()` + it flees (comedy `slipOnCoin`) · `ledgerFlash` within 3 u → the `tell` line barks above it + the refuse choice is highlighted · it leaves after 25 s unanswered (= refuse).
  bus `pier:due {interest, debt}` · `pier:paid {interest, repaid}` · `pier:short {shortfall}` · `scam:npc {id}` · `scam:tell {id, tell}`.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `Game.js installSeasonLoop`: on `eco:season` set `lg.state = 'pier'` (add to GAME_STATES) instead of `review`; the eco clock pauses (`reason:'pier'`); `pier:paid`/timeout → `review` as before. Save: a snapshot during `pier` resumes at `pier` (reuse `midSeason` pattern, ≤ 5 lines in save.js allowed).
- `baronPier.js`: the Baron mesh already exists in `sb.enemies` for S ≥ 6 — for S1–5 instantiate a non-hostile Baron (`makeBaron` from villains.js, `strut` to the pier over 2.5 s, `taunt` while waiting, `offerDeal` when paid). `due()` reads the economy's interest for the season (expose `eco.interestDue()` pure, economy.js ≤ 6 lines allowed) and **economy.js's automatic season-end interest charge is moved behind `B`** (the pier pays it; headless/no-pier mode keeps the auto path via `opts.pierPays=false` so old tests pass).
- `scamNpc.js`: spawn, pitch barks (41A), `interact`, hit → flee, flash → tell, timeout → refuse. The existing auto-refuse at season end stays as the safety net.
- `story.json`: 2 Baron pier lines per tier (S1–3 / S4–6 / S7–10) × {paid, short}; scam lines tagged.
- `check.mjs --pier` (below).
### P2 — should ship (≈ 12 credits)
- Repay at the pier: hold E to repay in 10 ✦ steps; HUD shows debt counting down live; the ledger's "repaid" row matches.
- Baron's face in the dialogue portrait when he speaks at the pier (7B portraits exist).
### P3 — nice to have (≈ 5 credits)
- The Baron drops a single coin when he turns to leave if you paid in full — Pip can grab it (a smile for the 3-★ player).

## Demo page: `game/demo_pier.html` — key L ends the season → Baron walks in; E pays; hold E repays; key M spawns the scam NPC; Space bonks it; R flashes; stats: pouch / debt / interest due / state.

## check.mjs section `--pier` (additive; name it `42D PIER + SCAM NPC`)
- headless game with `pierPays:true`: run S1 → state `pier`, `pier:due.interest === eco.interestDue()`, eco clock paused; scripted `interact()` near `pierSpawn` → `pier:paid`, pouch −= interest, debt unchanged except by repay; then state `review` and the ledger shows the same interest row as the old auto path (value equality against a parallel `pierPays:false` run, same seed).
- pouch < interest → `pier:short`, debt += shortfall, no crash; 20 s timeout → auto-settle → `review`.
- scheduler scam mark (odd seasons) → `scam:npc`, no `eco:scam` until `interact`; `sb.ability('ledgerFlash')` within 3 u → `scam:tell`; sword hit → `refuseOffer` called once, NPC state `flee`; 25 s unanswered → refuse once.
- destroy → 0 leaks; `--game` full run still ALL OK with `pierPays:false` default in that harness.

## Budgets: Baron ≤ 24 dc (exists); scam NPC = a Collector (≤ 12 dc).
## Content rules that bite here (Bible §2): the Baron never blocks progress with a Spark paywall — paying short is allowed (debt grows, spoken aloud); the scam NPC always carries a visible tell for a player who looks (flash just names it).
## Handoff `docs/HANDOFF_42D.md`: Done / Missing / Measured (`funnel.mjs --synthetic 20`: full PLAN §5 table vs FUNNEL_BASELINE) / Suspected / Notes for the integrator (43Z: the season script table now has marks for waves/warn/event/scamNpc/raid per season; 45: Bible §2 additions from PLAN §6).
