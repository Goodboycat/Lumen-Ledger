// QA run 2 — targeted probes (renderer disabled for speed; logic/UI DOM real). node targeted.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = new URL('./evidence/', import.meta.url).pathname;
const R = {};
const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
async function fresh(q = 'mute&notutorial&season=20&seed=2026') {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto('http://localhost:3000/game/?' + q, { timeout: 120000 });
  await p.waitForFunction(() => window.lg && window.ui); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__render = game.renderer.render; game.renderer.render = () => {}; localStorage.clear(); });
  return p;
}
const play = async (p) => { await p.locator('.ll-title-btn.play').click(); await p.waitForTimeout(400); await p.evaluate(() => { for (let i = 0; i < 60 && ui.dialogue.isOpen; i++) { ui.dialogue.skip(); const cs = ui.dialogue.line?.choices; if (cs?.length) ui.dialogue.choose(cs.length - 1); else ui.dialogue.advance(); } }); await p.waitForTimeout(300); };
const run = async (name, fn) => { try { R[name] = await fn(); } catch (e) { R[name] = { harnessError: String(e.stack || e) }; } console.log(name, JSON.stringify(R[name]).slice(0, 600)); fs.writeFileSync(OUT + 'targeted.json', JSON.stringify(R, null, 2)); };

// 1. Ledger numbers after the count-up finished, report vs. what the sheet shows
await run('ledgerValues', async () => {
  const p = await fresh(); await play(p);
  await p.evaluate(() => { lg.sb.eco.earn(50, 'qa'); });
  await p.evaluate(() => lg.sb.eco.endSeason());
  for (let i = 0; i < 30; i++) { await p.evaluate(() => { if (ui.dialogue.isOpen) { ui.dialogue.skip(); ui.dialogue.advance(); } }); if (await p.evaluate(() => ui.ledger.isOpen)) break; await p.waitForTimeout(200); }
  await p.waitForTimeout(4000);
  const o = await p.evaluate(() => ({ report: lg.lastReport, sheet: document.querySelector('.ll-ledger').innerText.replace(/\s+/g, ' ') }));
  await p.evaluate(() => { game.renderer.render = window.__render; }); await p.waitForTimeout(1500); await p.screenshot({ path: OUT + 't1-ledger-after-countup.png' });
  await p.close(); return { report: { income: o.report.income, expenses: o.report.expenses, interestPaid: o.report.interestPaid, upkeep: o.report.upkeep, fog01: o.report.fog01, fogDelta: o.report.fogDelta, debt: o.report.debt }, sheet: o.sheet.slice(0, 500) };
});

// 2. Loss reason text when the loss is by DEBT (fog low)
await run('loseReason', async () => {
  const p = await fresh(); await play(p);
  const o = await p.evaluate(() => { const e = lg.sb.eco; e.state.debt = 1100; e.state.fog01 = 0.1; let reason = null; game.bus.on('eco:lose', (x) => { reason = x.reason; }); e.endSeason(); return { reason, reportReason: lg.lastReport.reason ?? null }; });
  for (let i = 0; i < 40; i++) { await p.evaluate(() => { if (ui.dialogue.isOpen) { ui.dialogue.skip(); ui.dialogue.advance(); } }); if (await p.evaluate(() => ui.ledger.isOpen)) break; await p.waitForTimeout(200); }
  await p.waitForTimeout(1500);
  o.header = await p.evaluate(() => document.querySelector('.ll-ledger')?.innerText.split('\n').slice(0, 3).join(' | '));
  o.worldFogTarget = await p.evaluate(() => lg.sb.vfx.fog.targetCoverage);
  await p.close(); return o;
});

// 3. Jars APPLY with the untouched default preset
await run('jarsDefaultApply', async () => {
  const p = await fresh(); await play(p);
  const o = await p.evaluate(() => { const btn = [...document.querySelectorAll('.ll-jars-foot .ll-btn')].find((b) => /APPLY/.test(b.innerText)); return { applyDisabled: btn.disabled, pctShown: [...document.querySelectorAll('.ll-jar-pct')].map((e) => e.innerText) }; });
  // change one slider via real input then apply
  await p.locator('.ll-jar.save input[type=range]').fill('50').catch(() => {});
  await p.waitForTimeout(200);
  o.afterSlider = await p.evaluate(() => ({ disabled: [...document.querySelectorAll('.ll-jars-foot .ll-btn')].find((b) => /APPLY/.test(b.innerText)).disabled }));
  await p.locator('.ll-jars-foot .ll-btn', { hasText: 'APPLY' }).click().catch(() => {});
  await p.waitForTimeout(300);
  o.afterApply = await p.evaluate(() => ({ spark: lg.sb.eco.state.spark, jars: lg.sb.eco.state.jars }));
  // is there any way to get money back out?
  o.withdrawUi = await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText).filter((t) => /withdraw|take out|transfer|empty/i.test(t)));
  await p.close(); return o;
});

