// S72: headless PASSIVE-player playtest (replaces the S71 stub). node tools/probe_s71_wants.mjs [N=6] [seasonSeconds=150]
// Player does nothing but let the 3 starter stalls run (no build, no walking, no jars). Plays S1..S3 with real createLumenGame + pierPays,
// pays the Baron if the pouch can (walk+E), skips ledgers. Prints per-season units sold, stars, debt, wants/noStall, and the want chips shown.
import { readFileSync } from 'node:fs'; import { resolve, dirname } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const G = resolve(dirname(fileURLToPath(import.meta.url)), '..'); const imp = (p) => import(pathToFileURL(resolve(G, p)).href);
const N = +process.argv[2] || 6, SEASON = +process.argv[3] || 150;
const { installDomShim } = await imp('tools/domshim.mjs'); installDomShim();
const THREE = await imp('vendor/three.module.js'); const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
const { EventBus } = await imp('src/core/EventBus.js'); const { tweens } = await imp('src/anim/Tween.js');
const { createLumenGame } = await imp('src/Game.js'); const { mountUI } = await imp('ui/index.js'); const { PROP_CATALOG } = await imp('src/assets/props.js');
const storyData = JSON.parse(readFileSync(resolve(G, 'data/story.json'), 'utf8'));
const rows = [];
for (let i = 0; i < N; i++) {
  const mem = new Map(); const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const bus = new EventBus();
  const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false, press() {} }, camera: { zoom: 1, shake() {}, snapTo() {} }, time: 0, timeScale: 1, paused: false, followTarget: null, systems: [], stats: { fps: 60, drawCalls: 0 }, add(s) { this.systems.push(s); return s; }, hitstop() {} };
  document.body.innerHTML = '';
  const ui = mountUI(document.body, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, seasonsToWin: 10, touch: true, version: 'probe' });
  const lg = createLumenGame(game, { ui, storyData, headless: true, seasonSeconds: SEASON, seed: 100 + i, storage, cinematics: false, pierPays: true });
  const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); ui.update?.(dt); for (const s of game.systems) s.update?.(game.paused ? 0 : dt, game, dt); };
  const drain = () => { let n = 0; while (ui.dialogue.isOpen && n < 40) { if (ui.dialogue.line?.choices) ui.dialogue.choose(1); else { ui.dialogue.skip(); ui.dialogue.advance(); } step(); n++; } };
  const wants = []; const chips = []; const seas = {};
  bus.on('hud:chip', (p) => { if (p?.want && p.on !== false) chips.push({ s: lg.sb.eco.state.season, text: p.text }); });
  bus.on('cust:want', (p) => { if (!p.found) wants.push({ s: lg.sb.eco.state.season, want: p.want, type: p.type }); });
  ui.title.buttons.story.click(); step(); drain();
  const eco = lg.sb.eco; let guard = 0, last = { sold: 0 }; const season0 = () => eco.state.season; const log = [];
  const sold = () => lg.sb.cust.totals.paid || 0;
  while (eco.state.season < 4 && guard++ < SEASON * 30 * 4 + 600) {
    const s = season0(); step(); if (ui.dialogue.isOpen) drain();
    if (lg.state === 'pier') { const B = lg.sb.pier; if (B.phase === 'wait') { const h = lg.sb.hero.root.position; h.set(B.g.position.x + 1, 0, B.g.position.z); lg.sb.interact(); lg.sb.interactRelease(); } }
    if (ui.ledger.isOpen) { ui.ledger.skip(); ui.ledger.continue(); step(); drain(); }
    if (season0() !== s) { const r = eco.history.at(-1); log.push({ season: r.season, income: r.income, stars: r.stars, debt: r.debt, sold: sold() - last.sold, spark: Math.round(eco.state.spark), swept: r.tillSwept, noStall: lg.sb.cust.totals.noStall || 0, pier: r.pier ? { paid: r.pier.paid, short: r.pier.shortfall } : null }); last.sold = sold(); }
  }
  for (const l of log) { const r = eco.history.find((h) => h.season === l.season); l.stars = r?.stars ?? l.stars; l.pier = r?.pier ? { paid: r.pier.paid, short: r.pier.shortfall } : null; }   // settled values (the report object is updated by closePier after the pier visit)
  rows.push({ seed: 100 + i, log, wants: wants.length, wantKinds: [...new Set(wants.map((w) => w.want))], chips: chips.map((c) => `S${c.s}: ${c.text}`) });
  lg.destroy(); ui.destroy();
}
for (const r of rows) { console.log(`seed ${r.seed}: wants-unmet ${r.wants} (${r.wantKinds.join(',') || '-'})`); for (const l of r.log) console.log(`   S${l.season} sold ${l.sold} income ${l.income} stars ${l.stars} debt ${l.debt} pouch ${l.spark} swept ${l.swept ?? 0} noStall ${l.noStall} pier ${JSON.stringify(l.pier)}`); if (r.chips.length) console.log('   chips:', r.chips.join(' | ')); }
const s3 = rows.map((r) => r.log.find((l) => l.season === 3)?.sold).filter((x) => x != null); console.log(`\nS3 units sold (passive, 3 stalls): min ${Math.min(...s3)} max ${Math.max(...s3)} mean ${(s3.reduce((a, b) => a + b, 0) / s3.length).toFixed(1)} (handoff question: 11-22)`);
