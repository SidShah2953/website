/**
 * WCAG contrast audit against ACTUAL rendered pixels.
 *
 * Computed background-color is useless here — the page sits on gradients, an
 * SVG line field and a live WebGL canvas, all of which report "transparent".
 * So this screenshots each page and samples the real composited background
 * behind every run of text.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const PAGES = ['/', '/about/', '/blog/', '/research/', '/projects/',
  '/about/experience/', '/about/education/',
  '/blog/svi-with-pyro/', '/themes/composability/', '/notes/2026-08-30-first/'];

mkdirSync('/tmp/contrast', { recursive: true });
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const all = [];
for (const path of PAGES) {
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1600);          // let the shader settle
  const items = await p.evaluate(() => {
    const out = [];
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3 && c.textContent.trim().length > 2) {
          const el = c.parentElement;
          if (!el) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          if (r.bottom < 0 || r.top > innerHeight) continue;
          const fs = parseFloat(cs.fontSize);
          const fw = parseInt(cs.fontWeight) || 400;
          out.push({
            text: c.textContent.trim().slice(0, 46),
            sel: el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0],
            color: cs.color, fs, fw,
            clipped: cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text',
            x: Math.round(r.left), y: Math.round(r.top),
            w: Math.round(r.width), h: Math.round(r.height),
          });
        } else if (c.nodeType === 1) walk(c);
      }
    };
    walk(document.body);
    return out;
  });
  const name = path.replace(/\W+/g, '_') || 'root';
  await p.screenshot({ path: `/tmp/contrast/${name}.png` });
  all.push({ path, name, items });
}
await b.close();
writeFileSync('/tmp/contrast/items.json', JSON.stringify(all));
console.log('captured', all.reduce((n, a) => n + a.items.length, 0), 'text runs across', all.length, 'pages');
