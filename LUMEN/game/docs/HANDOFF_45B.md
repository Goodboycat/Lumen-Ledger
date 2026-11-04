# HANDOFF 45B — Real-browser playtest + 10 quality gates (2026-11-04, CLOSED)

## Done
- [x] qa_mobile 3/3 (prev chat): bark keyframes no longer override the inline transform; joystick knob hidden with its base (2 CSS lines).
- [x] P1 `tools/play.mjs --script funnel` (prev chat) — Playwright boots `index.html?mute` 1280×720, Enter, drains dialogue, ×3, keyboard replay, `lumenTelemetry.export()` → `tools/shots/funnel_browser_45B.json` (committed this chat together with `play_1_start.png`, `play_2_stall.png`).
- [x] P1 `node tools/funnel.mjs tools/shots/funnel_browser_45B.json --md` → FUNNEL_BASELINE "## 45B browser" table next to 44D synthetic, with an honest caption.
- [x] P1 Gates §D 1–10 (+ D11 no-scroll, D12 Android back, D13 footer version) measured against S47 in a real headless Chromium (deps installed via `setup_browser.sh` apt list + `npx playwright install chromium`); "§G S47 dry run (2026-11-04)" replaces §G S39.
- [x] P2 `docs/PLAY_BUGS.md` created with rows 45B-1 … 45B-5 (repro + severity + owner). No ❌ gate needed a code fix, so 0 lines changed in ui/*.css · ui/title.js · index.html this chat.
- [x] P2 evidence: `tools/shots/45B_gate_resume.png` (CONTINUE resumed S1 day 0.42). No gate failed → no `screenshots/45B_gates/` folder.
- [x] P3 reusable harness = `tools/play.mjs --script funnel` (prev chat).

## Missing
- D10 phone play-through from the live itch URL (submission day, needs the URL).
- A comparable S2/S3 browser row: needs a real GPU (SwiftShader fps ≈ 1 → maxDt clamp runs the game at ~1/10 speed). Command is ready: `NODE_PATH=tools/node_modules node tools/play.mjs --script funnel`.

## Measured
| gate | result | how |
|---|---|---|
| D1/D2 check.mjs | ALL OK | `node tools/check.mjs` (via wip.sh) |
| D3 console errors | **0** pageerror / 0 console.error | Playwright title → PLAY → dialogue → play → back → reload → CONTINUE |
| D4 qa_mobile | 3/3 | prev chat |
| D5 draw calls | **167** in S1 play (95 k tris) | `renderer.info.render.calls`, `?debug` |
| D6 save round-trip | ✅ season 1 · day01 0.42 · 77 coins → reload → CONTINUE → identical, verb chain at step 0 | `lg.save.write()` then `goto` + click CONTINUE |
| D7 relative paths | 0 absolute refs | grep |
| D8 audio unlock | no `lumenAudioCtx` on title; created after first Enter | `window.lumenAudioCtx` |
| D9 itch zip | 9.7 MB · 336 files · index.html at root · no tools/tests/docs/demo | `bash tools/itch_zip.sh` + `unzip -l` |
| D11 no-scroll | scrollWidth/Height 1280/720 = viewport | DOM |
| D12 Android back | `goBack()` → URL unchanged, `game.paused = true` | pushState sentinel + popstate |
| D13 footer | `jam build · S47` visible on the title | DOM text |

Browser funnel (n=1, 238 s wall): play 0 s · firstSale 55.5 s · firstCoinInHand 95.3 s (`tip:walk`) · firstStall / S2 / S3 not reached · hands 100 % (3/3, verb-chain coins only) · modalSeconds 0.0 (under-reported, 45B-2).

## Suspected (why browser ≠ synthetic)
1. **Opening dialogue** holds a real player ~43 s (probe: `ui.dialogue.isOpen` true at 21 s and 43 s); headless auto-advances it in one frame. Keys pressed meanwhile (B, 1) are swallowed → no stall (45B-1).
2. **Verb chain freezes the season clock** (`sb.eco.tick` no-op while `V.step >= 0`, auto-advance 25 s/step → up to 125 s of `day01 = 0`). Intentional per 41B, but it means a passive player sees S2 only after ~5 min at ×1; synthetic never had the chain mounted.
3. **SwiftShader** fps ≈ 1–2 + `core/Game.js maxDt = 0.1` → game time ≈ 1/10 wall time even at ×3 (45B-4). Harness artefact, not a game bug.
4. `modalSeconds` ignores dialogue time (45B-2) → the PLAN's "≈ 50 s modal" is still unmeasured by telemetry.

## Notes for 45C
- **Nothing in PLAY_BUGS blocks upload.** 45B-1 (S2) is the only one worth a cheap fix before the jam: start the verb chain (or at least its `stall` step) after the opening dialogue closes, or auto-advance dialogue lines after ~6 s. If 45C owns `verbChain.js`/`Game.js` it is ≈ 3 lines (`on('dialogue:closed')` gate in `V.start`); if not → post-jam.
- 45B-3: bump the PERF.md draw-call note 110–135 → 167 (budget 180). 45B-2 is a telemetry-only change (add dialogue time to `modalSeconds`).
- Browser deps are not in the tar: a fresh sandbox needs `sudo apt-get install …` (list in `tools/setup_browser.sh`) + `npx playwright install chromium` (~1 min) before `smoke.mjs`/`play.mjs` run.
- Version bump S47 → S48 (45C) must update `ui/title.js` footer via `opts.version` in index.html, then re-check D13.
