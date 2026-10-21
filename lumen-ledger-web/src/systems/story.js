// LUMEN LEDGER — Story system (Chat 8B). PURE JS: no Three, no DOM. Contract: API_CONTRACTS §B Story.
//
//   import { StorySystem, loadStory } from './src/systems/story.js';
//   const data  = await loadStory('data/story.json');            // browser: fetch · Node: pass the parsed object instead
//   const story = new StorySystem(economy, { data, bus });        // listens to eco:* and ui:* on the economy's bus (or opts.bus)
//   story.onSeasonStart(n) · story.onSeasonEnd(report) · story.next() · story.choose(i) · story.onEvent(id) · story.onScam(offer)
//   story.onWin() · story.onLose() · story.update(dt) · story.state · story.serialize() / StorySystem.deserialize(json, economy, opts)
//
// What it does (all output goes over the bus, UI is 7B's job)
//   • Plays line GROUPS one line at a time: `story:line {speaker,text,mood?,choices?}` → waits for `ui:advance` (7B dialogue) → next line.
//     A group that ends emits `story:groupEnd`, and `story:end {group}` ONLY when no other group is queued (so 7B's box closes once, not
//     between groups). Groups queue (season opening, then an event, then a scam…).
//   • Season start (`onSeasonStart(n)`; auto: season 1 from update()/`ui:start`, later seasons on `ui:continue {outcome:'season'}` after the
//     Ledger): `seasons[n-1].opening`. Mid-season (`update(dt)` sees economy
//     day01 ≥ 0.5, or `onMid()`): `mid`, once per season.
//   • Season end (`onSeasonEnd(report)` / `eco:season`): emits `story:lesson {id,title,lesson,tip}` immediately (so the Ledger card is
//     filled even if it opens first), then plays `ledger[variant]` lines, variant = stars ≤ 1 'low' · 2 'default' · 3 'high'.
//     With `opts.ledgerLinesBeforeReview` (default true) it also emits `story:review {report}` when those lines finish — 10C mounts the
//     Ledger with `autoOpen:false` and calls `ledger.show(report)` on that event. Set false if the Ledger should open first.
//   • Events (`eco:event {id}` / `onEvent(id)`): `events[id]`. Scams (`eco:scam offer` / `onScam(offer)`): `scams[offer.id].pitch`; the
//     pitch's last line carries `choices [accept, refuse]`; `ui:choice {index}` / `choose(i)` → `economy.acceptOffer()` or `refuseOffer()`
//     then plays `accept` / `refuse` lines and emits `story:lesson` with the scam's `tell` (lesson 'Too-Good Deals').
//   • `eco:win` → `ending.win` then `ending.endlessUnlock`, `story:lesson` planningForAGoal, then `story:finale {endless:true}`.
//     `eco:lose` → `ending.lose`, then `story:finale {endless:false}`.
//   • Tutorial toasts: for every `tutorial[i].trigger` bus event, emits `story:toast {text,icon}` ONCE per run (ids kept in state.toastsFired).
//   • `opts.autoplay` (default true): drives everything from bus events. false → the integrator calls the on*() methods itself.
//   • Pure: `pickLedgerVariant(stars)`, `linesFor(data, ...)` exported for tests. Nothing here imports Three or touches document.
//
// Timing (all delta-time, in update(dt) seconds): `opts.lineGap` 0.12 s between auto-advanced lines when `opts.autoAdvance` is set
//   (for the demo / tests; the real game waits for ui:advance). Mid-season fires at `opts.midAt` (0.5) of day01.

import { bus as defaultBus } from '../core/EventBus.js';

export const LEDGER_VARIANTS = ['low', 'default', 'high'];
export const SCAM_LESSON_TITLE = 'Too-Good Deals';
export const SCAM_TIP = 'Spot the tells: hurry · secrecy · "guaranteed" · an asterisk.';

/** stars 0..3 → ledger variant key. */
export function pickLedgerVariant(stars) { return stars >= 3 ? 'high' : stars <= 1 ? 'low' : 'default'; }

