"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

// A horizontal swipe row at every width (board 24 below md; issue #359 from
// md, so a row of cards never wraps to a new line). The items sit side by
// side and snap to the page edge, the next one peeking in: 10px apart at the
// 20px phone edge, 16px apart at the 64px edge from md. The row bleeds over
// the section padding to the screen edges, so a card can peek past it. Pager
// dots sit below: the current item is a short pill, the others dots. Phones
// always show them; from md they show only while the items overflow the row,
// so three cards that fit, as board 21 draws them, show none.
// Vertical overflow is clipped: the scroller would otherwise scroll down into
// the card rockets' hanging canvases. So the clip edge sits below the cards'
// whole shadow (`.glass-project`: 16px down, 40px blur, so 56px), not across
// it, where it drew a hard line (issue #50). The row pulls the next thing back
// up by that room: by 36px over the dots, so they stay 20px under the cards,
// and by all 56px when there are no dots. The clip's top edge sits 24px above
// the cards too, so the edit shell's Edit card chip, which rides 20px over a
// card's top edge (board 75d), is not cut off. That room is empty and is part
// of the row's gap above its cards.
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
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () => {
      setOverflows(row.scrollWidth > row.clientWidth + 1);
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
    const resized = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    resized?.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      resized?.disconnect();
    };
  }, [count]);

  const goTo = (i: number) => {
    const row = rowRef.current;
    const first = row?.firstElementChild as HTMLElement | null | undefined;
    const item = row?.children[i] as HTMLElement | undefined;
    if (!row || !first || !item) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The first item sits at the snap edge with the row scrolled to 0.
    row.scrollTo({ left: item.offsetLeft - first.offsetLeft, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <>
      <div
        ref={rowRef}
        role="group"
        aria-label={label}
        className={`-mx-5 -mb-9 flex snap-x snap-mandatory scroll-px-5 gap-[10px] overflow-x-auto overflow-y-hidden px-5 pb-14 pt-6 [scrollbar-width:none] md:-mx-16 md:scroll-px-16 md:gap-4 md:px-16 [&::-webkit-scrollbar]:hidden ${
          overflows ? "" : "md:-mb-14"
        } ${className ?? ""}`}
      >
        {children}
      </div>
      <div className={`relative flex items-center justify-center gap-[5px] ${overflows ? "" : "md:hidden"}`}>
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
