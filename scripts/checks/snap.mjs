import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{ width:1440, height:900 } });
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.waitForTimeout(1500);
const info = await p.evaluate(() => ({
  snapType: getComputedStyle(document.documentElement).scrollSnapType,
  slides: [...document.querySelectorAll('.slide')].map(s => ({
    h: Math.round(s.getBoundingClientRect().height),
    align: getComputedStyle(s).scrollSnapAlign,
    stop: getComputedStyle(s).scrollSnapStop,
  })),
  vh: innerHeight,
}));
console.log('scroll-snap-type:', info.snapType, '| viewport', info.vh);
info.slides.forEach((s,i)=>console.log(`  slide ${i}: ${String(s.h).padStart(4)}px  align=${s.align} stop=${s.stop} ${s.h>info.vh?'<< TALLER THAN VIEWPORT':''}`));
// does it actually rest on a boundary after a nudge?
for (const nudge of [300, 1200, 2000]) {
  await p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), nudge);
  await p.waitForTimeout(900);
  const y = await p.evaluate(() => Math.round(scrollY));
  const offs = await p.evaluate(() => [...document.querySelectorAll('.slide')].map(s=>Math.round(s.offsetTop)));
  const nearest = offs.reduce((a,c)=>Math.abs(c-y)<Math.abs(a-y)?c:a);
  console.log(`  nudge ${nudge} -> rested at ${y} (nearest boundary ${nearest}, off by ${Math.abs(y-nearest)}px)`);
}
await b.close();
