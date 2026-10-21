#!/usr/bin/env bash
# bash tools/next.sh   — prints the ID a chat must work on NOW. ~0 credits, no browser.
# Truth = README "Done" table (a row = done). An ID with files/HANDOFF but NO row is HALF-DONE (axed chat) → close it first.
# Order = the "Next" section of /home/user/webapp/LUMEN/README.md, left to right.
set -e
cd "$(dirname "$0")/.."            # → game/
README=../README.md
# IDs in the "## Next" section, in order (10A 10B … 12 13A 13B 14)
IDS=$(awk '/^## Next/{f=1;next} /^## /{f=0} f' "$README" | grep -oE '\b[0-9]{1,2}[A-D]?\b' | awk '!seen[$0]++')
NEXT=""; HALF=""
for id in $IDS; do
  if grep -qE "^\| *$id *\|" "$README"; then continue; fi          # has a Done row → done
  PROMPT=$(ls docs/prompts/${id}_*.md 2>/dev/null | head -1 || true)
  if [ -z "$PROMPT" ]; then echo "  (skip $id — no docs/prompts/${id}_*.md; it is not a sandbox chat)"; continue; fi
  if [ -e "docs/HANDOFF_$id.md" ]; then HALF="$id"; NEXT="$id"; break; fi
  # owned files already on disk but no row → also half-done
  for f in $(grep -i "^Owned" "$PROMPT" | grep -oE "game/[A-Za-z0-9_./-]+" | sed 's#^game/##'); do
    case "$f" in docs/*|*props.js|*index.js) continue;; esac       # shared/registration files don't count
    [ -e "$f" ] && { HALF="$id"; break; }
  done
  NEXT="$id"; break
done
if [ -z "$NEXT" ]; then echo "NEXT: none — every ID in README \"Next\" has a Done row. Add IDs to \"Next\" or stop."; exit 0; fi
P=$(ls docs/prompts/${NEXT}_*.md | head -1)
# v4.1: show the predecessor's last WIP commits for this ID so an axed chat's trail is visible at once (0 credits)
LASTWIP=$(cd /home/user/webapp 2>/dev/null && git log --oneline -n 3 --grep="WIP $NEXT" 2>/dev/null || true)
if [ -n "$HALF" ]; then
  echo "NEXT: $NEXT  (HALF-DONE by an axed chat: files/HANDOFF exist, NO README row → verify with check.mjs, finish Missing, close it,"
  echo "       then run tools/next.sh again and continue — closing this one is NOT the end of your chat)"
else
  echo "NEXT: $NEXT"
fi
echo "OPEN:  $P"
[ -n "$LASTWIP" ] && { echo "TRAIL: last WIP commits for $NEXT (an axed chat got this far — continue from here, do not restart):"; echo "$LASTWIP" | sed 's/^/       /'; }
echo "AFTER EVERY FILE: bash tools/wip.sh \"<what>\" [check flags]   (commit pass-or-fail + push to GitHub + check, ~0 credits)"
( cd /home/user/webapp 2>/dev/null && git remote get-url origin >/dev/null 2>&1 ) || echo "RULE 0: no GitHub origin yet → bash tools/github.sh <token> FIRST (token is in the user's paste block)"
echo "STUCK on a budget / same failure twice? → record under Missing, commit, next item. The 3rd attempt is what kills chats."
echo "Do NOT write a chat message now. A message with no tool call ends the chat and burns every remaining credit."
