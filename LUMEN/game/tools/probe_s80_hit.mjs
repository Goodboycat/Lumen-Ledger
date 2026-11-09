// S80: effective tap area (elementFromPoint) of PAY and the season pill.  node tools/probe_s80_hit.mjs W H
import { launch, startStory } from './rig76.mjs';
const [W, H] = [+process.argv[2] || 568, +process.argv[3] || 320];
const { p, b } = await launch(W, H); await startStory(p); await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const out = {};
  for (const [name, sel] of [['pay', '.ll-spark-pay'], ['season', '.ll-season.is-tappable']]) {
    const e = document.querySelector(sel); if (!e) { out[name] = null; continue; }
    const q = e.getBoundingClientRect(); const cx = q.left + q.width / 2; let up = 0, dn = 0;
    const own = (y) => { const h = document.elementFromPoint(cx, y); return h && (h === e || e.contains(h)); };
    for (let d = 0; d < 40; d++) { if (own(q.top - d)) up = d; else if (d > 0) break; }
    for (let d = 0; d < 40; d++) { if (own(q.bottom + d)) dn = d; else if (d > 0) break; }
    out[name] = { vis: Math.round(q.height), hitH: Math.round(q.height + up + dn), up, dn };
  }
  return out;
});
console.log(JSON.stringify(r)); await b.close();
