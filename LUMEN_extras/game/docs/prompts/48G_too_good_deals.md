# Chat 48G — Too Good Deals: realistic manipulation, 3 decision points (data-only)
Needs: 48Z      Blocked-by: —  (independent of 48A–48F; can run in parallel)
Owned (only these files): game/data/story.json (ONLY the `"scams"` block, `grep -n '"scams": {' game/data/story.json` → the second hit ≈ line 714 is the dialogue block; the first ≈ 69 is the lesson) · game/src/systems/story.js (`onScam` + `choose` ONLY if a branch id other than accept/refuse is not already supported — check first) · game/tests/story.test.mjs (one test) · docs/HANDOFF_48G.md
Read (max 6 credits): HANDOFF_48Z table row 48G → this → story.json lines 714–830 (the 3 existing scam scripts: each has `lines[]` ending in `choices:[accept, refuse]` then `accept[]` / `refuse[]` arrays) → `grep -n "choose(\|choices\|branch" game/src/systems/story.js` ±10 (how a choice id picks the next array) → `grep -n "offerScam\|acceptScam\|refuseScam" game/src/systems/economy.js` (the two eco outcomes — do NOT add new outcomes; every path must end in exactly one of them).
Export: none new. Data shape stays: `scams[id] = { lesson, lines[], <branchId>[] … }`; new branch ids are plain arrays like `accept`/`refuse`; a line may carry `choices` again inside a branch (nested = the 2nd and 3rd decision). If `story.choose()` only reads `accept`/`refuse` from the root, extend it to look up the branch on the **current** node first (≤ 8 lines) and write that in the handoff.

## What "realistic and manipulative" means here (FinLit, ages 10+, no profanity, no real brands)
Real pressure tactics, each one visible so the player learns to spot it: **urgency** ("only today, the boat leaves at dusk"), **social proof** ("the Baker took it, and the Smith"), **authority/costume** (Collector in a notary's hat), **anchoring** ("most pay 60 %; for you 35 %"), **foot-in-the-door** (first ask is tiny: "just initial here that you *looked* at it"), **sunk cost** ("you already walked all this way"), **reciprocity** (he hands Pip a free 5 ✦ "sample" — it counts as a tip, `eco:spark reason:'tip_scam'` if that reason exists; otherwise plain text, no eco). The Collector is polite, never cartoon-evil, and gets slightly ruder with each refusal. The Owl speaks **after** the choice, never before (no spoilers = the player decides).

## Build in THIS order. wip.sh after EVERY file.
### P1 — must ship (≈ 25 credits)
- Rewrite the 3 scam scripts to **3 decision points each** (depth 3, ≤ 14 lines per path, every line ≤ 110 chars):
  D1 (foot-in-the-door): `look` ("Let me see the paper") / `walk` ("Not today") → `walk` = refuse outcome, Owl 1 line.
  D2 (pressure, inside `look`): `sign` / `ask` ("What happens in season two?") / `stall` ("I'll think about it") → `stall` = Collector applies urgency + social proof, then **D3**; `ask` = he answers honestly-but-small-print, then D3.
  D3: `accept` / `refuse` (ids MUST be these two so economy's outcome hooks fire).
  So 3 choice sets, 2–3 options each, 7 leaf arrays per scam; **all** `accept` leaves are the same eco outcome; **all** refuse-type leaves (`walk`, `refuse`) are the refuse outcome.
- Owl afterword per leaf ≤ 2 lines, names the tactic in plain words ("He made it urgent so you would not count.").
- `node -e "JSON.parse(require('fs').readFileSync('game/data/story.json'))"` then `node tools/check.mjs --story --barks`.
### P2 — should ship (≈ 10 credits)
- `tests/story.test.mjs`: walk each scam `look → stall → refuse` and `look → sign` headless via `story.onScam(offer); story.choose(i)…` → the final emitted outcome is `scam:accept` / `scam:refuse` exactly once per path.
- Lesson card (`scams` lesson text ≈ line 69) names the 4 tactics in one sentence.
### P3 — nice to have
- The S4 Baron visit (`src/systems/novelties/baronVisit.js`, "zero-interest loan in person") reuses the same tactic vocabulary in its 1 bark — text only.

## Demo page: none — `node tools/check.mjs --story` + `cd game && python3 -m http.server 3000` → `?season=2` flag if it exists (`grep -n "season=" game/index.html | head -2`) and wait for the Collector offer.
## check.mjs `--story` additive asserts: each `scams[id]` has ≥ 3 `choices` arrays across its tree; every leaf's last choice ids ⊆ {accept, refuse, walk}; no line > 110 chars.
## Budgets: 0 code outside the ≤ 8-line `choose()` extension. Content rules: Bible §2 (kind, no brands, no debt-shaming of the player — shame the tactic, not Pip).
## Handoff `docs/HANDOFF_48G.md` ≤ 15 lines + README_pipeline row + strike 48G.
