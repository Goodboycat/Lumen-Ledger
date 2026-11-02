# Chat 41B — Diegetic tutorial: five verbs, no overlay
Needs: 41A barks · 10D installTutorialGates · 5 build · 10B coins (`sb.dropTip`) · S36 drag props · decor crate (1D)      Blocked-by: 41A
Owned (only these files): ui/tutorial.js (rewrite; keep the export names `mountTutorial/destroy` so index.js compiles), ui/tutorial.css, src/Game.js (`installTutorialGates` replaced by `installVerbChain`, ≤ 60 lines), data/story.json `tutorial` (new shape), check.mjs (additive `--verbs`), tools/qa_tutorial.mjs (update the asserts to the new flow)
Read (max 8 credits): START_HERE.md → MASTER_PLAN_V6.md §0–§1, §5–§6 → this → HANDOFF_41A Notes → Game.js 1034–1078 (tutorial gates) + 291–346 (coins/abilities) → ui/tutorial.js header (what it does today, 30 lines)
Export (API_CONTRACTS "Verb chain (41B)", ≤ 6 lines):
  `installVerbChain(lg) → V` · `V.steps = ['move','coin','bonk','stall','deposit']` · `V.step` (index | -1 done) · `V.skip()` · serialize `{verbStep}` in save v2 (41D owns save.js; until then keep it in `lg.story` state)
  Each step: `{ id, hint:string (≤ 40 chars, from story.json tutorial[id]), anchor:'hero'|'coin'|'crate'|'buildSlot'|'jar', done:(sb)=>bool, setup:(sb)=>void, maxS:10 }` — `setup` makes the world ready (drops a coin 2 u ahead, spawns a crate 4 u ahead, highlights a free 2×2 cell, lights the Save jar); `done` is checked every frame.
  bus: `tut:step {id, index}` · `tut:done {seconds}` · `tut:skip`. The **season clock does not run** until `tut:done` (sb.eco paused via the existing OR-ed pause reasons, `reason:'verbs'`).

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `installVerbChain`: the five steps in order, one floating hint at a time (reuse `story:bark`-style bubble via `ui/tutorial.js` but anchored to the *target*, not Pip, plus the existing keycap chips WASD/Space/E/B). `move`: done when Pip moved ≥ 3 u. `coin`: `setup` drops one tip coin 2 u ahead (`sb.dropTip`), done on `eco:spark reason tip:walk`. `bonk`: `setup` places a decor crate 4 u ahead (`makeProp('crate')`, hp 1); done when the sword hits it → it bursts into 3 coins (coinBurst VFX) — so the sword's very first job pays. `stall`: open the build tray (B) with the fruit stall pre-selected and a highlighted free cell; done on `build:placed stall_*`. `deposit`: until 42B exists, done when the player opens the jars panel and APPLIES ≥ 10 % to Save (`ui:jar:apply`); when 42B lands it swaps to "walk to the Save jar, press E" (42B edits only the `done/setup` of this step).
- If a step is not done within `maxS` (10 s), the hint pulses and the keycap chip grows; after 25 s the step auto-completes with the Owl bark "Later, then." (never blocks the player).
- `ui/tutorial.js` rewrite: no full-screen cover, no Next/Back, one Skip chip bottom-right (touch 44 px). No keydown swallowing. Old 11-step overlay code is deleted, not kept behind a flag.
- `story.json` `tutorial`: `{ id, hint }` ×5 + the 10D first-action toasts are reduced to 3 (`endSeason`, `upgrade`, `collector`); everything else is a verb step now.
- `check.mjs --verbs` (below).
### P2 — should ship (≈ 12 credits)
- Resume: a save taken mid-chain restarts at the current step (coins/crate re-setup), a save after `tut:done` never shows the chain again.
- Touch (360×800): hints clamp; the `stall` step confirms placement with the existing touch confirm (5).
### P3 — nice to have (≈ 5 credits)
- `tools/qa_tutorial.mjs` drives the chain headfully and asserts `tut:done` ≤ 60 s with scripted inputs; 3 screenshots max.

## Demo page: none — index.html with `?verbs=1` jumps straight to the chain (skips title).

## check.mjs section `--verbs` (additive; name it `41B VERBS`)
- headless createLumenGame + start → `tut:step move` at t 0; the eco clock is paused (`eco.state.day01` stays 0 for 5 s simulated).
- script: move hero 3 u → `tut:step coin`; a coin exists ≤ 2.5 u ahead → walk over → `tut:step bonk`; crate exists → `sb.hero` attack it → crate gone + 3 coins + `tut:step stall`; scripted `ui:build` + place → `tut:step deposit`; `ui:jar:apply {save:+10}` → `tut:done` with seconds ≤ 60 (simulated) and the eco clock now advances.
- auto-complete path: do nothing for 25 s per step → chain ends, 5 barks "Later, then.", game still playable; 0 `ui:pause` from the tutorial; destroy → 0 listeners.

## Budgets: crate ≤ 6 dc (1D), coins reuse the InstancedMesh. Whole chain adds ≤ 8 dc transiently.
## Content rules that bite here (PLAN §1 test): after each hint the player's hands have something to do within 10 s; no step's hint exceeds 40 chars; no step reads as a lecture — the FinLit lesson is in the ledger card.
## Handoff `docs/HANDOFF_41B.md`: Done / Missing / Measured (tFirstStall and modalSeconds from `funnel.mjs --synthetic 20`, target ≤ 45 s / ≤ 10 s) / Suspected / Notes for the integrator (42B: the `deposit` step hook; 41C: `tut:done` is when the S1 clock starts).
