/**
 * analytics.siddhants.com: one private page for readership across services.
 *
 *   GoatCounter  visits, posts, referrers, countries, devices, and the
 *                read-depth events the site sends (depth-25..100<path>,
 *                read<path>; see the website's src/components/ReadDepth.astro)
 *   Kit          subscribers, growth, and every sent broadcast's stats
 *   Cloudflare   Web Analytics (the beacon on every page), as a second count
 *
 * The page itself carries no data. /api/summary does every call server side,
 * with the keys held as Worker secrets, and caches the result for 10 minutes.
 *
 * Access: Cloudflare Access sits in front of the whole hostname. This Worker
 * also verifies the Access JWT on every /api request and refuses without it
 * (fail closed), so a misconfigured Access policy cannot leak the numbers.
 * Local `wrangler dev` skips the check only when DEV=1 in .dev.vars.
 */

const GC = 'https://siddhants.goatcounter.com/api/v0';
const KIT = 'https://api.kit.com/v4';
const CF = 'https://api.cloudflare.com/client/v4';
const SITE_HOST = 'siddhants.com';
const CACHE_SECONDS = 600;
const RANGES = new Set([7, 30, 90, 365]);
const SIZE_NAMES = { phone: 'Phone', largephone: 'Large phone', tablet: 'Tablet', desktop: 'Desktop', desktophd: 'Large desktop', unknown: 'Unknown' };

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    const who = await verifyAccess(req, env);
    if (!who) return json({ error: 'Sign in through Cloudflare Access.' }, 401);

    if (url.pathname === '/api/summary') {
      const days = RANGES.has(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
      const fresh = url.searchParams.has('fresh');
      return summary(days, fresh, env, ctx, who);
    }
    return json({ error: 'Not found' }, 404);
  },
};

// ---------------------------------------------------------------- summary

async function summary(days, fresh, env, ctx, who) {
  const key = new Request(`https://cache.internal/summary?days=${days}`);
  const cache = caches.default;
  if (!fresh) {
    const hit = await cache.match(key);
    if (hit) return withViewer(hit, who);
  }

  const end = today();
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));

  const [goatcounter, kit, cloudflare] = await Promise.all([
    safe(() => goatCounter(env, start, end, prevStart, prevEnd)),
    safe(() => kitStats(env, start, end)),
    safe(() => cloudflareStats(env, start, end, prevStart, prevEnd)),
  ]);

  const body = { range: { days, start, end }, generated: new Date().toISOString(), goatcounter, kit, cloudflare };
  const res = json(body, 200, { 'Cache-Control': `max-age=${CACHE_SECONDS}` });
  ctx.waitUntil(cache.put(key, res.clone()));
  return withViewer(res, who);
}

const safe = async (fn) => { try { return await fn(); } catch (e) { return { error: String(e.message || e) }; } };

async function withViewer(res, who) {
  const body = await res.clone().json();
  return json({ ...body, viewer: who }, 200, { 'Cache-Control': 'no-store' });
}

// ------------------------------------------------------------ GoatCounter

