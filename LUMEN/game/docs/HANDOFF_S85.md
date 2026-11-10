# HANDOFF S85 (2026-11-10) - scam variety, Cloud deal chip, Baron seek, cine skip

Setup (same as S84): clone https://github.com/Goodboycat/Lumen-Ledger into /home/user, move the template webapp aside, mv clone to /home/user/webapp, `bash LUMEN/game/tools/github.sh <TOKEN>`. Browser libs per HANDOFF_S79, `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium`. Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Run checks/shots FROM LUMEN/game. Never `pkill -f chromium`.

## DONE (all pushed)
Earlier S85 chat (already on main): (1) season end: the Baron no longer debits from across the island; when the wait runs out he WALKS to Pip (pier phase `seek`, PIER.seekSpeed/seekReach/seekMax) and collects on contact (verified: tools/probe_s85_seek.mjs, interest charged only after he arrives). (2) deal result = Cloud chip at the side (hud:chip id 'deal', icons + number), big Owl 1-star card removed (ui/scamReveal.js). (3) cinematics skip ONLY by the SKIP button (scene tap / Space / Enter / Esc swallowed; SKIP ignores taps the first 0.9 s). Verified with real taps: tools/probe_s85_cine.mjs.

This chat:
1. **5 new scams** (data/story.json full look/ask/stall trees, <=110 chars, economyData SCAMS): parcelFee (prize you never entered, handling fee, S2+), fakeCharity (pity pressure, S3+), freeTrial (cheap start then auto-renewing 20/season x3, S4+; real recurring mechanic: state.subs charged in endSeason, report.subscription, bus eco:subscription), fogLevy (fake official notice, Baron pitches it, S5+), bringAFriend (pyramid club, S6+). 11 deals total. Each old deal got `minSeason`; `baron:true` on zeroInterestLoan / quickFlip / fogLevy.
2. **economy.pickScam({baron,exclude})** + noteScam: season-aware (minSeason, early floor), never one of the last 4, unmet deals first, state.recentScams/scamsMet saved. offerScam() without id uses it; scamNpc.pickId uses it; **Baron visit rotates his deal** (baronVisit.js V.scam, pitches the deal's own pitch lines, story.strangerVoice maps collector->baron when offer.by==='baron').
3. 5 procedural icons (parcel, tin, trialcard, notice, pyramid) in ui/icons.js, side-by-side sheet screenshot sliced to ui/icons/*.png (tools/icons_shot.mjs), journal DEAL_ICON map.
4. Tests: story 63 ok, economy 105 ok (picker, Baron rotation, freeTrial renewals, save round trip), counts changed 6 -> 11 in check.mjs / strangers gate / 48G test; stale "S11 opening" check fixed (Endless was removed). check.mjs --combat --crew --curiosity --audio --strangers --story --economy --pier: ALL OK.
5. Journal: 14 stickers; rows were pinned at 64 px so long tells overflowed and stamps overlapped (found in a 568x320 shot). Fixed in ui/journal.css (grid-auto-rows: max-content, row gap 12). Re-shoot needed (see below).
6. Real-tap probe of a new deal at 568x320 (tools/probe_s85_deal.mjs fogLevy 568 320): dialogue fits, journal marks 'spotted', Cloud chip "+1 star".

## NOT done / next
- **Journal re-shoot** after the CSS fix: `node tools/probe_s85_journal.mjs 568 320` -> look at tools/shots/s85_journal_568x320_a/b.png (the last run measured rows 64-91 px, scrollH 645; not yet viewed). Also 844x390.
- The scam NPC / Baron model does not look different per new deal (same strangers); `ledgerFlash` + Scout Fox work through eco.scams data, not re-tested per new deal in the browser (only fogLevy dialogue tested; the 48G gate walks all 8 lesson-scams trees headless; foggyInsurance-style non-'scams' lessons not applicable).
- Accept path of freeTrial in the real UI (subscription chip / ledger line for `subscription`): the ledger UI does not show the subscription row yet. Add a line to ui/ledger.js (report.subscription) and a Cloud chip on eco:subscription.
- Jars panel cap at 568x320 (touch.css:58) still 2 rows; not touched.
- Cloud crew pet face: not started. No MCP modelling tools exist.
- itch.io live build still unverified; zip NOT rebuilt this chat (run `bash tools/itch_zip.sh`, upload as lumen-ledger-web.zip).
- ITCH_DEVLOG.md still to write (S84 replay bug fix + S85 items), RULE ITCH: write it last.
- Real-phone test pending. S85 user items to confirm on device: season-end Baron seek, deal chip, no accidental cinematic skip.
