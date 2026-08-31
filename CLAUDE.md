# Siddhant Shah — personal site

Personal portfolio and writing home at `siddhants.com`. This is the primary
professional identity online, not a side project. Design quality is a feature.

## Stack

- **Astro 5** (`output: 'static'`) — no SSR, no adapter. Everything prerenders.
- **React 19** islands via `@astrojs/react` — only where interactivity earns it.
- **Tailwind v4** via `@tailwindcss/vite`.
- **MDX** content with `remark-math` + `rehype-katex` (LaTeX) and Shiki (`dracula`).
- Node **23.6.0** (`.nvmrc`). npm.

```
npm run dev      # astro dev
npm run build    # astro build -> dist/
npm run check    # astro check (types)
npm run preview
```

## Hard constraints

1. **Never break existing URLs.** 46 routes ship today. `/blog/*`, `/posts/*`,
   `/research/*`, `/projects/*` slugs are indexed and linked externally.
   Diff the emitted route list against the baseline after every build.
2. **Content is off-limits during design work.** The four collections in
   `src/content/config.ts` (`blog`, `projects`, `research`, `education`) and all
   MDX under `src/content/` stay as they are. Design changes touch presentation
   only. If a schema genuinely must change, say so first.
3. **KaTeX and Shiki must keep rendering.** Math-heavy posts (`svi-with-pyro`,
   the COIN research series) are the ones most worth reading. Check one after
   any layout or CSS change.
4. **`dist/`, `.astro/`, `node_modules/` and `.claude/` are gitignored.**
   Note the last one: `.claude/skills/site-design/SKILL.md` — the design
   constitution — is **not tracked**, so it will not survive a fresh clone and
   is invisible to collaborators. Only `.claude/settings.json` is tracked.
   Consider un-ignoring `.claude/skills/`.
5. Work on a branch off `Experiments`.

## Structure

```
src/
  content/{blog,projects,research,education}/   # MDX + JSON, do not restyle
  content/config.ts                             # collection schemas
  pages/                                        # routes; [slug] templates
  layouts/                                      # Layout, HomeLayout, ContentListLayout
  components/                                   # .astro mostly; .tsx for islands
  components/seo/                               # schema.org — keep intact
  data/presentation.ts                          # name, bio, socials
  styles/tailwind.css                           # design tokens live here
```

`@/` is aliased to `src/`.

## Performance budget

Measured from a clean build on 2026-08-30 (**48 routes** — this is the true
baseline; the `dist/` committed in git was stale, see below).

| | Baseline | Target |
|---|---|---|
| Wordmark on every page (gz) | **538 KB** | < 15 KB |
| three.js on every page (gz) | 121 KB | 0 on content pages |
| React client (gz) | 57 KB | keep |
| `xlsx` on 2 posts (gz) | 139 KB | lazy, on demand |
| Total JS (gz) | 321 KB | — |
| Routes emitted | 48 | 48 |

Three known weights, worst first:

1. **`src/components/shared/name-by-aditi.svg` is 720 KB** and is *not* vector —
   zero `<path>` elements, just a base64-embedded raster inside an `<svg>`
   wrapper. It gzips to **538 KB**, loads on all 30 HTML pages, and
   `Header.astro` requests it `loading="eager" fetchpriority="high"`. This is
   the single largest performance problem on the site — larger than three.js —
   and it blocks first paint. Redraw it as real vector paths, or export a
   sized WebP.
2. **three.js**: every page, including every blog post, boots React and
   dynamically pulls 121 KB gz to draw two wireframe polyhedra behind the text.
   Content pages must ship **zero** 3D.
3. **`xlsx` (139 KB gz)** loads on `coin-research-202603` and
   `coin-research-202602/model-walkthrough` for `ExcelViewer`. Fine, but it
   should load on interaction, not on page load.

Rules: 3D is homepage-hero only, `client:visible`. Any WebGL needs a static
fallback for no-WebGL **and** for `prefers-reduced-motion`, and must stop its
`requestAnimationFrame` loop when the tab is hidden.

## Open question — renamed COIN slugs

A stale local `dist/` (gitignored, not deployed from) contained
`/blog/coin-research-202602/coin-research-{1..7}-202602/`. Current source
emits `/blog/coin-research-202602/{asc350-gaap-loss,base-chain,coinbase-one,
deribit,developer-platform,eth-staking,model-walkthrough,usdc-stablecoin}/`
plus a new `/blog/coin-research-202603/`.

CI builds from source, so the live site almost certainly serves the new slugs
already. But **if** the numbered slugs were ever deployed and indexed, they are
now 404s and want redirects. Unverified — check the live site before acting.
Either way, do not "fix" a route-list diff by reverting slugs.

## Known issue — iCloud breaks `node_modules`

This repo lives in iCloud Drive, which **flattens symlinks into plain text
files**. On 2026-08-30 all 37 entries in `node_modules/.bin` had become
17-byte text files containing their target paths, and hoisted `esbuild`
copies were left with mismatched host/binary versions — `npm run build`
failed outright. Recovery was `rm -rf node_modules && npm ci`.

If the build dies with `Cannot start service: Host version X does not match
binary version Y`, or `astro: No such file or directory`, that is this, not
your changes. `npm rebuild` is not sufficient; do the full `npm ci`.

The durable fix is to move this repo out of iCloud Drive (git is already the
sync mechanism). Recommended, not yet done.

## Design

See `.claude/skills/site-design/SKILL.md` for the design brief, token system,
motion vocabulary, and the log of directions already tried.
