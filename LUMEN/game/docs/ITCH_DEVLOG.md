# Lumen Ledger - Devlog: "We took the words out of the UI" (S69 - S82)

*Paste-ready for itch.io (Devlog -> New post). Everything between the rules is post text; the rest is notes for whoever fills the form.*

| Field | Value |
|---|---|
| Post title | **We took the words out of the UI: Lumen Ledger on a phone, in landscape** |
| Game | Lumen Ledger (Zoud GameLab jam, theme "Make FinLit Fun") |
| Version string | **S82** (shown bottom-right of the title screen) |
| Tags | `finlit` `devlog` `3d` `mobile` `cozy` `educational` `tycoon` |
| Screenshots (real captures of this build, in `LUMEN/game/tools/shots/`) | 0. `s82_fp_sheet.png` (Pip's faces: neutral, angry, focus, ouch, happy, worried) 1. `s80_final_1_title_844x390.png` 2. `s80_final_2_play_844x390.png` 3. `s80_final_3_tray_844x390.png` 4. `s80_final_5_boss_844x390.png` 5. `s80_final_6_ledger_568x320.png` (phone-size ledger) - optional: `s80_final_sheet_568x320.png`, `s80_final_2_play_1280x720.png` |
| Credits | Game design, code and drawn art by the Lumen team (many AI chats, one repo). Procedural icons and 3D toon models are generated in code. Sound effects generated with Ludo.ai (prompts in `lumen_sfx_prompts.txt`); music and a few ambience beds are synth |
| Source | https://github.com/Goodboycat/Lumen-Ledger |

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

**A finance game should not need a paragraph of instructions. So we deleted the paragraphs.**

Lumen Ledger started with text on everything: emoji in the HUD, an overlay tutorial, chips full of sentences. It read like homework. Over the last stretch of the jam we pulled the words out, drew icons instead, and rebuilt the screen around the one device we kept thinking about: a phone held sideways.

## What changed for players

- **Pip has a face.** Two eyes, eyebrows and a mouth, and they react: a scowl with gritted teeth when you swing the sword, a squint with the tongue poking out while you build, an "ouch" with a sweat drop when a Collector bumps you, a worried look when trouble is near, and happy little eyes when coins land in a jar or a till. It blinks, too. All of it is drawn in code (flat shapes on the head, no textures), so it costs almost nothing.
- **Drawn icons instead of emoji.** Every symbol in the game (coin, jars, storm mark, crew faces, the Cloud) is now a small drawn icon in the same chunky outline style as the world. No more OS emoji that look different on every phone.
- **A slimmer HUD for phone landscape.** One Spark pill with debt and PAY, one season pill, pause, BUILD, and two big thumb buttons (attack, wind). We checked every button's real tap area at 568x320: all are at least 40 px.
- **The shop tray fits.** On a small phone the BUILD tray used to cover the Spark pill and PAY. It is now capped, has a scroll hint (a fade and a bobbing arrow) and swaps its tabs for a detail bar when you pick a card.
- **Cloud, your little guide - and crew.** The tutorial is no longer an overlay. A friendly cloud shows short blue cards with a pointing hand, and the HUD chips are the Cloud "saying" icon-only messages ("nobody sells this", storm coming). You can also hire the Cloud as crew: it flies to dropped coins and brings them to Pip.
- **Baron Gilt is a real boss.** The debt now starts at 1300. The Baron hunts Pip, his Collectors walk in beside him as an entourage, and a hazard-stripe banner (kept inside its own bar, clear of the HUD) announces him. The boss layer adds its own music.
- **Sword combat you can feel.** Slash, slash, spin: three taps chain into a combo, and a target far away gets a lunge thrust instead. We re-keyed the poses frame by frame and verified the chain at 0 / 330 / 640 ms taps.
- **A Ledger that fits on a phone.** The season review is two columns on a short screen, taps anywhere to continue, and the CONTINUE button always lands in whichever column has room (it was cut off at the bottom edge when the Cloud crew line appeared - caught in this build).
- **A real ending.** Win and you get a credits roll with music; pay the Baron in full and the Lighthouse is lit.

## How we built it

Art is procedural: each icon is drawn in code, then we render a **side-by-side sheet of the candidates in a browser, take one screenshot, and slice it into PNGs** (`tools/icons_shot.mjs`). That keeps the look consistent, lets us judge icons next to each other, and gives us files for the page. The world is Three.js with a toon material (no build step, plain ES modules).

QA is **Playwright screenshots at 844x390 and 568x320** (plus 1280x720), run on every UI change, and DOM probes that measure real geometry: tap areas by `elementFromPoint`, tray and banner overlaps, button bounds. Headless Chromium runs at about 2 fps, so probes force game states and drive combat in virtual time (`game.sequences.update(1/60)` + `combat.update(1/60)`) instead of waiting.

## What we learned

- **Most "bugs" were stale tests or probes, not the game.** Four red gates in S69 and the "fruit never sells" mystery in S80 were test setups (stalls placed without telling the flow field). The one real bug in that hunt: a leaving customer stuck on a blocked tile held a spawn slot forever.
- **Screenshots lie in the happy path.** The ledger looked fine until the Cloud was hired. Check the state players actually reach, not the default one.
- **On a phone, every pixel of HUD is gameplay area.** Cutting words saved more room than any layout trick.

## Try it

Play in the browser (landscape, fullscreen button on). **Touch:** left thumb drags the stick, right thumb taps ATTACK (tap three times for the combo) and the wind power; tap BUILD to open the shop; tap a jar to drop coins into it. **Keyboard/mouse:** WASD to move, Space (or J / Enter) to attack, B for the shop. Tip: play with the phone held sideways (landscape) - that is the layout we tuned first.

## Next

A human playtest of the slash chain and of Pip's faces on a real phone, more faces for the crew, and trying a modelled and rigged Cloud if we get modelling tools. The Cloud now has its real hello giggle and coin-tink sounds.

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
