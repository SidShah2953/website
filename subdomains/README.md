# subdomains

Each folder here is a separate app served on its own subdomain of siddhants.com. None of them is part of the Astro site: the site build, `astro check` and ESLint all skip this folder, and each app deploys on its own.

| Folder | Serves | Deploy |
|---|---|---|
| `analytics/` | analytics.siddhants.com: the readership dashboard (Cloudflare Worker + D1, behind Cloudflare Access) | `cd subdomains/analytics && npx wrangler deploy` |

Secrets never live in this repo, which is public. Each app keeps them in its own gitignored files (`analytics/.dev.vars` locally; Worker secrets via `wrangler secret put` in production).
