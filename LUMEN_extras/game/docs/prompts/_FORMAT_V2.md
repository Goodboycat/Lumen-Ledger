# PROMPT FORMAT v2 — every `docs/prompts/<ID>_*.md` written from phase 17 on MUST have exactly these sections (≤ 60 lines)
*Z-chats copy this file, fill it, never add code. ID chats read only their own prompt + what it names.*

```
# Chat <ID> — <title, ≤ 8 words>
Needs: <IDs whose HANDOFF this builds on>      Blocked-by: <IDs that must have a README row first; next.sh skips this ID until they do>
Owned (only these files): <paths>  (+ check.mjs additive section · + barrel line in src/.../index.js if any)
Read (max 8 credits): START_HERE.md → VISION_V2.md §<n> → this → API_CONTRACTS §<n> → HANDOFF_<id>.md (only the "Notes for the integrator")
Export (API_CONTRACTS section this ID ADDS, ≤ 6 lines): <function signatures / bus events / data shape>

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- <item 1: the smallest end-to-end thing: builds → renders in demo → check.mjs line>
- <item 2> …
### P2 — should ship (≈ 15 credits)
- …
### P3 — nice to have (≈ 10 credits, only if P1+P2 are written to disk)
- …

## Demo page `game/demo_<id>.html` (or "none — pure logic, tests/<id>.test.mjs instead")
<what key/button cycles what; window.game set; stats shown>

## check.mjs section `--<flag>` (additive; name it `<ID> <TITLE>`)
<3–6 bullet asserts, headless, ≤ 2 s run: build each thing · run each anim/fight 2 s · counts (meshes ≤ budget) · bus events fired>

## Budgets (per item, draw calls incl. outline): <prop ≤ 10 · creature ≤ 12 · boss ≤ 24 · VFX ≤ 6 · whole demo ≤ 180>
## Content rules that bite here: <the one or two Bible §2 / VISION §7 lines relevant to this ID>
## Handoff `docs/HANDOFF_<ID>.md`: Done / Missing / Measured / Suspected / Notes for the integrator (≤ 15 lines)
```

## Sizing rules (MASTER_PLAN_V5 §4)
P1 must be closable alone in 25 credits by a chat that has never seen the repo. If not → split into `<ID>1`, `<ID>2` when writing.
Max 10 prompts per Z. Each prompt ≤ 60 lines ≤ 1 Write. wip.sh after each prompt file.

## What a Z-chat does, exactly (≈ 30 credits, then it continues into its first ID)
1. `bash tools/next.sh` → `NEXT: <N>Z` → read `docs/prompts/<N>Z_plan_phase.md` (the phase brief) + VISION_V2 §2–§5 rows for the phase + the
   HANDOFF "Notes" of the previous phase's last ID (patterns to copy, e.g. 18's enemy file layout for 19).
2. Write `docs/HANDOFF_<N>Z.md` with the ID list as its Missing list → wip.sh.
3. For each ID: write the prompt (this format) → wip.sh. Tick it in the HANDOFF.
4. Append the IDs to README "## Next" **right after `<N>Z`** (same line, same order) → add the README "Done" row for `<N>Z` → commit+push.
5. `bash tools/next.sh` → it now prints `<N>A` → start it. No chat message.
