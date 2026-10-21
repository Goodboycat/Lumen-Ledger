// QA run 2 (2026-10-21) — two consecutive runs in ONE tab, no reload, rendering ON, real clicks/keys where possible.
// Usage: node two_runs_real.mjs [baseUrl]   (needs playwright; game served at /game/)
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = new URL('./evidence/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const R = { started: new Date().toISOString(), url: BASE + '/game/?mute&season=25&seed=2026', errors: [], console: [], runs: [], notes: [] };
const note = (s) => { R.notes.push(s); console.log('NOTE', s); };
const save = () => fs.writeFileSync(OUT + 'two_runs_real.json', JSON.stringify(R, null, 2));

const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => R.errors.push(e.message + ' @' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') R.console.push(m.type() + ': ' + m.text().slice(0, 300)); });

const snap = (tag) => p.evaluate((tag) => {
  const sb = lg.sb, eco = sb?.eco;
  const vis = (sel) => [...document.querySelectorAll(sel)].map((e) => ({ op: e.style.opacity, bg: (e.style.background || e.style.boxShadow || '').slice(0, 60), inDom: e.isConnected }));
  return {
    tag, state: lg.state, mode: lg.mode, paused: game.paused, pauseBy: [...lg.pauseBy],
    eco: eco ? { spark: eco.state.spark, debt: eco.state.debt, fog01: eco.state.fog01, season: eco.state.season, stalls: eco.state.stalls, jars: { ...eco.state.jars }, ended: eco.state.ended, stallUpkeepExtra: eco.state.stallUpkeepExtra, owned: eco.state.owned } : null,
    placed: sb ? [...sb.build.placed.values()].map((e) => `${e.id}@${e.cx},${e.cz}L${e.level}`) : [],
    buildCounts: { ...ui.build.state.counts },
    buildPlacedById: Object.fromEntries([...ui.build.state.placedById].map(([k, m]) => [k, m.size])),
    placingUi: ui.build.state.placing, buildMode: sb?.build.mode,
    vignettes: vis('.vfx-vignette'), vfxDomNodes: document.querySelectorAll('[class^="vfx-"]').length,
    fogCoverage: sb?.vfx?.fog ? +(+sb.vfx.fog.coverage).toFixed(3) : null, fogTarget: sb?.vfx?.fog ? sb.vfx.fog.targetCoverage : null,
    hudDebt: document.querySelector('.ll-hud')?.innerText.replace(/\s+/g, ' ').slice(0, 160),
    sceneChildren: game.scene.children.length, systems: game.systems.length, save: lg.save.has(),
  };
}, tag);
const shot = async (n) => { await p.evaluate(() => { game.renderer.render = window.__render; }); await p.waitForTimeout(2500); await p.screenshot({ path: OUT + n + '.png' }); await p.evaluate(() => { game.renderer.render = () => {}; }); };
const visibleButtons = () => p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent && getComputedStyle(b).visibility !== 'hidden').map((b) => b.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean));

