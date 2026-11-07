// node tools/icons_shot.mjs bell stranger chat face_stranger face_stranger_happy ...   (server on :3000)
// The "screenshot" route of the icon pipeline: the procedural icons (ui/icons.js) are laid out SIDE BY SIDE on one page, real Chromium
// screenshots it (transparent background), and the screenshot is sliced back into one PNG per icon -> ui/icons/<name>.png.
// tools/icons_png.mjs (rsvg) bakes the whole set headless; this one proves the art reads in a real browser and is what ships for the new T4 icons.
import { createRequire } from 'node:module'; import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('./node_modules/', import.meta.url).href); const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), game = path.resolve(here, '..');
const names = process.argv.slice(2); if (!names.length) { console.log('usage: node tools/icons_shot.mjs <icon names...>'); process.exit(1); }
const CELL = 64, SCALE = 2, GAP = 8;   // 64 css px cells, shot at 2x then downsampled to 64 px PNGs (clean edges)
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: names.length * (CELL + GAP) + GAP, height: CELL + 2 * GAP }, deviceScaleFactor: SCALE });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/icons_gallery.html'); await p.waitForTimeout(300);
await p.evaluate(async (names) => {
  const { icon } = await import('/ui/icons.js'); document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:transparent;display:flex;gap:8px;padding:8px';
  for (const n of names) { const d = document.createElement('div'); d.style.cssText = 'width:64px;height:64px;flex:none'; d.innerHTML = icon(n).replace('class="ll-ico', 'style="width:64px;height:64px;display:block" class="ll-ico'); document.body.appendChild(d); }
}, names);
await p.waitForTimeout(300);
const out = path.join(game, 'tools', 'shots'); fs.mkdirSync(out, { recursive: true });
const sheet = path.join(out, 'icons_t4_sheet.png'); await p.screenshot({ path: sheet, omitBackground: true }); await b.close();
const dst = path.join(game, 'ui', 'icons');
const py = `
from PIL import Image
import sys, json
names = json.loads(sys.argv[2]); im = Image.open(sys.argv[1]).convert('RGBA'); S=${SCALE}; C=${CELL}; G=${GAP}
for i, n in enumerate(names):
    x = (G + i * (C + G)) * S; y = G * S
    t = im.crop((x, y, x + C * S, y + C * S)).resize((C, C), Image.LANCZOS); t.save(sys.argv[3] + '/' + n + '.png')
print('sliced', len(names))
`;
console.log(execFileSync('python3', ['-c', py, sheet, JSON.stringify(names), dst]).toString().trim(), '→', dst, '· sheet', path.relative(game, sheet));
// S59: register the sliced names in ui/icons/manifest.json so PNG mode serves them (a name missing from the manifest silently falls back to inline SVG)
const mf = path.join(dst, 'manifest.json'); const man = JSON.parse(fs.readFileSync(mf, 'utf8')); let added = 0;
for (const n of names) if (!man.names.includes(n)) { man.names.push(n); added++; }
man.names.sort(); fs.writeFileSync(mf, JSON.stringify(man)); console.log('manifest: +' + added + ' name(s), total ' + man.names.length);
