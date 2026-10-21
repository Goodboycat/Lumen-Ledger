// LUMEN 8B — headless story test. Run from game/:  node tests/story.test.mjs
// Walks 10 seasons with a REAL 4B economy + 8A story.json on a private EventBus. PASS/FAIL per assert, exit 1 on failure. No browser, no Three.
import { readFileSync } from 'node:fs';
import { StorySystem, pickLedgerVariant, linesFor } from '../src/systems/story.js';
import { makeEconomy } from '../src/systems/economyData.js';
import { BALANCE } from '../src/systems/economy.js';
import { EventBus } from '../src/core/EventBus.js';

const data = JSON.parse(readFileSync(new URL('../data/story.json', import.meta.url), 'utf8'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
const mk = (opts = {}) => {
  const bus = new EventBus(); const eco = makeEconomy({ bus, seed: 3, autoSeason: false });
  const ev = {}; const rec = (n) => bus.on(n, (p) => (ev[n] ||= []).push(p));
  ['story:line', 'story:end', 'story:groupEnd', 'story:begin', 'story:lesson', 'story:review', 'story:toast', 'story:choice', 'story:finale'].forEach(rec);
  const story = new StorySystem(eco, { data, bus, ...opts });
  return { bus, eco, ev, story };
};
const last = (a) => a[a.length - 1];
/** Drain the current dialogue by emitting ui:advance like 7B does (choices → ui:choice idx). */
const drain = (bus, story, pick = 1, max = 200) => { let n = 0; while (story.isPlaying && n++ < max) { if (story.line?.choices) bus.emit('ui:choice', { index: pick }); else bus.emit('ui:advance', {}); } return n; };

// ---- pure helpers
ok(pickLedgerVariant(0) === 'low' && pickLedgerVariant(1) === 'low' && pickLedgerVariant(2) === 'default' && pickLedgerVariant(3) === 'high', 'pickLedgerVariant 0/1 low · 2 default · 3 high');
ok(linesFor(data, 'opening', 1).length >= 6 && linesFor(data, 'ledger', 4, 'high')[1].speaker === 'baron' && linesFor(data, 'event', 'storm').length === 1 && linesFor(data, 'scam', 'quickFlip').length === 2 && linesFor(data, 'nope', 1).length === 0, 'linesFor opening/ledger/event/scam, unknown → []');
ok(linesFor(null, 'opening', 1).length === 0 && linesFor(data, 'ledger', 99, 'low').length === 0, 'linesFor never throws on missing data');

// ---- season 1 opening via update() (autoplay), one line at a time, story:end once
{
  const { bus, eco, ev, story } = mk();
  ok(!story.isPlaying && !ev['story:line'], 'nothing plays before update()');
  story.update(0.016);
  ok(story.isPlaying && ev['story:line'].length === 1 && ev['story:line'][0].speaker === 'narrator' && /Season 1/.test(ev['story:line'][0].text) && ev['story:begin'][0].group === 'opening' && ev['story:begin'][0].season === 1, 'update() → season 1 opening, first line = narrator title card');
  story.update(1); story.update(1);
  ok(ev['story:line'].length === 1, 'no auto-advance by default (waits for ui:advance)');
  bus.emit('ui:advance', {});
  ok(ev['story:line'].length === 2 && ev['story:line'][1].speaker === 'pip' && ev['story:line'][1].index === 1 && ev['story:line'][1].total === data.seasons[0].opening.length, 'ui:advance → line 2 (pip) with index/total');
  const n = drain(bus, story);
  ok(!story.isPlaying && ev['story:line'].length === data.seasons[0].opening.length && ev['story:end'].length === 1 && ev['story:end'][0].group === 'opening', `drained opening in ${n} advances · story:end once`);
  ok(story.onSeasonStart(1) === false && ev['story:line'].length === data.seasons[0].opening.length, 'opening never replays for the same season');
  // mid-season at day01 ≥ 0.5, once
  eco.state.day01 = 0.49; story.update(0); ok(!story.isPlaying, 'no mid before 0.5');
  eco.state.day01 = 0.5; story.update(0); ok(story.isPlaying && story.line.text === data.seasons[0].mid[0].text, 'mid fires at day01 0.5');
  drain(bus, story); story.update(0); ok(!story.isPlaying && story.state.midPlayed === 1, 'mid once per season');
}

// ---- season end: lesson first, ledger variant by stars, story:review after lines; next opening on ui:continue
{
  const { bus, eco, ev, story } = mk();
  story.update(0); drain(bus, story);
  eco.earn(600, 'test'); eco.allocate({ save: 200, protect: 100 }); eco.repay(200);
  const report = eco.endSeason();
  ok(report && report.season === 1 && eco.state.season === 2, 'economy season 1 → report');
  const lesson = ev['story:lesson'][0];
  ok(lesson && lesson.id === report.lessonId && lesson.id === 'budgeting' && lesson.title === 'Budgeting' && lesson.tip, 'eco:season → story:lesson {budgeting} emitted immediately');
  const variant = pickLedgerVariant(report.stars);
  ok(story.isPlaying && story.current.group === 'ledger' && story.line.text === data.seasons[0].ledger[variant][0].text, `ledger lines variant "${variant}" (stars ${report.stars})`);
  ok(!ev['story:review'], 'story:review not yet (lines still playing)');
  drain(bus, story);
  ok(ev['story:review'] && ev['story:review'][0].report === report && ev['story:review'][0].variant === variant, 'story:review {report} after ledger lines → 10C opens the Ledger');
  ok(!story.isPlaying && story.state.openingPlayed === 1, 'season 2 opening does NOT start on its own (Ledger is open)');
  story.update(0); ok(!story.isPlaying, 'update() does not start season 2 either');
  bus.emit('ui:continue', { season: 1, stars: report.stars, outcome: 'season' });
  ok(story.isPlaying && story.current.group === 'opening' && story.current.meta.season === 2 && /Season 2/.test(story.line.text), 'ui:continue → season 2 opening');
  drain(bus, story);
  // forced low / high variants
  const lowBus = mk(); lowBus.story.onSeasonEnd({ season: 3, stars: 0, lessonId: 'emergencyFund' });
  ok(lowBus.story.line.text === data.seasons[2].ledger.low[0].text && last(lowBus.ev['story:lesson']).id === 'emergencyFund', 'stars 0 → low variant S3');
  const hiBus = mk(); hiBus.story.onSeasonEnd({ season: 10, stars: 3, lessonId: 'planningForAGoal' });
  ok(hiBus.story.line.text === data.seasons[9].ledger.high[0].text, 'stars 3 → high variant S10');
  ok(hiBus.story.onSeasonEnd({ season: 10, stars: 3 }) === false, 'season end never replays');
}

// ---- events & scams (choices → economy.acceptOffer / refuseOffer, lesson = tell)
{
  const { bus, eco, ev, story } = mk();
  story.update(0); drain(bus, story);
  eco.applyEvent('storm');
  ok(story.isPlaying && story.current.group === 'event' && story.line.text === data.events.storm[0].text, 'eco:event storm → event line');
  drain(bus, story);
  const offer = eco.offerScam('zeroInterestLoan');
  ok(story.isPlaying && story.current.group === 'scam' && story.line.speaker === 'collector' && !story.line.choices, 'eco:scam → pitch line 1 (no choices yet)');
  bus.emit('ui:advance', {});
  ok(story.line.choices && story.line.choices.length === 2 && story.line.choices[0].id === 'accept' && story.line.choices[1].id === 'refuse', 'pitch line 2 carries accept/refuse choices');
  const before = ev['story:line'].length; bus.emit('ui:advance', {});
  ok(ev['story:line'].length === before && story.line.choices, 'ui:advance blocked while choices are shown');
  const debt0 = eco.state.debt, spark0 = eco.state.spark;
  bus.emit('ui:choice', { index: 0 });
  ok(eco.state.debt === debt0 + 150 && eco.state.spark === spark0 + 150 && eco.pendingOffer === null && eco.ledger.scamsAccepted === 1, 'accept → economy.acceptOffer (debt +150, spark +150)');
  ok(story.isPlaying && story.current.group === 'scamResult' && story.line.text === data.scams.zeroInterestLoan.accept[0].text, 'accept lines follow with NO story:end in between');
  ok(!ev['story:end'].some((e) => e.group === 'scam'), 'story:end not emitted between pitch and result (dialogue box stays open)');
  const L = last(ev['story:lesson']);
  ok(L.lesson === offer.tell && L.title === 'Too-Good Deals' && L.accepted === true && L.scam === 'zeroInterestLoan', 'story:lesson = the scam tell');
  ok(last(ev['story:choice']).outcome.accepted === true && last(ev['story:choice']).choice.id === 'accept', 'story:choice {outcome, choice}');
  drain(bus, story);
  // refuse path
  const fog0 = eco.state.fog01; eco.offerScam('luckyLantern'); drain(bus, story, 1);
  ok(eco.ledger.scamsRefused === 1 && eco.state.fog01 < fog0 && last(ev['story:lesson']).accepted === false, 'refuse → economy.refuseOffer (fog −0.02), lesson accepted:false');
  ok(ev['story:line'].some((l) => l.text === data.scams.luckyLantern.refuse[1].text), 'refuse lines played');
  // unknown scam id → synthesized pitch still offers a choice
  eco.scams.mystery = { id: 'mystery', title: 'Mystery Box', cost: 10, tell: 'no tell', lesson: 'scams' }; eco.offerScam('mystery');
  ok(story.isPlaying && story.line.text === 'Mystery Box', 'unknown scam → fallback pitch from offer.title');
  bus.emit('ui:advance', {}); ok(story.line.choices?.length === 2, 'fallback pitch has choices'); bus.emit('ui:choice', { index: 1 });
  ok(!story.isPlaying && eco.ledger.scamsRefused === 2, 'fallback refuse → refuseOffer, nothing left to play');
}

// ---- queueing: opening + event + scam back-to-back → single story:end at the very end
{
  const { bus, eco, ev, story } = mk();
  story.update(0); eco.applyEvent('festival'); eco.offerScam('doubleSpark');
  ok(story.pending === 2 && story.current.group === 'opening', 'groups queue behind the opening');
  drain(bus, story, 1);
  const groups = ev['story:groupEnd'].map((e) => e.group).join(',');
  ok(groups === 'opening,event,scam,scamResult' && ev['story:end'].length === 1, `groupEnd order ${groups} · story:end exactly once`);
  ok(story.skipGroup() === null, 'skipGroup on idle → null');
  eco.applyEvent('leakyRoof'); eco.applyEvent('touristBoat'); story.skipGroup();
  ok(story.current.group === 'event' && story.current.meta.id === 'touristBoat', 'skipGroup → jumps to the next queued group');
  story.clear(); ok(!story.isPlaying && story.pending === 0, 'clear()');
}

// ---- tutorial toasts: once per run, by trigger
{
  const { bus, ev, story } = mk();
  bus.emit('build:placed', { id: 'stall_fruit' }); bus.emit('build:placed', { id: 'stall_fruit' });
  ok(ev['story:toast'] && ev['story:toast'].length === 1 && ev['story:toast'][0].id === 't_placed' && ev['story:toast'][0].icon === '🦉' && ev['story:toast'][0].trigger === 'build:placed', 'build:placed → t_placed toast once');
  bus.emit('eco:scam', { id: 'doubleSpark', tell: 'x' }); bus.emit('ui:ledger:open', {}); bus.emit('cust:paid', {});
  ok(ev['story:toast'].length === 4 && ev['story:toast'].map((t) => t.id).join() === 't_placed,t_scam,t_ledger,t_firstpay', 'eco:scam / ui:ledger:open / cust:paid toasts');
  ok(story.tutorialFor('build:placed') === null && story.tutorialFor('nope') === null, 'tutorialFor repeats / unknown → null');
  const s2 = mk({ tutorial: false }); s2.bus.emit('build:placed', {}); ok(!s2.ev['story:toast'], 'tutorial:false → no toasts');
  // serialize / deserialize keeps fired toasts + progress
  const json = JSON.stringify(story.serialize());
  // fresh bus WITHOUT a StorySystem from mk() (that one would fire the toast itself) — only the deserialized copy listens
  const b3 = new EventBus(); const e3 = makeEconomy({ bus: b3, seed: 3, autoSeason: false }); const ev3 = {}; b3.on('story:toast', (p) => (ev3['story:toast'] ||= []).push(p));
  const s3 = StorySystem.deserialize(json, e3, { data, bus: b3 });
  b3.emit('build:placed', {}); ok(!ev3['story:toast'] && s3.state.toastsFired.length === 4 && s3.state.scamsSeen[0] === 'doubleSpark', 'deserialize → fired toasts + scamsSeen remembered, no replay');
  b3.emit('eco:fog', {}); ok(ev3['story:toast']?.length === 1 && ev3['story:toast'][0].id === 't_fog', 'deserialized copy still fires NEW toasts');
}

// ---- win / lose finales
{
  const { bus, eco, ev, story } = mk();
  story.update(0); drain(bus, story);
  bus.emit('eco:win', { season: 10 });
  ok(story.isPlaying && story.current.group === 'ending' && story.line.text === data.ending.win[0].text && last(ev['story:lesson']).id === 'planningForAGoal', 'eco:win → ending.win + lesson planningForAGoal');
  drain(bus, story);
  ok(ev['story:line'].some((l) => l.text === data.ending.endlessUnlock[0].text) && ev['story:finale']?.[0].endless === true && ev['story:finale'][0].outcome === 'win', 'endlessUnlock lines → story:finale {endless:true}');
  ok(story.onWin() === false && story.onLose() === false, 'finale plays once');
  const L = mk(); L.story.update(0); drain(L.bus, L.story); L.bus.emit('eco:lose', { season: 4, reason: 'fog' }); drain(L.bus, L.story);
  ok(L.ev['story:finale'][0].endless === false && L.ev['story:finale'][0].reason === 'fog' && L.ev['story:line'].some((l) => l.text === data.ending.lose[2].text), 'eco:lose → ending.lose → story:finale {endless:false, reason}');
}

// ---- autoplay:false + autoAdvance (demo mode) + full 10-season walk with the real economy
{
  const { bus, eco, ev, story } = mk({ autoplay: false, autoAdvance: true, lineGap: 0.1 });
  bus.emit('eco:event', { id: 'storm' }); ok(!story.isPlaying, 'autoplay:false ignores bus');
  story.onSeasonStart(1); let t = 0; while (story.isPlaying && t < 100) { story.update(0.05); t += 0.05; }
  ok(!story.isPlaying && ev['story:line'].length === data.seasons[0].opening.length && t > 0.8, `autoAdvance drives lines every lineGap (took ${t.toFixed(2)} s)`);
  // 10 seasons: sensible strategy, story driven by hand
  let lessons = [], lines = 0, variants = [];
  for (let s = 1; s <= BALANCE.seasonsToWin; s++) {
    if (s > 1) story.onSeasonStart(s);
    while (story.isPlaying) story.update(0.2);
    eco.earn(400, 'sim'); eco.allocate({ save: 120, protect: 80, invest: 60 }); if (eco.state.debt > 0) eco.repay(Math.min(eco.state.debt, 120));
    const r = eco.endSeason(); story.onSeasonEnd(r); variants.push(pickLedgerVariant(r.stars)); lessons.push(last(ev['story:lesson']).id);
    while (story.isPlaying) story.update(0.2);
    lines = ev['story:line'].length;
  }
  ok(lessons.join() === BALANCE.lessons.join(), '10 seasons → 10 lessons in BALANCE order: ' + lessons.join(','));
  // mid lines are not expected here: the loop never ticks day01 past 0.5 (mid is covered above). Floor = 10 × (opening ≥ 6 + ledger 2).
  ok(ev['story:review'].length === 10 && lines >= 10 * (6 + 2) && !ev['story:line'].some((l) => !l.speaker || !l.text), `10 reviews · ${lines} lines total · all lines have speaker+text (variants ${variants.join('')})`);
  if (eco.state.ended === 'win') { story.onWin(); while (story.isPlaying) story.update(0.2); }
  ok(eco.state.season === 11 && (eco.state.ended !== 'win' || ev['story:finale']?.[0].endless === true), `economy after S10: ended=${eco.state.ended} debt=${eco.state.debt} fog=${eco.state.fog01.toFixed(2)}`);
  story.destroy(); ok(!story.isPlaying && story.pending === 0, 'destroy()');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
