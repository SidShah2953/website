/**
 * One gesture, one section: the homepage's slide-by-slide scroll on touch screens.
 *
 * Desktop gets this from CSS alone (`scroll-snap-type: y mandatory` plus
 * `scroll-snap-stop: always` on each .slide), which is enabled once every slide
 * fits the window. On a touch screen this controller takes over instead:
 *
 * - A slide that fits the screen: the swipe is read for intent (distance or
 *   speed) and the page moves exactly one slide, however hard the flick.
 * - A slide taller than the screen ("long") becomes its own scroll container,
 *   one screen tall (class `long`, styled in index.astro). Inside it, scrolling
 *   is the browser's own: native momentum, rubber band, nothing intercepted.
 *   `overscroll-behavior: contain` stops that momentum at the slide's edge, so
 *   a flick to the end can never carry into the next slide. Only a new gesture
 *   that starts at the edge and pulls deliberately outwards (HANDOFF px, or a
 *   quick flick) hands over to the neighbouring slide.
 *   Earlier versions scrolled long slides in the page itself and stopped the
 *   momentum at the edge by clipping the root and jumping back, then snapped
 *   the page into place once it stopped: on iOS that fought the momentum and
 *   the toolbar, and read as jumps.
 * - The page itself only ever moves by this controller, one slide at a time;
 *   input that arrives during a transition is swallowed, and the first ~120 ms
 *   after it are a cooldown, so one hard flick cannot become two moves.
 * - Arriving at a long slide from below lands on its end, so reading back up
 *   continues where it left off; arriving from above lands on its start.
 * - Keyboard (arrows, Page Up/Down, Space, Home/End) pages through a long slide
 *   before leaving it; in-page anchors (#contact) and the back button work;
 *   the slide and each long slide's own position are restored on return.
 * - Reduce Motion: moves are instant jumps instead of animated.
 *
 * Long-form pages never load this: it only runs on html.snap (the homepage).
 */

type Opts = { root: HTMLElement; slides: HTMLElement[] };