/** Pure lookup helpers over the story.json shape (return [] when missing — never throw on content gaps). */
export function linesFor(data, kind, key, variant) {
  if (!data) return [];
  switch (kind) {
    case 'opening': case 'mid': { const S = data.seasons?.[key - 1]; return S?.[kind] || []; }
    case 'ledger': { const S = data.seasons?.[key - 1]; return S?.ledger?.[variant] || S?.ledger?.default || []; }
    case 'event': return data.events?.[key] || [];
    case 'scam': return data.scams?.[key]?.[variant || 'pitch'] || [];
    case 'ending': return data.ending?.[key] || [];
    default: return [];
  }
}

/** Browser-side loader (fetch). In Node pass the parsed JSON to the constructor instead (tests do). */
export async function loadStory(url = 'data/story.json') {
  const res = await fetch(url); if (!res.ok) throw new Error('story.json ' + res.status);
  return res.json();
}

export class StorySystem {
  /**
   * @param {import('./economy.js').Economy} economy  4A economy (used for bus, state.season/day01, acceptOffer/refuseOffer)
   * @param {object} opts  { data, bus, autoplay=true, autoAdvance=false, lineGap=0.12, midAt=0.5, ledgerLinesBeforeReview=true, tutorial=true }
   */
  constructor(economy, opts = {}) {
    this.economy = economy || null;
    this.bus = opts.bus || economy?.bus || defaultBus;
    this.data = opts.data || null;
    this.opts = { autoplay: true, autoAdvance: false, lineGap: 0.12, midAt: 0.5, ledgerLinesBeforeReview: true, tutorial: true, ...opts };
    this.state = { season: 0, midPlayed: 0, openingPlayed: 0, endedPlayed: 0, toastsFired: [], scamsSeen: [], eventsSeen: [], finale: null, choicesMade: 0 };
    this.queue = [];          // [{ group, lines, i, onDone, meta }]
    this.current = null;      // group being played
    this.line = null;         // line currently shown (awaiting advance / choice)
    this.pendingOffer = null; // scam offer awaiting choice
    this._gap = 0;
    this._offs = [];
    if (this.opts.autoplay) this._listen();
  }

  // ---------------------------------------------------------------- public API (§B Story)
  get isPlaying() { return !!this.current; }
  get pending() { return this.queue.length; }

