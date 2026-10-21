Date: 2026-10-21. Scope: report only; NO game-source fixes applied.

# 1. Provenance, delivery, and limits

-   Tested input: the user\'s uploaded LUMEN.tar.gz, extracted unchanged
    to /home/user/webapp/LUMEN/. The playable application is
    LUMEN/game/index.html.

-   Requested upstream: https://github.com/Goodboycat/Lumen-Ledger.
    GitHub authorization setup returned "GitHub Session State Missing".
    No GitHub clone, pull, or push was performed. This is NOT
    represented as the latest GitHub revision. Connect that repository
    in the GitHub panel before the next chat synchronizes it.

-   Local git checkpoints were made after import, preview setup,
    incomplete testing, completed testing, and report/package
    preparation. Failed/incomplete probes are retained in git history.
    GitHub pushes are blocked, not completed.

-   No credential is included in this document or the downloadable game.
    Revoke the token exposed in the original conversation.

-   Added files are QA scripts, evidence, this report, packaging
    support, preview configuration, and workspace documentation. The
    imported game files must remain byte-identical to the supplied
    archive.

-   This is a bounded beta test, not a claim that every possible bug has
    been discovered.

-   Browser: automated Chromium on Linux, desktop viewport 1280 x 720.
    One supplementary 360 x 800 viewport probe. No physical Android/iOS,
    Safari, Firefox, offline install, APK, controller, or long-duration
    audio testing.

-   The first rendering-enabled attempt reached season 6 but exceeded
    the 10-minute command limit; it is INCOMPLETE, not one of the two
    completed runs.

-   The two completed runs used the built-in ?season=1&seed=1 flag, one
    browser page and context, no reload between runs, normal gameplay
    clock, and automated dialogue UI methods. The first run bought one
    fruit stand with existing money. Software GPU rendering was disabled
    at runtime after initial load because it was prohibitively slow.
    Game/UI logic still ran. Consequently, run screenshots prove DOM
    overlays/counters, NOT a complete rendered-world or performance
    assessment. Source files were never altered to do this.

-   Targeted checks used runtime fixture funds/state and stopped
    rendering to reach saves, upgrades, and the otherwise inaccessible
    victory path. Those results are marked instrumented rather than
    unaided gameplay wins. Tiny seasons intentionally distort
    income/customer pacing: do NOT infer normal-season profitability or
    balance from them.

# 2. Two consecutive runs --- actual observations

## Run 1

1\. Open /game/?notutorial&mute&nohistory&season=1&seed=1 and click
PLAY.

2\. Starting state: season 1, 100 Spark, 260 debt, fog 0.40. Only fruit
and bread starter stalls exist; tea fails to load for this seed. Build
badges are empty/zero despite those existing stalls.

3\. Deploy and purchase one additional fruit stand. Economy stall count
becomes 3; the fruit badge becomes 1 even though two fruit stands exist.

4\. Advance dialogue, reject scam choices, continue season ledgers.
Accelerated run loses at the end of season 6 with debt 1037 and fog
0.76. Debt loss threshold is \> 1000 in the tuned Story balance.

5\. TRY AGAIN returns to title. Actual placed stalls are gone. The fruit
badge still records 1; one old vignette remains at opacity 0.428. The
scene retains 29 direct children and the loop retains 3 systems.

## Run 2 --- same tab, no reload or storage reset

1\. Click PLAY again. New economy returns to 100 Spark / 260 debt / fog
0.40 and only the two starter stalls.

2\. The old fruit badge remains 1. There is NO extra purchased stall in
the new BuildSystem. This confirms stale displayed ownership, not
persistence of the purchased world building or its upkeep count in this
particular path.

3\. Two vignette elements now exist, one still at opacity 0.428 from run
1 and the new one at zero.

4\. Continue until loss at the end of season 7: debt 1060, fog 0.81.

5\. Return to title: both vignette elements remain (0.428 and 0.477);
scene children are now 55 and systems 4.

Both runs reached loss and returned to title. Neither was a legitimate
win. Zero spontaneous page errors were recorded in the completed runs.
Exact states and season logs: qa/evidence/two-runs.json.

