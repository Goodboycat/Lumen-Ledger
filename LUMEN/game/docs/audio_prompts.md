# Lumen Ledger — audio prompt list (Chat 12)

Every id below is an entry in `audio/manifest.json`. Generate each sound (Ludo.ai / ElevenLabs SFX / any generator), export
**OGG Vorbis, mono, 44.1 kHz, −3 dBFS peak**, trim silence, name it exactly `audio/sfx/<id>.ogg` or `audio/music/<id>.ogg` and
drop it in. Nothing else changes: `src/core/Audio.js` picks up a file the first time the id plays; until the file exists the
manifest's `synth` sketch plays instead, so the game is never silent and no id is ever "missing".

**House style:** cozy toon island at golden hour · wooden + glass + brass · Nintendo-bright, never harsh · every cue ends inside its
length (no tails that outlive the animation it marks) · one-shots are **mono**, music **stereo** · no voices/words anywhere.

## SFX (33 ids + 7 optional extras)

| id | length | loop | mood | prompt |
|---|---|---|---|---|
| coin | 0.18 s | no | bright, rewarding | Single small gold coin landing in a glass jar, short bright metallic *ting* with a tiny second overtone, cartoon-clean, no reverb tail |
| spark_tick | 0.05 s | no | subtle, dry | Tiny dry UI tick, like a soft wooden abacus bead click, very quiet, for a counter that increments ten times a second |
| deny | 0.22 s | no | gentle "nope" | Soft two-note descending wooden *bonk-bonk*, friendly refusal, muted marimba, not a buzzer, not alarming |
| click | 0.07 s | no | neutral UI | Light soft button click, felt-covered wooden tab, warm and short, mobile UI |
| pick_up | 0.14 s | no | playful lift | Quick rising *bloop* as a small toy building is lifted off a table, cartoon pop with a slight slide up |
| hammer | 0.26 s | no | satisfying, solid | Toy wooden mallet hitting a wooden block once, mid-low thunk with a bright knock on top, cartoon build sound |
| crumble | 0.45 s | no | soft collapse | Small pile of wooden toy blocks gently tumbling down onto grass, light clatter fading out, no debris rumble |
| level_up | 0.50 s | no | proud, sparkly | Three ascending glockenspiel notes with a shimmer of sparkle dust, short and warm, "stall upgraded" |
| tray_open | 0.10 s | no | quick, light | Soft whoosh-and-tap of a wooden drawer sliding open a few centimetres, UI panel reveal |
| tray_close | 0.10 s | no | quick, light | Soft tap of a wooden drawer closing, slightly lower and duller than its open sound |
| season_bell | 1.10 s | no | calm, ceremonial | A single warm brass harbour bell struck once, medium size, gentle decay over one second, evening by the sea |
| loan_stamp | 0.30 s | no | heavy, official | A heavy rubber stamp slamming onto a paper ledger on a wooden desk, dull thud with a paper slap, slightly ominous |
| jar_fill | 0.12 s | no | liquid, cheerful | Short bubbly *plip* of a coin dropping into water inside a glass jar, cute and small |
| jar_apply | 0.40 s | no | settled, content | Two glass jars gently clinking together then a soft chime of agreement, "budget set", satisfying |
| scam_sting | 0.50 s | no | sly, suspicious | Short sneaky descending minor-key sting, muted trumpet or clarinet with a tiny cymbal tick, cartoon villain enters |
| scam_refuse | 0.40 s | no | triumphant, light | Bright short ascending *ta-da* on glockenspiel and pizzicato strings, "I saw through it", playful |
| scam_fell | 0.70 s | no | sad trombone, soft | Soft cartoon sad-trombone *wah-wah* descending two notes, gentle and kind, not mocking |
| fanfare | 1.20 s | no | big, joyful | Short triumphant brass-and-bells fanfare, four rising notes with a sparkle shower at the end, island festival, victory |
| lose_sting | 1.40 s | no | heavy, foggy | Low slow descending three-note cue on muted cello and bowed vibraphone, fog rolling in, melancholic but not scary |
| dlg_blip | 0.06 s | no | cute speech | Very short soft speech blip, a rounded sine *bip*, Animal-Crossing style, pitch varies in code so make it neutral |
| toast | 0.12 s | no | friendly notice | Soft two-tone notification chime, wood block then a small bell, warm and quick |
| ledger_open | 0.35 s | no | paper, calm | A large leather ledger book opening on a wooden desk, soft page flutter and a gentle cover thump |
| start | 0.80 s | no | inviting, bright | A short sparkling major arpeggio on celesta with a soft wind chime swell, "the island wakes up" |
| hire | 0.50 s | no | cheerful welcome | Tiny cheerful whistle-like flourish with a little bell, a small animal helper happily joining the team |
| cust_happy | 0.16 s | no | cute, pleased | Tiny happy creature squeak, rounded and soft, like a pleased little blob, no words |
| cust_grumble | 0.18 s | no | cute, annoyed | Tiny grumpy creature mumble, low rounded *mrr*, cartoon, no words |
| ability | 0.30 s | no | generic swish | Quick soft magical swish with a hint of chime, generic hero skill trigger |
| magnet | 0.50 s | no | pulling, electric | Rising magnetic hum with small coins rattling toward it then a soft clink, cartoon coin magnet, half a second |
| shield | 0.60 s | no | glassy, protective | Soft glass bubble inflating with a bright crystalline *shing*, protective shield forming, warm not sci-fi |
| stomp | 0.40 s | no | earthy, heavy | Cartoon ground stomp, deep soft thud with a leafy rustle of plants sprouting right after |
| flash | 0.35 s | no | bright, clarifying | A quick bright camera-flash *ping* with a short airy sparkle, "truth revealed", clear and clean |
| shout | 0.30 s | no | bold, comic | Short comic megaphone-like brass blat with a tiny crowd murmur, a market haggling shout, no words |
| sweep | 0.60 s | no | airy, wide | Big soft broom-like air sweep pushing fog away, whoosh with a faint wind chime at the end |
| *extra* ui_hover | 0.05 s | no | subtle | (optional, not in manifest yet) barely-there soft tick for desktop hover |
| *extra* footstep_grass | 0.12 s | no | soft | (optional) single soft cartoon footstep on grass, two variants |
| *extra* footstep_wood | 0.12 s | no | hollow | (optional) single soft footstep on a wooden pier plank |
| *extra* water_lap | 4.0 s | yes | ambient | (optional) gentle lake water lapping a wooden pier, seamless loop, very quiet |
| *extra* seagull | 0.9 s | no | ambient | (optional) one distant cartoonish seagull call, soft |
| *extra* wind_chime | 2.0 s | no | ambient | (optional) a distant wooden wind chime, two or three notes, random ambience |
| *extra* fog_breath | 6.0 s | yes | ambient | (optional) low soft foggy wind bed, seamless loop, for high Debt Fog |

