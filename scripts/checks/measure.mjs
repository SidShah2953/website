import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{ width:1440, height:900 } });
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.waitForTimeout(1000);
const r = await p.evaluate(() => {
  const secs = [...document.querySelectorAll('main > section')].map(s => ({
    cls: s.className.split(' ')[0] || 'hero',
    h: Math.round(s.getBoundingClientRect().height),
  }));
  const t = [...document.querySelectorAll('.term')].map(e => e.getBoundingClientRect());
  let ov = 0;
  for (let i=0;i<t.length;i++) for (let j=i+1;j<t.length;j++) {
    const a=t[i], c=t[j];
    if (a.left<c.right && c.left<a.right && a.top<c.bottom && c.top<a.bottom) ov++;
  }
  // do any terms cover an area label?
  const an = [...document.querySelectorAll('.anchor')].map(e => e.getBoundingClientRect());
  let anOv = 0;
  for (const a of an) for (const c of t)
    if (a.left<c.right && c.left<a.right && a.top<c.bottom && c.top<a.bottom) anOv++;
  return { vh: innerHeight, secs, overlaps: ov, anchorHits: anOv };
});
console.log('VH', r.vh);
for (const s of r.secs) console.log(`  ${s.cls.padEnd(10)} ${String(s.h).padStart(5)}px ${s.h > r.vh ? '  << TALLER THAN VIEWPORT' : ''}`);
console.log('overlaps', r.overlaps, '| anchorHits', r.anchorHits);
const wm = await p.$('#wm'); await wm.scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
await wm.screenshot({ path:'/tmp/wordmap.png' });
await b.close();
