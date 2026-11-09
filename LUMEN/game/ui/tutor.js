// LUMEN LEDGER — 48F curiosity tutorial (HANDOFF_48Z decision D2). DOM only, no Three. Blue glass card, one at a time, once per profile.
//
//   import { mountTutor } from './ui/tutor.js';
//   const tutor = mountTutor(root, { bus, data: tutorJson, seen: [] });
//   tutor.show(id) · tutor.dismiss() · tutor.seen (array of card ids shown, persist it) · tutor.update(dt) · tutor.destroy()
//   tutor.bind({ touched: () => boolean })   // Game.js: true once the player built / deposited / opened the tray (onCuriosityLull timer)
//
// Reactive, not scripted: a card appears AFTER the player did something (any bus event named in data/tutor.json cards[].on),
// names the next step in ≤ 60 chars and dies on pointerdown / keydown (capture, never preventDefault) or after `ttl` seconds.
//   • each card id shows ONCE per profile (`seen`, persisted by save.js tutorSeen)        • only ONE card on screen
//   • a new trigger while a card is up is DROPPED, not queued                            • never pauses, dims, blocks or stacks
//   • `onCuriosityLull`: `lull` seconds of play with touched() === false → one card, then never again
// Bus out: tutor:shown {id, mode} · tutor:dismissed {id, ms, why}.
//
// T2 (FUN_PASS §7.A) — the same card, three more doors. Everything below is additive; the 48F event cards behave exactly as before.
//   • APPROACH  bus 'curious' {hint, why:'approach'|'linger'} / 'curious:ping' (src/systems/curiosity.js) → offer(id): shown while counts[id] < maxShows
//               (card field `target` ⇒ default 3, else 1), never twice within `repeatGap` s, queued (max 2, by `priority`) while another card is up.
//   • TAP       bus 'curious' {why:'tap'|'hold'} or a pointerdown on any [data-guide="<id>"] element → ask(id): ALWAYS shows (replaces the current card,
//               ignores counts + cooldown). A tap that also performs a game action (payload act:true) shows the card only until maxShows, then acts silently.
//   • CODEX     list() → [{id, icon, text, group, count, met}] for ui/guideCodex.js (pause → GUIDE).
//   • `doneOn` / `doneMatch` on a card = the bus event that proves the player learned it → retire(id) (never offered again; ask() still answers).
//   • `counts` {id: n} is what persists (save.js tutorCounts); `seen` stays the list of ids with n ≥ 1 (old saves: every seen id counts once).
//   • Cards born from the world (mode 'curious') ignore key presses (WASD would kill them) and the first 1.5 s of pointer gestures (the joystick).
//   • bind({ touched, blocked, project }) — blocked() true = no card at all (dialogue / modal / deal); project({x,y,z}) → {x,y,behind} puts the hand on a world thing.
import { bus as defaultBus } from '../src/core/EventBus.js';
import { icon, iconizeText, cloudHandArt } from './icons.js';

// S59 (user report "the tutorial texts disappear when I move the character"): a card is PERSISTENT.
//   • moving / tapping the ground / pressing keys NEVER dismisses it (the old tap-anywhere / any-key / 1.5 s guard is gone)
//   • it leaves when it is FOLLOWED: a card's `follow: [{on, match}]` (or `doneOn`) event fires, the next verb step starts, or the player taps its ✕
//   • read-only cards (no follow / doneOn) fade after `ttl` seconds of STANDING STILL (the reading clock pauses while Pip walks); every card has a hard cap (`capInfo` / `capAct`)
//   • the baby-cloud tutor (icon 'cloudbaby') speaks from the card; its cloud hand ('cloudhand') points at what the card names:
//     card `point` = selector | 'world:<kind>' | an array of those (first one that is on screen wins); jar:/hud:/power: cards find their own target.
export const TUTOR_DEFAULTS = { ttl: 8, lull: 25, repeatGap: 12, queueMax: 2, gap: 0.35, capInfo: 30, capAct: 60, queueAge: 12, moveSpeed: 0.35, sameGesture: 1.2 };

const matches = (match, p) => {
  if (!match) return true; if (!p || typeof p !== 'object') return false;
  for (const k of Object.keys(match)) {
    const want = match[k], got = p[k];
    if (typeof want === 'string' && want.endsWith('*')) { if (!String(got ?? '').startsWith(want.slice(0, -1))) return false; }
    else if (got !== want) return false;
  }
  return true;
};

