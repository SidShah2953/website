// Browser chrome colour check: does the colour of the phone's bars follow the
// homepage section on screen, in both directions?
//
//   npm run build && npx serve dist -l 4321
//   node scripts/checks/chrome.mjs [--base http://localhost:4321]
//
// At each phone size, with emulated notch / home-indicator safe areas, this
// swipes down through every slide and back up again (real CDP touch gestures,
// so src/scripts/sections.ts does the moving). At every resting place it reads
// the section's own --section-bg, the root's --chrome, the computed html and
// body backgrounds and the theme-color meta, and samples the rendered page
// inside the two safe areas (the strips the status bar and the toolbar sit on).
//
// Strips are judged per row by the row's median colour, so a stray glyph does
// not count but a band of another colour (a footer, a panel, the lit surface)
// does. Each place is sampled twice: with the slides' content hidden (the
// page's own layers: must match everywhere) and fully rendered (must match on
// slides that fit the screen; a tall slide's text scrolls under the bars, so
// there it is reported only). Distances are the worst 8-bit channel.
import { chromium } from "playwright";
import { PNG } from "playwright-core/lib/utilsBundle";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:4321");
const SIZES = [[390, 844], [320, 568], [430, 932]];
const INSET = { top: 47, bottom: 34 };
const DPR = 3, SETTLE = 900, TOL = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const dist = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));

/** Worst per-row median distance from `want` over rows [y0, y1). */
function strip(png, y0, y1, want) {
  let worst = 0;
  for (let y = y0; y < y1; y++) {
    const ch = [[], [], []];
    for (let x = 0; x < png.width; x++) { const i = (png.width * y + x) * 4; for (let k = 0; k < 3; k++) ch[k].push(png.data[i + k]); }
    const med = ch.map((c) => c.sort((a, b) => a - b)[c.length >> 1]);
    worst = Math.max(worst, dist(med, want));
  }
  return worst;
}

const browser = await chromium.launch({ channel: "chrome" });
let fails = 0, checks = 0;
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await ctx.route((u) => !u.href.startsWith(BASE), (r) => r.abort());
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { ...INSET, left: 0, right: 0 } });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await sleep(1500);
  const swipe = async (dy) => {
    const x = 6, y0 = dy > 0 ? h * .75 : h * .25;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
    for (let k = 1; k <= 8; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - dy * k / 8 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const read = () => page.evaluate(() => {
    const top = (e) => { let y = 0; for (let n = e; n; n = n.offsetParent) y += n.offsetTop; return y; };
    const slides = [...document.querySelectorAll(".slide")];
    let i = 0; slides.forEach((s, k) => { if (top(s) <= scrollY + 2) i = k; });
    const cs = getComputedStyle, root = document.documentElement;
    // resolve a custom property to a colour by painting it on a probe
    const probe = document.createElement("i"); document.body.append(probe);
    const resolve = (v) => { probe.style.color = ""; probe.style.color = v; return cs(probe).color; };
    const out = {
      y: Math.round(scrollY), n: slides.length, i, tall: slides[i].offsetHeight > innerHeight + 2,
      section: resolve(cs(slides[i]).getPropertyValue("--section-bg").trim() || "transparent"),
      chrome: resolve(cs(root).getPropertyValue("--chrome").trim() || "transparent"),
      html: cs(root).backgroundColor, body: cs(document.body).backgroundColor,
      theme: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content),
      js: root.classList.contains("snap-js"),
    };
    probe.remove();
    return out;
  });
  // Background layers only: the slides' content hidden, so what is left in the
  // strips is the page itself (root, surface, veil, header, any footer).
  const bare = async (on) => page.evaluate((on) => {
    let s = document.getElementById("__bare");
    if (!on) return s?.remove();
    s = document.createElement("style"); s.id = "__bare";
    s.textContent = ".slide > *{visibility:hidden!important}";
    document.head.append(s);
  }, on);
  const sample = async (r) => {
    const png = PNG.sync.read(await page.screenshot());
    await bare(true); await sleep(60);
    const bg = PNG.sync.read(await page.screenshot());
    await bare(false);
    const want = rgb(r.section), theme = hexRgb(r.theme[0] || "#000000");
    return {
      bgTop: strip(bg, 0, INSET.top * DPR, theme),
      bgBottom: strip(bg, bg.height - INSET.bottom * DPR, bg.height, rgb(r.html)),
      top: strip(png, 0, INSET.top * DPR, theme),
      bottom: strip(png, png.height - INSET.bottom * DPR, png.height, rgb(r.html)),
      themeOff: dist(hexRgb(r.theme[0] || "#000000"), want),
      htmlOff: dist(rgb(r.html), want), bodyOff: dist(rgb(r.body), want),
      themeAgree: new Set(r.theme).size === 1,
    };
  };
  const first = await read();
  if (!first.js) throw new Error("controller not active (html.snap-js missing)");
  const rows = [];
  const visit = async (dir) => {
    const r = await read(), s = await sample(r);
    // Full renders are only held to the strips on slides that fit the screen:
    // a tall slide's own text scrolls under the bars, as on any page.
    const ok = s.bgTop <= TOL && s.bgBottom <= TOL && (r.tall || (s.top <= TOL && s.bottom <= TOL))
      && s.themeOff <= 1 && s.htmlOff <= 1 && s.bodyOff <= 1 && s.themeAgree;
    checks++; if (!ok) fails++;
    rows.push({ dir, slide: r.i + (r.tall ? " tall" : ""), y: r.y, section: r.section, theme: r.theme[0], html: r.html,
      themeOff: s.themeOff, htmlOff: s.htmlOff, bgTop: s.bgTop, bgBottom: s.bgBottom, top: s.top, bottom: s.bottom, ok });
    return r;
  };
  // down to the last slide, then back to the first; tall slides take more than one swipe
  let r = await visit("start");
  for (let guard = 0; guard < 20 && !(r.i === r.n - 1 && (await read()).y >= (await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)) - 2); guard++) {
    await swipe(300); await sleep(SETTLE); r = await visit("down");
  }
  for (let guard = 0; guard < 20 && !(r.i === 0 && r.y <= 2); guard++) {
    await swipe(-300); await sleep(SETTLE); r = await visit("up");
  }
  console.log(`== ${w}x${h}`);
  console.table(rows);
  await ctx.close();
}
await browser.close();
console.log(`${checks - fails} of ${checks} resting places pass (background strips within ${TOL}, full strips within ${TOL} on slides that fit, theme-color / html / body within 1 of the section)`);
process.exit(fails ? 1 : 0);
