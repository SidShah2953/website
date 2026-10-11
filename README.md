# analytics.siddhants.com

Private readership dashboard for siddhants.com: GoatCounter, Kit and
Cloudflare Web Analytics on one page. A Cloudflare Worker serves the page and
an `/api/summary` endpoint that calls the three APIs server side (keys are
Worker secrets) and caches the result for 10 minutes.

## Access

Cloudflare Access (Zero Trust > Access > Applications) protects the whole
hostname; sign-in is a one-time code emailed to an allowed address. The Worker
also verifies the Access token on every `/api` request and refuses without
it, so it fails closed if Access is ever misconfigured. `ACCESS_TEAM` and
`ACCESS_AUD` in `wrangler.jsonc` must match the Access application.

`workers_dev` and `preview_urls` are off, so the Worker has no
`*.workers.dev` address that would bypass Access.

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
