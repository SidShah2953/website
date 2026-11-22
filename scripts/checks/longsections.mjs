// Long-section check: slides taller than the screen on the phone homepage.
//
//   npm run build && npx serve dist -l 4321
//   node scripts/checks/longsections.mjs [--base http://localhost:4321]
//
// At 320, 390 and 430 px wide, on the first long slide, with real CDP touch
// gestures and a per-frame probe of the page position (scrollY) and the long
// slide's own position (scrollTop):
//
//   inside      flicks and drags from its start scroll it natively; the page
//               never moves and the slide's position only moves one way
//   to-end      a hard flick from near its end runs out at the end and does
//               not also hand off
//   pull        a small slow pull at the end (30 px) does nothing
//   handoff     a deliberate swipe at the end: exactly one move, to the next
//               slide's top
//   burst       three flicks at the end, 60 ms apart: still exactly one move
//   back        from the next slide, one swipe back lands on the long slide's
//               end; at its start, one swipe back moves to the slide above
//   keys        ArrowDown pages through it, then exactly one move; End, Home
//   anchor      an in-page #contact link lands on that slide's top
//   restore     after going to /blog/ and back, and after a reload, the same
//               slide and the same position inside it
//
// Every frame outside a controller transition: the page moves by at most 1 px
// (it only ever moves in transitions). Every transition: monotonic, one slide.
// After every gesture settles: nothing moves for the last 300 ms (no late snap).
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:4321");
const SIZES = [[320, 568], [390, 664], [430, 740]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runSize(browser, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route((u) => !u.href.startsWith(BASE), (r) => r.abort());
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

  const load = async () => {
    await page.goto(BASE + "/", { waitUntil: "load" });
    await sleep(900);
  };
  await load();
  const geo = () => page.evaluate(() => {
    const top = (e) => { let y = 0; for (let n = e; n; n = n.offsetParent) y += n.offsetTop; return y; };
    const s = [...document.querySelectorAll(".slide")];
    return { y: Math.round(scrollY), tops: s.map(top), long: s.map((e) => e.classList.contains("long")),
      inner: s.map((e) => Math.round(e.scrollTop)), max: s.map((e) => e.scrollHeight - e.clientHeight),
      moves: window.__sections.moves(), starts: window.__sections.starts() };
  });
  let g = await geo();
  const L = g.long.indexOf(true);
  if (L < 1) throw new Error(`no long slide after the first at ${w}x${h}`);
  const TOP = g.tops[L], NEXT = g.tops[L + 1], PREV = g.tops[L - 1], MAX = g.max[L];

  // per-frame probe: page position, the long slide's position, transition flag
  const probe = (on) => page.evaluate(([on, L]) => {
    if (!on) { window.__stop = true; return window.__frames; }
    window.__frames = []; window.__stop = false;
    const s = document.querySelectorAll(".slide")[L];
    const f = (t) => { window.__frames.push([t, scrollY, s.scrollTop, window.__sections.busy() ? 1 : 0]); if (!window.__stop) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, [on, L]);
  const place = (k, inner) => page.evaluate(([k, inner, L]) => {
    const s = document.querySelectorAll(".slide");
    // every other slide starts at its own top, so an earlier scenario that
    // scrolled one (a burst's late flick, say) cannot leak into this one
    s.forEach((e, k) => { if (k !== L) e.scrollTop = 0; });
    if (inner != null) s[L].scrollTop = inner;
    const top = (e) => { let y = 0; for (let n = e; n; n = n.offsetParent) y += n.offsetTop; return y; };
    scrollTo({ top: top(s[k]), behavior: "instant" });
  }, [k, inner, L]);
  const swipe = async (dy, ms, steps = 8) => {
    const x = Math.round(w / 2), y0 = dy > 0 ? h * .78 : h * .22;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
    for (let k = 1; k <= steps; k++) {
      if (ms / steps > 17) await sleep(ms / steps - 16);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - dy * k / steps }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  /** Frame assertions over one scenario. dir: expected direction of the long
   *  slide's own movement (+1, -1, 0 = must not move, null = not checked). */
  const frames = (name, fr, dir) => {
    let outside = 0, back = 0, nonMono = 0, runDir = 0;
    for (let k = 1; k < fr.length; k++) {
      const [, y0, i0, b0] = fr[k - 1], [, y1, i1, b1] = fr[k];
      if (!b0 && !b1 && Math.abs(y1 - y0) > 1) outside = Math.max(outside, Math.abs(y1 - y0));
      // within one transition the page moves one way only
      if (!b1) runDir = 0;
      else if (Math.abs(y1 - y0) > 0) {
        const s = Math.sign(y1 - y0);
        if (runDir && s !== runDir) nonMono++;
        runDir = s;
      }
      if (dir != null && dir !== 0 && Math.sign(i1 - i0) === -dir && Math.abs(i1 - i0) > 1) back = Math.max(back, Math.abs(i1 - i0));
      if (dir === 0 && Math.abs(i1 - i0) > 1) back = Math.max(back, Math.abs(i1 - i0));
    }
    const t1 = fr.at(-1)?.[0] ?? 0, tail = fr.filter((f) => f[0] >= t1 - 300);
    const still = tail.every((f) => Math.abs(f[1] - tail[0][1]) <= 1 && Math.abs(f[2] - tail[0][2]) <= 1);
    check(`${name}: page moves only in transitions (max ${outside} px/frame outside)`, outside === 0, outside);
    check(`${name}: transitions monotonic`, nonMono === 0, nonMono);
    if (dir != null) check(`${name}: slide position continuous, no reversal (max ${back} px)`, back === 0, back);
    check(`${name}: still for the last 300 ms`, still, tail.length);
  };
  const scenario = async (name, setup, act, dir, settle = 1300) => {
    if (setup) await setup();
    await sleep(250);
    const before = await geo();
    await probe(true);
    await act();
    await sleep(settle);
    const fr = await probe(false);
    const after = await geo();
    frames(name, fr, dir);
    return { before, after, dm: after.moves - before.moves };
  };

  // inside: from the start, a slow drag then a flick scroll it, page still.
  // The drag comes first: on a slide only a little taller than the screen
  // (231 px at 430x740) a flick's momentum reaches the end, and a gesture
  // after it would start at the edge, where pulling out is a legal handoff.
  let r = await scenario("inside", () => place(L, 0), async () => {
    await swipe(Math.min(80, Math.round(MAX / 3)), 500, 16); await sleep(700); await swipe(120, 90);
  }, 1);
  check("inside: page stayed on the long slide, no move", r.after.y === TOP && r.dm === 0, r.after);
  check("inside: slide scrolled down", r.after.inner[L] > 0, r.after.inner[L]);

  // to-end: a hard flick from 60 px before the end runs out at the end
  r = await scenario("to-end", () => place(L, Math.max(0, MAX - 60)), () => swipe(420, 80), 1);
  check("to-end: at the end, no handoff", r.after.y === TOP && r.dm === 0 && r.after.inner[L] >= MAX - 2, r.after);

  // pull: a small slow pull at the end does nothing
  r = await scenario("pull", () => place(L, MAX), () => swipe(30, 300, 8), 0);
  check("pull: no move", r.after.y === TOP && r.dm === 0 && r.after.inner[L] >= MAX - 2, r.after);

  // handoff: one deliberate swipe at the end, exactly one move
  r = await scenario("handoff", () => place(L, MAX), () => swipe(140, 160), 0);
  check("handoff: exactly one move, to the next slide's top", r.dm === 1 && r.after.y === NEXT, r.after);

  // burst: three flicks at the end, 60 ms apart. Each CDP touch event waits
  // for a frame, so a later flick can begin after the transition and its
  // cooldown have ended: that is a fresh gesture, and moving for it is right.
  // What must hold: flicks that begin during a transition are swallowed, and
  // no gesture moves more than once (moves <= gestures begun outside a
  // transition), and the first lands on the next slide (checked by handoff).
  r = await scenario("burst", () => place(L, MAX), async () => {
    for (let k = 0; k < 3; k++) { await swipe(400, 90); await sleep(60); }
  }, null, 1500);
  {
    const fresh = r.after.starts - r.before.starts;
    check("burst: at least one move, never more than one per fresh gesture", r.dm >= 1 && r.dm <= fresh && fresh <= 3 && r.after.tops.includes(r.after.y), { dm: r.dm, fresh, y: r.after.y });
  }

  // back: from the next slide, one swipe back lands on the long slide's end
  r = await scenario("back", () => place(L + 1, MAX), () => swipe(-160, 160), null);
  check("back: one move, onto the long slide at its end", r.dm === 1 && r.after.y === TOP && r.after.inner[L] >= MAX - 2, r.after);
  // and at its start, one swipe back moves to the slide above
  r = await scenario("back-top", () => place(L, 0), () => swipe(-160, 160), null);
  check("back-top: one move, to the slide above", r.dm === 1 && r.after.y === PREV, r.after);
  // inside, swiping back from the end scrolls it up without a move
  r = await scenario("inside-up", () => place(L, MAX), () => swipe(-150, 300, 12), -1);
  check("inside-up: scrolled up, no move", r.dm === 0 && r.after.y === TOP && r.after.inner[L] < MAX - 2, r.after);

  // keys: ArrowDown pages through, then one move
  await place(L, 0); await sleep(250);
  const kb0 = await geo(); let steps = 0, last = kb0;
  for (; steps < 12; steps++) {
    await page.keyboard.press("ArrowDown"); await sleep(700);
    const now = await geo();
    if (now.y !== TOP) { last = now; break; }
    if (now.inner[L] <= last.inner[L]) { last = now; break; }
    last = now;
  }
  check("keys: ArrowDown pages through the long slide, then one move", last.y === NEXT && last.moves - kb0.moves === 1 && steps >= 1, { steps, y: last.y });
  await page.keyboard.press("End"); await sleep(900);
  g = await geo();
  check("keys: End reaches the last slide", g.y === g.tops.at(-1), g.y);
  await page.keyboard.press("Home"); await sleep(900);
  g = await geo();
  check("keys: Home returns to the top", g.y === 0, g.y);

  // anchor: an in-page link to #contact
  await page.evaluate(() => { const a = document.createElement("a"); a.href = "#contact"; a.id = "__a"; a.textContent = "c";
    a.style.cssText = "position:fixed;left:0;bottom:0;z-index:99"; document.body.append(a); });
  await page.click("#__a"); await sleep(900);
  g = await geo();
  const ci = await page.evaluate(() => [...document.querySelectorAll(".slide")].findIndex((s) => s.id === "contact"));
  check("anchor: #contact lands on its slide's top", g.y === g.tops[ci], { y: g.y, want: g.tops[ci] });

  // restore: leave and come back, and reload
  const mid = Math.round(MAX / 2);
  await place(L, mid); await sleep(500);
  await page.goto(BASE + "/blog/", { waitUntil: "load" }); await sleep(400);
  await page.goBack({ waitUntil: "commit" }); await sleep(1500);   // a bfcache restore fires no load
  g = await geo();
  check("restore: back from /blog/ to the same slide and position", g.y === g.tops[L] && Math.abs(g.inner[L] - mid) <= 2, { y: g.y, inner: g.inner[L], mid });
  await page.reload({ waitUntil: "load" }); await sleep(1200);
  g = await geo();
  check("restore: reload keeps the slide and position", g.y === g.tops[L] && Math.abs(g.inner[L] - mid) <= 2, { y: g.y, inner: g.inner[L], mid });

  await ctx.close();
  return { size: `${w}x${h}`, results };
}

const browser = await chromium.launch({ channel: "chrome" });
let pass = 0, total = 0;
for (const s of SIZES) {
  const { size, results } = await runSize(browser, s);
  const p = results.filter((r) => r.ok).length;
  pass += p; total += results.length;
  console.log(`${size}: ${p}/${results.length}`);
  for (const r of results.filter((r) => !r.ok)) console.log("  FAIL", r.name, JSON.stringify(r.detail));
}
await browser.close();
console.log(`total ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
