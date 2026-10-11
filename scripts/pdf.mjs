/**
 * Renders a built page to PDF, in the same two modes as the Export and Print
 * buttons (src/styles/print.css does the styling; this only drives Chromium).
 *
 *   node scripts/pdf.mjs <slug|/path/> [--mode dark|light|both] [--out dir]
 *
 *   dark   as it looks on the site       -> <slug> (dark).pdf
 *   light  print-friendly, light figures -> <slug> (print).pdf
 *
 * Reads from dist/, so run `npm run build` first. Output defaults to .pdf/
 * (gitignored).
 */
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const target = args.find((a, i) => !a.startsWith('--') && !['--mode', '--out'].includes(args[i - 1]));
if (!target) { console.error('usage: node scripts/pdf.mjs <slug|/path/> [--mode dark|light|both] [--out dir]'); process.exit(1); }
const modes = opt('--mode', 'both') === 'both' ? ['dark', 'light'] : [opt('--mode')];
const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const OUT = resolve(opt('--out', join(ROOT, '.pdf')));
const SITE = (process.env.SITE_URL || 'https://siddhants.com').replace(/\/$/, '');
const path = target.startsWith('/') ? target : `/blog/${target.toLowerCase()}/`;
const name = path.replace(/^\/|\/$/g, '').split('/').pop();

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.json': 'application/json', '.mp4': 'video/mp4' };
const server = createServer(async (req, res) => {
  let p = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); } catch {}
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const mode of modes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    // Only the local build. Analytics beacons and other third-party requests
    // add nothing to a PDF and kept 'networkidle' from ever settling.
    await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
    const res = await page.goto(base + path, { waitUntil: 'load' });
    if (!res || res.status() !== 200) throw new Error(`${path} is not in dist/ (status ${res?.status()})`);
    await page.evaluate((m) => { if (m === 'dark') document.documentElement.dataset.print = 'dark'; }, mode);
    // Links in the PDF must point at the real site, not this local server.
    await page.evaluate((site) => {
      for (const a of document.querySelectorAll('a[href]')) {
        const u = new URL(a.getAttribute('href'), location.href);
        if (u.origin === location.origin) a.href = site + u.pathname + u.search + u.hash;
      }
    }, SITE);
    await page.emulateMedia({ media: 'print' });
    // Print switches to the static faces; make sure they are in before rendering.
    await page.evaluate(() => Promise.all(['300 1em Newsreader', 'italic 300 1em Newsreader', '400 1em Newsreader',
      '600 1em Newsreader', '700 1em Newsreader', '400 1em "Schibsted Grotesk"', '500 1em "Schibsted Grotesk"',
      '600 1em "Schibsted Grotesk"'].map((f) => document.fonts.load(f))));
    await page.evaluate(() => document.fonts.ready);
    // Lazy images below the fold never start loading on their own, and
    // print-only ones (the video poster) were display:none until now. Force
    // them all, and cap the wait so one bad image cannot hang the export.
    await page.evaluate(() => {
      for (const i of document.images) { i.loading = 'eager'; if (!i.complete) i.src = i.src; }
      const all = Promise.all([...document.images].map((i) =>
        i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
      return Promise.race([all, new Promise((r) => setTimeout(r, 15000))]);
    });
    const file = join(OUT, `${name} (${mode === 'dark' ? 'dark' : 'print'}).pdf`);
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    console.log(`pdf: ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
