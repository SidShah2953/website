/**
 * analytics.siddhants.com: one private page for readership across services.
 *
 *   GoatCounter  visits, posts, referrers, countries, devices, and the events
 *                the site sends (scroll depth, qualified reads, engaged time,
 *                signup form seen/submitted, video, PDF, outbound clicks;
 *                website repo, src/scripts/track.ts)
 *   Kit          subscribers (with the page and UTM tags they signed up from)
 *                and every sent broadcast's stats
 *   Cloudflare   Web Analytics (the beacon on every page), as a second count
 *
 * Two halves:
 *   sync     scheduled every 30 minutes (and on "Sync now"). Pulls each source
 *            into D1 (schema.sql) in small, bounded steps: the last few days,
 *            all of Kit, and a slice of history. Past days never change, so
 *            each is fetched once. This keeps every run inside the free plan's
 *            per-run limits and far from the APIs' rate limits.
 *   summary  answers the dashboard from D1 only, for any range, in
 *            milliseconds. Nothing on the page waits on an outside API.
 *
 * Access: Cloudflare Access sits in front of the whole hostname, and the Worker
 * verifies the Access JWT on every /api request (fail closed). Local `wrangler
 * dev` skips the check only when DEV=1 in .dev.vars.
 */

const GC = 'https://siddhants.goatcounter.com/api/v0';
const KIT = 'https://api.kit.com/v4';
const CF = 'https://api.cloudflare.com/client/v4';
const SITE_HOST = 'siddhants.com';
const KIT_FORMS = [9863560, 9863549];

const RANGES = [7, 30, 90, 365];
const DIMS = ['toprefs', 'campaigns', 'locations', 'browsers', 'systems', 'sizes', 'languages'];
const GC_FLOOR = '2025-10-01';      // GoatCounter has nothing earlier
const GC_CHUNK = 14;                // days per backfill request
const CF_MAX_AGE = 180;             // Cloudflare keeps ~26 weeks
const CF_CHUNK = 28;                // and allows at most ~13 weeks per query
const RECENT = 3;                   // days re-pulled every run (still filling in)

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    const who = await verifyAccess(req, env);
    if (!who) return json({ error: 'Sign in through Cloudflare Access.' }, 401);

    if (url.pathname === '/api/summary') {
      const days = RANGES.includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
      return json({ ...(await summary(env, days)), viewer: who });
    }
    if (url.pathname === '/api/sync' && req.method === 'POST') {
      const dims = url.searchParams.get('dims');
      return json(await sync(env, {
        budget: Math.min(Number(url.searchParams.get('budget')) || 1, env.DEV === '1' ? 100 : 3),
        dims: dims === 'all' ? RANGES : RANGES.includes(Number(dims)) ? [Number(dims)] : null,
      }));
    }
    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sync(env, { budget: 1 }));
  },
};

// ===================================================================== sync

async function sync(env, { budget = 1, dims = null } = {}) {
  const started = new Date().toISOString();
  const report = {};
  const run = async (name, fn) => {
    try { report[name] = (await fn()) || 'ok'; await setMeta(env, `err_${name}`, ''); }
    catch (e) { report[name] = `error: ${e.message || e}`; await setMeta(env, `err_${name}`, `${started} ${e.message || e}`); }
  };
  // Kit first: small, and the part most worth having fresh.
  await run('kit', () => syncKit(env));
  await run('goatcounter', () => syncGoatCounter(env, budget, dims));
  await run('cloudflare', () => syncCloudflare(env, budget));
  await setMeta(env, 'last_sync', started);
  await setMeta(env, 'last_report', JSON.stringify(report));
  return { started, report };
}

// ---------------------------------------------------------------- GoatCounter