  onSeasonStart(n = this.economy?.state.season || 1) {
    if (this.state.openingPlayed === n) return false;
    this.state.season = n; this.state.openingPlayed = n;
    const S = this.data?.seasons?.[n - 1];
    return this._play('opening', linesFor(this.data, 'opening', n), { season: n, title: S?.title });
  }
  onMid(n = this.state.season) {
    if (this.state.midPlayed === n) return false;
    this.state.midPlayed = n;
    return this._play('mid', linesFor(this.data, 'mid', n), { season: n });
  }
  onSeasonEnd(report) {
    const n = report?.season || this.state.season || 1;
    if (this.state.endedPlayed === n) return false;
    this.state.endedPlayed = n;
    const lessonId = report?.lessonId || this.data?.seasons?.[n - 1]?.lesson;
    this.emitLesson(lessonId);
    const variant = pickLedgerVariant(report?.stars ?? 2);
    const lines = linesFor(this.data, 'ledger', n, variant);
    const onDone = () => { if (this.opts.ledgerLinesBeforeReview) this.bus.emit('story:review', { report, season: n, variant }); };
    return this._play('ledger', lines, { season: n, variant, report }, onDone);
  }
  onEvent(id) {
    if (!id) return false; this.state.eventsSeen.push(id);
    return this._play('event', linesFor(this.data, 'event', id), { id });
  }
  onScam(offer) {
    if (!offer || !offer.id) return false;
    this.pendingOffer = offer; this.state.scamsSeen.push(offer.id);
    const lines = linesFor(this.data, 'scam', offer.id, 'pitch');
    if (!lines.length) { // no script → synthesize a 2-line pitch from the 4B offer so the choice still happens
      const fallback = [{ speaker: 'collector', text: offer.text || offer.title || 'A wonderful offer!', mood: 'happy' }, { speaker: 'collector', text: 'Well?', choices: [{ id: 'accept', text: 'Accept' }, { id: 'refuse', text: 'Refuse' }] }];
      return this._play('scam', fallback, { id: offer.id, offer });
    }
    return this._play('scam', lines, { id: offer.id, offer });
  }
  /** Player picked choice i on the current line (0 = accept, 1 = refuse for scam pitches). */
  choose(i) {
    const line = this.line; if (!line || !line.choices) return null;
    const choice = line.choices[i] || line.choices[0];
    this.state.choicesMade++;
    const offer = this.pendingOffer; const meta = this.current?.meta || {};
    const result = { index: i, choice, group: this.current?.group, offer: offer || null, outcome: null };
    if (this.current?.group === 'scam' && offer) {
      const accept = choice.id === 'accept';
      this.pendingOffer = null;
      result.outcome = accept ? (this.economy?.acceptOffer?.(offer) ?? { accepted: true }) : (this.economy?.refuseOffer?.(offer) ?? { accepted: false, refused: true });
      const after = linesFor(this.data, 'scam', offer.id, accept ? 'accept' : 'refuse');
      const tell = this.data?.scams?.[offer.id]?.tell || offer.tell;
      // queue the outcome lines FIRST (front), then finish the pitch: story:end is only emitted when nothing follows, so 7B's dialogue
      // box stays open and simply shows the next line (its choose() → ui:choice → here → story:line happens inside one tick).
      if (tell) this.bus.emit('story:lesson', { id: offer.lesson || 'scams', title: SCAM_LESSON_TITLE, lesson: tell, tip: SCAM_TIP, scam: offer.id, accepted: accept });
      if (after.length) this.queue.unshift({ group: 'scamResult', lines: after, i: 0, meta: { id: offer.id, accepted: accept }, onDone: null });
      this._finishCurrent(); this._startNext();
    } else { this._finishCurrent(); this._startNext(); }
    this.bus.emit('story:choice', result);
    return result;
  }
  /** Advance to the next line (7B emits ui:advance; the demo may call this directly). Returns the new line or null. */
  next() {
    if (!this.current) return this._startNext();
    if (this.line?.choices) return this.line;                   // must choose first
    return this._advance();
  }
  onWin() {
    if (this.state.finale) return false; this.state.finale = 'win';
    this.emitLesson('planningForAGoal');
    this._play('ending', linesFor(this.data, 'ending', 'win'), { kind: 'win' });
    return this._play('ending', linesFor(this.data, 'ending', 'endlessUnlock'), { kind: 'endlessUnlock' }, () => this.bus.emit('story:finale', { endless: true, outcome: 'win' }));
  }
  onLose(reason) {
    if (this.state.finale) return false; this.state.finale = 'lose';
    return this._play('ending', linesFor(this.data, 'ending', 'lose'), { kind: 'lose', reason }, () => this.bus.emit('story:finale', { endless: false, outcome: 'lose', reason }));
  }
  /** Emit the Ledger lesson card for a lessonId (data.lessons[id]; falls back to a title-only card). */
  emitLesson(id) {
    if (!id) return null;
    const L = this.data?.lessons?.[id] || { id, title: id, lesson: '', tip: '' };
    const card = { id, title: L.title, lesson: L.lesson, tip: L.tip, season: L.season };
    this.bus.emit('story:lesson', card); return card;
  }
  /** Fire a tutorial toast by trigger name, once per run. Returns the toast or null. */
  tutorialFor(trigger) {
    if (!this.opts.tutorial) return null;
    const t = (this.data?.tutorial || []).find((x) => x.trigger === trigger && !this.state.toastsFired.includes(x.id));
    if (!t) return null;
    this.state.toastsFired.push(t.id);
    this.bus.emit('story:toast', { id: t.id, text: t.text, icon: t.icon || '🦉', kind: t.kind || 'info', trigger });
    return t;
  }
  /** dt seconds. Mid-season trigger + optional auto-advance (demo/tests). */
  update(dt = 0) {
    const eco = this.economy?.state;
    if (eco && !this.state.finale) {
      if (this.state.openingPlayed === 0 && eco.season >= 1 && this.opts.autoplay) this.onSeasonStart(eco.season);   // season 1 only; later seasons wait for ui:continue
      if (eco.day01 >= this.opts.midAt && this.state.midPlayed !== eco.season && this.state.openingPlayed === eco.season) this.onMid(eco.season);
    }
    if (this.opts.autoAdvance && this.line && !this.line.choices) { this._gap -= dt; if (this._gap <= 0) { this._gap = this.opts.lineGap; this._advance(); } }
    else if (this.opts.autoAdvance && !this.current && this.queue.length) this._startNext();
  }
  skipGroup() { if (this.current) this._finishCurrent(); return this._startNext(); }
  clear() { this.queue.length = 0; this.current = null; this.line = null; this.pendingOffer = null; this.bus.emit('story:end', { group: 'clear' }); }
  destroy() { for (const off of this._offs) off(); this._offs.length = 0; this.clear(); }

