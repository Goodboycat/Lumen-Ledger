// Hero / ship screenshot harness. Run from game/ (bash tools/setup_browser.sh once):
//   NODE_PATH=tools/node_modules node tools/hero_shots.mjs [--attack]      close-up Pip inspection (bug-fix helper) → tools/shots/hero_*.png
//   NODE_PATH=tools/node_modules node tools/hero_shots.mjs --ship [n,n]    45A: the 6 itch.io ship shots (1280×720) from the REAL index.html
//       → LUMEN_extras/game/docs/screenshots/45_ship/{1_title,2_market,3_raid,4_jar,5_ledger,6_pier}.png + cover.png (630×500)
//       `--ship 2,3` shoots only those numbers. Each shot = one page.screenshot (budget: 6 + cover crop). Only window.game / sb() calls are
//       used to force a scene (ship rule 4: no system added while framing); every scene is reported as STATE lines so a reviewer can judge.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SHIP = process.argv.includes('--ship');
const port = SHIP ? 3127 : 3125;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];

if (SHIP) {
  const OUT = '../../LUMEN_extras/game/docs/screenshots/45_ship';
  mkdirSync(OUT, { recursive: true });
  const onlyArg = process.argv[process.argv.indexOf('--ship') + 1];
  const only = onlyArg && /^[\d,]+$/.test(onlyArg) ? new Set(onlyArg.split(',').map(Number)) : null;
  const want = (n) => !only || only.has(n);
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  const sleep = (ms) => p.waitForTimeout(ms);
  const shot = async (name) => { await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', `${OUT}/${name}.png`); };
  // boot: title screen stays up (no ui:start) so shot 1 can take it; ?debug=0 is a no-op key, kept per the prompt
  const boot = async (extra = '') => {
    await p.goto(`http://127.0.0.1:${port}/index.html?debug=0&mute&notutorial&nocine${extra}`, { waitUntil: 'load' });
    await sleep(2200);
  };
  // start a story run (same as PLAY) and return sb once it exists
  const start = async () => {
    await p.evaluate(async () => { window.game.bus.emit('ui:start', { mode: 'story' }); await new Promise((r) => setTimeout(r, 1200)); });
    return p.evaluate(() => !!window.sb());
  };
  // the intro dialogue (Tally-Owl) pauses the sim → click it through until no dialogue is open (max ~12 lines)
  const dismiss = async () => {
    for (let i = 0; i < 14; i++) {
      const open = await p.evaluate(() => { const d = window.ui?.dialogue; if (d?.isOpen) { d.advance?.(); return true; } const b = document.querySelector('.ll-dlg-body'); if (b && b.offsetParent) { b.click(); return true; } return false; });
      if (!open) break;
      await sleep(350);
    }
    await sleep(300);
  };
  const state = async (tag, fn) => { const s = await p.evaluate(fn); console.log('STATE', tag, JSON.stringify(s)); return s; };
  const hideTouch = () => p.evaluate(() => { for (const el of document.querySelectorAll('.ll-touch, .ll-pad, .touchpad')) el.style.display = 'none'; });

  // ── 1 title ──────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want(1)) {
    await boot('&title=1');
    await sleep(1500);
    await state('title', () => ({ titleOpen: !!(window.ui?.title?.isOpen), btns: document.querySelectorAll('.ll-title button, .ll-title [role=button]').length }));
    await shot('1_title');
  }

  // ── 2 market (S3: tea HOT, prices readable; ≥ 2 customers settled, ≥ 1 price bark) ─────────────────────────────
  if (want(2) || want(7)) {
    await boot('&season=600');
    await start(); await dismiss();
    await p.evaluate(() => { const sb = window.sb(); sb.eco.state.season = 3; window.game.bus.emit('eco:season', { season: 3 }); for (const pl of sb.build.placed.values()) if (pl.category === 'stall' && !pl.scenery) sb.signTint?.(pl.id); });
    let m = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      m = await p.evaluate(() => { const sb = window.sb(); const act = sb.cust.active.filter((c) => c.state !== 'pooled' && c.state !== 'despawn'); return { customers: act.length, settled: act.filter((c) => /browse|buy|queue|wait|shop|pay/.test(c.state)).length, barks: document.querySelectorAll('.ll-bark').length, priceBarks: document.querySelectorAll('.ll-bark.price').length, glyph: sb.demandGlyphOf?.('stall_tea') }; });
      if (m.settled >= 2 && m.priceBarks >= 1) break;
    }
    console.log('STATE market', JSON.stringify(m));
    await p.evaluate(() => { window.game.camera.zoom = 0.8; });
    await hideTouch(); await sleep(500);
    if (want(2)) await shot('2_market');
    // cover 630×500: crop of the same frame (no new art) — center-weighted on the market
    if (want(7) || !only) { await p.screenshot({ path: `${OUT}/cover.png`, clip: { x: 325, y: 110, width: 630, height: 500 } }); console.log('shot', `${OUT}/cover.png (630×500 crop)`); }
  }

  // ── 3 raid (2 distinct Collectors; wait for `carry` + red RAID chip + edge arrow) ───────────────────────────────
  if (want(3)) {
    await boot('&season=600');
    await start(); await dismiss();
    await sleep(9000);                                   // let a few sales land in the tills so the Collectors have something to seek
    await p.evaluate(() => { const sb = window.sb(); sb.eco.state.season = 2; sb.enemies.enabled = true; sb.enemies.waveSeason = null; sb.enemies.spawnWave(2, { raiders: 2, distinct: true, stagger: 1 }); });
    let r = null;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      r = await p.evaluate(() => { const sb = window.sb(); const chip = document.querySelector('.ll-raid-chip'), arrow = document.querySelector('.ll-raid-arrow'); return { states: sb.enemies.list.map((e) => e.state), carry: !!sb.enemies.list.find((e) => e.state === 'carry'), chip: chip && !chip.hidden ? chip.textContent : null, arrow: !!(arrow && !arrow.hidden) }; });
      if (r.carry) break;
    }
    console.log('STATE raid', JSON.stringify(r));
    await hideTouch(); await sleep(250);
    await shot('3_raid');
  }

  // ── 4 jar (Pip ≤ 1.3 u from the Protect jar → .ll-jar-tag visible) ─────────────────────────────────────────────
  if (want(4)) {
    await boot('&season=600');
    await start(); await dismiss();
    const j = await p.evaluate(async () => {
      const sb = window.sb(); const jar = sb.world?.jars?.find?.((m) => (m.userData?.jar || m.userData?.id || '').includes('protect')) || sb.world?.jars?.[3];
      if (!jar) return { jar: null };
      const wp = jar.getWorldPosition(jar.position.clone()); const h = sb.hero.root.position;
      h.set(wp.x + 1.0, h.y, wp.z + 0.6); sb.hero.vel?.set?.(0, 0, 0);
      await new Promise((r) => setTimeout(r, 1200));
      const tag = [...document.querySelectorAll('.ll-jar-tag')].find((t) => t.offsetParent !== null && getComputedStyle(t).opacity !== '0');
      return { jar: jar.userData?.jar || jar.userData?.id, near: sb.jarsWorld?.near?.() ?? sb.jars?.near?.() ?? null, dist: Math.hypot(h.x - wp.x, h.z - wp.z).toFixed(2), tag: tag?.textContent || null };
    });
    console.log('STATE jar', JSON.stringify(j));
    await p.evaluate(() => { window.game.camera.zoom = 0.65; });
    await hideTouch(); await sleep(600);
    await shot('4_jar');
  }

  // ── 5 ledger (eco.endSeason() → review modal) ──────────────────────────────────────────────────────────────────
  if (want(5)) {
    await boot('&season=600');
    await start(); await dismiss();
    await sleep(8000);                                   // a few sales so the ledger has rows
    await p.evaluate(() => { const sb = window.sb(); sb.eco.endSeason(); });
    await sleep(600); await dismiss();                   // story lines before the review → click through to the modal
    let l = null;
    for (let i = 0; i < 10; i++) { await sleep(800); l = await p.evaluate(() => ({ state: window.lg.state, modal: !!document.querySelector('.ll-ledger:not([hidden]), .ll-ledger.open, .ledger-modal'), text: (document.querySelector('.ll-ledger')?.textContent || '').slice(0, 80) })); if (l.modal || l.state === 'review') break; }
    console.log('STATE ledger', JSON.stringify(l));
    await shot('5_ledger');
  }

  // ── 6 pier (Baron waits at the pier; ≥ 10 s left on the countdown) ─────────────────────────────────────────────
  if (want(6)) {
    await boot('&season=600');
    await start(); await dismiss();
    await p.evaluate(() => { const sb = window.sb(); sb.eco.state.interestOwed = Math.max(sb.eco.state.interestOwed || 0, 6); sb.eco.state.debt = Math.max(sb.eco.state.debt || 0, 40); window.lg.enterPier?.() || sb.pier.begin({ force: true }); });
    let pz = null;
    for (let i = 0; i < 12; i++) {
      await sleep(700);
      pz = await p.evaluate(() => { const sb = window.sb(); return { state: window.lg.state, phase: sb.pier.phase, t: +(sb.pier.t || 0).toFixed(1), left: sb.pier.phase === 'wait' ? +(20 - sb.pier.t).toFixed(1) : null }; });
      if (pz.phase === 'wait' && pz.t > 0.8) break;
    }
    await dismiss();                                     // Baron's arrival line, if any
    await p.evaluate(() => { const sb = window.sb(); const g = window.game; const b = sb.pier; const to = b.to || b.pos; if (to) { g.camera.zoom = 0.7; } });
    console.log('STATE pier', JSON.stringify(pz));
    await hideTouch(); await sleep(400);
    await shot('6_pier');
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 8).join('\n') : 'errors: none');
  await b.close(); server.kill(); process.exit(0);
}

