# START HERE — read this first (every chat, every time). ~2 minutes.

You are one of ~40 Genspark chats building ONE browser game, **Lumen Ledger**, for the Zoud GameLab
jam (theme "Make FinLit Fun", deadline Nov 15 2026). You have **100 credits** and ONE deliverable.
Your chat ID is in the user's message. Your task file is `docs/prompts/<ID>_*.md`.

## DELIVERY POLICY (changed 2026-10-17 — zips and upload links are GONE)
Zipping + uploading cost 3–6 credits each and killed several chats before they could write a final message.
**Nobody zips. Nobody uploads. Nobody asks for a download link.**

Instead, ALL work lives in ONE folder in the sandbox: **`/home/user/webapp/LUMEN/`**. The user downloads that
folder directly from the Genspark File Explorer (right-click → download). Layout:
```
/home/user/webapp/LUMEN/
  game/            ← THE game. Your owned files go here (see your prompt's "Owned" line). Master copy.
  screenshots/     ← optional PNGs from the one allowed smoke test, in screenshots/<ID>_<name>/
  archive/         ← old tar.gz / zip uploads the user gave us (read-only history, never needed)
  README.md        ← folder index + what is done
```
How a chat starts: the user attaches `LUMEN_master_*.tar.gz` (or the folder). You:
`mkdir -p /home/user/webapp && tar -xzf <file> -C /home/user/webapp` (so `game/` ends up at `/home/user/webapp/LUMEN/game/`).
Then write your files **directly into `/home/user/webapp/LUMEN/game/...`**. That's it. No pack step.
How an ID ends (any time): `node tools/check.mjs` OK → write `docs/HANDOFF_<ID>.md` → add the row to the "Done" table in
`/home/user/webapp/LUMEN/README.md` → `git commit` → `bash tools/next.sh` → next ID. **No chat message** (see CHAIN RULE v4).
How a CHAT ends (only at ~80 credits): one final summary covering every ID touched. The user downloads the folder.
`tools/pack.sh` now only *lists* your files.

## CHAIN RULE v4 (2026-10-18 — replaces v3.4–v3.7; ONE rule, mechanical, no interpretation)
A chat **ends** the moment it posts a chat message that contains no tool call. The credits still left at that moment are
**gone** (100 → 0). Therefore:

**You post exactly ONE chat message in your whole life: the final summary at ~80 credits. Nothing before it.**
Between IDs there is no message, no "done", no "shall I continue?", no 5-line summary — the next action after closing an
ID is ALWAYS a tool call (`bash tools/next.sh`). If you are about to type a message and you have credits left, you are wrong.

```
while (credits used < ~80):
    bash tools/next.sh                 # prints NEXT: <ID> — the half-done axed ID if one exists, else the first row-less ID in README "Next"
    open docs/prompts/<ID>_*.md; build (smallest working thing first; files to disk as you go)
    close ID: node tools/check.mjs ALL OK → docs/HANDOFF_<ID>.md → README "Done" row (+ remove from "Next") → git commit
    # ← NO chat message here. Loop. (tool call, not text)
final message (the ONLY one): all IDs touched · ends with  FINISHED: <IDs> · IN PROGRESS: <ID or none> (missing: …) · NEXT: <ID>
```

**AXED-TASK CONTINUATION (hard):** if `next.sh` says HALF-DONE (an axed chat left files/HANDOFF but no README row), closing that
ID is iteration #1 of the loop — never the last. It is not a deliverable, not a milestone, gets no message. Verify with
check.mjs, finish its Missing list, close it (HANDOFF → row → commit), run `bash tools/next.sh` again and start the next ID
in THIS chat, exactly as if you had been launched for it. A chat that closes an axed ID and then posts a message has thrown
~85 credits away. The README "Done" table is the only truth: no row = not done, even if files and a HANDOFF exist.

Every ID gets its own HANDOFF + row + commit, so if YOU get axed mid-loop the next chat's `next.sh` lands exactly where you stopped.
The user never reads mid-chat and does nothing manually; nobody is waiting for a report.

