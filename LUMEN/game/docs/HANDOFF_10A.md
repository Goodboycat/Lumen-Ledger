# HANDOFF 10A — Integrate world

## Done
- `demo_world.html`: Island v2 (4 zones, 1 unlocked, `starterProps:false`) + 6 stalls (1A, L1–L3) + 7 landmarks (1C) + 20 decor props (1D)
  + nature scatter (1B, 8 trees / 7 rocks / 5 bushes pools) + instanced flower/tuft fields per zone + 12 Glimmers (2A/2D) animating
  + 6 helpers working at stalls (2B) + Baron & 3 Fog Collectors (2C) + hero with all 9 moves (3A) and 6 abilities (3B) on keys
  + VFX pack1/pack2 (9A/9B: fog, debtPulse, lighthouse beam) · Z unlock zone · C camera · N night · T slow-mo · tap = hit / level-up.
- `src/assets/props/bake.js` (new): `bakeStatic(props, {parent})` merges N placed static props → ≤ 4 meshes (toon + flat + 2 hulls),
  keeps vertex colors, bakes in zone-group space (rises with unlock), disposes swayers. 69 static props → 4 batches = 11 meshes.
- `check.mjs --world`: bakeStatic unit test + whole world built & stepped 2 s headless with every animator, zone unlock, no NaN.
- CHANGE_REQUESTS applied by workaround: `starterProps:false` (1C), `makeGlimmerAny` for all 12 (2D). 2A compact-sphere note → 11A.
- `node tools/check.mjs --props --creatures --hero --abilities --economy --build --customers --ui --story --vfx --world` → ALL OK.
- **P1 smoke of every page (2026-10-19, follow-up chat):** `tools/smoke.mjs` on index.html + all 18 demo_*.html with keys 1,2 →
  **ERRORS: none on all 19**. Draw calls (final frame): index 162 · abilities 148 · build 111 · customers 124 · decor 117 · glimmers 135 ·
  glimmers2 224 · helpers 160 · heromoves 141 · landmarks 26 · nature 267 · stalls 172 · ui_hud 0 · ui_ledger 0 · ui_title 161 · vfx1 110 ·
  vfx2 132 · villains 146 · **world 424**. No failures to fix.
- **P3 CHANGE_REQUESTS applied (follow-up chat):** [2D] → `glimmers.js` now exports `registerBuilder(type, fn)` / `hasBuilder(type)`
  (additive, 2A builders never overwritten); `glimmers2.js` registers its 8 builders at import (`GLIMMER_BUILDERS_REGISTERED === 8`), so a
  plain `makeGlimmerVariant('kid')` builds the kid kit (static part) instead of the regular scarf. `makeGlimmerAny` is still the full
  path (live part + flourish). check.mjs `--creatures` asserts it. [1C] `starterProps:false` confirmed applied. [2A] sphere tris → 11A.
- **Rule 0 / GitHub (follow-up chat):** repo https://github.com/Goodboycat/Lumen-Ledger is the master; `tools/github.sh <token>` sets it
  up, `tools/wip.sh` now pushes every WIP commit. Documented in START_HERE (Rule 0), _TEMPLATE, README.

## Measured (headless mesh count = worst-case draw calls, everything in view; browser smoke showed `calls 430` at zoom 1.25)
| item | count | meshes |
|---|---|---|
| island ground + foam | 4 zones | 20 |
| stalls | 6 | 46 |
| live landmarks + decor (lighthouse, cottage, pier, 3 towers, waterfall, 4 jars, 5 lanterns, hanging sign, banner) | 18 | 90 |
| baked static (nature 51 + decor 15 + cliff) | 69 → 4 batches | 11 |
| instanced fields | 8 | 8 |
| glimmers | 12 | 117 (≈ 10 each) |
| helpers | 6 | 76 (≈ 13 each) |
| villains | 4 | 58 (≈ 15 each) |
| **total** | | **434** (prompt target was 150) |

## Missing (→ 11A perf, NOT 10A; see "Why 5 chats died" below)
- ≤ 150 draw calls. 251 of 434 are the 22 creatures, each already at/under its Bible budget (≤ 12 dc). The 150 figure was set
  before any creature was measured; it is unreachable by integration alone. 11A levers, in order of payoff:
  1. one outline hull per creature (merge body+kit hulls) → −~80; 2. share eye/accessory meshes into the kit bake → −~60;
  3. lantern/jar bodies baked, only bulb/fill live → −~40; 4. LOD: drop outlines/accessories beyond 18 u → −~60 at game zoom.
- (resolved in follow-up chat) browser smoke of every page: see Done.

## Suspected
- `game.stats.drawCalls` in a headless first frame reads fps 0 — not a bug, just frame 0.

## Why 5 chats died on this ID (read before touching 10A again)
Every chat hit the same wall: prompt says "≤ 150 draw calls", reality is 434, and the rules said "never move on with a FAIL,
never commit a FAIL". So each chat (a) tried to hit a perf target that belongs to 11A, (b) measured it with browser
screenshots (3–6 credits each) instead of `check.mjs --world` (0 credits), (c) committed nothing because the gate failed, so
(d) the next chat found the identical state and repeated. The fix (2026-10-19) is in START_HERE / _TEMPLATE / check.mjs:
budgets that an ID cannot reach within its scope are *recorded and re-budgeted*, never ground on; WIP is always committed.

## Notes for the integrator (10B)
- Everything in `demo_world.html` is plain module code: copy the "place/free/take" helpers, the stall spots and the creature
  loops into `src/Game.js`. `window.world*` globals exist only for the smoke tool.
- Static props must be baked AFTER placement and BEFORE fields are generated (fields use `occupied`).
- `island.zones[i].group` is the parent for anything that should rise with a zone unlock.
