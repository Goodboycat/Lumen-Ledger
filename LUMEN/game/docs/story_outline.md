# Lumen Ledger — Story Outline (Chat 8A · data/story.json)

One 10-season arc. Pip inherits bankrupt Glowmarket + 200 Spark of Baron Gilt's debt. Each season teaches ONE FinLit lesson
(order = `BALANCE.lessons` in `src/systems/economy.js`), the Baron's Fog Collectors pitch Too-Good Deals, and the Lighthouse is relit in Season 10.

## Cast (keys = `ui/dialogue.js` SPEAKERS)
| key | name | voice |
|---|---|---|
| `pip` | Pip | hero; optimistic, impulsive, learns out loud ("Needs FIRST.") |
| `owl` | Tally-Owl | mentor/bookkeeper; dry, never scolds twice, aphorisms ("Boring is beautiful") |
| `baron` | Baron Gilt | villain; pompous, loves the word *compounding* and asterisks |
| `collector` | Fog Collector | bumbling tax-collector blobs; every pitch has a visible tell |
| `glimmer` | Glimmer | customers; one-line reactions |
| `narrator` | — | season title cards only |

Moods used: `happy · sad · angry · shout` (the four `mood-*` classes in dialogue.css).

## Season beats
| S | Title | lessonId | Opening beat | Mid-season | Ledger (default / low / high) |
|---|---|---|---|---|---|
| 1 | The Inheritance | budgeting | Pip meets Owl, the 200 debt, the four jars; Baron: "20 %… per season. Compounding." | "plan > pile" | first budget / "fill jars FIRST" / grandmother would hoot |
| 2 | Needs and Wants | needsVsWants | golden awning vs leaky roof | "if I skip this, does anything break?" | awning waited / a want jumped the queue / repaired roof is satisfying |
| 3 | The Storm Season | emergencyFund | storms don't send invitations; Protect = bill not loan | "idle is the point" | Baron went home hungry / empty Protect fed the Fog / boring is beautiful |
| 4 | Two Kinds of Interest | goodVsBadInterest | Save grew by itself (5 %) vs Baron 20 % compounding | repaying = best return | earned > paid / Baron earned more / "You repaid EARLY? Rude." |
| 5 | Too-Good Deals | scams | Collector: secret · urgent · guaranteed; the asterisk tell | nobody guarantees growth | 'no' is cheapest tool / expensive lesson / "Who TAUGHT you about asterisks?!" |
| 6 | The Quiet Jar | compoundGrowth | Save earned more with no new coins; "small, early, left alone" | Save tortoise vs Invest wobble | calendar did half the work / raided the tortoise / island pays for itself |
| 7 | Cover | insurance | Fog-Proof Insurance™ (*terms do not exist) vs Protect + Guard Tortoise | cover feels wasted — that's the price | one bad day, zero bad seasons / Protect ran dry / Collectors in a puddle |
| 8 | Many Baskets | diversification | too much fish; Baron's Quick-Flip tip ("I personally know") | West Meadow / East Shore = baskets | one dipped, two hummed / eggs in one stall / "NOBODY bought my Notes" |
| 9 | The Long Wait | delayedGratification | Far Point ALMOST affordable; Baron: pre-approved!; "Future-Pip is a customer too" | waiting is Save working | halfway to wonderful / bought early with Fog / Future-Pip says thank you |
| 10 | The Lighthouse | planningForAGoal | "goal ÷ seasons left = this season's target" written on the fruit stall | Glimmer: "LIGHT!" | look up, Pip / barely, still counts / light it up |

Ledger variant pick (8B): `report.stars ≤ 1 → ledger.low · 2 → default · 3 → high`.

## Scams (keys = 4B `SCAMS`; `tell` strings are byte-identical to economyData.js)
`zeroInterestLoan` (asterisk) · `doubleSpark` (guaranteed) · `luckyLantern` (urgency + unseen prize) · `foggyInsurance` (no terms) · `premiumStallKit` (fake normal price) · `quickFlip` (insider tip, pitched by the Baron himself).
Shape: `pitch[]` (last line has `choices: [accept, refuse]`) → `accept[]` or `refuse[]` → `tell`. 8B: on `ui:choice` → `economy.acceptOffer(offer)` for accept; emit `story:lesson` with the tell either way.

## Events (keys = 4B `EVENTS`) — 1–2 lines each, played as `story:line` when `eco:event` fires.

## Ending
`ending.win` (9 lines: Fog gone, Baron tantrum, Owl offers him a Save jar at 5 %, Collectors want a tea stall, Lighthouse lit) → `ending.endlessUnlock` (2 lines) · `ending.lose` (3 lines, no shaming).

## Tutorial toasts (`tutorial[]`, `story:toast`) — 10, each with a `trigger` bus event, fire once per run:
ui:start · ui:title:close · build:placed · cust:paid · ui:jar:apply · eco:fog · eco:scam · eco:event · ui:ledger:open · build:upgraded.

## Content rules checked (`node tools/check.mjs --story`)
No magic/rune/undead/dark-fantasy words · enemies are pompous blobs, not monsters · no gambling mechanics praised (the raffle is the SCAM) · cozy, snappy, 16+ family-friendly.
