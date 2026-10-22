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
| P08 | P2 | FIXED (ui/ledger.js) | Clicking the Ledger CONTINUE button during the 1.2 s row/star stagger animation was ignored (`e.target !== btn` excluded the button from triggering `api.skip()`), requiring a second click after waiting (seen at t=72.3–76.0 s in the 720p60 run). Fixed so clicking the disabled button skips the reveal animation immediately. |
| P09 | P3 | OPEN | Selecting a Jar preset (`setPreset`) sets `st.dirty = true` and enables the APPLY button even when the player's pouch has `0 ✦` (seen at t=63.6 s, 86.0 s, 93.1 s, 115.6 s in the 720p60 run — clicking APPLY with 0 Spark emits `ui:jar:apply` and plays the chime but moves 0 Spark). Note: `check.mjs --ui` asserts `applyBtn.disabled === false` right after a slider drag when `spark=0`, so changing this requires updating the `check.mjs` assertion too. |
| P10 | P3 | OPEN | `PROP_CATALOG` uses `stall_bread` ("Warm Loaf Bakery") rather than `stall_bakery`; harnesses/scripts looking up `stall_bakery` find no card in the Build Tray. |

## Handoff (2026-10-22 — 720p60 YouTube Walkthrough Video)
- Recorded a 2-minute straight (120.0 s, 7200 frames, 1280×720 @ 60 fps, H.264 + 44.1 kHz stereo AAC sound) teaching walkthrough starting from the Main Menu (showing full DOM HUD + UI, skipping tutorial via `?notutorial`), demonstrating:
  - Main Menu → PLAY → Season 1 opening dialogue & HUD Season Lesson Card
  - Walking the market plaza, greeting Glimmers, opening the Build Tray (`B`), inspecting cards, and placing a new stall with ghost preview
  - Adjusting the 4 FinLit Jars (Spend / Save / Invest / Protect) presets (`saver`, `balanced`, `grower`), clicking `APPLY`, and clicking `PAY BARON` to reduce high-interest debt
  - Using all 4 FinLit Hero Abilities (`Q` Coin Magnet Dash, `R` Growth Stomp, `F` Haggle Shout, `G` Fog Sweep)
  - Questioning & refusing a Too-Good Deal scam (`"What exactly does it cover?"`)
  - Season Ledger Review modal with row count-ups, stars, and FinLit lesson card → `CONTINUE` into Season 2
- Saved MP4 to `LUMEN_extras/recordings/lumen_ledger_gameplay_720p60.mp4` and removed temporary recording scripts (`ui/recorder.js` hook, `tools/vclock.js`, `tools/mix_audio.py`, `tools/record_video.mjs`, `tools/play_record.mjs`) after completion as requested.
- Next chat: review P03/S01, P06/S02, P09, P10.
