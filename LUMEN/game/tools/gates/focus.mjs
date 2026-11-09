// tools/gates/focus.mjs — S68 gate: `node tools/check.mjs --focus`   (section "S67 FOCUS")
// REAL createLumenGame + mountUI (touch strip forced on) on tools/domshim.mjs:
//   F.1  fair sale / Save deposit / refused scam each refill Focus by GAINS (+4 / +10 / +15); a gouge sale and an auto-deposit give nothing
//   F.2  per-season caps (sale 40 / save 30 / scam 30) hold
//   F.3  denial: Focus below the price -> sb.ability returns null, `sandbox:denied why:'focus'` and the pill line "Need N Focus (have M)"; Focus unchanged
//   F.4  HUD pill number + bar === floor(sb.focus.value) after spends, gains and regen; chips dim (.nofocus) below their price on touch AND desktop
//   F.5  `sb.cooldown = {}` shim refills Focus to 100 (old tests / debug) and the 0.6 s gap still blocks a second press
//   F.6  focusRegenMul boon (Steady Mind) speeds regen x1.5 and is stored in eco.state.boons
//   F.7  eco:season resets the caps (runs last: the real handlers open the Ledger)
export async function run({ resolve, pathToFileURL }) {
  let bad = 0, n = 0, cleanup = null, lg = null, ui = null;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  const ok = (label) => { n++; console.log(`  ${label}  OK`); };
  console.log('\nS67 FOCUS:');
  try {
    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createLumenGame } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { FOCUS_COST, GAINS, GAIN_CAP } = await imp('src/systems/focus.js');
    const { readFileSync } = await import('node:fs');
    const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const boonsData = JSON.parse(readFileSync(resolve('data/boons.json'), 'utf8'));

    const bus = new EventBus(); const ev = {};
    for (const k of ['sandbox:denied', 'focus:gain', 'focus:spent', 'focus:change']) bus.on(k, (p) => { (ev[k] ??= []).push(p); });
    const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {}, isTouch: true }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const root = document.body;
    cleanup = () => { try { lg?.destroy?.(); } catch { /* ok */ } try { ui?.destroy?.(); } catch { /* ok */ } for (const el of [...root.children]) el.remove?.(); };
    ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: true, forceTouch: true, version: 'check' });
    lg = createLumenGame(game, { ui, storyData, boonsData, headless: true, seasonSeconds: 3000, seed: 3, verbs: false });
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); ui.update?.(dt); };
    const runS = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) step(); };
    const drain = () => { let k = 0; while (ui.dialogue.isOpen && k < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); k++; } return k; };
    const reset = () => { for (const k of Object.keys(ev)) ev[k].length = 0; };
    const near = (a, b, label, eps = 0.01) => { if (Math.abs(a - b) > eps) throw new Error(`${label}: got ${a} want ${b}`); };

    ui.title.buttons.story.click(); step(); drain();
    if (lg.state !== 'playing' || !lg.sb) throw new Error('PLAY -> ' + lg.state);
    const sb = lg.sb, eco = sb.eco, F = sb.focus; if (sb.enemies) sb.enemies.enabled = false;
    const pill = () => ({ num: +document.querySelector('.ll-focus-num').textContent, w: document.querySelector('.ll-focus-bar i').style.width });
    const set = (v) => { F.st.value = v; F.st.gapLeft = 0; sb._focusEmit(true); };
    const fair = () => bus.emit('cust:paid', { paid: 10, fair: 10, price: 10 });
    const gouge = () => bus.emit('cust:paid', { paid: 30, fair: 10, price: 30 });
    const save = (auto) => bus.emit('game:allocated', { deltas: { save: 10 }, auto: !!auto });
    const scam = () => bus.emit('eco:scamResult', { refused: true });

    // ---- F.1 refills
    set(20); fair(); near(F.value, 20 + GAINS.sale, 'F.1 fair sale');
    set(20); gouge(); near(F.value, 20, 'F.1 gouge gives nothing');
    set(20); bus.emit('cust:paid', { paid: 5, fair: 10, price: 5 }); near(F.value, 20, 'F.1 giveaway gives nothing');
    set(20); save(); near(F.value, 20 + GAINS.save, 'F.1 save deposit');
    set(20); save(true); near(F.value, 20, 'F.1 auto deposit gives nothing');
    set(20); scam(); near(F.value, 20 + GAINS.scam, 'F.1 scam refused');
    set(20); bus.emit('eco:scamResult', { refused: false }); near(F.value, 20, 'F.1 scam accepted gives nothing');
    ok(`F.1 fair sale +${GAINS.sale} · Save +${GAINS.save} · scam refused +${GAINS.scam} · gouge / giveaway / auto-deposit / accepted scam +0`);

    // ---- F.2 season caps
    F.newSeason(); set(0);
    for (let i = 0; i < 40; i++) fair(); near(F.st.got.sale, GAIN_CAP.sale, 'F.2 sale cap'); near(F.value, GAIN_CAP.sale, 'F.2 value after sale cap');
    for (let i = 0; i < 10; i++) save(); near(F.st.got.save, GAIN_CAP.save, 'F.2 save cap');
    for (let i = 0; i < 10; i++) scam(); near(F.st.got.scam, GAIN_CAP.scam, 'F.2 scam cap');
    const v0 = F.value; fair(); save(); scam(); near(F.value, v0, 'F.2 nothing past the caps');
    ok(`F.2 caps sale ${GAIN_CAP.sale} / save ${GAIN_CAP.save} / scam ${GAIN_CAP.scam} hold (nothing is added past them)`);

    // ---- F.3 denial
    set(10); reset();
    const r = lg.ability('bubbleShield');
    if (r) throw new Error('F.3 shield fired with 10 Focus');
    const d = (ev['sandbox:denied'] || []).at(-1);
    if (!d || d.why !== 'focus' || d.need !== FOCUS_COST.bubbleShield || d.have !== 10) throw new Error('F.3 denied payload ' + JSON.stringify(d));
    const line = document.querySelector('.ll-pans-txt')?.textContent;
    if (line !== `Need ${FOCUS_COST.bubbleShield} Focus (have 10)`) throw new Error('F.3 pill line ' + line);
    near(F.value, 10, 'F.3 a denied press costs nothing', 0.5);
    ok(`F.3 10 Focus < ${FOCUS_COST.bubbleShield} -> null · denied why:focus · line "${line}" · Focus untouched`);

    // ---- F.4 pill === sb.focus ; chips dim
    set(100); runS(0.2); set(100);
    const before = F.value; const s = lg.ability('bubbleShield'); runS(0.1);
    if (!s) throw new Error('F.4 shield did not fire with full Focus');
    const p1 = pill(); if (p1.num !== Math.floor(F.value)) throw new Error(`F.4 pill ${p1.num} vs sb.focus ${F.value}`);
    if (!(F.value <= before - FOCUS_COST.bubbleShield + 0.5)) throw new Error('F.4 shield spent ' + (before - F.value));
    fair(); const p2 = pill(); if (p2.num !== Math.floor(F.value)) throw new Error(`F.4 pill after gain ${p2.num} vs ${F.value}`);
    runS(5); const p3 = pill(); if (p3.num !== Math.floor(F.value)) throw new Error(`F.4 pill after regen ${p3.num} vs ${F.value}`);
    if (p3.w !== (Math.floor(F.value) / 100) * 100 + '%' && Math.abs(parseFloat(p3.w) - F.value) > 1.5) throw new Error(`F.4 bar ${p3.w} vs ${F.value}`);
    set(16); runS(0.05); set(16);
    const T = ui.touch.abilities, C = ui.abilityChips.chips;
    for (const id of Object.keys(FOCUS_COST)) {
      const want = F.value < FOCUS_COST[id];
      if (T[id] && T[id].el.classList.contains('nofocus') !== want) throw new Error(`F.4 touch chip ${id} nofocus=${!want}`);
      if (C[id] && C[id].classList.contains('nofocus') !== want) throw new Error(`F.4 desktop chip ${id} nofocus=${!want}`);
    }
    ok(`F.4 HUD pill number + bar === sb.focus after spend (${p1.num}), gain (${p2.num}), 5 s regen (${p3.num}) · chips dim below price on touch + desktop (Focus 16: Dash lit, rest dim)`);

    // ---- F.5 shim + gap
    set(5); sb.cooldown = {}; near(F.value, 100, 'F.5 shim refill');
    if (pill().num !== 100) throw new Error('F.5 pill after shim ' + pill().num);
    reset(); const a1 = lg.ability('coinMagnetDash'); const a2 = lg.ability('coinMagnetDash');
    if (!a1 || a2) throw new Error(`F.5 gap: first ${!!a1} second ${!!a2}`);
    const gd = (ev['sandbox:denied'] || []).at(-1); if (!gd || gd.why !== 'cooldown') throw new Error('F.5 second press why ' + gd?.why);
    ok('F.5 `sb.cooldown = {}` refills to 100 (pill too) · a second press inside 0.6 s -> null + why:cooldown');

    // ---- F.6 focusRegenMul boon
    const boon = Object.values(lg.boons.byId).find((b) => b.fx && b.fx.focusRegenMul);
    if (!boon) throw new Error('F.6 no boon carries fx.focusRegenMul');
    set(0); runS(5); const base = F.value; near(base, 10, 'F.6 base regen 2/s', 0.6);
    lg.boons.apply(eco, boon.id); if (!eco.state.boons.some((b) => b.id === boon.id)) throw new Error('F.6 boon not stored');
    set(0); runS(5); const boosted = F.value; if (!(boosted > base * 1.3)) throw new Error(`F.6 boosted ${boosted} vs base ${base}`);
    ok(`F.6 boon "${boon.id}" (focusRegenMul x${boon.fx.focusRegenMul}) -> 5 s regen ${base.toFixed(1)} -> ${boosted.toFixed(1)}`);

    // ---- F.7 a new season resets the caps (LAST: the real eco:season handlers open the Ledger and pause the game)
    set(0); for (let i = 0; i < 10; i++) fair(); if (!(F.st.got.sale > 0)) throw new Error('F.7 setup');
    try { bus.emit('eco:season', { season: 2 }); } catch { /* other listeners may dislike the bare payload; ours already ran */ }
    near(F.st.got.sale + F.st.got.save + F.st.got.scam, 0, 'F.7 eco:season resets the caps');
    set(0); fair(); near(F.value, GAINS.sale, 'F.7 refill works again in the new season');
    ok('F.7 eco:season resets the per-season caps -> a fair sale refills again');

    console.log(`  S67 FOCUS: ${n}/${n} PASS`);
  } catch (err) {
    bad++; console.log(`  S67 FOCUS FAIL (after ${n} OK) -> ${err?.stack?.split('\n').slice(0, 3).join(' | ') || err}`);
  }
  finally { cleanup?.(); }
  return bad;
}
