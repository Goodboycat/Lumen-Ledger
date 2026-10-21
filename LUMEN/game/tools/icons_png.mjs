// node tools/icons_png.mjs [--size 64] [--cols 12]
// Rasterises the PROCEDURAL icon set (ui/icons.js) into PNGs — no browser, no screenshots, ~0 credits.
//   1. every icon is laid out side by side on ONE sheet  → ui/icons/sheet.svg + ui/icons/sheet.png  (the "screenshot")
//   2. the sheet is sliced back into one PNG per icon     → ui/icons/<name>.png
//   3. ui/icons/manifest.json  { size, cols, names:[…], cells:{name:[x,y]} }  so the game can use either the PNGs or the sheet as a CSS sprite.
// Needs rsvg-convert (librsvg) or ImageMagick `convert` on PATH. Falls back to writing only the SVGs when neither exists.
// All drawings are generated in code (ui/icons.js) → no third-party emoji font, no licence to clear.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); const game = path.resolve(here, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SIZE = Math.max(16, +arg('--size', 64) | 0), COLS = Math.max(1, +arg('--cols', 12) | 0);
const out = path.join(game, 'ui', 'icons'); fs.mkdirSync(out, { recursive: true });

const { ICON_NAMES, iconSVG } = await import(path.join(game, 'ui', 'icons.js'));
const names = ICON_NAMES.slice().sort(); const rows = Math.ceil(names.length / COLS);
const cells = {}; const tiles = [];
names.forEach((n, i) => { const x = (i % COLS) * SIZE, y = Math.floor(i / COLS) * SIZE; cells[n] = [x, y]; tiles.push(`<svg x="${x}" y="${y}" width="${SIZE}" height="${SIZE}" viewBox="0 0 64 64">${iconSVG(n)}</svg>`); });
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * SIZE}" height="${rows * SIZE}">${tiles.join('')}</svg>`;
fs.writeFileSync(path.join(out, 'sheet.svg'), sheet);

const have = (cmd) => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } };
const svg2png = (svgPath, pngPath, w, h) => {
  if (have('rsvg-convert')) execFileSync('rsvg-convert', ['-w', String(w), '-h', String(h), '-o', pngPath, svgPath]);
  else if (have('convert')) execFileSync('convert', ['-background', 'none', '-density', '192', svgPath, '-resize', `${w}x${h}`, pngPath]);
  else return false;
  return true;
};
let pngs = 0;
if (svg2png(path.join(out, 'sheet.svg'), path.join(out, 'sheet.png'), COLS * SIZE, rows * SIZE)) {
  // slice: each icon rendered on its own from the same generator (pixel-identical to its cell on the sheet, but without resampling)
  for (const n of names) {
    const one = path.join(out, `_${n}.svg`);
    fs.writeFileSync(one, `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 64 64">${iconSVG(n)}</svg>`);
    if (svg2png(one, path.join(out, `${n}.png`), SIZE, SIZE)) pngs++;
    fs.unlinkSync(one);
  }
} else console.log('no rsvg-convert / convert on PATH → wrote sheet.svg only');
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ size: SIZE, cols: COLS, rows, names, cells }, null, 0));
const kb = (p) => (fs.existsSync(p) ? (fs.statSync(p).size / 1024).toFixed(1) + ' KB' : '—');
console.log(`icons: ${names.length} drawn · sheet ${COLS}×${rows} @ ${SIZE}px → ui/icons/sheet.png (${kb(path.join(out, 'sheet.png'))}) · ${pngs} PNGs · manifest.json`);
