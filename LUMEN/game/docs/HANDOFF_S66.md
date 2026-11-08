# HANDOFF S66 (user report 2026-11-08) - plan + IDs for this chat and the next ones - read this first
Verdict from the user: Boon Draft + Focus meter, Wishes + Neighbours, Open the Regions - ONE chat per big thing. Remove the Spend jar, fix tutorial repetition + the S1 three-star
problem, remove Endless mode, make an epic Lighthouse cinematic. Mobile LANDSCAPE first, desktop second. Drawn procedural icons only in game (emoji only in code comments).
Design guard (from the GPT review the user pasted): **every new system must teach or protect FinLit** - Boon cards are real trade-offs with a lesson (never "+20 % damage"),
Wishes are savings goals, Regions are new economic situations. Protect: Pip + island, the 4 jars, the Debt Fog, Baron Gilt + Collectors + Too-Good Deals, the Ledger, the Lighthouse as the destination.
No daily-login guilt, no streaks. Do NOT add enemy types.

## Rules for every chat (learned the hard way, see S59-S65)
1. `bash LUMEN/game/tools/github.sh <TOKEN>` first. Commit + `git push -q origin main` after EVERY ID (`bash tools/wip.sh "<what>"`). A chat may be axed at any time.
2. After every JS edit: `for f in ui/*.js src/*.js src/*/*.js; do node --check $f || echo BAD $f; done` (a stray `// comment` once swallowed a `}` and killed the UI).
3. Unit tests one file at a time (`node --test tests/x.test.mjs`); `node tools/check.mjs` is the headless gate.
4. Browser rigs: `tools/play_s66*.mjs W H`, run detached `setsid -f timeout 400 node tools/x.mjs > /tmp/x.log`, poll. Playwright is in tools/node_modules (`npm i playwright@1.47.0`), chromium via
   `npx playwright install chromium` + `sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2t64 libnss3 libcups2 libxfixes3`.
   Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Rig flow that works: click `ui.title.buttons.story`, loop until `lg.cine.active` is falsy, skip dialogue lines (`ui.dialogue.skip(); ui.dialogue.advance()`), then `lg.verbs.step >= 0`.
5. Every UI change is checked at 844x390, 568x320 (phone landscape) and 1280x720. Look at the PNG with the Read tool and say what you see.
6. Icons: add a procedural drawing in `ui/icons.js`, put all new ones side by side in `icons_gallery.html`, screenshot it, slice PNGs with `tools/icons_png.mjs`.

## ID table (status column is the only truth)
| ID | Ask | Status |
|---|---|---|
| **S66-A** | Eliminate the Spend jar as a thing you build/walk to (Spend = your pouch). The jars panel row is just "Spend" (bar + number stay). Fix tutorial cards that mention the Spend jar | DONE (gates green; no phone screenshot of the panel yet) |
| **S66-B** | Eliminate Endless mode (title button, ledger "ENDLESS MODE", `goEndless`, unlock, HUD "Endless" text). After the win: finale -> Lighthouse cinematic -> credits-style ledger -> title | DONE (credits screen still missing) |
| **S66-C** | Tutorial dedupe + reachable 3rd star | **DONE in code + unit/gate tests** (C1 fair star, C2 ledger checklist, C3 PAY card, C4 `teaches` dedupe). NOT yet seen in a real browser: the S1 ledger checklist screenshot is missing (see CLOSING NOTE 2) |
| **S66-D** | EPIC Lighthouse cinematic | **DONE** (13.8 s, screenshot-checked at 844x390 and 568x320, `--cinematics` ALL OK). 1280x720 not shot. Audio swell + credits screen not done (S70) |
| **S66-E** | Procedural icon sheet for new icons, screenshot, PNG slice | **DONE**: `focus boon laurel payhand goals` in `ui/icons.js`, sheet `tools/shots/icons_t4_sheet.png`, PNGs in `ui/icons/`, manifest +5. `payhand` is on the PAY card, `laurel` on THE END; `focus`/`boon`/`goals` are waiting for S67 / not wired yet |
| **S66-F** | Final review: screenshots at 844x390 + 1280x720, analyse for a beginner | **PARTLY DONE**: 844x390 title, play HUD, PAY card, and the cinematic frames were looked at and are fine. NOT done: 568x320 + 1280x720 of title/HUD/PAY, and the S1 Ledger checklist in a real browser |
| **S67** | **Focus meter + Boon Draft** (the strategy fix). Design below | next chat 1 |
| **S68** | **Wishes + Neighbours** (cozy hook) | next chat 2 |
| **S69** | **Open the Regions** (data/regions.json is unwired) | next chat 3 |
| **S70** | Lighthouse cinematic polish pass (timed + smooth: camera curves, fog density ramps, audio swell, letterbox) if S66-D left rough edges | next chat 4 |

