"use client";

import { useEffect, useState, type RefObject } from "react";

// The motion gate (issue #59): a continuous landing animation (a twinkle, the
// shooting star, the partners marquee) runs only while someone can see it
// and nothing re-blurs it. An element may run when all hold:
//  - the tab is visible;
//  - it is on screen and wholly below the fixed glass navbar, so the bar's
//    backdrop blur never has to redraw over it;
//  - no other surface that blurs its backdrop (a .glass-card, a .glass-info)
//    covers its centre.
// Everything else holds still, so a page at rest draws no frames. Reduced
// motion is the CSS's job: each animation is off under motion-reduce.
//
// One IntersectionObserver serves every gated element. The glass test reads
// the hit stack at the element's centre, only when the element crosses an
// edge, the window resizes, or the tab comes back: never on every frame.

// The navbar is 72px tall from md (navbar.tsx). On phones it is 64px, so there
// motion stops 8px early, which nobody can see.
const BAR_PX = 72;

type Gated = { setRun: (run: boolean) => void; clearOfBar: boolean };

const gated = new Map<Element, Gated>();
let observer: IntersectionObserver | null = null;

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
  g.setRun(!document.hidden && g.clearOfBar && !underGlass(el));
}

function judgeAll() {
  gated.forEach((g, el) => judge(el, g));
}

// Steps of a tenth, so an element that an overflow-hidden parent clips (its
// ratio never reaches 1) is still re-judged as it slides under the bar.
const THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 10);

function sharedObserver(): IntersectionObserver {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const g = gated.get(entry.target);
        if (!g) continue;
        const barLine = entry.rootBounds?.top ?? BAR_PX;
        g.clearOfBar = entry.isIntersecting && entry.boundingClientRect.top >= barLine - 0.5;
        judge(entry.target, g);
      }
    },
    { rootMargin: `-${BAR_PX}px 0px 0px 0px`, threshold: THRESHOLDS },
  );
  document.addEventListener("visibilitychange", judgeAll);
  let frame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(judgeAll);
  });
  return observer;
}

/** Whether the element's continuous animation may run now (see above). */
export function useMotionGate(ref: RefObject<Element | null>): boolean {
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = sharedObserver();
    gated.set(el, { setRun, clearOfBar: false });
    io.observe(el);
    return () => {
      io.unobserve(el);
      gated.delete(el);
    };
  }, [ref]);
  return run;
}
