# SFX request list for Ludo.ai (S64) - NEW sounds only
Status: PROPOSED. Nothing here is wired yet. Existing 66 files in `audio/sfx/` stay.
Audit method (partial, S64): `src/core/Audio.js` DEFAULT_EVENTS (49 rows) vs `audio/manifest.json` (66 ids, all have files).
Every id below has NO file and NO event row today. Bus names were grepped as emitted in src/ui.
Prompt format (S77): every prompt starts with its TITLE and ends with its LENGTH in (); paste the whole prompt cell into Ludo.ai.
Format: ogg, mono, 44.1 kHz, trim silence, no reverb tail > 0.3 s. Style: soft cartoon / toy-box, warm, not harsh.
After the files land: add each id to `audio/manifest.json` (`file`, `vol`, `pitchVar`) and one row in DEFAULT_EVENTS.
To remove the procedural fallback completely: drop every `synth` block in manifest.json and the synthSfx call in Audio.js (not done).

| id | trigger (bus event) | prompt (Title: description (length)) | len |
|---|---|---|---|
| jar_deposit | jars:deposit | Jar Deposit: Coins dropping into a glass jar, two soft clinks, warm, satisfying (0.5 s) | 0.5 s |
| jar_withdraw | jars:withdraw | Jar Withdraw: A coin or two popping back out of a jar, quick upward pluck (0.4 s) | 0.4 s |
| jar_unlock | jars:unlocked | Jar Unlocked: Bright wooden-chime sparkle, a new jar appears, 3 ascending notes (0.8 s) | 0.8 s |
| jar_locked | jars:locked | Jar Locked: Soft padlock thunk with a small wooden bonk, not harsh (0.3 s) | 0.3 s |
| jar_spill | jars:spill | Jar Spill: Coins spilling and rolling on wood, a few tinkles (0.7 s) | 0.7 s |
| jar_tap | tap on a jar (one deposit) | Jar Tap: Tiny glassy tap plus single coin plink (0.25 s) | 0.25 s |
| tutor_show | tutor:shown | Tutor Appears: Soft cloud puff plus a small "ding", friendly (0.4 s) | 0.4 s |
| tutor_dismiss | tutor:dismissed (why tap/followed) | Tutor Dismissed: Tiny tick of a checkmark, cheerful (0.2 s) | 0.2 s |
| cloud_hello | Cloud's first line in the opening dialogue | Cloud Hello: Cute airy "pwuff" with a little giggle-like chirp, no words (0.7 s) | 0.7 s |
| hand_tap | cloud hand press loop (optional) | Hand Tap: Very soft finger tap on a screen, barely audible (0.15 s) | 0.15 s |
| sword_swing | combat:hit / combat:miss (miss) | Sword Swing: Light cartoon sword whoosh (0.3 s) | 0.3 s |
| sword_hit | combat:hit | Sword Hit: Wood-and-cloth thwack, short, cartoon (0.25 s) | 0.25 s |
| dash | hero dash (ability) | Hero Dash: Quick breezy whoosh with a tiny sparkle (0.35 s) | 0.35 s |
| till_collect | till:collect | Till Collect: Cash-drawer ka-ching, soft, plus coins pouring (0.8 s) | 0.8 s |
| price_up | ui:price (+) | Price Up: Rising two-note blip (0.2 s) | 0.2 s |
| price_down | ui:price (-) | Price Down: Falling two-note blip (0.2 s) | 0.2 s |
| stranger_arrive | stranger walks in from the pier | Stranger Arrives: A little hand bell, two gentle rings, curious (0.9 s) | 0.9 s |
| stranger_talk | talk with stranger begins | Stranger Talks: Soft "pip" greeting blip, friendly (0.3 s) | 0.3 s |
| deal_accept | accept a deal (fair or scam) | Deal Accepted: Paper stamp thump plus coin clink (0.5 s) | 0.5 s |
| deal_fair_ok | fair deal resolved | Fair Deal Done: Warm positive chime, major third (0.6 s) | 0.6 s |
| owl_hoot | Owl lesson (scam named) | Owl Hoot: Soft single owl hoot, cute (0.8 s) | 0.8 s |
| place_confirm | build:placed for jars and decor (hammer already exists for stalls) | Place Confirm: Soft wooden "thunk" plus tiny sparkle (0.4 s) | 0.4 s |
| place_blocked | build ghost red / denied while placing | Place Blocked: Dull rubber boop (0.25 s) | 0.25 s |
| tab_switch | ui:build:tab | Tab Switch: Light paper-card flick (0.15 s) | 0.15 s |
| card_select | tray card chosen | Card Select: Soft wooden click, higher pitch than click (0.15 s) | 0.15 s |
| storm_chip | hud:chip stormmark appears | Storm Warning: Low distant rumble plus an anxious two-note warning (1.0 s) | 1.0 s |
| crew_payoff | crew job pop (+N) | Crew Payoff: Tiny coin tink (0.2 s) | 0.2 s |
| crew_hire_walkin | crew walk-in on pier | Crew Walk-In: Soft footsteps on wood x3 plus a happy peep (0.8 s) | 0.8 s |
| ledger_stamp | season ledger line appears | Ledger Stamp: Rubber stamp thump (0.3 s) | 0.3 s |
| ledger_total | ledger total reveal | Ledger Total: Counting coins ratchet ending in a ding (1.0 s) | 1.0 s |
| debt_pay | PAY button (ui:repay) | Debt Payment: Heavy coin purse thud, then a relieved sparkle (0.8 s) | 0.8 s |
| debt_free | debt reaches 0 | Debt Free: Short triumphant fanfare, brass toy-trumpet, 3 notes (1.2 s) | 1.2 s |
| hot_cold | season HOT/COLD good announced | Hot And Cold Season: Thermometer ding (HOT) / icy tinkle (COLD): make 2 files hot_ding, cold_ding (0.5 s each) | 0.5 s each |
| pause_open | pause menu (today reuses tray_open) | Pause Open: Soft paper slide in (0.3 s) | 0.3 s |
| joystick_on | touch stick appears | Joystick Touch: Barely audible soft pad press (0.1 s) | 0.1 s |
| title_play | PLAY button | Title Play Button: Big friendly wooden pop plus sparkle (0.6 s) | 0.6 s |
| season_end_win / season_end_ok | ledger result | Season End Stingers: 2 short stingers: positive, neutral (1.5 s each) | 1.5 s each |

