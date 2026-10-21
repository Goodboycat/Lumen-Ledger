# Chat 15D — Bible v2 + API_CONTRACTS v2 + IMMERSION + FINLIT_V2 docs + tools v5
Needs: VISION_V2 · MASTER_PLAN_V5 · 15A–15C HANDOFFs      Blocked-by: 15C
Owned (only these files): docs/GAME_BIBLE.md (v2 sections — edit, keep §2 content rules verbatim), docs/API_CONTRACTS.md (append "v2" part), docs/IMMERSION.md (new),
  docs/FINLIT_V2.md (new), docs/BUGS.md (new, empty table), tools/next.sh (Blocked-by + Standby support), tools/check.mjs (`--all` flag = every section), docs/GDD.md (§1 pitch → v2 pointer only)
Read: START_HERE → VISION_V2 (all) → MASTER_PLAN_V5 §5 → this → HANDOFF_15A/B/C Notes. No code files.
Export: docs only + two tool behaviours (below).

## Build in THIS order. wip.sh after EVERY file. Docs ≤ 120 lines each, written in two Writes (skeleton → Edit).
### P1 — must ship (≈ 25 credits)
- **tools/next.sh v5**: (a) skip any ID listed under README `## Standby`; (b) if the ID's prompt has `Blocked-by: X Y` and X or Y has no README "Done" row →
  print `BLOCKED <ID> by X` and continue to the next ID; (c) accept IDs like `18C1`, `28F3` (regex `[0-9]{1,2}[A-H]?[0-9]?` + `Z`); (d) print `PHASE: <N>` and the
  VISION §2 row for biome phases. Test: `bash tools/next.sh` prints the first unblocked ID; `bash tools/next.sh --list` prints every Next ID with done/blocked/standby.
- **GAME_BIBLE.md v2**: §1 → 5-line v2 pitch + pointer to VISION_V2; §2 content rules unchanged + "mutated animals, cured not killed" lines (VISION §7);
  §3 visual bible + "weather & atmosphere are toon too: flat-colour particles, no textures, no bloom" + VFX rule "special powers = multi-mesh shader VFX
  (additive toon ramps, UV-scroll bands, vertex-displaced shells), never a single sprite, never a screen flash"; §5 tech + `src/combat src/powers src/puzzles
  src/world/regions` layout; §6 ownership map from MASTER_PLAN_V5 §5; §7 NEW "Frozen in v2": only `src/core/{Toon,Outline,EventBus,Input}.js`, `anim/{Easing,Tween,Sequencer,SquashStretch}`, `geo.js`, `vendor/`.
### P2 — should ship (≈ 15 credits)
- **API_CONTRACTS.md v2 part**: copy the Export blocks of 15A/15B/15C exactly as shipped (read the HANDOFFs), then **reserve** section stubs with the signatures
  from MASTER_PLAN_V5 §5 for: `Enemy` (16A: `createEnemy(def) → {root, hp, state, update(dt), hit(dir,power,src), onDeath}`), `Power` (18D+: `{name, key, move, traverse(ctx), puzzleHook(ctx), finlit:{lesson, mission}}`),
  `Region` (17A), `Puzzle` primitives (17C: Switch/Door/Pylon/Anchor/Mirror/Platform with `state`, `solve()`, bus `puzzle:*`), `Mission` (24E), `Gather/Cook` (26A/B), `Map` (17D). Later IDs fill them; a stub says `RESERVED by <ID>`.
- **IMMERSION.md**: the checklist every biome ID must tick — weather (rain planes w/ UV scroll, snow instanced quads, lightning = sky colour pulse never a screen flash),
  ambience audio ids per biome (manifest additive, synth fallback), day/night tint per biome, footstep dust colour per ground, camera micro-sway in wind, props fade-in
  (15C), biome-specific Glimmer/customer skins at the hub after clearing, signage/readables (3 per biome), wildlife idle critters (non-enemy, 1 instanced kind per biome), parallax sky dome colour.
### P3 — nice to have (≈ 10 credits)
- **FINLIT_V2.md**: the 4 tiers from VISION §4 as a table: concept · mission text · mechanic · where (biome/campfire) · Ledger card · which power/boss it ties to. Phase 24 consumes it.
- **BUGS.md**: empty table `| # | found by | segment | repro | severity | fix ID | status |` + how playtest chats add rows (MASTER_PLAN_V5 §3).
- **check.mjs `--all`** = runs every registered section (so 29A/30A have one command).

## Demo page: none (docs + tools). Verify: `bash tools/next.sh --list`, `node tools/check.mjs --all` ALL OK.
## Handoff `docs/HANDOFF_15D.md`: Done / Missing / Notes (which contracts are RESERVED and for whom). Then README row + `next.sh` → 16A.
