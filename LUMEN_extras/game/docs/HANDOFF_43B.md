# HANDOFF 43B — Novelties: S2 storm warning, S3 night market (2026-11-03, CLOSED)

## Done
- `src/systems/novelties/index.js` — `NOVELTIES` registry + `createNoveltyRegistry(sb)` (one active, `sb.novelty`, bus `novelty:start/end`, unknown id → sb.log line, start() exceptions caught into sb.log).
- `src/systems/novelties/stormWarning.js` — darken 25 % (2 s ramp, yields to storm.js once `intensity > 0.05`), `storm.warn()` once, Owl bark, Protect tag highlight, follow-up bark on `eco:event storm` (absorbed → "Insurance paid off", else repair cost `{cost}`). No modal, no meshes.
- `src/systems/novelties/nightMarket.js` — key/hemi → 0.35 over 3 s, `cust.spendMult = 1.3`, `till.setSpillMult(2)`, `hud:chip night` on/off, Owl bark, P2 lanterns = stall sign materials emissive gold (≤ 4, no new meshes, skipped headless). `end()` restores lights/mults/chip/emissive.
- `Game.js`: import + `installNovelties` (5 lines), `sb.novelties.update(dt)` in the clock-held branch, `destroySandbox → novelties.dispose`, scheduler `warn` mark skips `storm.warn()` if phase already `warn`.
- `till.js`: `T.spillMult` / `T.setSpillMult(m)`; spill = `min(over, over × SPILL_PCT × spillMult)`.
- `customers.js _settle`: `price` and `fair` × `this.spendMult` (mood/happy ratio unchanged; the ×1.3 reaches `eco.sell` → till).
- `data/story.json barks.seasonNovelty.stormWarning[3] / nightMarket[3]` (≤ 60 chars, `{speaker,text,ttl}`).
- `tools/gates/novelties.mjs` + `check.mjs --novelties` → ALL OK; full `node tools/check.mjs` ALL OK.

## Missing
- P2 fireflies (pack1 sparkle emitter) — not done. Wind SFX on warn — not checked (Audio.js `sfx('wind')` existence unverified).
- P3 `demo_novelties.html` — not built.
- `hud:chip` listener: nightMarket emits `hud:chip {id:'night', text, on}` but index.html/main.js has no generic chip listener yet (42D pier chip is hard-wired). Add one in 43C/43D (≤ 10 lines: a `<div class="chip" data-id>` toggled by the event) or the night chip is invisible in the real game.
- Night market lanterns only glow on stall signs; `landmarks.js` lantern props were not touched (API unknown, saved credits).
- Funnel synthetic 20 not re-measured (no gameplay-balance change expected: ×1.3 for 40 % of one season).

## Measured
- Gate: S2 start @ day 0.22, storm.warn ×1, lights restored to pre ±1e-3 after the storm clears (storm.js restores its own snapshot — the novelty only restores when `storm.phase !== 'storm'`); S3 start @ 0.60, key 1.6 → ≤ 0.4 within 3 s, spend 5 → 6.5, spill ×2, 0 leaked listeners.

## Suspected
- Light-restore ORDER: if a storm starts *while* nightMarket is active (not in the S2/S3 script, but endless rotation could), storm.js snapshots the already-dimmed lights as its base and restores to the dim value. Fix if it bites: let storm.js re-snapshot from a `game.lights.base` instead of live intensity.
- `spendMult` scales `fair` too, so an overpriced stall stays "overpriced" at night — intended (mood unchanged), but balance.md was not updated.

## Notes for the integrator (43C)
- Add a novelty: new file exporting `createX() → { id, start, update, end, dispose }`, register in `NOVELTIES` (index.js), add `"novelty": { "id": "x", "at": 0.xx }` to the season row in `data/seasons.json`. Nothing else.
- `baronVisit` (S4 row already points at it): `scamKind 'baron'` already skips the NPC/offer in the scheduler; the novelty should drive `sb.pier`.
- Restore order inside `end()`: lights → mults → chip → materials; the registry calls `end()` then `dispose()`; `R.start` ends the previous novelty first.