  serialize() { return { v: 1, state: { ...this.state, toastsFired: [...this.state.toastsFired], scamsSeen: [...this.state.scamsSeen], eventsSeen: [...this.state.eventsSeen] } }; }
  static deserialize(json, economy, opts = {}) {
    const s = new StorySystem(economy, opts);
    const j = typeof json === 'string' ? JSON.parse(json) : json;
    if (j?.state) Object.assign(s.state, j.state, { toastsFired: [...(j.state.toastsFired || [])], scamsSeen: [...(j.state.scamsSeen || [])], eventsSeen: [...(j.state.eventsSeen || [])] });
    return s;
  }

  // ---------------------------------------------------------------- internals
  _listen() {
    const on = (n, f) => this._offs.push(this.bus.on(n, f));
    on('eco:season', (report) => { this.onSeasonEnd(report); });                         // opening of the NEXT season comes from update() (economy.state.season advanced) or ui:continue
    on('ui:continue', (p) => { if (p?.outcome === 'season' && this.economy && !this.state.finale) this.onSeasonStart(this.economy.state.season); });
    on('eco:event', (p) => { this.onEvent(p?.id || p?.event?.id); });
    on('eco:scam', (offer) => { this.onScam(offer); });
    on('eco:win', () => this.onWin());
    on('eco:lose', (p) => this.onLose(p?.reason));
    on('ui:advance', () => { this.next(); });
    on('ui:choice', (p) => { if (this.line?.choices) this.choose(p?.index ?? 0); });
    on('ui:start', (p) => { if (p?.mode !== 'continue' && this.economy && this.state.openingPlayed === 0) this.onSeasonStart(this.economy.state.season); });
    // tutorial triggers (one listener per distinct trigger name in the data)
    const triggers = new Set((this.data?.tutorial || []).map((t) => t.trigger));
    for (const tr of triggers) on(tr, () => this.tutorialFor(tr));
  }
  _play(group, lines, meta = {}, onDone = null, front = false) {
    if (!lines || !lines.length) { if (onDone) onDone(); return false; }
    const item = { group, lines, i: 0, meta, onDone };
    if (front) this.queue.unshift(item); else this.queue.push(item);
    if (!this.current) this._startNext();
    return true;
  }
  _startNext() {
    if (this.current || !this.queue.length) return this.line;
    this.current = this.queue.shift(); this.current.i = 0;
    this.bus.emit('story:begin', { group: this.current.group, ...this.current.meta, count: this.current.lines.length });
    return this._show(this.current.lines[0]);
  }
  _show(raw) {
    const line = { ...raw, group: this.current.group, index: this.current.i, total: this.current.lines.length, season: this.current.meta.season ?? this.state.season };
    if (line.choices) line.choices = line.choices.map((c) => (typeof c === 'string' ? { id: c, text: c } : { ...c }));
    this.line = line; this._gap = this.opts.lineGap;
    this.bus.emit('story:line', line);
    return line;
  }
  _advance() {
    const cur = this.current; if (!cur) return null;
    cur.i++;
    if (cur.i < cur.lines.length) return this._show(cur.lines[cur.i]);
    this._finishCurrent();
    return this._startNext();
  }
  _finishCurrent() {
    const cur = this.current; if (!cur) return;
    this.current = null; this.line = null;
    this.bus.emit('story:groupEnd', { group: cur.group, ...cur.meta });
    if (!this.queue.length) this.bus.emit('story:end', { group: cur.group, ...cur.meta });   // closes the dialogue box only when nothing follows
    if (cur.onDone) cur.onDone();
  }
}

export default StorySystem;
