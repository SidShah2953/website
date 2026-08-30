import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{ width:1440, height:900 } });
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.waitForTimeout(800);
const rows = await p.evaluate(() => {
  const box = document.getElementById('wm').getBoundingClientRect();
  return [...document.querySelectorAll('.term')].map(e => {
    const r = e.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(e).fontSize);
    const est = e.dataset.label.length * fs * 0.56 + 40;
    return { l:e.dataset.label, fs:+fs.toFixed(1),
      real:+(r.width * (1000/box.width)).toFixed(0),
      realH:+(r.height * (1000/box.width)).toFixed(0),
      hRatio:+(r.height/fs).toFixed(2),
      est:+est.toFixed(0) };
  });
});
console.log('label'.padEnd(24),'fs'.padStart(5),'realW'.padStart(7),'estW'.padStart(6),' wRatio  realH  h/fs');
for (const r of rows.sort((a,b)=>b.real-a.real).slice(0,8))
  console.log(r.l.padEnd(24), String(r.fs).padStart(5), String(r.real).padStart(7), String(r.est).padStart(6), (r.est/r.real).toFixed(2).padStart(7), String(r.realH).padStart(6), String(r.hRatio).padStart(6));
await b.close();
