# LUMEN LEDGER — FUN PASS BRIEF

The only memory that survives between chats. Read §0–§3, §5, ONE task from §4, §6 and §7 (addendum, overrides §4 where they differ). Skip the other tasks.
Baseline: S51 (2026-11-04). Jam: "Make FinLit Fun", due 2026-11-15. Judges play ~5–10 min, so everything must show up in Seasons 1–3.

## 0. Done Protocol (follow exactly)
1. Take the first task in §6 not marked DONE (or the one the human names). ONE task per chat.
2. Reproduce the problem first (T0 debug panel, or `?season=30`). If the code disagrees with §3, trust the code and say so in your §6 line.
3. Additive, surgical changes. No rewrites of untouched systems, no file moves, no new libraries.
4. This brief OVERRIDES older decisions where they conflict (HANDOFF_48Z D1/D2, phases 46–48 "comfort by deletion", MASTER_PLAN_V6). Log any conflict you hit.
5. Chats get cut without warning. After each sub-step: append one line to §6, commit, push. Never push a broken build.
6. The acceptance tests are the contract; the "How" is only a suggestion. Run every test (headless gate or debug panel) and mark PASS/FAIL in §6. A task is DONE only if all tests PASS. Otherwise write NOT DONE + exactly what remains. Never claim done otherwise.
7. Add a headless gate for the task's tests where feasible. Run all existing gates + the perf check (PERF.md budget: ≤ 180 draw calls).
8. Bump GAME_VERSION (S52, S53, …) with a one-line note. If save data changes, bump the save version and migrate old saves (never wipe).
9. New object or system? Add its guide card to `data/tutor.json` (the existing reactive format works until T2 lands).
10. Need audio or images? Do not block: procedural/silent fallback + a Ludo.ai prompt line in `docs/ASSET_REQUESTS.md`.
11. Unrelated bug? Log it in `docs/PLAY_BUGS.md` with an ID. Do not fix it now.
12. Final reply to the human, nothing more: PASS/FAIL per test · "check it in 60 s" steps (exact URL + taps) · next task ID.

## 1. Vision (designer's words, non-negotiable)
- Feel: Animal Crossing. Cozy daily rhythm, collecting, a crew with jobs and personality, something new to discover every season.
- FinLit is learned by DOING and SEEING. Default: no paragraphs. ≤ 8 words + an icon, at the moment of consequence.
  The ONE exception: scams. They are conversations (text) on purpose, the only text-heavy part of the game.
- The player must be able to FALL for a scam, feel it, and understand why.
- Income has an active side: gather goods and sell them directly (or carry them to sell).
- Diversity and increment: more kinds of things, and more of them, as seasons pass.
- "Pay the bill + hit the Collectors" must NOT be enough to win.

## 2. Hard constraints
- Target: Samsung A21s class (Exynos 850 / Mali-G52). ≤ 180 draw calls, no new per-frame allocations, pool everything, ≤ 1 new particle pool, no post-processing, prefer DOM/sprites over new meshes.
- Vanilla JS + Three.js ESM as is. Procedural assets; audio through `audio/manifest.json`.
- Touch-first: every interaction works with taps only. Tap targets ≥ 44 px.
- Cozy, never scary (GAME_BIBLE §2).
- Content lives in `data/*.json` so the designer can tweak it without code.

## 3. Audit: why S51 fails (found in code; re-verify before editing)
- TUTORIAL: `ui/tutor.js` + `data/tutor.json` = reactive cards fired by bus events AFTER an action (tray opened, stall built). One card at a time, extra triggers are DROPPED, each shows ONCE per profile. "Curiosity" = one 25 s idle timer (`onCuriosityLull`). Nothing senses curiosity about things in the world.
- JARS ALL AT ONCE: `decor.js` jar_spend/save/invest/protect are cost-0 buildables in the tray's first tab from minute 1 (`ui/build.js`). No unlock, no discovery.
- JARS UNREACHABLE: using a jar needs Pip within NEAR_R = 1.3 of it + E/tap (`jarsWorld.js`). `Game.js lg.landTap` swallows any tap within 1.2 u of a jar (returns true) but `sb.interact()` does nothing unless Pip is already within 1.3 → tap from afar = no walk, no deposit, no feedback. S51 "Hush" deleted the ✋ Interact button and hid the panel's APPLY/sliders, so on a phone there is no other path. Reproduce: place a jar, stand 4 u away, tap it.
- SCAMMERS: `scamNpc.js` re-skins `makeFogCollector` (looks like an enemy); a sword hit = free instant refuse + flee. Scheduled only S3,5,7,9 (npc) and S4,8,10 (baron) at day ≈ 0.62–0.70, one per season; none in S1, S2, S6. Dialogue (`story.json`, 6 scams, branches look/ask/stall) only opens if the player walks up and interacts.
- TEXT-ONLY FINLIT: `ui/ledger.js` LESSONS (10 paragraphs) at season end + FINLIT ability lines + scam `tell`. No mechanic ever needs the concept: upkeep and interest are automatic, debt only comes from the Baron.
- SEASONS IDENTICAL: `data/seasons.json` varies season length (70→150 s), HOT/COLD demand, one of 5 novelties (stormWarning, nightMarket, baronVisit, pickyGlimmer, raidDouble) and a forced storm in S2/S8. Look, weather, goods, NPCs, enemy types never change. New content (zones W/E/Far at 250/350/500 ✦, helpers) sits behind purchases the player can skip.
- ENEMIES = A MOMENT: one wave per season at day ≈ 0.7, size min(5, season), 2 hp, 1 ✦ from the pouch on contact, slower than Pip (always escapable). Baron boss from S6.
- NO CRISIS: no "crisis" concept in code. 10 random EVENTS (`economyData.js`) are small numeric hits the Protect jar absorbs automatically.
- CREW DOES NOTHING: 6 helpers (`UPGRADES helper_*`) are passive numbers applied at season end (+1 % Save interest, −20 % upkeep…). Only visible behavior: sit at an owned stall and empty its till every 12 s (`till.js HELPER_EVERY`). With no stall owned, nothing happens at all.
- TRIVIAL WIN: stars (`economy.js endSeason`) = income ≥ 1.25× expenses; saved ≥ 20 ✦; debt/fog not worse. All reachable by paying bills and hitting Collectors. Win = survive 10 seasons with fog cleared.
- NO ACTIVE INCOME: stalls auto-sell to Glimmer customers → till coins → Pip sweeps. No goods, no gathering, no hand-over (customers show want/price bubbles but Pip has nothing to give).

## 4. Task queue (each task ≈ one 100-credit chat)
Order matters. Minimum jam path if time runs out: T0 → T1 → T2b → T4 → T5 → T6 → T3. (Version numbers in §6 are the plan; the real rule is GAME_VERSION = previous + 1.)

