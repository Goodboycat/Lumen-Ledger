# HANDOFF 48G — Too Good Deals: realistic manipulation, 3 decision points (2026-11-04, CLOSED)

## Done
- [x] P1 `data/story.json` `scams` block: the 3 lesson-`scams` scripts (zeroInterestLoan / doubleSpark / luckyLantern) are depth-3 trees — `pitch` → D1 `look` / `walk` → D2 (inside `look`) `sign` / `ask` / `stall` → D3 (inside `ask`, `stall`) `accept` / `refuse`. 7 leaf-or-branch arrays per scam, every line ≤ 110 chars, Collector polite → ruder per refusal, tactics visible: foot-in-the-door (look → initial), social proof (Baker/Smith), anchoring (20 % → zero*), urgency (dusk/boat), sunk cost (stall). Owl speaks ONLY after a leaf (≤ 2 lines, names the tactic). The other 3 scams (insurance / needsVsWants / diversification) keep their 2-choice pitch.
- [x] P1 `src/systems/story.js` `choose()` (+9 lines, header comment): the chosen id's array on the current scam node **ends in `choices`** → inner branch, swapped in as `current.lines` (group stays `scam`, `pendingOffer` kept, no `story:end`, `story:choice {branch, outcome:null}`); otherwise it is a leaf: `accept` + `sign` → `economy.acceptOffer()`, `refuse` / `walk` / unknown → `refuseOffer()`, leaf lines queue as `scamResult`, `story:lesson` carries the tell. No new economy outcome.
- [x] P1 `tools/check.mjs --story`: per scam walks the tree (choice ids resolve to arrays, no branch reused, 2–3 options per set, ≤ 110 chars); lesson-`scams` need ≥ 3 choice sets + `walk` leaf + a D3 accept/refuse set; other scams must still end the pitch with accept/refuse. Prints `15 choice sets`.
- [x] P2 `tests/story.test.mjs`: old asserts moved to the tree (D1 look/walk, look → D2 sign/ask/stall with no outcome, sign = accept, walk leaf) + one test walking all 3 trees headless on 4 paths (look→stall→refuse · look→sign · walk · look→ask→accept) → exactly ONE `eco:scamResult` each, correct `accepted`, Owl afterword, one `story:end`. 62 pass.
- [x] P2 lesson card `lessons.scams.lesson` names the 4 tactics in one sentence (hurry · everyone-does-it · tiny first yes · anchoring). P3 `baronVisit.js` `PITCH[]` + `barks.seasonNovelty.baronVisit[1]` reuse the vocabulary (text only, ≤ 60 chars bark).

## Missing
- Not eyeballed in a browser: a 3-button choice row (`sign / ask / stall`) in `ui/dialogue.js` on ≤ 700 px — the CSS is a flex `.ll-dlg-choices`; if it overflows, wrap it (48H funnel run should look once at the S5 Collector offer).
- `tip` of the lesson card still says "hurry · secrecy · guaranteed · asterisk" (the old trio); fine as a tell list, but could mirror the 4 tactics.

## Next chat
`bash tools/next.sh` → 48H (close S51). PLAY_BUGS 48B-2 (Settings → Title / Restart season) and 48D-1 (flaky sims) still open.
