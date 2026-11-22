// Homepage slide-scroll check: real touch gestures through CDP at phone sizes,
// asserting that every gesture moves at most one slide and always comes to
// rest on a valid position.
//
//   npm run build && npx serve dist -l 4321
//   node scripts/checks/sections.mjs [--base http://localhost:4321] [--n 120] [--seed 1]
//
// Gestures, picked at random from random starting slides:
//   long   400 px flick in 90 ms     short  60 px flick in 70 ms
//   drag   250 px over 600 ms        tiny   10 px (must not move)
//   burst  three long flicks 60 ms apart (only those begun outside a
//          transition may move, one slide each)
//   (touches start in the 6 px left gutter, so a tap never follows a link)
//   mid    a flick, then a second one 200 ms later, mid-transition (swallowed)
//
// A rest position is valid when the viewport top is on a slide's top (a slide
// that fits the screen) or anywhere within a tall slide's own scroll range.
// "One per gesture": the slide index changes by at most 1, and by exactly 1
// for an intentful gesture that starts on a slide that fits.
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:4321");
const N = +arg("--n", 120);
let seed = +arg("--seed", 1);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const SIZES = [[320, 568], [390, 664], [430, 740]];   // phone widths, visible heights with toolbars
const KINDS = ["long", "short", "drag", "tiny", "burst", "mid"];
const SETTLE = 950;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runSize(browser, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route((u) => !u.href.startsWith(BASE), (r) => r.abort());
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE + "/", { waitUntil: "load" });
  await sleep(800);
  const geo = () => page.evaluate(() => {
    const top = (e) => { let y = 0; for (let n = e; n; n = n.offsetParent) y += n.offsetTop; return y; };
    const s = [...document.querySelectorAll(".slide")].map((e) => [top(e), e.offsetHeight]);
    return { y: scrollY, vh: innerHeight, s, js: document.documentElement.classList.contains("snap-js") };
  });
  const state = (g) => {
    const y = g.y; let i = 0;
    g.s.forEach(([t], k) => { if (t <= y + 2) i = k; });
    const [t, hh] = g.s[i], tall = hh > g.vh + 2, end = t + Math.max(0, hh - g.vh);
    const valid = tall ? y >= t - 2 && y <= end + 2 : Math.abs(y - t) <= 2;
    return { i, tall, valid, atEnd: Math.abs(y - end) <= 2, atTop: Math.abs(y - t) <= 2 };
  };
  // Each swipe records whether the controller was mid-transition when the
  // finger went down: such a gesture must be swallowed, not counted.
  const swipe = async (dy, ms, steps = 8) => {
    const x = 6, y0 = dy > 0 ? h * .75 : h * .25;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
    // Each dispatch already waits for the renderer to take the event (about
    // one frame), so only sleep for the part of the interval left over.
    for (let k = 1; k <= steps; k++) {
      if (ms / steps > 17) await sleep(ms / steps - 16);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - dy * k / steps }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };

  const g0 = await geo();
  if (!g0.js) throw new Error("controller not active (html.snap-js missing)");
  const res = { size: `${w}x${h}`, runs: 0, pass: 0, fails: [] };
  for (let n = 0; n < N; n++) {
    // start: a random slide, at its top (or for a tall slide, sometimes its end)
    const g = await geo(), k = Math.floor(rnd() * g.s.length);
    const [t, hh] = g.s[k];
    const startY = hh > g.vh + 2 && rnd() < .5 ? t + hh - g.vh : t;
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), startY);
    await sleep(250);
    const before = state(await geo());
    const [m0, f0] = await page.evaluate(() => [window.__sections.moves(), window.__sections.starts()]);
    const kind = KINDS[Math.floor(rnd() * KINDS.length)];
    const dir = rnd() < .5 ? 1 : -1;
    if (kind === "long") await swipe(400 * dir, 90);
    else if (kind === "short") await swipe(60 * dir, 70, 5);
    else if (kind === "drag") await swipe(250 * dir, 600, 20);
    else if (kind === "tiny") await swipe(10 * dir, 80, 4);
    else if (kind === "burst") { for (let r = 0; r < 3; r++) { await swipe(400 * dir, 90); await sleep(60); } }
    else if (kind === "mid") { await swipe(400 * dir, 90); await sleep(200); await swipe(400 * dir, 90); }
    await sleep(SETTLE);
    const after = state(await geo());
    const d = after.i - before.i;
    const [m1, f1] = await page.evaluate(() => [window.__sections.moves(), window.__sections.starts()]);
    const moves = m1 - m0, free = f1 - f0;     // free: gestures that began outside a transition
    const intent = kind !== "tiny";
    const edgeOfPage = (dir > 0 && before.i === g.s.length - 1) || (dir < 0 && before.i === 0 && before.atTop);
    const leavesTall = before.tall && ((dir > 0 && before.atEnd) || (dir < 0 && before.atTop));
    // Always: a valid resting place, never more slides than gestures the
    // controller was free to take, and never a programmatic move for a
    // gesture that began mid-transition.
    let ok = after.valid && Math.abs(d) <= free && moves <= free;
    if (kind === "burst" || kind === "mid") {
      // repeated gestures: at most one slide per free gesture, in the swipe direction
      ok = ok && (d === 0 || Math.sign(d) === dir);
    } else {
      ok = ok && Math.abs(d) <= 1;
      if (ok && !intent) ok = d === 0;
      else if (ok && edgeOfPage) ok = d === 0;
      else if (ok && (!before.tall || leavesTall)) ok = d === dir;
      // inside a tall slide a swipe scrolls it, and one that pulls well past
      // its edge may cross over: by one slide at most, in its own direction
      else if (ok && before.tall) ok = d === 0 || d === dir;
    }
    res.runs++; if (ok) res.pass++;
    else res.fails.push({ kind, dir, free, moves, from: before, to: after });
  }
  await ctx.close();
  return res;
}

const browser = await chromium.launch({ channel: "chrome" });
const out = await Promise.all(SIZES.map((s) => runSize(browser, s)));
await browser.close();
let runs = 0, pass = 0;
for (const r of out) {
  runs += r.runs; pass += r.pass;
  console.log(`${r.size}: ${r.pass}/${r.runs}`);
  for (const f of r.fails.slice(0, 6)) console.log("  FAIL", JSON.stringify(f));
}
console.log(`total ${pass}/${runs} (${(100 * pass / runs).toFixed(1)}%)`);
process.exit(pass === runs ? 0 : 1);
