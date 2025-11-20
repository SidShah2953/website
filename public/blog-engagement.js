// Lightweight engagement tracking for blog pages
// Sends page view + scroll depth + time-on-page to /api/blog-event (Cloudflare Function)
const slug = window.location.pathname.replace(/\/$/, '');
let start = Date.now();
let maxScroll = 0;
function trackScroll(){
  const scrolled = window.scrollY + window.innerHeight;
  const pct = scrolled / document.documentElement.scrollHeight;
  if(pct > maxScroll) maxScroll = pct;
}
window.addEventListener('scroll', () => requestAnimationFrame(trackScroll));
async function sendEvent(type){
  try {
    await fetch('/api/blog-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        slug,
        t: Date.now() - start,
        scrollPct: Math.round(maxScroll * 100)/100
      })
    });
  } catch(e){
    // silence errors
  }
}
window.addEventListener('beforeunload', () => sendEvent('unload'));
sendEvent('view');
