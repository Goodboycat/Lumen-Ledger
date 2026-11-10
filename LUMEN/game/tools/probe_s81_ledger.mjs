// S81: ledger geometry WITH the crew line (Cloud hired + left on counters row). node tools/probe_s81_ledger.mjs W H
import { launch, startStory, shot } from './rig76.mjs';
const [W, H] = [+process.argv[2] || 568, +process.argv[3] || 320];
const { p, b, errs } = await launch(W, H); await startStory(p);
await p.evaluate(() => { lg.debug.hire?.('cloud'); });
await p.evaluate(() => { const r = lg.sb.eco.endSeason?.(); if (!ui.ledger.isOpen) ui.ledger.show(r || {}); });
await p.waitForTimeout(6000);
const r = await p.evaluate(() => {
  const btn = document.querySelector('.ll-ledger-continue'); const q = btn.getBoundingClientRect();
  const sheet = document.querySelector('.ll-ledger-sheet'); const s = sheet.getBoundingClientRect();
  const rows = [...document.querySelectorAll('.ll-ledger-sheet > *, .ll-ledger-col > *')].map(e => [e.className.toString().slice(0, 26), Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().bottom)]);
  return { btn: [Math.round(q.top), Math.round(q.bottom), Math.round(q.height)], sheet: [Math.round(s.top), Math.round(s.bottom)], vh: innerHeight, rows, foot: document.querySelector('.ll-ledger-foot')?.className };
});
console.log(JSON.stringify(r)); console.log('FULLY VISIBLE', r.btn[1] <= r.vh - 4 && r.sheet[1] <= r.vh); await shot(p, `s81_ledger_${W}x${H}`); console.log(errs.slice(0, 2)); await b.close();
