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
| **S66-A** | Eliminate the Spend jar as a thing you build/walk to (Spend = your pouch). The jars panel row is just "Spend" (bar + number stay). Fix tutorial cards that mention the Spend jar | this chat |
| **S66-B** | Eliminate Endless mode (title button, ledger "ENDLESS MODE", `goEndless`, unlock, HUD "Endless" text). After the win: finale -> Lighthouse cinematic -> credits-style ledger -> title | this chat |
| **S66-C** | Tutorial: a point already told is never shown again (even after a reload / other trigger), only NEW things; Season 1 three stars must be reachable by doing what the tutorial says (diagnose + fix, prove with a rig) | this chat |
| **S66-D** | EPIC Lighthouse cinematic (lots of fog, lamp turns on, beam burns the fog away, slow dolly zoom in/out, returns to normal play). Smooth camera, skippable, reduce-motion safe | this chat starts it, S67 finishes |
| **S66-E** | Procedural icon sheet for new icons, screenshot, PNG slice | this chat (as needed) |
| **S66-F** | Final review: screenshots at 844x390 + 1280x720, analyse for a beginner | this chat |
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
