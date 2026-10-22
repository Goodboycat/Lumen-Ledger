# PLAY_BUGS — bugs found by playing (tools/play_record.mjs + the invisible recorder)

Each bug has an ID (`P##`). Status: OPEN / FIXED (commit msg contains the ID) / WONTFIX (reason).
Recordings: `LUMEN_extras/recordings/play_<stamp>.{webm,timeline.json,report.json}` (webm = canvas only, DOM HUD is not in it;
the timeline JSON has every bus event, key/pointer input and 1 Hz state samples with ms timestamps).
How to record: `cd LUMEN/game && python3 -m http.server 3000` (pm2) → `SEASON=20 NODE_PATH=tools/node_modules node tools/play_record.mjs 120`.
In a real browser: `?rec` autostarts, Ctrl+Shift+F9 toggles, `lumenRec.save()` downloads webm + json.

| ID | Sev | Status | Summary |
|----|-----|--------|---------|
| P01 | P1 | OPEN | Jars APPLY is disabled until a slider is dragged → a player who keeps the shown "balanced" split can never move Spark into the jars (run 2: 0 Spark in every jar for a whole season; t≈30–115 s). |
| P02 | P2 | OPEN | First-sale toast says "Every coin lands in your Spend jar" but sales go to the pouch; Spend jar balance is always 0 ✦ (pouch is shown in the HUD, Spend row shows 0). Misleading lesson text. |
| P03 | P2 | OPEN | Season 1 with default 150 s is very hard to finish without new debt: run 2 income 66 vs expenses 221 (interest 52, upkeep 49) → debt 260→315 and pouch 0 at S2 start. Starter stalls earn ~1 sale / 15 s. Balance note → see docs/SUGGESTIONS.md S01 (not code). |
| P04 | P3 | OPEN | Harness note (not a game bug): PAY BARON button text changes to "PAY 46 ✦", so text selectors miss it; use `.ll-btn.repay`. |
