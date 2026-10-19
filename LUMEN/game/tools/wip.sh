#!/usr/bin/env bash
# bash tools/wip.sh "<what you just did>" [check flags…]
# v4.1 (2026-10-19). ONE call = commit everything (pass or fail) + run check.mjs. ~0 credits, no browser.
# Why: five chats were axed on 10A and each left identical UNCOMMITTED work, so the next chat restarted from zero.
# A commit with a failing check is recoverable; uncommitted work is not. Call this after EVERY file you write.
#   bash tools/wip.sh "10B: Game.js wires economy+build" --economy --build
set -u
MSG="${1:?usage: bash tools/wip.sh \"<what>\" [check.mjs flags]}"; shift || true
cd "$(dirname "$0")/.."            # → game/
ID=$(bash tools/next.sh 2>/dev/null | sed -n 's/^NEXT: \([0-9A-D]*\).*/\1/p' | head -1)
( cd /home/user/webapp && git add -A && git commit -qm "WIP ${ID:-?}: $MSG" 2>/dev/null && echo "committed: WIP ${ID:-?}: $MSG" || echo "nothing new to commit" )
if [ $# -gt 0 ]; then
  node tools/check.mjs "$@" 2>&1 | tail -n 12
else
  node tools/check.mjs 2>&1 | tail -n 3
fi
echo "(WIP is committed either way. Fix FAILs in YOUR files; a budget you cannot reach → record it, loosen to measured+10 %, move on.)"