### T0 · Debug panel: verify anything in 60 s [S52]
Why: later tasks must be provable without grinding.
1. Extend the existing `?debug` flag: `?debug=1` lazy-mounts a small collapsible DOM panel. Absent without the flag, zero cost in production.
2. Buttons: +100 ✦ · jump to season N (with the right seasons.json row) · set day 0.0–0.9 · time ×1/×4 · spawn stranger (scam id or 'fair') · spawn wave · trigger crisis (id) · unlock jar (id) · hire crew (id) · clear tutor-seen · reset save · dump state.
3. `window.LUMEN_DEBUG` mirrors the buttons + `state()` JSON (season, day, ✦, jars unlocked/placed, crew, hints seen, scams seen).
4. Buttons for systems that don't exist yet are present but disabled, labelled "n/a (T#)".
Accept: T0.1 no panel/global without `?debug=1` · T0.2 every live button works on a phone · T0.3 0 extra draw calls · T0.4 `state()` matches the HUD.
Touch: `index.html` (flag), new `src/debug/panel.js`, `Game.js` (expose hooks).

T0 is split into THREE chats (T0-A, T0-B, T0-C). Each is one chat. DO NOT EXPLORE — the hook map below was read from S51 code (2026-11-05); trust it, grep only the one line you edit.
- **T0-A · hooks** (Game.js only): `installDebugHooks(lg)` → `lg.debug = { grant, season, day, speed, stranger, wave, crisis, unlockJar, hire, clearTutor, resetSave, state, dump }`. Called at the end of `createLumenGame` (before `bus.emit('game:ready')`, Game.js ≈ L740). No DOM, no window global. Tests: `node tools/check.mjs --game` still green; `lg.debug.state()` returns JSON with no NaN.
- **T0-B · panel** (new `src/debug/panel.js` + index.html): `index.html` after `window.ui = ui; window.lg = lg;` (≈ L97) add `if (params.get('debug') === '1') { const { mountDebugPanel } = await import('./src/debug/panel.js'); window.LUMEN_DEBUG = mountDebugPanel(document.body, { lg, game }); }`. Bare `?debug` keeps the old F3 stats line only. Panel = `<aside id="ll-debug">` + own `<style>`, collapsible ▣ tab top-right, buttons ≥ 44 px, `pointer-events` only on the panel. Every button calls `lg.debug.*`; buttons whose hook returns `{ na: 'T#' }` render disabled with label "n/a (T#)". `window.LUMEN_DEBUG = { ...lg.debug, panel }`.
- **T0-C · gate + ship**: `tools/gates/debug.mjs` (+ `--debug` flag in `tools/check.mjs`, same pattern as `--jarsworld` ≈ L44 / L2636): (1) `createLumenGame` headless on domshim like `--game` → `lg.debug` exists, `window.LUMEN_DEBUG` undefined (T0.1 half); (2) mount panel with domshim → scene mesh count unchanged, `game.scene.add` never called (T0.3); (3) `grant(100)` → HUD `.ll-spark` text === `state().spark`; `season(3)` → HUD season text contains `Season 3` and `state().season === 3` (T0.4); (4) every live hook returns truthy/no throw. Then: run ALL gates (`node tools/check.mjs --economy --story --ui --sandbox --game --till --jarsworld --seasons --novelties --wants --pricing --pier --raid --knockback --firstplayer`), bump `GAME_VERSION` S52 (Game.js ≈ L669), note in README, mark T0 DONE in §6. T0.2 (phone) = human check: `index.html?debug=1&season=30` on a phone, tap each button.

Hook map (S51 Game.js, all inside `createLumenGame` / `createSandbox` scope — `lg.sb` is the sandbox, `sb.eco` the Economy):
- +100 ✦: `sb.eco.earn(n, 'debug')` (economy.js L258; emits eco:spark → HUD).
- jump season N: `const s = sb.eco.state; s.season = n; s.day01 = 0; sb.eco.ledger = sb.eco._freshLedger();` then `ui.hud.setSeason(n, 0); ui.hud.setSeasonSeconds(sb.eco.seasonSecondsFor(n))`; the scheduler re-reads the seasons.json row by itself (`installScheduler` L339: `S.season !== s.season` → new marks). Story: `lg.story.state.openingPlayed = n` to skip the opening (else it waits for ui:continue anyway). Emit `debug:season {season}`.
- set day: `sb.eco.state.day01 = clamp(f, 0, 0.99)`; marks with `at < f` fire on the next `sb.updateScheduler()` tick (desired: "day 0.7" = wave). HUD follows via `emitTick` (L745, 10 Hz).
- time scale: `lg.setSpeed(n)` (L697) — SPEEDS = [1,2,3]; allow 4 only when `opts.debugKeys` (one-token change in setSpeed). HitStop-safe already.
- spawn stranger: `sb.scamNpc?.spawn(id)` (scamNpc.js L37; false when one is active or `eco.pendingOffer`); fallback `sb.eco.offerScam(id)`. 'fair' stranger = n/a (T4). Scam ids = keys of `sb.eco.scams`.
- spawn wave: `sb.enemies.waveSeason = null; sb.enemies.spawnWave(season)` (enemies.js L224 guards one wave per season).
- crisis(id): n/a (T7). `event(id)`: `sb.nextEvent = id` then `sb.eco.state.day01` past the event mark, or call the eco event directly (economy.js `applyEvent`-family; grep `case 'event'` in installScheduler L347).
- unlock jar: n/a (T1) — jars have no unlock state yet; `state().jars.placed = sb.jarsWorld.ids()`, balances = `sb.eco.state.jars`.
- hire crew: `hireHelper(sb, type, { free: true })` (Game.js L581, module-private → hooks must live in Game.js); types = `HELPER_TYPES`.
- clear tutor seen: `ui.tutor.seen.length = 0; lg.tutorSeen = []; lg.save.write()` (save.js L87 snapshots `ui.tutor.seen`).
- reset save: `lg.save.clear()` (L1206).
- state(): `{ version: GAME_VERSION, state: lg.state, mode: lg.mode, season, day01, spark, debt, fog01, speed: lg.speed, jars: { balances, placed, unlocked: 'n/a(T1)' }, crew: sb.helpers.map(h => h.type), hintsSeen: ui.tutor.seen, scamsSeen: lg.story?.state.scamsSeen, drawCalls: game.stats.drawCalls }` — `eco.summary()` (economy.js L592) already gives spark/jars/debt/fog01/season/day01.
- HUD truth for T0.4: `ui/hud.js` `sparkVal` (class `ll-spark-val`? grep `sparkVal = el(`), `seasonTxt` text `Season N / 10`, day bar `dayFill.style.width`. HUD listens to eco:spark / eco:tick, so after a hook call step `lg.update(0.2)` once before comparing.
- Draw calls: `game.stats.drawCalls` (core/Game.js L124, from `renderer.info`). The panel is DOM only → 0 by construction; the gate proves no `scene.add`.

