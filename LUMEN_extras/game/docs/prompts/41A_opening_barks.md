# Chat 41A — Opening 9 lines → 2 barks over the walk-in
Needs: 8B StorySystem · S18 cinematics (walk-in) · 7B dialogue      Blocked-by: 40B
Owned (only these files): data/story.json (`seasons[0].opening` + new top-level `barks`), src/systems/story.js (kind `bark`, ≤ 25 lines), ui/bark.js + ui/bark.css (new), ui/index.js (mount + destroy lines), check.mjs (additive `--barks`)
Read (max 6 credits): START_HERE.md → MASTER_PLAN_V6.md §0–§1, §6 → this → story.js lines 1–80 (queue + kinds) → ui/dialogue.js header (bus names) → Game.js installCinematics (617–648) only
Export (API_CONTRACTS "Barks (41A)", ≤ 5 lines):
  story.json: `barks: { walkIn: [{speaker, text, at:sec}], firstCoin: [...], firstStall: [...], firstDeposit: [...] }` (≤ 1 line each, ≤ 60 chars)
  bus: `story:bark {speaker, text, anchor:'hero'|'owl'|'baron'|{x,y,z}, ttl}` → `ui/bark.js` draws a small speech bubble projected from the 3D anchor (same projection helper the nudge arrows use), fades after `ttl` (default 3.2 s), max 2 on screen, never pauses the game, never swallows input.
  `mountBarks({ bus, camera, container, worldToScreen }) → { update(dt), destroy() }`

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 20 credits)
- `story.json`: `seasons[0].opening` cut to **2 lines** (Owl: the one sentence that states the goal — pay the Baron, keep the lantern lit; Pip: one line of intent). Move the 7 cut lines into `barks.walkIn` with `at` seconds spread over the existing walk-in cinematic length (read it from `installCinematics`; if the cinematic is shorter than the bark spread, drop lines, never extend the cinematic). The FinLit content of the cut lines is not lost: 41B's hints and the S1 ledger card carry it.
- `story.js`: on `game:start` (not resumed) emit `story:bark` for each `barks.walkIn` line at its `at` (use the existing `update(dt)` clock); `barks.firstCoin/firstStall/firstDeposit` fire once on `eco:spark reason tip:*`, `build:placed stall_*`, `jars:deposit` (42B; absent = never). Serialize `barksPlayed`.
- `ui/bark.js`: DOM bubbles, CSS from `dialogue.css` tokens (same font/colours), tail pointing down at the anchor, `pointer-events:none`, `aria-live=polite`. Update projects anchors each frame (reuse `ui/nudge.js`'s world→screen if exported; else 6 lines of `Vector3.project`). Touch layouts (360×800): bubble clamps inside the viewport.
- `check.mjs --barks`: headless story walk → 2 opening lines in the dialogue queue (was 9), ≥ 5 `story:bark` events during the first 12 s, 0 `ui:pause` caused by barks, barks replay = none on resume.
### P2 — should ship (≈ 10 credits)
- Mid-season line (`seasons[n].mid`) becomes a bark too (Owl anchor) — removes one modal per season. Keep `ledger` lines modal (they belong to the ledger card).
- Opening lines for seasons 2–10 trimmed to ≤ 2 each (data only); the surplus → `barks.seasonStart[n]`.
### P3 — nice to have (≈ 5 credits)
- Bark SFX hook `audio` event `bark` (soft pop) via DEFAULT_EVENTS (12).

## Demo page: `game/demo_barks.html` — keys 1–4 fire each bark group at the hero/owl; shows count on screen; `window.game` set.

## check.mjs section `--barks` (additive; name it `41A BARKS`)
- story.json validates: every bark ≤ 60 chars, speakers ∈ 7B set, `seasons[0].opening.length === 2`.
- headless game start → `story:bark` count ≥ 5 within 12 s simulated; dialogue `story:line` groups at start = 1 (the 2-line opening).
- resume from a save → 0 barks replayed. `mountBarks` with domshim → update 60 frames, destroy → 0 listeners, 0 nodes left.

## Budgets: 0 draw calls (DOM). ≤ 2 bubbles visible.
## Content rules that bite here (PLAN §6): no new modal; the opening may not exceed 2 lines; a bark never contains a number the player cannot see in the world.
## Handoff `docs/HANDOFF_41A.md`: Done / Missing / Measured (modalSeconds(0–90 s) before/after via `funnel.mjs --synthetic 20`) / Suspected / Notes for the integrator (41B uses `story:bark` for its hints; speaker/anchor names).
