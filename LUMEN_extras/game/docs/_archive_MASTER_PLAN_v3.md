# MASTER PLAN v3 — Lumen Ledger (process fixed after Chat 1A ran dry)

## What actually happened to Chat 1A (post-mortem, verified in sandbox)
Chat 1A wrote **all 12 stalls + a geometry merger + the catalog + the demo (~840 lines)** — the work was
~90 % done. It died because:
1. It spent the end of its budget on a **visual QA loop** (opening the page, fixing, re-opening) with no
   checkpoint zip. When credits ran out, nothing had been uploaded — the user had to dig files out manually.
2. One real bug (`setLevel` silently dropped calls during an in-flight swap → L3 never applied) made it
   think the system was broken and keep "fixing" working code.
3. The prompt asked for 12 assets × 3 levels **with no priority order**, so it built breadth first and had
   no "good enough to ship" line.
4. The prompt demanded "≤ 300 tris" — unrealistic for a 3-level stall with goods (real: 400–900). An
   impossible target wastes credits on optimisation that doesn't matter (draw calls matter, not tris).
5. It wrote its own Playwright harness from scratch (expensive). Now `tools/smoke.mjs` ships in the zip.

**So: the distribution was fine. The prompt format and the missing safety net were the problem.**

## The 5 process fixes (already applied in this zip)
| Fix | Where |
|---|---|
| **Checkpoint zip at ~35 credits**, final at 75 — mandatory | `docs/START_HERE.md` rule 2–3 |
| **P1 / P2 / P3 priority tiers** in every prompt; ship whatever tier is reached | every `docs/prompts/*.md` |
| **Smoke test tool in the zip** (`node tools/smoke.mjs demo_x.html`) — no chat re-invents QA | `tools/smoke.mjs` |
| **Short launch message** (10 lines) — all context lives in the zip, not in your paste | `docs/prompts/_TEMPLATE.md` |
| **Realistic budgets** (draw calls, not tris) + "smallest working item first" rule | START_HERE, API_CONTRACTS |

## Do you need to paste the whole prompt every time? **No.**
Paste only the 10-line block from `docs/prompts/_TEMPLATE.md` and attach the latest master zip. The chat
reads START_HERE → GAME_BIBLE → its own prompt file from inside the zip. Pasting the long original prompt
costs the chat ~5 credits of reading and dilutes the instructions. The Bible already contains everything
from the original brief (style, no-magic rules, animation spec, tech constraints).

## Chat list v3 (✅ done · 🔁 split from v2)
Phase A: 0 ✅ · 0B ✅ · 1A ✅ · 0C
Phase B (parallel, each needs only this master zip unless noted):
 1B nature 🔁 · 1D decor 🔁(new, split from 1B) · 1C landmarks+Island v2 · 2A animator+4 Glimmers 🔁 ·
 2D 8 more Glimmers 🔁(new, needs 2A) · 2B helpers (needs 2A) · 2C villains · 3A hero moves · 3B abilities (3A) ·
 4A economy core · 7A HUD · 7B ledger/dialogue · 7C title/touch · 8A story JSON · 9A VFX 1
Phase C: 4B balance (4A) · 5 build (1A ✅) · 6A customers (2A, 5) · 6B crowd (6A, 9A) · 8B story sys+GDD (8A, 4A) · 9B fog (1C)
Phase D (sequential, you merge between): 10A world → 10B systems → 10C UI+story → 10D save+tutorial
Phase E: 11A perf → 11B mobile QA/final zip · 12 audio (after 10C) · 13A jam package · 13B trailer/demo mode · 14 Flutter APK

Launch order today: **1B, 1C, 1D, 2A, 3A, 4A, 7A, 8A, 9A** (9 chats, all independent). Then 5 (needs only 1A ✅).

## Your merge routine (5 min, 0 credits)
1. Download the chat zip → unzip → copy its owned files into master `game/` (the zip contains only its files).
2. `cd game && node tools/smoke.mjs demo_<x>.html` (once: `cd tools && npm i playwright && npx playwright install chromium`).
   If you can't run Node, just open the demo via a static server and check the console.
3. Re-zip as `lumen_master_YYYY-MM-DD.zip`. That's what you attach to the next chats.
4. If a chat failed: use the "finish it" block in `_TEMPLATE.md`. Never restart a task from zero.

## Timeline (Oct 17 → Nov 15)
- Oct 17–20: 0C + 9 parallel Phase-B chats. Oct 21–26: rest of B + C. Oct 27–Nov 2: 10A→10D.
- Nov 3–8: 11A, 11B, 12, 13A, 13B, 14. Nov 9–13: buffer. **Submit Nov 13.**

## Jam checklist
- [ ] HTML5 game zip (index.html at root, 1280×720, mobile OK) · [ ] GDD (8B) · [ ] 2-min video (13B) ·
- [ ] Game Budget (13A) · [ ] Theme "Make FinLit Fun" on title + lesson cards
