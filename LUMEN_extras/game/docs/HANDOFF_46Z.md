# HANDOFF 46Z — Plan phase 46 "Quiet" (comfort by deletion) — 2026-11-04

Jam build S48 is zipped and verified (HANDOFF_45C/45D). Phase 46 adds **no system** (ship rule 4 stays). It removes
the dead paths that still ship in the zip and fixes the one player-facing PLAY_BUGS row (45B-1). Every task is small
enough for one commit + push; a chat that is axed mid-phase loses at most one task.

## Why "deletion"
- `?oldtutorial` (ui/tutorial.js 332 lines + css + pause-menu 📖 button + `autoTutorial` plumbing) is a second
  tutorial nobody reaches. It is still loaded on every page view (CSS + module), is counted in `ui.isModal()`, and
  the pause menu advertises it. Verb chain (41B) is the tutorial.
- `?sliders=1` (legacy 7A jars sliders + APPLY + ⚡ AUTO) is a second way to move Spark. 42B made jars *places*.
  The code path only survives in `check.mjs` line ~1067 and `gates/jarsworld.mjs`.
- 45B-1: the S1 opening dialogue swallows B/1/E while the verb chain is already counting its 25 s auto-advance → the
  "stall" step can auto-skip while the player is still reading. Fix = start/resume the chain only when no dialogue is
  open (3 lines in `verbChain.js`).

## Tasks (sequential; each = code → `node tools/check.mjs` → `bash tools/wip.sh "<ID>: …"`)
| ID | What | Owned | Done when |
|---|---|---|---|
| 46A | Verb chain waits for the dialogue: `V.start` defers while `ui.dialogue.isOpen`, resumes on `dialogue:closed`; `V.update` does not count time while a dialogue is open | `src/systems/verbChain.js`, `tools/check.mjs --verbs` | `--verbs` asserts: start with dialogue open → step stays -1 → `dialogue:closed` → step 0; PLAY_BUGS 45B-1 row → fixed |
| 46B | Delete the old overlay tutorial: `ui/tutorial.js`, `ui/tutorial.css`, `autoTutorial`/`tutorialKey` opts, pause 📖 button, `ui.tutorial` references in `ui/index.js` (`isModal`, swallow order, update), `index.html` link + flag, `check.mjs` `--cinematics` tutorial asserts | `ui/tutorial.*`, `ui/index.js`, `ui/pause.js`, `index.html`, `tools/check.mjs` | `grep -rn tutorial ui/ index.html` shows only the verb chain / story toasts; check ALL OK; smoke-free (headless only) |
| 46C | Delete the legacy jars slider path: `summary` option becomes the only mode, APPLY/AUTO DOM + `ui:jar:apply`/`ui:jar:auto` handlers + `lg.autoApply` split, `?sliders` flag, check block ~1067 + `gates/jarsworld.mjs` legacy section; save keeps reading old `autoApply` field (ignored) | `ui/jars.js`, `ui/jars.css`, `src/Game.js` (S03 block), `index.html`, `tools/check.mjs`, `tools/gates/jarsworld.mjs` | `grep -rn "ui:jar:apply\|autoApply" src ui` empty; `--jarsworld --save --game` OK |
| 46D | Close: `GAME_VERSION`/`UI_VERSION` S49, README (LUMEN + game) + README_pipeline rows, `Game_Bible S49.md` (what was deleted, byte/file delta of the zip), rebuild `bash tools/itch_zip.sh`, record sha | docs, `src/Game.js` version line, `ui/index.js` version | zip rebuilt, sha in README, HANDOFF_46D |

## Rules kept
- One island, no new system, no new art (ship rules 1–5 from Bible S48).
- Headless only (check.mjs); no Playwright run unless a task touches DOM layout (46B removes DOM → one `qa_mobile` run is
  optional in 46D if credits allow).
- itch URL: still unknown to the sandbox (user uploads). The README "Play:" line stays a placeholder until the user
  pastes the URL; then `bash tools/wip.sh "SUBMITTED <date> <url>"`.
