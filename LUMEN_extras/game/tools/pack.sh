#!/usr/bin/env bash
# DELIVERY POLICY 2026-10-17: chats do NOT zip or upload anymore. Everything lives in /home/user/webapp/LUMEN/
# and the user downloads that folder from the File Explorer. This script is kept for two cheap uses:
#   bash tools/pack.sh <ID>      # just LISTS the files this chat owns (sanity check for the HANDOFF)
#   bash tools/pack.sh master    # the USER (not a chat) runs this to make LUMEN_master_<date>.tar.gz to attach to the next chat
set -e
ID="${1:?usage: bash tools/pack.sh <CHAT_ID|master>}"
DATE=$(date +%Y-%m-%d)
cd "$(dirname "$0")/.."            # → game/
if [ "$ID" = "master" ]; then
  cd ..   # → LUMEN/
  OUT="/home/user/webapp/LUMEN_master_${DATE}.tar.gz"
  tar -czf "$OUT" --exclude='game/tools/node_modules' --exclude='game/tools/shots' --exclude='archive' --exclude='.DS_Store' -C .. LUMEN/game LUMEN/README.md
  echo "→ $OUT ($(du -h "$OUT" | cut -f1)). Attach this to the next chat (or download the LUMEN folder itself)."; exit 0
fi
PROMPT=$(ls docs/prompts/${ID}_*.md 2>/dev/null | head -1 || true)
echo "Files owned by chat $ID (from $PROMPT):"
[ -n "$PROMPT" ] && grep -i "^Owned" "$PROMPT" | grep -oE "game/[A-Za-z0-9_./{},-]+" | tr ',' '\n' | while read -r f; do f="${f#game/}"; if [ -e "$f" ]; then echo "  ✅ $f"; else echo "  ❌ MISSING $f"; fi; done
for f in docs/HANDOFF_${ID}.md; do [ -e "$f" ] && echo "  ✅ $f" || echo "  ❌ MISSING $f (write it!)"; done
echo "No zip is made. The user downloads /home/user/webapp/LUMEN/ from the File Explorer."