// 4. Fog Sweep (G) spam: fog vs debt
await run('fogSweepSpam', async () => {
  const p = await fresh(); await play(p);
  const before = await p.evaluate(() => ({ fog: lg.sb.eco.state.fog01, debt: lg.sb.eco.state.debt }));
  for (let i = 0; i < 8; i++) { await p.keyboard.press('KeyG'); await p.waitForTimeout(5300); }
  const after = await p.evaluate(() => ({ fog: lg.sb.eco.state.fog01, debt: lg.sb.eco.state.debt, gameTime: game.time }));
  await p.close(); return { before, after, note: '8 presses of G (cooldown 5 s), each -5% fog, no cost' };
});

// 5. Buttons usable on the title screen (behind the title card)
await run('titleScreenControls', async () => {
  const p = await fresh();
  const o = await p.evaluate(() => {
    const vis = [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { t: b.innerText.replace(/\s+/g, ' ').trim(), onTop: top === b || b.contains(top) }; });
    return vis;
  });
  await p.keyboard.press('KeyB'); await p.waitForTimeout(300);
  const trayOpenAtTitle = await p.evaluate(() => ui.build.isOpen);
  await p.close(); return { buttons: o, trayOpenAtTitleAfterB: trayOpenAtTitle };
});

// 6. Placement mode after Esc, with enough money: does a later click still buy?
await run('placeAfterEsc', async () => {
  const p = await fresh(); await play(p);
  await p.evaluate(() => { lg.sb.eco.earn(500, 'qa'); });
  await p.keyboard.press('KeyB'); await p.waitForTimeout(200);
  await p.locator('.ll-card[data-id="stall_flower"]').click(); await p.locator('.ll-build-detail .ll-btn.deploy').click();
  const tryClick = async () => { const c = await p.evaluate(() => { const b = lg.sb.build; for (let z = -6; z <= 6; z++) for (let x = -6; x <= 6; x++) if (b.canPlace('stall_flower', x, z)) { const w = b.anchorToWorld('stall_flower', x, z); const cam = game.camera.three; const v = cam.position.clone().set(w.x, 0, w.z).project(cam); const r = game.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; } return null; }); await p.mouse.move(c.x, c.y, { steps: 3 }); await p.waitForTimeout(150); await p.mouse.click(c.x, c.y); await p.waitForTimeout(300); };
  await tryClick();
  const a = await p.evaluate(() => ({ spark: lg.sb.eco.state.spark, n: lg.sb.build.placed.size, mode: lg.sb.build.mode, uiPlacing: ui.build.state.placing, trayOpen: ui.build.isOpen }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const b1 = await p.evaluate(() => ({ mode: lg.sb.build.mode, trayOpen: ui.build.isOpen }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const b2 = await p.evaluate(() => ({ mode: lg.sb.build.mode, trayOpen: ui.build.isOpen }));
  await tryClick();
  const c = await p.evaluate(() => ({ spark: lg.sb.eco.state.spark, n: lg.sb.build.placed.size, mode: lg.sb.build.mode, trayOpen: ui.build.isOpen }));
  await p.close(); return { afterFirstPlace: a, afterEsc1: b1, afterEsc2: b2, afterClickWithTrayClosed: c };
});

// 7. Repay: any UI? console-only economy.repay works?
await run('repay', async () => {
  const p = await fresh(); await play(p);
  const o = await p.evaluate(() => ({ uiControls: [...document.querySelectorAll('button,[role=button]')].map((b) => b.innerText).filter((t) => /repay|pay/i.test(t)), apiExists: typeof lg.sb.eco.repay, gameWired: Object.keys(lg).filter((k) => /repay|pay/i.test(k)) }));
  o.consoleRepay = await p.evaluate(() => { const e = lg.sb.eco; e.earn(400, 'qa'); const r = e.repay(400); return { repaid: r, debt: e.state.debt, spark: e.state.spark }; });
  // pause menu content
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  o.pauseMenu = await p.evaluate(() => document.querySelector('.ll-pause')?.innerText.replace(/\s+/g, ' ').slice(0, 300));
  await p.close(); return o;
});

// 8. Win path after debt repaid via console: is a legit win then reachable? also re-win in endless
await run('winPath', async () => {
  const p = await fresh(); await play(p);
  const o = await p.evaluate(() => { const e = lg.sb.eco; e.state.debt = 0; e.state.fog01 = 0; e.state.season = 10; let wins = 0; game.bus.on('eco:win', () => wins++); e.endSeason(); return { ended: e.state.ended, state: lg.state, wins }; });
  for (let i = 0; i < 60; i++) { await p.evaluate(() => { if (ui.dialogue.isOpen) { ui.dialogue.skip(); ui.dialogue.advance(); } }); if (await p.evaluate(() => ui.ledger.isOpen)) break; await p.waitForTimeout(200); }
  await p.waitForTimeout(1500);
  o.winSheet = await p.evaluate(() => document.querySelector('.ll-ledger')?.innerText.split('\n').slice(0, 4).join(' | '));
  await p.locator('.ll-ledger-continue').click().catch(() => p.evaluate(() => ui.ledger.continue()));
  await p.waitForTimeout(800);
  o.afterContinue = await p.evaluate(() => ({ state: lg.state, mode: lg.mode, endlessCfg: lg.sb?.eco.config.endless, winReq: lg.sb?.eco.config.winRequiresSeasons }));
  o.endlessSeason = await p.evaluate(() => { const e = lg.sb.eco; let wins = 0; game.bus.on('eco:win', () => wins++); e.endSeason(); return { ended: e.state.ended, state: lg.state, winsAgain: wins }; });
  await p.close(); return o;
});

// 9. Restart season from pause menu
await run('restartSeason', async () => {
  const p = await fresh(); await play(p);
  await p.evaluate(() => { const e = lg.sb.eco; e.state.season = 4; e.earn(300, 'qa'); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const label = await p.evaluate(() => [...document.querySelectorAll('.ll-pause button')].map((b) => b.innerText.replace(/\s+/g, ' ')).join(' | '));
  await p.locator('.ll-pause button', { hasText: /RESTART/i }).click().catch(() => {}); await p.waitForTimeout(300);
  const confirmTxt = await p.evaluate(() => document.querySelector('.ll-pause')?.innerText.replace(/\s+/g, ' ').slice(0, 300));
  await p.locator('.ll-pause button', { hasText: /RESTART|YES|CONFIRM/i }).first().click().catch(() => {}); await p.waitForTimeout(800);
  const after = await p.evaluate(() => ({ season: lg.sb?.eco.state.season, spark: lg.sb?.eco.state.spark, state: lg.state }));
  await p.close(); return { label, confirmTxt, after };
});

// 10. Restart from pause & lose->new run: stale HUD / badges / scene growth across 4 starts
await run('lifecycle4', async () => {
  const p = await fresh(); const rows = [];
  for (let i = 0; i < 4; i++) {
    await play(p);
    await p.evaluate(() => { lg.sb.eco.earn(200, 'qa'); });
    rows.push(await p.evaluate(() => ({ i: lg.stats.starts, scene: game.scene.children.length, systems: game.systems.length, vign: document.querySelectorAll('.vfx-vignette').length, counts: { ...ui.build.state.counts }, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null })));
    await p.evaluate(() => { const e = lg.sb.eco; e.state.debt = 1200; e.endSeason(); });
    for (let k = 0; k < 60; k++) { await p.evaluate(() => { if (ui.dialogue.isOpen) { ui.dialogue.skip(); ui.dialogue.advance(); } }); if (await p.evaluate(() => ui.ledger.isOpen)) break; await p.waitForTimeout(150); }
    await p.locator('.ll-ledger-continue').click().catch(() => p.evaluate(() => ui.ledger.continue()));
    await p.waitForTimeout(600);
    rows.push(await p.evaluate(() => ({ title: lg.state, scene: game.scene.children.length, systems: game.systems.length, hudBehindTitle: document.querySelector('.ll-hud')?.innerText.replace(/\s+/g, ' ').slice(0, 80) })));
  }
  await p.close(); return rows;
});

// 11. Story text vs actual numbers
await run('storyNumbers', async () => {
  const p = await fresh();
  const o = await p.evaluate(async () => { const s = await (await fetch('data/story.json')).json(); const lines = JSON.stringify(s).match(/[^"]*\d+ Spark[^"]*/g) || []; return lines.slice(0, 8); });
  await play(p); o.push('ACTUAL: ' + JSON.stringify(await p.evaluate(() => ({ spark: lg.sb.eco.state.spark, debt: lg.sb.eco.state.debt }))));
  await p.close(); return o;
});

// 12. Mobile viewport: build tray, jars panel overlap, HUD
await run('mobile', async () => {
  const p = await b.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  await p.goto('http://localhost:3000/game/?mute&notutorial&season=20&seed=2026', { timeout: 120000 }); await p.waitForFunction(() => window.lg); await p.waitForTimeout(1500);
  await p.locator('.ll-title-btn.play').tap(); await p.waitForTimeout(800);
  await p.evaluate(() => { for (let i = 0; i < 60 && ui.dialogue.isOpen; i++) { ui.dialogue.skip(); const cs = ui.dialogue.line?.choices; if (cs?.length) ui.dialogue.choose(cs.length - 1); else ui.dialogue.advance(); } });
  await p.waitForTimeout(2500); await p.screenshot({ path: OUT + 't12-mobile-play.png' });
  await p.evaluate(() => ui.build.open()); await p.waitForTimeout(1200); await p.screenshot({ path: OUT + 't12-mobile-build.png' });
  const o = await p.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { hud: r('.ll-hud'), jars: r('.ll-jars'), build: r('.ll-build-tray'), detail: r('.ll-build-detail'), overflowX: document.documentElement.scrollWidth > innerWidth }; });
  await p.close(); return o;
});

await b.close();
console.log('DONE');
