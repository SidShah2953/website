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
 * The email itself is designed in scripts/email/: render.mjs builds the body
 * from front matter (title, description, `thesis`, and `video` if the post has
 * one), and kit-template.html is the shell that lives in Kit. See
 * scripts/email/README.md.
 *
 *   node scripts/newsletter.mjs                     # act
 *   node scripts/newsletter.mjs --dry-run           # print what it would do
 *   node scripts/newsletter.mjs --preview <slug|file.md>
 *       # write .email-preview/<slug>.html, the full email as a subscriber
 *       # sees it, without touching Kit. Takes a file path too, so a draft
 *       # that is not in the repo yet can be previewed.
 *
 * Requires KIT_API_KEY. KIT_EMAIL_TEMPLATE_ID picks the template (without it
 * Kit uses the account default, which drops the design). SITE_URL defaults to
 * the production origin.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, relative, basename, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { renderContent, videoMeta, preview } from './email/render.mjs';

const API = 'https://api.kit.com/v4';
const KEY = process.env.KIT_API_KEY;
const SITE = (process.env.SITE_URL || 'https://siddhants.com').replace(/\/$/, '');
const DRY = process.argv.includes('--dry-run');
const PREVIEW = process.argv.includes('--preview') ? process.argv[process.argv.indexOf('--preview') + 1] : null;
const TEMPLATE_ID = process.env.KIT_EMAIL_TEMPLATE_ID ? Number(process.env.KIT_EMAIL_TEMPLATE_ID) : null;
const ROOT = new URL('..', import.meta.url).pathname;

const die = (m) => { console.error(`newsletter: ${m}`); process.exit(1); };
if (!KEY && !DRY && !PREVIEW) die('KIT_API_KEY is not set');

const kit = async (path, init = {}) => {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'X-Kit-Api-Key': KEY, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) die(`${init.method || 'GET'} ${path} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

/** Front matter. A real YAML parser, because `thesis` is a block scalar and
 *  goes into the email verbatim. */
const parse = (raw) => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { data: parseYaml(m[1]) ?? {}, body: m[2] };
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

const words = (md) => md.split(/\s+/).filter(Boolean).length;
const minutes = (md) => Math.max(1, Math.round(words(md) / 220));  // matches readingMinutes() in src/utils/feed.ts

/** The email body for one piece. `assets` is where images load from. */
const build = (c, assets = SITE) => {
  const isNote = c.kind === 'note';
  const text = plain(c.body);
  return renderContent({
    kind: c.kind,
    url: c.url,
    assets,
    title: c.data.title || (isNote ? null : firstLine(text)),
    description: c.data.description,
    thesis: c.data.thesis,
    // Notes are short enough to be the email. Body MDX keeps its markdown for
    // the renderer; imports and the article's own headings are dropped.
    body: c.body.replace(/^import .*$/gm, '').trim(),
    minutes: isNote ? null : minutes(text),
    video: videoMeta(ROOT, c.data.video),
  });
};

/** --preview: render one piece into a standalone HTML file and stop. */
const runPreview = async (target) => {
  let file = target && existsSync(target) ? resolve(target) : null;
  if (!file) {
    for (const d of ['src/content/blog', 'src/content/notes']) {
      for (const ext of ['.mdx', '.md']) {
        const f = (await walk(join(ROOT, d)).catch(() => [])).find((p) =>
          relative(join(ROOT, d), p).replace(/\.mdx?$/, '').toLowerCase() === String(target).toLowerCase() && p.endsWith(ext));
        if (f) file = f;
      }
    }
  }
  if (!file) die(`--preview: no file or slug "${target}"`);
  const parsed = parse(await readFile(file, 'utf8'));
  if (!parsed) die(`--preview: ${file} has no front matter`);
  const isNote = file.includes('/content/notes/');
  const slug = (parsed.data.slug || basename(file).replace(/\.mdx?$/, ''))
    .toLowerCase().replace(/[^a-z0-9/-]+/g, '-').replace(/^-|-$/g, '');
  const c = { slug, kind: isNote ? 'note' : 'post', data: parsed.data, body: parsed.body,
    url: `${SITE}/${isNote ? 'notes' : 'blog'}/${slug}/` };
  // Images from the working tree, so the preview is right before anything deploys.
  const html = preview(await readFile(join(ROOT, 'scripts/email/kit-template.html'), 'utf8'),
    build(c, 'file://' + join(ROOT, 'public')));
  await mkdir(join(ROOT, '.email-preview'), { recursive: true });
  const out = join(ROOT, '.email-preview', `${slug.replace(/\//g, '_')}.html`);
  await writeFile(out, html);
  console.log(`newsletter: preview written to ${relative(ROOT, out)}\n  subject: ${c.data.title || '(first line of the note)'}`);
};

const main = async () => {
  if (PREVIEW) return runPreview(PREVIEW);

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
    // The email's poster links to #video on the page. Without the file, or
    // without a <Video> in the body to carry that anchor, the link is dead.
    if (c.data.video) {
      const v = videoMeta(ROOT, c.data.video);
      for (const f of [c.data.video, `${v.dir}email-poster.jpg`]) {
        if (!existsSync(join(ROOT, 'dist', f))) die(`${c.slug}: ${f} is not in dist/ — run scripts/video-assets.mjs`);
      }
      if (!/<Video[\s>]/.test(c.body)) die(`${c.slug}: front matter has \`video\` but the body has no <Video>, so #video would not resolve`);
    }
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
    // A note is short enough to be the email. A post gets its thesis, its video
    // if it has one, and a link, because the piece is meant to be read on the
    // page where it is typeset.
    const content = build(c);
    const video = videoMeta(ROOT, c.data.video);

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
        ...(TEMPLATE_ID ? { email_template_id: TEMPLATE_ID } : {}),
        ...(video ? { thumbnail_url: `${SITE}${video.dir}email-poster.jpg`, thumbnail_alt: subject } : {}),
      }),
    });
    console.log(`  draft  ${c.slug} -> "${subject}"`);
    made++;
  }
  console.log(`newsletter: ${made} draft(s) ${DRY ? 'would be' : ''} created`);
};

main().catch((e) => die(e.message));
