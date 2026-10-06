"use client";

import { useEffect, type RefObject } from "react";

// The navbar's glass (`.glass-bar` in app/globals.css) blurs whatever sits
// under it, and the browser redoes that blur every time the content under
// the bar changes. The hero canvas redraws while parked, so a bar over it
// re-blurs on every canvas frame (issues #61, #63). Over the hero the bar
// gains nothing from the blur: the sky under it is near black. So while a
// canvas shows under the bar, the bar drops its blur and keeps its tint
// (`html[data-glass-bar="clear"]` in app/globals.css); it gets it back once
// the canvas has left the bar's strip.

/** The navbar's height from md (navbar.tsx). On phones it is 64px. */
export const BAR_PX = 72;

const holds = new Set<symbol>();

function apply() {
  const root = document.documentElement;
  if (holds.size > 0) root.dataset.glassBar = "clear";
  else delete root.dataset.glassBar;
}

/** Clears the bar's blur until the returned release is called. */
function clearGlassBar(): () => void {
  const hold = Symbol("clear");
  holds.add(hold);
  apply();
  return () => {
    holds.delete(hold);
    apply();
  };
}

/**
 * The root margin that shrinks the screen to the bar's strip: its bottom is
 * pulled up to the bar line. A root margin cannot mix a length and the screen
 * height, so an observer using it is rebuilt when the screen height changes.
 */
export function barStripMargin(screenHeight: number): string {
  return `0px 0px ${BAR_PX - screenHeight}px 0px`;
}

/**
 * While `active`, clears the bar's blur whenever any of the element's box
 * shows under the bar. The box is the transformed one, which is also the area
 * a redraw dirties.
 */
export function useClearGlassBarOver(ref: RefObject<Element | null>, active: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let release: (() => void) | null = null;
    const set = (under: boolean) => {
      if (under && !release) release = clearGlassBar();
      if (!under && release) {
        release();
        release = null;
      }
    };
    let io: IntersectionObserver | null = null;
    let height = 0;
    const observe = () => {
      if (io && height === window.innerHeight) return;
      io?.disconnect();
      height = window.innerHeight;
      io = new IntersectionObserver(([e]) => set(e.isIntersecting), {
        rootMargin: barStripMargin(height),
      });
      io.observe(el);
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      window.removeEventListener("resize", observe);
      io?.disconnect();
      set(false);
    };
  }, [ref, active]);
}