async function syncGoatCounter(env, budget, dims) {
  if (!env.GOATCOUNTER_TOKEN) throw new Error('GOATCOUNTER_TOKEN is not set');
  const get = gcGetter(env);
  const end = today();

  // 1. The last few days, every run.
  await gcRange(env, get, addDays(end, -(RECENT - 1)), end);

  // 2. History, a few chunks per run, walking back to GC_FLOOR.
  let cursor = (await getMeta(env, 'gc_cursor')) || addDays(end, -RECENT);
  let chunks = 0;
  while (cursor >= GC_FLOOR && chunks < 3 * budget) {
    const s = maxDate(addDays(cursor, -(GC_CHUNK - 1)), GC_FLOOR);
    await gcRange(env, get, s, cursor);
    cursor = addDays(s, -1);
    await setMeta(env, 'gc_cursor', cursor);
    chunks++;
  }

  // 3. Breakdowns: one range per run in rotation, or the ones asked for (Sync
  // now asks for the range on screen). Seven calls per range.
  const next = Number(await getMeta(env, 'gc_dims_next')) || 0;
  const ranges = dims || [RANGES[next % RANGES.length]];
  for (const days of ranges) await gcDims(env, get, days);
  if (!dims) await setMeta(env, 'gc_dims_next', String((next + 1) % RANGES.length));

  return `recent + ${chunks} history chunk(s), breakdowns for ${ranges.join('/')} days; history back to ${addDays(cursor, 1)}`;
}

function gcGetter(env) {
  // GoatCounter allows only a few requests a second: one at a time, and when
  // it says "try again in N ms", wait and retry.
  return async (path, params) => {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(`${GC}${path}?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${env.GOATCOUNTER_TOKEN}`, 'Content-Type': 'application/json' },
      });
      if (r.status === 429 && attempt < 4) {
        const ms = Number((await r.text()).match(/([\d.]+)ms/)?.[1] || 1000);
        await sleep(Math.min(ms + 150, 3000));
        continue;
      }
      if (!r.ok) throw new Error(`GoatCounter ${path}: ${r.status} ${(await r.text()).slice(0, 120)}`);
      return r.json();
    }
  };
}

async function gcRange(env, get, start, end) {
  // GoatCounter labels days in the site's timezone, so a UTC window comes back
  // shifted by a day. Ask for one extra day, and upsert each day it returns
  // rather than clearing the window first (clearing wiped the boundary days).
  end = addDays(end, 1);
  const total = await get('/stats/total', { start, end });
  const hits = [];
  let exclude = [];
  for (let page = 0; page < 5; page++) {
    const r = await get('/stats/hits', { start, end, limit: 100, ...(exclude.length ? { exclude_paths: exclude.join(',') } : {}) });
    hits.push(...(r.hits || []));
    if (!r.more) break;
    exclude = hits.map((h) => h.path_id);
  }
  const stmts = [];
  const ins = env.DB.prepare('INSERT OR REPLACE INTO gc_hits (day, path, event, count) VALUES (?, ?, ?, ?)');
  const title = env.DB.prepare('INSERT OR REPLACE INTO gc_titles (path, title) VALUES (?, ?)');
  for (const h of hits) {
    if (h.title && !h.event) stmts.push(title.bind(h.path, h.title));
    for (const s of h.stats || []) if (s.daily) stmts.push(ins.bind(s.day, h.path, h.event ? 1 : 0, s.daily));
  }
  const tot = env.DB.prepare('INSERT OR REPLACE INTO gc_total (day, visits, events) VALUES (?, ?, 0)');
  for (const s of total.stats || []) stmts.push(tot.bind(s.day, s.daily || 0));
  for (let i = 0; i < stmts.length; i += 400) await env.DB.batch(stmts.slice(i, i + 400));
}

async function gcDims(env, get, days) {
  const end = today();
  const start = addDays(end, -(days - 1));
  const stmts = [env.DB.prepare('DELETE FROM gc_dims WHERE range_days = ?').bind(days)];
  const ins = env.DB.prepare('INSERT OR REPLACE INTO gc_dims (range_days, dim, name, count) VALUES (?, ?, ?, ?)');
  for (const dim of DIMS) {
    const r = await get(`/stats/${dim}`, { start, end, limit: 20 });
    for (const s of r.stats || []) {
      if (!s.count) continue;
      const name = dim === 'toprefs' ? (s.name || '(direct or unknown)') : (s.name || s.id || 'Unknown');
      stmts.push(ins.bind(days, dim, dim === 'sizes' ? (SIZE_NAMES[s.id] || name) : name, s.count));
    }
  }
  await env.DB.batch(stmts);
}