const isVerb = (c) => !!c && String(c.id).startsWith('verb:');
/** A card the player can FOLLOW (do what it says): it names a follow / doneOn event, or it is a verb-chain step. Those stay up until followed. */
const followable = (c) => !!c && (isVerb(c) || !!c.doneOn || (Array.isArray(c.follow) && c.follow.length > 0));

export function mountTutor(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const data = opts.data || { cards: [] };
  const cfg = { ttl: +data.ttl || TUTOR_DEFAULTS.ttl, lull: +data.lull || TUTOR_DEFAULTS.lull, repeatGap: data.repeatGap != null ? +data.repeatGap : TUTOR_DEFAULTS.repeatGap, queueMax: TUTOR_DEFAULTS.queueMax, gap: TUTOR_DEFAULTS.gap, capInfo: +data.capInfo || TUTOR_DEFAULTS.capInfo, capAct: +data.capAct || TUTOR_DEFAULTS.capAct, queueAge: TUTOR_DEFAULTS.queueAge, moveSpeed: TUTOR_DEFAULTS.moveSpeed, sameGesture: TUTOR_DEFAULTS.sameGesture };
  const cards = new Map(); for (const c of data.cards || []) if (c && c.id) cards.set(c.id, c);
  const seen = Array.isArray(opts.seen) ? opts.seen.filter((id) => typeof id === 'string') : [];
  const counts = {};                                                           // T2: id → times shown (retired = 99). `seen` (ids with n ≥ 1) is kept in sync for old saves / tests.
  const RETIRED = 99, maxOf = (c) => Math.max(1, (c.maxShows | 0) || (c.target ? 3 : 1));
  // S66-C4: `teaches` = the POINT a card makes ("pouch", "jar-place", "pay" ...). Once ANY card with that key was shown (or its thing was done), every other card with the same key
  //   is retired: a point already told is never told again (also after a reload: the key is stored in `counts` as 'teach:<key>', which save.js already persists).
  const teachKey = (c) => (c && c.teaches ? 'teach:' + c.teaches : null);
  const taught = (c) => { const k = teachKey(c); return !!k && (counts[k] || 0) > 0; };
  const retired = (c) => (counts[c.id] || 0) >= maxOf(c) || taught(c);
  const putCounts = (m) => { if (!m || typeof m !== 'object' || Array.isArray(m)) return; for (const [id, n] of Object.entries(m)) { const v = Math.floor(+n); if (typeof id === 'string' && Number.isFinite(v) && v > 0) { counts[id] = Math.max(counts[id] || 0, Math.min(v, RETIRED)); if (!seen.includes(id)) seen.push(id); } } };
  for (const id of seen) counts[id] = Math.max(counts[id] || 0, 1);
  putCounts(opts.counts);
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // ---- DOM (≤ 1 card subtree: wrap > [cloud avatar, bubble > [ico, txt], ✕] + the cloud hand)
  let wrap = null, ico = null, txt = null, hand = null, av = null, xbtn = null, joy = null;
  if (hasDoc) {
    wrap = document.createElement('div'); wrap.className = 'll-tutor'; wrap.setAttribute('aria-live', 'polite');
    av = document.createElement('span'); av.className = 'll-tutor-av'; av.innerHTML = icon('cloudbaby');
    const bub = document.createElement('span'); bub.className = 'll-tutor-bub';
    ico = document.createElement('span'); ico.className = 'll-tutor-ico';
    txt = document.createElement('span'); txt.className = 'll-tutor-txt';
    xbtn = document.createElement('button'); xbtn.type = 'button'; xbtn.className = 'll-tutor-x'; xbtn.setAttribute('aria-label', 'Got it'); xbtn.innerHTML = icon('check');
    xbtn.addEventListener?.('click', (e) => { e.stopPropagation?.(); api.dismiss('tap'); });
    bub.append(ico, txt, xbtn); wrap.append(av, bub);
    hand = document.createElement('div'); hand.className = 'll-tutor-hand'; hand.innerHTML = cloudHandArt();   // S59-C: two frames (finger up / finger pressed) cross-fade in tutor.css = a tapping hand
    (root || document.body).append(wrap, hand);
    // S60-A: the SIMULATED JOYSTICK. A drawn stick (base ring + knob, same look as the real one in ui/touch.css) with the cloud hand dragging it, so a phone player SEES that a stick exists
    //   (and where). Desktop gets four WASD keycaps (W pulses) instead. Card field `demo: 'move'`; the text for touch lives in `textTouch`.
    joy = document.createElement('div'); joy.className = 'll-tutor-joy'; joy.setAttribute('aria-hidden', 'true');
    joy.innerHTML = '<span class="tj-base"><i class="tj-ring"></i><i class="tj-knob"></i></span><span class="tj-hand">' + cloudHandArt() + '</span>'
      + '<span class="tj-keys"><b class="k-w">W</b><b class="k-a">A</b><b class="k-s">S</b><b class="k-d">D</b></span>';
    (root || document.body).append(joy);
  }

  const st = { cur: null, mode: 'event', world: null, queue: [], gap: 0, clock: 0, last: {}, t: 0, age: 0, moving: false, hp: null, lostAt: 0, pendingVerb: null, at: 0, lull: 0, lullDone: seen.includes('onCuriosityLull'), active: true, deps: null, offs: [], raf: 0 };

  // ---- the cloud hand: where does card `c` point? (S59) -------------------------------------------------------------------
  // S60-B: MOVING things (stranger / collectors / Baron / Pip) are located LIVE every frame (deps.locate) — the x,z a 'curious' event carried is a
  //   snapshot from the moment the card opened; a strolling stranger left it behind and the hand kept pointing at an empty (invisible) spot.
  //   The snapshot is now only the LAST fallback, and never for a card that names a moving kind.
  const MOVING = ['world:stranger', 'world:enemy', 'world:pier', 'world:hero', 'world:ahead'];
  const isLive = (c) => { const pt = c && c.point; return (Array.isArray(pt) ? pt : pt ? [pt] : []).some((p) => typeof p === 'string' && MOVING.includes(p)); };
  const specsOf = (c, world) => {
    const out = [];
    const pt = c && c.point; for (const p of Array.isArray(pt) ? pt : pt ? [pt] : []) if (typeof p === 'string') out.push(p);
    const id = c ? String(c.id) : '';
    if (id === 'jar:withdraw' && st.ptJar) out.unshift(`.ll-jars:not(.collapsed) .ll-jar.${st.ptJar}.has-bal .ll-jar-wd`);   // S76: the arrow of the jar Pip stands at, not the first jar with a balance (always Save)
    if (id.startsWith('power:')) { const n = id.slice(6); out.push(`.ll-touch-ab[data-ability="${n}"]`, `.ll-touch-btn[data-ability="${n}"]`, `.ll-abil-chip[data-id="${n}"]`); }   /* S65-A: Dash button = Magnet */
    if (c && (c.target || id.startsWith('hud:'))) out.push(`[data-guide="${c.target || id}"]`);
    if (world && Number.isFinite(world.x) && !isLive(c)) out.push({ world });                      // static things only (jar, stall, till …): last resort when locate() cannot find it
    return out;
  };
  const pointAt = (c, world) => {
    if (!hand) return; hand.classList.remove('show', 'flip'); if (st.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(st.raf); st.raf = 0;
    if (joy) joy.classList.remove('show', 'touch', 'keys');
    const demo = !!(c && c.demo === 'move' && joy), touch = isTouch();                          // S60-A: touch → joystick demo (no world hand); desktop → WASD keys + the hand far ahead
    if (hasDoc && document.body && document.body.classList) document.body.classList.toggle('tj-on', false);
    if (demo) { joy.classList.add('show', touch ? 'touch' : 'keys'); if (touch && document.body && document.body.classList) document.body.classList.add('tj-on'); }   // tj-on hides the plain 'drag to move' label while the drawn stick says it better
    const specs = c ? specsOf(c, world) : []; if (!specs.length && !demo) return;
    const host = root || document, vw = () => (typeof window !== 'undefined' && window.innerWidth) || 800, vh = () => (typeof window !== 'undefined' && window.innerHeight) || 450;
    const size = () => hand.offsetWidth || 56;
    const put = (x, topBelow, topAbove, above) => {                                            // under the target, finger up — or above it, finger down, when the bottom edge is too close (or `above`: tabs, so the glove never covers the cards under them)
      const flip = above ? topAbove >= 4 : (topBelow + size() > vh() - 4 && topAbove >= 4); hand.classList.add('show'); hand.classList.toggle('flip', flip);
      hand.style.left = `${Math.round(Math.max(size() / 2 + 4, Math.min(vw() - size() / 2 - 4, x)))}px`; hand.style.top = `${Math.round(flip ? topAbove : topBelow)}px`;
    };
    const tick = () => {
      if (!st.cur) return;
      if (demo) {                                                                               // the real stick is in use → the demo steps aside; it comes back when the thumb lifts
        const real = !!(host.querySelector && host.querySelector('.ll-joy-base.on')); joy.classList.toggle('hide', real);
        if (touch) { hand.classList.remove('show'); if (typeof requestAnimationFrame === 'function') st.raf = requestAnimationFrame(tick); return; }
      }
      const hb = (root && root.getBoundingClientRect) ? root.getBoundingClientRect() : { left: 0, top: 0 }; let found = false, liveMissing = 0, liveSeen = 0;
      for (const sp of specs) {
        if (typeof sp === 'object' || sp.startsWith('world:')) {
          let w = typeof sp === 'object' ? sp.world : null;
          if (!w && st.deps && typeof st.deps.locate === 'function') { try { w = st.deps.locate(sp.slice(6)); } catch (_) { w = null; } }
          if (typeof sp === 'string' && MOVING.includes(sp)) { liveSeen++; if (!w) liveMissing++; }
          if (!w || !st.deps || typeof st.deps.project !== 'function') continue;
          let q = null; try { q = st.deps.project({ x: w.x, y: Number.isFinite(w.y) ? w.y : 1.3, z: w.z }); } catch (_) { q = null; }
          if (!q || q.behind || !Number.isFinite(q.x) || !Number.isFinite(q.y) || q.x < -8 || q.x > vw() + 8 || q.y < -8 || q.y > vh() + 8) continue;
          put(q.x, q.y + 8, q.y - 8 - size()); found = true; break;
        }
        const above = sp.charAt(0) === '^', sel = above ? sp.slice(1) : sp;
        let el = null; try { el = host.querySelector ? host.querySelector(sel) : null; } catch (_) { el = null; }
        const b = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (!b || (!b.width && !b.height)) continue;
        put(b.left + b.width / 2 - hb.left, b.bottom - hb.top + 2, b.top - hb.top - 2 - size(), above); found = true; break;
      }
      if (!found) hand.classList.remove('show');
      // S60-B: the moving thing is GONE (locate() = null: the stranger left, the Collector was beaten) → the card has nothing to say; close it after a short grace
      if (liveSeen && liveMissing === liveSeen && !found) { if (!st.lostAt) st.lostAt = now(); else if (now() - st.lostAt > 1200 && isLive(st.cur) && st.cur.target) { api.dismiss('gone'); return; } } else st.lostAt = 0;
      if (typeof requestAnimationFrame === 'function') st.raf = requestAnimationFrame(tick);
    };
    tick();
  };

  const isTouch = () => !!(hasDoc && document.body && document.body.classList && document.body.classList.contains('is-touch'));
  const blockedNow = () => { try { return !!(st.deps && typeof st.deps.blocked === 'function' && st.deps.blocked()); } catch (_) { return false; } };
  /** Put card `c` on screen (counts it). mode 'event' (48F) | 'curious' (approach/linger/ping) | 'ask' (tap / HUD tap). */
  function display(c, mode, world, text) {
    counts[c.id] = Math.min(RETIRED - 1, (counts[c.id] || 0) + 1); if (!seen.includes(c.id)) seen.push(c.id);
    { const tk = teachKey(c); if (tk) counts[tk] = 1; }                 // S66-C4: this point is now told
    st.cur = c; st.mode = mode; st.world = world || null; st.t = 0; st.age = 0; st.at = now(); st.last[c.id] = st.clock;
    // S59-D: the words wear DRAWN icons (✦ → spark, ★ → star …), never a font emoji. `text` = a one-off line from the caller (jar reminders name the missing jars).
    if (wrap) { ico.innerHTML = c.icon ? icon(c.icon) : ''; txt.innerHTML = iconizeText(String(text || (c.textTouch && isTouch() ? c.textTouch : c.text) || '').slice(0, 60)); wrap.classList.add('show'); pointAt(c, world); }
    bus.emit('tutor:shown', { id: c.id, mode });
  }
  const queued = (id) => st.queue.some((q) => q.c.id === id);
  function enqueue(c, world, text) {
    if (queued(c.id)) return false;
    st.queue.push({ c, world: world || null, text: text || null }); st.queue.sort((a, b) => (b.c.priority | 0) - (a.c.priority | 0));
    while (st.queue.length > cfg.queueMax) st.queue.pop();
    return true;
  }
  function retire(id) {
    const c = cards.get(id); if (!c) return false;
    { const tk = teachKey(c); if (tk) counts[tk] = 1; }                      // S66-C4: the player DID it → the point is learned
    counts[id] = RETIRED;                                                    // learned by doing: never offered again, but NOT 'seen' (nothing was shown)
    const qi = st.queue.findIndex((q) => q.c.id === id); if (qi >= 0) st.queue.splice(qi, 1);
    if (st.cur && st.cur.id === id && (st.mode !== 'ask' || st.age > cfg.sameGesture)) api.dismiss('done');   // S59: a tap that ALSO does the thing keeps its card for 1.2 s, then it is followed
    return true;
  }

  const trackMove = (dt) => {                                                 // hero speed from deps.locate('hero') — absent in headless unit tests → never "moving"
    let p = null; try { p = st.deps && typeof st.deps.locate === 'function' ? st.deps.locate('hero') : null; } catch (_) { p = null; }
    if (!p || !Number.isFinite(p.x)) { st.moving = false; st.hp = null; return; }
    if (st.hp && dt > 0) st.moving = Math.hypot(p.x - st.hp.x, p.z - st.hp.z) / dt > cfg.moveSpeed; st.hp = { x: p.x, z: p.z };
  };

  const api = {
    seen, counts,
    get current() { return st.cur ? st.cur.id : null; },
    get visible() { return !!st.cur; },
    bind(d) { st.deps = d ? Object.assign(st.deps || {}, d) : null; return api; },   // S59: merges (Game.js binds twice: core deps, then locate)
    /** Show card `id` while it has shows left (48F: once). Returns true when it was shown (false: unknown, retired, or another card is up → dropped). */
    show(id) {
      const c = cards.get(id); if (!c || !st.active) return false;
      if (retired(c)) return false;
      if (blockedNow()) { if (isVerb(c)) st.pendingVerb = id; else enqueue(c); return false; }   // S59-A: NOTHING shows during a cinematic / dialogue; a verb step waits, an event card queues, both appear after it ends (was: event cards ignored the block)
      if (st.cur && isVerb(st.cur) && isVerb(c) && st.cur.id !== c.id) api.dismiss('followed');   // S59: next verb step = the last one was followed
      if (st.cur && c.urgent && !isVerb(st.cur)) { const o = st.cur; st.cur = null; bus.emit('tutor:dismissed', { id: o.id, ms: Math.round(now() - st.at), why: 'replaced' }); }   // S73: an `urgent` card (customers left empty-handed) replaces an info card instead of being dropped; never a verb step
      if (st.cur && c.urgent) { enqueue(c); return false; }   // S73: the event fires once (6th walk-away) - behind a verb step it WAITS instead of being lost
      if (st.cur) return false;
      display(c, 'event'); return true;
    },
    /** T2 approach / linger / ping: like show(), but repeats (≤ maxShows, ≥ repeatGap s apart) and QUEUES behind the card on screen. */
    offer(id, world, text) {
      const c = cards.get(id); if (!c || !st.active || retired(c) || blockedNow()) return false;
      if (st.last[id] != null && st.clock - st.last[id] < cfg.repeatGap) return false;
      if (st.cur) { if (st.cur.id === id) return false; return enqueue(c, world, text); }
      display(c, 'curious', world, text); return true;
    },
    /** T2 tap-to-ask: always answers (replaces the card on screen), no count limit, no cooldown. */
    ask(id, world) {
      const c = cards.get(id); if (!c || !st.active || blockedNow()) return false;
      if (st.cur && isVerb(st.cur) && !isVerb(c)) return false;                    // S59: the step the player is on stays; HUD taps wait
      if (st.cur && st.cur.id === id) { st.t = 0; st.at = now(); return true; }   // asked again: keep it up, restart the clock
      if (st.cur) { const o = st.cur; st.cur = null; bus.emit('tutor:dismissed', { id: o.id, ms: Math.round(now() - st.at), why: 'replaced' }); }
      display(c, 'ask', world); return true;
    },
    retire,
    /** Restore persisted progress (save slot / CONTINUE): counts {id:n} and/or the old seen list (each id = 1). Never lowers a count. */
    merge(o = {}) { if (Array.isArray(o.seen)) for (const id of o.seen) if (typeof id === 'string') { counts[id] = Math.max(counts[id] || 0, 1); if (!seen.includes(id)) seen.push(id); } putCounts(o.counts); return api; },
    /** Debug / reset: forget every card (counts, seen, queue, cool-downs). */
    clear() { for (const k of Object.keys(counts)) delete counts[k]; seen.length = 0; st.queue.length = 0; st.last = {}; st.lullDone = false; st.lull = 0; return api; },
    has(id) { return cards.has(id); },
    cardIds() { return [...cards.keys()]; },
    card(id) { return cards.get(id) || null; },
    /** T2 codex: every card, in data order. met = shown at least once (or retired by doing the thing). */
    list() { return [...cards.values()].filter((c) => c.on !== null || c.target || c.group).map((c) => ({ id: c.id, icon: c.icon || '', text: String(c.text || ''), group: c.group || 'other', count: Math.min(counts[c.id] || 0, 98), met: (counts[c.id] || 0) > 0 })); },
    get queued() { return st.queue.map((q) => q.c.id); },
    dismiss(why = 'tap') {
      const c = st.cur; if (!c) return api;
      st.cur = null; st.moving = false; st.hp = null; const ms = Math.round(now() - st.at); st.gap = cfg.gap;
      if (wrap) { wrap.classList.remove('show'); pointAt(null); }
      if ((why === 'modal' || why === 'title') && (counts[c.id] || 0) > 0 && (counts[c.id] || 0) < RETIRED) { counts[c.id]--; if (!(counts[c.id] > 0)) { const tk = teachKey(c); if (tk) delete counts[tk]; } }   // S59: shut by a modal, not read → still unseen (S66-C4: and the point is not told yet)
      if (why === 'modal' && isVerb(c)) st.pendingVerb = c.id;                                  // …and a verb card comes back when the modal closes
      bus.emit('tutor:dismissed', { id: c.id, ms, why });
      if (why === 'title' || why === 'destroy') st.queue.length = 0;
      return api;
    },
    /** Clock: unpaused play seconds (ui.update). ttl + curiosity lull. */
    update(dt) {
      dt = Math.min(0.1, Math.max(0, +dt || 0)); st.clock += dt;
      if (st.cur) {
        const c = st.cur; st.age += dt; trackMove(dt);
        if (!st.moving) st.t += dt;                                              // S59: the reading clock only runs while Pip stands still
        if (!followable(c) && st.t >= cfg.ttl) api.dismiss('ttl');               // info card: read it, it fades
        else if (st.age >= (followable(c) ? cfg.capAct : cfg.capInfo)) api.dismiss('cap');   // hard cap so nothing hangs forever
        else if (st.queue.length && st.age >= cfg.queueAge && !isVerb(c)) api.dismiss('next');   // somebody else is waiting
        return;
      }
      if (st.pendingVerb && st.active) { st.gap -= dt; if (st.gap <= 0 && !blockedNow()) { const id = st.pendingVerb; st.pendingVerb = null; const c = cards.get(id); if (c && !retired(c)) { display(c, 'event'); return; } } }
      if (st.queue.length && st.active) {                                   // T2.3: two triggers close together → both shown in order, none dropped
        st.gap -= dt; if (st.gap > 0) return;
        if (blockedNow()) return;
        const n = st.queue.shift(); if (n && !retired(n.c)) { display(n.c, 'curious', n.world, n.text); return; }
      }
      if (st.lullDone || !st.active) return;
      const touched = st.deps && typeof st.deps.touched === 'function' ? !!st.deps.touched() : true;
      if (touched) { st.lullDone = true; return; }           // the player found it on their own → the lull card is never needed
      st.lull += dt; if (st.lull >= cfg.lull) { st.lullDone = true; api.show('onCuriosityLull'); }
    },
    destroy() { api.dismiss('destroy'); st.offs.forEach((f) => { try { f(); } catch (_) {} }); st.offs.length = 0; offDom(); wrap?.remove?.(); hand?.remove?.(); joy?.remove?.(); },
  };

  // ---- triggers: one bus listener per distinct event name
  const byEvent = new Map();
  for (const c of cards.values()) { if (!c.on) continue; if (!byEvent.has(c.on)) byEvent.set(c.on, []); byEvent.get(c.on).push(c); }
  for (const [ev, list] of byEvent) st.offs.push(bus.on(ev, (p) => { if (p && p.silent) return; for (const c of list) if (matches(c.match, p)) { api.show(c.id); return; } }));
  // T2: the world asks (curiosity.js) · the player asks (tap on a thing) · the player did it (doneOn retires the card)
  st.offs.push(bus.on('curious', (p) => {
    if (!p || !p.hint || !cards.has(p.hint)) return;
    if (p.hint === 'jar:withdraw') st.ptJar = String(p.id || '').startsWith('jar:') ? String(p.id).slice(4) : null;   // S76
    const w = Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x, z: p.z } : null;
    if (p.why === 'tap' || p.why === 'hold') { const c = cards.get(p.hint); if (p.act && p.why === 'tap' && retired(c)) return; api.ask(p.hint, w); }   // a tap that also acts: card only until maxShows
    else api.offer(p.hint, w, typeof p.text === 'string' ? p.text : null);
  }));
  st.offs.push(bus.on('curious:ping', (p) => { if (p && p.hint && cards.has(p.hint)) api.offer(p.hint, Number.isFinite(p.x) ? { x: p.x, z: p.z } : null, typeof p.text === 'string' ? p.text : null); }));   // S59-H: p.text = one-off line (jar reminders)
  const byDone = new Map();
  for (const c of cards.values()) { if (!c.doneOn) continue; if (!byDone.has(c.doneOn)) byDone.set(c.doneOn, []); byDone.get(c.doneOn).push(c); }
  for (const [ev, list] of byDone) st.offs.push(bus.on(ev, (p) => { for (const c of list) if (matches(c.doneMatch, p)) retire(c.id); }));
  // S59 FOLLOW: a card leaves when the player did what it says. `follow: [{on, match}]` in data/tutor.json (soft: just closes it) · `doneOn` (retires it) ·
  //   verb cards close when the chain moves on. Moving, tapping the ground or pressing keys NEVER closes a card any more (user report).
  const byFollow = new Map();
  for (const c of cards.values()) for (const f of Array.isArray(c.follow) ? c.follow : []) { if (!f || !f.on) continue; if (!byFollow.has(f.on)) byFollow.set(f.on, []); byFollow.get(f.on).push({ id: c.id, match: f.match }); }
  for (const [ev, list] of byFollow) st.offs.push(bus.on(ev, (p) => { if (!st.cur || (p && p.silent)) return; for (const f of list) if (f.id === st.cur.id && matches(f.match, p)) { api.dismiss('followed'); return; } }));
  st.offs.push(bus.on('tut:step', (p) => { if (p && st.pendingVerb && st.pendingVerb !== 'verb:' + p.id) st.pendingVerb = null; if (st.cur && isVerb(st.cur) && p && st.cur.id !== 'verb:' + p.id) api.dismiss('followed'); }));
  for (const n of ['tut:done', 'tut:skip']) st.offs.push(bus.on(n, () => { st.pendingVerb = null; if (st.cur && isVerb(st.cur)) api.dismiss('followed'); }));
  // tap any [data-guide] HUD thing → its card (T2.6); the tap itself still works. Every OTHER gesture is ignored on purpose.
  const guideOf = (e) => { let n = e && e.target; for (let i = 0; n && i < 8; i++, n = n.parentNode) { const g = n.dataset && n.dataset.guide; if (g) return g; if (n.getAttribute && n.getAttribute('data-guide')) return n.getAttribute('data-guide'); } return null; };
  const gesture = (e) => { if (e && e.type === 'pointerdown') { const g = guideOf(e); if (g && cards.has(g)) api.ask(g); } };
  let offDom = () => {};
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pointerdown', gesture, true);
    offDom = () => { window.removeEventListener('pointerdown', gesture, true); };
  }
  st.offs.push(bus.on('game:title', () => { api.dismiss('title'); st.pendingVerb = null; st.active = false; }));
  st.offs.push(bus.on('game:start', () => { st.active = true; st.lull = 0; }));
  st.offs.push(bus.on('game:resumed', () => { st.active = true; st.lull = 0; }));
  for (const n of ['ui:ledger:open', 'ui:dialogue:open', 'ui:seasons:open', 'ui:title:open', 'eco:win', 'eco:lose', 'cine:begin']) st.offs.push(bus.on(n, () => api.dismiss('modal')));   // S59-A: 'cine:begin' = a cinematic starting closes the card too
  return api;
}

export default mountTutor;
