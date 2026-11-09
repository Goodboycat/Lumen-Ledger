# TODO S77 (IDs for the next chat). Status column is updated at the end of each work block.

Order of work: C -> B -> A -> SW -> D -> F -> E.  Rules: push often (`bash tools/wip.sh "<msg>"` or `git push -q origin main`),
in-game art is drawn (procedural icons -> side-by-side screenshot -> `tools/icons_shot.mjs` slices PNGs), no emoji in game UI.
Mobile landscape (844x390, 568x320) has priority over desktop. MCP tools for any model / rig / animation.

| ID | Item | Status |
|----|------|--------|
| S77-A | Glimmers never visit some shops: browser probe builds all 12 stall types, counts visits per type over 2 seasons; fix `customers.js` picking (_pickStall / WANT map / unserved / queue slots / flowfield) | DONE: pickStall now has wanted-kind bonus x2.5, visit-debt up to x2.5, reachability filter; probes tools/probe_s77_fast.mjs (all 12 kinds, virtual time), probe_s77_stuck.mjs. Result S6 10 waves: every kind picked 3-24x, 0 never-visited. Fruit picked but pays rarely = PRICE refusals not visits (next chat: look at fruit price vs fair) |
| S77-B | HUD purple chips (`.ll-chips .ll-chip`, `ui/hud.js` `hud:chip`) -> the Cloud (drawn `cloudbaby`) saying ICON-ONLY messages; each new one stacks BELOW the previous; each fades to transparent over 5 s then is removed | DONE (cloudSay in ui/hud.js, probe tools/probe_s77_chips.mjs) |
| S77-C | Cloud blue tutor box `.ll-tutor-bub` (`ui/tutor.css`) slightly transparent (bg alpha ~0.85, text opaque) | DONE |
| S77-D | Cloud as a buyable crew member: `helper_cloud` in Crew tab + `economyData.js`; behaviour = picks up dropped coins, carries to Pip, coin vanishes on delivery (`sb.collectCoin`); a tiny cloud floats beside Pip like a pet. New art: icon (procedural -> side-by-side shot -> sliced PNG) + model (MCP) | TODO |
| S77-SW | Player sword attack looks bad: inspect FRAME BY FRAME and correct the sword motion: slash1 forehand, slash2 backhand, slash3 spin; thrust where intended | PARTIAL: slash1/slash2 + new lunge THRUST re-keyed in `src/combat/Combat.js` (KF table, solved with `tools/sword_solve.mjs`), frames via `tools/sword_frames.mjs <step> 16 <tag>` + `tools/sheet.py`. Only slash1 was verified frame by frame. See SW-1..SW-4 below |
| S77-E | Beta pass over every feature + FINAL screenshot review (844x390, 568x320) analysed for beginner-friendliness | TODO |
| S77-F1 | Baron banner sits over the screen centre -> move out of the play area | TODO |
| S77-F2 | Shop tray has no scroll hint | TODO |
| S77-F3 | Tap targets too small at 568x320 (>= 40 px) | TODO |

## Not started / follow-ups (IDs for next chat)

| ID | Item |
|----|------|
| SW-1 | Verify slash2 (`node tools/sword_frames.mjs 1 16 after`) and thrust (target > 1.6 u away) frame by frame. Slash1 mid-strike frame: tip dips to the ground (up -0.09 at fwd 1.6) because keys are lerped in joint space, not tip space. Fix: add 1-2 intermediate keys or raise the s1 mid key `sx` / `ax`, re-run `sword_solve.mjs`, compare tip fwd/side/up log with intention (high behind shoulder -> head height in front -> low across body) |
| SW-2 | Slash3 spin (step 2) untouched: check frame by frame, blade should be flat and fully out to the side (solver target `sp_out` in sword_solve.mjs) |
| SW-3 | Thrust is chosen in `start(0)` when aimed target is > 1.6 u away; confirm it feels right on phone and that `check.mjs --combat` thresholds still hold (it passed in wip.sh at commit time) |
| SW-4 | `slash.fire` ribbon VFX may need re-aiming to the new arc (white wedge looked large in frames 9-12) |
| S77-A2 | Fruit stall is picked ~12x but sells ~1x in S6 (refusals = price vs fair). Look at fruit `fair`/base in economyData.js and the customer price logic |
| S77-D | NOT STARTED (helper_cloud crew + pet cloud + icon + model). Steps in HANDOFF_S76 item D |
| S77-D-ICON | procedural icon -> side-by-side screenshot -> `tools/icons_shot.mjs` slices PNGs |
| S77-E | Beta pass + final 844x390 / 568x320 screenshot analysis NOT done (only the chips screenshot `tools/shots/s77_chips_844x390.png` was reviewed: Cloud speech bubbles stack under each other, icons readable) |
| S77-F1/F2/F3 | NOT STARTED |
| S77-B2 | Chips: confirm icon choice per chip (storm = stormmark+jar, night = lantern+coinbag, want = sad glimmer + stall icon + hammer) reads well with beginners; stalls' want icons need `ll-ico` PNGs if icon mode is png |
