// Renders the homepage in headless Chromium and reports whether the WebGL
// surface actually painted. Used to check the shader visually rather than
// assuming it compiled.  Usage: node scripts/screenshot.mjs [url]
import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader','--use-gl=angle','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport:{ width:1440, height:900 }, deviceScaleFactor:1 });
const errs=[];
p.on('console', m => { if(m.type()==='error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR '+e.message));
await p.goto((process.argv[2] ?? 'http://localhost:4321') + '/', { waitUntil:'networkidle' });
await p.waitForTimeout(3500);
const diag = await p.evaluate(() => {
  const c = document.getElementById('sfc');
  const gl = c && c.getContext('webgl2');
  let nonEmpty = false;
  if (c && c.width) {
    const t = document.createElement('canvas'); t.width=c.width; t.height=c.height;
    // read pixels straight from the GL buffer
    const g = c.getContext('webgl2');
    if (g) { const px = new Uint8Array(4*64); g.readPixels(Math.floor(c.width/2)-8, Math.floor(c.height/2)-8, 8,8, g.RGBA, g.UNSIGNED_BYTE, px);
      nonEmpty = px.some(v => v > 6); }
  }
  return { hasCanvas: !!c, w: c&&c.width, h: c&&c.height, gl: !!gl, visible: c&&c.classList.contains('on'), painted: nonEmpty };
});
console.log('DIAG', JSON.stringify(diag));
console.log('ERRORS', errs.length ? errs.slice(0,4).join(' | ') : 'none');
await p.screenshot({ path:'/tmp/hero.png' });
await p.evaluate(() => scrollTo(0, innerHeight*1.15));
await p.waitForTimeout(1400);
await p.screenshot({ path:'/tmp/scrolled.png' });
await b.close();
