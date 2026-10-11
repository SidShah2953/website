# analytics.siddhants.com

Private readership dashboard for siddhants.com: GoatCounter, Kit and
Cloudflare Web Analytics on one page.

- **Sync** (cron, every 30 minutes, and the "Sync now" button): pulls each
  source into a D1 database (`schema.sql`) in small, bounded steps. Past days
  never change, so each is fetched once; every run re-pulls only the last 3
  days, all of Kit, and one range of breakdowns in rotation. GoatCounter
  history goes back to Oct 2025; Cloudflare keeps only ~6 months, so the
  database is now the only long-term copy of that.
- **Summary** (`/api/summary`): answers the page from D1 only, for any range,
  in milliseconds. The page never waits on an outside API.

## Access

Cloudflare Access (Zero Trust > Access > Applications) protects the whole
hostname; sign-in is a one-time code emailed to an allowed address. The Worker
also verifies the Access token on every `/api` request and refuses without
it, so it fails closed if Access is ever misconfigured. `ACCESS_TEAM` and
`ACCESS_AUD` in `wrangler.jsonc` must match the Access application.

`workers_dev` and `preview_urls` are off, so the Worker has no
`*.workers.dev` address that would bypass Access.

## Backfill or rebuild the cache

The free plan caps each run at ~50 outside requests, so a full history pull
is easiest from this Mac against the live database:

```sh
# wrangler.backfill.jsonc = wrangler.jsonc with "remote": true on the D1
# binding and no routes (gitignored)
npx wrangler dev -c wrangler.backfill.jsonc --port 8796
curl -X POST "http://localhost:8796/api/sync?budget=30&dims=all"
```

To start over: delete the rows (and the `gc_cursor` / `cf_cursor` meta keys)
and run it again. GoatCounter labels days in the site's timezone, so its
windows come back shifted by a day: the sync upserts days, never clears a
window.

## Run and deploy

```sh
npx wrangler dev          # local, reads .dev.vars (DEV=1 skips the Access check)
npx wrangler deploy       # publishes to analytics.siddhants.com
npx wrangler secret put GOATCOUNTER_TOKEN   # and KIT_API_KEY, CF_API_TOKEN
```

## Sources

| Source | Key | Scope |
|---|---|---|
| GoatCounter | `GOATCOUNTER_TOKEN` | siddhants.goatcounter.com > Settings > API, "Read statistics" only |
| Kit | `KIT_API_KEY` | the same v4 key the website's newsletter job uses |
| Cloudflare | `CF_API_TOKEN` | custom token, Account > Account Analytics > Read |

Read depth: the site sends `depth-25|50|75|100<path>` and `read<path>` as
GoatCounter events (website repo, `src/components/ReadDepth.astro`); the
Worker folds them into each post's row.
