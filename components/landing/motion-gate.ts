"use client";

import { useEffect, useState, type RefObject } from "react";

// The motion gate (issue #59): a continuous landing animation (a twinkle, the
// shooting star, the partners marquee) runs only while someone can see it
// and nothing re-blurs it. An element may run when all hold:
//  - the tab is visible;
//  - some of it shows on screen below the fixed glass navbar, and none of it
//    shows under the bar, so the bar's backdrop blur never redraws over it;
//  - no other surface that blurs its backdrop (a .glass-card, a .glass-info)
//    covers its centre.
// Everything else holds still. Reduced motion is the CSS's job: each
// animation is off under motion-reduce.
//
// Two IntersectionObservers serve every gated element. One watches the screen
// below the bar, the other the bar's own strip. Each reports when the
// element's visible box (after any overflow-hidden clipping) starts or stops
// touching its area, so a clipped element is judged as exactly as a whole one:
// there is no ratio to cross. The glass test reads the hit stack at the
// element's centre, only when the element crosses an edge, the window resizes,
// or the tab comes back: never on every frame.

// The navbar is 72px tall from md (navbar.tsx). On phones it is 64px, so there
// motion stops 8px early, which nobody can see.
const BAR_PX = 72;

type Gated = { setRun: (run: boolean) => void; belowBar: boolean; underBar: boolean };

const gated = new Map<Element, Gated>();
let below: IntersectionObserver | null = null;
let strip: IntersectionObserver | null = null;
let stripHeight = 0;

function blursBackdrop(el: Element): boolean {
  const style = getComputedStyle(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
  const filter = style.backdropFilter || style.webkitBackdropFilter || "none";
  return filter !== "none";
}

function underGlass(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).some(blursBackdrop);
}

function judge(el: Element, g: Gated) {
  g.setRun(!document.hidden && g.belowBar && !g.underBar && !underGlass(el));
}

function judgeAll() {
  gated.forEach((g, el) => judge(el, g));
}

function watch(mark: (g: Gated, touching: boolean) => void, rootMargin: string) {
  return new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const g = gated.get(entry.target);
        if (!g) continue;
        mark(g, entry.isIntersecting);
        judge(entry.target, g);
      }
    },
    { rootMargin },
  );
}

// The strip's root is the screen with its bottom pulled up to the bar line.
// A root margin cannot mix a length and the screen height, so the strip
// observer is rebuilt when the screen height changes.
function rebuildStrip() {
  if (strip && stripHeight === window.innerHeight) return;
  strip?.disconnect();
  stripHeight = window.innerHeight;
  strip = watch(
    (g, touching) => {
      g.underBar = touching;
    },
    `0px 0px ${BAR_PX - stripHeight}px 0px`,
  );
  gated.forEach((_, el) => strip?.observe(el));
}

function start() {
  if (below) return;
  below = watch(
    (g, touching) => {
      g.belowBar = touching;
    },
    `-${BAR_PX}px 0px 0px 0px`,
  );
  rebuildStrip();
  document.addEventListener("visibilitychange", judgeAll);
  let frame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      rebuildStrip();
      judgeAll();
    });
  });
}

/** Whether the element's continuous animation may run now (see above). */
export function useMotionGate(ref: RefObject<Element | null>): boolean {
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    start();
    gated.set(el, { setRun, belowBar: false, underBar: true });
    below?.observe(el);
    strip?.observe(el);
    return () => {
      below?.unobserve(el);
      strip?.unobserve(el);
      gated.delete(el);
    };
  }, [ref]);
  return run;
}
