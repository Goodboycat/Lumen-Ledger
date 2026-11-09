# TODO S77 (IDs for the next chat). Status column is updated at the end of each work block.

Order of work: C -> B -> A -> SW -> D -> F -> E.  Rules: push often (`bash tools/wip.sh "<msg>"` or `git push -q origin main`),
in-game art is drawn (procedural icons -> side-by-side screenshot -> `tools/icons_shot.mjs` slices PNGs), no emoji in game UI.
Mobile landscape (844x390, 568x320) has priority over desktop. MCP tools for any model / rig / animation.

| ID | Item | Status |
|----|------|--------|
| S77-A | Glimmers never visit some shops: browser probe builds all 12 stall types, counts visits per type over 2 seasons; fix `customers.js` picking (_pickStall / WANT map / unserved / queue slots / flowfield) | TODO |
| S77-B | HUD purple chips (`.ll-chips .ll-chip`, `ui/hud.js` `hud:chip`) -> the Cloud (drawn `cloudbaby`) saying ICON-ONLY messages; each new one stacks BELOW the previous; each fades to transparent over 5 s then is removed | DONE (cloudSay in ui/hud.js, probe tools/probe_s77_chips.mjs) |
| S77-C | Cloud blue tutor box `.ll-tutor-bub` (`ui/tutor.css`) slightly transparent (bg alpha ~0.85, text opaque) | DONE |
| S77-D | Cloud as a buyable crew member: `helper_cloud` in Crew tab + `economyData.js`; behaviour = picks up dropped coins, carries to Pip, coin vanishes on delivery (`sb.collectCoin`); a tiny cloud floats beside Pip like a pet. New art: icon (procedural -> side-by-side shot -> sliced PNG) + model (MCP) | TODO |
| S77-SW | Player sword attack looks bad: inspect FRAME BY FRAME and correct the sword motion to the intention: slash1 forehand slash, slash2 backhand slash, slash3 spin; thrust where intended | TODO |
| S77-E | Beta pass over every feature + FINAL screenshot review (844x390, 568x320) analysed for beginner-friendliness | TODO |
| S77-F1 | Baron banner sits over the screen centre -> move out of the play area | TODO |
| S77-F2 | Shop tray has no scroll hint | TODO |
| S77-F3 | Tap targets too small at 568x320 (>= 40 px) | TODO |
