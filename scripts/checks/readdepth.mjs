/**
 * Verifies read-depth tracking against the built site.
 *
 * The events are only useful if they mean what they claim, so this asserts
 * behaviour rather than presence: that the funnel fires in order, that each
 * milestone fires once, and — the point of the whole thing — that a fast
 * scroll to the bottom does NOT count as a read while a slow one does.
 *
 *   node scripts/checks/readdepth.mjs [url]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const PAGE = '/blog/coin-research-202602/base-chain/';

// Stand in for GoatCounter, which is PROD-only and must not receive test hits.
const STUB = `window.goatcounter = { count: (o) => (window.__ev ||= []).push(o.path) };`;

const run = async (label, fn) => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  // The real count.js defines window.goatcounter itself and would overwrite
  // the stub, so block it (and the CF beacon) and test this logic in isolation.
  await p.route('**://gc.zgo.at/**', (r) => r.abort());
  await p.route('**cloudflareinsights.com/**', (r) => r.abort());
  await p.addInitScript(STUB);
  await p.goto(BASE + PAGE, { waitUntil: 'domcontentloaded' });
  const dwell = await p.getAttribute('[data-readdepth]', 'data-dwell');
  await fn(p);
  const ev = await p.evaluate(() => window.__ev || []);
  await b.close();
  return { label, dwell: Number(dwell), ev };
};

const scrollTo = async (p, frac) =>
  p.evaluate((f) => {
    const b = document.querySelector('#prose');
    const top = b.offsetTop + b.offsetHeight * f - innerHeight;
    scrollTo(0, Math.max(0, top));
    dispatchEvent(new Event('scroll'));
  }, frac);

const fast = await run('fast scroll to bottom (2s)', async (p) => {
  for (const f of [0.3, 0.6, 0.9, 1.1]) { await scrollTo(p, f); await p.waitForTimeout(400); }
  await p.evaluate(() => dispatchEvent(new Event('pagehide')));
});

const slow = await run('slow read past dwell threshold', async (p) => {
  const d = Number(await p.getAttribute('[data-readdepth]', 'data-dwell'));
  for (const f of [0.3, 0.6, 0.9, 1.1]) { await scrollTo(p, f); await p.waitForTimeout(300); }
  await p.waitForTimeout(d * 1000 + 500);          // linger, as a reader would
  await p.evaluate(() => dispatchEvent(new Event('pagehide')));
});

let bad = 0;
const check = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) bad++; };

for (const r of [fast, slow]) {
  console.log(`\n${r.label}  (dwell threshold ${r.dwell}s)`);
  console.log(`  events: ${r.ev.join(', ') || '(none)'}`);
  const d = (n) => r.ev.filter((e) => e.startsWith(`depth-${n}/`)).length;
  check(d(25) === 1 && d(50) === 1 && d(75) === 1, 'funnel 25/50/75 each fired exactly once');
  check(d(100) === 1, 'depth-100 fired exactly once');
  const reads = r.ev.filter((e) => e.startsWith('read/')).length;
  if (r === fast) check(reads === 0, 'a 2s scroll-through is NOT counted as a read');
  else check(reads === 1, 'a genuine read IS counted, exactly once');
  check(r.ev.every((e) => e.endsWith('/blog/coin-research-202602/base-chain')), 'every event carries the article path');
}

console.log(bad ? `\n${bad} failing assertion(s)` : '\nall assertions passed');
process.exit(bad ? 1 : 0);
