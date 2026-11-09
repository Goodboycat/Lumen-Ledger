// S79: Cloud coin-fetch rules in the real browser (range 10 u, 0.8 u ignore zone, Baron wave).
import { launch, startStory } from './rig76.mjs';
const { p, b, errs } = await launch(568, 320); await startStory(p);
const ev = (f, a) => p.evaluate(f, a);
await ev(() => { lg.debug.hire('cloud'); lg.sb.enemies.enabled = false; const h = lg.sb.helpers.find(x => x.type === 'cloud'); h.job.state = 'follow'; h.job.path = []; lg.sb.hero.root.position.set(0, 0, 1); h.g.position.set(-1, 0, 1); window.__c = h; });
await p.waitForTimeout(1500);
const st = () => ev(() => { const h = __c, hp = lg.sb.hero.root.position; return { state: h.job.state, coins: lg.sb.coins.length, d: +Math.hypot(h.g.position.x - hp.x, h.g.position.z - hp.z).toFixed(1), spark: Math.round(lg.sb.eco.state.spark) }; });
const wait = async (ms, pred, step = 400) => { for (let t = 0; t < ms; t += step) { await p.waitForTimeout(step); const s = await st(); if (pred(s)) return s; } return await st(); };
// T1: coin 12 u away -> ignored
await ev(() => { lg.sb.coins.length = 0; __c.job.state = 'follow'; __c.job.coin = null; const hp = lg.sb.hero.root.position; lg.sb.dropTip(hp.x + 12, hp.z, 5); });
let s = await wait(5000, s => s.state !== 'follow' || s.coins !== 1); console.log('T1 coin@12u (cloud-to-coin ~13u) -> state', s.state, 'coins', s.coins, '(want follow, coin stays)');
// T2: coin 8 u away -> fetched and paid
await ev(() => { lg.sb.coins.length = 0; const hp = lg.sb.hero.root.position; lg.sb.dropTip(hp.x - 8, hp.z + 0, 5); window.__sp0 = lg.sb.eco.state.spark; });
s = await wait(3000, s => s.state === 'fetch' || s.state === 'carry'); console.log('T2 coin@8u   -> state', s.state);
s = await wait(25000, s => s.coins === 0 && s.state !== 'fetch' && s.state !== 'carry'); const gained = await ev(() => lg.sb.eco.state.spark - __sp0); console.log('T2 delivered -> state', s.state, 'coins', s.coins, 'spark +', gained);
// T3: coin 0.5 u from Pip -> Cloud ignores it
await p.waitForTimeout(1500); await ev(() => { lg.sb.coins.length = 0; __c.job.state = 'follow'; __c.job.coin = null; const hp = lg.sb.hero.root.position; lg.sb.dropTip(hp.x + 0.5, hp.z, 5); __c.job.scanT = 0; });
await p.waitForTimeout(900); s = await st(); console.log('T3 coin@0.5u -> state', s.state, '(want follow: Pip collects it)');
// T4: Baron wave: coin dropped right next to the Baron
await ev(() => { lg.sb.coins.length = 0; __c.job.state = 'follow'; __c.job.coin = null; const sb = lg.sb, e = sb.eco; e.state.season = 6; e.state.spark = 200; sb.sched.wave = false; sb.sched.season = 6; sb.enemies.enabled = true; sb.enemies.waveSeason = 0; sb.enemies.spawnWave(6); });
await p.waitForTimeout(1500);
const bar = await ev(() => { const B = lg.sb.enemies.baron; if (!B) return null; return { x: B.g.position.x, z: B.g.position.z, enemies: lg.sb.enemies.active.length }; });
console.log('T4 baron', JSON.stringify(bar));
if (bar) {
  // Pip + Cloud walk to 5 u from the Baron, then a coin drops 1 u from him (inside fetch range, inside the 3 u enemy zone)
  await ev((bar) => { lg.sb.coins.length = 0; lg.sb.hero.root.position.set(bar.x - 5, 0, bar.z); __c.g.position.set(bar.x - 6, 0, bar.z); __c.job.state = 'follow'; __c.job.coin = null; const B = lg.sb.enemies.baron; B.g.position.set(bar.x, 0, bar.z); lg.sb.dropTip(B.g.position.x + 1, B.g.position.z, 5); window.__bc = lg.sb.coins[0]; }, bar);
  const log = [];
  for (let i = 0; i < 10; i++) { await p.waitForTimeout(500); log.push(await ev(() => { const h = __c, B = lg.sb.enemies.baron; const d = B ? Math.hypot(h.g.position.x - B.g.position.x, h.g.position.z - B.g.position.z).toFixed(1) : '-'; return [h.job.state, 'coinLeft' + (lg.sb.coins.indexOf(__bc) >= 0 ? 1 : 0), 'dBaron' + d, 'baronState:' + (B ? B.state : '-')].join('/'); })); }
  console.log('T4 (coin next to the Baron):', log.join('  '));
}
console.log('errs', JSON.stringify(errs.slice(0, 4))); await b.close();