## The only 7 rules
1. **Read ≤ 8 credits**: this file → `GAME_BIBLE.md` → the API_CONTRACTS sections your task names →
   skim ONLY the Foundation files you import. Do not read other chats' prompt files.
2. **Write files early and often.** Files on disk are the deliverable. A chat that dies at 95 credits with
   files written and `check.mjs` passing has delivered. A chat that dies with code only in its head has not.
3. **Hard stop at 80 credits**: no new features. `node tools/check.mjs` → write HANDOFF → update README → commit → the ONE
   final summary. Before 80 credits there is no summary and no chat message at all (CHAIN RULE v4). **Verify with Node (`tools/check.mjs`, ~0 credits), NOT by opening the page over and over.**
   Browser QA (`tools/smoke.mjs`) is allowed **at most ONCE**, near the end, and only if
   `bash tools/setup_browser.sh` prints BROWSER OK on the first try. If it fails: skip it, note it, ship.
   **Screenshot-look-tweak loops are forbidden** (3–6 credits per loop; they killed three chats).
4. **Never edit files you don't own** (see GAME_BIBLE §6). Foundation `src/core`, `src/anim/{Easing,Tween,
   Sequencer,SquashStretch}`, `src/assets/geo.js`, `vendor/` are frozen. Need a change? Add a line to
   `docs/CHANGE_REQUESTS.md` and work around it.
5. **No build step, no npm, no CDN** in the game. Vanilla ES modules + `vendor/three.module.js` (r160).
   Import with the correct relative path. Test by serving `game/` statically.
6. **Smallest working thing first, then widen.** Build ONE asset/move end-to-end (load → render → demo
   button) before building the others. Copy that pattern. If the task lists 12 items and you have 8
   done at 80 credits, ship 8.
7. **A suspected bug is not a stop sign.** Write it under "Suspected" in your HANDOFF and continue with the
   next item. Do not refactor working code because one call "looked" wrong.

## How to test (cheap — do not reinvent this)
```bash
cd /home/user/webapp/LUMEN/game
node tools/check.mjs                 # ~0 credits, no browser: imports every src/**/*.js, prints OK/FAIL per file
node tools/check.mjs --props         # also builds every PROP_CATALOG entry L1/L2/L3 (props chats)
node tools/check.mjs --creatures     # builds every Glimmer variant / helper / villain, prints tris + meshes

# AT MOST ONCE, near the end, optional:
bash tools/setup_browser.sh          # 3–8 credits. Prints BROWSER OK or BROWSER FAILED. If FAILED → skip, ship.
node tools/smoke.mjs demo_<yours>.html --keys 1,2,3 --shots --close   # errors, fps, draw calls, screenshots → tools/shots/
cp tools/shots/*.png ../screenshots/<ID>_<name>/                      # optional
```
Expose `window.game = game` in your demo so the smoke tool can read stats. Pure-logic chats (4A, 8A) need no
browser at all: `node test_economy.mjs`-style scripts are enough.

## Deliverable shape (always the same, always inside /home/user/webapp/LUMEN/game/)
```
<your owned files>                 demo_<id>.html (uses Game + Island + VFX from Foundation, window.game set,
docs/HANDOFF_<ID>.md               shows fps/draw calls, a key or button cycles your items)
```
HANDOFF = Done / Missing / Measured (tris, draw calls) / Notes for the integrator. 5–15 lines.

## Quality bar (XP Hero look)
Toon material (`toonMat`) + outline (`addOutline`) on everything · pivot at base (y = 0 is ground) ·
squash-and-stretch (`JellySpring`, `setSquash`) · ALL motion as `Sequence` phases with a ms + easing table
in a comment · delta-time only · anticipation slow → action instant → settle with overshoot.
Props: bake multi-mesh props with `src/assets/props/merge.js → mergeGroup()` (1–2 meshes per prop).

## Budgets that actually matter on a 2018 phone
Draw calls (mesh + its outline = 2) are the limit, not triangles. Whole game target ≤ 150 draw calls on
screen. A prop should be ≤ 10 draw calls incl. outline (use mergeGroup), a creature ≤ 12. Use
`InstancedMesh` for anything that appears > 10 times (grass, flowers, coins, Glimmer crowds).
