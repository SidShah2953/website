/**
 * One gesture, one section: the homepage's slide-by-slide scroll on touch screens.
 *
 * Desktop gets this from CSS alone (`scroll-snap-type: y mandatory` plus
 * `scroll-snap-stop: always` on each .slide), which is enabled once every slide
 * fits the window. Phones never got it: the "Who I am" slide is 900-1100 px tall
 * at phone widths, mandatory snap over a slide taller than the screen traps the
 * reader, so the gate in Shell switched snapping off for the whole page.
 *
 * On a touch screen this controller takes over instead:
 *
 * - A slide that fits the screen: the swipe is read for intent (distance or
 *   speed) and the page moves exactly one slide, however hard the flick. There
 *   is no native momentum to overshoot with, because the controller owns the
 *   gesture.
 * - A slide taller than the screen scrolls natively inside itself. A swipe that
 *   starts at its top or bottom edge, heading out, moves to the neighbouring
 *   slide; momentum that would carry past an edge is stopped at the edge.
 * - Input that arrives during a transition is swallowed, and the first ~120 ms
 *   after it are a cooldown, so one hard flick cannot become two moves.
 * - Keyboard (arrows, Page Up/Down, Space, Home/End), in-page anchors (#contact)
 *   and the back button work: positions are read back from the page, never
 *   kept only in a counter. No history entries are added per slide.
 * - Reduce Motion: moves are instant jumps instead of animated.
 *
 * Long-form pages never load this: it only runs on html.snap (the homepage).
 */

type Opts = { root: HTMLElement; slides: HTMLElement[] };

const DUR = 460;                  // ms per slide transition
const COOLDOWN = 120;             // ms after a transition during which input is ignored
const MIN_DIST = 36;              // px of travel that counts as intent
const MIN_SPEED = 0.35;           // px/ms at release that counts as intent (a short flick)
const EDGE = 2;                   // px slack when deciding a tall slide is at its edge

