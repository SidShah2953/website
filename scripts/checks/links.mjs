/**
 * Every internal href must resolve in the build.
 *
 * Added because a merge silently reverted seven links in the COIN series index
 * from the renamed 202603 slugs back to 202602, and route-parity — which only
 * asks whether pages still *emit* — could not see it. Pages existed; the links
 * pointing at them did not.
 *
 *   node scripts/checks/links.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const walk = (d) => readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : join(d, e.name)));

const files = walk('dist').filter((f) => f.endsWith('.html'));
const pages = new Set(files.map((f) => '/' + relative('dist', f).replace(/index\.html$/, '')));

const bad = new Map();
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
    let u = m[1];
    if (u.startsWith('//')) continue;   // protocol-relative, i.e. external
    if (!u.endsWith('/') && !extname(u)) u += '/';
    if (pages.has(u) || existsSync(join('dist', decodeURIComponent(u)))) continue;
    if (!bad.has(u)) bad.set(u, new Set());
    bad.get(u).add('/' + relative('dist', f));
  }
}

for (const [u, from] of bad) console.log(`  BROKEN ${u}\n         linked from ${[...from].slice(0, 3).join(', ')}`);
console.log(bad.size ? `\n${bad.size} broken internal link(s)` : `all internal links resolve (${files.length} pages)`);
process.exit(bad.size ? 1 : 0);
