"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

// Board 24 (below md): a horizontal swipe row. The items sit side by side
// 10px apart and snap to the 20px page edge, the next one peeking in, with
// pager dots below: the current item is a short pill, the others dots. The row
// bleeds to the screen edges so a card can peek past the section padding.
// From md the row is whatever layout `className` gives it (a grid), and the
// dots are gone. Vertical overflow is clipped on phones only: the scroller
// would otherwise scroll down into the card rockets' hanging canvases.
export function SwipeRow({
  children,
  label,
  className,
}: {
  children: ReactNode;
  /** Names the row for assistive tech, e.g. "Projects". */
  label: string;
  className?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const count = Children.count(children);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () => {
      const first = row.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.offsetWidth + parseFloat(getComputedStyle(row).columnGap || "0");
      // The last item cannot snap to the start edge, so the end of the scroll
      // range counts as the last item.
      const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
      setActive(atEnd ? count - 1 : Math.round(row.scrollLeft / step));
    };
    update();
    row.addEventListener("scroll", update, { passive: true });
    return () => row.removeEventListener("scroll", update);
  }, [count]);

  const goTo = (i: number) => {
    const row = rowRef.current;
    const item = row?.children[i] as HTMLElement | undefined;
    if (!row || !item) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left: item.offsetLeft - row.offsetLeft - 20, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <>
      <div
        ref={rowRef}
        role="group"
        aria-label={label}
        className={`-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-[10px] overflow-x-auto overflow-y-hidden px-5 pb-5 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
      >
        {children}
      </div>
      <div className="flex items-center justify-center gap-[5px] md:hidden">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show item ${i + 1} of ${count}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out ${
              i === active ? "w-[18px] bg-prt-text" : "w-1.5 bg-prt-text/40"
            }`}
          />
        ))}
      </div>
    </>
  );
}
