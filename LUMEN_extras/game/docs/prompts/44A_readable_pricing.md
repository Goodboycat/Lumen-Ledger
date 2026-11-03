# Chat 44A — Readable pricing: reaction bubbles, sign tint, E-on-sign price change
Needs: 43C `story:bark {kind:'price'}` + ui/bark.js · B24 `ui:price` (Game.js:901) · customers.js `_settle` mood (lines ~400–417)      Blocked-by: 44Z
Owned (only these files): src/systems/customers.js (`_settle` price bubble emit ≤ 10 lines), ui/bark.js + bark.css (`.love` class, glyph-first price bubble ≤ 15 lines), stall sign tint (the module that owns the stall sign/price chip — ≤ 15 lines; if none exists, tint the build-panel price chip and note it), src/Game.js (`sb.interact` near a stall sign → `ui:price` +1 / hold −1, ≤ 12 lines), data/story.json (`barks.pricing[]` 3 lines ≤ 60 chars), tools/gates/pricing.mjs (new), tools/check.mjs (additive `--pricing`)
Read (max 6 credits): START_HERE.md → HANDOFF_44Z.md → this → customers.js `_settle` (mood block) → ui/bark.js (kind:'price' branch) → Game.js `ui:price` handler
Export (API_CONTRACTS "Pricing (44A)", ≤ 5 lines):
  `cust:react {id, stallId, ratio, mood, glyph:'love'|'ok'|'bad'}` on every settle; bark `{kind:'price', glyph, text:'♥ 6' | '✓ 8' | '✗ 15'}` for 1 in 2 non-critic customers from S2 on (S1 = none; critics keep 43C's full line).
  Sign tint: ratio ≤ 0.9 green · ≤ 1.1 white · ≤ 1.4 amber · else red; updated on `cust:price`.
  `sb.interact()` near a stall sign (≤ 1.6 u) → `ui:price {id, delta:+1}`; hold ≥ 0.5 s → `delta:-1`. Same handler as the build panel.
  Owl bark `barks.pricing[0]` once per stall per season after 3 `angry` reactions at it.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 20 credits)
- `_settle` emits `cust:react` + the price bubble (rate limit: every 2nd non-critic customer, S ≥ 2, ≤ 2 bubbles = bark.js cap). bark.css `.love` (gold). `--pricing` asserts.
- Sign tint on `cust:price` + on stall placement.
### P2 — should ship (≈ 12 credits)
- E on sign → `ui:price`; the 3-angry Owl bark; story.json lines.
### P3 — nice to have
- One hero shot (`tools/hero_shots.mjs`) of a ♥ bubble + green sign → `LUMEN_extras/game/docs/screenshots/44A_price.png`.

## check.mjs `--pricing` (sub-name `44A READABLE PRICING`)
- headless S2: stall at fair×0.8 → settle → `cust:react glyph:'love'`, bark `kind:'price'` text starts with "♥"; at fair×1.5 → `'bad'`, 3 settles → exactly 1 Owl bark; S1 → 0 price barks.
- `ui:price +1` ×3 → `cust.price(id)` +3, sign tint class/colour changes to amber when ratio > 1.1.
- destroy → 0 leaked listeners. Full `node tools/check.mjs` ALL OK before closing.

## Budgets: 0 new draw calls (DOM bubbles; sign = material colour only).
## Content rules (Bible §2): a bubble is a reaction, never a prompt — never blocks input, never pauses.
## Handoff `docs/HANDOFF_44A.md`: Done / Missing / Measured / Suspected / Notes for 44B (which bark anchor a customer exposes in `pickStall`).
