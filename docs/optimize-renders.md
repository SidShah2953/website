# Render and motion pass, November 2026

Branch `optimize-renders`. Local only: not pushed, not deployed.

## The "Vercel 3D physics library"

Checked on the web and on npm (2026-11-21):

- **There is no Vercel physics library.** The physics stack in Vercel's own
  3D posts (the 2024 conference badge) is `@react-three/rapier`, which is
  maintained by pmndrs, on top of Rapier by Dimforge. React Three Fiber and
  drei are pmndrs too; a Vercel engineer maintains R3F, which is probably the
  source of the association.
- **What Vercel does publish** is `vgpu` (github.com/vercel-labs/vgpu, npm
  `vgpu` 0.6.0, August 2026): a TypeScript WebGPU library for writing shaders.
  No physics, WebGPU only (no WebGL2 fallback), pre-1.0.
- **Not used, on purpose.** The hero is one 5 KB (gzipped) WebGL2 shader. R3F +
  Rapier would add several hundred KB of JS and WASM for rigid-body physics the
  design does not have, and vgpu would drop every browser without WebGPU. The
  "physics" in the hero is optics (thin-film interference), already computed
  per pixel. The gains below come from doing less work, not from a library.

## How it was measured

`scripts/checks/perf.mjs` against the built site served with compression, in
headless Chrome 157 on this Mac (Apple M5 GPU, ANGLE Metal):

- **Phone**: 390x844 at 3x, touch, 4x CPU throttle, slow 4G (150 ms RTT, 1.6 Mbps).
- **Laptop**: 1440x900 at 2x, no throttle.
- Each page loaded three times (median); then 8 s of scripted scroll and
  pointer movement with a rAF probe for frame times. GPU ms is the time to
  finish one hero frame at the page's own resolution, at the top and bottom of
  the page. Analytics requests blocked.

The M5 holds 60 fps on the phone profile both before and after, so phone frame
times are vsync-bound and equal; the phone gains show as main-thread time,
LCP and CLS. A real phone GPU is far slower than an M5: the GPU column is the
number to compare.

## Before and after

Homepage, phone profile:

| | main | branch |
|---|---|---|
| LCP | 1132 ms | 940 ms |
| CLS | 0.062 | 0 |
| Main thread at rest, top of page (style / script, ms per s) | 73 / 35 | 4 / 2 |
| Main thread during scroll sweep (script ms per s) | 17.5 | 11.9 |
| Frame time p50 / p95 / p99 | 16.7 / 16.8 / 16.8 | 16.7 / 16.8 / 16.8 |
| GPU per frame at 780x1688 (top / bottom) | 3.2 / 4.5 ms | 3.3 / 5.2 ms (noise) |
| Transfer | 127 KB | 131 KB |

Homepage, laptop profile: frame p95 50 → 33 ms, p99 67 → 50 ms, frames over
33 ms 14.5% → 4.8%. The GPU still needs 17 to 40 ms per frame at 2880x1800 on
an M5, so the laptop hero runs near 30 fps (see "Needs Sid").

Blog post (`/blog/lego-fication-of-finance/`), phone: CLS 0.037 → 0 (fonts
preloaded); LCP 516 → 684 ms, because the preloaded fonts now share the slow
link with the post's lead image. Both stay well inside "good" (2.5 s, 0.1).

The shader source is unchanged: `scripts/checks/shader.mjs` renders main's
shader and this branch's with identical inputs and finds 0 differing pixels.

What changed: scissor the always-transparent top of the frame; at most ~60
draws a second on 120 Hz screens; pointer easing by elapsed time; background
shader compile after first paint; ResizeObserver instead of a layout read
every frame and scroll; the word-map drift stops off screen and no longer
re-solves on every mobile toolbar resize; body fonts preloaded; a one-year
immutable cache for `/_astro/*`.

Tried and dropped: starting the ray march at the heightfield's ceiling (~7% of
pixels near the horizon changed); running the word-map drift as a Web
Animation (Chrome kept it on the main thread at twice the cost).

## Phone bars (black strips)

From Sid's screenshot: the page reached its bottom edge at about (19,25,32)
while Safari filled the toolbar area with the ground (6,12,14). Now the page
is `viewport-fit=cover` with safe-area padding, the ground is on `html`, the
homepage veil ends in solid ground at both edges on phones, and theme-color is
set per page to the colour actually at the top edge.

