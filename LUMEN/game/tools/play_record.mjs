// tools/play_record.mjs — play the real game in headless Chromium for N seconds with the invisible recorder on, then save
// the recording (webm + timeline JSON) and a bug-hint summary. 0 credits (no screenshots, no AI calls).
//   cd LUMEN/game && python3 -m http.server 3000 &   (or any static server)
//   NODE_PATH=tools/node_modules node tools/play_record.mjs [seconds=120] [url=http://localhost:3000/] [outDir=../../LUMEN_extras/recordings]
// Skips the tutorial (?notutorial), clicks PLAY, clears the opening dialogue, THEN starts the recorder, plays (walk, hammer,
// build stalls via the tray, jars APPLY, pay the Baron, abilities, answers choices, continues ledgers), pauses the recorder, dumps.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SECS = +(process.argv[2] || 120);
const BASE = process.argv[3] || 'http://localhost:3000/';
const OUT = path.resolve(process.argv[4] || new URL('../../../LUMEN_extras/recordings', import.meta.url).pathname);
fs.mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const R = { url: BASE + '?notutorial&mute&season=' + (process.env.SEASON || 15) + '&seed=7', secs: SECS, errors: [], console: [], actions: [], hints: [] };
const hint = (id, s) => { R.hints.push({ id, s }); console.log('HINT', id, s); };

const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
p.on('pageerror', (e) => R.errors.push(e.message + ' @' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') R.console.push(m.type() + ': ' + m.text().slice(0, 240)); });
const act = (s) => { R.actions.push(s); };

const modal = () => p.evaluate(() => ({
  tut: !!ui.tutorial?.isOpen, dlg: !!ui.dialogue?.isOpen, ledger: !!ui.ledger?.isOpen, pause: !!ui.pause?.isOpen, seasons: !!ui.seasons?.isOpen, title: !!ui.title?.isOpen,
  choices: [...document.querySelectorAll('.ll-dlg-choice')].filter((e) => e.offsetParent).map((e) => e.innerText.trim()),
  state: lg.state,
}));
async function clearModals(maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const m = await modal();
    if (m.tut) { await p.evaluate(() => ui.tutorial.close('qa')); act('tutorial closed'); continue; }
    if (m.choices.length) {
      // play like a careful kid: pick the "question" option (refuse scams), else the first
      const idx = m.choices.findIndex((t) => /\?|not a plan|open the box|no thanks|refuse|read/i.test(t));
      const pick = idx < 0 ? 0 : idx; act('choice ' + JSON.stringify(m.choices) + ' → ' + pick);
      await p.locator('.ll-dlg-choice').nth(pick).click({ timeout: 1500 }).catch(() => p.evaluate((i) => ui.dialogue.choose?.(i), pick));
      await p.waitForTimeout(150); continue;
    }
    if (m.dlg) { await p.keyboard.press('Enter'); await p.waitForTimeout(120); continue; }
    if (m.ledger) { act('ledger continue'); await p.locator('.ll-ledger-continue').click({ timeout: 1500 }).catch(() => p.evaluate(() => ui.ledger.continue?.())); await p.waitForTimeout(250); continue; }
    if (m.seasons) { await p.keyboard.press('Escape'); await p.waitForTimeout(120); continue; }
    if (m.pause) { await p.keyboard.press('Escape'); await p.waitForTimeout(120); continue; }
    return m;
  }
  hint('STUCK', 'modal loop did not clear in ' + maxSteps + ' steps: ' + JSON.stringify(await modal()));
  return modal();
}
const snap = () => p.evaluate(() => { const e = lg.sb?.eco?.state; return { st: lg.state, paused: game.paused, fps: game.stats.fps, S: e?.season, spark: e?.spark, debt: e?.debt, fog: e?.fog01, stalls: e?.stalls, jars: e && { ...e.jars }, placed: lg.sb ? lg.sb.build.placed.size : 0, hud: document.querySelector('.ll-hud')?.innerText.replace(/\s+/g, ' ').slice(0, 140) }; });

// build a stall through the real tray + a mouse click on a free cell
async function buildStall(id) {
  const ok = await p.evaluate(() => !ui.isModal() && !ui.build.isOpen);
  if (!ok) return 'skip';
  await p.keyboard.press('KeyB'); await p.waitForTimeout(300);
  const card = p.locator(`.ll-card[data-id="${id}"]`);
  if (!(await card.count())) { await p.keyboard.press('Escape'); return 'no card ' + id; }
  const cardTxt = (await card.innerText().catch(() => '')).replace(/\s+/g, ' ');
  await card.click({ timeout: 2500, force: true }).catch((e) => act('card click fail ' + e.message.slice(0, 60))); await p.waitForTimeout(250);
  const dep = p.locator('.ll-build-detail .ll-btn.deploy');
  if (!(await dep.count()) || !(await dep.isVisible().catch(() => false)) || await dep.isDisabled().catch(() => true)) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); return 'cannot deploy ' + cardTxt; }
  const before = await snap();
  await dep.click({ timeout: 2500, force: true }).catch((e) => act('deploy click fail ' + e.message.slice(0, 60))); await p.waitForTimeout(250);
  const sp = await p.evaluate((id) => {
    const bd = lg.sb.build, h = lg.sb.hero?.root?.position || { x: 0, z: 0 };
    for (let r = 1; r < 8; r++) for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
      const cx = Math.round(h.x) + x, cz = Math.round(h.z) + z;
      if (bd.canPlace(id, cx, cz)) { const w = bd.anchorToWorld(id, cx, cz); const v = game.camera.three.position.clone().set(w.x, 0, w.z).project(game.camera.three); const rc = game.renderer.domElement.getBoundingClientRect();
        const sx = rc.left + (v.x + 1) / 2 * rc.width, sy = rc.top + (1 - v.y) / 2 * rc.height; if (sx > 20 && sy > 60 && sx < rc.width - 20 && sy < rc.height - 60) return { x: sx, y: sy, cx, cz }; }
    }
    return null;
  }, id);
  if (!sp) { await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); return 'no free on-screen cell for ' + id; }
  await p.mouse.move(sp.x, sp.y, { steps: 3 }); await p.waitForTimeout(150); await p.mouse.click(sp.x, sp.y); await p.waitForTimeout(350);
  const after = await snap();
  if (await p.evaluate(() => ui.build.isOpen)) await p.keyboard.press('Escape');
  if (await p.evaluate(() => lg.sb?.build.mode === 'place')) { hint('PLACE-STUCK', 'build mode still "place" after placing ' + id + ' and Esc'); await p.keyboard.press('Escape'); }
  return `${id} placed=${after.placed - before.placed} spark ${before.spark}→${after.spark} card="${cardTxt.slice(0, 60)}"`;
}

