// S81: effective tap area of EVERY visible interactive element (elementFromPoint, +-40px around centre). node tools/probe_s81_hit.mjs W H
import { launch, startStory } from './rig76.mjs';
const [W, H] = [+process.argv[2] || 568, +process.argv[3] || 320];
const { p, b, errs } = await launch(W, H); await startStory(p); await p.waitForTimeout(1000);
const r = await p.evaluate(() => {
  const sel = 'button, [role=button], .ll-btn, [class*=btn], [class*=chip], [class*=pill], [class*=pay], [data-tap], a';
  const seen = new Set(), out = [];
  for (const e of document.querySelectorAll(sel)) {
    if (seen.has(e)) continue; seen.add(e);
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05 || cs.pointerEvents === 'none') continue;
    const q = e.getBoundingClientRect(); if (q.width < 4 || q.height < 4 || q.right < 0 || q.bottom < 0 || q.left > innerWidth || q.top > innerHeight) continue;
    const cx = Math.min(innerWidth - 1, Math.max(0, q.left + q.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, q.top + q.height / 2));
    const top = document.elementFromPoint(cx, cy); if (!top || !(top === e || e.contains(top) || top.contains(e))) { out.push({ n: (e.className || e.tagName).toString().slice(0, 40), covered: true, by: (top?.className || top?.tagName || '').toString().slice(0, 30) }); continue; }
    const own = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    let u = 0, d = 0, l = 0, rr = 0; for (let k = 1; k < 40; k++) { if (own(cx, q.top - k)) u = k; else break; } for (let k = 1; k < 40; k++) { if (own(cx, q.bottom + k)) d = k; else break; }
    for (let k = 1; k < 40; k++) { if (own(q.left - k, cy)) l = k; else break; } for (let k = 1; k < 40; k++) { if (own(q.right + k, cy)) rr = k; else break; }
    out.push({ n: (e.className || e.tagName).toString().slice(0, 40), id: e.id, w: Math.round(q.width + l + rr), h: Math.round(q.height + u + d), vis: Math.round(q.width) + 'x' + Math.round(q.height), at: Math.round(q.left) + ',' + Math.round(q.top) });
  }
  return out;
});
for (const x of r) { const bad = !x.covered && (x.h < 40 || x.w < 40); console.log((bad ? 'SMALL ' : x.covered ? 'COVER ' : 'ok    ') + JSON.stringify(x)); }
console.log('errs', errs.slice(0, 3)); await b.close();
