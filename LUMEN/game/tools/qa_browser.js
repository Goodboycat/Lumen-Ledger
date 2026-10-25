// LUMEN LEDGER — in-page QA scenarios (S27, 2026-10-24). Loaded by index.html when the URL has ?qa=<scenario>.
// Prints "[qa] …" console lines; read them with PlaywrightConsoleCapture (capture_duration 20–30 s). No Playwright install needed.
//   ?qa=upgrade   stall upgrade: level, visual parts, sales multiplier, 2nd stall of same type keeps the first one's level
//   ?qa=pause     pause menu: RESTART SEASON (two taps) → game restarts at the season checkpoint · TITLE (two taps) → title screen
//   ?qa=speed     time speed toggle (lg.setSpeed / HUD ⏩) really scales game.time
//   ?qa=knock     sword hit knocks a Collector back
//   ?qa=all       every scenario in sequence
// Recommended URL: index.html?notutorial&mute&nohistory&nocine&autoplay&season=150&seed=1&qa=all
const log = (...a) => console.log('[qa]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (name, cond, extra = '') => { log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' · ' + extra : '')); return !!cond; };

async function waitFor(fn, ms = 20000, step = 100) { const t0 = performance.now(); while (performance.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch {} await sleep(step); } return null; }
async function closeDialogues(ui) { for (let i = 0; i < 60; i++) { if (!ui.dialogue?.isOpen) return; try { ui.dialogue.advance?.(); ui.dialogue.skip?.(); } catch {} await sleep(120); } }
const stalls = (sb) => [...sb.build.placed.values()].filter((e) => e.id.startsWith('stall_')).map((e) => ({ id: e.id, lvl: e.level, ud: e.group.userData.level, parts: e.group.userData.body?.getObjectByName('levelParts')?.children.length, cost: e.cost, cx: e.cx, cz: e.cz }));
const clickBtn = (sel, re) => { const b = [...document.querySelectorAll(sel)].find((x) => !re || re.test(x.textContent)); if (b) b.click(); return !!b; };

async function ready(ctx) {
  const { lg, ui } = ctx;
  await waitFor(() => lg.sb && lg.state === 'playing', 30000);
  await sleep(500);
  await closeDialogues(ui);
  return lg.sb;
}

export async function qaUpgrade(ctx) {
  const { lg, ui } = ctx; const sb = await ready(ctx); if (!sb) return ok('upgrade: game ready', false);
  sb.eco.state.spark = 2000; lg.bus.emit('eco:spark', { spark: 2000, delta: 0, reason: 'qa' });
  const before = stalls(sb); log('stalls before', JSON.stringify(before));
  const first = [...sb.build.placed.values()].find((e) => e.id.startsWith('stall_')); const id = first.id;
  ui.build.open(); ui.build.select(id); await sleep(300);
  const btns = [...document.querySelectorAll('.ll-build-detail button')].map((x) => x.textContent.trim() + (x.disabled ? '(dis)' : ''));
  log('detail buttons', JSON.stringify(btns));
  clickBtn('.ll-build-detail button', /Upgrade/i); await sleep(1200);
  const after = stalls(sb).find((s) => s.cx === first.cx && s.cz === first.cz);
  ok('upgrade: entry level 1→2', after && after.lvl === 2, JSON.stringify(after));
  ok('upgrade: visual level parts changed (userData.level 2)', after && after.ud === 2);
  const l1 = [], l2 = []; for (let i = 0; i < 200; i++) { l1.push(sb.eco.sell(id, 'regular', undefined, { level: 1 }).sold); l2.push(sb.eco.sell(id, 'regular', undefined, { level: 2 }).sold); }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  ok('upgrade: L2 sells more units than L1', avg(l2) > avg(l1) * 1.2, `L1 ${avg(l1).toFixed(2)} L2 ${avg(l2).toFixed(2)}`);
  const upTxt = [...document.querySelectorAll('.ll-build-detail button')].map((x) => x.textContent.trim()).find((t) => /Upgrade|max/i.test(t));
  log('detail upgrade label now', upTxt);
  // second stall of the same type
  let placed = null; for (let x = -7; x <= 7 && !placed; x++) for (let z = -7; z <= 7 && !placed; z++) if (sb.build.canPlace(id, x, z, 0)) placed = sb.build.place(id, x, z, 0, { animate: false });
  await sleep(400);
  const both = stalls(sb).filter((s) => s.id === id);
  ok('upgrade: 2nd stall placed', both.length >= 2, JSON.stringify(both));
  const firstNow = both.find((s) => s.cx === first.cx && s.cz === first.cz);
  ok('upgrade: first stall keeps L2 after a 2nd of the same type', firstNow && firstNow.lvl === 2 && firstNow.ud === 2);
  const lbl = [...document.querySelectorAll('.ll-build-detail button')].map((x) => x.textContent.trim()).find((t) => /Upgrade/i.test(t));
  log('detail upgrade label with 2 stalls (expected: lowest = L1→2)', lbl);
  const badge = document.querySelector(`.ll-card[data-id="${id}"] .ll-card-count`)?.textContent;
  log('card badge', badge, 'card levels', document.querySelector(`.ll-card[data-id="${id}"] .ll-card-lv`)?.textContent);
  ui.build.close();
}

export async function qaPause(ctx) {
  const { lg, ui } = ctx; const sb = await ready(ctx); if (!sb) return ok('pause: game ready', false);
  const season0 = sb.eco.state.season; const spark0 = sb.eco.state.spark;
  sb.eco.state.spark = spark0 + 777;
  ui.pause.open('menu'); await sleep(300);
  ok('pause: menu open + game paused', ui.pause.isOpen && ctx.game.paused);
  const restart = ui.pause.buttons.restart; restart.click(); await sleep(150);
  ok('pause: first tap arms SURE?', /SURE/i.test(restart.textContent), restart.textContent.trim());
  restart.click(); await sleep(1500);
  ok('pause: restart → menu closed', !ui.pause.isOpen);
  ok('pause: restart → playing again', lg.state === 'playing' && !!lg.sb, 'state=' + lg.state + ' paused=' + ctx.game.paused);
  ok('pause: restart → same season, spark reset to checkpoint', lg.sb && lg.sb.eco.state.season === season0 && lg.sb.eco.state.spark !== spark0 + 777, JSON.stringify({ season: lg.sb?.eco.state.season, spark: lg.sb?.eco.state.spark }));
  ok('pause: restart → not paused by a stale reason', !ctx.game.paused || ui.dialogue?.isOpen, 'pauseBy=' + JSON.stringify([...lg.pauseBy]));
  await closeDialogues(ui);
  ui.pause.open('menu'); await sleep(300);
  const title = ui.pause.buttons.title; title.click(); await sleep(150); title.click(); await sleep(1500);
  ok('pause: TITLE → title screen open', ui.title?.isOpen && lg.state === 'title', 'state=' + lg.state);
  ok('pause: TITLE → sandbox torn down', !lg.sb);
  // continue again so later scenarios have a game
  lg.bus.emit('ui:start', { mode: 'story' }); await sleep(800);
  ok('pause: PLAY again works after TITLE', !!(await waitFor(() => lg.sb && lg.state === 'playing', 15000)));
}

export async function qaSpeed(ctx) {
  const { lg, game } = ctx; const sb = await ready(ctx); if (!sb) return ok('speed: game ready', false);
  if (typeof lg.setSpeed !== 'function') return ok('speed: lg.setSpeed exists', false);
  const btn = document.querySelector('.ll-speed'); ok('speed: HUD ⏩ button present', !!btn);
  lg.setSpeed(1); const t0 = game.time, d0 = sb.eco.state.day01; await sleep(1000); const dt1 = game.time - t0, dd1 = sb.eco.state.day01 - d0;
  lg.setSpeed(3); const t1 = game.time, d1 = sb.eco.state.day01; await sleep(1000); const dt3 = game.time - t1, dd3 = sb.eco.state.day01 - d1;
  ok('speed: 3× advances game.time ~3× faster', dt3 > dt1 * 2.2, `1×: ${dt1.toFixed(2)} s · 3×: ${dt3.toFixed(2)} s`);
  ok('speed: 3× advances the season clock faster', dd3 > dd1 * 2.2, `1×: ${dd1.toFixed(4)} · 3×: ${dd3.toFixed(4)}`);
  if (btn) { lg.setSpeed(1); btn.click(); await sleep(50); ok('speed: HUD button cycles speed', lg.speed !== 1, 'speed=' + lg.speed); }
  lg.setSpeed(1);
  ok('speed: back to 1×', lg.speed === 1 && Math.abs(game.timeScale - 1) < 1e-6, 'timeScale=' + game.timeScale);
}

export async function qaKnock(ctx) {
  const { lg } = ctx; const sb = await ready(ctx); if (!sb) return ok('knock: game ready', false);
  const en = sb.enemies; if (!en) return ok('knock: enemy system present', false);
  const hero = sb.hero; const hp = hero.root.position;
  const e = en.spawn ? en.spawn('collector', { x: hp.x + 1.0, z: hp.z }) : null;
  if (!e) return ok('knock: spawn collector', false, Object.keys(en).join(','));
  await sleep(100);
  const d0 = e.pos ? Math.hypot(e.pos.x - hp.x, e.pos.z - hp.z) : Math.hypot(e.g.position.x - hp.x, e.g.position.z - hp.z);
  hero.setDir?.(0); hero.doAttack?.(); await sleep(450);
  const p = e.pos || e.g.position; const d1 = Math.hypot(p.x - hp.x, p.z - hp.z);
  ok('knock: collector pushed away by the sword', d1 > d0 + 0.5, `before ${d0.toFixed(2)} after ${d1.toFixed(2)} state=${e.state}`);
}

export async function runQA(name, ctx) {
  const errs = []; window.addEventListener('error', (e) => errs.push(e.message));
  log('start', name, location.search);
  const all = { upgrade: qaUpgrade, pause: qaPause, speed: qaSpeed, knock: qaKnock };
  const list = name === 'all' ? Object.keys(all) : name.split(',');
  for (const n of list) { if (!all[n]) { log('unknown scenario', n); continue; } log('--- ' + n); try { await all[n](ctx); } catch (e) { ok(n + ': no exception', false, String(e?.stack || e)); } }
  log('done', name, 'page errors:', errs.length, JSON.stringify(errs.slice(0, 5)));
}
