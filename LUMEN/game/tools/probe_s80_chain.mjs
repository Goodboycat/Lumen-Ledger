// S80-C: slash1 -> slash2 -> spin chain in virtual time (headless is ~2 fps). node tools/probe_s80_chain.mjs
import { launch, startStory } from './rig76.mjs';
const { p, b, errs } = await launch(844, 390); await startStory(p);
const r = await p.evaluate(() => {
  const sb = lg.sb; const game = lg.game || sb.game || window.game; try { sb.enemies.enabled = false; } catch {}
  const C = sb.combat || lg.combat || sb.hero?.combat; if (!game) return { err: 'no game', lg: Object.keys(lg) }; if (!C) return { err: 'no combat', keys: Object.keys(sb).slice(0, 40) };
  const log = []; const dt = 1 / 60; let t = 0; const seen = [];
  const press = (ms) => log.push({ at: ms, ev: 'press' });
  const presses = [0, 330, 640];   // spaced like a thumb tapping ATTACK ~3x/s
  let pi = 0, prevStep = -2;
  for (let i = 0; i < 60 * 3; i++) {
    const ms = t * 1000;
    if (pi < presses.length && ms >= presses[pi]) { C.attack(); log.push({ at: Math.round(ms), ev: 'press' }); pi++; }
    game.sequences.update(dt); C.update(dt); t += dt;
    if (C.step !== prevStep) { seen.push({ at: Math.round(ms), step: C.step, combo: C.combo }); prevStep = C.step; }
  }
  return { seen, log };
});
console.log(JSON.stringify(r)); console.log('errs', errs.slice(0, 3)); await b.close();
