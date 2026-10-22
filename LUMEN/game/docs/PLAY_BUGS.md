# PLAY_BUGS — bugs found by playing (tools/play_record.mjs + the invisible recorder)

Each bug has an ID (`P##`). Status: OPEN / FIXED (commit msg contains the ID) / WONTFIX (reason).
Recordings: `LUMEN_extras/recordings/play_<stamp>.{webm,timeline.json,report.json}` (webm = canvas only, DOM HUD is not in it;
the timeline JSON has every bus event, key/pointer input and 1 Hz state samples with ms timestamps).
How to record: `cd LUMEN/game && python3 -m http.server 3000` (pm2) → `SEASON=20 NODE_PATH=tools/node_modules node tools/play_record.mjs 120`.
In a real browser: `?rec` autostarts, Ctrl+Shift+F9 toggles, `lumenRec.save()` downloads webm + json.

| ID | Sev | Status | Summary |
|----|-----|--------|---------|
| P01 | P1 | FIXED (ui/jars.js render) | Jars APPLY is disabled until a slider is dragged → a player who keeps the shown "balanced" split can never move Spark into the jars (run 2: 0 Spark in every jar for a whole season; t≈30–115 s). |
| P02 | P2 | FIXED (Spend row = pouch, toast text) | First-sale toast says "Every coin lands in your Spend jar" but sales go to the pouch; Spend jar balance is always 0 ✦ (pouch is shown in the HUD, Spend row shows 0). Misleading lesson text. |
| P03 | P2 | OPEN | Season 1 with default 150 s is very hard to finish without new debt: run 2 income 66 vs expenses 221 (interest 52, upkeep 49) → debt 260→315 and pouch 0 at S2 start. Starter stalls earn ~1 sale / 15 s. Balance note → see docs/SUGGESTIONS.md S01 (not code). |
| P04 | P3 | FIXED (harness) | Harness note (not a game bug): PAY BARON button text changes to "PAY 46 ✦", so text selectors miss it; use `.ll-btn.repay`. |
| P05 | P2 | FIXED (src/core/Game.js) | `game.stats.fps` was computed from the clamped dt (maxDt 1/20) → the F3/debug readout, the recorder and the PixelRatioGovernor could never see fps below 20. Headless run showed "fps 20" while game time advanced 0.18× real time. |
| P06 | P3 | OPEN | Below 20 real fps the whole game runs in slow motion (dt clamp 1/20 per frame, no catch-up). Intended hitch guard, but on very weak phones a 150 s season lasts much longer in wall time. Consider maxDt 1/10 (see SUGGESTIONS S02). |
| P07 | P3 | NOTE | ≤900 px wide: jar sliders + APPLY are hidden while a dialogue is open (11B mobile rule). Expected, documented so harnesses wait for the dialogue to close. |

## Handoff (2026-10-22)
- Done this chat: invisible recorder (`ui/recorder.js`, wired in `index.html`), harness `tools/play_record.mjs`, four 2-min recordings in
  `LUMEN_extras/recordings/` (latest = run 4, with jars APPLY + PAY BARON working: debt 260→177 in S1), fixes P01 P02 P05.
- Next: P03/S01 balance decision (ask the user), P06 (S02), then re-record with `SEASON=25` and add new P## rows.
- Harness facts: headless swiftshader ≈ 20 fps reported (really slower); 640×360 viewport → mobile CSS rules apply (P07).
