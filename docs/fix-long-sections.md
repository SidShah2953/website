# fix-long-sections: status at pause (2026-11-22)

Local branch only. Not pushed, not deployed. Base: main b8254dd.

## Done
- `src/scripts/sections.ts` rewritten: on touch screens a slide taller than
  the screen gets class `long` (one screen tall, `overflow-y:auto`,
  `overscroll-behavior:contain`, padded below the header; CSS in
  `src/pages/index.astro`). Native momentum stays inside it. The controller
  hands off only on a new gesture that starts at the edge and pulls out
  ≥ 56 px or flicks ≥ 0.5 px/ms. The old fence (root clip + jump) and the
  post-scroll snap (`rest()`) are gone. Entering from below lands on the
  long slide's end. Keyboard pages through a long slide first. Anchors reveal
  the target inside its slide. Slide and inner positions are saved in
  `history.state` and restored on back, bfcache and reload.
- `scripts/checks/sections.mjs` updated to this model (not yet re-run).
- New `scripts/checks/longsections.mjs` (frame-level assertions). First run:
  128/132.

## Failing (to fix next)
1. burst at 390x664 and 430x740: three flicks at a long slide's end gave
   2 to 3 moves. The handoff lands on a fitting slide and the next flicks are
   read as fresh 'own' gestures once the 120 ms cooldown ends. Decide: a
   longer cooldown after a handoff, or have the test count only gestures
   that started outside a transition (as sections.mjs does with `starts`).
2. back at 320x568: one swipe back from the slide after the long one moved
   two slides (y 1704 to 1136, moves 2). Probably the same cause as 1
   (`place()` then swipe). Re-check with a probe.
3. inside at 430x740: a 180 px flick from the long slide's start left it
   (moves 1). At 430 the slide is only 231 px longer than the screen, so the
   first flick's momentum reaches the end and the second gesture (120 px
   drag 700 ms later) starts at the edge and is a legal handoff. Fix the test
   (make the second gesture a drag that does not start at the edge) rather
   than the controller.

## Next steps
1. Fix the items above. Re-run `longsections.mjs` (target: all pass at
   320/390/430), `sections.mjs --n 120`, `chrome.mjs`, `edges.mjs`,
   `shader.mjs`, `perf.mjs --runs 3`, `npm run check`, `npm run build`,
   `npm run check:links`.
2. Bar colour for ALL pages (not started): extend `--chrome` and theme-color
   to the blog index, posts (`/blog/[...slug]`, `/posts`), about, education,
   experience, projects, research, themes, notes and 404. Interior pages use
   atmosphere "lines" (`.lines::after` gradient in Shell.astro) and
   theme-color #051016 (filled header). Measure the top and bottom safe-area
   strips per page with a new check that visits every route in dist (skip
   `/private/`, which is a standalone unlisted page, and redirect stubs), at
   scroll top, middle and end, under both prefers-color-scheme values. Then
   make the bottom safe area solid --chrome where the lines gradient or the
   footer shows through.
3. Commit on this branch only. Do not merge, push or deploy: pushing main
   deploys automatically (Cloudflare Pages), so wait for Sid's go-ahead.
4. Build in a clean clone: the repo's `.env` is owned by sidshah and is
   unreadable to the claude user, so `npm run build` fails in place.