const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function initSections({ root, slides }: Opts) {
  if (!slides.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('snap-js');          // CSS: hand snapping over to this script

  // ---- geometry, always read fresh (cheap: five elements) ----------------
  // Layout boxes, not getBoundingClientRect: the slides rise in with a
  // translateY, which would shift a measured top by up to 34 px mid-reveal.
  const docTop = (el: HTMLElement) => {
    let y = 0;
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
    return y;
  };
  const tops = () => slides.map(docTop);
  const heights = () => slides.map((s) => s.offsetHeight);
  const vh = () => innerHeight;
  /** Slide whose span holds the viewport's top edge (with slack). */
  const current = () => {
    const t = tops(), y = scrollY + EDGE;
    let i = 0;
    for (let k = 0; k < t.length; k++) if (t[k] <= y) i = k;
    return i;
  };
  const isTall = (i: number) => heights()[i] > vh() + EDGE;
  /** Lowest scroll position that still shows only slide i. */
  const endOf = (i: number) => tops()[i] + Math.max(0, heights()[i] - vh());

  // ---- animated move ------------------------------------------------------
  let busy = false, until = 0, raf = 0;
  const jump = (y: number) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
  const go = (y: number, count = true) => {
    const max = document.documentElement.scrollHeight - vh();
    y = Math.max(0, Math.min(max, Math.round(y)));
    cancelAnimationFrame(raf);
    if (count) moves++;
    if (reduce.matches || Math.abs(y - scrollY) < 2) { jump(y); until = performance.now() + COOLDOWN; return; }
    busy = true;
    // Native momentum from the gesture that triggered this (a fling inside a
    // tall slide) would keep adding to the scroll under the animation and
    // carry it past the target. Clipping the root kills momentum in every
    // engine; programmatic scrolling still works while it is clipped.
    root.style.overflow = 'hidden';
    const from = scrollY, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DUR);
      jump(from + (y - from) * ease(k));
      if (k < 1) raf = requestAnimationFrame(step);
      else { busy = false; root.style.overflow = ''; until = performance.now() + COOLDOWN; }
    };
    raf = requestAnimationFrame(step);
  };
  const locked = () => busy || performance.now() < until;
  // Read by scripts/checks/sections.mjs to tell swallowed gestures from real ones.
  let moves = 0, starts = 0;
  (window as any).__sections = { locked, moves: () => moves, starts: () => starts };

  /** Move one slide in direction d (+1 down the page, -1 up). */
  const move = (d: 1 | -1) => {
    const i = current(), t = tops();
    if (d > 0) {
      if (isTall(i) && scrollY < endOf(i) - EDGE) return go(Math.min(endOf(i), scrollY + vh() * .85));
      if (i < slides.length - 1) go(t[i + 1]);
    } else {
      // inside a tall slide, below its top: step back up within it first
      if (scrollY > t[i] + EDGE) return go(isTall(i) ? Math.max(t[i], scrollY - vh() * .85) : t[i]);
      if (i > 0) go(isTall(i - 1) ? endOf(i - 1) : t[i - 1]);
    }
  };

  // ---- touch --------------------------------------------------------------
  // `mode` is decided on the first move of each gesture:
  //   'own'    — the controller handles it (slide fits, or leaving a tall slide)
  //   'native' — let the browser scroll inside a tall slide
  let sy = 0, st = 0, ly = 0, lt = 0, v = 0, touching = false;
  let mode: 'own' | 'native' | null = null;
  let stale = false;              // gesture began during a transition: swallow all of it

  addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { mode = 'native'; return; }
    touching = true; mode = null; stale = locked();
    if (!stale) starts++;
    sy = ly = e.touches[0].clientY; st = lt = e.timeStamp; v = 0;
  }, { passive: true });

  addEventListener('touchmove', (e) => {
    if (!touching) return;
    const y = e.touches[0].clientY, dy = sy - y;       // dy > 0: finger moving up, page going down
    if (e.timeStamp > lt) v = (ly - y) / (e.timeStamp - lt);
    ly = y; lt = e.timeStamp;
    if (mode === 'native') return;
    if (mode === null) {
      if (Math.abs(dy) < 4 && !stale && !locked()) return;   // not decided yet
      const i = current();
      const atEnd = scrollY >= endOf(i) - EDGE, atTop = scrollY <= tops()[i] + EDGE;
      mode = stale || locked() || !isTall(i) || (dy > 0 && atEnd) || (dy < 0 && atTop) ? 'own' : 'native';
    }
    if (mode === 'own' && e.cancelable) e.preventDefault();
  }, { passive: false });

  /** Put the page back on a valid resting place if anything left it between
   *  two (a fling that outran the fence, a gesture swallowed mid-fling). */
  const rest = () => {
    if (busy) return;
    const i = current(), t = tops();
    if (isTall(i)) {
      if (scrollY > endOf(i) + EDGE) go(scrollY - endOf(i) > (t[i + 1] ?? Infinity) - scrollY ? t[i + 1] : endOf(i), false);
    } else if (Math.abs(scrollY - t[i]) > EDGE) {
      const next = t[i + 1] ?? t[i];
      go(scrollY - t[i] < next - scrollY ? t[i] : next, false);
    }
  };
  let restT = 0;
  const restSoon = () => { clearTimeout(restT); restT = window.setTimeout(() => { if (!touching) rest(); }, 140); };

  const end = (e: TouchEvent) => {
    if (!touching) return;
    touching = false;
    restSoon();
    if (mode === 'native' && fence && !locked()) {
      // A slow drag inside a tall slide can pull past its edge with no momentum
      // left to fence. Past a fifth of the screen it reads as "next slide";
      // less than that springs back to the edge.
      // A fast flick counts too: at release the scroll position lags the
      // finger by a frame or two, so distance alone undercounts it.
      const y = scrollY, t = tops(), i = slides.findIndex((_, k) => t[k] === fence![0]);
      const far = (px: number) => px > vh() * .2 || Math.abs(v) >= MIN_SPEED;
      if (y > fence[1] + EDGE) go(far(y - fence[1]) && v > 0 && i < slides.length - 1 ? t[i + 1] : fence[1]);
      else if (y < fence[0] - EDGE) go(far(fence[0] - y) && v < 0 && i > 0 ? (isTall(i - 1) ? endOf(i - 1) : t[i - 1]) : fence[0]);
      mode = null; return;
    }
    if (mode !== 'own' || stale || locked()) { mode = null; return; }
    const dy = sy - ly, dt = Math.max(1, e.timeStamp - st);
    // speed over the last stretch of the gesture, or over the whole of a very short one
    const speed = Math.max(Math.abs(v), Math.abs(dy) / dt);
    if (Math.abs(dy) >= MIN_DIST || (speed >= MIN_SPEED && Math.abs(dy) >= 8)) move(dy > 0 ? 1 : -1);
    mode = null;
  };
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', () => { touching = false; mode = null; }, { passive: true });

  // Momentum inside a tall slide must stop at its edge rather than carry the
  // reader half into the next slide; the next swipe then crosses over.
  let fence: [number, number] | null = null;
  addEventListener('touchstart', () => {
    const i = current();
    fence = isTall(i) ? [tops()[i], endOf(i)] : null;
  }, { passive: true });
  addEventListener('scroll', () => {
    if (busy || touching) return;
    restSoon();                       // once scrolling stops, make sure it stopped somewhere valid
    if (!fence) return;
    if (scrollY > fence[1] + 1 || scrollY < fence[0] - 1) {
      root.style.overflow = 'hidden';               // stop the fling, as in go()
      jump(scrollY > fence[1] ? fence[1] : fence[0]);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!busy) root.style.overflow = ''; }));
    }
  }, { passive: true });

  // ---- keyboard -------------------------------------------------------------
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
    if (down || up) { e.preventDefault(); if (!locked()) move(down ? 1 : -1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(tops()[slides.length - 1]); }
  });

  // ---- anchors and history --------------------------------------------------
  // In-page links (#contact) land on their slide's top with the same motion.
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const target = a.hash.length > 1 && document.getElementById(decodeURIComponent(a.hash.slice(1)));
    const slide = target && slides.find((s) => s.contains(target));
    if (!slide) return;
    e.preventDefault();
    history.pushState(null, '', a.hash);                // a link click is a real navigation
    go(tops()[slides.indexOf(slide)]);
  });
  // Back/forward between #hashes, and returning to the page from bfcache:
  // settle onto whichever slide the browser restored.
  const settle = () => {
    const id = location.hash.slice(1);
    const target = id && document.getElementById(decodeURIComponent(id));
    const slide = target && slides.find((s) => s.contains(target));
    if (slide) { jump(tops()[slides.indexOf(slide)]); return; }
    const i = current();
    if (!isTall(i)) jump(tops()[i]);
  };
  addEventListener('popstate', settle);
  addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) settle(); });
}