## Music (6 ids) — all stereo, loop points clean (loopable ids must start and end on the downbeat, same chord)

| id | length | loop | mood | prompt |
|---|---|---|---|---|
| title | 60–90 s | yes | warm, inviting, slightly nostalgic | Cozy island-village theme, 66 BPM, 3/4 feel, acoustic guitar arpeggio, celesta melody, soft upright bass, light brushed percussion, a hint of accordion; golden-hour lakeside market before opening, Animal Crossing meets Stardew Valley; family-friendly, no vocals, seamless loop |
| island_day | 90–120 s | yes | playful, busy, optimistic | Light upbeat market-day loop, 84 BPM, 4/4, pizzicato strings, marimba, ukulele strums, hand claps, glockenspiel accents, bubbly woodwinds; a cheerful toy market where small creatures shop; never tense, leaves space for coin and bell sound effects; no vocals, seamless loop |
| island_endless | 90–120 s | yes | confident, breezy, celebratory | A brighter, faster sibling of the market theme, 96 BPM, adds brass stabs and a shaker groove, major key with a lifted bridge; the market is thriving and the lighthouse is lit; no vocals, seamless loop |
| victory | 25–35 s | no | triumphant, heartfelt | Short victory cue that opens with a brass fanfare and resolves into a warm full-orchestra swell with bells and a choir-like pad (no words), ends on a held major chord with a sparkle; a lighthouse beam sweeping over a saved island |
| fog_lose | 45–60 s | yes | melancholic, foggy, hopeful ending | Slow lament, 54 BPM, muted piano, low cello, bowed vibraphone, distant foghorn-like synth pad, soft rain texture; the market closed under debt fog, sad but gentle and kind, the kind of music that says "try again"; no vocals, seamless loop |
| ledger | 60 s | yes | calm, thoughtful, cozy | Quiet evening study music, 60 BPM, soft felt piano, music-box celesta, light vinyl crackle, slow upright bass; sitting by a lantern reviewing the day's accounts; very sparse so dialogue blips sit on top; no vocals, seamless loop |

## How the ids are triggered (so the mood matches the moment)

| bus event | sfx | music / duck | cooldown |
|---|---|---|---|
| `eco:sale` · `sandbox:tip` | coin | — | 0.08 s / 0.1 s (tips pitched ×1.3) |
| `eco:spark` (10 Hz) | spark_tick | — | 0.25 s |
| `eco:denied` · `build:denied` · `sandbox:denied` · `ui:build{action:denied}` | deny | — | 0.3 s |
| `build:enter` / `build:placed` / `build:removed` / `build:upgraded` | pick_up / hammer / crumble / level_up | — | 0.2 / 0.12 / 0.2 / 0.3 s |
| `ui:build:open` / `ui:build:close` · `ui:pause:open/close` | tray_open / tray_close | pause ducks music | 0.2 s |
| `eco:season` | season_bell | — | 1 s |
| `eco:loan` · `eco:jar` · `ui:jar:apply` | loan_stamp · jar_fill · jar_apply | — | 0.3 / 0.15 / 0.3 s |
| `eco:scam` · `eco:scamResult{accepted}` | scam_sting · scam_refuse / scam_fell | — | 1 s |
| `eco:win` / `eco:lose` | fanfare / lose_sting | → victory / fog_lose | 2 s |
| `story:line` · `story:toast` · `ui:choice` · `ui:continue` | dlg_blip · toast · click | dialogue open/close ducks | 0.12 / 0.4 / 0.1 s |
| `ui:ledger:open` / `close` | ledger_open | duck on / off | 0.5 s |
| `ui:title:open` · `game:start` · `game:endless` | — · start · — | → title · island_day · island_endless | 1 s |
| `sandbox:ability{name}` | magnet · shield · stomp · flash · shout · sweep (else ability) | — | 0.2 s |
| `sandbox:hired` · `cust:state{react,happy/sad}` · `ui:touch` | hire · cust_happy / cust_grumble · click | — | 0.5 / 0.25 / 0.08 s |

Per-play pitch variance (`pitchVar` in the manifest, 0–15 %) is applied in code, so generate every one-shot at a neutral pitch.
Music ducks to 35 % under dialogue, the ledger and the pause menu (200 ms ramps) and comes back when they close.
