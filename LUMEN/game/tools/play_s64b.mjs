// S64-B rig: cloud hand on the Jars tab / jars / withdraw arrows (phone landscape).  node tools/play_s64b.mjs [W H]   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errs = []; const out = {};
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s64b_${W}_${n}.png` });
await p.goto('http://localhost:3000/index.html?touch=1&nocine&debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 90000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3000);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.evaluate(() => { ui.dialogue.skip(); ui.dialogue.advance(); }); await p.waitForTimeout(300); }
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss('followed'); lg.debug?.unlockJar?.('save'); lg.debug?.unlockJar?.('protect'); }); await p.waitForTimeout(1200);
// where is the hand vs the thing it should touch? sel = CSS of the target (or null for world targets)
const hand = (label, sel) => p.evaluate(([label, sel]) => { const h = document.querySelector('.ll-tutor-hand'); const hb = h.getBoundingClientRect(); const t = sel ? [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) : null; const tb = t ? t.getBoundingClientRect() : null;
  return { label, cur: ui.tutor.current, shown: h.classList.contains('show'), flip: h.classList.contains('flip'), handX: Math.round(hb.x + hb.width / 2), handY: Math.round(hb.y), target: tb ? { cx: Math.round(tb.x + tb.width / 2), top: Math.round(tb.y), bottom: Math.round(tb.bottom) } : null, dx: tb ? Math.round(hb.x + hb.width / 2 - (tb.x + tb.width / 2)) : null }; }, [label, sel]);
const card = (id, text) => p.evaluate(([id, text]) => { ui.tutor.dismiss('followed'); lg.bus.emit('curious:ping', { id, hint: id, text }); return 1; }, [id, text]);
// 1. jar tab: tray closed -> hand on Build button ; tray open -> hand on Jars tab
await card('jar:add', 'Add your new jars: Build, Jars tab.'); await p.waitForTimeout(700); out.closedTray = await hand('jar:add tray closed -> Build button', '.ll-build-toggle'); await shot('1_jar_add_closed');
await p.evaluate(() => ui.build.open()); await p.waitForTimeout(900); out.openTray = await hand('jar:add tray open -> Jars tab', '.ll-build-tab[data-cat=jar]'); await shot('2_jar_add_open');
// 2. first coin card with NO jar built
await p.evaluate(() => ui.build.close()); await p.waitForTimeout(400);
await p.evaluate(() => { ui.tutor.dismiss('followed'); ui.tutor.counts && delete ui.tutor.counts['onFirstCoin']; lg.bus.emit('eco:spark', { reason: 'tip', spark: 5, delta: 1 }); }); await p.waitForTimeout(800);
out.firstCoin = await hand('onFirstCoin no jar yet', '.ll-build-toggle'); await shot('3_first_coin');
// 3. place a jar like play_s62 (moveTo near Pip + confirm), put coins in it, then the withdraw arrow
await p.evaluate(() => { ui.tutor.dismiss('followed'); lg.debug?.grant?.(500); ui.build.open(); ui.build.setCategory('jar'); ui.build.select('jar_save'); ui.build.deploy('jar_save'); }); await p.waitForTimeout(600);
out.placed = await p.evaluate(() => { const b = lg.sb.build, hp = lg.sb.hero.root.position; for (const [dx, dz] of [[3,0],[-3,0],[0,3],[0,-3],[4,4],[-4,4],[4,-4],[-4,-4],[6,0],[-6,0]]) { if (b.moveTo(hp.x + dx, hp.z + dz)) break; } const e = b.confirm(); return { placed: !!e, id: e?.id }; }); await p.waitForTimeout(900);
out.jars = await p.evaluate(() => lg.sb.jarsWorld.ids());
await p.evaluate(() => { const hp = lg.sb.hero.root.position, m = lg.sb.jarsWorld.get('save'); if (m) { hp.set(m.position.x + 3, 0, m.position.z); } lg.sb.eco.state.spark += 60; lg.sb.eco.state.jars.save = 30; lg.bus.emit('eco:jar', { jars: { ...lg.sb.eco.state.jars } }); }); await p.waitForTimeout(600);
out.save = await p.evaluate(() => ({ jars: lg.sb.eco.state.jars, rowsShown: ui.jars.shown(), panelCollapsed: ui.jars.el.classList.contains('collapsed'), hasBal: [...document.querySelectorAll('.ll-jar.has-bal')].length }));
await p.evaluate(() => { ui.jars.setCollapsed(true); ui.tutor.dismiss('followed'); lg.bus.emit('curious:ping', { id: 'jar:withdraw', hint: 'jar:withdraw' }); }); await p.waitForTimeout(900);
out.wdDebug = await p.evaluate(() => { const P = ui.jars.el, r = document.querySelector('.ll-jar.has-bal'), w = r && r.querySelector('.ll-jar-wd'); const cs = (e) => e ? { display: getComputedStyle(e).display, vis: getComputedStyle(e).visibility, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height), x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y) } : null; return { panelClass: P.className, panel: cs(P), row: cs(r), wd: cs(w), cur: ui.tutor.current, locked: r && r.className }; });
out.withdraw = await hand('jar:withdraw -> arrow', '.ll-jar.has-bal .ll-jar-wd'); await shot('4_withdraw');
// 4. a jar in the world
await p.evaluate(() => { ui.tutor.dismiss('followed'); lg.bus.emit('curious:ping', { id: 'jar:save', hint: 'jar:save' }); }); await p.waitForTimeout(800);
out.jarWorld = await hand('jar:save -> world jar', null); out.jarWorld.locate = await p.evaluate(() => lg.locate('jar:save')); await shot('5_jar_world');
// 5. rows of unbuilt jars: are they really hidden?
out.rowDisplay = await p.evaluate(() => [...document.querySelectorAll('.ll-jar')].map((r) => ({ k: r.className.split(' ')[1], hiddenAttr: r.hidden, display: getComputedStyle(r).display })));
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
