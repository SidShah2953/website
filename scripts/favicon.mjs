/**
 * Generates the favicon set from the site's own flow-line field.
 *
 * The mark is three wave strokes whose amplitude swells toward the middle —
 * the same motif Shell.astro draws behind the page, and the same value-noise
 * function, so the icon is derived from the design rather than decorating it.
 *
 * It is sampled coarsely and stroked heavily on purpose: at 16px a faithful
 * reproduction of the field turns to mush, so the curves are simplified until
 * they still read as waves at favicon size.
 *
 *   node scripts/favicon.mjs
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const GROUND = '#050C0F', PEACOCK = '#208EC5', GLOW = '#45B5ED', AZURE = '#2F6FE8';

// value noise — the same shape of function Shell uses for its flow lines
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (t) => t * t * (3 - 2 * t);
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v)
       + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
};
const fbm = (x, y) => {
  let val = 0, amp = 0.5, fx = x, fy = y;
  for (let i = 0; i < 3; i++) { val += amp * vnoise(fx, fy); fx *= 1.97; fy *= 1.97; amp *= 0.5; }
  return val;
};

// Two strokes, not three: at 16px a third line renders around one pixel wide
// and the whole mark collapses into a smudge. Fewer, fatter, taller waves
// survive the size that actually matters.
const S = 64, ROWS = 2, STEP = 10;
const rows = Array.from({ length: ROWS }, (_, r) => {
  const base = 23 + r * 19;
  const amp = 7.5;
  let d = '';
  for (let x = 9; x <= S - 9; x += STEP) {
    const y = base + (fbm(x / 26, r * 0.9 + 0.5) - 0.5) * 2 * amp;
    d += `${x === 9 ? 'M' : 'L'}${x} ${y.toFixed(2)} `;
  }
  return d.trim();
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="Siddhant Shah">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GLOW}"/>
      <stop offset=".55" stop-color="${PEACOCK}"/>
      <stop offset="1" stop-color="${AZURE}"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" rx="14" fill="${GROUND}"/>
${rows.map((d, i) => `  <path d="${d}" fill="none" stroke="url(#g)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n')}
</svg>
`;
writeFileSync('public/favicon.svg', svg);

const png = (size, out) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
await Promise.all([
  png(180, 'public/apple-touch-icon.png'),
  png(192, 'public/icon-192.png'),
  png(512, 'public/icon-512.png'),
  png(32, 'public/favicon-32.png'),
  png(16, 'public/favicon-16.png'),
]);

writeFileSync('public/site.webmanifest', JSON.stringify({
  name: 'Siddhant Shah', short_name: 'Siddhant',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
  theme_color: GROUND, background_color: GROUND, display: 'standalone', start_url: '/',
}, null, 2) + '\n');

console.log('  favicon.svg + 5 PNGs + site.webmanifest written');

// A real favicon.ico as well: crawlers and older browsers request /favicon.ico
// by path regardless of what the document declares. The ICO container accepts a
// PNG payload directly, so this wraps the 32px render in a one-image directory.
const ico = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8);
header.writeUInt8(0, 9); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(ico.length, 14); header.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([header, ico]));
console.log('  favicon.ico written');