`scripts/checks/edges.mjs`, 390x844 with emulated insets (47 top, 34 bottom),
max channel distance on the edge row (top against theme-color, bottom against
the ground):

| | main | branch |
|---|---|---|
| Homepage top / bottom | 1 / 32 | 0 / 0 |
| Interior pages: top row vs theme-color | 24 | 1 (theme-color now #021B27) |

Only a real iPhone can confirm Safari's own bar tinting (iOS 26 samples the
page rather than theme-color in some cases), toolbar collapse, and home-screen
launches.

## One swipe, one section (phones)

`src/scripts/sections.ts`; desktop keeps CSS snap. `scripts/checks/sections.mjs`
drives real CDP touch gestures at 320x568, 390x664 and 430x740: long and short
flicks, slow drags, taps, bursts of three, and a second flick mid-transition.
Final run: 600 of 600 gestures passed (200 at each size, seed 23); earlier
random seeds 360 of 360 and 359 of 360 before the last fix (release velocity
at a tall slide's edge).

Not covered by headless Chrome: iOS Safari's momentum and rubber-band
behaviour, and the dynamic toolbar.

## Motion menu

Built (one commit each, so any can be reverted alone):

1. **Page transitions with the name settling into the header.** Cross-document
   View Transitions, CSS only, 280 ms; off under Reduce Motion. Low cost, low
   risk (unsupported browsers navigate as before).
2. **Reading progress hairline** on posts, research and projects. CSS scroll
   timeline, no script, fixed position (no layout shift). Low cost, low risk.
3. **Press feedback**: Subscribe and blog filters scale to 0.97, 150 ms. Tiny.
4. **Section entrances from 0.97 scale** as well as 34 px low (the "never from
   zero" rule). Tiny.

Not built, for Sid to pick:

5. **Kinetic hero name**: letters settle in with a short stagger on first visit
   only. Medium cost; risk of reading as a template effect.
6. **Tilt depth on phones**: the hero camera follows the phone's tilt the way it
   follows the pointer. Needs a motion-permission prompt on iOS. Medium.
7. **Blog list hover**: the row's title shifts 4 px and its date brightens,
   under 200 ms. Low.
8. **Theme map ↔ list shared-element morph** (the brief's "primary joy
   moment"). High cost; worth its own pass.

## Follow-ups Sid approved (2026-11-22)

Each is its own commit.

- **Laptop hero at 1.5x** (fine-pointer devices; phones keep 2x). Laptop
  profile, homepage: frame p95 50 → 16.8 ms, p99 67 → 16.8 ms, frames over
  33 ms 14.5% → 0%; GPU per frame (top / bottom of page) 17-23 / 31-42 ms →
  9.8 / 19.2 ms. Shader source still pixel-identical to main.
- **Seven self-referencing tokens restored** (`--header-bg`, `--haze-*`,
  `--surface-3`, `--code-bg`, `--selection`) to their pre-7a39920 literals,
  with the teal haze (#0E5560 → #0E4260) and selection moved to the blue
  accent as 5148d06 did for every other tint. On screen: interior headers are
  filled again (rgba(5,12,15,.72)), inline code has its chip, the homepage
  haze draws. Print and PDF (light and dark) compute exactly as before: the
  header is hidden there and print.css sets its own code colours. Interior
  theme-color follows the filled header: #051016 (top row 1 level off).
  The haze adds about 1 ms of GPU per frame on the phone profile (M5).
- **Blog index layout shift**: the cause was the font swap. Georgia runs ~7%
  wider than Newsreader 300, so paragraphs re-wrapped when the web font
  arrived. Metric-matched local fallback faces (size-adjust and ascent /
  descent overrides, measured over the page's own text) fix it: phone CLS
  on /blog/ 0.33 → 0.0003, and 0 on the homepage and posts. Android has no
  Georgia or Helvetica, so it falls through to its own serif unadjusted;
  only a real Android phone shows how much that moves.

Re-run after these: gestures 360 of 360; phone frame p95 16.8 ms; edges 0 / 0
on the homepage, top row 1 level off theme-color on interior pages.
