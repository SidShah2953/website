// Phone bar colour on every page but the homepage (scripts/checks/chrome.mjs
// covers that one).
//
//   npm run build && npx serve dist -l 4321
//   node scripts/checks/chrome-pages.mjs [--base http://localhost:4321]
//
// Visits every page in dist (not /private/, which is a standalone unlisted
// page, nor redirect stubs) at 390x844 with emulated notch and home-indicator
// safe areas, under both prefers-color-scheme values, at the top, the middle
// and the end of the page. Each time it checks that every theme-color meta (one per colour scheme) agrees,
// and samples the rendered page inside the two safe areas:
// the status-bar strip must be the theme-color, the home-indicator strip the
// root background. Rows are judged by their median colour, so a stray glyph
// does not count but a band of another colour does. Worst 8-bit channel.
import { chromium } from "playwright";
import { PNG } from "playwright-core/lib/utilsBundle";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:4321");
const DIST = new URL("../../dist/", import.meta.url).pathname;
const [W, H] = [390, 844], INSET = { top: 47, bottom: 34 }, DPR = 2, TOL = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const dist = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));
function strip(png, y0, y1, want) {
  let worst = 0;
  for (let y = y0; y < y1; y++) {
    const ch = [[], [], []];
    for (let x = 0; x < png.width; x++) { const i = (png.width * y + x) * 4; for (let k = 0; k < 3; k++) ch[k].push(png.data[i + k]); }
    worst = Math.max(worst, dist(ch.map((c) => c.sort((a, b) => a - b)[c.length >> 1]), want));
  }
  return worst;
}

const routes = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!f.endsWith(".html")) continue;
    const r = "/" + relative(DIST, p).replace(/index\.html$/, "").replace(/\.html$/, "");
    if (r === "/" || r.startsWith("/private/")) continue;
    if (/http-equiv=["']?refresh/i.test(readFileSync(p, "utf8").slice(0, 2000))) continue;
    routes.push(r);
  }
})(DIST);
routes.sort();

const browser = await chromium.launch({ channel: "chrome" });
let fails = 0, checks = 0;
for (const scheme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: "reduce" });
  await ctx.route((u) => !u.href.startsWith(BASE), (r) => r.abort());
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { ...INSET, left: 0, right: 0 } });
  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: "load" });
    await sleep(150);
    const metas = await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content));
    const bad = [];
    if (!metas.length || new Set(metas).size !== 1 || !/^#[0-9a-f]{6}$/i.test(metas[0])) bad.push(`theme-color ${JSON.stringify(metas)}`);
    for (const at of ["top", "middle", "end"]) {
      const html = await page.evaluate((at) => {
        const max = document.documentElement.scrollHeight - innerHeight;
        scrollTo({ top: at === "top" ? 0 : at === "end" ? max : max / 2, behavior: "instant" });
        return getComputedStyle(document.documentElement).backgroundColor;
      }, at);
      await sleep(80);
      const png = PNG.sync.read(await page.screenshot());
      const top = strip(png, 0, INSET.top * DPR, hexRgb(metas[0] || "#000000"));
      const bottom = strip(png, png.height - INSET.bottom * DPR, png.height, rgb(html));
      checks++;
      if (top > TOL || bottom > TOL) bad.push(`${at}: top ${top}, bottom ${bottom}`);
    }
    if (bad.length) { fails++; console.log(`FAIL ${scheme} ${route}: ${bad.join("; ")}`); }
  }
  await ctx.close();
}
await browser.close();
console.log(`${routes.length} pages x 2 schemes x 3 positions: ${checks} samples, ${fails} page runs failing (strips within ${TOL})`);
process.exit(fails ? 1 : 0);
