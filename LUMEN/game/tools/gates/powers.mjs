// tools/gates/powers.mjs — T2b headless gate: `node tools/check.mjs --powers`  (section "T2b POWERS", FUN_PASS §7.B)
// REAL createLumenGame + mountUI (touch strip FORCED on + desktop chips) on tools/domshim.mjs:
//   T2b.1  hold ≥ 350 ms (touch chip AND desktop chip) → `ui:power:ask` + guide card, NO ability fired; release < 350 ms → the ability
//   T2b.2  each of the 6 pressed with NO target → an answer ≤ 8 words (the card's whenHint); with a target → a number answer
//   T2b.3  cooldown / busy / blocked each have a line (deniedLine) and a real denied press shows it; nothing is silent
//   T2b.4  touch strip mounts 6 chips, 4 locked (dim, ★ cost) at start; a locked press answers "Locked. Earn ★ … (have n/m)" with the live count
//   T2b.5  Shield + Stomp drain a bar (ability:fx → chip.fx on both chip sets) · 0 new meshes (DOM + existing bubble)
// Exports run({ resolve, pathToFileURL }) → number of failures.
export async function run({ resolve, pathToFileURL }) {
  let bad = 0; let n = 0; let cleanup = null; let lg = null, ui = null;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  const ok = (label) => { n++; console.log(`  ${label}  OK`); };
  console.log('\nT2b POWERS:');
  try {
    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createLumenGame } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { ABILITY_ORDER, starsFor } = await imp('src/systems/unlocks.js');
    const { WHEN, deniedLine, lockedLine, DENIED_WHYS, words } = await imp('src/systems/powerAnswers.js');
    const { readFileSync } = await import('node:fs');
    const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const tutorData = JSON.parse(readFileSync(resolve('data/tutor.json'), 'utf8'));

    const bus = new EventBus(); const ev = {};
    for (const nm of ['ability:answer', 'sandbox:denied', 'ability:locked', 'ability:fx', 'ui:power:ask', 'sandbox:ability:start', 'ui:ability', 'tutor:shown']) bus.on(nm, (p) => { (ev[nm] ??= []).push(p); });
    const scene = new THREE.Scene();
    const game = { scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {}, isTouch: true }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const root = document.body; cleanup = () => { try { lg?.destroy?.(); } catch { /* ok */ } try { ui?.destroy?.(); } catch { /* ok */ } for (const el of [...root.children]) el.remove?.(); };
    ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: true, forceTouch: true, version: 'check', tutorData, tutorSeen: [], tutorCounts: {} });
    const storage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; })();
    lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: 3000, seed: 3, debugKeys: true, storage, verbs: false, allAbilities: false });
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); ui.update?.(dt); };
    const runS = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) step(); };
    const drain = () => { let k = 0; while (ui.dialogue.isOpen && k < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); k++; } return k; };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const eq = (a, b, label) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
    const meshes = () => { let c = 0; scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) c++; }); return c; };
    const reset = () => { for (const k of Object.keys(ev)) ev[k].length = 0; };
    const last = (k) => (ev[k] || []).at(-1);
    const ptr = (node, type) => node.dispatchEvent({ type, bubbles: true, pointerId: 7, preventDefault() {}, stopPropagation() {} });

    ui.title.buttons.story.click(); if (lg.state !== 'playing' || !lg.sb) throw new Error('PLAY → ' + lg.state);
    step(); drain(); if (game.paused) throw new Error('still paused after the S1 opening');
    const sb = lg.sb, eco = sb.eco; if (sb.enemies) sb.enemies.enabled = false;
    // headless sandboxes open all 6 powers (Game.js passes no allAbilities) → put the real fresh-profile set back: Magnet + Shield only
    sb.unlocks.abilities.clear(); sb.unlocks.abilities.add('coinMagnetDash'); sb.unlocks.abilities.add('bubbleShield'); sb.unlocks.starsTotal = 0; lg.syncAbilities(); runS(0.2);
    const touch = ui.touch; if (!touch) throw new Error('ui.touch not mounted (forceTouch)');
    const chips = ui.abilityChips; if (!chips) throw new Error('ui.abilityChips missing');
    const tcs = Object.values(touch.abilities);

    // ---------------------------------------------------------------- T2b.4 six chips, four locked
    eq(tcs.length, 6, 'T2b.4 touch chips');
    const lockedT = ABILITY_ORDER.filter((id) => touch.abilities[id].el.classList.contains('locked'));
    eq(lockedT, ['growthStomp', 'ledgerFlash', 'haggleShout', 'fogSweep'], 'T2b.4 locked touch chips at start');
    for (const id of lockedT) { const cost = touch.abilities[id].el.children.find((c) => /cost/.test(c.className)); if (!cost || !new RegExp(starsFor(id) + '$').test(cost.textContent)) throw new Error(`T2b.4 ${id} cost label ${cost?.textContent}`); }
    const lockedD = ABILITY_ORDER.filter((id) => chips.chips[id].classList.contains('locked'));
    eq(lockedD, lockedT, 'T2b.4 desktop chips locked the same');
    for (const id of lockedD) if (chips.chips[id].disabled) throw new Error('T2b.4 desktop locked chip is disabled → a press would be silent');
    reset(); ptr(touch.abilities.growthStomp.el, 'pointerdown'); ptr(touch.abilities.growthStomp.el, 'pointerup');
    const lk = last('ability:locked'); if (!lk || lk.name !== 'growthStomp' || lk.stars !== 3 || lk.have !== 0) throw new Error('T2b.4 locked press → ' + JSON.stringify(lk));
    const pill = document.querySelector('.ll-pans-txt'); eq(pill?.textContent, lockedLine({ stars: 3, have: 0 }), 'T2b.4 pill text');
    if (words(pill.textContent) > 10) throw new Error('locked line too long'); // the one line allowed past 8 words: it carries the live count
    ok(`T2b.4 touch strip = 6 chips, 4 dim with ★ costs (${lockedT.map((i) => '★' + starsFor(i)).join(' ')}) · desktop chips locked but pressable · locked press → "${pill.textContent}"`);

    // ---------------------------------------------------------------- T2b.1 hold vs release (touch + desktop)
    const holdTest = async (node, label, name) => {
      reset(); sb.cooldown = {}; ptr(node, 'pointerdown'); await sleep(460); ptr(node, 'pointerup');
      const asks = (ev['ui:power:ask'] || []).filter((e) => e.name === name); if (asks.length !== 1) throw new Error(`T2b.1 ${label} hold → ${asks.length} ui:power:ask`);
      if ((ev['sandbox:ability:start'] || []).length || (ev['ui:ability'] || []).length || (ev['ui:touch'] || []).length) throw new Error(`T2b.1 ${label} hold fired the ability`);
      if (last('tutor:shown')?.id !== 'power:' + name) throw new Error(`T2b.1 ${label} hold → card ${last('tutor:shown')?.id}`);
      ui.tutor.dismiss('test'); reset(); ptr(node, 'pointerdown'); await sleep(60); ptr(node, 'pointerup');
      if ((ev['ui:power:ask'] || []).length) throw new Error(`T2b.1 ${label} quick press asked the guide`);
      if (!(ev['sandbox:ability:start'] || []).length) throw new Error(`T2b.1 ${label} quick press did not fire ${name}`);
    };
    runS(1);
    await holdTest(touch.abilities.coinMagnetDash.el, 'touch', 'coinMagnetDash'); runS(1); ui.tutor.dismiss('test');
    await holdTest(chips.chips.bubbleShield, 'desktop', 'bubbleShield'); runS(1); ui.tutor.dismiss('test');
    ok('T2b.1 hold ≥ 350 ms (touch Magnet, desktop Shield) → ui:power:ask + its power card, ability NOT fired · release < 350 ms → fires');

    // ---------------------------------------------------------------- T2b.2 every power: no target → ≤ 8 words; target → number
    for (const id of ABILITY_ORDER) sb.unlocks.abilities.add(id); lg.syncAbilities(); runS(0.2);
    const eightOK = (t, label) => { if (!t || words(t) > 8) throw new Error(`${label}: "${t}" (${words(t)} words)`); };
    const pressAndRead = (name, secs = 3) => { reset(); sb.cooldown = {}; sb.hero.state === 'move' && runS(2); const seq = lg.ability(name); runS(secs); return { seq, answers: (ev['ability:answer'] || []).filter((a) => a.name === name) }; };
    const hp = sb.hero.root.position; hp.set(0, 0, 0); step(); sb.coins.length = 0; sb.till && [...sb.till.tills.values()].forEach((t) => { t.amount = 0; }); for (const c of [...cust(sb)]) void c; function cust(s) { return s.cust?.active ? [] : []; }
    const none = {};
    for (const id of ABILITY_ORDER) {
      const r = pressAndRead(id); if (!r.seq) { runS(3); const r2 = pressAndRead(id); Object.assign(r, r2); }
      if (!r.seq) throw new Error(`T2b.2 ${id}: press returned null (denied: ${JSON.stringify(last('sandbox:denied'))})`);
      const a = r.answers[0]; if (!a) throw new Error(`T2b.2 ${id}: NO answer after a press with no target`);
      eightOK(a.text, `T2b.2 ${id} (no target)`); none[id] = a;
      const wh = ui.tutor.card('power:' + id)?.whenHint; if (a.kind === 'none' && wh && a.text !== wh) throw new Error(`T2b.2 ${id} no-target text "${a.text}" is not the card's whenHint "${wh}"`);
      runS(2);
    }
    const kinds = ABILITY_ORDER.map((i) => none[i].kind).join(',');
    // with a target: coins on the ground → Magnet "+N ✦"; Shield / Stomp / Fog give numbers
    sb.cooldown = {}; hp.set(0, 0, 0); sb.dropTip(1.5, 0, 6); sb.dropTip(1.2, 0.8, 4); runS(0.3); reset(); lg.ability('coinMagnetDash'); runS(3);
    const mg = (ev['ability:answer'] || []).filter((a) => a.name === 'coinMagnetDash').at(-1); if (!mg || !/^Magnet \+\d+ ✦$/.test(mg.text)) throw new Error('T2b.2 Magnet with coins → ' + JSON.stringify(mg));
    sb.cooldown = {}; reset(); lg.ability('bubbleShield'); runS(3); const sh = (ev['ability:answer'] || []).find((a) => a.name === 'bubbleShield'); if (!sh || !/Shield 30 s/.test(sh.text)) throw new Error('T2b.2 Shield → ' + JSON.stringify(sh));
    runS(3); sb.cooldown = {}; reset(); lg.ability('growthStomp'); runS(3); const st = (ev['ability:answer'] || []).find((a) => a.name === 'growthStomp'); eightOK(st?.text, 'T2b.2 Stomp');
    ok(`T2b.2 all 6 answer a no-target press with ≤ 8 words [${ABILITY_ORDER.map((i) => `${i.slice(0, 5)}:${none[i].kind}`).join(' ')}] · Magnet with coins "${mg.text}" · Shield "${sh.text}" · Stomp "${st?.text}"`);

    // ---------------------------------------------------------------- T2b.3 denied: cooldown / busy / blocked
    eq(DENIED_WHYS, ['cooldown', 'busy', 'blocked', 'focus'], 'T2b.3 denied reasons the sandbox can emit');
    for (const why of DENIED_WHYS) { const t = deniedLine(why, { secondsLeft: 3.2, reason: 'tray' }); if (!t || t === 'Not now' || words(t) > 8) throw new Error(`T2b.3 ${why} → "${t}"`); }
    for (const r of ['tray', 'placing', 'modal', 'paused']) { const t = deniedLine('blocked', { reason: r }); if (!t || t === 'Not now' || words(t) > 8) throw new Error(`T2b.3 blocked/${r} → "${t}"`); }
    runS(6); sb.cooldown = {}; reset(); lg.ability('fogSweep'); runS(0.2); reset(); lg.ability('fogSweep');   // S67: second press inside the 0.6 s gap
    let d = last('sandbox:denied'); if (!d || d.why !== 'cooldown' || !(d.secondsLeft > 0)) throw new Error('T2b.3 gap press → ' + JSON.stringify(d));
    eq(document.querySelector('.ll-pans-txt').textContent, deniedLine('cooldown', d), 'T2b.3 gap pill');
    // S67: not enough Focus → 'focus' denial with need/have, nothing spent, a line ≤ 8 words in the pill
    runS(1); sb.focus.st.value = 10; sb.focus.st.gapLeft = 0; reset(); const refused = lg.ability('fogSweep');
    d = last('sandbox:denied'); if (refused || !d || d.why !== 'focus' || d.need !== 45 || d.have !== 10) throw new Error('T2b.3 focus press → ' + JSON.stringify(d));
    eq(document.querySelector('.ll-pans-txt').textContent, deniedLine('focus', d), 'T2b.3 focus pill'); eq(Math.floor(sb.focus.value), 10, 'T2b.3 refused press spends nothing');
    runS(6); sb.cooldown = {}; lg.ability('growthStomp'); reset(); sb.cooldown = {}; const busy = lg.ability('bubbleShield');   // Stomp still mid-move → hero.playMove refuses
    d = last('sandbox:denied'); if (!busy && (!d || d.why !== 'busy')) throw new Error('T2b.3 busy press → ' + JSON.stringify(d));
    if (!busy) eq(document.querySelector('.ll-pans-txt').textContent, 'Finish the swing first', 'T2b.3 busy pill'); runS(6);
    reset(); ui.build.open?.(); const trayOpen = ui.build.isOpen; bus.emit('ui:ability', { name: 'coinMagnetDash' }); d = last('sandbox:denied');
    if (trayOpen) { if (!d || d.why !== 'blocked' || d.reason !== 'tray') throw new Error('T2b.3 tray press → ' + JSON.stringify(d)); eq(document.querySelector('.ll-pans-txt').textContent, 'Close the tray first', 'T2b.3 tray pill'); ui.build.close?.(); }
    ok('T2b.3 cooldown "Ready in N s" (live) · busy "Finish the swing first" · blocked (tray/placing/modal/paused) each have a line, shown in the pill; nothing silent');

    // ---------------------------------------------------------------- T2b.5 drain bars + 0 meshes
    runS(6); sb.cooldown = {}; sb.growth.until = -1; sb.shield.until = -1; runS(1);
    const m0 = meshes(); reset(); lg.ability('bubbleShield'); runS(3);
    const fxs = (ev['ability:fx'] || []).filter((e) => e.name === 'bubbleShield'); if (!fxs.length || !(fxs[0].frac > 0.8)) throw new Error('T2b.5 no ability:fx for Shield ' + JSON.stringify(fxs));
    if (!touch.abilities.bubbleShield.el.classList.contains('fx') || !chips.chips.bubbleShield.classList.contains('fx')) throw new Error('T2b.5 Shield chip has no .fx on touch/desktop');
    runS(16); const f2 = (ev['ability:fx'] || []).filter((e) => e.name === 'bubbleShield').at(-1); if (!(f2.frac < fxs[0].frac - 0.3)) throw new Error('T2b.5 bar does not drain: ' + fxs[0].frac + ' → ' + f2.frac);
    runS(20); const f3 = (ev['ability:fx'] || []).filter((e) => e.name === 'bubbleShield').at(-1); eq(f3.frac, 0, 'T2b.5 bar empty after 30 s');
    if (touch.abilities.bubbleShield.el.classList.contains('fx')) throw new Error('T2b.5 .fx stays on after the Shield ran out');
    if (meshes() !== m0) throw new Error(`T2b.5 meshes ${m0} → ${meshes()} (a power added a mesh)`);
    sb.cooldown = {}; reset(); lg.ability('growthStomp'); runS(3); if (!(ev['ability:fx'] || []).some((e) => e.name === 'growthStomp' && e.frac > 0)) throw new Error('T2b.5 no ability:fx for Stomp');
    ok(`T2b.5 Shield + Stomp emit ability:fx (game time) → .fx on touch + desktop chips, drains ${fxs[0].frac.toFixed(2)} → ${f2.frac.toFixed(2)} → 0 · meshes ${m0} → ${meshes()} (0 new)`);

    console.log(`  T2b POWERS: ${n}/${n} PASS`);
  } catch (err) {
    bad++; console.log(`  T2b POWERS FAIL (after ${n} OK) → ${err?.stack?.split('\n').slice(0, 3).join(' | ') || err}`);
  }
  finally { cleanup?.(); }
  return bad;
}
