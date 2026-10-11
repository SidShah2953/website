/**
 * Renders built pages to PDF, in the two modes print.css defines.
 *
 *   node scripts/pdf.mjs <slug|/path/> [--mode dark|light|both] [--out dir]
 *       One page, for a look. Output defaults to .pdf/ (gitignored).
 *
 *   node scripts/pdf.mjs --site [--force]
 *       Every blog post, into public/pdf/: <name>-dark.pdf (as on the site)
 *       and <name>.pdf (print-friendly). These are the files the Export and
 *       Print links serve. Only pages whose content changed are re-rendered:
 *       public/pdf/manifest.json keeps a fingerprint of each page (its HTML
 *       plus every file it loads, plus this script), so an unrelated commit
 *       leaves the PDFs, and git, alone. PDFs for removed posts are deleted.
 *       Run by .githooks/pre-commit on main; --force re-renders everything.
 *
 * Reads from dist/, so run `npm run build` first.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, resolve, relative, sep } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const SITE = (process.env.SITE_URL || 'https://siddhants.com').replace(/\/$/, '');
const SITE_MODE = args.includes('--site');
const PUB = join(ROOT, 'public', 'pdf');
const MANIFEST = join(PUB, 'manifest.json');

/** /blog/a/b/ -> a-b. Must match pdfName in src/components/Article.astro. */
const pdfName = (path) => path.replace(/^\/blog\/|\/$/g, '').replaceAll('/', '-');

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.json': 'application/json', '.mp4': 'video/mp4' };

/** Blog posts that carry the Export/Print links (redirect stubs do not). */
async function sitePages() {
  const out = [];
  for (const rel of await readdir(join(DIST, 'blog'), { recursive: true })) {
    if (!rel.endsWith('index.html')) continue;
    const f = join(DIST, 'blog', rel);
    if (!/<span class="tools" data-tools/.test(await readFile(f, 'utf8'))) continue;
    out.push('/' + relative(DIST, f).split(sep).join('/').replace(/index\.html$/, ''));
  }
  return out.sort();
}

/**
 * What the PDF depends on. Astro emits the per-component <style> blocks in an
 * order that varies between builds, so they are sorted before hashing; the
 * Export/Print links are dropped, since they point at the PDFs themselves.
 * Every local file the page loads is hashed by content (images under public/
 * keep their names when they change; built assets have hashed names anyway).
 */
async function fingerprint(path, self) {
  let html = await readFile(join(DIST, path, 'index.html'), 'utf8');
  const styles = [];
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, (m) => (styles.push(m), ''))
    .replace(/<span class="tools" data-tools[\s\S]*?<\/span>/, '');
  const h = createHash('sha256').update(self).update(html).update(styles.sort().join(''));
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href|poster)="(\/[^"#?]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/srcset="([^"]+)"/g))
    for (const part of m[1].split(',')) { const u = part.trim().split(/\s+/)[0]; if (u.startsWith('/')) refs.add(u); }
  for (const u of [...refs].sort()) {
    if (u.startsWith('//') || u.startsWith('/pdf/') || !extname(u) || extname(u) === '.html') continue;
    const f = join(DIST, decodeURIComponent(u));
    if (existsSync(f)) h.update(u).update(await readFile(f));
  }
  return h.digest('hex').slice(0, 16);
}

async function render(browser, base, path, mode, file) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
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
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
  } finally {
    await page.close();
  }
}

const server = createServer(async (req, res) => {
  let p = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); } catch {}
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
});

if (!existsSync(DIST)) { console.error('pdf: no dist/. Run `npm run build` first.'); process.exit(1); }
const target = args.find((a, i) => !a.startsWith('--') && !['--mode', '--out'].includes(args[i - 1]));
if (!SITE_MODE && !target) {
  console.error('usage: node scripts/pdf.mjs <slug|/path/> [--mode dark|light|both] [--out dir]\n       node scripts/pdf.mjs --site [--force]');
  process.exit(1);
}

await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
try {
  if (SITE_MODE) {
    await mkdir(PUB, { recursive: true });
    const self = await readFile(new URL(import.meta.url));
    const old = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
    const next = {};
    const pages = await sitePages();
    let made = 0;
    for (const path of pages) {
      const name = pdfName(path);
      const fp = await fingerprint(path, self);
      next[name] = fp;
      const files = [join(PUB, `${name}-dark.pdf`), join(PUB, `${name}.pdf`)];
      if (!args.includes('--force') && old[name] === fp && files.every(existsSync)) continue;
      await render(browser, base, path, 'dark', files[0]);
      await render(browser, base, path, 'light', files[1]);
      console.log(`pdf: ${name}`);
      made++;
    }
    // PDFs whose post is gone
    let removed = 0;
    for (const f of await readdir(PUB)) {
      if (!f.endsWith('.pdf')) continue;
      if (!(f.replace(/(-dark)?\.pdf$/, '') in next)) { await rm(join(PUB, f)); removed++; console.log(`pdf: removed ${f}`); }
    }
    await writeFile(MANIFEST, JSON.stringify(next, null, 2) + '\n');
    console.log(`pdf: ${pages.length} posts, ${made} rendered, ${pages.length - made} unchanged${removed ? `, ${removed} files removed` : ''}`);
  } else {
    const modes = opt('--mode', 'both') === 'both' ? ['dark', 'light'] : [opt('--mode')];
    const out = resolve(opt('--out', join(ROOT, '.pdf')));
    const path = target.startsWith('/') ? target : `/blog/${target.toLowerCase()}/`;
    const name = path.replace(/^\/|\/$/g, '').split('/').pop();
    await mkdir(out, { recursive: true });
    for (const mode of modes) {
      const file = join(out, `${name} (${mode === 'dark' ? 'dark' : 'print'}).pdf`);
      await render(browser, base, path, mode, file);
      console.log(`pdf: ${file}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