// screen point of a world cell (for real mouse placement)
const worldToScreen = (x, z) => p.evaluate(([x, z]) => { const cam = game.camera.three; const v = cam.position.clone(); v.set(x, 0, z).project(cam); const r = game.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, [x, z]);

// handle any modal using the real DOM: tutorial Next, dialogue choice (refuse) / next, ledger continue
async function handleModals(run, log) {
  for (let i = 0; i < 40; i++) {
    const m = await p.evaluate(() => {
      const vis = (s) => { const e = document.querySelector(s); return !!(e && e.offsetParent && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05); };
      return { tut: !!(ui.tutorial && ui.tutorial.isOpen), choice: [...document.querySelectorAll('.ll-dlg-choice')].filter((e) => e.offsetParent).map((e) => e.innerText), dlg: !!ui.dialogue.isOpen, ledger: !!ui.ledger.isOpen, outcome: ui.ledger.state?.outcome, ledgerTxt: ui.ledger.isOpen ? document.querySelector('.ll-ledger')?.innerText.replace(/\s+/g, ' ').slice(0, 400) : null };
    });
    if (m.tut) { if (i > 30) { await p.evaluate(() => ui.tutorial.close('qa')); continue; } await p.locator('.ll-tut-btn.next').click({ timeout: 2000 }).catch(() => p.evaluate(() => ui.tutorial?.next?.())); log.push('tutorial next'); await p.waitForTimeout(350); continue; }
    if (m.choice.length) { // refuse the Baron/collector: the non-greedy (question) option
      const idx = m.choice.findIndex((t) => /\?|not a plan|open the box/i.test(t)); const pick = idx < 0 ? m.choice.length - 1 : idx;
      log.push('CHOICE ' + JSON.stringify(m.choice) + ' -> ' + m.choice[pick]);
      await p.locator('.ll-dlg-choice').nth(pick).click({ timeout: 2000 }).catch(() => p.evaluate((i) => ui.dialogue.choose(i), pick));
      await p.waitForTimeout(250); continue;
    }
    if (m.dlg) { await p.locator('.ll-dlg').click({ timeout: 1500, position: { x: 40, y: 20 } }).catch(() => p.keyboard.press('Enter')); await p.waitForTimeout(160); continue; }
    if (m.ledger) {
      const s = await snap('ledger'); log.push({ ledger: m.outcome, text: m.ledgerTxt, eco: s.eco });
      return { ledger: true, outcome: m.outcome, snap: s };
    }
    return { ledger: false };
  }
  return { ledger: false, stuck: true };
}

async function playRun(n) {
  const run = { n, log: [], seasons: [] }; R.runs.push(run);
  await p.locator('.ll-title-btn.play').click();
  await p.waitForTimeout(1500);
  run.start = await snap('start'); await shot(`run${n}-01-start`);
  run.startButtons = await visibleButtons();
  // finish tutorial / opening dialogue
  await handleModals(run, run.log);
  run.afterIntro = await snap('afterIntro'); await shot(`run${n}-02-after-intro`);
  // look for any repay / pay debt control anywhere
  run.repayControls = await p.evaluate(() => [...document.querySelectorAll('button,[role=button],a')].map((e) => e.innerText).filter((t) => /repay|pay.*(debt|baron)|loan/i.test(t)));
  // open build tray (real key B), inspect, deploy a fruit stall, place with the mouse
  await p.keyboard.press('KeyB'); await p.waitForTimeout(600);
  run.buildOpen = await p.evaluate(() => [...document.querySelectorAll('.ll-card')].map((c) => `${c.dataset.id}:${c.querySelector('.ll-card-cost')?.innerText}:badge=${c.querySelector('.ll-card-count')?.innerText}${c.classList.contains('poor') ? ':poor' : ''}`));
  await shot(`run${n}-03-build-tray`);
  await p.locator('.ll-card[data-id="stall_fruit"]').click(); await p.waitForTimeout(300);
  run.fruitDetail = await p.evaluate(() => document.querySelector('.ll-build-detail')?.innerText.replace(/\s+/g, ' '));
  const sparkBefore = (await snap('x')).eco.spark;
  await p.locator('.ll-build-detail .ll-btn.deploy').click().catch((e) => run.log.push('deploy click failed ' + e.message));
  await p.waitForTimeout(400);
  // find a free cell near the plaza and click it with the mouse
  const cell = await p.evaluate(() => { const b = lg.sb.build; for (let r = 0; r < 7; r++) for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (b.canPlace('stall_fruit', x, z)) return { x, z, w: b.anchorToWorld('stall_fruit', x, z) }; return null; });
  if (cell) { const sp = await worldToScreen(cell.w.x, cell.w.z); await p.mouse.move(sp.x, sp.y, { steps: 5 }); await p.waitForTimeout(250); await p.mouse.click(sp.x, sp.y); await p.waitForTimeout(500); run.placeClickedAt = { cell, sp }; }
  run.afterPlace = await snap('afterPlace'); run.afterPlace.sparkBefore = sparkBefore;
  run.footText = await p.evaluate(() => document.querySelector('.ll-build-foot')?.innerText);
  await shot(`run${n}-04-after-place`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  run.afterEsc = await snap('afterEsc');
  if (n === 1) { // second click after Esc: does build mode still place another stall?
    const cell2 = await p.evaluate(() => { const b = lg.sb.build; for (let z = 3; z >= -6; z--) for (let x = 5; x >= -5; x--) if (b.canPlace('stall_fruit', x, z)) return { x, z, w: b.anchorToWorld('stall_fruit', x, z) }; return null; });
    if (cell2) { const sp = await worldToScreen(cell2.w.x, cell2.w.z); await p.mouse.click(sp.x, sp.y); await p.waitForTimeout(500); }
    run.afterEscClick = await snap('afterEscClick'); await shot(`run${n}-05-after-esc-click`);
  }
  if (await p.evaluate(() => ui.build.isOpen)) await p.keyboard.press('KeyB');
  // jars: real APPLY with the default preset
  const ap = p.locator('.ll-jars-foot .ll-btn', { hasText: 'APPLY' });
  run.jarsBefore = (await snap('j')).eco;
  if (await ap.count()) { await ap.click().catch(() => {}); await p.waitForTimeout(400); }
  run.jarsAfter = (await snap('j2')).eco;
  // play: walk around (WASD/arrows), use abilities with their keys, handle modals, until the run ends
  const keys = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
  const abil = ['KeyQ', 'KeyE', 'KeyF', 'KeyG', 'KeyR', 'KeyW'];
  let k = 0, lastSeason = 0, ended = false; const t0 = Date.now();
  while (Date.now() - t0 < 14 * 60 * 1000) {
    const key = keys[k % 4]; await p.keyboard.down(key); await p.waitForTimeout(500); await p.keyboard.up(key);
    await p.keyboard.press(abil[k % abil.length]); k++;
    const m = await handleModals(run, run.log);
    const s = await snap('tick');
    if (s.eco && s.eco.season !== lastSeason) { lastSeason = s.eco.season; run.seasons.push({ season: s.eco.season, spark: s.eco.spark, debt: s.eco.debt, fog: s.eco.fog01, stalls: s.eco.stalls, jars: s.eco.jars, cov: s.fogCoverage, vign: s.vignettes.map((v) => v.op) }); console.log('run', n, 'season', s.eco.season, 'debt', s.eco.debt, 'spark', s.eco.spark, 'fog', s.eco.fog01); save(); }
    if (m.ledger) {
      if (m.outcome === 'lose' || m.outcome === 'win' || (s.eco && s.eco.ended)) {
        run.end = m.snap; run.endOutcome = m.outcome; await shot(`run${n}-06-ending`);
        run.endButtons = await visibleButtons();
        await p.locator('.ll-ledger-continue').click().catch(() => p.evaluate(() => ui.ledger.continue()));
        await p.waitForTimeout(1200); ended = true; break;
      }
      if (lastSeason === 3) await shot(`run${n}-ledger-s2`);
      await p.locator('.ll-ledger-continue').click().catch(() => p.evaluate(() => ui.ledger.continue()));
      await p.waitForTimeout(400);
    }
  }
  run.ended = ended;
  run.afterReturn = await snap('afterReturn'); await shot(`run${n}-07-after-return`);
  run.titleButtons = await visibleButtons();
  save();
  return run;
}

try {
  await p.goto(R.url, { timeout: 120000 });
  await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__render = game.renderer.render; game.renderer.render = () => {}; });
  R.title = await snap('title'); await shot('title');
  for (let n = 1; n <= 2; n++) await playRun(n);
  // third PLAY only to observe state accumulation (no full run)
  await p.locator('.ll-title-btn.play').click(); await p.waitForTimeout(1500);
  R.thirdStart = await snap('thirdStart'); await shot('run3-start-only');
} catch (e) { R.harnessError = String(e.stack || e); console.error(e); }
finally { R.finished = new Date().toISOString(); save(); await b.close(); }
