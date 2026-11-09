import { launch, startStory, shot } from './rig76.mjs';
const S = +process.argv[2] || 8;
const { p, b, errs } = await launch(844, 390);
await startStory(p);
const r = await p.evaluate((S) => {
  const d = lg.debug; d.season(S); const sb = lg.sb;
  sb.enemies.waveSeason = 0; const out = sb.enemies.spawnWave(S);
  return { n: out.length, kinds: out.map(e => e.kind + ':' + e.state), pos: out.map(e => [e.kind, +e.g.position.x.toFixed(1), +e.g.position.z.toFixed(1)]) };
}, S);
console.log('spawned', JSON.stringify(r));
for (let i = 0; i < 6; i++) {
  await p.waitForTimeout(1500);
  const s = await p.evaluate(() => lg.sb.enemies.list.map(e => [e.kind, e.state, +e.g.position.x.toFixed(1), +e.g.position.z.toFixed(1), e.g.visible]));
  console.log(i, JSON.stringify(s));
}
await shot(p, 's76_boss_s' + S);
console.log('errs', errs);
await b.close();
