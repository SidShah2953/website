/** Audits every page type for horizontal overflow and unreadably small text. */
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://localhost:4321';
const PAGES = ['/', '/about/', '/about/experience/', '/about/education/', '/blog/', '/research/', '/projects/',
  '/blog/svi-with-pyro/', '/blog/coin-research-202602/model-walkthrough/',
  '/research/greek-vase-volume-analysis/', '/themes/composability/',
  '/notes/2026-08-30-first/'];
const SIZES = [[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,640],[1280,800],[1440,900],[1920,1080]];
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] });
let bad = 0;
for (const [w,h] of SIZES) {
  const p = await b.newPage({ viewport:{ width:w, height:h } });
  const issues = [];
  for (const path of PAGES) {
    const res = await p.goto(BASE + path, { waitUntil:'networkidle' }).catch(()=>null);
    if (!res || res.status() >= 400) { issues.push(`${path} -> ${res?res.status():'FAIL'}`); continue; }
    await p.waitForTimeout(450);
    const r = await p.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      const wide = [...document.querySelectorAll('body *')]
        .filter(e => { const b=e.getBoundingClientRect();
          return b.width > 0 && (b.right > innerWidth + 2 || b.left < -2)
            && getComputedStyle(e).position !== 'fixed'; })
        .slice(0,3).map(e => `${e.tagName.toLowerCase()}.${(e.className||'').toString().split(' ')[0]}`);
      const tiny = [...document.querySelectorAll('p,li,a,span,h1,h2,h3')]
        .filter(e => e.textContent.trim().length > 12
          && parseFloat(getComputedStyle(e).fontSize) < 11
          && e.getBoundingClientRect().width > 0).length;
      return { overflow, wide, tiny };
    });
    if (r.overflow > 1) issues.push(`${path} overflows ${r.overflow}px [${r.wide.join(', ')}]`);
    if (r.tiny > 0) issues.push(`${path} has ${r.tiny} elements under 11px`);
  }
  console.log(`${String(w).padStart(4)}x${h}  ${issues.length ? '✗ ' + issues.join(' | ') : '✓ clean'}`);
  bad += issues.length;
  await p.close();
}
await b.close();
console.log(bad ? `\n${bad} issues` : '\nall clean');
