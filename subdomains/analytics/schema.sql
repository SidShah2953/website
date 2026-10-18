-- Readership cache. Filled by the scheduled sync in src/worker.js; the
-- dashboard reads only from here. Past days never change, so each is fetched
-- once; the sync re-pulls only the last few days (still filling in) and Kit.
--
--   npx wrangler d1 execute siddhants-analytics --remote --file schema.sql

-- GoatCounter, per day and path. Pages and events alike: an event's path is
-- `<name><page>` (read/blog/x, time-1m/blog/x, subscribe/blog/x, out/host).
CREATE TABLE IF NOT EXISTS gc_hits (
  day TEXT NOT NULL, path TEXT NOT NULL, event INTEGER NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY (day, path)
);
CREATE INDEX IF NOT EXISTS gc_hits_path ON gc_hits (path);
CREATE TABLE IF NOT EXISTS gc_titles (path TEXT PRIMARY KEY, title TEXT);
-- Site-wide visits per day (not the sum of paths: a visitor counts once).
CREATE TABLE IF NOT EXISTS gc_total (day TEXT PRIMARY KEY, visits INTEGER NOT NULL, events INTEGER NOT NULL);
-- Breakdowns (referrers, countries, ...) are only available as totals over a
-- range, so they are kept per supported range and refreshed in rotation.
CREATE TABLE IF NOT EXISTS gc_dims (
  range_days INTEGER NOT NULL, dim TEXT NOT NULL, name TEXT NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY (range_days, dim, name)
);

-- Cloudflare Web Analytics. Cloudflare keeps only ~6 months; this keeps it all.
CREATE TABLE IF NOT EXISTS cf_daily (day TEXT PRIMARY KEY, visits INTEGER NOT NULL, pageviews INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cf_paths (
  day TEXT NOT NULL, path TEXT NOT NULL, visits INTEGER NOT NULL, pageviews INTEGER NOT NULL,
  PRIMARY KEY (day, path)
);

-- Kit, as of the last sync (small; replaced each time).
CREATE TABLE IF NOT EXISTS kit_subscribers (
  id INTEGER PRIMARY KEY, email TEXT, first_name TEXT, state TEXT, created_at TEXT,
  referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT
);
CREATE TABLE IF NOT EXISTS kit_broadcasts (
  id INTEGER PRIMARY KEY, subject TEXT, sent_at TEXT, recipients INTEGER,
  open_rate REAL, click_rate REAL, clicks INTEGER, unsubscribes INTEGER
);

-- Sync bookkeeping: last run, backfill cursors, per-source errors.
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
