# LUMEN — Lumen Ledger · Game Bible S46 (2026-11-03)

Previous: `Game_Bible S44.md` (everything there still applies; this file only lists what S46 changed — phase 43 "Break the season template", chats 43Z–43D).
Version strings: `GAME_VERSION = 'S46'` (src/Game.js) · `UI_VERSION = 'S46'` (ui/index.js) → title-menu footer.

## S46 — Season scripts + 5 novelties + rotation (phase 43)

| ID | Change | Files |
|---|---|---|
| 43Z | Plan: season-script table S1–S10 + endless; one novelty per season; consecutive marks never equal (min gap). | `LUMEN_extras/game/docs/HANDOFF_43Z.md` |
| 43A | `data/seasons.json` (S1–S10 + `endless.rotate`) + `seasonScript.js` (`for/marks/len/validate`, legacy fallback) drive `installScheduler`; `season:mark` / `season:novelty` events; `tests/seasons.test.mjs`. | `src/systems/seasonScript.js`, `data/seasons.json`, `src/Game.js` |
| 43B | Novelty registry (`NOVELTIES[id]`, one active, `sb.novelty`) + `stormWarning` (S2: darken, `storm.warn()`, Protect-tag pulse) + `nightMarket` (S3: dusk light, `spendMult ×1.3`, spill ×2, lanterns). | `src/systems/novelties/`, `src/vfx/storm.js`, `data/story.json` |
| 43C | `baronVisit` (S4: the Baron struts in, pitches `zeroInterestLoan`, Ledger Flash → tell, sword → flee) + `pickyGlimmer` (S5: 2 critics price-check, refuse > fair×1.1, qty 2 at ≤ fair). Generic `hud:chip`. | `novelties/baronVisit.js`, `novelties/pickyGlimmer.js`, `src/systems/customers.js`, `ui/hud.js` |
| 43D | `raidDouble` (S6: two Collectors, two different tills, 2 s stagger). Rotation S7–S10 + endless `rotate[(s-6)%5]`, len 150. NEW chip (4 s, once per novelty id). Save **v3** (`novelty`, `noveltiesSeen`, migrate v1/v2, mid-season re-start). Funnel re-measure (FUNNEL_BASELINE "43D"). | `novelties/raidDouble.js`, `src/systems/enemies.js`, `src/systems/story.js`, `src/systems/save.js`, `ui/hud.js` |

### Season table (what the player meets)
S1 tutorial season (no novelty) · S2 storm warning · S3 night market · S4 the Baron in person · S5 picky Glimmer critics · S6 double raid · S7–S10 rotate night/baron/picky/storm · S11+ repeat S6–S10 forever.

### Bible §2 lines added (content rules)
1. One novelty per season, never two; the registry ends the previous one before starting the next.
2. Consecutive season marks (trickle/warn/event/scam/wave/novelty) are never equal; the min-gap rule holds across the S10→S11 wrap.
3. Two raiders must be beatable with one shield + one sword: telegraphs 1.2 s each, staggered ≥ 2 s, never simultaneous.
4. "NEW: …" chip is non-modal, 4 s, shown once per novelty id per run (`noveltiesSeen`).
5. Every novelty re-enters cleanly from a save (`start` is re-entrant; nothing is re-armed if the wave already fired).

### Measured
Funnel 43D vs 42B (synthetic 20, 150 s seasons): reach S2 100 % (unchanged), Spark-through-hands 87.1 % vs 87.6 % (noise). **44Z UNGATED.**

### Gates
`node tools/check.mjs --seasons --novelties --save` → OK · `node tools/check.mjs` → ALL OK · `node --test tests/seasons.test.mjs` → 5 pass.
