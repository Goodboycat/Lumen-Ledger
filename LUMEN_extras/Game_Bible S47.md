# LUMEN — Lumen Ledger · Game Bible S47 (2026-11-03)

Previous: `Game_Bible S46.md` (everything there still applies; this file only lists what S47 changed — phase 44 "Depth after S2 retention / readable market", chats 44Z–44D).
Version strings: `GAME_VERSION = 'S47'` (src/Game.js) · `UI_VERSION = 'S47'` (ui/index.js) → title-menu footer.

## S47 — Readable market: prices, wants, season demand (phase 44)

| ID | Change | Files |
|---|---|---|
| 44Z | Plan: gate check (43D funnel reach S2 100 % ≥ 40 % → open) + phase table 44A–44D + "Rules that bite". Docs only. | `LUMEN_extras/game/docs/HANDOFF_44Z.md`, `game/docs/prompts/44A–44D` |
| 44A | Readable pricing: `cust:react {glyph}` on every settle; glyph-first price bubble ♥/✓/✗ + price (every 2nd non-critic from S2, ≤ 2 on screen); hanging-sign material tint green/white/amber/red (`sb.signTint`, 0 draw calls); **E at a sign** (≤ 1.6 u) → price +1, hold 0.5 s → −1 (same `ui:price` handler as the build panel); Owl `barks.pricing` after 3 angry per stall per season. | `src/systems/customers.js`, `src/Game.js`, `ui/bark.js`, `ui/bark.css`, `data/story.json` |
| 44B | Visible wants: `cust.wantOf(c)` = top-PREFS kind; `cust:want {want,found}` on first pickStall; icon-only want bubble (drawn stall icon, `.ok/.no`, S ≥ 2, 1 in 3 / always when unmet, evicted first at cap); no stall with PREFS weight ≥ 1 → `noStall` sad leave + `cust:left {result:'noStall'}`; Owl `barks.wants` once per want per season; build panel "wanted by: …". | `src/systems/customers.js`, `ui/bark.js`, `ui/build.js`, `data/story.json` |
| 44C | Season demand: `seasons.json` `demand` rows S2–S10 (one HOT ≥ 1.3 + one COLD ≤ 0.7, never the same two seasons in a row, S10→S11 wrap included); `SS.demandFor/hotCold` + validate; `economy.stallInfo().fair × demand` in ONE place (`eco.demandOf`); `cust.prefOf` = PREFS × demand (floor 0.3); sign HOT ▲ / COLD ▼ cone glyph (`sb.signGlyph`) beside the board; bus `season:demand` + Owl `barks.demand` once per season; build panel "HOT/COLD this season ×m". | `data/seasons.json`, `src/systems/seasonScript.js`, `economy.js`, `customers.js`, `src/Game.js`, `ui/build.js`, `data/story.json` |
| 44D | Close: funnel re-measure (FUNNEL_BASELINE "44D": reach S2 100 %, hands 86.3 %) → **45Z UNGATED** · islands decision **NO** · versions S47 · hero shots `44_hot_sign.png`, `44_price_bubble.png` (glyph measured and moved beside the board) · Bible S47 · this file. | `src/Game.js`, `ui/index.js`, `tools/hero_shot_44.mjs`, `LUMEN_extras/game/docs/screenshots/44_*.png`, `docs/FUNNEL_BASELINE.md` |

### What the player sees now
Every customer *reacts*: a ♥ / ✓ / ✗ speech glyph with the price they paid (or refused), the stall's hanging sign turns green → white → amber → red with how fair your price is, Glimmers show a little stall icon for what they came for and walk away sad when nobody sells it, and from S2 each season has one HOT ▲ and one COLD ▼ good shown on the sign and announced once by the Owl. Prices are changed in the world: walk to the sign, tap E for +1, hold for −1.

### Bible §2 lines added (content rules, from HANDOFF_44Z "Rules that bite")
1. A price bubble is a reaction, never a prompt: ≤ 2 on screen, never blocks input, never pauses.
2. Every number the player can change (price) must be changeable **in the world** (E on the sign); the panel is the second way.
3. Demand multipliers are visible before they bite: HOT/COLD tag on the sign at season start, the Owl says it once.
4. No stall type may be wanted by zero types in any season (`demand` cannot push a PREFS weight to 0; floor 0.3).
5. Phase 44 adds no modal, no new panel, no new ability.

### Measured
Funnel 44D vs 43D vs 42B (synthetic 20, 150 s seasons): reach S2 100 % (unchanged), Spark-through-hands **86.3 %** vs 87.1 % vs 87.6 % (−0.8: `noStall` leaves + COLD kinds sell less → slightly more Spark arrives as trickle/event instead of sales). modalSeconds 0–90 s = 0.0. **45Z UNGATED** (hands ≥ 80 %, reach S2 ≥ 40 %).
Glyph: tea sign board world y 1.44…2.15; glyph (old) y 2.54 → floated above the awning; (new) y 1.78 beside the board's right edge (`44_hot_sign_before.png` vs `44_hot_sign.png`).

### Islands decision (MASTER_PLAN_V6 §3 "THEN islands")
**NO.** 17B+ (regions / biomes / World v3) stay frozen through the 2026-11-15 jam; phase 45 ships v3 on one island. The overturn condition (reach S3 ≥ 40 % on real players AND ≥ 10 chats of credit before Nov 12) is not met: synthetic reach S3 is 100 % but no itch telemetry exists yet, and credits are short.

### Gates
`node tools/check.mjs --pricing --wants --seasons --build` → OK · `node tools/check.mjs` → ALL OK · `node --test tests/seasons.test.mjs` → 5 pass.
