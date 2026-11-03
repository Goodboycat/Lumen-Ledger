# HANDOFF 44C — Demand moves with the season (2026-11-03, chats 44C-1 + 44C-2)

## Done
- [x] P1a `data/seasons.json` `demand` rows S2–S10 (exactly one HOT ≥ 1.3 + one COLD ≤ 0.7 per row; hot/cold never repeat the previous season, incl. S10→S11 endless rotate).
- [x] P1b `seasonScript.js` `SS.demandFor(season)` → `{kind: mult}` (`{}` on S1 / legacy) · `SS.hotCold(season)` → `{hot, cold}` · `validate()` checks bands + exactly-one + no consecutive repeat.
- [x] P1c `economy.js` `opts.demandFn(kind, season)`; `stallInfo(id)` multiplies `fair` in ONE place (`{...base, fair, baseFair, demand}`) · `eco.demandOf(stallId)` → mult (1 when none). Game.js wires `demandFn: (kind, s) => sb.seasons.demandFor(s)[kind] ?? 1` and re-tints every sign on `eco:season`.
- [x] P2a `customers.js` `cust.prefOf(c, kind)` = `PREFS[type][kind] (1 unlisted) × economy.demandOf(kind)`, floor 0.3 — THE one helper; `pickStall`, `wantOf`, `_want` (found) read through it. A HOT season can flip a type's want (S3 saver → tea).
- [x] P2b Game.js `sb.signGlyph(id)` — HOT ▲ warm cone / COLD ▼ cool cone child of the sign pivot (shared geo+mat, hidden when ×1), refreshed from `sb.signTint` · `sb.demandGlyphOf(id)` → `'hot'|'cold'|null` · bus `season:demand {season, hot, cold}` + Owl `story:bark {kind:'demand'}` once per `eco:season` (S≥2) from `story.json barks.demand[3]` (`{hot}`/`{cold}`).
- [x] P2c gate `check.mjs --seasons` "44C SEASON DEMAND" (`tools/gates/seasons.mjs`): P1 line + P2 line (prefOf 2.25 / floor 0.3 / unlisted 1 · S3 saver wants tea · season:demand S2,S3 · Owl ×2 no `{}` · glyph hot/cold/null). `tests/seasons.test.mjs` +1. Full `node tools/check.mjs` ALL OK.

## Missing (closed by 44D, 2026-11-03)
- ~~P3 hero shot~~ → `tools/hero_shot_44.mjs` (boots index.html, forces S3, frames the tea sign) → `screenshots/44_hot_sign.png` + `44_price_bubble.png`. The `(0, 0.42, 0.08)` glyph **floated 0.43 u above the awning** (`44_hot_sign_before.png`, glyph y 2.54 vs board top 2.11); under the board it overlapped the goods → now `(0.56, -0.32, 0.1)` beside the board's right edge at mid-height (board spans y −0.64…0, half-width 0.43).
- ~~`ui/build.js` HOT line~~ → stall detail shows `HOT this season ×1.5` / `COLD this season ×0.6` (`.bm-demand.hot/.cold`) via `api.demandOf(id)`, wired in Game.js next to `costOf` (`sb.eco.demandOf`).

## Measured
- S3: tea fair 5 → 8 (×1.5), tool ×0.6; untouched price 5 → ratio 0.63 → love band. Saver tea pref 1.5 × 1.5 = 2.25 beats fruit/bread 2.

## Suspected (not touched)
- `economy.sell` mood thresholds and the 43C critic rule follow the demand-adjusted fair automatically (one place) — intended; nothing else reads `config.stalls[k].fair` directly except `stallInfo`.

## Notes for the integrator
- Anything that needs "is this kind hot/cold now" → `sb.demandGlyphOf(id)` or `sb.seasons.hotCold(season)`; never read seasons.json rows directly.
