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
if [ -n "$HALF" ]; then
  echo "NEXT: $NEXT  (HALF-DONE by an axed chat: files/HANDOFF exist, NO README row → verify with check.mjs, finish Missing, close it,"
  echo "       then run tools/next.sh again and continue — closing this one is NOT the end of your chat)"
else
  echo "NEXT: $NEXT"
fi
echo "OPEN:  $P"
echo "Do NOT write a chat message now. A message with no tool call ends the chat and burns every remaining credit."
