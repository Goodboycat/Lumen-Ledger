# HANDOFF 46D — Phase 46 "Quiet" CLOSED (S49, 2026-11-04)

## Done (one commit + push each)
- **46Z** plan: `HANDOFF_46Z.md`, README_pipeline "Next" paragraph + IDs.
- **46A** `src/systems/verbChain.js`: `V.start` defers while `lg.ui.dialogue.isOpen` (`V.pending`), resumes on `ui:dialogue:close`;
  `V.update` does not count time under an open box; `game:title` clears pending. `tests/verbs.test.mjs` 4 pass. PLAY_BUGS 45B-1 → FIXED.
- **46B** deleted `ui/tutorial.js` (332 lines) + `ui/tutorial.css`; removed the pause-menu 📖 TUTORIAL button, `autoTutorial`/`?oldtutorial`
  plumbing, `ui.tutorial` in `isModal`/swallow order/update, dead `ui:tutorial:*` listeners in nudge/seasons/touch, check.mjs `--cinematics` asserts.
- **46C** `?sliders=1` flag removed from index.html (`jarsSummary: true`); `mountJars({summary:false})` and `ui:jar:apply`/AUTO handlers are
  **kept** (tests + verb-chain step + save field) — only the player-facing switch is gone. `ITCH_PAGE.md` step 3 + `GDD.md` lesson 1 now say
  "walk to the jars, press E" instead of "drag sliders, tap APPLY" (stale since 42B).
- **46D** `GAME_VERSION`/`UI_VERSION` **S49** · `node tools/check.mjs` ALL OK · zip rebuilt.

## Measured
- `bash tools/itch_zip.sh` → `/tmp/LumenLedger_itch.zip` **9.7 MB · 334 files** (S48: 336) · sha256 `0bc0ed8398d179c254d18a0b51cc32be7ede1baca9f1246d1e989c6263cda00f`
- No browser run this phase (credits); DOM change = one pause button fewer + one CSS/JS file fewer. Optional: `node tools/qa_mobile.mjs` next chat.

## Missing / not done
- `ui/jars.js` legacy slider DOM + `Game.js` S03 AUTO split code still exist behind `summary:false` (≈ 80 lines). Deleting them needs the
  `check.mjs` ~1067 block, `gates/jarsworld.mjs` legacy section, `verbs.test.mjs` deposit step and save `autoApply` field rewritten. Low value.
- itch URL still unknown to the repo — the user uploads; then `LUMEN/README.md` "Play:" line + `bash tools/wip.sh "SUBMITTED <date> <url>"`.
- PLAY_BUGS 45B-2…5 (all S3, non-player-facing) untouched.

## Next (suggested)
- Submit the S49 zip (rebuild locally with `bash tools/itch_zip.sh` after `git pull`).
- Post-jam: telemetry endpoint (HANDOFF_45C "Standby"), then the islands decision (HANDOFF_44D condition).
