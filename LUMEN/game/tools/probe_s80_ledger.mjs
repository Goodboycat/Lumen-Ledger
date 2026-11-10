// S80: ledger geometry (is CONTINUE fully visible / tappable?).  node tools/probe_s80_ledger.mjs W H
import { launch, startStory, shot } from './rig76.mjs';
const [W, H] = [+process.argv[2] || 568, +process.argv[3] || 320];
const { p, b, errs } = await launch(W, H); await startStory(p);
await p.evaluate(() => { const r = lg.sb.eco.endSeason?.(); if (!ui.ledger.isOpen) ui.ledger.show(r || {}); });
await p.waitForTimeout(6000);
const r = await p.evaluate(() => {
  const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { y: Math.round(r.top), b: Math.round(r.bottom), x: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), ov: cs.overflowY, sh: e.scrollHeight, ch: e.clientHeight }; };
  const btns = [...document.querySelectorAll('.ll-ledger button')].map(e => { const r = e.getBoundingClientRect(); return [e.className, e.textContent.trim().slice(0, 14), Math.round(r.top), Math.round(r.bottom), Math.round(r.height)]; });
  return { wrap: q('.ll-ledger'), card: q('.ll-ledger-card'), body: q('.ll-ledger-body'), btns, vh: innerHeight, classes: [...document.querySelectorAll('.ll-ledger *')].filter(e => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2; }).map(e => e.className + ':' + e.scrollHeight + '/' + e.clientHeight) };
});
console.log(JSON.stringify(r, null, 1)); await shot(p, `s80_ledger_${W}x${H}`); console.log(errs.slice(0, 2)); await b.close();
