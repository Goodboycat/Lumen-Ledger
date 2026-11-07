// S62-A rig: placing ANY item ends the placing mode (jar, decor). Phone landscape.  node tools/play_s62.mjs [W H]   (server :3000)
import { createRequire } from 'node:module';
const require = createRequire(new URL('./node_modules/', import.meta.url).href);
const { chromium } = require('playwright');
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `tools/shots/s62_${W}x${H}_${n}.png` }); const out = { viewport: [W, H] };
await p.goto('http://localhost:3000/index.html?touch=1&nocine&debug=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.lg && window.ui, null, { timeout: 60000 });
await p.evaluate(() => ui.title.buttons.story.click()); await p.waitForTimeout(3500);
for (let i = 0; i < 14; i++) { if (!(await p.evaluate(() => ui.dialogue.isOpen))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
await p.evaluate(() => { lg.bus.emit('tut:skip', {}); ui.tutor.dismiss?.('followed'); lg.debug?.grant?.(500); lg.debug?.unlockJar?.('save'); });
await p.waitForTimeout(900);
const st = () => p.evaluate(() => ({ mode: lg.sb.build.mode, ghost: !!lg.sb.build.ghost, uiPlacing: document.querySelector('.ll-build')?.classList.contains('placing') ?? null, placeBtnVisible: (() => { const e = document.querySelector('.ll-build-ok, .ll-place-ok'); return e ? getComputedStyle(e).display !== 'none' : null; })() }));
async function placeOne(id, label) {
  await p.evaluate(() => ui.build.open()); await p.waitForTimeout(500);
  await p.evaluate((id) => { ui.build.select?.(id); ui.build.deploy(id); }, id); await p.waitForTimeout(500);
  out[label + '_armed'] = await st(); await shot(label + '_armed');
  const r = await p.evaluate(() => { const g = lg.sb.build.ghost; const e = lg.sb.build.confirm(); return { placed: !!e, id: e?.id, spark: lg.sb.eco.state.spark }; });
  out[label + '_confirm'] = r; await p.waitForTimeout(700);
  out[label + '_after'] = await st(); await shot(label + '_after');
  // a second confirm must NOT do anything now (nothing armed)
  out[label + '_secondConfirm'] = await p.evaluate(() => { const n = lg.sb.build.placed.size; lg.sb.build.confirm(); return { added: lg.sb.build.placed.size - n }; });
  // a tap on the ground must not arm/place anything either
  await p.evaluate(() => { const hp = lg.sb.hero.root.position; lg.sb.build.moveTo?.(hp.x + 3, hp.z + 3); }); await p.waitForTimeout(300);
  out[label + '_afterMove'] = await st();
}
await placeOne('jar_save', 'jar');
const decor = await p.evaluate(() => Object.entries(lg.sb.build.catalog).filter(([, e]) => e && (e.category === 'decor' || e.category === 'nature') && !String(e.id || '').startsWith('jar_') && e.cost <= 30).map(([id]) => id).slice(0, 3));
out.decorIds = decor;
if (decor[0]) await placeOne(decor[0], 'decor');
out.errors = errs.slice(0, 6); console.log(JSON.stringify(out, null, 1)); await b.close();
