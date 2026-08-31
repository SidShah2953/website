# siddhants.com

Personal writing site. This is the primary professional identity online, not a
side project — design quality is a feature.

## Stack

- **Astro 5**, `output: 'static'`. No SSR, no adapter, no React, no Tailwind.
- **MDX** content collections; `remark-math` + `rehype-katex`; Shiki.
- `src/layouts/Shell.astro` is the **only** layout and owns every design token.
- `src/components/Surface.astro` is a raw WebGL2 raymarched heightfield.
- Node 24 (`.nvmrc`).

```
npm run dev            npm run check          # astro check
npm run build          npm run check:links    # internal links resolve
npm run favicon        npm run check:readdepth
npm run newsletter:dry
```

## Deploy — read this before touching CI

**Cloudflare Pages builds and serves siddhants.com.** It watches `main` and
builds this repo on its own. `.github/workflows/ci.yml` does **not** deploy.

Consequences that have already caused real bugs:

- **Environment variables live in the Cloudflare Pages project**, not in GitHub.
  `PUBLIC_*` is inlined at build time by whichever pipeline builds, so a GitHub
  variable never reaches production.
- **CI is advisory.** A red run does not stop Cloudflare publishing. It means
  roll back or push a fix.
- GitHub Pages was a second, parallel deploy that nothing pointed at. It is
  gone; do not reintroduce it.

## Hard constraints

1. **Never break a URL.** Renames need redirects in `astro.config.mjs` for the
   *parts*, not just the index — this was missed once when the COIN series was
   renamed 202602 → 202603 and eight URLs 404'd. Run `npm run check:links`.
2. **Themes are tagged inline in MDX bodies**, not front matter:
   `<T k="slug">text</T>`. Unknown slugs fail the build. See `src/data/themes.ts`.
3. **`newsletter: true` is the only thing that emails anyone.** Drafts only —
   sending stays manual. See `scripts/newsletter.mjs`.
4. **Audit the built output, not `astro dev`.** Dev does not load scoped styles
   for MDX-imported components. Serve `dist` with `npx serve dist` — *without*
   `-s`, which serves the homepage for every URL and hides 404s.

## Gotchas paid for already

- `color-mix()` against an unregistered custom property computes to **black** in
  Chromium. Derive colours at build time.
- Kit expects `email_address`, not `email`. The wrong name returns 200 and
  silently drops the subscriber.
- Astro lowercases slugs; source folders are not lowercased.
- With `flex-wrap: wrap`, `flex-shrink` does nothing — the browser wraps instead.
  Size the flex-basis so no wrap is triggered.
- Cloudflare **Bot Fight Mode** 403s feed readers, sitemaps, and any non-browser
  client, including anything trying to verify the live site. Leave it off.

## Checks

`scripts/checks/` — contrast (against real rendered pixels; computed
`background-color` is useless over gradients), responsive, snap, readdepth,
links. `.claude/skills/site-design/SKILL.md` is the design brief.
