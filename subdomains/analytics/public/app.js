// Draws the dashboard from /api/summary, which reads only the D1 cache.
// No libraries: SVG line charts, a funnel, tables and bar lists.

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US');
const pct = (x) => (x == null || !isFinite(x) ? '–' : `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`);
const ratio = (a, b) => (b ? a / b : null);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayLabel = (d) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dur = (s) => (s == null ? '–' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);
const ago = (iso) => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

const COLORS = { gc: '#45B5ED', cf: '#8CA2A6', subs: '#45B5ED' };
const TIME_MARKS = [['time-15s', '15s'], ['time-30s', '30s'], ['time-1m', '1 min'], ['time-2m', '2 min'], ['time-5m', '5 min'], ['time-10m', '10 min'], ['time-20m', '20 min']];

let days = 30;
try { days = Number(localStorage.getItem('days')) || 30; } catch {}
let last = null;

async function load() {
  for (const b of $('range').querySelectorAll('button')) b.setAttribute('aria-selected', String(Number(b.dataset.days) === days));
  try {
    const r = await fetch(`/api/summary?days=${days}`, { credentials: 'same-origin' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.status);
    render(data);
  } catch (e) {
    $('status').innerHTML = `<span class="err">Could not load: ${esc(e.message)}</span>`;
  }
}

async function syncNow() {
  const btn = $('sync');
  btn.disabled = true; btn.textContent = 'Syncing...';
  try {
    const r = await fetch(`/api/sync?budget=1&dims=${days}`, { method: 'POST', credentials: 'same-origin' });
    if (!r.ok) throw new Error((await r.json()).error || r.status);
    await load();
  } catch (e) {
    $('status').innerHTML = `<span class="err">Sync failed: ${esc(e.message)}</span>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Sync now';
  }
}

function render(d) {
  last = d;
  const f = d.funnel, k = d.kit;
  $('who').textContent = d.viewer ? `Signed in as ${d.viewer}` : '';

  // ---- status line: range, freshness, anything that failed or is still filling
  const errs = Object.entries(d.sync.errors).filter(([, v]) => v);
  const filling = [];
  if (d.sync.history.goatcounter && !d.sync.complete.goatcounter) filling.push(`GoatCounter history loaded back to ${dayLabel(d.sync.history.goatcounter)}`);
  $('status').innerHTML = `${dayLabel(d.range.start)} to ${dayLabel(d.range.end)}. Synced ${ago(d.sync.last)}.`
    + (filling.length ? ` <span class="muted">${esc(filling.join('; '))}, still filling in.</span>` : '')
    + errs.map(([n, v]) => ` <span class="err">${esc(n)}: ${esc(v.replace(/^\S+\s/, ''))}</span>`).join('');

  // ---- tiles
  const change = (now, before) => {
    if (before == null || !before) return '';
    const c = (now - before) / before;
    return `<span class="${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '+' : ''}${(c * 100).toFixed(0)}%</span> vs previous ${d.range.days} days`;
  };
  const postRows = d.posts.filter((p) => p.avgSeconds != null);
  const weighted = postRows.reduce((n, p) => n + p.avgSeconds * p.visits, 0);
  const weight = postRows.reduce((n, p) => n + p.visits, 0);
  const tile = (label, value, sub) => `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub || '&nbsp;'}</div></div>`;
  $('tiles').innerHTML = [
    tile('Visitors', fmt.format(f.visits), change(f.visits, f.previousVisits)),
    tile('Full reads', fmt.format(f.reads), change(f.reads, f.previousReads) || `${pct(ratio(f.reads, f.visits))} of visitors`),
    tile('Avg engaged time on posts', weight ? dur(Math.round(weighted / weight)) : '–', weight ? 'estimated, from time marks' : 'tracking from 11 Oct'),
    tile('Subscribers', fmt.format(k.active), `${k.joinedInRange >= 0 ? '+' : ''}${k.joinedInRange} in this range${k.pending ? `, ${k.pending} unconfirmed` : ''}`),
    tile('Signup rate', pct(ratio(f.subscribed, f.signupSeen)), f.signupSeen ? `${f.subscribed} of ${f.signupSeen} who saw the form` : 'tracking from 11 Oct'),
    tile('Visits, Cloudflare', fmt.format(d.cloudflare.visits), change(d.cloudflare.visits, d.cloudflare.previousVisits) || 'includes automated traffic'),
  ].join('');

  // ---- funnel
  // Stages measured only since 11 Oct 2026 are flagged, and skipped as the
  // base of the next step while they are still empty.
  const NEW = new Set(['Engaged 30s+', 'Saw the signup form', 'Subscribed']);
  const stages = [
    ['Visited', f.visits], ['Engaged 30s+', f.engaged], ['Reached halfway', f.halfway],
    ['Read it', f.reads], ['Saw the signup form', f.signupSeen], ['Subscribed', f.subscribed],
  ];
  const top = Math.max(1, f.visits);
  let base = null;
  $('funnel').innerHTML = stages.map(([label, n], i) => {
    const step = base == null ? null : ratio(n, base);
    if (n || !NEW.has(label)) base = n;
    const tag = NEW.has(label) && d.range.start < '2026-10-11' ? '<small>tracked from 11 Oct</small>' : '';
    return `<li><span class="fl">${label}${tag}</span><span class="fb"><b style="width:${Math.max(0.5, (n / top) * 100)}%"></b></span>
      <span class="fn">${fmt.format(n)}</span><span class="fp">${pct(ratio(n, top))}${i && step != null ? `<small>${pct(step)} of previous</small>` : ''}</span></li>`;
  }).join('');

  // ---- visits chart
  const series = [{ name: 'GoatCounter', color: COLORS.gc, points: fillDays(d.range, d.daily.goatcounter) }];
  if (d.daily.cloudflare.length) series.push({ name: 'Cloudflare', color: COLORS.cf, dash: '5 4', points: fillDays(d.range, d.daily.cloudflare) });
  $('visits-legend').innerHTML = series.length > 1
    ? series.map((s) => `<span><i style="border-color:${s.color};border-top-style:${s.dash ? 'dashed' : 'solid'}"></i>${s.name}</span>`).join('') : '';
  lineChart($('visits-chart'), series);

  // ---- posts
  // Essays and projects only; tag, index and system pages would bury them.
  const posts = d.posts.filter((p) => /^\/(blog|research|projects|notes)\/./.test(p.path) && (p.visits || p.reads)).slice(0, 30);
  $('posts').innerHTML = posts.length ? `<thead><tr><th>Post</th><th>Visitors</th><th>Avg time</th><th>Median</th>
      <th>Engaged 30s</th><th>Halfway</th><th>Read</th><th>Signups</th><th>Video</th><th>PDF</th></tr></thead><tbody>`
    + posts.map((p) => `<tr><td>${esc(p.title || p.path)}<small>${esc(p.path)}</small></td>
        <td>${fmt.format(p.visits)}</td><td>${dur(p.avgSeconds)}</td><td>${dur(p.medianSeconds)}</td>
        <td>${rate(p.engaged30, p.visits)}</td><td>${rate(p.d50, p.visits)}</td><td>${rate(p.reads, p.visits)}</td>
        <td>${p.subscribed ? `${p.subscribed}<small class="inline"> of ${p.seen} saw</small>` : (p.seen ? `0<small class="inline"> of ${p.seen}</small>` : '–')}</td>
        <td>${p.videoPlays ? `${p.videoPlays}<small class="inline"> / ${p.videoDone} done</small>` : '–'}</td>
        <td>${p.pdf || '–'}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="none">No visits in this range.</td></tr></tbody>';

  // ---- time distribution, across post visitors with time data
  const tv = postRows.reduce((n, p) => n + p.visits, 0);
  bars($('time-dist'), tv ? TIME_MARKS.map(([key, label]) => ({
    name: `${label} or more`, count: postRows.reduce((n, p) => n + (p.time[key] || 0), 0), of: tv,
  })) : [], { percent: true, empty: 'Starts filling in from 11 Oct as people read.' });

  // ---- where subscribers signed up
  const byPage = new Map();
  for (const s of k.subscribers.filter((x) => x.state === 'active')) {
    const key = s.page || '(unknown: signed up before tracking)';
    byPage.set(key, (byPage.get(key) || 0) + 1);
  }
  bars($('signup-pages'), [...byPage].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));

  bars($('referrers'), d.sources.referrers);
  bars($('campaigns'), d.sources.campaigns, { empty: 'None yet. Newsletter links arrive as "newsletter".' });
  bars($('outbound'), d.outbound, { empty: 'Tracked from 11 Oct.' });
  bars($('countries'), d.audience.countries);
  bars($('screens'), d.audience.screens);
  bars($('languages'), d.audience.languages);
  bars($('browsers'), d.audience.browsers);
  bars($('systems'), d.audience.systems);

  // ---- newsletter
  lineChart($('subs-chart'), [{ name: 'Subscribers', color: COLORS.subs, points: cumulative(k.joined, d.range), area: true }]);
  $('subs-note').textContent = `${fmt.format(k.active)} active, ${k.pending} unconfirmed, ${k.unsubscribed} unsubscribed.${k.drafts ? ` ${k.drafts} draft${k.drafts > 1 ? 's' : ''} waiting in Kit.` : ''}`;
  $('subscribers').innerHTML = k.subscribers.length
    ? `<thead><tr><th>Email</th><th>Joined</th><th>Status</th><th>Signed up on</th><th>Source</th></tr></thead><tbody>`
      + k.subscribers.map((s) => `<tr><td>${esc(s.email)}${s.name ? `<small>${esc(s.name)}</small>` : ''}</td><td>${dayLabel(s.joined)}</td>
        <td>${esc({ active: 'Active', inactive: 'Unconfirmed', cancelled: 'Unsubscribed', bounced: 'Bounced', complained: 'Complained' }[s.state] || s.state)}</td>
        <td>${esc(s.page || '–')}</td><td>${esc([s.source, s.campaign].filter(Boolean).join(' / ') || '–')}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="none">No subscribers yet.</td></tr></tbody>';
  $('broadcasts').innerHTML = k.broadcasts.length
    ? `<thead><tr><th>Email</th><th>Sent</th><th>Recipients</th><th>Opened</th><th>Clicked</th><th>Unsubscribed</th></tr></thead><tbody>`
      + k.broadcasts.map((b) => `<tr><td>${esc(b.subject)}</td><td>${b.sent_at ? dayLabel(b.sent_at) : '–'}</td>
        <td>${b.recipients == null ? '–' : fmt.format(b.recipients)}</td><td>${pct(norm(b.open_rate))}</td>
        <td>${pct(norm(b.click_rate))}</td><td>${b.unsubscribes ?? '–'}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="none">No emails sent yet. Drafts appear here once sent.</td></tr></tbody>';

  $('cf-card').hidden = !d.cloudflare.paths.length;
  bars($('cf-paths'), d.cloudflare.paths.map((p) => ({ name: p.path, count: p.v })));
}

// ------------------------------------------------------------------ pieces

const norm = (r) => (r == null ? null : r > 1 ? r / 100 : r);   // Kit reports 0-100 or 0-1
function rate(n, of) {
  if (!n) return '<span class="dim">0</span>';
  const r = ratio(n, of);
  return `<span class="rate"><b style="width:${Math.round(Math.min(r || 0, 1) * 44)}px"></b><em>${pct(r)}</em></span>`;
}

function bars(el, rows, { percent = false, empty = 'Nothing yet.' } = {}) {
  if (!rows || !rows.length || rows.every((r) => !r.count)) { el.innerHTML = `<li class="none">${esc(empty)}</li>`; return; }
  const max = percent ? 1 : Math.max(...rows.map((r) => r.count));
  el.innerHTML = rows.map((r) => {
    const v = percent ? r.count / r.of : r.count;
    return `<li title="${esc(r.name)}: ${fmt.format(r.count)}"><span class="t">${esc(r.name)}</span>
      <span class="n">${percent ? `${pct(v)} <small>(${fmt.format(r.count)})</small>` : fmt.format(r.count)}</span>
      <span class="b" style="width:${Math.max(1, (v / max) * 100)}%"></span></li>`;
  }).join('');
}

function fillDays(range, pts) {
  const m = new Map(pts);
  const out = [];
  for (let t = new Date(`${range.start}T00:00:00Z`); t <= new Date(`${range.end}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1)) {
    const k = t.toISOString().slice(0, 10);
    out.push([k, m.get(k) || 0]);
  }
  return out;
}

function cumulative(joined, range) {
  let n = joined.filter((d) => d < range.start).length;
  const per = new Map();
  for (const d of joined) if (d >= range.start) per.set(d, (per.get(d) || 0) + 1);
  return fillDays(range, []).map(([d]) => [d, (n += per.get(d) || 0)]);
}

function lineChart(el, series) {
  if (!series.length || !series[0].points.length) { el.innerHTML = '<div class="empty">No data for this range.</div>'; return; }
  const W = el.clientWidth || 800, H = el.clientHeight || 240;
  const pad = { l: 40, r: 12, t: 10, b: 26 };
  const n = series[0].points.length;
  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p[1])));
  const nice = niceMax(max);
  const x = (i) => pad.l + (n === 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v) => H - pad.b - (v / nice) * (H - pad.t - pad.b);

  const levels = Number.isInteger(nice / 2) ? [0, nice / 2, nice] : [0, nice];
  const ticks = levels.map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`).join('');
  const ylab = levels.map((v) => `<text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmt.format(v)}</text>`).join('');
  const every = Math.max(1, Math.ceil(n / (W < 520 ? 3 : 6)));
  const xlab = series[0].points.map((p, i) => (i % every === 0 || i === n - 1) && !(i !== n - 1 && n - 1 - i < every / 2)
    ? `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${dayLabel(p[0])}</text>` : '').join('');

  const paths = series.map((s) => {
    const dd = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    const area = s.area ? `<path d="${dd}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="${s.color}" opacity=".08"/>` : '';
    return `${area}<path d="${dd}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.name).join(' and '))} per day">
    <g class="grid">${ticks}</g><g class="axis">${ylab}${xlab}</g>${paths}
    <line class="cross" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
    <g class="dots"></g>
    <rect x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/></svg>`;

  const svg = el.querySelector('svg'), cross = svg.querySelector('.cross'), dots = svg.querySelector('.dots'), tip = $('tip');
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1))));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    dots.innerHTML = series.map((s) => `<circle cx="${x(i)}" cy="${y(s.points[i][1])}" r="4.5" fill="${s.color}" stroke="#0A1418" stroke-width="2"/>`).join('');
    tip.innerHTML = `<div class="d">${dayLabel(series[0].points[i][0])}</div>` + series.map((s) =>
      `<div class="r"><i style="border-color:${s.color};border-top-style:${s.dash ? 'dashed' : 'solid'}"></i>${s.name} <b>${fmt.format(s.points[i][1])}</b></div>`).join('');
    tip.hidden = false;
    tip.style.left = `${Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${ev.clientY - tip.offsetHeight - 12}px`;
  };
  const leave = () => { cross.setAttribute('visibility', 'hidden'); dots.innerHTML = ''; tip.hidden = true; };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// ------------------------------------------------------------------- wiring

$('range').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-days]');
  if (!b) return;
  days = Number(b.dataset.days);
  try { localStorage.setItem('days', String(days)); } catch {}
  load();
});
$('sync').addEventListener('click', syncNow);
let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => last && render(last), 150); });
load();