# 3. Priority and evidence legend

-   P0: prevents the advertised core game from being completed.

-   P1: major incorrect state, money/progression loss, or unusable
    interaction.

-   P2: significant misleading UI, input, settings, or lifecycle defect.

-   RUN: reproduced in the two consecutive sessions.

-   INSTRUMENTED: reproduced with explicit runtime fixtures or UI/system
    method calls.

-   SOURCE: direct wiring/source evidence; not a successful
    normal-player end-to-end reproduction.

# 4. Bug register --- 24 actionable findings

## B01 --- P0 --- No player-facing repayment; normal Story victory is unreachable

Evidence: RUN + SOURCE + INSTRUMENTED. The player starts with 260 debt.
Economy.repay(amount) exists, but no UI or normal input calls it. Fog
Sweep only calls pushFog; it does not repay any principal. isWin()
explicitly rejects debt \> 0.

Reproduce: start Story, inspect jars, build, pause, dialogue, and ledger
controls; attempt to pay the Baron. There is no repayment action. Let
seasons pass. In a separate controlled check, replenish the pouch to
100000 before every endSeason() to remove insolvency as a confounder.
Debt still grows 312, 374, 449, 539, 647, 776, 931, 1117 and loses at
season 8 even with ample cash. This is not a normal playthrough balance
result: it isolates missing repayment.

Expected: an accessible repayment decision can reduce principal, update
HUD/ledger, and permit a debt-free win. Fix and re-test normal play
before rebalancing.

Locations: src/systems/economy.js:275-290, 390-455; src/Game.js:249,
installRunWires; ui/index.js. Evidence:
additional-checks.json.noRepayment.

## B02 --- P1 --- Purchased build badges survive loss/new game

Evidence: RUN. After buying a fruit stand in run 1 and returning to
title, ui.build.state.counts.stall_fruit stays 1. Starting run 2 does
not reset it although the old stand no longer exists.

Expected: ownership badges reflect only the current run. Clear/rebuild
counts and tracked entries on teardown, new game, and restore. This test
does not prove extra upkeep from the previous purchased stall; economy
counts actually reset here.

Locations: ui/build.js:43, 178, 206-216; src/Game.js
installStart/teardown. Evidence: two-runs.json, run1.afterReturn and
run2.start.

## B03 --- P1 --- Purple debt vignette and old fog remain after loss/restart

Evidence: RUN. One old .vfx-vignette remains at opacity 0.428 after run
1; run 2 creates another rather than removing it. After run 2 both
remain (0.428, 0.477). The old VFX no longer gets updated, so it cannot
fade itself out.

Expected: remove or dispose all run-owned fog geometry, vignettes,
flashes, and pulses when leaving a run; initialize only the new run\'s
effects. Do not merely hide the new vignette.

Locations: src/Game.js destroySandbox; src/vfx/pack2.js:275-308 (dispose
exists but teardown does not invoke it). Evidence:
two-runs.json.vignettes. Full moving-world appearance was not visually
validated with the disabled renderer.

## B04 --- P1 --- Run-owned VFX scene objects accumulate

Evidence: RUN + INSTRUMENTED. At title after first loss: 29 scene
children; after second: 55. Additional controlled starts/teardowns show
185, 211, 237 children (+26 each time). Removing VFX from game.systems
does not remove its meshes/sprites/DOM resources.

Expected: scene objects and GPU/resource ownership return to a stable
baseline after teardown. Test repeated starts without reload; measure
counts and memory, not merely appearance.

Locations: src/Game.js destroySandbox; src/vfx/VFX.js constructors and
pack1/pack2 disposal. Evidence: two-runs.json, diagnostics.json.leaks.
No hardware FPS/memory benchmark was performed; performance harm is a
risk, not a measured FPS claim.

## B05 --- P2 --- Hero lateUpdate system leaks across runs

Evidence: RUN + SOURCE. Title systems increase from 3 to 4 after the two
runs; controlled restarts add one each time. HeroController adds an
anonymous lateUpdate solver but teardown only unregisters the main
sandbox and VFX systems. Old hero objects remain retained by closures.

Expected: unregister that per-hero solver and its references. Verify
constant system count after repeated restarts.

