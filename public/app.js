// Draws the dashboard from /api/summary. No libraries: two line charts in SVG,
// a few tables, a few bar lists.

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US');
const pct = (x) => (x == null || !isFinite(x) ? '–' : `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayLabel = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const COLORS = { gc: '#45B5ED', cf: '#8CA2A6', subs: '#45B5ED' };

let days = 30;
try { days = Number(localStorage.getItem('days')) || 30; } catch {}

async function load(fresh = false) {
  for (const b of $('range').querySelectorAll('button')) b.setAttribute('aria-selected', String(Number(b.dataset.days) === days));
  $('status').textContent = 'Loading...';
  let data;
  try {
    const r = await fetch(`/api/summary?days=${days}${fresh ? '&fresh=1' : ''}`, { credentials: 'same-origin' });
    data = await r.json();
    if (!r.ok) throw new Error(data.error || r.status);
  } catch (e) {
    $('status').innerHTML = `<span class="err">Could not load: ${esc(e.message)}</span>`;
    return;
  }
  render(data);
}

let last = null;

function render(d) {
  last = d;
  const { goatcounter: gc, kit, cloudflare: cf } = d;
  $('who').textContent = d.viewer ? `Signed in as ${d.viewer}` : '';
  const errs = [['GoatCounter', gc], ['Kit', kit], ['Cloudflare', cf]].filter(([, s]) => s?.error);
  const when = new Date(d.generated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  $('status').innerHTML = `${dayLabel(d.range.start)} to ${dayLabel(d.range.end)}. Numbers as of ${when}.`
    + errs.map(([n, s]) => ` <span class="err">${n}: ${esc(s.error)}.</span>`).join('');

  // ---- tiles
  const reads = gc?.posts?.reduce((n, p) => n + p.reads, 0);
  const change = (now, before) => {
    if (!before) return '';
    const c = (now - before) / before;
    return `<span class="${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '+' : ''}${(c * 100).toFixed(0)}%</span> vs previous ${d.range.days} days`;
  };
  const tile = (label, value, sub) => `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub || '&nbsp;'}</div></div>`;
  $('tiles').innerHTML = [
    tile('Visits, GoatCounter', gc?.error ? '–' : fmt.format(gc.visits), gc?.error ? '' : change(gc.visits, gc.previousVisits)),
    tile('Visits, Cloudflare', cf?.error ? '–' : fmt.format(cf.visits), cf?.error ? 'not connected' : change(cf.visits, cf.previousVisits)),
    tile('Full reads', gc?.error ? '–' : fmt.format(reads), gc?.error ? '' : 'read to the end, with time spent'),
    tile('Subscribers', kit?.error ? '–' : fmt.format(kit.subscribers),
      kit?.error ? '' : `${kit.newInRange >= 0 ? '+' : ''}${fmt.format(kit.newInRange)} in this range`),
  ].join('');

  // ---- visits chart
  const series = [];
  if (gc && !gc.error) series.push({ name: 'GoatCounter', color: COLORS.gc, points: gc.daily.map((p) => [p.day, p.count]) });
  if (cf && !cf.error) series.push({ name: 'Cloudflare', color: COLORS.cf, dash: '5 4', points: fillDays(d.range, cf.daily.map((p) => [p.day, p.visits])) });
  $('visits-legend').innerHTML = series.length > 1
    ? series.map((s) => `<span><i style="border-color:${s.color};border-top-style:${s.dash ? 'dashed' : 'solid'}"></i>${s.name}</span>`).join('') : '';
  lineChart($('visits-chart'), series);

  // ---- posts
  const posts = (gc?.posts || []).filter((p) => p.path.startsWith('/blog/') || p.reads);
  $('posts').innerHTML = posts.length ? `<thead><tr><th>Post</th><th>Visits</th><th>Reached 50%</th><th>Read</th><th>Read rate</th></tr></thead><tbody>`
    + posts.map((p) => {
      const rate = p.visits ? p.reads / p.visits : null;
      return `<tr><td>${esc(cleanTitle(p.title) || p.path)}<small>${esc(p.path)}</small></td>
        <td>${fmt.format(p.visits)}</td><td>${fmt.format(p.d50)}</td><td>${fmt.format(p.reads)}</td>
        <td><span class="rate"><b style="width:${Math.round(Math.min(rate || 0, 1) * 70)}px"></b><em>${pct(rate)}</em></span></td></tr>`;
    }).join('') + '</tbody>'
    : `<tbody><tr><td class="none">${gc?.error ? 'GoatCounter is not connected.' : 'No post visits in this range.'}</td></tr></tbody>`;

  bars($('referrers'), gc?.referrers);
  bars($('countries'), gc?.countries);
  bars($('devices'), gc?.devices);

  // ---- subscribers
  if (kit && !kit.error) {
    const pts = cumulative(kit.joined, d.range);
    lineChart($('subs-chart'), [{ name: 'Subscribers', color: COLORS.subs, points: pts, area: true }]);
    $('subs-note').textContent = `${fmt.format(kit.subscribers)} active${kit.cancellationsInRange ? `, ${kit.cancellationsInRange} unsubscribed in this range` : ''}. ${kit.drafts ? `${kit.drafts} draft${kit.drafts > 1 ? 's' : ''} waiting in Kit.` : ''}`;
    $('broadcasts').innerHTML = kit.broadcasts.length
      ? `<thead><tr><th>Email</th><th>Sent</th><th>Recipients</th><th>Opened</th><th>Clicked</th><th>Unsubscribed</th></tr></thead><tbody>`
        + kit.broadcasts.map((b) => `<tr><td>${esc(b.subject)}</td><td>${b.sentAt ? dayLabel(b.sentAt.slice(0, 10)) : '–'}</td>
          <td>${b.recipients == null ? '–' : fmt.format(b.recipients)}</td><td>${pct(b.openRate / (b.openRate > 1 ? 100 : 1))}</td>
          <td>${pct(b.clickRate / (b.clickRate > 1 ? 100 : 1))}</td><td>${b.unsubscribes ?? '–'}</td></tr>`).join('') + '</tbody>'
      : '<tbody><tr><td class="none">No emails sent yet. Drafts appear here once sent.</td></tr></tbody>';
  } else {
    $('subs-chart').innerHTML = '<div class="empty">Kit is not connected.</div>';
    $('broadcasts').innerHTML = '';
  }

  // ---- Cloudflare paths
  $('cf-card').hidden = !cf || !!cf.error;
  if (cf && !cf.error) bars($('cf-paths'), cf.paths.map((p) => ({ name: p.path, count: p.visits })));
}

