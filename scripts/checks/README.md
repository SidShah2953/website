# Layout checks

Headless-browser probes used while building the word map and the snap layout.
They measure the real DOM rather than trusting estimated text metrics — which is
how the label-overlap bugs were found and fixed.

    node scripts/checks/measure.mjs   # section heights + term/anchor overlaps
    node scripts/checks/nodrift.mjs   # overlaps with the drift animation off
    node scripts/checks/diag.mjs      # names the specific overlapping pairs
    node scripts/checks/snap.mjs      # snap type, slide heights, rest positions
    node scripts/checks/w.mjs         # measured vs estimated label widths

Run `npm run dev` first. Edit the viewport in each file to test a size.
