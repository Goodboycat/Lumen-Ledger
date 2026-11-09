# HANDOFF S77 (2026-11-09) - partial. Full ID table: docs/TODO_S77.md

Setup: clone repo, mv to /home/user/webapp, `bash LUMEN/game/tools/github.sh <TOKEN>`; `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium` (needs apt libs from HANDOFF_S75 first; on this Debian 13 box `sudo apt-get install` of them worked). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Rig: `tools/rig76.mjs`.

## DONE (all pushed)
- S77-C tutor bubble bg `rgba(42,108,176,.86)` (ui/tutor.css).
- S77-B HUD chips are now the Cloud (drawn `cloudbaby`) saying ICON-ONLY messages: `cloudSay()` in ui/hud.js; new ones stack below, each fades over 5 s (CSS `ll-say-fade`, `--say-ms`) then removed; words kept in a hidden `.ll-sr` span so tests/screen readers still work. Probe `tools/probe_s77_chips.mjs`. Unit tests (17 files) + check.mjs pass.
- S77-A `pickStall` in systems/customers.js: wanted-kind bonus x2.5, visit-debt up to x2.5, reachability filter (`_reachable`), distance falloff d/20. Probes: `probe_s77_fast.mjs [waves] [season] [kinds]` (virtual time, all 12 stalls), `probe_s77_stuck.mjs`, `probe_s77_slots.mjs`. Result S6, 10 waves: every kind picked 3-24x, none never-visited; tea (demand 0.6) lowest. Fruit rarely PAYS (price refusals) -> S77-A2.
- S77-SW partial: slash1/slash2 and a new lunge thrust re-keyed (Combat.js `KF`, `THRUST_STEP`). Tools: `sword_frames.mjs`, `sword_solve.mjs`, `sheet.py`. Frame logs show slash1 now has a visible high wind-up behind the shoulder and a sweep across; BUT the mid-strike tip dips to the ground (SW-1).

## NOT DONE: S77-D, S77-E, S77-F1-3, SW-1..4, S77-A2 (see TODO_S77.md). No MCP model / new icon was made this chat.
