# Chat 43B — Novelties: S2 storm warning, S3 night market
Needs: 43A (`season:novelty`) · 9B/S17 storm.js (warn/hit/clear) · 42A till.js (spill) · 41A barks      Blocked-by: 43A
Owned (only these files): src/systems/novelties/index.js (new registry), src/systems/novelties/stormWarning.js (new), src/systems/novelties/nightMarket.js (new), src/Game.js (`installNovelties` ≤ 25 lines: registry start/update/end on `season:novelty` / `eco:season`), data/story.json (`barks.seasonNovelty.stormWarning[]` 3 lines, `nightMarket[]` 3 lines, ≤ 60 chars), tools/gates/novelties.mjs (new), tools/check.mjs (additive `--novelties`)
Read (max 6 credits): START_HERE.md → HANDOFF_43Z.md → HANDOFF_43A.md "Notes" → this → vfx/storm.js API (warn/hit/clear) → till.js (TILL_CAP, spill) → customers.js spend/mood hooks → Game.js lighting (sun/hemi names)
Export (API_CONTRACTS "Novelties (43B)", ≤ 6 lines):
  Novelty interface `{ id, start(sb, season), update(sb, dt), end(sb), dispose() }` · `NOVELTIES[id]` registry · `sb.novelty` = active instance or null · bus `novelty:start {id, season}` · `novelty:end {id}`.
  `stormWarning`: at `at` the sky darkens 25 % + `storm.warn()` + Owl bark; Protect jar tag pulses (jarsWorld.highlight('protect', true)); S2's event is **forced `storm`** (43A `forceEvent`); if the jar covers it → bark "Insurance paid off", else bark the repair cost. No modal.
  `nightMarket`: from `at` to season end: sun/hemi intensity → 0.35 over 3 s, lantern props emissive on (`landmarks` / stall lantern meshes), customer `spendMult ×1.3`, `TILL_SPILL` above cap ×2 (`till.setSpillMult(2)`), HUD chip "NIGHT MARKET — collect your tills"; `end()` restores. 
  Both run on the game clock (pause with `holdClock`).

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `novelties/index.js` registry + `Game.js installNovelties` (one active at a time; `eco:season` → `end`; `destroySandbox` → `dispose`).
- `stormWarning.js` P1: darken, `storm.warn()`, Owl bark, jar highlight; listen `eco:absorbed`/`eco:event` for the follow-up bark. 
- `nightMarket.js` P1: light dim/restore, spend ×1.3 (customers.js already exposes `spendMult`? if not, `eco.state.mood` is the fallback knob — note in HANDOFF), till spill ×2, HUD chip via `hud.chip('night', text)` (42D chip pattern).
- `check.mjs --novelties` (below).
### P2 — should ship (≈ 10 credits)
- Night lanterns: emissive gold on `landmarks.js` lantern + stall sign meshes; fireflies = reuse `pack1` sparkle emitter (≤ 2 dc).
- Storm warning: cloud shadow sweeps the plaza (storm.js `warn` already does clouds — just verify + a wind SFX via Audio.js `sfx('wind')` if present).
### P3 — nice to have (≈ 5 credits)
- `demo_novelties.html`: keys 2/3 start each novelty, E ends; stats show light intensity, spendMult, spillMult.

## Demo page: `game/demo_novelties.html` (P3) or none.

## check.mjs section `--novelties` (additive; name it `43B NOVELTIES STORM/NIGHT`)
- headless game S2: `novelty:start stormWarning` at day ≥ 0.22, `sb.nextEvent === 'storm'`, `storm.warn` called once, bark emitted · season end → `novelty:end`, lights restored to pre values (±1e-6).
- S3: `nightMarket` start at ≥ 0.60 → sun intensity ≤ 0.4 within 3 game-s, `till.spillMult === 2`, customer spend ×1.3 (one scripted sale compares price×1.3) · `eco:season` → all three restored.
- Only one `sb.novelty` at a time; destroy → 0 leaks; `--seasons --game --till` still ALL OK.

## Budgets: night lanterns ≤ 4 dc total · fireflies ≤ 2 dc · no new meshes for stormWarning.
## Content rules that bite here (Bible §2): the storm must be survivable without Protect (debt grows, spoken) · night market never hides the tills (lanterns light each counter).
## Handoff `docs/HANDOFF_43B.md`: Done / Missing / Measured (funnel synthetic 20: Spark-through-hands, S2 reach) / Suspected / Notes for the integrator (43C: registry add pattern, light restore order).
