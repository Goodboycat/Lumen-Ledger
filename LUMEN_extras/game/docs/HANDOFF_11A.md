# HANDOFF 11A — Performance pass (CLOSED 2026-10-19)

Owned: perf-only edits anywhere · `docs/PERF.md` · `src/systems/perf.js` (new) · `check.mjs --world` budget lines · `check.mjs --perf`.
Start point (10D master): `check.mjs --world` worst-case 434 visible meshes; browser smoke index.html 162, in play 169–253 (10B/10D).
Spread over two chats (the first was axed after P3; this one wrote PERF.md, the index.html perf stats, the browser smoke, and closed).

## Done
- [x] **P1.0** measurement fix: `meshCount` in check.mjs counts like the renderer (`traverseVisible`) — 434 → 353 worst-case (the helper `held` crates etc. were never drawn).
- [x] **P1.1** Lever 1 glimmers: `fuseGlimmer` in `src/assets/creatures/glimmers.js` — body + static kit + core → ONE toon mesh + ONE hull + ONE flat mesh (glimmers 8–11 → 6–8 m; 12 glimmers 117 → 82). `merge.js` keeps vertex colors when re-merging merged meshes.
- [x] **P1.3** Lever 3 `BlobShadows` (`src/systems/perf.js`): every creature shadow disc (hero, glimmers, helpers, villains) → one shared InstancedMesh (−21 in the demo world, −20…30 in play). Wired via `installPerf/updatePerf/perfRoots` in `src/Game.js`; `opts.perf === false` opt-out for demos.
- [x] **P1.4** Lever 2 `bakeShells()` (`src/assets/props/bake.js`): static shells of live props (lanterns, jars, landmarks, signs) baked per zone → 4 batches; only glass / fill / glow / beam stays live (88 → 52 m). Wired in `Game.js` + `check --world`.
- [x] **P1.5** `WORLD_BUDGET` 480 → 320 (= 292 measured + 10 %); before/after table in `docs/PERF.md`.
- [x] **P2.1** `CreatureLOD`: classify accessory hulls / body hulls / flat bits per root once (`root.userData.lod`), tiers 0/1/2 at 18 / 26 u with 1 u hysteresis and one-tier-per-update un-hiding (no 2→0 pop). Demo world 271 → 259 near → 160 far; dispose restores.
- [x] **P2.2** `PixelRatioGovernor`: fps < 45 for 3 s → drop one step (1.5 → 1.25 → 1.0 → 0.85), fps > 58 for 10 s → raise one step (≤ quality cap / devicePixelRatio), `perf:pixelRatio` bus event, dispose resets. Needs a renderer so it is skipped headless; `game.quality` presets from `ui:settings` remain the cap.
- [x] **P3** memory: `customers.js` `POOL_CAP_PER_TYPE = 3`, `_dispose` frees fused merged geometry + totals pool; `destroySandbox` exported and frees baked batches / merged creature geometry / pools / instanced fields → scene empty (0 meshes, 0 geometries). `countGeometries(scene)` helper.
- [x] `check.mjs --perf` section: governor timing / band / cap / dispose asserted · S1→S7 headless 130 s memory probe (geometries 148 → 234, bound 372, customers created = disposed) · destroy → empty scene. `--world` asserts BlobShadows / LOD near / LOD far / dispose-restores.
- [x] `docs/PERF.md` — before/after table, per-item breakdown, in-play numbers, governor + memory notes, where the remaining calls are.
- [x] `index.html` debug overlay (`?debug` or F3) now also shows `dpr · shadows <n> · lod near/mid/far`.
- [x] Browser smoke (once, SwiftShader): `index.html?autoplay&debug` → **133–135 draw calls in play**, 187 meshes + 92 outlines, ERRORS none. Shots in `screenshots/11A_perf/`.

## Missing
- **P1.2** villains/helpers rigid-part merge (hat→head, scroll→tool) — not done. Helpers 58 / villains 46 m are already inside their Bible budgets; the expected gain (−15…20) did not justify touching the animators' part lists. Candidate for 11B/13A polish if numbers are needed.
- **Stall per-level bake** (6 stalls = 46 m) — not done; the level-swap Sequence needs live parts. −~25 available if a stall is re-baked after `setLevel` settles.
- **≤ 100 typical / ≤ 150 peak as a check.mjs gate** — not asserted. `--world` places all four zones in view (292 content-only, 160 at far LOD) and would always fail; per START_HERE rule 9 the budget is recorded as a measurement. The browser figure at real game zoom (133–135 dc) is inside the ≤ 150 line.
- **60 fps on 4× CPU throttle** — not measurable here (SwiftShader software GL reports 20 fps for every page). The governor is the safety net; 11B mobile QA should verify on a device.

## Measured
| Scene | Visible meshes / draw calls |
|---|---|
| demo world, content only (`--world`) | 434 (10D) → 353 (count fix) → 316 (fuseGlimmer) → 292 (bakeShells) |
| demo world + perf.js | 271 near · 259 LOD-near · **160 LOD-far** |
| `createSandbox` start (`--sandbox`) | 255 |
| S1→S7 headless (`--perf`) | 145 → 219 meshes · 148 → 234 geometries (bound 372) · destroy → 0 / 0 |
| endless after S10 win (`--game`) | 426 kept (4 zones + full wave) before LOD |
| **browser `index.html?autoplay` in play** | **133–135 dc** · 83 k tris · 187 m + 92 outlines · dpr governed · ERRORS none |

Per item (content only): glimmers 82 · helpers 58 · villains 46 · stalls 46 · live decor/landmarks 52 · baked static 11 + shells 8 · fields 8 · island ~20.

## Notes for the integrator
- `sb.perf = { shadows, lod, governor, roots, dispose }` lives on the sandbox; `destroySandbox` calls `sb.perf.dispose()`. Demos that measure per-creature numbers pass `createSandbox(game, { perf: false })`.
- `CreatureLOD` reads `root.userData.parts` / mesh names to classify hulls once; a creature pack that adds new accessory names should tag them `userData.lodAcc = true` (or name them `*Hull`) to be LOD-able. Un-hiding is deliberately one tier per update.
- `PixelRatioGovernor` only exists when `game.renderer` exists. `ui:settings quality` still sets the cap through `game.setQuality`; the governor never raises above it. Listen to `perf:pixelRatio` if the HUD wants to show it.
- `BlobShadows` hides each creature's own `parts.shadow` disc but keeps reading its animated scale, so the animators are untouched. Capacity grows ×2 automatically.
- `check.mjs --world` budget is `WORLD_BUDGET = 320` content-only. Tighten only after a new lever lands (measured + 10 %).
- 12 audio: the governor's `perf:pixelRatio` event is a good place to also lower music quality / voice count if needed.
- 11B mobile QA: measure on a real device with `?debug` (overlay shows fps · calls · dpr · lod); the governor should settle at 1.0–0.85 on mid phones.
