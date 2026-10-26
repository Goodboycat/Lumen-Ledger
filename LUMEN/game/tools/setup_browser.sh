#!/usr/bin/env bash
# One-shot headless-Chromium setup for tools/smoke.mjs. Run ONCE from game/, costs 3–8 credits.
#   bash tools/setup_browser.sh      → prints "BROWSER OK" or "BROWSER FAILED — skip smoke test, use tools/check.mjs"
# If it prints FAILED: do NOT debug it. Note "browser smoke skipped" in your report and ship.
cd "$(dirname "$0")"
( [ -d node_modules/playwright ] || npm i --no-audit --no-fund playwright@1.47.0 >/dev/null 2>&1 ) || { echo "BROWSER FAILED (npm)"; exit 1; }
npx playwright install chromium >/dev/null 2>&1 || { echo "BROWSER FAILED (download)"; exit 1; }
( sudo apt-get install -y -q libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 libnss3 libcups2 libxfixes3 >/dev/null 2>&1 ) || true
cd .. && NODE_PATH=tools/node_modules node tools/smoke.mjs index.html >/tmp/smoke_probe.txt 2>&1 && { echo "BROWSER OK — run: NODE_PATH=tools/node_modules node tools/smoke.mjs demo_<id>.html --keys 1,2,3 --shots --close"; exit 0; }
tail -3 /tmp/smoke_probe.txt; echo "BROWSER FAILED — skip smoke test, use tools/check.mjs"; exit 1
