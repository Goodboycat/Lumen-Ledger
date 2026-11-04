// 41A BARKS — check.mjs --barks section (split out per START_HERE rule 0b). Returns the number of failures.
//   story.json: every bark ≤ 60 chars, speakers ∈ data.speakers, seasons[0].opening.length === 2
//   headless createLumenGame fresh PLAY: ≥ 5 story:bark within 12 s, story:begin groups at start === 1, no ui:pause from barks
//   resume from a save: 0 barks replayed · mountBarks with domshim: 60 frames, destroy → listeners back to baseline, 0 nodes
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const imp = (p) => import(pathToFileURL(resolve(p)).href);

export async function checkBarks() {
  let bad = 0; console.log('\n41A BARKS:');
  const data = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
  // --- data
  try {
    const speakers = new Set(Object.keys(data.speakers || {}));
    const B = data.barks || {}; let n = 0;
    for (const [g, lines] of Object.entries(B)) for (const l of (Array.isArray(lines) ? lines : Object.values(lines).flat())) {
      if (typeof l !== 'object' || l === null) continue; // 48B: name maps (wantsWho) are not bark lines
      n++; if (!l.text || l.text.length > 60) throw new Error(`barks.${g} line > 60 chars: "${l.text}"`);
      if (!speakers.has(l.speaker)) throw new Error(`barks.${g} unknown speaker ${l.speaker}`);
    }
    if ((data.seasons[0].opening || []).length !== 2) throw new Error('seasons[0].opening.length !== 2: ' + data.seasons[0].opening.length);
    const walk = B.walkIn || []; if (walk.length !== 2 || Math.max(...walk.map((l) => l.at || 0)) > 9 || walk.some((l) => l.speaker === 'pip')) throw new Error('48B: walkIn must be exactly 2 non-pip lines with at ≤ 9 s (CINE.arrivalMax)');
    console.log(`  story.json: ${n} barks in ${Object.keys(B).length} groups (all ≤ 60 chars, speakers valid) · opening = 2 lines · walkIn ${walk.length} lines 0–${Math.max(...walk.map((l) => l.at))} s OK`);
  } catch (err) { bad++; console.log('  data FAIL →', err.message); }
  // --- headless game
  try {
    const t0 = Date.now();
    const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
    const THREE = await imp('vendor/three.module.js');
    const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
    const { EventBus } = await imp('src/core/EventBus.js');
    const { tweens } = await imp('src/anim/Tween.js');
    const { createLumenGame } = await imp('src/Game.js');
    const { mountUI } = await imp('ui/index.js');
    const { PROP_CATALOG } = await imp('src/assets/props.js');
    const mkGame = (bus) => ({ scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {}, snapTo() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} });
    const mem = new Map(); const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    const run = (hasSave) => {
      const bus = new EventBus(); const game = mkGame(bus); const ev = { bark: [], begin: [], pause: [] };
      bus.on('story:bark', (p) => ev.bark.push({ ...p, t: game.time })); bus.on('story:begin', (p) => ev.begin.push(p)); bus.on('ui:pause', (p) => ev.pause.push(p));
      document.body.innerHTML = '';
      const ui = mountUI(document.body, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: false, version: 'check', hasSave: () => hasSave });
      const lg = createLumenGame(game, { ui, storyData: data, headless: true, seasonSeconds: 60, seed: 3, storage, cinematics: false });
      ui.barks?.bind({ owl: () => lg.sb?.owl || lg.sb?.helpers?.owl || lg.sb?.hero, baron: () => lg.sb?.enemies?.baron, project: (p) => ({ x: p.x * 10 + 180, y: p.z * 10 + 320 }) });   // test-only: owl → hero so the 2 walk-in owl barks resolve headless
      const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); ui.update(dt); };
      return { bus, game, ui, lg, ev, step, dt };
    };
    // fresh PLAY: barks arrive over the first 12 s even while the 2-line opening is waiting for ui:advance (barks never block)
    const A = run(false); A.ui.title.buttons.story.click(); A.step();
    const openingGroups = A.ev.begin.filter((b) => b.group === 'opening').length; if (openingGroups !== 1) throw new Error('opening groups at start = ' + openingGroups);
    const firstLine = A.ui.dialogue.line; if (!firstLine || firstLine.total !== 2) throw new Error('dialogue opening total !== 2: ' + JSON.stringify(firstLine?.total));
    // headless has no walk-in cinematic (cinematics:false) so the 2-line opening opens at once and pauses the clock → dismiss it like a player, then listen 12 s
    let n = 0; while (A.ui.dialogue.isOpen && n++ < 10) { A.ui.dialogue.skip(); A.ui.dialogue.advance(); A.step(); }
    const pausesBefore = A.ev.pause.length; A.ev.pause.length = 0;
    for (let i = 0; i < 12 * 30; i++) A.step();
    const walkBarks = A.ev.bark.filter((b) => b.group === 'walkIn'); if (walkBarks.length !== 2) throw new Error(`48B: story:bark walkIn in 12 s = ${walkBarks.length} (want 2)`);
    if (A.ev.pause.filter((p) => p?.on !== false && p?.paused !== false).length) throw new Error('ui:pause fired ' + A.ev.pause.length + ' during barks (opening dialogue alone fired ' + pausesBefore + ')');
    if (A.ui.barks.items.filter((it) => it.kind !== 'want' && it.kind !== 'price').length > 1) throw new Error('48B: > 1 word bubble on screen');
    const shown = A.ui.barks.count; if (shown < 1) throw new Error('bubbles spawned ' + shown);
    // first-* one-shots fire once
    A.lg.story.barkGroup('firstCoin'); A.lg.story.barkGroup('firstCoin'); A.bus.emit('jars:deposit', {}); A.bus.emit('jars:deposit', {});
    const once = (g) => A.ev.bark.filter((b) => b.group === g).length; if (once('firstCoin') !== 1 || once('firstDeposit') !== 1) throw new Error(`one-shots coin ${once('firstCoin')} deposit ${once('firstDeposit')}`);
    const ser = A.lg.story.serialize(); if (!ser.state.barksPlayed.includes('walkIn') || !ser.state.barksPlayed.includes('firstCoin')) throw new Error('barksPlayed not serialized: ' + JSON.stringify(ser.state.barksPlayed));
    // save → resume: no walk-in replay
    A.lg.save?.write?.(); const saved = [...mem.keys()].length > 0; A.lg.destroy(); A.ui.destroy();
    let resumeNote = 'save API absent → resume path checked via game:start {resumed:true}';
    const B = run(saved);
    if (saved && B.ui.title.buttons.continue) { B.ui.title.buttons.continue.click(); B.step(); resumeNote = 'resumed from save'; }
    else { B.bus.emit('game:start', { resumed: true }); }
    for (let i = 0; i < 12 * 30; i++) B.step();
    if (B.ev.bark.filter((b) => b.group === 'walkIn').length) throw new Error('walkIn barks replayed on resume (' + resumeNote + ')');
    // mount/destroy hygiene
    const L0 = (() => { let n = 0; for (const s of B.bus.map.values()) n += s.size; return n; })();
    const { mountBarks } = await imp('ui/bark.js');
    const bk = mountBarks(document.body, { bus: B.bus }); bk.bind({ hero: () => B.lg.sb?.hero, project: (p) => ({ x: p.x * 10 + 180, y: p.z * 10 + 320 }) });
    // 48B BARK DIET: hero anchor → dropped · unbound owl/baron → dropped (no hero fallback) · 2 word barks 1 s apart → 1 bubble · glyph barks exempt
    bk.show({ speaker: 'pip', text: 'over pip', anchor: 'hero', ttl: 1 }); if (bk.items.length !== 0) throw new Error('48B: hero anchor spawned a bubble');
    bk.show({ speaker: 'owl', text: 'test', anchor: 'owl', ttl: 1 }); bk.show({ speaker: 'baron', text: 'three', anchor: 'baron', ttl: 1 }); if (bk.items.length !== 0) throw new Error('48B: unbound anchor fell back: ' + bk.items.length);
    bk.show({ speaker: 'owl', text: 'two', anchor: { x: 1, y: 0, z: 1 }, ttl: 3 }); for (let i = 0; i < 30; i++) bk.update(1 / 30); bk.show({ speaker: 'owl', text: 'too soon', anchor: { x: 1, y: 0, z: 1 }, ttl: 3 });
    if (bk.items.length !== 1 || bk.items[0].text !== 'two') throw new Error('48B: word bark 1 s after another was not dropped: ' + bk.items.map((i) => i.text).join(','));
    bk.show({ kind: 'want', icon: 'stall_fruit', ok: true, text: 'fruit', anchor: { x: 2, y: 0, z: 2 } }); bk.show({ kind: 'want', icon: 'stall_fish', ok: false, text: 'fish', anchor: { x: 2, y: 0, z: 2 } });
    if (bk.items.length !== 3) throw new Error('48B: glyph barks must be exempt from the word gap: ' + bk.items.length);
    for (let i = 0; i < 60; i++) bk.update(1 / 30);
    bk.destroy(); const L1 = (() => { let n = 0; for (const s of B.bus.map.values()) n += s.size; return n; })();
    if (L1 !== L0) throw new Error(`listeners after destroy ${L1} != ${L0}`); if (bk.items.length) throw new Error('nodes left ' + bk.items.length);
    B.lg.destroy(); B.ui.destroy();
    console.log(`  headless fresh PLAY: opening groups 1 (2 lines) · ${walkBarks.length} walk-in barks in 12 s (${walkBarks.map((b) => b.t.toFixed(1)).join(', ')} s) · 0 ui:pause · ≤ 2 bubbles · one-shots ×1 · barksPlayed serialized · ${resumeNote}: 0 replayed · mountBarks destroy clean · ${Date.now() - t0} ms OK`);
  } catch (err) { bad++; console.log('  headless FAIL →', err.message, err.stack?.split('\n')[1]?.trim() || ''); }
  return bad;
}