async function goatCounter(env, start, end, prevStart, prevEnd) {
  if (!env.GOATCOUNTER_TOKEN) throw new Error('GOATCOUNTER_TOKEN is not set');
  // GoatCounter allows only a few requests a second: call it one at a time,
  // and when it says "try again in N ms", wait and retry.
  const get = async (path, params) => {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(`${GC}${path}?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${env.GOATCOUNTER_TOKEN}`, 'Content-Type': 'application/json' },
      });
      if (r.status === 429 && attempt < 4) {
        const ms = Number((await r.text()).match(/([\d.]+)ms/)?.[1] || 1000);
        await new Promise((ok) => setTimeout(ok, Math.min(ms + 100, 3000)));
        continue;
      }
      if (!r.ok) throw new Error(`GoatCounter ${path}: ${r.status} ${(await r.text()).slice(0, 160)}`);
      return r.json();
    }
  };
  const range = { start, end };

  const total = await get('/stats/total', range);
  const prev = await get('/stats/total', { start: prevStart, end: prevEnd });
  const refs = await get('/stats/toprefs', { ...range, limit: 12 });
  const locations = await get('/stats/locations', { ...range, limit: 12 });
  const sizes = await get('/stats/sizes', { ...range, limit: 6 });

  // Every path, pages and events alike; paged because the API caps a page.
  const hits = [];
  let exclude = [];
  for (let page = 0; page < 10; page++) {
    const r = await get('/stats/hits', { ...range, limit: 100, ...(exclude.length ? { exclude_paths: exclude.join(',') } : {}) });
    hits.push(...(r.hits || []));
    if (!r.more) break;
    exclude = hits.map((h) => h.path_id);
  }

  // Fold the read-depth events into their article: depth-50/blog/x/ -> /blog/x/
  const posts = new Map();
  const row = (path) => {
    if (!posts.has(path)) posts.set(path, { path, title: '', visits: 0, d25: 0, d50: 0, d75: 0, d100: 0, reads: 0 });
    return posts.get(path);
  };
  for (const h of hits) {
    const m = h.path.match(/^(depth-(25|50|75|100)|read)(\/.*)$/);
    if (h.event && m) {
      const r = row(m[3]);
      if (m[1] === 'read') r.reads += h.count; else r[`d${m[2]}`] += h.count;
    } else if (!h.event) {
      const r = row(h.path);
      r.visits += h.count;
      if (h.title) r.title = h.title;
    }
  }

  return {
    visits: total.total ?? 0,
    events: total.total_events ?? 0,
    previousVisits: prev.total ?? 0,
    daily: (total.stats || []).map((s) => ({ day: s.day, count: s.daily ?? 0 })),
    posts: [...posts.values()].filter((p) => p.visits || p.reads).sort((a, b) => b.visits - a.visits),
    referrers: (refs.stats || []).map((s) => ({ name: s.name || '(direct or unknown)', count: s.count })),
    countries: (locations.stats || []).map((s) => ({ name: s.name || s.id || 'Unknown', count: s.count })),
    devices: (sizes.stats || []).filter((s) => s.count).map((s) => ({ name: SIZE_NAMES[s.id] || s.name || s.id || 'Unknown', count: s.count })),
  };
}

// -------------------------------------------------------------------- Kit