const SIZE_NAMES = { phone: 'Phone', largephone: 'Large phone', tablet: 'Tablet', desktop: 'Desktop', desktophd: 'Large desktop', unknown: 'Unknown' };

// ------------------------------------------------------------------------ Kit

async function syncKit(env) {
  if (!env.KIT_API_KEY) throw new Error('KIT_API_KEY is not set');
  const get = async (path, params = {}) => {
    const r = await fetch(`${KIT}${path}?${new URLSearchParams(params)}`, { headers: { 'X-Kit-Api-Key': env.KIT_API_KEY } });
    if (!r.ok) throw new Error(`Kit ${path}: ${r.status} ${(await r.text()).slice(0, 120)}`);
    return r.json();
  };
  const pages = async (path, key, params) => {
    const out = [];
    let after = null;
    for (let i = 0; i < 10; i++) {
      const r = await get(path, { per_page: 1000, ...params, ...(after ? { after } : {}) });
      out.push(...(r[key] || []));
      if (!r.pagination?.has_next_page) break;
      after = r.pagination.end_cursor;
    }
    return out;
  };

  const subs = await pages('/subscribers', 'subscribers', { status: 'all' });
  // Where each signup came from lives on the form's own subscriber list.
  const origin = new Map();
  for (const form of KIT_FORMS) {
    for (const s of await pages(`/forms/${form}/subscribers`, 'subscribers', { status: 'all' }).catch(() => [])) {
      origin.set(s.id, { referrer: s.referrer || null, utm: s.referrer_utm_parameters || {} });
    }
  }

  const list = await get('/broadcasts', { per_page: 100 });
  const all = list.broadcasts || [];
  const sent = all.filter((b) => b.send_at && new Date(b.send_at) <= new Date());
  const stats = [];
  for (const b of sent) {
    const s = await get(`/broadcasts/${b.id}/stats`).catch(() => null);
    stats.push([b, s?.broadcast?.stats || {}]);
  }

  const stmts = [env.DB.prepare('DELETE FROM kit_subscribers'), env.DB.prepare('DELETE FROM kit_broadcasts')];
  const insS = env.DB.prepare(`INSERT INTO kit_subscribers (id, email, first_name, state, created_at, referrer, utm_source, utm_medium, utm_campaign)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const s of subs) {
    const o = origin.get(s.id) || { utm: {} };
    stmts.push(insS.bind(s.id, s.email_address, s.first_name || null, s.state, s.created_at, o.referrer ?? null,
      o.utm.source || null, o.utm.medium || null, o.utm.campaign || null));
  }
  const insB = env.DB.prepare(`INSERT INTO kit_broadcasts (id, subject, sent_at, recipients, open_rate, click_rate, clicks, unsubscribes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const [b, st] of stats) {
    stmts.push(insB.bind(b.id, b.subject, b.send_at, st.recipients ?? null, st.open_rate ?? null, st.click_rate ?? null,
      st.total_clicks ?? null, st.unsubscribes ?? null));
  }
  await env.DB.batch(stmts);
  await setMeta(env, 'kit_drafts', String(all.filter((b) => !b.send_at).length));
  return `${subs.length} subscriber(s), ${sent.length} sent email(s)`;
}

// ----------------------------------------------------------------- Cloudflare

async function syncCloudflare(env, budget) {
  if (!env.CF_API_TOKEN) throw new Error('CF_API_TOKEN is not set');
  const gql = async (query, variables) => {
    const r = await fetch(`${CF}/graphql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json();
    if (j.errors?.length) throw new Error(`Cloudflare: ${j.errors[0].message}`);
    return j.data.viewer.accounts[0];
  };

  // Which Web Analytics site is the beacon: the tag with the most visits.
  let site = env.CF_SITE_TAG || (await getMeta(env, 'cf_site'));
  if (!site) {
    const a = await gql(`query($a: string!, $s: Date!, $e: Date!) { viewer { accounts(filter: { accountTag: $a }) {
      rumPageloadEventsAdaptiveGroups(limit: 5, filter: { date_geq: $s, date_leq: $e, requestHost_in: ["${SITE_HOST}", "www.${SITE_HOST}"] }, orderBy: [sum_visits_DESC]) {
        sum { visits } dimensions { siteTag } } } } }`, { a: env.CF_ACCOUNT_ID, s: addDays(today(), -27), e: today() });
    site = a.rumPageloadEventsAdaptiveGroups[0]?.dimensions.siteTag;
    if (!site) throw new Error('No Web Analytics data for siddhants.com');
    await setMeta(env, 'cf_site', site);
  }

  const pull = async (start, end) => {
    const a = await gql(`query($a: string!, $site: string!, $s: Date!, $e: Date!) { viewer { accounts(filter: { accountTag: $a }) {
      daily: rumPageloadEventsAdaptiveGroups(limit: 200, filter: { siteTag: $site, date_geq: $s, date_leq: $e, bot: 0 }, orderBy: [date_ASC]) {
        count sum { visits } dimensions { date } }
      paths: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: { siteTag: $site, date_geq: $s, date_leq: $e, bot: 0 }) {
        count sum { visits } dimensions { date requestPath } }
    } } }`, { a: env.CF_ACCOUNT_ID, site, s: start, e: end });
    const stmts = [
      env.DB.prepare('DELETE FROM cf_daily WHERE day BETWEEN ? AND ?').bind(start, end),
      env.DB.prepare('DELETE FROM cf_paths WHERE day BETWEEN ? AND ?').bind(start, end),
    ];
    const d = env.DB.prepare('INSERT OR REPLACE INTO cf_daily (day, visits, pageviews) VALUES (?, ?, ?)');
    const p = env.DB.prepare('INSERT OR REPLACE INTO cf_paths (day, path, visits, pageviews) VALUES (?, ?, ?, ?)');
    for (const r of a.daily) stmts.push(d.bind(r.dimensions.date, r.sum.visits, r.count));
    for (const r of a.paths) stmts.push(p.bind(r.dimensions.date, r.dimensions.requestPath, r.sum.visits, r.count));
    for (let i = 0; i < stmts.length; i += 400) await env.DB.batch(stmts.slice(i, i + 400));
  };

  const end = today();
  await pull(addDays(end, -(RECENT - 1)), end);

  const floor = addDays(end, -(CF_MAX_AGE - 2));
  let cursor = (await getMeta(env, 'cf_cursor')) || addDays(end, -RECENT);
  let chunks = 0;
  while (cursor >= floor && chunks < 2 * budget) {
    const s = maxDate(addDays(cursor, -(CF_CHUNK - 1)), floor);
    await pull(s, cursor);
    cursor = addDays(s, -1);
    await setMeta(env, 'cf_cursor', cursor);
    chunks++;
  }
  return `recent + ${chunks} history chunk(s); history back to ${addDays(cursor, 1)}`;
}

// ================================================================== summary

async function summary(env, days) {
  const end = today();
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  const DB = env.DB;
  const all = (sql, ...b) => DB.prepare(sql).bind(...b).all().then((r) => r.results);
  const one = (sql, ...b) => DB.prepare(sql).bind(...b).first();

  const [
    gcDaily, gcNow, gcPrev, paths, titles, dims, cfDaily, cfNow, cfPrev, cfPaths,
    subs, broadcasts, metaRows, prevPaths,
  ] = await Promise.all([
    all('SELECT day, visits FROM gc_total WHERE day BETWEEN ? AND ? ORDER BY day', start, end),
    one('SELECT COALESCE(SUM(visits),0) AS v FROM gc_total WHERE day BETWEEN ? AND ?', start, end),
    one('SELECT COALESCE(SUM(visits),0) AS v FROM gc_total WHERE day BETWEEN ? AND ?', prevStart, prevEnd),
    all('SELECT path, event, SUM(count) AS n FROM gc_hits WHERE day BETWEEN ? AND ? GROUP BY path, event', start, end),
    all('SELECT path, title FROM gc_titles'),
    all('SELECT dim, name, count FROM gc_dims WHERE range_days = ? ORDER BY count DESC', days),
    all('SELECT day, visits, pageviews FROM cf_daily WHERE day BETWEEN ? AND ? ORDER BY day', start, end),
    one('SELECT COALESCE(SUM(visits),0) AS v, COALESCE(SUM(pageviews),0) AS pv FROM cf_daily WHERE day BETWEEN ? AND ?', start, end),
    one('SELECT COALESCE(SUM(visits),0) AS v FROM cf_daily WHERE day BETWEEN ? AND ?', prevStart, prevEnd),
    all('SELECT path, SUM(visits) AS v, SUM(pageviews) AS pv FROM cf_paths WHERE day BETWEEN ? AND ? GROUP BY path ORDER BY v DESC LIMIT 15', start, end),
    all('SELECT email, first_name, state, created_at, referrer, utm_source, utm_medium, utm_campaign FROM kit_subscribers ORDER BY created_at DESC'),
    all('SELECT subject, sent_at, recipients, open_rate, click_rate, clicks, unsubscribes FROM kit_broadcasts ORDER BY sent_at DESC'),
    all('SELECT key, value FROM meta'),
    all("SELECT path, SUM(count) AS n FROM gc_hits WHERE day BETWEEN ? AND ? AND event = 1 AND (path LIKE 'read/%' OR path LIKE 'subscribe/%') GROUP BY path", prevStart, prevEnd),
  ]);
  const meta = Object.fromEntries(metaRows.map((r) => [r.key, r.value]));
  const titleOf = new Map(titles.map((t) => [t.path, t.title]));

  // Fold events into their page: name + path. Outbound clicks stand alone.
  const pages = new Map();
  const outbound = new Map();
  const row = (path) => {
    if (!pages.has(path)) pages.set(path, { path, title: cleanTitle(titleOf.get(path) || titleOf.get(`${path}/`) || ''), visits: 0, ev: {} });
    return pages.get(path);
  };
  for (const h of paths) {
    if (!h.event) { row(h.path.replace(/(.)\/$/, '$1')).visits += h.n; continue; }
    const out = h.path.match(/^out\/(.+)$/);
    if (out) { outbound.set(out[1], (outbound.get(out[1]) || 0) + h.n); continue; }
    const m = h.path.match(/^([a-z0-9-]+)(\/.*)$/);
    if (!m) continue;
    const r = row(m[2].replace(/(.)\/$/, '$1'));
    r.ev[m[1]] = (r.ev[m[1]] || 0) + h.n;
  }

  const TIME = [['time-15s', 15], ['time-30s', 30], ['time-1m', 60], ['time-2m', 120], ['time-5m', 300], ['time-10m', 600], ['time-20m', 1200]];
  const posts = [];
  for (const p of pages.values()) {
    const e = p.ev;
    // Engaged time: integrate the survival curve over the thresholds. A floor
    // estimate, since time past the last threshold reached is not counted.
    let avg = null, median = null;
    if (p.visits && TIME.some(([k]) => e[k])) {
      let area = 0, prevT = 0, prevShare = 1;
      for (const [k, t] of TIME) {
        const share = Math.min(1, (e[k] || 0) / p.visits);
        area += (t - prevT) * share;
        if (median == null && share < 0.5) median = prevT;
        prevT = t; prevShare = share;
      }
      avg = Math.round(area);
      if (median == null) median = prevT;
    }
    posts.push({
      path: p.path, title: p.title, visits: p.visits,
      engaged30: e['time-30s'] || 0, d50: e['depth-50'] || 0, reads: e.read || 0,
      seen: e['signup-seen'] || 0, subscribed: e.subscribe || 0,
      videoPlays: e['video-play'] || 0, videoDone: e['video-complete'] || 0,
      pdf: (e['pdf-dark'] || 0) + (e['pdf-print'] || 0),
      avgSeconds: avg, medianSeconds: median,
      time: Object.fromEntries(TIME.map(([k]) => [k, e[k] || 0])),
    });
  }
  posts.sort((a, b) => b.visits - a.visits);

  const sum = (k) => posts.reduce((n, p) => n + (p[k] || 0), 0);
  const prevSum = (prefix) => prevPaths.filter((r) => r.path.startsWith(prefix)).reduce((n, r) => n + r.n, 0);
  const active = subs.filter((s) => s.state === 'active');
  const joinedInRange = active.filter((s) => s.created_at?.slice(0, 10) >= start).length;
  const dimsBy = (d) => dims.filter((x) => x.dim === d).map((x) => ({ name: x.name, count: x.count }));
  const signupPage = (s) => { try { return s.referrer ? new URL(s.referrer).pathname.replace(/(.)\/$/, '$1') : null; } catch { return null; } };

  return {
    range: { days, start, end },
    sync: {
      last: meta.last_sync || null, report: safeJson(meta.last_report),
      errors: { goatcounter: meta.err_goatcounter || '', kit: meta.err_kit || '', cloudflare: meta.err_cloudflare || '' },
      history: { goatcounter: meta.gc_cursor ? addDays(meta.gc_cursor, 1) : null, cloudflare: meta.cf_cursor ? addDays(meta.cf_cursor, 1) : null },
      complete: { goatcounter: !!meta.gc_cursor && meta.gc_cursor < GC_FLOOR },
    },
    funnel: {
      visits: gcNow.v, previousVisits: prevStart >= GC_FLOOR ? gcPrev.v : null,
      engaged: sum('engaged30'), halfway: sum('d50'), reads: sum('reads'), previousReads: prevSum('read/'),
      signupSeen: sum('seen'), subscribed: sum('subscribed'), previousSubscribed: prevSum('subscribe/'),
    },
    daily: { goatcounter: gcDaily.map((d) => [d.day, d.visits]), cloudflare: cfDaily.map((d) => [d.day, d.visits]) },
    posts,
    sources: { referrers: dimsBy('toprefs'), campaigns: dimsBy('campaigns') },
    audience: { countries: dimsBy('locations'), browsers: dimsBy('browsers'), systems: dimsBy('systems'), screens: dimsBy('sizes'), languages: dimsBy('languages') },
    outbound: [...outbound].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    // Cloudflare history only reaches back ~6 months; a comparison against a
    // period it does not fully cover would be meaningless, so it is withheld.
    cloudflare: {
      visits: cfNow.v, pageviews: cfNow.pv, paths: cfPaths,
      previousVisits: meta.cf_cursor && addDays(meta.cf_cursor, 1) <= prevStart ? cfPrev.v : null,
    },
    kit: {
      active: active.length, joinedInRange,
      unsubscribed: subs.filter((s) => s.state === 'cancelled').length,
      pending: subs.filter((s) => s.state === 'inactive').length,
      drafts: Number(meta.kit_drafts || 0),
      joined: active.map((s) => s.created_at?.slice(0, 10)).filter(Boolean).sort(),
      subscribers: subs.map((s) => ({
        email: s.email, name: s.first_name, state: s.state, joined: s.created_at,
        page: signupPage(s), source: s.utm_source || null, medium: s.utm_medium || null, campaign: s.utm_campaign || null,
      })),
      broadcasts,
    },
  };
}

function cleanTitle(t) { return (t || '').replace(/\s*\|\s*Siddhant Shah\s*$/, ''); }
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

// ---------------------------------------------------------------- meta

async function getMeta(env, key) { return (await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first())?.value ?? null; }
async function setMeta(env, key, value) { await env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind(key, value).run(); }

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
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(d, n) { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function maxDate(a, b) { return a > b ? a : b; }
function sleep(ms) { return new Promise((ok) => setTimeout(ok, ms)); }