Also worth requesting (exist today, only as mapped re-uses): a dedicated `coin_pickup` (the tip coin the hero grabs, today `coin`), and
`hero_footstep_sand` if a sand path is added. Loops/music are out of scope here.

## S74 - BOSS FIGHT MUSIC (wired, procedural placeholder shipped)
Plays as a LAYER on top of the main island theme every time Baron Gilt is on the island (Season 6+ and Endless), not instead of it.
| id | trigger | file | notes |
|---|---|---|---|
| boss_fight | `enemy:wave {boss:true}` starts it; `enemy:defeated {kind:'baron'}`, `enemy:home`, `eco:lose`, `eco:win`, `game:title` stop it | `music/boss_fight.ogg` (22.9 s, 8 bars, C minor, 84 bpm - same tempo as `island_day`) | loop, vol .5, starts on the next bar line of the island loop, island theme ducks to 70 % while it plays |
| boss_fight_endless | same, when the main track is `island_endless` (manifest `alt`) | `music/boss_fight_endless.ogg` (20 s, D minor, 96 bpm) | same stem re-keyed for the Endless run |
Both files are generated by `python3 tools/gen_boss_music.py` (taiko + clap + ticking-clock hats, minor bass walk, detuned-saw brass stabs). To replace with a Ludo.ai / composed track: drop `boss_fight.ogg` in `audio/music/`, keep it a seamless 8-bar loop at 84 bpm (bar = 2.857 s) and in C so it sits on `island_day`; update `bar` in the manifest if the tempo changes.
Ludo.ai prompt if wanted: "Boss Fight Loop: Boss fight loop for a cartoon money-lesson game, villain is a pompous baron with an umbrella. Driving taiko and hand claps, ticking clock hi-hats, low brass stabs, playful menace not horror. C minor, 84 bpm, 8 bars, seamless loop, no melody lead so it can sit on top of a gentle island theme. (22.9 s)"
New one-shot: `enemy:baronEnrage` ("ENOUGH!" at hp <= 3) reuses `baron_warn` at 0.6 pitch - a dedicated growl would be nicer.