Locations: src/entities/HeroController.js:66; src/Game.js
destroySandbox. Evidence: two-runs.json and diagnostics.json.leaks.

## B06 --- P2 --- Starter and restored buildings show zero build-card ownership

Evidence: RUN + INSTRUMENTED. A fresh run contains fruit/bread (and tea
for other seeds), but st.counts is empty. Selecting a fruit type can say
"1 placed" in the details while the card badge says zero. The silently
loaded starter/save placements emit build:loaded, which only refreshes
the existing counts.

Expected: every badge and detail panel derives from the live placed
collection after starter load and restore, not just events for paid
placements.

Locations: ui/build.js:95-117, 206-211; src/Game.js
placeStarterStalls/applySnapshot. Evidence: both run starts;
diagnostics.json.initial.

## B07 --- P2 --- Seed 1 scenery blocks the tea starter stall

Evidence: RUN + INSTRUMENTED. With ?seed=1, the intended stall_tea
anchor (-3,-6) includes a cell occupied by SCENERY. Build.load silently
fails to place tea, so only two of the three intended starter stalls
exist. This is seed-dependent; the default-seed supplementary test has
all three.

Expected: reserve starter footprints before scenery generation or select
a valid fallback and validate load results. Ensure deterministic initial
facilities across seeds unless variance is intentional and communicated.

Locations: src/Game.js buildScenery/placeStarterStalls:106-151;
src/systems/build.js load/canPlace. Evidence:
additional-checks.json.seed1Starter.

## B08 --- P2 --- Initial world fog is zero while HUD/economy say 35-40%

Evidence: INSTRUMENTED. At Story start economy fog01=0.40 while the new
fog target is zero. At direct Endless start the equivalent pair is 0.35
and zero. HUD.sync does not synchronize the world VFX. World coverage
catches up only after a later eco:fog event.

Expected: world fog/towers/vignette match initial and restored economy
state immediately.

Locations: src/Game.js:54, wireEconomy eco:fog,
installStart/applySnapshot. Evidence:
additional-checks.json.seed1Starter.fog; diagnostics.json.initial.

## B09 --- P1 --- All stall cards quote the wrong construction cost

Evidence: INSTRUMENTED + SOURCE. Cards and affordability use
PROP_CATALOG.cost; BuildSystem charges economy.stallCost. Story
examples: fruit 40 shown / 60 charged, bakery 55/80, lantern 70/120,
fish 65/95, tea 80/55, Spark Exchange 150/250. All twelve sampled stall
types disagree.

Reproduce: hold 45 Spark, select the fruit card advertising 40. The UI
offers Deploy, but actual 60-Spark placement is unaffordable.
Conversely, tea can be made unavailable even when the player can afford
its actual lower price.

Expected: one authoritative price for cards, deploy checks, placement,
tutorials, and refunds. Story and Endless currently also use different
balance inputs, so compare each mode separately.

Locations: ui/build.js renderGrid/refreshDetail; src/systems/build.js
cost; src/systems/economyData.js. Evidence:
additional-checks.json.storyPrices/affordability,
diagnostics.json.initial.prices.

## B10 --- P1 --- Paid stall upgrades do not apply the promised sales multiplier