### T1 · Jars unlock one by one and can be reached [S53]
Ask: "activate each jar separately … jars inaccessible even after bought".
1. `data/jars.json`, per-jar unlock rule (designer-editable). Defaults: Spend = start · Save = first till sweep · Protect = when the S2 storm warning starts (teaches emergency fund) · Invest = start of S3 (after the S2 ledger).
2. Locked jars are NOT listed in the tray. On unlock: bus `jars:unlocked {jar}`, tray tab pulses, the new card carries a NEW tag, one 1.2 s reveal. No modal.
3. Reach: a tap on a jar from anywhere → Pip auto-walks to it, then deposits 10 ✦ (or opens a small sheet with big "+10" / "take 10" buttons once in range). When in range, an icon + amount floats over the jar (no paragraph). E key unchanged. Fix the swallowed tap in `landTap`.
4. Keep 48E rules: one per key, removal refunds only its balance, HUD row only when built.
5. `save.js` stores unlocked jars. Legacy saves: every already-placed jar counts as unlocked.
Accept:
- T1.1 New game: the tray lists exactly 1 jar (Spend); no other jar visible anywhere.
- T1.2 Debug-unlock Save → only Save appears, with the reveal; others unchanged.
- T1.3 Place Save, stand ≥ 4 u away, tap it → Pip walks over and 10 ✦ moves in. Touch only.
- T1.4 Two jars: deposit into one → the other is unchanged; remove one → only its balance returns to the pouch.
- T1.5 Reload keeps unlocks + placed jars; a legacy save migrates.
- T1.6 Invest still refuses withdrawal mid-season and shows a 🔒 glyph.
Touch: `decor.js` (catalog flags), `ui/build.js`, `ui/jars.js`, `jarsWorld.js`, `Game.js` (landTap, installJarsWorld), `save.js`, `data/jars.json`.

**T1 hook map (read from S52 code 2026-11-05 — DO NOT EXPLORE, grep only the line you edit). Three chats: T1-A, T1-B, T1-C.**
- **T1-A · unlock rules + tray (data + Game.js + build.js)**: new `data/jars.json` `{ "spend": {"unlock":"start"}, "save": {"unlock":"till:collect"}, "protect": {"unlock":"novelty:start","match":{"id":"stormWarning"}}, "invest": {"unlock":"eco:season","match":{"season":2}} }` (eco:season fires at the S2 ledger → Invest from S3; storm warning = `novelty:start {id:'stormWarning'}` from `src/systems/novelties/index.js` L22; first till sweep = `till:collect` from `src/systems/till.js` L85). New `src/systems/jarUnlocks.js` `createJarUnlocks({bus, data, unlocked:Set})` → listens once per rule, adds the key, emits `jars:unlocked {jar}`; `isUnlocked(k)`, `serialize()` → array, `unlockNow(k)` for debug. Install in `Game.js installJarsWorld` (≈ L395, after `sb.jarsWorld = J`) as `sb.jarUnlocks`; `lg.debug.unlockJar(k)` (≈ L1246, currently `{na:'T1'}`) → `sb.jarUnlocks.unlockNow(k)`; `state().jars.unlocked` (≈ L1261) → the array. Tray: `ui/build.js` `items()` L93 already honours `opts.hide` — add `api.setHidden(ids)` that sets `st.hidden` (used in `items()`), then `renderGrid()` if open; `ui/index.js` L42 passes `hide: JAR_IDS.filter(locked)` initially; Game.js on `jars:unlocked` → `ui.build.setHidden(...)`, pulse the Jars tab (`tabEls.jar`, class `ll-new` 1.2 s) and give the new card a NEW tag (card dataset `isNew` until first placed). Test (`tools/gates/jars1.mjs`, flag `--jars1`, same pattern as `--debug` in check.mjs): T1.1 fresh game → tray jar tab lists exactly `jar_spend`; T1.2 `unlockNow('save')` → `jars:unlocked` ×1, tray lists spend+save only; eco:season(2) → invest listed; novelty:start stormWarning → protect listed.
- **T1-B · reach: tap → walk → deposit (Game.js landTap + jarsWorld)**: `lg.landTap` Game.js L1050–1053 currently returns `lg.interact()` only when the tap is ≤ 1.2 u from a jar AND Pip is near (`J.near()` uses `NEAR_R` 1.3 in `jarsWorld.js` L20) — a far tap is swallowed (returns true, nothing happens). Fix: on a jar tap with Pip out of range set `lg.autoWalk = { to: jarPos, jar: k, t0 }`; in the sandbox update (Game.js ≈ L151 where `sb.jarsWorld.update(dt)` runs) steer the hero toward `to` (reuse the input-vector path the touch joystick feeds — grep `hero.move(` / `input.axis` in Game.js) until `J.near() === k`, then `J.press()` once (deposit 10 ✦) and clear. Cancel on any real input / pause / modal / 6 s timeout. `jarsWorld.js` floating tag (`ensureTag` L103, `placeTags` L107, `LABEL_R` 4) already shows icon + amount within 4 u — keep, do not add text. Test: T1.3 headless: place `jar_save` at (x,z), move hero 5 u away, `lg.landTap({x,z})` → after `lg.update` ≤ 6 s `eco.state.jars.save === 10`, hero within 1.3 u; a tap on water / far ground still opens the tray.
- **T1-C · save + legacy + verb chain + ship**: `save.js snapshot()` L63 add `jarsUnlocked: sb.jarUnlocks?.serialize()`; `parseSnapshot` L104 accept array|undefined; `applySnapshot` → `sb.jarUnlocks.restore(arr)`; legacy (`jarsUnlocked` missing) → every `jar_*` entry in `build[]` (incl. `synthesizeLegacyJars` L24 output) counts as unlocked + 'spend'. `SAVE_VERSION` stays 4 (additive field; `SAVE_VERSIONS_OK` L19 unchanged). Verb chain (§7.C): `src/systems/verbChain.js` L32 `deposit` SETUP `if (!jar) return;` → when no Save jar: hint becomes 'Build the Save jar: B → Jars' and the step is done on `build:placed {id:'jar_save'}` OR `jars:deposit`; needs Save unlocked → T1-A rule 'first till sweep' may not have fired yet in the chain → chain step `deposit` calls `sb.jarUnlocks.unlockNow('save')` (the tutorial IS the first lesson). T1.6 unchanged (`jarsWorld.js` L77 `seasonLocked` → `jars:locked`; `onLocked` tutor text → 'Invest is locked until the Ledger.' per §7.C). Then: all key gates + `--jars1`, GAME_VERSION/UI_VERSION S53, game README flag/jars line, root README section, §6 DONE. T1.7 fresh profile → verb chain reaches `tut:done` without the 25 s silent wait (headless).
- Keep 48E rules (T1.4): one per key (`ui/build.js` L107 `isJarId`, `ownedLevel`), removal refunds only its balance (`jarsWorld.js` L50 `jars:removed {refunded}`), HUD row only when built (`ui/jars.js` L198–200). No change needed; assert in `--jars1`.