async function kitStats(env, start, end) {
  if (!env.KIT_API_KEY) throw new Error('KIT_API_KEY is not set');
  const get = async (path, params = {}) => {
    const r = await fetch(`${KIT}${path}?${new URLSearchParams(params)}`, { headers: { 'X-Kit-Api-Key': env.KIT_API_KEY } });
    if (!r.ok) throw new Error(`Kit ${path}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.json();
  };

  // The list is small: page through all subscribers for the growth line.
  const subs = [];
  let after = null;
  for (let page = 0; page < 20; page++) {
    const r = await get('/subscribers', { status: 'active', per_page: 1000, ...(after ? { after } : {}) });
    subs.push(...(r.subscribers || []));
    if (!r.pagination?.has_next_page) break;
    after = r.pagination.end_cursor;
  }
  const growth = await get('/account/growth_stats', { starting: start, ending: end }).catch(() => null);

  const list = await get('/broadcasts', { per_page: 50 });
  const sent = (list.broadcasts || []).filter((b) => b.send_at && new Date(b.send_at) <= new Date());
  const broadcasts = await Promise.all(sent.map(async (b) => {
    const s = await get(`/broadcasts/${b.id}/stats`).catch(() => null);
    const st = s?.broadcast?.stats || {};
    return {
      subject: b.subject, sentAt: b.send_at, recipients: st.recipients ?? null,
      openRate: st.open_rate ?? null, clickRate: st.click_rate ?? null,
      clicks: st.total_clicks ?? null, unsubscribes: st.unsubscribes ?? null,
    };
  }));
  const drafts = (list.broadcasts || []).filter((b) => !b.send_at).length;

  return {
    subscribers: subs.length,
    newInRange: growth?.stats?.new_subscribers ?? subs.filter((s) => s.created_at?.slice(0, 10) >= start).length,
    cancellationsInRange: growth?.stats?.cancellations ?? null,
    joined: subs.map((s) => s.created_at?.slice(0, 10)).filter(Boolean).sort(),
    broadcasts: broadcasts.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1)),
    drafts,
  };
}

// ------------------------------------------------------------- Cloudflare

async function cloudflareStats(env, start, end, prevStart, prevEnd) {
  if (!env.CF_API_TOKEN) throw new Error('CF_API_TOKEN is not set');
  const auth = { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' };

  const gql = async (query, variables) => {
    const r = await fetch(`${CF}/graphql`, { method: 'POST', headers: auth, body: JSON.stringify({ query, variables }) });
    const j = await r.json();
    if (j.errors?.length) throw new Error(`Cloudflare GraphQL: ${j.errors[0].message}`);
    return j.data.viewer.accounts[0];
  };

  // The site has two Web Analytics tags (the beacon, and Pages' own automatic
  // one). Use whichever recorded the most visits to siddhants.com, unless
  // CF_SITE_TAG pins one.
  let siteTag = env.CF_SITE_TAG;
  if (!siteTag) {
    const a = await gql(`query($acct: string!, $s: Date!, $e: Date!) { viewer { accounts(filter: { accountTag: $acct }) {
      rumPageloadEventsAdaptiveGroups(limit: 5, filter: { date_geq: $s, date_leq: $e, requestHost_in: ["${SITE_HOST}", "www.${SITE_HOST}"] }, orderBy: [sum_visits_DESC]) {
        sum { visits } dimensions { siteTag } } } } }`, { acct: env.CF_ACCOUNT_ID, s: prevStart, e: end });
    siteTag = a.rumPageloadEventsAdaptiveGroups[0]?.dimensions.siteTag;
    if (!siteTag) throw new Error('No Web Analytics data for siddhants.com in this range');
  }

  const query = `query($acct: string!, $site: string!, $s: Date!, $e: Date!, $ps: Date!, $pe: Date!) {
    viewer { accounts(filter: { accountTag: $acct }) {
      daily: rumPageloadEventsAdaptiveGroups(limit: 400, filter: { siteTag: $site, date_geq: $s, date_leq: $e, bot: 0 }, orderBy: [date_ASC]) {
        count sum { visits } dimensions { date } }
      prev: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $site, date_geq: $ps, date_leq: $pe, bot: 0 }) {
        count sum { visits } }
      paths: rumPageloadEventsAdaptiveGroups(limit: 15, filter: { siteTag: $site, date_geq: $s, date_leq: $e, bot: 0 }, orderBy: [sum_visits_DESC]) {
        count sum { visits } dimensions { requestPath } }
    } } }`;
  const a = await gql(query, { acct: env.CF_ACCOUNT_ID, site: siteTag, s: start, e: end, ps: prevStart, pe: prevEnd });
  const daily = a.daily.map((d) => ({ day: d.dimensions.date, visits: d.sum.visits, pageviews: d.count }));
  return {
    visits: daily.reduce((n, d) => n + d.visits, 0),
    pageviews: daily.reduce((n, d) => n + d.pageviews, 0),
    previousVisits: a.prev[0]?.sum.visits ?? 0,
    daily,
    paths: a.paths.map((p) => ({ path: p.dimensions.requestPath, visits: p.sum.visits, pageviews: p.count })),
  };
}

// ----------------------------------------------------------------- Access

let certCache = { at: 0, keys: null };

async function verifyAccess(req, env) {
  if (env.DEV === '1') return 'local dev';
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return null;           // fail closed
  const token = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  try {
    const [h, p, s] = token.split('.');
    const header = JSON.parse(b64url(h, true));
    const payload = JSON.parse(b64url(p, true));
    const issuer = `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
    const aud = [].concat(payload.aud);
    if (payload.iss !== issuer || !aud.includes(env.ACCESS_AUD) || payload.exp * 1000 < Date.now()) return null;

    if (!certCache.keys || Date.now() - certCache.at > 3600e3) {
      const r = await fetch(`${issuer}/cdn-cgi/access/certs`);
      certCache = { at: Date.now(), keys: (await r.json()).keys };
    }
    const jwk = certCache.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    return ok ? (payload.email || 'signed in') : null;
  } catch {
    return null;
  }
}

function b64url(s, asText = false) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  if (asText) return bin;
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---------------------------------------------------------------- helpers

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(d, n) { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
