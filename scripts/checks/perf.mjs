// Render and load performance check against the BUILT site.
//
//   npm run build && npx serve dist -l 4321      (no -s; serve compresses like the CDN)
//   node scripts/checks/perf.mjs [--base http://localhost:4321] [--runs 3] [--json out.json]
//
// Drives system Chrome through Playwright + CDP. For each profile it loads a
// few pages, records LCP / CLS / interaction latency, transfer weight by type,
// then runs a scripted scroll + pointer sweep while a rAF probe logs every frame
// interval, and reports p50 / p95 / p99 frame times and the share of frames over
// budget. Third-party requests (analytics beacons) are blocked so test runs
// never reach the real counters.
//
// Profiles: "mobile" = 390x844 at 3x DPR, touch, 4x CPU throttle;
//           Slow-4G network (150 ms RTT, 1.6 Mbps).
//           "desktop" = 1440x900 at 2x DPR, no throttle.
// Frame times depend on the machine's GPU: compare runs on the same Mac only.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:4321");
const RUNS = +arg("--runs", 3);
const OUT = arg("--json", null);
const PAGES = (arg("--pages", "/,/blog/,/blog/lego-fication-of-finance/")).split(",");
const SWEEP_MS = 8000;

const PROFILES = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4,
    // Lighthouse's mobile preset: 150 ms RTT, 1.6 Mbps down, 750 Kbps up.
    net: { offline: false, latency: 150, downloadThroughput: 1638400 / 8, uploadThroughput: 750000 / 8 } },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false, cpu: 1 },
};

// Installed before any page script runs.
const PROBE = () => {
  const w = window;
  w.__perf = { lcp: 0, cls: 0, inp: 0, longTasks: 0, longTaskMs: 0, frames: [] };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__perf.lcp = e.startTime; })
    .observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) w.__perf.cls += e.value; })
    .observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (e.interactionId) w.__perf.inp = Math.max(w.__perf.inp, e.duration);
  }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) { w.__perf.longTasks++; w.__perf.longTaskMs += e.duration; }
  }).observe({ type: "longtask", buffered: true });
};

const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const med = (a) => pct(a, 0.5);
const r1 = (x) => Math.round(x * 10) / 10;

