/** Confirms the hero graphic persists and evolves down the whole page. */
import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{ width:1440, height:900 } });
await p.goto((process.argv[2] ?? 'http://localhost:4321') + '/', { waitUntil:'networkidle' });
await p.waitForTimeout(2500);
const geom = await p.evaluate(() => {
  const c = document.getElementById('sfc'), s = document.getElementById('surface');
  return { pos: getComputedStyle(s).position, w: c.width, h: c.height,
           z: getComputedStyle(s).zIndex };
});
console.log('surface:', JSON.stringify(geom));
for (const y of [0, 0.35, 0.7, 1]) {
  await p.evaluate(f => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior:'instant' }), y);
  await p.waitForTimeout(1100);
  const r = await p.evaluate(() => {
    const c = document.getElementById('sfc');
    const b = c.getBoundingClientRect();
    return { onScreen: b.top < innerHeight && b.bottom > 0, top: Math.round(b.top) };
  });
  await p.screenshot({ path:`/tmp/scroll-${Math.round(y*100)}.png` });
  console.log(`  at ${Math.round(y*100)}% -> canvas onScreen=${r.onScreen} top=${r.top}`);
}
await b.close();