Evidence: INSTRUMENTED + SOURCE. A fixture upgrades fruit L1 -\> L2 and
pays 90. CustomerSystem.\_settle still calls
economy.sell(\'stall_fruit\',\'regular\',6) with no fourth options
argument or level multiplier. The glue wrapper supplies haggle/growth
only; it never looks up the upgraded stall level.

Expected: sales at upgraded stalls apply their 1.5x/2.2x base
multipliers; non-upgraded siblings remain unchanged. The catalogue\'s
promised upkeep changes also need an implementation audit (C01).

Locations: src/systems/customers.js:334-338; src/Game.js:225-230;
src/systems/build.js upgrade; economyData.js:87-89. Evidence:
diagnostics.json.upgrade.

## B11 --- P1 --- Jar balances cannot be withdrawn through the player UI

Evidence: INSTRUMENTED + SOURCE. Allocate all 120 fixture Spark to Save,
then change sliders to 100% Spend and press Apply: pouch remains zero
and applyJars returns false. Sliders only distribute the current pouch.
No withdrawal or transfer UI exists, although Economy.allocate supports
negative jar deltas.

Expected: a clear, reachable way to transfer available balances back to
spending/repayment, or an explicitly different jar model that does not
trap essential funds. Savings interest is not useful purchasing power
without such an action.

Locations: src/Game.js applyJars; ui/jars.js; src/systems/economy.js
allocate. Evidence: diagnostics.json.jars.

## B12 --- P1 --- "RESTART SEASON" restarts the entire run

Evidence: INSTRUMENTED. From a fixture at season 5 with 888 Spark,
trigger the pause restart action. It returns to season 1 and the mode\'s
starting money. The visible label is RESTART SEASON, not restart game.

Expected: restore the beginning of the current season, or clearly label
the destructive whole-run action before confirmation. The confirmation
alone does not correct its false scope.

Locations: ui/pause.js:63,113; src/Game.js installMenu. Evidence:
diagnostics.json.restart.

## B13 --- P1 --- Placement remains active after UI exits; Esc no longer cancels it

Evidence: INSTRUMENTED. After successfully confirming a placement,
BuildSystem intentionally remains mode=\'place\' with a ghost, but
build:placed sets ui.build.state.placing=null. Press Esc: the tray
closes while the BuildSystem remains in place mode and its ghost still
exists. A subsequent world click can still place another building and
spend money after the placing UI disappeared.

Expected: keep the placing UI in sync for repeat placement or exit both
layers atomically. Esc must cancel the actual placement, not only the
tray.

Locations: ui/build.js:193-206; src/systems/build.js place/confirm;
src/Game.js ui:build:close and input.onTap. Evidence:
diagnostics.json.placing.

## B14 --- P1 --- Unlocked zones are lost on save/Continue

Evidence: INSTRUMENTED. Unlock zone 1, take a snapshot, return to title,
resume. Zone flags change \[true,true,false,false\] -\>
\[true,false,false,false\]. Snapshot contains no zone state and
applySnapshot does not restore it. This was reached via a fixture
because regular zone controls are missing (B24).

Expected: paid/unlocked territory and dependent bridges/buildings
survive saves. Restore unlocks before loading buildings on those zones;
otherwise saved placements may be rejected.

Locations: src/systems/save.js snapshot; src/Game.js applySnapshot;
src/world/Island.js. Evidence: diagnostics.json.saveResume.

## B15 --- P1 --- Save restore charges decor as stall upkeep

Evidence: INSTRUMENTED. Before saving: 3 stalls + one jar_spend decor
item, economy stalls=3. After restore: 4 total placed items and economy
stalls=4 although build.stalls().length=3. applySnapshot assigns
build.placed.size rather than filtering stall category.

Expected: upkeep counts only stalls, consistently before/after save,
including zero-stall and decor-only saves.

Locations: src/Game.js applySnapshot:574; countStalls:202. Evidence:
diagnostics.json.saveResume.

## B16 --- P2 --- Per-stall-type prices are not saved

Evidence: INSTRUMENTED. Set fruit price to 17 with
CustomerSystem.setPrice, snapshot/resume: price returns to 6. The
snapshot has no customer price map. Normal price editing is itself
absent (B24); this is a developer-facing persistence defect for when
that UI is connected, not evidence that a current player can change it.

Expected: persist user-controlled prices and other explicitly supported
economy settings. Restore without changing already chosen strategy.

Locations: src/systems/customers.js prices/setPrice; src/systems/save.js
snapshot; src/Game.js applySnapshot. Evidence:
diagnostics.json.saveResume.

## B17 --- P2 --- Returning to TITLE does not save current progress or warn about the checkpoint

Evidence: INSTRUMENTED + SOURCE. In a fresh first-season fixture, clear
the save, change the pouch, then choose TITLE: no save exists and
Continue is unavailable. Autosave only occurs at season-end and review
transitions. Purchases/money since the last checkpoint are discarded
when returning to title; first-season progress can be lost completely.

Expected: save on deliberate quit/title or explicitly warn that only the
last season checkpoint will be kept. This is distinct from the
intentional design choice not to save every frame.

Locations: src/Game.js toTitle/installSave. Evidence:
additional-checks.json.quitSave. The probe\'s titleContinue string check
is supplementary; lg.save.has() is the authoritative observation.

## B18 --- P1 --- Invalid nested save is accepted, then Continue throws

Evidence: INSTRUMENTED. Import JSON {\"v\":1,\"eco\":\"not json\"}.
importText returns true and hasSave returns true, but resume throws a
JSON parse error. parseSnapshot checks only version and presence of eco.
A corrupt slot can thus advertise a valid Continue action and fail
during restoration.

Expected: validate nested structures/types/ranges before accepting a
slot/import, handle invalid data without losing the title UI, and
preserve a valid previous save until validation succeeds.

Locations: src/systems/save.js parseSnapshot/importText; src/Game.js
resume/applySnapshot. Evidence: diagnostics.json.corruptSave. This
exception was deliberately caught by the harness; it was not a
spontaneous gameplay error.

## B19 --- P1 --- Endless mode can "win" repeatedly

Evidence: INSTRUMENTED. Inject a debt-free fog-free season-10 state
solely to reach victory. End season, continue to Endless, then end the
next healthy season. Economy emits eco:win again for season 11 and
lg.state returns to ending; another ledger is opened. A separate
Story-origin fixture likewise returns from Endless to ending with
ended=\'win\'.

Expected: one story victory transition; Endless continues ordinary
seasons without re-triggering the completion gate. Do not use this
fixture as proof of an unaided winnable game.

Locations: src/Game.js goEndless/wrapNoScam; src/systems/economy.js
isWin/endSeason; story.js onWin finale guard. Evidence:
diagnostics.json.win; additional-checks.json.storyEndless. A permanent
softlock was NOT established, so do not label this report as one.

## B20 --- P2 --- W movement also activates Bubble Shield

Evidence: INSTRUMENTED normal keyboard dispatch. Press W: Input.move is
\[0,1\], and the game ability listener simultaneously requests
bubbleShield. W belongs to both WASD and the ability map.

Expected: non-conflicting defaults or explicit remapping/context gating,
including cooldown and accidental activation tests while walking.

Locations: src/core/Input.js KEY_MOVE; src/Game.js ABILITY_KEYS and
onKey. Evidence: diagnostics.json.keyW.

## B21 --- P2 --- Advertised R rotation activates Ledger Flash instead

Evidence: INSTRUMENTED normal keyboard dispatch, without ?debug. While
placing fruit, press R: rot stays 0 and ledgerFlash is requested. The
tray displays R beside Rotate, but its keyboard handler implements only
B/Esc. R rotation exists only in debug keys; default game disables them.

Expected: R rotates during placement and does not trigger an ability;
outside placement it may be an ability key. Do not solve this by
enabling all debug keys in production: E would then also end seasons.

Locations: ui/build.js:49,193-199; src/Game.js
ABILITY_KEYS/installDebugKeys/installRunWires. Evidence:
diagnostics.json.keyR.

## B22 --- P2 --- Quality setting does not apply the defined quality preset

Evidence: INSTRUMENTED + SOURCE. Choose low: renderer DPR becomes 1, but
shadowMap.enabled stays true and game.quality still describes the high
preset (1.5 DPR cap, shadows true, shadowSize 2048, antialias true).
There is no game.setQuality implementation; the menu handler fallback
only sets DPR. Loaded settings also have no initial quality application
event.

Expected: apply documented low/medium/high behavior coherently on boot
and change, or relabel the control as render scale. Actual hardware
performance and antialias recreation requirements need separate testing.

Locations: src/core/Game.js QUALITY/constructor; src/Game.js
ui:settings; ui/pause.js initialization. Evidence:
additional-checks.json.quality.

## B23 --- P2 --- Reduce Motion is not wired to run-owned 3D effects

Evidence: INSTRUMENTED + SOURCE. Enable Reduce Motion: UI setting and
current sb.reduceMotion become true. Restart: setting stays true but new
sb.reduceMotion is absent. Source search also finds no effect code
consuming that flag, so setting it on the old sandbox alone does not
disable its 3D motion.

Expected: initialize settings for every run and apply accessible
reduced-motion behavior to camera shake, pulses, movement-heavy VFX, and
applicable animations. CSS-only reductions are not a complete
substitute; do not claim this test proves all CSS animation is broken.

Locations: src/Game.js installMenu:406-408; ui/pause.js. Evidence:
diagnostics.json.settings.

## B24 --- P1 --- Advertised price, helper, and territory decisions are inaccessible normally

Evidence: SOURCE + instrumented UI inventory. GDD advertises setting
prices, hiring helpers, and unlocking zones. The mounted UI has
build/decor/nature/upgrades but no prices, hire, or zone purchase
panels. Hire and unlock commands are only exposed by debug H/Z; normal
games pass debugKeys=false. No normal UI calls CustomerSystem.setPrice.
Interact has no corresponding price/hire/zone action wired here.

Expected: explicit reachable controls with costs, prerequisites,
feedback, and tutorial support, or remove those promises from the
shipped scope. The next chat must not mistake console/debug commands for
player-facing features.

Locations: src/Game.js installDebugKeys/hireHelper/installRunWires;
ui/index.js; src/systems/customers.js setPrice; docs/GDD.md:16,31-32.
Evidence: diagnostics.json.initial.buttons and source wiring audit.

# 5. Additional source-review findings --- separate verification queue

These are not counted as completed player-flow reproductions. Validate
them after the P0/player-control blockers are addressed.

## C01 --- P2 --- Stall/helper advertised upkeep and helper bonuses are not consumed

UPGRADES supplies stall upkeep +3/+6 and helper wages plus
interestBonus/upkeepMul/baseMulAll/protectBonus/revealScams/reputationBonus.
endSeason calculates only baseUpkeep + upkeepPerStall \* stalls;
hireHelper creates/animates a helper, but does not register these
benefits or wages. Source search finds definitions, not consumers of
these economy effects. Verify each advertised benefit and its cost
independently with deterministic engine tests. Locations:
economyData.js:87-96; economy.js endSeason; Game.js hireHelper.

## C02 --- P2 --- Restoring non-prefix helper sets can hire the wrong types

applySnapshot loops saved helper ids, derives each desired type, then
calls hireHelper(sb), which always chooses the first not-yet-owned type
in HELPER_TYPES, ignoring the derived requested type. Sequential normal
hires form a prefix, so ordinary saves may hide this. Test a
migrated/imported save with only helper_sparkBee and compare exact
restored ids. Location: Game.js:575 versus hireHelper:297-299.

## C03 --- P2 --- Upgrade prerequisites are not enforced by the purchasing entry point

canBuyUpgrade checks requirements, but Economy.buyUpgrade does not call
it and records no ownership. Repeated zone purchases or buying
season-gated helpers through future UI wiring may charge incorrectly.
Test idempotence, prerequisite failure, season gates, and
no-money-loss-on-failure before connecting missing controls. Locations:
economyData.js:148-158; economy.js:370.

## C04 --- P2 --- Starting a new story may retain a previous run\'s save slot

lg.start(\'story\') does not clear the save; it only updates title
hasSave. Before that new game reaches its first checkpoint, returning to
title may offer Continue for the previous island. Design decision
needed: overwrite/clear on confirmed new game, keep multiple named
slots, or explicitly warn. Verify with two distinguishable save
snapshots. Location: Game.js installStart/installSave.

## C05 --- P2 --- Lighthouse victory check does not require reaching/unlocking the lighthouse zone

isWin checks season/debt/fog, not lighthouse-zone ownership or
interacting with the lighthouse. The win listener lights the prop
automatically even when its zone is locked. This can be a deliberate
simplification, but conflicts with GDD/story instructions to buy/reach
Far Point; obtain intended rule before changing it. Locations:
economy.js isWin; Game.js wireEconomy eco:win; story.json season-10
text.

## C06 --- Packaging/documentation debt --- documented test tools are absent from this input

The game\'s README references tools/check.mjs, tests/economy.sim.mjs,
mobile smoke scripts, demos, and API contracts, but this supplied
archive does not contain those directories/files. The custom QA
harnesses in this handoff are NOT those original suites and do not
replace them. Retrieve the actual full repository after authentication
and compare it to the archive; do not claim the documented 80/58
assertion suites passed.

# 6. Results that should NOT be reported as confirmed defects

-   Supplementary 360 x 800 inspection found no document horizontal
    overflow. Some card bounds extended below the viewport, but this was
    during tray animation and the grid may scroll. Offscreen bounds
    alone do NOT establish inaccessible mobile controls. Re-test after
    transitions and scrolling on a physical touch device.

-   Failed browser launch due to missing Linux shared libraries and the
    initial timeout were sandbox/test-environment problems, not LUMEN
    bugs. Dependencies were installed and tests resumed.

-   There were no spontaneous JS page errors in the completed two-run
    suite; this does not prove stability across untested
    devices/actions.

-   The first run purchased a fruit stand with the live UI confirm
    event; its cursor was positioned via BuildSystem.moveTo. The harness
    fallback was used because the initially chosen CSS selector did not
    match. That selector mismatch is not a game defect.

-   Old badge ownership is proven; cross-run economy upkeep persistence
    from that particular stand is not. The separate restore bug that
    counts decor as stalls is independently documented as B15.

-   Save event ordering briefly writes a terminal-season snapshot before
    eco:lose clears it; diagnostics capture this, but no crash/reload
    exploit or durable invalid slot was proven. Keep it as an ordering
    concern, not a separate confirmed save-loss bug.

# 7. Suggested repair order for the NEXT chat (no changes made here)

1\. Authorize GitHub, pull the requested upstream, and compare versions
before applying any fix. Preserve this archive/report as the tested
baseline.

2\. B01: implement accessible repayment and jar withdrawals; prove a
legitimate debt-free Story win through player controls.

3\. B02-B08/B13: unify lifecycle teardown/restart and UI/world-state
reconstruction. Make the requested loss -\> new run regression test
mandatory. Add victory -\> new run too.

4\. B09-B10/B24: authoritative costs, effective upgrades, and accessible
progression decisions; validate complete normal 150-second seasons
before economy tuning.

5\. B14-B18/C02-C04: save schema, nested validation, unlocks, prices,
exact helpers, correct upkeep counts, and clear quit/new-game semantics.

6\. B19-B23: one-time victory transition, input contexts, and real
accessible/performance settings.

7\. Run the original full suites (if recovered), new deterministic
regressions, and real desktop/mobile gameplay with rendering/audio
enabled. Commit and push each completed or incomplete task only after
valid GitHub authorization.

# 8. Evidence and reproduction files

Repository QA directory:

-   qa/two-runs.mjs --- two consecutive loss sessions, no reload.

-   qa/diagnostics.mjs --- controlled
    keyboard/build/save/settings/victory probes.

-   qa/additional-checks.mjs --- seed 1, debt-growth isolation,
    Story-origin victory, quit, price/quality/mobile checks.

-   qa/evidence/two-runs.json, diagnostics.json, additional-checks.json
    --- exact observations.

-   qa/evidence/\*.png --- title and DOM-overlay checkpoints; remember
    rendered-world limitations.

-   qa/LUMEN_BUG_REPORT.md and .docx --- this handoff in editable
    formats.

-   qa/evidence/archive-integrity.json --- archive byte-comparison
    result (generated at packaging).

Requirements for rerunning custom browser harnesses: Node.js, Playwright
and Chromium plus Linux dependencies; serve the unchanged game at
http://localhost:3000/game/. From /home/user/webapp run node
qa/two-runs.mjs, node qa/diagnostics.mjs, or node
qa/additional-checks.mjs. The preview host serves a build-time copy in
dist/game; regenerate that copy if testing a later game revision.
Harnesses intentionally instrument runtime state; read their method
fields before interpreting results.

ZIP delivery: index.html is at the ZIP root for ordinary static hosting.
The unchanged game includes vanilla ES modules, vendored Three.js, story
data, UI, docs, and audio. QA report/evidence are included under QA/.
Extract and serve over HTTP; double-clicking file:// is not a supported
launch method. No production deployment or public hosting claim is made.
