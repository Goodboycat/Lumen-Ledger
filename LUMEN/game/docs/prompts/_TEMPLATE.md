# HOW TO START ANY CHAT — paste ONLY the block between the lines. Do NOT paste the Bible or the plan.
# Everything the chat needs is INSIDE the master folder (docs/START_HERE.md, GAME_BIBLE.md, API_CONTRACTS.md,
# docs/prompts/<ID>_*.md, tools/check.mjs, tools/next.sh). Attach the latest `LUMEN_master_*.tar.gz` (download the LUMEN
# folder, or `bash game/tools/pack.sh master`). You do not even need to fill in an ID any more: `tools/next.sh` picks it.
#
# v4 (2026-10-18) — replaces v3.1–v3.7. One mechanical rule instead of seven paragraphs:
#   A chat ENDS the moment it posts a chat message with no tool call → every credit left is gone (100 → 0).
#   So a chat posts EXACTLY ONE message: the final summary at ~80 credits. Everything else is tool calls.
#   The ID to work on is never chosen by a human: `bash tools/next.sh` prints it (half-done axed ID first, else first
#   row-less ID in README "Next"). Closing an axed chat's leftover ID is iteration #1 of the loop, never a stop point.

------------------------------------------------------------------------------------------
Attached: LUMEN_master_<date>.tar.gz — one browser game built by many 100-credit chats.

Extract: `mkdir -p /home/user/webapp && tar -xzf <file> -C /home/user/webapp` (game lands at /home/user/webapp/LUMEN/game/).
Read, in this order and nothing else: 1) game/docs/START_HERE.md  2) game/docs/GAME_BIBLE.md  3) the prompt file that
`cd /home/user/webapp/LUMEN/game && bash tools/next.sh` prints (it names the API_CONTRACTS sections and the files you own).

THE ONLY RULE THAT MATTERS (v4): you post ONE chat message in this whole chat — the final summary at ~80 credits.
Every other step is a tool call. A chat message = the chat is over = all remaining credits become 0. There is no
"done, shall I continue?", no mid-chat summary, no report after an ID. I never read mid-chat and I do nothing manually.

THE LOOP (run it literally):
  while (credits used < ~80):
    bash tools/next.sh                       # → NEXT: <ID>. If it says HALF-DONE: an axed chat left files but no README row.
    read docs/prompts/<ID>_*.md (+ docs/HANDOFF_<ID>.md if it exists → finish its Missing list, do NOT restart or refactor)
    build: smallest working item first, files to disk as you go, only files your prompt's "Owned" line names
           (+ check.mjs additive, + index.js barrel line)
    close: node tools/check.mjs --props --creatures … → ALL OK  →  docs/HANDOFF_<ID>.md (Done/Missing/Measured/Suspected/Notes)
           →  row in the "Done" table of /home/user/webapp/LUMEN/README.md (+ remove the ID from "Next")
           →  cd /home/user/webapp && git add -A && git commit -qm "LUMEN <ID>: <one line>"
    # no message here — the very next thing you do is `bash tools/next.sh` again
  final message (the only one) — see FINAL MESSAGE below.

AXED-TASK CONTINUATION (hard): when next.sh reports a HALF-DONE ID, closing it is the warm-up, not the deliverable.
The instant it is closed (check.mjs → HANDOFF → row → commit) you run next.sh again and start the next ID in THIS chat,
exactly as if you had been launched for it. Closing an axed ID and then posting a message = ~85 credits thrown away.
README "Done" table is the only truth: no row = not done, even if files and a HANDOFF exist.

BUG GATE (non-negotiable, ~0 credits):
- BEFORE touching anything: `cd /home/user/webapp/LUMEN/game && node tools/check.mjs --props --creatures`.
  Not ALL OK? Fix ONLY what it reports (even in files you don't own — note it in docs/CHANGE_REQUESTS.md).
- AFTER every file you write: run it again. Never move on with a FAIL. Never commit a FAIL.
- Add your own items to check.mjs (additive only): build each thing you ship, run every anim 2 s headless.
  "I believe it works" does not count; a check.mjs line counts.
- Browser QA at most ONCE per ID, near its end: `bash tools/setup_browser.sh` → if BROWSER OK:
  `NODE_PATH=tools/node_modules node tools/smoke.mjs demo_<id>.html --keys 1,2,3 --shots --close` → must print "ERRORS: none"
  (errors = top priority; a demo that throws is NOT done). Look at at most ONE screenshot. No screenshot-tweak loops.
  BROWSER FAILED → skip, write "browser QA skipped" in the HANDOFF.

AT ~80 CREDITS: stop adding features. Close the current ID if it is closable (check.mjs OK → HANDOFF → row → commit);
if it is not, still write its HANDOFF with an honest Missing list and commit (no README row). Then post the

FINAL MESSAGE (the ONLY chat message of this chat), ≤ 12 lines, covering EVERY ID touched:
  per ID: done / missing / check.mjs result / smoke result (ERRORS line + draw calls) / files
  last line, exactly:  FINISHED: <IDs> · IN PROGRESS: <ID or none> (missing: …) · NEXT: <ID that next.sh now prints>
The next chat pastes this same block; next.sh takes it from there. I do nothing except download the LUMEN folder.
------------------------------------------------------------------------------------------