## S67 design - Focus meter + Boon Draft (what the next chat builds)
**Focus**: replaces the flat 5 s cooldown of the 6 powers (`src/anim/heroAbilities.js`, `ui/abilityChips.js`, `ui/touch.js`). Meter 0..100, HUD ring next to the Spark pill (drawn icon, no emoji).
Each power costs Focus (Dash 15, Shield 35, Stomp 30, Flash 20, Haggle 25, FogSweep 45). Refill: +2/s idle, +4 per fair sale, +10 per Save-jar deposit, +15 per scam refused (FinLit: calm,
good habits give you the energy to act). A short 0.6 s global gap so a button mash is not a spam. Chips show cost; not enough Focus = chip dims with a thin fill.
**Boon Draft**: after each Ledger (and not on the lose ledger) show 3 cards (a modal like `ui/ledger.js`, big 44px+ cards, ONE choice, no skip-all). Each card = a money trade-off + the lesson in <= 10 words.
Data file `data/boons.json` (designer-editable, 12-16 cards over 4 families) + `src/systems/boons.js` (pure: `rollThree(rng, owned, season)`, `apply(eco, boon)`, `serialize/restore`) + `tests/boons.test.mjs`.
Hook points in economy: `config` multipliers (savingsRate, investMean, upkeep, stall cost), `mod(key)` already exists for helpers (use it), loan terms. Examples (all have an upside and a visible downside):
Careful Saver (+2 pts Save rate, stalls cost +15 %), Index Fund (Invest +3 pts, locked 2 seasons), Emergency Pouch (next storm costs 0, income -8 % this season), Snowball (+3 %/season each stall has stood, upkeep +1/stall),
Cheap Credit (build -30 % now, Baron +6 pts interest), Fair Trader (rep gain x2, max price -10 %), Haggler (+10 % sales, rep loss on gouge x2).
Rule: never offer two boons of the same family in one draft; the player's owned boons show as a small row of drawn badges under the Season pill; boons save/restore (`save.js` additive field, SAVE_VERSION stays 4).
Balance gate: `node tests/economy.sim.mjs` strategies sensible/borrow/hoarder keep their outcomes with a random boon picker.

## S68 design - Wishes + Neighbours
6-8 named regular Glimmers (the 12 Glimmer kinds already exist; give 6 of them names, a favourite stall, a mood). Each has ONE wish with a Spark price ("Mina wants a boat: 120"). Player can
help by selling at a fair price (+friendship), gifting from the pouch (teaches giving vs. saving), or refusing a scam for them. Friendship 0-5 hearts unlocks decor / a stall skin / a story line.
A Neighbours page in the pause menu (journal style, like `ui/journal.js`). Save: additive `neighbours` field. Never a timer that punishes absence; "welcome back" line instead of a streak.

## S69 design - Regions
`data/regions.json` has 6 regions + bosses + rewards, `src/world/regions` builds them, nothing calls `createRegions`. Wire: a Map button (drawn icon), locked doors need a Provision (Spark spent up front = risk) and a star/Rep gate,
2-3 min expeditions with the existing enemy types, a boss, a permanent reward (sparkTether, electricOrb ...). Teach: invest now for a later payoff, risk vs reward. Needs its own camera + transition (use CinematicDirector).

## What this chat (S66) did
(see the log at the bottom, updated as each ID closes)

