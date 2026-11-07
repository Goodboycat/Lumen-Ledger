# BRAINSTORM S65 - "what keeps me playing after season 3?" (for the user's verdict, nothing here is built)

## Diagnosis (from the user's report + the code)
Loop today: coins -> jars -> pay debt -> beat Collectors -> buy a stall -> repeat. A stall costs ~one season of income, so each season = "buy the next thing". After 3 seasons
nothing is **scarce, surprising or personal**. The 6 powers are on 5 s cooldowns with no cost, so they are not decisions. There is no reason to open the game tomorrow.
Missing: (1) a decision with a trade-off, (2) a goal beyond the debt, (3) variety between runs, (4) something that is *mine* (cozy attachment), (5) a reason to return.
The Regions data (data/regions.json: Rootwood, Crags, Tidepools, Mines, Orchard, Citadel + bosses + rewards) exists but is NOT wired into the game (no createRegions call outside src/world/regions).

## Ideas collected, by source
| Source | Idea | FinLit link | Keep? |
|---|---|---|---|
| Harvest Moon / Stardew | Crops/ingredients grow over real seasons; a **calendar** with festivals, birthdays | Delayed gratification, compound growth | YES (calendar + festivals) |
| Animal Crossing | **Daily visitors** with wishes, a museum to fill, a house/plaza you decorate, a debt to Tom Nook that is *friendly* | Debt without shame, goals | YES (it is literally our theme: Baron = Nook with teeth) |
| Roguelite (Hades, Slay the Spire) | After each season choose **1 of 3 boons**; run modifiers; meta-unlocks between runs | Trade-offs, opportunity cost, risk | YES (core of the fix) |
| Incremental (Cookie Clicker) | Prestige / "rebirth" with a permanent multiplier | Compounding | PARTLY (as "Legacy", no number-go-up spam) |
| Tycoon (RollerCoaster, Two Point) | Stall **synergies / districts**, customer needs, star ratings, staff | Diversification, needs vs wants | YES (synergies) |
| RPG adventure (Zelda) | Regions gated by tools/powers, bosses, new abilities | Planning for a goal | YES (data already exists) |
| Pokemon / collection | Collect all 12 Glimmer types, 6 helpers, 6 scams as a sticker book | Scam awareness (Scam Journal already exists) | YES (extend) |
| Gacha / loot boxes | Random paid rewards | NONE, and it teaches the wrong lesson | NO (violates the jam's family-safe pillar) |
| Daily-streak guilt (Duolingo) | Streak loss anxiety | Opposite of cozy | NO (use a gentle "welcome back" instead) |
| PvP / leaderboards | Rank vs strangers | Not cozy, needs a server | NO |
| Real-money shop | - | - | NO |
| Survival/hunger | - | stress, not FinLit | NO |

## The best 6 (what I recommend, ranked)
### 1. Boon Draft - the strategy fix (Roguelite)
At each Ledger Review (and at 3 mid-season moments) pick **1 of 3** cards, each a *money trade-off with a lesson*:
- "Index Fund: Invest jar +4 %/season, but you can't withdraw it for 2 seasons" (patience)
- "Emergency Pouch: first storm costs 0, but stalls make -10 % this season" (insurance cost)
- "Snowball: each stall sells +3 % per season it has stood" (compounding)
- "Cheap Credit: build 30 % cheaper now, 8 % interest per season" (good vs bad debt - player sees both sides)
Cards stack into a build (a "Saver", "Merchant", "Fighter" run). Power use gets a real cost: **Focus meter** instead of flat 5 s cooldown (spend on Dash/Stomp/Shield, refill by selling and by saving), so a big wallet doesn't just mean "buy more".
Why it works: every season now has a decision with a visible downside = FinLit trade-offs, and runs differ.

### 2. Wishes + Neighbours - the cozy hook (Animal Crossing / Harvest Moon)
Named Glimmer **regulars** (6-8 characters) who visit by the clock, have a favourite stall, a **savings goal wish** ("I want a boat: 120 Spark") and a mood. Helping them (fair price, a fair deal, a loan you refuse for them) raises *friendship*; friendship unlocks decor, a new stall variant, a story beat. Gives the player people to care about, so "one more season" = "see what Mina does".
FinLit: goal-setting, fair pricing, saying no to scams *for a friend*.

### 3. Open the Regions - the adventure hook (Zelda)
Wire the existing 6 regions: each is a **short expedition** (2-3 min) that costs a Provision (Spark spent up front = risk), has enemies and a boss, and pays a **permanent power upgrade** (sparkTether, electricOrb, bubbleWalk... already named in data). Regions need Rep/powers, so the stall economy funds exploration and exploration upgrades the economy. This is the "something that keeps me moving": a map with locked doors.
FinLit: invest now for a later payoff; risk vs reward.

### 4. The Calendar of Festivals (Harvest Moon)
Seasons get names and one **festival** each (Lantern Fair, Harvest Day, Storm Night...) with a special demand spike and a *planning* puzzle ("Fair is in 2 seasons: stock up or save?"). Calendar visible on the HUD pill. Lets us teach the 10 lessons through events you prepare for, not only react to.

### 5. My Island - decor + collection (Animal Crossing / Pokemon)
Decor, paths, lantern colours, hat for Pip; sticker-book pages (Glimmers met, scams spotted, helpers hired, regions cleared). Rewards are **cosmetic and earned by good money habits** (e.g. "No-debt season" gives a flower bed). Cheap to build (props exist), strong attachment, zero pay-to-win.

### 6. Legacy / New Island+ (Incremental prestige, gently)
After the Lighthouse: start a fresh island with 1-2 inherited traits (Owl's Tip, a starting boon, a harder Baron). Endless becomes a chosen difficulty ladder ("Baron Level 1-5") instead of a flat sandbox. Gives replay and a stat to brag about without a number race.

## What each does to the three "desire" axes
| Idea | Addictive (one more turn) | Cozy | Different/adventure |
|---|---|---|---|
| Boon Draft + Focus | HIGH | low | medium |
| Wishes + Neighbours | medium | HIGH | low |
| Regions | HIGH | low | HIGH |
| Calendar | medium | HIGH | low |
| My Island | low | HIGH | low |
| Legacy | HIGH | low | medium |

## Suggested bundles for the verdict
- **A - "Strategy first" (smallest, fixes the stated complaint):** Boon Draft + Focus meter. ~2 sessions.
- **B - "Cozy village":** Wishes/Neighbours + Calendar + My Island. ~3-4 sessions.
- **C - "Adventure":** Regions + Boon Draft. ~4+ sessions (regions need world art + enemies; data is ready).
My pick if I must choose one path: **A, then B's Neighbours**, because it fixes "money has no decisions" first and adds a reason to care second; Regions last (biggest).

## Rules for all of them (aesthetic + beginner + phone landscape)
Drawn procedural icons only (no emoji in-game), one card on screen at a time, big tap targets (>= 44 px), nothing under the thumbs (joystick left, Attack/Dash right), no new text walls, every choice shows its consequence within one season.