const DUR = 460;                  // ms per slide transition
const COOLDOWN = 120;             // ms after a transition during which input is ignored
const MIN_DIST = 36;              // px of travel that counts as intent on a slide that fits
const MIN_SPEED = 0.35;           // px/ms at release that counts as intent (a short flick)
const HANDOFF = 56;               // px pulled past a long slide's edge to leave it
const HANDOFF_SPEED = 0.5;        // or a flick at least this fast (and 16 px long)
const EDGE = 2;                   // px slack when deciding a scroller is at its edge

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
  const vh = () => innerHeight;
  /** Slide whose span holds the viewport's top edge (with slack). */
  const current = () => {
    const t = tops(), y = scrollY + EDGE;
    let i = 0;
    for (let k = 0; k < t.length; k++) if (t[k] <= y) i = k;
    return i;
  };
  const isLong = (s: HTMLElement) => s.classList.contains('long');
  const maxIn = (s: HTMLElement) => Math.max(0, s.scrollHeight - s.clientHeight);
  const atTop = (s: HTMLElement) => !isLong(s) || s.scrollTop <= EDGE;
  const atEnd = (s: HTMLElement) => !isLong(s) || s.scrollTop >= maxIn(s) - EDGE;

  /** Give every slide taller than the screen its own scroller. A long slide's
   *  content height is its scrollHeight; any other slide's is its box. */
  const classify = () => {
    for (const s of slides) {
      const long = isLong(s) ? s.scrollHeight > s.clientHeight + EDGE : s.offsetHeight > vh() + EDGE;
      if (long !== isLong(s)) s.classList.toggle('long', long);
    }
  };
  classify();

  // ---- browser chrome colour -------------------------------------------------
  // The status bar, the toolbar, the safe-area strips and the overscroll area
  // take the colour of the slide on screen: its --section-bg goes into the
  // root's --chrome (html and body background, the veil's solid edges) and
  // into theme-color. The slide holding the viewport's middle counts, so the
  // colour flips halfway through a transition, in either direction.
  const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  let shown = '';
  const syncChrome = () => {
    const t = tops(), mid = scrollY + vh() / 2;
    let i = 0;
    for (let k = 0; k < t.length; k++) if (t[k] <= mid) i = k;
    const c = getComputedStyle(slides[i]).getPropertyValue('--section-bg').trim();
    if (!c || c === shown) return;
    shown = c;
    root.style.setProperty('--chrome', c);
    for (const m of metas) m.content = c;
  };
  syncChrome();
  addEventListener('scroll', syncChrome, { passive: true });

  // ---- animated move ------------------------------------------------------
  let busy = false, until = 0, raf = 0;
  const jump = (y: number) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
  const go = (y: number, count = true) => {
    const max = document.documentElement.scrollHeight - vh();
    y = Math.max(0, Math.min(max, Math.round(y)));
    cancelAnimationFrame(raf);
    if (count) moves++;
    if (reduce.matches || Math.abs(y - scrollY) < 2) { jump(y); busy = false; until = performance.now() + COOLDOWN; return; }
    busy = true;
    const from = scrollY, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DUR);
      jump(from + (y - from) * ease(k));
      if (k < 1) raf = requestAnimationFrame(step);
      else { busy = false; until = performance.now() + COOLDOWN; }
    };
    raf = requestAnimationFrame(step);
  };
  const locked = () => busy || performance.now() < until;
  // Read by scripts/checks/sections.mjs and longsections.mjs.
  let moves = 0, starts = 0;
  (window as any).__sections = { locked, busy: () => busy, moves: () => moves, starts: () => starts };

  /** Show slide j, entering a long one at the end it is entered from. */
  const enter = (j: number, from: 1 | -1) => {
    const s = slides[j];
    if (isLong(s)) s.scrollTop = from > 0 ? 0 : maxIn(s);
    go(tops()[j]);
  };
  /** Move one step in direction d (+1 down the page, -1 up): through a long
   *  slide a screen at a time (keyboard, header swipes), then to the next. */
  const move = (d: 1 | -1, page = true) => {
    const i = current(), s = slides[i];
    if (page && isLong(s) && (d > 0 ? !atEnd(s) : !atTop(s))) {
      s.scrollBy({ top: d * vh() * .85, behavior: reduce.matches ? 'instant' as ScrollBehavior : 'smooth' });
      return;
    }
    if (i + d >= 0 && i + d < slides.length) enter(i + d, d);
  };

  // ---- touch --------------------------------------------------------------
  // `mode` is decided on the first move of each gesture:
  //   'own'    — a slide that fits: the controller reads the swipe
  //   'edge'   — at a long slide's edge, heading out: a possible handoff
  //   'native' — inside a long slide: the browser scrolls it
  let sy = 0, st = 0, ly = 0, lt = 0, v = 0, touching = false;
  let mode: 'own' | 'edge' | 'native' | null = null;
  let stale = false;              // gesture began during a transition: swallow all of it
  let scroller: HTMLElement | null = null, top0 = false, end0 = false, inside = false;

  addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { mode = 'native'; return; }
    touching = true; mode = null; stale = locked();
    if (!stale) starts++;
    sy = ly = e.touches[0].clientY; st = lt = e.timeStamp; v = 0;
    const s = slides[current()];
    scroller = isLong(s) ? s : null;
    // edge state as the finger lands: a gesture that only reaches the edge
    // on its way never counts as a pull past it
    top0 = !!scroller && atTop(scroller); end0 = !!scroller && atEnd(scroller);
    inside = !!scroller && scroller.contains(e.target as Node);
  }, { passive: true });

  addEventListener('touchmove', (e) => {
    if (!touching) return;
    const y = e.touches[0].clientY, dy = sy - y;       // dy > 0: finger moving up, page going down
    if (e.timeStamp > lt) v = (ly - y) / (e.timeStamp - lt);
    ly = y; lt = e.timeStamp;
    if (mode === 'native') return;
    if (mode === null) {
      if (Math.abs(dy) < 4 && !stale && !locked()) return;   // not decided yet
      if (stale || locked() || !scroller) mode = 'own';
      else if (!inside) mode = 'own';                       // on the header: page like the keyboard
      else if ((dy > 0 && end0) || (dy < 0 && top0)) mode = 'edge';
      else mode = 'native';
    }
    if (mode !== 'native' && e.cancelable) e.preventDefault();
  }, { passive: false });

  const end = (e: TouchEvent) => {
    if (!touching) return;
    touching = false;
    const m = mode; mode = null;
    if (m === 'native' || m === null || stale || locked()) return;
    const dy = sy - ly, dt = Math.max(1, e.timeStamp - st);
    // speed over the last stretch of the gesture, or over the whole of a very short one
    const speed = Math.max(Math.abs(v), Math.abs(dy) / dt);
    const d = dy > 0 ? 1 : -1;
    if (m === 'edge') {
      if (Math.abs(dy) >= HANDOFF || (speed >= HANDOFF_SPEED && Math.abs(dy) >= 16)) move(d, false);
    } else if (Math.abs(dy) >= MIN_DIST || (speed >= MIN_SPEED && Math.abs(dy) >= 8)) {
      move(d, !scroller || !inside);
    }
  };
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', () => { touching = false; mode = null; }, { passive: true });

  // ---- keyboard -------------------------------------------------------------
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
    if (down || up) { e.preventDefault(); if (!locked()) move(down ? 1 : -1); }
    else if (e.key === 'Home') { e.preventDefault(); enter(0, 1); }
    else if (e.key === 'End') { e.preventDefault(); enter(slides.length - 1, 1); }
  });

  // ---- anchors, history and restoration ------------------------------------
  /** Bring an element into view: its slide, and inside a long slide, the
   *  element itself just below the header. */
  const reveal = (target: HTMLElement, animate: boolean) => {
    const k = slides.findIndex((s) => s.contains(target));
    if (k < 0) return false;
    const s = slides[k];
    if (isLong(s)) {
      const hdr = document.getElementById('hdr')?.offsetHeight ?? 0;
      s.scrollTop = target === s ? 0 : target.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - hdr - 16;
    }
    if (animate) go(tops()[k]); else jump(tops()[k]);
    return true;
  };
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const target = a.hash.length > 1 && document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!target || !slides.some((s) => s.contains(target))) return;
    e.preventDefault();
    history.pushState(null, '', a.hash);               // a link click is a real navigation
    reveal(target, true);
  });

  // Each long slide's own position is not something the browser restores, so
  // it travels in this history entry's state, with the slide index.
  const save = () => {
    try {
      history.replaceState({ ...(history.state || {}), sections: { i: current(), inner: slides.map((s) => s.scrollTop) } }, '');
    } catch {}
  };
  let saveT = 0;
  const saveSoon = () => { clearTimeout(saveT); saveT = window.setTimeout(save, 200); };
  for (const s of slides) s.addEventListener('scroll', saveSoon, { passive: true });
  addEventListener('scroll', saveSoon, { passive: true });
  addEventListener('pagehide', save);

  /** Put the page on a slide: a restored position, the hash target, or the
   *  slide the browser's own restoration left in view. */
  const settle = () => {
    cancelAnimationFrame(raf); busy = false;
    classify();
    const saved = history.state?.sections as { i: number; inner: number[] } | undefined;
    if (saved && saved.i >= 0 && saved.i < slides.length) {
      slides.forEach((s, k) => { if (isLong(s)) s.scrollTop = saved.inner[k] ?? 0; });
      jump(tops()[saved.i]);
      return;
    }
    const id = location.hash.slice(1);
    const target = id && document.getElementById(decodeURIComponent(id));
    if (target && reveal(target, false)) return;
    jump(tops()[current()]);
  };
  addEventListener('popstate', settle);
  addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) settle(); });
  if (history.state?.sections || location.hash || scrollY > 0) {
    // run after the browser's own scroll restoration, which happens at load
    if (document.readyState === 'complete') settle();
    else addEventListener('load', () => requestAnimationFrame(settle), { once: true });
  }

  // A rotation or a resize can change which slides are long and where each
  // slide starts: re-measure and stay on the same slide.
  let resizeT = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(() => {
      if (busy || touching) return;
      const i = current();
      classify();
      jump(tops()[i]);
      syncChrome();
    }, 120);
  }, { passive: true });
}