### LOG (newest last)
- **S66-A DONE (gates green)**: Spend jar is no longer a buildable (`DECOR_PROPS.jar_spend` removed, `JAR_IDS` = save/invest/protect, build tray / debug panel / jarRemind / curiosity list / tutor card `jar:spend` removed). The jars panel keeps the **Spend** row always visible (bar + number = pouch + spend balance, no withdraw arrow); panel itself stays hidden until a real jar stands. Old saves: `jar_spend` build entries are dropped in `parseSnapshot`, `LEGACY_JAR_ROW` has 3 rows, the spend balance in `eco.state.jars.spend` is untouched. Texts fixed in `data/story.json` (budgeting tip, t_firstpay, t_jars), `ui/seasons.js`, `data/tutor.json` (onFirstCoin, onJarsTab). Tests: `save.test.mjs` 13, `check.mjs --jars1` (T1.3 "empty-land tap opens tray" fails identically on the pre-S66 commit 684102d - NOT caused by S66, still open), `--jarsworld` ALL OK.
- **S66-B DONE (`check.mjs --game`, `--save`, `--ui` ALL OK)**: Endless removed. Title has PLAY / CONTINUE only (E key dead, `ui:start{endless}` falls back to story, old endless saves resume as story). Win flow: `eco:win` -> victory cinematic -> farewell lines (story.json key `endlessUnlock` kept, text rewritten, `story:finale {endless:false}`) -> ledger button **THE END ▸** -> `lg.finishRun()` (clears the save, emits `game:won`, `lg.toTitle('win')`). `goEndless`, state `'endless'`, `game:endless`, the `lumen.unlocks.endless` write, `?endless`, HUD/season-card "Endless · S11" text are gone. NOT yet done: a real credits / "thanks for playing" screen after THE END (title appears directly) -> S66-D/S70 should add it after the cinematic. `Save.unlocks/hasWon/setUnlock` helpers still exist (unused).
- **S66-C DIAGNOSIS (root cause of "following the tutorial never gives 3 stars")**: `economy.endSeason` star 3 = `debt <= debtBefore && fog01 <= fogBefore`, but `fogDelta += fogPerDebtSeason (0.07)` whenever `debt > 0` at season end. With `startDebt 300` and a 70 s S1, fog CAN NOT stay flat unless the whole 300 debt is repaid in S1 -> star 3 is unreachable in S1 (and every season until the debt is gone). Headless probe (`/tmp/s1stars.mjs`, `makeEconomy`): 8 sales + save 10 = 0 stars, 8 sales + save 30 = 1 star, 15 sales + save 30 + repay 100 = 2 stars, never 3. The tutorial also never mentions repaying or the star goals. Fix plan: (1) fair star-3 rule (debt not up AND you repaid >= the interest the Baron charged, OR fog held), (2) the Ledger shows the 3 goals as a checklist so a player knows what is missing, (3) one S1 tutor card that teaches PAY.

### CLOSING NOTE of chat S66 (read before doing anything)
- Pushed commits: P1 plan, A part1/2, B, C diagnosis, version bump (GAME_VERSION = S66). All on origin/main.
- Green: `node --test tests/{save,story,economy,jarRemind,tutor,curiosity,unlocks,verbs,seasons,regions,spring,telemetry}.test.mjs`, `node tools/check.mjs --game|--save|--ui|--jarsworld`. Red (pre-existing, not S66): `--jars1` T1.3 "empty-land tap opens tray". The full `node tools/check.mjs` was NOT run end to end this chat - do it first.
- Browser works (Playwright + chromium + libs installed per rule 4, server on :3000). Rig `tools/play_s66base.mjs W H` boots the story, passes cinematic + dialogue, and confirms the verb chain starts at step 0 (`verb:move` card). It does not move Pip, so it idles at step 0 - that is the rig, not a bug. No console errors after S66-A/B.
- **S66-C is the next job**: (1) fair 3rd star in `economy.endSeason` (see diagnosis above; keep `tests/economy.test.mjs` line 107-111: perfect season = 3, idle with debt = 0; re-run `node tests/economy.sim.mjs` strategies), (2) Ledger shows the 3 star goals as a checklist (`ui/ledger.js`), (3) a verb/tutor card that teaches PAY (S1 has none), (4) repetition: write a rig that plays S1 with real taps and lists `tutor:shown` ids per 10 s; cards that share a point (`onFirstCoin`, `onJarsTab`, `jar:add`, `verb:deposit`, `hud:pouch` all say "coins/jars") must collapse into one `group` rule: once any card of a group with the same `lesson` key was shown, later ones with that key are retired (add a `teaches` field to data/tutor.json and a retire-by-teaches in `ui/tutor.js display()`), counts persist in `tutorCounts`.
- Then S66-D (cinematic), then S67 (Focus + Boons), S68, S69, S70 as designed above.