async function measure(browser, name, prof, path) {
  const ctx = await browser.newContext({
    viewport: prof.viewport, deviceScaleFactor: prof.deviceScaleFactor,
    isMobile: prof.isMobile, hasTouch: prof.hasTouch,
  });
  await ctx.route((u) => !u.href.startsWith(BASE), (r) => r.abort());
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (prof.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: prof.cpu });
  if (prof.net) await cdp.send("Network.emulateNetworkConditions", prof.net);

  const types = {}; const reqType = new Map();
  cdp.on("Network.responseReceived", (e) => reqType.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    const t = (reqType.get(e.requestId) || "Other").toLowerCase();
    types[t] = (types[t] || 0) + e.encodedDataLength;
  });

  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(2500);                       // let the hero settle and fade in

  // One real interaction for INP: a tap / click on an inert part of the page.
  await page.mouse.click(prof.viewport.width / 2, prof.viewport.height - 40);
  await page.waitForTimeout(300);

  // Main-thread time during the sweep, from Chrome's own counters.
  await cdp.send("Performance.enable");
  const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const m0 = await metric();

  // Frame probe + scripted scroll and pointer sweep.
  await page.evaluate(() => {
    const f = window.__perf.frames; let last = 0;
    const tick = (t) => { if (last) f.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < SWEEP_MS) {
    const x = prof.viewport.width * (0.5 + 0.4 * Math.sin(i / 9));
    const y = prof.viewport.height * (0.5 + 0.35 * Math.cos(i / 13));
    await page.mouse.move(x, y);
    if (i % 3 === 0) await page.mouse.wheel(0, (Math.floor(i / 60) % 2 ? -1 : 1) * 120);
    await page.waitForTimeout(16);
    i++;
  }
  const m1 = await metric();
  const sweepS = (m1.Timestamp - m0.Timestamp) || SWEEP_MS / 1000;
  const perSec = (k) => r1(1000 * (m1[k] - m0[k]) / sweepS);   // ms of main thread per second
  const res = await page.evaluate(() => {
    window.__stop = true;
    const c = document.getElementById("sfc");
    return { ...window.__perf, canvas: c ? `${c.width}x${c.height} tier ${c.dataset.tier ?? "-"}` : "none" };
  });

  // GPU cost of one hero frame. getContext() on the same canvas hands back the
  // page's own context with its program and uniforms bound, so this times the
  // real draw at the real resolution. readPixels forces each draw to finish.
  // Measured at the top of the page and at the bottom (camera at its highest).
  let gpuTop = 0, gpuBottom = 0;
  if (res.canvas !== "none") {
    const bench = () => page.evaluate(() => new Promise((ok) => setTimeout(() => {
      const gl = document.getElementById("sfc").getContext("webgl2");
      const px = new Uint8Array(4), N = 40, t = [];
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let k = 0; k < N; k++) {
        const s = performance.now();
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        t.push(performance.now() - s);
      }
      t.sort((a, b) => a - b); ok(t[N >> 1]);
    }, 400)));
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600);
    gpuTop = await bench();
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(600);
    gpuBottom = await bench();
  }
  await ctx.close();
  const f = res.frames.slice(10);
  return {
    profile: name, path,
    lcp: r1(res.lcp), cls: +res.cls.toFixed(4), inp: r1(res.inp),
    longTasks: res.longTasks, longTaskMs: r1(res.longTaskMs),
    frames: f.length, p50: r1(pct(f, .5)), p95: r1(pct(f, .95)), p99: r1(pct(f, .99)),
    over20: r1(100 * f.filter((d) => d > 20).length / (f.length || 1)),
    over33: r1(100 * f.filter((d) => d > 33.4).length / (f.length || 1)),
    kb: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, r1(v / 1024)])),
    totalKb: r1(Object.values(types).reduce((a, b) => a + b, 0) / 1024),
    scriptMsPerS: perSec("ScriptDuration"), styleMsPerS: perSec("RecalcStyleDuration"),
    layoutMsPerS: perSec("LayoutDuration"), taskMsPerS: perSec("TaskDuration"),
    gpuTop: r1(gpuTop), gpuBottom: r1(gpuBottom),
    canvas: res.canvas,
  };
}

const browser = await chromium.launch({
  channel: "chrome", headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"],
});
{
  const p = await browser.newPage();
  const gpu = await p.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl ? gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : "no webgl2";
  });
  console.log("GPU:", gpu, "| Chrome", browser.version());
  await p.close();
}

const all = [];
for (const [name, prof] of Object.entries(PROFILES)) for (const path of PAGES) {
  const runs = [];
  for (let r = 0; r < RUNS; r++) runs.push(await measure(browser, name, prof, path));
  const pick = (k) => r1(med(runs.map((x) => x[k])));
  const row = {
    profile: name, path,
    lcp: pick("lcp"), cls: +med(runs.map((x) => x.cls)).toFixed(4), inp: pick("inp"),
    longTasks: pick("longTasks"), longTaskMs: pick("longTaskMs"),
    p50: pick("p50"), p95: pick("p95"), p99: pick("p99"), over20: pick("over20"), over33: pick("over33"),
    scriptMsPerS: pick("scriptMsPerS"), styleMsPerS: pick("styleMsPerS"),
    layoutMsPerS: pick("layoutMsPerS"), taskMsPerS: pick("taskMsPerS"),
    gpuTop: pick("gpuTop"), gpuBottom: pick("gpuBottom"),
    totalKb: pick("totalKb"), kb: runs[0].kb, canvas: runs.map((x) => x.canvas).join(" | "),
  };
  all.push(row);
  console.log(JSON.stringify(row));
}
await browser.close();
if (OUT) writeFileSync(OUT, JSON.stringify(all, null, 2));
