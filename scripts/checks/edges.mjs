// Phone edge check: what colour the page is where it meets the browser's bars.
//
//   npm run build && npx serve dist -l 4321
//   node scripts/checks/edges.mjs [--base http://localhost:4321]
//
// Mobile browsers fill the status-bar and toolbar areas with theme-color / the
// root background. If the page arrives at a different colour at
// its top or bottom edge, the bar shows as a flat strip. This loads pages at
// 390x844 with emulated notch/home-indicator safe areas, reads the computed
// root colours and safe-area padding, and samples the rendered edge rows.
// What it cannot see: Safari's own bar tinting and toolbar collapse, which only
// a real iPhone shows.
import { chromium } from "playwright";
import { PNG } from "playwright-core/lib/utilsBundle";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:4321");
const GROUND = [5, 12, 15];
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.route((u) => !u.href.startsWith(BASE), (r) => r.abort());
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
let insets = "not supported by this Chrome";
try {
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
  insets = "top 47, bottom 34";
} catch {}
console.log("safe-area insets:", insets);

const rowAvg = (png, y) => {
  const c = [0, 0, 0];
  for (let x = 0; x < png.width; x++) { const i = (png.width * y + x) * 4; for (let k = 0; k < 3; k++) c[k] += png.data[i + k]; }
  return c.map((v) => Math.round(v / png.width));
};
const dist = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));

for (const [path, scrollTo] of [["/", 0], ["/", 1], ["/blog/", 0], ["/blog/lego-fication-of-finance/", 0]]) {
  await page.goto(BASE + path, { waitUntil: "load" });
  if (scrollTo) await page.evaluate(() => window.scrollTo({ top: document.querySelectorAll(".slide")[1]?.offsetTop ?? innerHeight, behavior: "instant" }));
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el);
    const hdr = document.getElementById("hdr");
    return {
      viewport: document.querySelector('meta[name="viewport"]')?.content,
      themeColor: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => `${m.content} ${m.media}`),
      html: cs(document.documentElement).backgroundColor, body: cs(document.body).backgroundColor,
      headerPadTop: hdr && cs(hdr).paddingTop, headerHeight: hdr && cs(hdr).height,
    };
  });
  const png = PNG.sync.read(await page.screenshot());
  const top = rowAvg(png, 0), bottom = rowAvg(png, png.height - 1);
  // the top edge meets the status bar / URL bar, which takes theme-color
  const hex = (info.themeColor[0] || "#050C0F").slice(1, 7);
  const theme = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
  console.log(JSON.stringify({ path, scrolled: !!scrollTo, ...info,
    topRow: top, topOffTheme: dist(top, theme), bottomRow: bottom, bottomOffGround: dist(bottom, GROUND) }));
}
await browser.close();
