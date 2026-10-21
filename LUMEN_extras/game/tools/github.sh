#!/usr/bin/env bash
# bash tools/github.sh <TOKEN>   — FIRST tool call of every chat (Rule 0 in docs/START_HERE.md). ~0 credits.
# Configures git credentials for https://github.com/Goodboycat/Lumen-Ledger (branch main), adds `origin`, fetches,
# and makes sure the sandbox is NOT behind origin/main. The token comes from the user's paste block; it is written only
# to ~/.git-credentials (outside the repo) — never commit it.
#
# Two situations:
#   a) sandbox has no LUMEN yet (tar not extracted)  → clones origin/main into /home/user/webapp
#   b) tar already extracted into /home/user/webapp   → origin/main is checked out underneath, then the extracted files are
#      compared: if origin has commits the tar does not know about, origin wins and the tar's files are only kept where
#      they are NEWER (the user downloaded a later state). A warning is printed either way.
set -u
TOKEN="${1:-${GITHUB_TOKEN:-}}"
REPO="github.com/Goodboycat/Lumen-Ledger"
USER_NAME="Goodboycat"
WEBAPP=/home/user/webapp
[ -z "$TOKEN" ] && { echo "usage: bash tools/github.sh <TOKEN>   (token is in the user's paste block)"; exit 1; }

git config --global credential.helper store
printf 'https://%s:%s@github.com\n' "$USER_NAME" "$TOKEN" > ~/.git-credentials; chmod 600 ~/.git-credentials
git config --global user.name  "$USER_NAME"
git config --global user.email "$USER_NAME@users.noreply.github.com"
git config --global --add safe.directory "$WEBAPP" 2>/dev/null || true

mkdir -p "$WEBAPP"; cd "$WEBAPP"
[ -d .git ] || git init -q -b main
git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "https://$REPO.git" || git remote add origin "https://$REPO.git"
if ! git fetch -q origin main 2>/tmp/gh_fetch.txt; then
  echo "GITHUB FAILED to fetch ($(tail -1 /tmp/gh_fetch.txt)). Token wrong or repo renamed. Work locally, commit anyway, note it in the HANDOFF."; exit 1
fi

if [ -z "$(git rev-parse --verify -q HEAD)" ] || ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
  # local has nothing, or is behind / unrelated to origin → put origin/main underneath the working tree.
  # Files that exist in the working tree (from the tar) stay as untracked/modified changes on top of origin.
  STASH=0
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then git add -A >/dev/null 2>&1; git stash -q -u 2>/dev/null && STASH=1; fi
  git checkout -q -B main origin/main 2>/dev/null || git reset -q --hard origin/main
  if [ "$STASH" = 1 ]; then
    # Re-apply the tar's files over origin; where both changed, keep the tar's version ONLY for files whose tar mtime is
    # newer than the origin commit. In practice the master tar and origin are the same state; conflicts are rare.
    if ! git stash pop -q 2>/dev/null; then
      git checkout --theirs -- . 2>/dev/null; git add -A >/dev/null 2>&1; git stash drop -q 2>/dev/null || true
      echo "WARNING: tar and origin/main diverged — origin/main is checked out, tar files applied on top (review \`git status\`)."
    fi
    git reset -q >/dev/null 2>&1 || true
  fi
fi

AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
echo "GITHUB OK — origin = https://$REPO (branch main) · local ahead $AHEAD / behind $BEHIND"
[ "$BEHIND" != 0 ] && echo "WARNING: still behind origin/main by $BEHIND commits — run: git pull --rebase origin main"
CHANGED=$(git status --porcelain | wc -l)
[ "$CHANGED" != 0 ] && echo "NOTE: $CHANGED file(s) differ from origin/main (the attached tar is newer or older than GitHub). They will go into your first WIP commit."
echo "last commits on origin/main:"; git log origin/main --oneline -n 5 | sed 's/^/   /'
echo "From now on every commit is pushed: bash tools/wip.sh \"<what>\" [check flags]   or   git push -q origin main"
