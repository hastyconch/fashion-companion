// Generates the app icons from one SVG. Run: node scripts/generate-icons.mjs
// Re-run after changing the glyph or colors below.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#7a2e2e"; // --accent (light theme)
const FG = "#faf8f5"; // --background (light theme)
// Lucide "shirt" glyph (ISC license), drawn on a 24x24 grid.
const SHIRT =
  "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z";

/** glyphScale = share of the canvas the 24px glyph box occupies. */
function svg({ size, glyphScale, rounded }) {
  const box = size * glyphScale;
  const offset = (size - box) / 2;
  const s = box / 24;
  const radius = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${s})" fill="none" stroke="${FG}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="${SHIRT}"/>
  </g>
</svg>`;
}

const png = (size, opts) => sharp(Buffer.from(svg({ size, ...opts }))).png().toBuffer();

await mkdir("public/icons", { recursive: true });
// Square, full-bleed: the OS applies its own mask/rounding.
await writeFile("public/icons/icon-192.png", await png(192, { glyphScale: 0.55 }));
await writeFile("public/icons/icon-512.png", await png(512, { glyphScale: 0.55 }));
// Maskable: keep the glyph inside the central 80% safe zone.
await writeFile("public/icons/icon-maskable-512.png", await png(512, { glyphScale: 0.45 }));
// iOS home screen icon (iOS rounds the corners itself).
await writeFile("public/apple-icon.png", await png(180, { glyphScale: 0.55 }));
// Browser tab icon.
await writeFile("public/icon.svg", svg({ size: 64, glyphScale: 0.62, rounded: true }));
console.log("Icons written.");
