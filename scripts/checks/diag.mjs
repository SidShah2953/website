import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{ width:1280, height:800 } });
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.waitForTimeout(2200);
const out = await p.evaluate(() => {
  const els=[...document.querySelectorAll('.term')];
  const r=els.map(e=>({ l:e.dataset.label, b:e.getBoundingClientRect() }));
  const hits=[];
  for(let i=0;i<r.length;i++) for(let j=i+1;j<r.length;j++){
    const a=r[i].b,c=r[j].b;
    if(a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom){
      hits.push(`${r[i].l} × ${r[j].l}  (overlap ${Math.round(Math.min(a.right,c.right)-Math.max(a.left,c.left))}×${Math.round(Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top))}px)`);
    }
  }
  return hits;
});
console.log(out.join('\n') || 'none');
await b.close();
