# HANDOFF 45C — Close phase 45: S48, final zip, Bible, submit-ready (2026-11-04, CLOSED — two chats: 45C-1 version bump, 45C-2 zip + docs)

## Done
- [x] P1 Versions: `GAME_VERSION = 'S48'` (src/Game.js:661), `UI_VERSION = 'S48'` (ui/index.js:26); title footer text now `S48 · jam build` (index.html:93 passes `${GAME_VERSION} · jam build` as `opts.version` → ui/title.js footer; **ui/title.js itself unchanged**, 0 lines). No `'S47'` string left in src/ ui/ index.html.
- [x] P1 Gate: `node tools/check.mjs` → **ALL OK ✅** (after the bump, before the zip; also re-run by every `wip.sh`).
- [x] P1 Zip: `bash tools/itch_zip.sh` → `/tmp/LumenLedger_itch.zip` — see Measured. Verified: 1 × `index.html` at zip root; `data/seasons.json`, `data/story.json`, `audio/manifest.json` present; 0 `src="/` / `href="/` absolute refs in index.html (ship rule 1); no tools/tests/docs/demo in the zip.
- [x] P1 `LUMEN_extras/Game_Bible S48.md` — table 45Z–45C, "What the player gets" (itch pitch paragraph), §2 ship rules 1–5 (from HANDOFF_45Z), Measured 3-column funnel (40B baseline / 44D synthetic / 45B browser), islands decision carried (NO), Gates.
- [x] P2 `LUMEN/README.md` — top **Play:** line (itch URL placeholder for the user + local run + zip command) and "## Ship v3 (45, S48, 2026-11-04)" paragraph.
- [x] P2 `LUMEN_extras/README_pipeline.md` — row 45C; Next line = `~~45C~~ · jam build S48 ready 2026-11-04 — submit per SUBMISSION_CHECKLIST §F; post-jam: islands decision re-opens (HANDOFF_44D condition)`. Rows 45Z/45A/45B were already present from the earlier chats.
- [x] P3 `game/docs/SUBMISSION_CHECKLIST.md` — new "## F-dry. S48 runbook rehearsal" above §G: steps 1 and 3 **done** in the sandbox, steps 2/4/5/6 **would do** (user steps: PDFs, itch upload, preview check = ship rule 5, jam form, SUBMITTED commit).
- [x] Fixed nothing (ship rule 4). HANDOFF_45B: "Nothing in PLAY_BUGS blocks upload" → no code touched besides the 3 version lines.

## Missing
- Nothing from the 45C prompt. The actual itch upload + submission form is a **user step** (the chat has no itch login) — runbook in SUBMISSION_CHECKLIST §F / §F-dry.
- 45B-1 (S2, opening dialogue swallows the first B/1 while the verb chain assumes a free player at ~30 s): **not fixed** — owner is `verbChain.js`/`Game.js` which 45C does not own beyond the version line. ≈ 3 lines (`on('dialogue:closed')` gate in `V.start`) for a post-jam chat, or "Good to know" on the itch page if it bites real players.
- Rebuild the zip on submission day — any commit after S48 changes the sha below.

## Measured
| what | value | how |
|---|---|---|
| check gate | `ALL OK ✅` | `node tools/check.mjs` (last line) |
| zip | **9.7 MB · 336 files** | `bash tools/itch_zip.sh` |
| sha256 | `f07679fa14035e58b4377551230cf4c93f94ecc00c17adff85a096eb97f90080` | `sha256sum /tmp/LumenLedger_itch.zip` |
| index.html at root | 1 | `unzip -l … \| awk '{print $4}' \| grep -c '^index.html$'` |
| required data | `data/seasons.json` `data/story.json` `audio/manifest.json` all present | `unzip -l` grep |
| absolute refs | 0 | `unzip -p … index.html \| grep -c 'src="/\|href="/'` |
| footer | `S48 · jam build` (index.html:93 → `opts.version`) | grep (D13 was browser-measured for S47 by 45B; the S48 text is the same code path with a new string — 0 browser screenshots budget respected) |

Funnel, 3 columns (details in Game_Bible S48 "Measured" and FUNNEL_BASELINE):
| step | 40B S44 synthetic n=20 | 44D synthetic n=20 | 45B browser n=1 |
|---|---|---|---|
| firstStall | 30.03 s (scripted) | 30.03 s | not reached (45B-1) |
| firstSale | 7.42 s | 7.10 s | 55.53 s |
| firstCoinInHand | never | 150.20 s | 95.27 s |
| reach S2 / S3 | 100 % / 100 % | 100 % / 100 % | not reached in 238 s (harness: fps≈1, verb chain freezes clock) |
| Spark through hands | 0.0 % | 86.3 % | 100 % (3/3, not comparable) |

## Standby decision
- **Trailer 13B → SKIP** for the jam. HTML5 build + itch page (6 shots + cover) are the deliverables; `ITCH_PAGE.md §1` trailer row = "none". Credits in this chat after the zip were < 15 and the user did not ask by name.
- **APK 14 → SKIP.** Mobile is served by the HTML5 build (qa_mobile 3/3, touch pad, Android back handled — D4/D12). §F step 4 says "no APK".
- **Telemetry endpoint → OFF.** `?telemetry=<url>` stays opt-in; no endpoint shipped. Post-jam option: a free endpoint (e.g. a Cloudflare Worker / D1 table, or any form-to-sheet webhook) so the islands re-open condition (reach S3 ≥ 40 % on **real** players) becomes measurable. One chat, ≤ 20 lines in `telemetry.js` (POST `export()` on `season:start` + `quit`).

## Notes for post-jam
- **Islands re-open condition** (HANDOFF_44D / Bible S47): reach S3 ≥ 40 % on real players AND ≥ 10 chats of credit. Needs the telemetry endpoint above first; otherwise the decision stays NO by default.
- **PLAY_BUGS rows left:** 45B-1 (S2, dialogue vs verb chain — the only player-facing one), 45B-2 (S3, telemetry `modalSeconds` ignores dialogue), 45B-3 (S3, PERF.md draw-call note 110–135 → 167, budget 180), 45B-4 (S3, `maxDt = 0.1` → 1/10 speed only on fps≈1 software GL; real GPUs unaffected), 45B-5 (S3, CONTINUE button selector detail for the harness).
- **SUGGESTIONS.md:** S01–S03, S05–S07 are done; only S04 (HUD-compositing recorder, dev-only) is deferred. Any new "while we're here" idea goes there, not in code (ship rule 4).
- **Submission day (user):** `git pull` → `cd LUMEN/game && node tools/check.mjs && bash tools/itch_zip.sh` → upload `/tmp/LumenLedger_itch.zip` per §F → check the itch **preview** (ship rule 5) → submit → put the itch URL in the README "Play:" line → `bash tools/wip.sh "SUBMITTED <date> <url>"`.
- Browser deps are not in the repo: a fresh sandbox needs `tools/setup_browser.sh` apt list + `npx playwright install chromium` before `play.mjs`/`hero_shots.mjs`/`qa_mobile.mjs` run (not needed for check.mjs or the zip).