### T2 · Curiosity guide [S54]  → READ §7.A FIRST (guide structure + full coverage list; §7 overrides this task's text where they differ)
Ask: the tutorial appears each time the player is curious about something, like a guide.
1. New `src/systems/curiosity.js`: a registry of guideable things `{id, getPos, radius, hintId}` that systems register (jar, stall, till, crew, stranger, Collector, Baron, zone gate, new novelty). Emits `curious {id}` on (a) first approach within radius, (b) LINGER: inside radius ≥ 1.2 s and almost still, (c) player TAP on it from any distance, (d) a NEW thing appears → small "?" ping on it; tap = ask. Checks at 5 Hz over ≤ 20 things, no per-frame allocations.
2. Card = the existing blue card look: ≤ 60 chars + icon + pointer to the thing. Replace "once per profile + drop" with: shows up to `maxShows` (default 3) until the player performs its `doneOn` event (e.g. `jars:deposit`), then never again. Queue (max 2, by priority) instead of dropping.
3. Never during dialogue/modal/crisis. Never twice within 20 s. Taps only.
4. Data-driven: extend `data/tutor.json` cards with `target`, `radius`, `maxShows`, `doneOn`. Keep the 5 verb cards + `onCuriosityLull` as fallback.
5. Minimum coverage: placed/unlocked jar, stall, till coins, Collector, Baron, crew card in the tray, stranger (neutral line only: never spoil that it is a scam).
Accept:
- T2.1 Fresh profile: walk toward a stall for the first time → its card appears ≤ 1.5 s after entering the radius, not earlier.
- T2.2 Leave and return without acting → shows again (max 3). Do the action → never again.
- T2.3 Two triggers within 1 s → both shown in order, none dropped.
- T2.4 Tap a far Collector → card + pointer. No card during dialogue.
- T2.5 No card > 60 chars; every card has an icon; counts persist (old `tutorSeen` list migrates).
Touch: `ui/tutor.js`, `data/tutor.json`, new `curiosity.js`, `Game.js` (the `tutor.bind` call), `save.js`.

### T3 · Crew do visible jobs [S55]
Ask: "Crew members do nothing when buying them."
Every crew member gets: (1) a hire moment, walking in from the pier to its post with a pop + sound slot; (2) a post that does NOT depend on owning a stall (fallback near the cottage); (3) a 2-state job loop (idle/work) that matches its effect; (4) a payoff pop (icon + ≤ 4 chars) each time the effect fires; (5) a "Crew" line in the Ledger. Presentation only: do NOT change balance numbers (spread the same season total into visible ticks if needed).
- Tally Owl: perches on the Save jar (else cottage); coin floats up "+N" each tick.
- Pack Mole: patches stalls (hammer anim); "−N" chips on stalls at season end.
- Spark Bee: circles the busiest stall; sparkle + "+10%" per sale there.
- Guard Tortoise: stands by the Protect jar; shell flash + "🛡 N" when an event is absorbed.
- Scout Fox: ears-up + "!" over a stranger as it appears (hook for T4/T5).
- Gardener Snail: leaves a small flower trail; one new prop each season.
Accept:
- T3.1 Debug-hire each → arrival visible ≤ 3 s, even with 0 stalls.
- T3.2 Within 20 s (time ×4) each shows ≥ 1 work animation and ≥ 1 payoff pop.
- T3.3 Ledger Crew line = sum of payoffs ±1.
- T3.4 Season totals unchanged vs baseline (same seed) ±2 %.
- T3.5 Draw calls within budget with all 6 hired.
Touch: `Game.js` (hireHelper, helpers update), `creatures/animator.js` (HelperAnimator), `till.js`, `ui/ledger.js`, vfx pops.

### T4 · Scammers exist in the world [S56]
Ask: "Scammers are nowhere found, just hit them."
1. New species: friendly, warm, smiling. NOT Collector-shaped (Collectors are grey/angular/hostile; scammers charm). Procedural model + own animator states (stroll, wave scroll, lean-in, flee-laughing).
2. Remove sword → refuse in `scamNpc.js`: a hit whiffs + owl bark "Not an enemy. Talk to them." Only dialogue choices or timeout resolve a stranger.
3. Schedule in `seasons.json` (`strangers: [{at, kind: scamId|'fair'}]`): S1 one 'fair' stranger (a genuinely good deal, for contrast), S2 one scam, S3+ 1–2 per season, a different scam each time until all 6 are met, then remix. ≥ 1 in 3 strangers is 'fair', so "refuse everything" is not optimal. First stranger shows inside Season 1.
4. Findable: arrives from the pier, strolls the plaza with a bell "💬" marker visible from afar (+ off-screen edge arrow). Stays 25–40 s, then leaves.
5. Scout Fox (T3) reacts. Guide (T2) shows a neutral line only.
6. Keep existing economics (`eco.offerScam / acceptOffer / refuseOffer`).
Accept:
- T4.1 Fresh game: first stranger appears within Season 1; model id ≠ collector.
- T4.2 10 sword hits do not resolve a stranger.
- T4.3 Debug-spawn each of the 6 scam ids + 'fair'; marker + arrow visible from 10 u.
- T4.4 Timeout: leaves with no penalty and no reward.
- T4.5 10-season debug run: ≥ 10 strangers, ≥ 3 'fair', ≥ 5 distinct scam ids.
Touch: `scamNpc.js`, `creatures/` (new model + animator), `seasons.json` + `seasonScript.js`, `economyData.js` ('fair' offers), `Game.js`.