// ------------------------------------------------------------------ pieces

function cleanTitle(t) { return (t || '').replace(/\s*\|\s*Siddhant Shah\s*$/, ''); }

function bars(el, rows) {
  if (!rows || !rows.length) { el.innerHTML = '<li class="none">Nothing yet.</li>'; return; }
  const max = Math.max(...rows.map((r) => r.count));
  el.innerHTML = rows.map((r) => `<li title="${esc(r.name)}: ${fmt.format(r.count)}"><span class="t">${esc(r.name)}</span><span class="n">${fmt.format(r.count)}</span>
    <span class="b" style="width:${Math.max(2, (r.count / max) * 100)}%"></span></li>`).join('');
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
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    const area = s.area ? `<path d="${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="${s.color}" opacity=".08"/>` : '';
    return `${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.name).join(' and '))} per day">
    <g class="grid">${ticks}</g><g class="axis">${ylab}${xlab}</g>${paths}
    <line class="cross" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
    <g class="dots"></g>
    <rect x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/></svg>`;

  // Crosshair and tooltip
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
    const tx = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8);
    tip.style.left = `${tx}px`; tip.style.top = `${ev.clientY - tip.offsetHeight - 12}px`;
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
$('refresh').addEventListener('click', () => load(true));
let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => last && render(last), 150); });
load();
