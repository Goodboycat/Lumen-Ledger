# HANDOFF 44A — Readable pricing: reaction bubbles, sign tint, E-on-sign price change (2026-11-03, CLOSED, P1 + P2)

## Done
- `src/systems/customers.js` `_settle` (lines ~395 / ~416): every settle emits `cust:react {id, stallId, ratio, mood, glyph:'love'|'ok'|'bad', type}` (critics too — their 43C `customer:priceCheck` + full "fair 12 · yours 15" line is untouched). From S2 on, every **2nd non-critic** customer also says it out loud: `story:bark {kind:'price', glyph, text:'♥ 6' | '✓ 8' | '✗ 15'}` (glyph-first, price = what the stall charged). S1 = 0 price bubbles. bark.js keeps its ≤ 2 cap.
- `ui/bark.js` — `kind:'price'` branch adds the glyph class (`.ll-bark.price.love|.ok|.bad`); `ui/bark.css` `.love` gold (2 lines).
- `src/Game.js` (wireEconomy, ~260–280) — `sb.signTintOf(ratio)` (≤ 0.9 green · ≤ 1.1 white · ≤ 1.4 amber · else red) + `sb.signTint(id)`: the hanging sign is the ONE live (unmerged) mesh per stall, so its material is cloned once (`material.userData.signTint`) and only `color` changes → **0 new draw calls, 0 new scene objects**. Re-tinted on `cust:price`, `build:placed` (category stall) and `build:upgraded` (level rebuild = new sign mesh). Headless stub materials guarded.
- `src/Game.js` (~380–386) — `sb.interact()` near a stall sign (`sb.signNear()`, ≤ 1.6 u, nearest) → returns `'sign'` and arms `sb._signHold`; release before 0.5 s → `ui:price {id, delta:+1}`; `sb.signHoldTick()` (called from the update loop, line ~340) fires `delta:-1` once at hold ≥ 0.5 s. The `ui:price` handler moved from the build panel into `wireEconomy` so sign E and the panel share ONE handler (sandbox-owned).
- Owl bark: `sb._angryAt` Map (stallId → angry count); 3 `mood:'angry'` reactions at one stall → `barks.pricing[0]` once per stall per season (reset on `eco:season`). `data/story.json barks.pricing[3]` (owl, ≤ 60 chars).
- `tools/gates/pricing.mjs` "44A READABLE PRICING" wired into `check.mjs --pricing`; full `node tools/check.mjs` **ALL OK**.

## Missing
- P3 hero shot (`tools/hero_shots.mjs` → `LUMEN_extras/game/docs/screenshots/44A_price.png`) not taken — no browser session this ID (headless gate only). 44D's close step takes the price-bubble screenshot anyway.
- Touch: the hold-to-lower gesture is keyboard E only; the touch interact button goes through the same `sb.interact()` so a tap works, a long-press on touch is unverified.
- `GAME_VERSION` still `'S46'` (phase 44 bumps at 44D close, as 43 did at 43D).

## Measured (gate output)
- S2, price fair×0.8: 2 `cust:react glyph:'love'`, 1 "♥ 4" bubble (≤ 1 per 2 customers), signs green.
- S2, fair×1.5: `glyph:'bad'`, "✗ 8", sign red; 3 angry → exactly 1 Owl bark, 4th angry → still 1; `eco:season` resets the count; 3 pricing lines present.
- S1: 0 price barks. `ui:price +1` ×3 → price 6 → 9 (ratio 1.50 → tint red; amber band 1.1–1.4 checked via `signTintOf`). E at sign: tap → +1, hold 0.5 s → −1; `signNear()` null when far. 0 new scene objects, 0 leaked listeners after destroy.
- Diff: 7 files, +148 / −8 lines (customers.js +9, Game.js +37, bark.js 1, bark.css +2, story.json +5, pricing.mjs 96 new, check.mjs +5).

## Suspected
- With 12 customer types the "every 2nd non-critic" counter is global, not per stall — a busy stall can show two bubbles in a row while a quiet one shows none for a while. If it reads as random, make the counter per stall (one Map in customers.js, 3 lines).
- Sign tint uses the stall's **current** price/fair ratio; 44C's seasonal `demand` multiplier changes `fair` at season start → call `sb.signTint(id)` for every stall on `eco:season` (one loop) or the tints go stale until the next sale.

## Notes for 44B (visible wants)
- **Bark anchor:** a customer exposes `c.root` (THREE.Object3D, head at `c.root.position.y + ~1.6`); `_settle` barks are anchored by passing `{ anchor: c.root }` in the `story:bark` payload — bark.js projects it each frame while visible. Reuse that exact field for the want glyph in `_pickStall` (customers.js ~224); do not add a second projection path.
- `cust:react` already carries `type` — 44B's want glyph can use the same `PREFS[type]` top entry; `cust:left {result:'noStall', want}` is the only new event needed.
- `sb.signTint(id)` is public on the sandbox: 44C's HOT/COLD tag should set the tint AFTER its demand multiplier, i.e. call it from the season hook, not re-implement.
- `ui:price` is now sandbox-owned (wireEconomy); any new price control (44C panel chip, touch long-press) emits that event and gets sign tint + Owl logic for free.