try {
  await p.goto(R.url, { timeout: 120000 });
  await p.waitForFunction(() => window.lg && window.ui && window.lumenRec, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  await p.locator('.ll-title-btn.play').click({ timeout: 5000 });
  await p.waitForTimeout(800);
  await clearModals(80);                                   // tutorial skipped by flag; opening story lines
  R.start = await snap();
  await p.evaluate(() => window.lumenRec.start());
  act('REC start');
  const t0 = Date.now(); let k = 0; const dirs = ['KeyD', 'KeyS', 'KeyA', 'KeyW', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'];
  const plan = ['stall_fruit', 'stall_tea', 'stall_fruit', 'stall_bakery', 'stall_toy'];
  R.timeline = [];
  while (Date.now() - t0 < SECS * 1000) {
    await clearModals();
    const s = await snap();
    if (s.st === 'title' || s.st === 'ending') { act('run ended: ' + s.st); if (s.st === 'title') { await p.locator('.ll-title-btn.play').click().catch(() => {}); await p.waitForTimeout(600); } continue; }
    // walk (hold) + hammer
    const d = dirs[k % dirs.length]; await p.keyboard.down(d); await p.waitForTimeout(450); await p.keyboard.up(d);
    await p.keyboard.press('Space'); await p.keyboard.press('KeyE');
    if (k % 4 === 1) act('build: ' + await buildStall(plan[(k >> 2) % plan.length]));
    if (k % 6 === 3) { const ap = p.locator('.ll-jars-foot .ll-btn:not(.alt)'); if (await ap.count()) { const b4 = await snap(); const dis = await ap.first().isDisabled().catch(() => true); if (dis) { await p.locator('.ll-jars-foot .ll-btn.alt').click({ timeout: 1000, force: true }).catch(() => {}); } await ap.first().click({ timeout: 1000, force: true }).catch(() => {}); await p.waitForTimeout(150); const a = await snap(); act(`jars APPLY (wasDisabled=${dis}) spark ${b4.spark}→${a.spark} jars ${JSON.stringify(a.jars)}`); } }
    if (k % 5 === 4) { const pay = p.locator('.ll-jars .ll-btn.repay'); if (await pay.count() && !(await pay.first().isDisabled().catch(() => true))) { const b4 = await snap(); await pay.first().click({ timeout: 1000 }).catch(() => {}); await p.waitForTimeout(200); const a = await snap(); act(`pay baron debt ${b4.debt}→${a.debt} spark ${b4.spark}→${a.spark}`); } }
    if (k % 5 === 2) { const ab = ['KeyQ', 'KeyR', 'KeyF', 'KeyG'][(k / 5 | 0) % 4]; await p.keyboard.press(ab); act('ability ' + ab); }
    if (k % 10 === 0) R.timeline.push({ t: Math.round((Date.now() - t0) / 1000), ...s });
    k++;
  }
  await p.evaluate(() => window.lumenRec.pause());
  act('REC pause');
  R.end = await snap();
  const dump = await p.evaluate(() => window.lumenRec.dump());
  const base = path.join(OUT, `play_${stamp}`);
  if (dump.videoB64) fs.writeFileSync(base + '.webm', Buffer.from(dump.videoB64, 'base64'));
  fs.writeFileSync(base + '.timeline.json', JSON.stringify(dump.log));
  R.video = dump.videoB64 ? base + '.webm' : null; R.recErrors = dump.log.errors; R.recCounts = dump.log.counts; R.activeMs = dump.log.activeMs;
  // automatic hints from the recording
  const fpsAvg = dump.log.samples.reduce((a, s) => a + (s.fps || 0), 0) / Math.max(1, dump.log.samples.length);
  R.fpsAvg = +fpsAvg.toFixed(1);
  if (R.errors.length) hint('PAGEERROR', R.errors.slice(0, 5).join(' | '));
} catch (e) { R.harnessError = String(e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(path.join(OUT, `play_${stamp}.report.json`), JSON.stringify(R, null, 2));
  console.log(JSON.stringify({ video: R.video, activeMs: R.activeMs, fpsAvg: R.fpsAvg, errors: R.errors.length, hints: R.hints.length, start: R.start, end: R.end }, null, 1));
  await b.close();
}