// ── legacy: close-up Pip inspection on demo_heromoves.html ────────────────────────────────────────────────────────
mkdirSync('tools/shots', { recursive: true });
const p = await b.newPage({ viewport: { width: 900, height: 900 } });
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://127.0.0.1:${port}/demo_heromoves.html`, { waitUntil: 'load' });
await p.waitForTimeout(1500);
// freeze the camera: override update to orbit around the hero
await p.evaluate(() => {
  const g = window.game; g.camera.offset.set(0, 0, 0);
  window.__setCam = (ax, ay, az, ty) => { g.camera.update = () => { const h = window.hero.root.position; g.camera.cam.position.set(h.x + ax, h.y + ay, h.z + az); g.camera.cam.lookAt(h.x, h.y + ty, h.z); }; };
  document.querySelectorAll('.panel,.hud,.help').forEach((e) => e.style.display = 'none');
});
const views = { front: [0, 1.4, 4.2, 1.0], side: [4.2, 1.4, 0, 1.0], back: [0, 1.4, -4.2, 1.0], top: [0, 5, 0.01, 0.8], iso: [3, 3.2, 3, 0.9],
  // close-ups of the sword arm (right) / left arm, framed on the torso — used to check the arms + sword clear the stomach
  armR_close: [1.5, 0.95, 2.2, 0.85], armL_close: [-1.5, 0.95, 2.2, 0.85], belly_low: [0.2, 0.55, 2.4, 0.8] };
const tag = process.argv.includes('--attack') ? 'attack' : 'rest';
for (const [n, v] of Object.entries(views)) {
  await p.evaluate((v) => window.__setCam(...v), v);
  if (tag === 'attack') { await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space'); await p.waitForTimeout(parseInt(process.env.ATK_MS || '330')); }
  else await p.waitForTimeout(250);
  await p.screenshot({ path: `tools/shots/hero_${tag}_${n}.png` });
  if (tag === 'attack') await p.waitForTimeout(900);
}
console.log(errors.length ? 'ERRORS: ' + errors.join('\n') : 'shots ok');
await b.close(); server.kill();
