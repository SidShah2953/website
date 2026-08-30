import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{ width:1280, height:800 }, reducedMotion:'reduce' });
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.waitForTimeout(2200);
console.log(JSON.stringify(await p.evaluate(() => {
  const wm=document.getElementById('wm').getBoundingClientRect();
  const t=[...document.querySelectorAll('.term')].filter(e=>e.offsetParent);
  return { wmW:Math.round(wm.width), wmH:Math.round(wm.height), visible:t.length,
    fs:t.map(e=>+parseFloat(getComputedStyle(e).fontSize).toFixed(1)).sort((a,b)=>b-a).slice(0,4) };
})));
await b.close();
