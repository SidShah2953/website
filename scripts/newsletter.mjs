/**
 * Creates Kit broadcast DRAFTS for newly published writing.
 *
 * Deliberately does not send. `send_at: null` leaves the email sitting in Kit
 * for review — everything up to the irreversible step is automated, and the
 * irreversible step stays a human decision. An email cannot be unsent.
 *
 * Only content with `newsletter: true` in its front matter is considered, so
 * edits, republishes, back-fills and full rebuilds cannot fire a send by
 * accident.
 *
 * Idempotent: every draft carries `description: "auto:<slug>"`, which is Kit's
 * internal label and is never shown to subscribers. Existing broadcasts are
 * listed first and matching slugs are skipped, so re-running a workflow — or
 * re-deploying the same commit — cannot create duplicates.
 *
 *   node scripts/newsletter.mjs            # act
 *   node scripts/newsletter.mjs --dry-run  # print what it would do
 *
 * Requires KIT_API_KEY. SITE_URL defaults to the production origin.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { existsSync } from 'node:fs';

const API = 'https://api.kit.com/v4';
const KEY = process.env.KIT_API_KEY;
const SITE = (process.env.SITE_URL || 'https://siddhants.com').replace(/\/$/, '');
const DRY = process.argv.includes('--dry-run');
const ROOT = new URL('..', import.meta.url).pathname;

const die = (m) => { console.error(`newsletter: ${m}`); process.exit(1); };
if (!KEY && !DRY) die('KIT_API_KEY is not set');

const kit = async (path, init = {}) => {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'X-Kit-Api-Key': KEY, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) die(`${init.method || 'GET'} ${path} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

/** Front matter, without pulling in a YAML dependency for four scalar fields. */
const parse = (raw) => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
    data[kv[1]] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return { data, body: m[2] };
};

const walk = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (['.md', '.mdx'].includes(extname(e.name))) out.push(p);
  }
  return out;
};

/** Strip MDX/markdown down to something readable as an email paragraph. */
const plain = (md) =>
  md
    .replace(/^import .*$/gm, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')       // JSX + html tags, keeps inner text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** A subject line for a note, which by design has no title: prefer the first
 *  sentence, and never cut mid-word. */
const firstLine = (text, max = 90) => {
  const line = text.split('\n')[0].trim();
  const stop = line.search(/[.!?](\s|$)/);
  if (stop > 0 && stop <= max) return line.slice(0, stop + 1);
  if (line.length <= max) return line;
  return line.slice(0, line.lastIndexOf(' ', max)).replace(/[,;:]$/, '') + '…';
};

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

const main = async () => {
  const roots = [
    { dir: join(ROOT, 'src/content/blog'), url: (s) => `/blog/${s}/`, kind: 'post' },
    { dir: join(ROOT, 'src/content/notes'), url: (s) => `/notes/${s}/`, kind: 'note' },
  ];

  const candidates = [];
  for (const r of roots) {
    for (const file of await walk(r.dir).catch(() => [])) {
      const parsed = parse(await readFile(file, 'utf8'));
      if (!parsed) continue;
      const { data, body } = parsed;
      if (data.newsletter !== true) continue;
      if (data.isHidden === true) continue;       // never mail what the site hides
      // Astro lowercases slugs, but the source directory does not: the folder
      // is COIN-Research-202602 while the route is /blog/coin-research-202602/.
      // Using the raw path would have mailed a link to a 404.
      const slug = relative(r.dir, file).replace(/\.mdx?$/, '').toLowerCase();
      candidates.push({ slug, kind: r.kind, path: r.url(slug), url: SITE + r.url(slug), data, body });
    }
  }

  if (!candidates.length) { console.log('newsletter: nothing opted in'); return; }

  // Every link must resolve in the build that is being deployed. A slug that
  // does not exist here would be a 404 in someone's inbox, which is not
  // recoverable once sent.
  for (const c of candidates) {
    const page = join(ROOT, 'dist', c.path, 'index.html');
    if (!existsSync(page)) die(`${c.slug} is opted in but ${c.path} is not in dist/ — refusing to draft a broken link`);
  }

  // Idempotency: what has already been drafted or sent?
  const seen = new Set();
  if (!DRY) {
    let after = null;
    do {
      const page = await kit(`/broadcasts?per_page=500${after ? `&after=${after}` : ''}`);
      for (const b of page.broadcasts || []) {
        const m = (b.description || '').match(/^auto:(.+)$/);
        if (m) seen.add(m[1]);
      }
      after = page.pagination?.has_next_page ? page.pagination.end_cursor : null;
    } while (after);
  }

  let made = 0;
  for (const c of candidates) {
    if (seen.has(c.slug)) { console.log(`  skip   ${c.slug} (already in Kit)`); continue; }

    const text = plain(c.body);
    const subject = c.data.title || firstLine(text);
    // A note is short enough to be the email. A post gets its opening and a link,
    // because the piece is meant to be read on the page where it is typeset.
    const isNote = c.kind === 'note';
    const intro = isNote ? text : (c.data.description || text.slice(0, 400));
    const content =
      `<p>${esc(intro).replace(/\n\n/g, '</p><p>')}</p>` +
      `<p><a href="${c.url}">${isNote ? 'Read it on the site' : 'Read the full piece'}</a></p>`;

    if (DRY) { console.log(`  DRAFT  ${c.slug}\n         subject: ${subject}`); made++; continue; }

    await kit('/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        content,
        description: `auto:${c.slug}`,   // internal label, drives idempotency
        public: false,
        published_at: null,
        send_at: null,                   // draft. Sending stays a human decision.
        preview_text: (c.data.description || text).slice(0, 140),
        subscriber_filter: null,
      }),
    });
    console.log(`  draft  ${c.slug} -> "${subject}"`);
    made++;
  }
  console.log(`newsletter: ${made} draft(s) ${DRY ? 'would be' : ''} created`);
};

main().catch((e) => die(e.message));
