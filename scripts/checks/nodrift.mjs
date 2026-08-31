import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{ width:1440, height:900 }, reducedMotion:'reduce' });
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.waitForTimeout(2000);
const r = await p.evaluate(() => {
  const t=[...document.querySelectorAll('.term')].map(e=>e.getBoundingClientRect());
  let n=0; for(let i=0;i<t.length;i++) for(let j=i+1;j<t.length;j++){
    const a=t[i],c=t[j];
    if(a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom) n++; }
  return n;
});
console.log('overlaps with drift DISABLED (reduced-motion):', r);
await b.close();
