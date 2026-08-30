# Contrast audit

    node scripts/checks/contrast.mjs      # capture text runs + screenshots
    python3 scripts/checks/contrast-report.py

Scores every visible text run against WCAG 2.1 AA (4.5:1, or 3:1 for large text)
using the **actual rendered pixels**. Computed `background-color` is useless on
this site — the pages sit on gradients, an SVG line field and a live WebGL
canvas, all of which report `transparent`.

Two traps this had to work around, both of which produced false results first:

- **Mode sampling fails on large text.** The glyphs are the majority of pixels
  in the box, so the "background" came back as the text colour — a bogus 1.00:1
  on the 148px hero. Pixels near the text colour are now excluded, with a ring
  outside the box as fallback.
- **Gradient-filled text has no flat colour to sample.** Anything using
  `background-clip: text` is flagged for eye-checking rather than scored.
