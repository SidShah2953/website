/**
 * Anonymous event tracking, reported to GoatCounter.
 *
 * Every event is a path: `<name><page path>`, e.g. `time-1m/blog/some-post`,
 * so GoatCounter counts it per page and the readership dashboard
 * (analytics.siddhants.com) can fold it back into the page's row. Outbound
 * clicks are the exception: `out/<hostname>`, since the destination is what
 * matters there.
 *
 * Cookieless and anonymous: nothing identifies a reader, nothing is stored on
 * their device, and a visitor with Do Not Track on sends nothing. Each event
 * is sent at most once per page view.
 *
 * count.js loads async, so an early event waits for it (up to 20s) instead of
 * being dropped.
 */

const sent = new Set<string>();
const dnt = typeof navigator !== 'undefined' && /^(1|yes)$/i.test(String(navigator.doNotTrack ?? ''));

export const pagePath = () => location.pathname.replace(/\/$/, '') || '/';

export function track(name: string, path: string = pagePath()) {
  if (dnt) return;
  const key = `${name}${path}`;
  if (sent.has(key)) return;
  sent.add(key);
  let tries = 0;
  const go = () => {
    const count = (window as any).goatcounter?.count;
    if (typeof count === 'function') count({ path: key, event: true });
    else if (++tries < 40) setTimeout(go, 500);
  };
  go();
}