### T5 · Fall for it: conversation, reveal, journal [S57]
Ask: scams are dialogue and text, intriguing, so the player has the experience of falling for them.
1. Rewrite the 6 scam scripts (`data/story.json`) as 4–6-exchange conversations with tappable replies: hook (flattery + the player's REAL state: ✦, jar balances, debt) → trust (small free favour) → pressure (25 s ring, "only today", "others are in", "don't tell the owl") → the ask. Branches: ask / look (exposes the tell) / stall / accept / refuse. ≤ 140 chars per line. The scammer is likable and believable.
2. Accept → consequence (existing `acceptOffer`) + a ≈ 4 s REVEAL: mask-drop, the scammer leaves with a coin bag, the HUD shows the loss as icon + number, the owl says one kind line ("Happens to everyone."), then the tell as one highlighted line.
3. Refuse after "look" → ★ bonus (feeds T6) + a grumpy exit.
4. Scam Journal (pause menu): ≥ 6 sticker slots, filled when you meet a scam. Each shows its tell in one line + ✓ spotted / ✗ fell for it. Completion count visible (collecting = Animal Crossing hook).
5. 'fair' deals: same warm tone, but written, checkable terms; accepting is rewarded.
Accept:
- T5.1 Each of the 6 scams: ≥ 4 exchanges and ≥ 1 branch that reveals the tell.
- T5.2 Accept path: loss + Reveal + Journal ✗. Refuse-after-look: ★ + Journal ✓.
- T5.3 Each pitch contains ≥ 1 live number from the player's state.
- T5.4 Tap skips animation but never the choice; touch-only; the pause menu opens the Journal.
- T5.5 Journal persists across reload; old saves load.
Touch: `data/story.json`, `story.js` (branch support exists), `ui/dialogue.js`, new `ui/journal.js` (+ `pause.js` entry), `save.js`, a small vfx cinematic.

### T6 · FinLit decides the win [S58]
Ask: "I can just do nothing but pay the bill and attack enemies, and I finish the game."
1. Replace the 3 trivial stars with 5 FinLit stars, computed from existing ledger fields and shown as an icon row (no paragraph): Budget (income allocated, pouch low at season end) · Safety (Protect ≥ 1 season of upkeep when a storm/crisis hits) · Growth (Save/Invest interest ≥ N) · Scam-smart (no scam accepted, or ≥ 1 spotted) · Debt-free (Baron principal not growing).
2. The Lighthouse lights only at ≥ N★ total. Tune N so "bills + bonk" reaches ≈ 40 %, competent FinLit play ≈ 100 % (put N in balance). Re-tune ability thresholds (3/6/9/12) in `unlocks.js` to the new max.
3. Enemy waves target what the player left unprotected (coins in the pouch, full tills) so jars matter.
4. OPTIONAL: bills as a visible envelope at the cottage (late = small visible fee).
Accept:
- T6.1 Bot "pay bills + bonk only" (headless or `demoMode`) ends ≤ 50 % of win ★.
- T6.2 Bot "good FinLit play" ends ≥ 90 %.
- T6.3 Ledger shows 5 icon stars; tapping one shows ≤ 8 words.
- T6.4 Existing balance sweeps still run and the win stays reachable.
Touch: `economy.js` (endSeason stars, isWin), `economyData.js` (BALANCE_TUNED), `unlocks.js`, `ui/ledger.js`, `enemies.js` (target pick only).

### T7 · Crisis [S59]
Ask: "there is no crisis."
1. New season mark kind `crisis` in `seasons.json` / `seasonScript.js`. Each crisis is multi-step and time-boxed (40–60 s), visible (sky tint, banner icon, an NPC crying for help), with 2–3 choices that use the jars:
   - C1 Roof collapse (S2, with the storm): a stall closes unless repaired. Pay from Protect (absorbs), from the pouch, or take a Baron loan (bad interest).
   - C2 Market dip (S5): Invest loses 25 % if > 60 % of savings sits there (diversification shown by jar bars).
   - C3 Big storm (S8): damages stalls. Protect + Guard Tortoise soften it; unprepared = forced debt.
2. The Protect jar visibly absorbs during a crisis (flash + number). Outcome lands in the Ledger as an icon row (choice + cost).
3. Never ends the run. Worst case = debt + fog.
Accept:
- T7.1 Debug-trigger each crisis; every choice works.
- T7.2 Prepared vs unprepared outcomes differ by ≥ 30 % of the cost.
- T7.3 Ledger shows the crisis row; the time-box ends cleanly (no stuck state).
- T7.4 No crisis card during dialogue; touch-only.
Touch: `seasonScript.js`, `seasons.json`, `economy.js` (event hooks), `story.json` (lines ≤ 100 chars), `ui/hud.js` (banner), `Game.js`.

### T8 · Seasons look different, one new discovery each [S60]
Ask: more discovery each season, new things.
Add a `look` (sky/fog tint + ≤ 1 pooled weather particle) and `firsts` (what arrives) per season in `seasons.json`. ≤ 2 new props per season, reuse the catalog. Keep the Storm Spark. Align with existing `requires: season:N` gates. Proposal (designer may edit):
- S1 Spring blossom: petals · first: flower gathering, 'fair' stranger
- S2 Storm season: grey-blue rain · first: Protect jar, crisis C1
- S3 Golden harvest: amber leaves · first: West Meadow + fruit, Night Market, first scam, Invest jar
- S4 Sea mist: pale teal drift · first: Scout Fox, Baron loan offer (fair vs trap)
- S5 Lantern festival: dusk purple, glowing lanterns · first: crisis C2 (optional Festival goal jar, needs eco support)
- S6 Dry wind: warm sand dust · first: Baron boss, double raid
- S7 Falling leaves: orange-brown · first: path to Far Point lighthouse
- S8 Big storm: dark teal heavy rain · first: crisis C3
- S9 First frost: icy blue snow · first: winter goods (fish)
- S10 Clear night: starry navy fireflies · first: lighthouse finale
Each season start shows a "What's new" row (≤ 3 icons) and the new thing gets a "?" ping (T2).
Accept:
- T8.1 Screenshots of S1/S2/S3 clearly differ; `look` loads from data.
- T8.2 Each season start: ≥ 1 new thing within 20 s, with a ping; nothing repeats.
- T8.3 Perf budget holds; ≤ 1 particle type active; no GC spikes.
- T8.4 Storm Spark still fires.
Touch: `seasons.json`, `seasonScript.js`, `Game.js`/world tint hook, one pooled weather effect in `vfx/`.

### T9 · Gather and sell [S61]
Ask: "Selling directly the goods or at least gather them to sell."
1. 2–3 gather spots per season (respawn daily) for that season's goods (use the HOT/COLD goods in `seasons.json`). Tap/walk → 0.6 s gather anim → +1 good in a pack (max 5, icon chips).
2. Sell directly: a customer showing a want bubble (`cust:want`) for good X + Pip holds X → tap the customer → hand-over → pays price × demand (HOT/COLD) with coin pop + happy reaction. Or sell to a pier merchant at a flat, lower price (no waiting).
3. Prices read by icon + ↑ HOT / ↓ COLD.
4. Tunable `BALANCE.gather` ≈ 15–25 % of income. Passive stall income unchanged.
Accept:
- T9.1 Season 1: gather 3 flowers ≤ 30 s from start; the pack chip shows 3.
- T9.2 Hand a flower to a customer who wants one → coins + happy anim. HOT pays ≥ 1.3×, COLD ≤ 0.7×.
- T9.3 Pier merchant pays the flat lower price.
- T9.4 Pack persists across reload.
- T9.5 A player who never gathers earns within ±5 % of baseline.
Touch: new `src/systems/gather.js`, `Game.js` (hero input), `customers.js` (hand-over), `ui/hud.js` (pack chip).

### T10 · Lessons without text [S62]
Ask: "FinLit lessons are text-based only."
1. Ledger and ability unlocks lose their paragraphs. Each lesson becomes a PROOF MOMENT: icon + before→after number animation from the real report (🌱 Save 100 → 105 · 🌿 Baron 150 → 202). Caption ≤ 8 words. Old paragraphs move behind a "?".
2. During the season, each consequence (interest tick, absorbed event, scam loss, debt growth) shows a micro-pop with a ≤ 8-word caption (reuse `vfx.pop`).
3. Map all 10 lesson ids in `ui/ledger.js LESSONS` to a proof moment + at least one in-season trigger.
Accept:
- T10.1 Ledger has 0 paragraphs by default; each of the 10 lesson ids has an icon + number pair.
- T10.2 Each concept has ≥ 1 in-season micro-pop trigger.
- T10.3 "?" reveals the old text.
- T10.4 0 new draw calls.
Touch: `ui/ledger.js`, `story.js` (`story:lesson`), vfx pops, `Game.js`.

### T11 · Jam polish [S63]
1. Fresh profile, first 3 minutes on the phone: a jar unlock, a stranger, a crew job, gather + sell, a curiosity hint. Fix only what blocks that path.
2. Perf pass: no frame spike > 100 ms during a wave or crisis; PERF.md updated.
3. Update GDD / ITCH_PAGE / SUBMISSION_CHECKLIST to the shipped version (GDD must match the current version; keep it short, only the important info). List what needs re-recording for the jam video.
Accept: T11.1 the 3-minute path works on a fresh profile · T11.2 no spike > 100 ms · T11.3 docs match the version.

## 5. Code map (S51)
- Jars: `src/systems/jarsWorld.js`, `ui/jars.js`, `ui/build.js`, `src/assets/props/decor.js` (jar_* entries), `Game.js` (`installJarsWorld`, `lg.landTap`).
- Guide: `ui/tutor.js`, `data/tutor.json`, `src/systems/verbChain.js`, `Game.js` (`tutor.bind`).
- Scams: `src/systems/scamNpc.js`, `economyData.js` (SCAMS ×6), `economy.js` (`offerScam/acceptOffer/refuseOffer`), `story.js` + `data/story.json`, `ui/dialogue.js`.
- Seasons: `data/seasons.json`, `src/systems/seasonScript.js`, `src/systems/novelties/*`, `data/regions.json`.
- Crew: `economyData.js` (UPGRADES helper_*), `Game.js` (`hireHelper`, HELPER_*), `till.js`, `creatures/animator.js`.
- Enemies/stars/win: `src/systems/enemies.js`, `economy.js` (`endSeason`, `isWin`), `src/systems/unlocks.js`.
- Lessons: `ui/ledger.js` (LESSONS), `src/anim/heroAbilities.js` (FINLIT).
- Customers/sales: `src/systems/customers.js`, `till.js`. Save: `src/systems/save.js`. Version: `GAME_VERSION` in `Game.js`.

## 6. Progress log (update every sub-step, then push)
Status: TODO · WIP · DONE (all tests PASS) · NOT DONE (say what remains)

| Task | Status | Version | Note (≤ 2 lines) |
|------|--------|---------|------------------|
| T0 Debug panel | DONE | S52 | 3 chats T0-A/B/C (2026-11-05). `?debug=1` → `src/debug/panel.js` over `lg.debug`; gate `--debug` 17/17; GAME_VERSION/UI_VERSION S52; READMEs noted. T0.2 phone taps = human check still open |
| T0-A hooks `lg.debug` | DONE | — | Game.js: `installDebugHooks(lg)` before game:ready; `lg.debug.{grant,season,day,speed,stranger,wave,event,crisis,unlockJar,hire,clearTutor,resetSave,state,dump}`; speed 4 only with opts.debugKeys. `--game` PASS · headless 22/22 PASS (state() no NaN, HUD spark/season match) |
| T0-B panel `?debug=1` | DONE | — | `src/debug/panel.js` `mountDebugPanel(root,{lg,game})`: aside#ll-debug + own <style>, ▣ tab, 19 buttons (3 n/a disabled T1/T4/T7) + 4 selects, 1 Hz state readout while open; index.html `?debug=1` → `window.LUMEN_DEBUG`; headless 27/27 |
| T0-C gate `--debug` + S52 | DONE | S52 | `tools/gates/debug.mjs` + `--debug` in check.mjs 17/17 (T0.1 no global/aside pre-mount · T0.3 0 scene.add, meshes unchanged · T0.4 HUD === state()) · version S52 · README flag line + root README section |
| T1 Jars | TODO | S53 | planned 2026-11-05 (hook map in §4 T1): T1-A unlock rules + tray · T1-B tap→walk→deposit · T1-C save/legacy/verb chain/ship |
| T2 Curiosity guide | TODO | S54 | §7.A: guide for EVERYTHING, 3 entry points, codex in pause |
| T2b Powers answer every press | TODO | S55 | §7.B: hold = guide card, every press = visible answer |
| T3 Crew jobs | TODO | S56 | |
| T4 Scammers in the world | TODO | S57 | |
| T5 Fall for it | TODO | S58 | |
| T6 FinLit decides the win | TODO | S59 | |
| T7 Crisis | TODO | S60 | |
| T8 Seasons + discovery | TODO | S61 | |
| T9 Gather and sell | TODO | S62 | |
| T10 Lessons without text | TODO | S63 | |
| T11 Jam polish | TODO | S64 | |

Checkpoint lines (append-only; newest last; format: `date · task.step · what changed · tests PASS/FAIL · what is left`):
- 2026-11-04 · baseline · brief created from the S51 web build audit · no task started
- 2026-11-04 · addendum A · §7 added (guide structure, full guide coverage, powers-feedback task T2b, verb-chain deposit bug) from a second S51 code read · no code changed · next: T0
- 2026-11-05 · T0.plan · explore done ONCE (grep only); hook map + 3-chat split written into §4 T0 so no later chat explores · no code changed · next: T0-A
- 2026-11-05 · T0-A · Game.js `installDebugHooks(lg)` (+ `event(id)` hook; `speed(4)` gated by opts.debugKeys; crew types are camelCase `tallyOwl` etc., not `tally_owl`) · `node tools/check.mjs --game` PASS · headless hook test 22/22 PASS (state() no NaN before/after PLAY; grant→HUD `.ll-spark-val` equal; season(3)→HUD 'Season 3') · next: T0-B
- 2026-11-05 · T0-B · `src/debug/panel.js` + index.html `?debug=1` (bare `?debug` keeps the F3 line) · Game.js stranger('fair') → n/a before the sandbox guard · headless 27/27 PASS · next: T0-C
- 2026-11-05 · T0-C · `tools/gates/debug.mjs` + `--debug` flag 17/17 PASS · GAME_VERSION + UI_VERSION → S52 · game README flag line + `--debug` in the test line, root README "Fun pass T0" section · no test asserts S51 · key gates re-run: all green except pre-existing `--firstplayer` seed 3 / `--till` 78.9 % (PLAY_BUGS 48D-1, identical on 3c01103) + stale 43D `SAVE_VERSION !== 3` assert fixed to `>= 3` (PLAY_BUGS T0-C-1) · T0 DONE · next: T1 Jars
- 2026-11-05 · T1.plan · explore done ONCE (grep only); hook map + 3-chat split (T1-A/B/C) written into §4 T1 incl. exact lines, bus events (till:collect / novelty:start stormWarning / eco:season 2), gate name `--jars1` · no code changed · next: T1-A

## 7. Addendum A (2026-11-04, second S51 code read) — guide structure, guide coverage, powers feedback
Where §7 and §4 differ, §7 wins. Nothing here was implemented; it is design + root causes for T2 / T2b.

### 7.A The guide: how it should be structured (replaces T2 steps 1–5 where they differ)
Designer's ask, in full: the tutorial is a GUIDE. It shows up whenever the player is curious about something, it covers EVERYTHING
in the game (not just 5 verbs + a few UI events), and it never lectures. S51 fails on all three: `data/tutor.json` has 16 cards,
each fires once per profile after an action, extra triggers are dropped, and 24 of ~30 guideable things have no card at all
(verified by listing the cards vs the systems in §5).

Three entry points, one card look (the existing blue `.ll-tutor` card, ≤ 60 chars, icon, hand pointer):
1. **Approach** (the world asks): first time Pip enters a thing's radius, or lingers ≥ 1.2 s inside it → card. Max `maxShows`
   (default 3) until `doneOn` fires, then retired. (= T2.1/2 as written.)
2. **Tap-to-ask** (the player asks): a tap on ANY guideable thing, world or HUD, from any distance → its card immediately,
   NO show limit, bypasses the 20 s cooldown. This is the "appear each time the player has curiosity" requirement. World taps:
   `Game.js lg.landTap` already receives the tap; HUD taps: pointerdown-capture on `[data-guide]` elements. Both go through
   `tutor.ask(id)`. A tap on a thing that also has a game action (jar deposit, tray card) performs the action AND shows the card
   the first `maxShows` times; after that the action only, unless the player **holds** ≥ 350 ms (hold = ask only, no action).
3. **Codex** (the player reviews): pause menu → "Guide" sheet listing every card the player has met (icon + text, ≥ 44 px rows),
   grey rows for unmet things. Zero gameplay logic; it reads the same `tutor.json` and `tutorSeen` counts. This also solves
   "I dismissed it and now I can't get it back", which is the real reason the once-per-profile design feels like it gives no info.

Card rules (unchanged from T2 where not listed): never during dialogue / modal / crisis; queue max 2 by priority; ≤ 60 chars;
every card has `icon`; counts persist (`tutorSeen` list → `{id: n}` map, old array = each id counted 1, never wipe).

Data format (`data/tutor.json`, additive fields; old cards keep working):
```
{ "id": "jar:save", "icon": "jar", "text": "Save jar: 10 ✦ in, +5 % at Ledger.",
  "target": "jar:save",          // guide id registered by a system (curiosity.js), or a CSS selector for HUD items
  "radius": 2.0, "linger": 1.2,  // approach trigger (world things only)
  "maxShows": 3, "doneOn": "jars:deposit", "doneMatch": {"jar": "save"},
  "priority": 2, "group": "jars" }   // group = codex section
```
Guide id convention: `kind:id` (`jar:save`, `stall:fruit`, `crew:tally_owl`, `npc:stranger`, `enemy:collector`, `hud:pouch`).
Systems register with `curiosity.register({ id, getPos, radius, hintId })` and unregister on removal; T2 ships the registry
with jars + stalls + tills + Collectors + Baron + HUD items; later tasks (T3 crew, T4 strangers, T7 crisis, T9 gather) register
their new things in the SAME chat they add them (Done Protocol rule 9 already says so; this is where it plugs in).

**Full coverage list** (every card below must exist after T2; text is a proposal, ≤ 60 chars, no paragraphs):
| group | id | trigger | text (≤ 60) | doneOn |
|---|---|---|---|---|
| verbs | verb:move/coin/bonk/stall/deposit | tutor:hint (keep) | keep | keep |
| jars | jar:spend | approach/tap | "Spend jar: daily money. Tap to put 10 ✦." | jars:deposit spend |
| jars | jar:save | approach/tap | "Save jar: 10 ✦ in, +5 % each Ledger." | jars:deposit save |
| jars | jar:protect | approach/tap | "Protect jar: eats storms and bad luck." | jars:deposit protect |
| jars | jar:invest | approach/tap | "Invest: grows most, locked till Ledger." | jars:deposit invest |
| jars | jar:withdraw | linger near a jar with balance | "Hold the jar to take 10 ✦ back." | jars:withdraw |
| market | stall:any | approach first stall | "Your stall. Customers pay into the till." | till:collect |
| market | till:coins | till amount > 0, approach | "Coins in the till. Walk over to collect." | till:collect |
| market | sign:price | approach sign | "Tap the sign: price up. Hold: price down." | ui:price |
| market | cust:want | first cust:want bubble | "A want bubble. ♥ = will pay more." | eco:sell |
| market | demand:hot | eco:season (any) | "↑ HOT sells high. ↓ COLD sells low." | — (maxShows 2) |
| market | stall:upgrade | approach owned stall S2+ | "Tap your stall to upgrade it." | build:upgrade |
| money | hud:pouch | tap HUD pouch | "Pouch ✦. Collectors can spill it." | — |
| money | hud:upkeep | tap HUD bill/upkeep | "Bills come each Ledger. Keep ✦ ready." | — |
| money | hud:stars | tap HUD ★ | "★ unlock powers. Earned at the Ledger." | ability:unlock |
| money | hud:season | tap season clock | "Season clock. Ledger at the end." | — |
| money | hud:fog | tap fog bar / fog edge | "Debt Fog. Pay the Baron to clear it." | eco:fogDown |
| threats | enemy:collector | enemy:wave or tap | "Collectors chase coins. Hit or outrun." | combat:hit collector |
| threats | enemy:baron | baron appears or tap | "The Baron. Loans look nice. Interest bites." | pier:done |
| threats | event:storm | stormWarning | "Storm coming. Protect jar softens it." | jars:deposit protect |
| threats | event:any | eco:event | "Bad luck. Protect jar absorbed N ✦." (icon only if 0) | — |
| people | npc:stranger | stranger appears or tap | "A stranger wants to talk. Walk up." | ui:dialogue:open |
| people | crew:<each of 6> | tray card tap / hire | one line per crew job, e.g. "Tally Owl counts Save interest." | helper:hired |
| powers | power:<each of 6> | HOLD the chip (see 7.B) or ability:unlock | one line each, see 7.B table | sandbox:ability name |
| powers | power:locked | ability:locked | "Locked. Earn ★ at the Ledger." | ability:unlock |
| build | onBuildOpen, onDemolish, onDecorTab, onJarsTab | keep | keep | keep |
| world | zone:gate | approach a locked zone gate | "New ground. Opens at N ✦." | zone:unlock |
| world | novelty:<id> | novelty start | one line each (nightMarket, pickyGlimmer, raidDouble, baronVisit, stormWarning) | — |
| ledger | ledger:first | ui:ledger:open #1 | "Your season in numbers. Tap a row for more." | — |

Acceptance (adds to T2.1–T2.5):
- T2.6 Tap ANY world thing or HUD item from the list → its card ≤ 300 ms; works on touch; repeats every tap (no cap).
- T2.7 Pause → Guide shows every met card; unmet rows grey; count "12 / 34 met".
- T2.8 Coverage gate (headless): every `curiosity.register` id and every `[data-guide]` id has a card in tutor.json; fails otherwise.
Touch (adds): `ui/pause.js` (Guide entry), new `ui/guideCodex.js` (DOM only), `ui/hud.js` (`data-guide` attributes).

### 7.B Powers: "when I hold the powers, they didn't show anything" — root causes + task T2b
Verified in code (`ui/touch.js`, `ui/abilityChips.js`, `src/Game.js` 1001/1026/532, `src/systems/unlocks.js`, `heroAnims.js` 412):
1. **Hold does nothing by design.** Touch chips fire on `pointerdown` only (`tapAbility`); desktop HUD chips on `click`. There is no
   long-press handler anywhere. A hold = one tap. Nothing is shown because nothing listens.
2. **Four of six powers are locked at start** (`ABILITY_START` = Magnet, Shield). On touch, locked chips are `display:none`
   (`touch.css .ll-touch-ab.locked`), so the strip shows only 2 chips; on desktop they are dim with "★3". A press on a locked chip →
   `ability:locked` → chip shake only. No text, no reason, no "how to unlock". The FINLIT lesson lines exist (`heroAbilities.js FINLIT`)
   but are shown only inside the Ledger unlock card and one Owl bark.
3. **Silent refusals.** `sb.ability` returns null with `sandbox:denied {why: 'cooldown' | 'busy' | 'blocked'}` → shake only. 'busy' is
   common: `hero.playMove` refuses while attacking or mid-move (`heroAnims.js 414–415`). Dash then Shield in a row = nothing visible.
4. **Powers with no target look like nothing happened.** Magnet with 0 coins: pose + 8 orbit coins only. Shield: a bubble for the
   anim, then `sb.shield.until` — an invisible 30 s timer; the payoff ("absorbed") happens at a random event seconds or minutes later.
   Stomp: `sb.growth` invisible ×1.xx multiplier for 12 s. Flash with no offer: "no deal on the table" text in the anim only. Haggle with
   no customers: "DEAL?" floats. Sweep: fog % changes at the island edge, often off-screen. So "it did nothing" is accurate for 4/6
   when pressed at the wrong moment, and the game never says WHEN the right moment is.
5. The strip is hidden while the tray is open or placing (`.tray/.placing`), and ignored while a modal is up → press = nothing.

T2b · Powers answer every press [one chat, after T2 or standalone]
1. **Hold = ask the guide.** Touch chip or HUD chip held ≥ 350 ms → `tutor.ask('power:<id>')` (card from 7.A), the press is NOT fired
   as an ability. Release < 350 ms = normal press. Locked chip hold → "Locked. Earn ★ at the Ledger (have 1/3)." Implement in
   `touch.js tapAbility` (defer emit to pointerup, timer on pointerdown) and `abilityChips.js` (pointerdown/up instead of click).
2. **Every press gets a visible answer ≤ 8 words**, via the existing bark/pop channel (`vfx.pop` or `ui/bark.js`), never a modal:
   - success → the effect in numbers: "Magnet +7 ✦" · "Shield 30 s: next hit free" · "Stalls ×1.3 for 12 s" · "Fog 48 % → 41 %" ·
     "Haggle: next sale ×1.1" · "TRUE COST 340" ;
   - no target → what to do instead: "No coins near. Dash to a till." · "No deal open. Use near a stranger." · "No customers. Wait by a stall.";
   - denied cooldown → "Ready in 3 s" (number live) ; busy → "Finish the swing first" ; blocked (tray/placing) → "Close the tray first".
3. **Locked chips visible on touch too** (`display:none` → dim + ★ cost, same as desktop), ≥ 44 px, press = card from 7.A `power:locked`.
4. **Active-effect indicators** so timers are not invisible: chip shows a thin top bar draining for Shield (30 s) and Stomp (12 s);
   Shield also keeps a faint bubble ring on Pip (reuse the existing bubble mesh, no new mesh). When Shield absorbs → "🛡 −N absorbed".
5. **Right-moment nudge (data only):** each `power:<id>` card gets a `whenHint` line used by the "no target" answer; optional 0.6 s chip
   glow when its moment arrives (coins on ground ≥ 5 → Magnet; stranger near → Flash; stormWarning → Shield; cust:want ≥ 2 → Haggle).
Power guide cards (≤ 60 chars, for 7.A table): Magnet "Dash to coins and tills. Pulls them in." · Shield "Next bad event costs 0. Lasts 30 s." ·
Stomp "Stalls sell more for 12 s. Use when busy." · Flash "Shows a deal's TRUE cost. Use near a stranger." · Haggle "Next sale pays +10 %. Use with customers." ·
Sweep "Pushes Debt Fog back. Use at the fog edge."
Accept:
- T2b.1 Hold any chip ≥ 350 ms (touch + mouse) → guide card, no ability fired; release < 350 ms → ability as before.
- T2b.2 Press each of the 6 with no target → a ≤ 8-word answer within 300 ms; with a target → the number answer.
- T2b.3 Cooldown / busy / blocked presses each show their line; nothing is ever silent (gate: every `sandbox:denied` why has a line).
- T2b.4 Touch strip shows 6 chips from the start (4 dim); dim press → locked card with live ★ count.
- T2b.5 Shield + Stomp show a draining bar; 0 new draw calls (DOM + existing bubble).
Touch: `ui/touch.js`, `ui/abilityChips.js`, `touch.css`, `abilityChips.css`, `src/Game.js` (lines ~1001–1030 gate answers, ~532 `sb.ability`
denied payload gets `secondsLeft`), `data/tutor.json` (6 power cards + locked), `ui/bark.js` or `vfx` pop. Do NOT touch `heroAbilities.js` anims.

### 7.C Extra findings while reading (not tasks; log to PLAY_BUGS when touched)
- Verb chain step 5 "deposit" (`verbChain.js 32`): `if (!jar) return;` — with no Save jar built (S51 deleted pre-placed jars) the step
  has no target; the hint says "Carry it to the Save jar" but there is no jar; the step auto-advances after 25 s with no message. Also the
  season clock is frozen until the chain ends (`freezeEco`). T1 (jars) must either re-place a Save jar for the chain or make step 5
  "place the Save jar" + deposit. Add to T1's test list: T1.7 fresh profile → verb chain reaches `tut:done` without a 25 s silent wait.
- `onCuriosityLull` is the only "idle" help and fires once per profile ever; after 7.A the codex makes it redundant, keep as fallback.
- `onLocked` card text says "Invest unlocks at the Ledger" but `jars:locked` fires on mid-season withdrawal attempt (T1.6): wording should
  be "Invest is locked until the Ledger." (≤ 60).
- HUD items have no `title`/help at all (`grep title= ui/hud.js` → 0): nothing on the HUD can be asked. 7.A `data-guide` fixes this.
