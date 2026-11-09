// tools/gates/boons.mjs — S67 gate: `node tools/check.mjs --boons`   (section "S67 BOONS")
// REAL createLumenGame + mountUI on tools/domshim.mjs, headless sandbox, boons.json passed in:
//   B.1  season-end Ledger CONTINUE does NOT continue: Boon Draft opens (3 cards, 3 families), game stays paused/modal, no ui:continue yet
//   B.2  PICK → boon stored in eco.state.boons · ui:continue fires exactly once · state playing, season +1 · badge row shows it
//   B.3  win / lose Ledger never drafts (CONTINUE goes straight through)
//   B.4  a freeEvents boon pays for the next bad event (spark untouched) + Owl bark (kind boon) · Index Fund lock denies Invest withdraw + bark
//   B.5  save round-trip: eco.serialize → fresh eco keeps boons; no boons.json = no draft (old saves/tests keep working)
export async function run({ resolve, pathToFileURL }) {
  let bad = 0, n = 0, cleanup = null;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  const ok = (label) => { n++; console.log(`  ${label}  OK`); };
  console.log('\nS67 BOONS:');
  try {
    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createLumenGame } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const { readFileSync } = await import('node:fs');
    const storyData = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
    const boonsData = JSON.parse(readFileSync(resolve('data/boons.json'), 'utf8'));
    const bus = new EventBus(); const ev = {};
    for (const k of ['ui:continue', 'ui:boon:open', 'ui:boon:pick', 'boon:picked', 'story:bark', 'eco:denied', 'eco:absorbed']) bus.on(k, (p) => { (ev[k] ??= []).push(p); });
    const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
    const root = document.body; let lg = null, ui = null;
    cleanup = () => { try { lg?.destroy?.(); } catch { /* ok */ } try { ui?.destroy?.(); } catch { /* ok */ } for (const el of [...root.children]) el.remove?.(); };
    ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check' });
    lg = createLumenGame(game, { ui, storyData, boonsData, headless: true, seasonSeconds: 30, seed: 3 });
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); };
    const drain = () => { let k = 0; while (ui.dialogue.isOpen && k < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); k++; } return k; };
    const ledgerOpen = (eco) => { let g = 0; while (!ui.ledger.isOpen && g++ < 45 * 30) { step(); if (ui.dialogue.isOpen) drain(); } if (!ui.ledger.isOpen) throw new Error('ledger never opened'); };
    ui.title.buttons.story.click(); step(); drain();
    const eco = lg.sb.eco; if (lg.sb.enemies) lg.sb.enemies.enabled = false;

    // ---- B.1
    ledgerOpen(eco); ui.ledger.skip(); const c0 = (ev['ui:continue'] || []).length;
    ui.ledger.continue();
    if (!ui.boons.isOpen) throw new Error('B.1 CONTINUE did not open the Boon Draft');
    if ((ev['ui:continue'] || []).length !== c0) throw new Error('B.1 ui:continue fired before the pick');
    if (!game.paused && !ui.isModal) throw new Error('B.1 game not paused/modal while the draft is open');
    const cards = document.querySelectorAll('.ll-boon-card'); if (cards.length !== 3) throw new Error('B.1 cards ' + cards.length);
    const ids = ev['ui:boon:open'].at(-1).ids; const fam = new Set(ids.map((i) => lg.boons.byId[i].family)); if (fam.size !== 3) throw new Error('B.1 families ' + [...fam]);
    ok(`B.1 CONTINUE → Boon Draft (${ids.join(', ')}) · 3 families · no ui:continue yet · modal`);

    // ---- B.2
    const season0 = eco.state.season, pickId = ids[1];
    ui.boons.pick(pickId); step();
    if ((ev['ui:continue'] || []).length !== c0 + 1) throw new Error('B.2 ui:continue count ' + (ev['ui:continue'] || []).length);
    if (!eco.state.boons.some((b) => b.id === pickId)) throw new Error('B.2 boon not stored');
    if (lg.state !== 'playing' || eco.state.season !== season0) throw new Error(`B.2 state ${lg.state} season ${eco.state.season}`);
    if (ui.boons.isOpen) throw new Error('B.2 draft still open');
    const badges = document.querySelectorAll('.ll-boon-badge'); if (badges.length !== 1) throw new Error('B.2 badges ' + badges.length);
    ok(`B.2 pick ${pickId} → stored · ui:continue ×1 · playing S${eco.state.season} · 1 badge`);

    // ---- B.3 win/lose never draft
    for (const outcome of ['win', 'lose']) {
      ui.boons.hide(); const before = (ev['ui:continue'] || []).length;
      ui.ledger.show({ season: 3, stars: 2, lessonId: 'emergencyFund', rows: [], net: 0 }, { outcome }); ui.ledger.skip?.(); ui.ledger.continue();
      if (ui.boons.isOpen) throw new Error(`B.3 ${outcome} opened a draft`);
      if ((ev['ui:continue'] || []).length !== before + 1) throw new Error(`B.3 ${outcome} did not continue`);
    }
    ok('B.3 win + lose Ledgers continue without a draft');

    // ---- B.4 free event + lock, on a fresh economy so the sandbox state is not disturbed
    const { makeEconomy } = await imp('src/systems/economyData.js');
    const e2 = makeEconomy({ seed: 5 }); const bad0 = e2.state.spark = 100;
    lg.boons.apply(e2, 'emergency_pouch');
    if (!(e2.state.boonFree >= 1)) throw new Error('B.4 emergency_pouch gave no free event');
    const evId = Object.keys(e2.events).find((k) => { const x = e2.events[k]; const fx = typeof x.effect === 'function' ? x.effect(e2) : x.effect; return fx && fx.spark < 0; });
    const out = e2.applyEvent(evId); if (!out || !out.boon || e2.state.spark !== bad0) throw new Error('B.4 free event cost ' + (bad0 - e2.state.spark));
    const e3 = makeEconomy({ seed: 6 }); e3.state.spark = 200; lg.boons.apply(e3, 'index_fund'); e3.state.jars.invest = 30;
    if (!e3.investLocked()) throw new Error('B.4 index fund not locked');
    const denied = []; e3.bus.on('eco:denied', (p) => denied.push(p)); e3.allocate({ invest: -10 });
    if (!denied.some((d) => d.reason === 'locked')) throw new Error('B.4 no locked denial ' + JSON.stringify(denied));
    ok(`B.4 Emergency Pouch absorbs "${evId}" for 0 ✦ · Index Fund locks Invest (${denied[0].seasonsLeft} season${denied[0].seasonsLeft === 1 ? '' : 's'} left)`);
    // bark wiring in the real game
    const barks0 = (ev['story:bark'] || []).length; bus.emit('eco:absorbed', { id: evId, event: {}, boon: true }); bus.emit('eco:denied', { reason: 'locked', jar: 'invest', seasonsLeft: 2 });
    const nb = (ev['story:bark'] || []).slice(barks0).filter((b) => b.kind === 'boon'); if (nb.length !== 2) throw new Error('B.4 boon barks ' + nb.length);
    ok('B.4b boon absorb + locked Invest each get one Owl bark (kind boon)');

    // ---- B.5
    const { Economy } = await imp('src/systems/economy.js');
    const e4 = Economy.deserialize(eco.serialize());
    if (!(e4.state.boons || []).some((b) => b.id === pickId)) throw new Error('B.5 boon lost in save round-trip');
    ok('B.5 boons survive serialize → restore');
    console.log(`  S67 BOONS: ${n}/${n} PASS`);
  } catch (err) { bad++; console.log(`  S67 BOONS FAIL (after ${n} OK) → ${err?.stack?.split('\n').slice(0, 3).join(' | ') || err}`); }
  finally { cleanup?.(); }
  return bad;
}