### S66 chat 2 LOG (this continuation)
- **C1** `economy.endSeason`: star 3 = debt did not go UP over the season (`ledger.debtStart`) AND (fog held OR repaid >= the interest the Baron charged). Report now has `goals[3]` ({id, ok, debtHeld, fogHeld, paidInterest, debtStart, interest, repaid}), `starSaveMin`, `starIncomeGood`. `tests/economy.test.mjs` 88 PASS (2 new). `economy.sim.mjs --sweep` unchanged (sensible win@10 x20, borrow lose, hoarder lose).
- **C2** `ui/ledger.js` + `ledger.css`: `#ll-ledger-goals` checklist (drawn check / cross, text says what to do: "Pay the Baron's N interest"). `check.mjs --ui` ALL OK.
- **C3** `Game.js` gate `tut:pay` (S1, debt>0, pouch>=25, >=2 sales, day01>0.3, nothing repaid, verb chain over) -> card `onDebtPay` (data/tutor.json, icon payhand, points at the PAY chip, closes on `game:repaid`). `TUTORIAL_GATES` is now 6 (check.mjs updated). Rig `tools/play_s66f.mjs` confirmed the card + the cloud hand at 844x390.
- **C4** `ui/tutor.js`: card field `teaches`; once any card with a key was shown or done, `counts['teach:<key>']=1` (persisted by save.js `tutorCounts`) and every other card with that key is retired. 15 cards tagged (pouch, jar-place, build-how, collectors, protect-jar, invest-locked, pay). `tests/tutor.test.mjs` 13 pass.
- **D** `src/vfx/cinematics.js` victory shot rewritten: `FogBank` (120 puffs gather round the tower), lamp flickers 1.8 s then ignites at 5.0 s (white-gold DOM flash `--flash`, camera shake, ring + sparkles), beam spins up 0.6 -> 3.6 rad/s and burns the puffs it crosses (warm glow, swell, rise), puffs left are dissolved after 9.2 s, Hermite keyframe path `victoryKeys()` (wide -> PUSH-IN -> DOLLY ZOOM out with `rig.fov`, lens 1 -> 2.4x -> 1, orbit, wide reveal, confetti + coins at 9.6 s, hold, existing return blend). `GameCamera.baseFov` + `rig.fov` blend. `fogRecede({relight:false})` when the cinematic runs. Reduce motion = calm cut, no fog show, lamp still lights. Skip releases everything (`_cleanupVictory`). Rig `tools/play_s66d.mjs W H` (contact sheets in tools/shots). FOV returns to 38 and the bank mesh is removed after the shot.
- **E** see the table.

### CLOSING NOTE 2 (read first next chat)
1. All of the above is pushed to origin/main. Green: economy/tutor/save tests, `check.mjs --ui --game --cinematics`. Full `node tools/check.mjs` still NOT run end to end - do it first. `--jars1` T1.3 still red (pre-existing).
2. **First job: finish S66-F.** The rig `play_s66f.mjs` did not open the S1 ledger: forcing `eco.tick` past the day end starts the Baron pier (`lg.state === 'pier'`) and the ledger only opens after `pier:done`. Fix the rig: after the tick emit `pier:done` (or walk to him: `lg.sb.pier.interact()` twice) then wait for `ui.ledger.isOpen`. Then look at `.ll-ledger-goals` at 844x390 and 568x320 (does the CONTINUE button still fit without scrolling? the sheet scrolls, `fit` is printed by the rig). The checklist adds ~75 px, so on 568x320 a scroll is likely - consider hiding the star text line or shrinking the lesson card there.
3. Cinematic not yet reviewed at 1280x720; the `ending` dialogue ("The Lighthouse") opens right after, fine. No credits screen after THE END yet (S70).
4. Screens show the debug fps overlay because the rig loads `?debug=1`. Do not mistake it for a game bug.
5. Then S67 (Focus + Boons: icons `focus`/`boon` are ready), S68, S69, S70 as designed above.
