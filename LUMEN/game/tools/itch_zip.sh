#!/usr/bin/env bash
# bash tools/itch_zip.sh  → /tmp/lumen-ledger-web.zip (index.html at zip root, runtime files only) for itch.io HTML5 upload.
set -e
cd "$(dirname "$0")/.."
OUT=/tmp/lumen-ledger-web.zip; rm -f "$OUT"
zip -qr "$OUT" index.html favicon.png icon-192.png icon.png src ui data audio vendor -x '*.DS_Store'
echo "→ $OUT ($(du -h "$OUT" | cut -f1), $(unzip -l "$OUT" | tail -1 | awk '{print $2}') files)"
