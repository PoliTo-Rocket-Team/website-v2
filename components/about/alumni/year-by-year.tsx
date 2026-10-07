"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AcademicYear, Founder, NonEmpty } from "@/lib/about/alumni-types";
import { groupsOf, yearLabel, yearSlug, type Entry, type ShownGroup } from "@/lib/about/alumni-year";
import { SectionHead } from "../section-head";

// Boards 28, 28b and 28c, "Year by year": a row of academic-year pills,
// newest first, the selected one white, and under it only the selected
// year's groups. The selected year sits in the URL (?year=2022-23), so it can
// be shared. The pills are the repo's Radix tabs, so the arrow keys move
// between years. When the pills don't fit, the row scrolls sideways on the
// platform's own scroll (swipe, trackpad, or the arrows beside it from md),
// and an edge with more years past it fades. From md the row is at most
// 760px wide (board 28c). Phones: the strip runs edge to
// edge, with no arrows.
//
// Each group is a heading and a list of name and role, four columns from lg,
// two from md, one on phones. A group longer than its first rows (2 for a
// department, 3 for the others) shows those rows and a "Show all N" button.

/** Whether the row has years past its left and right edges. */
type Overflow = { left: boolean; right: boolean };

/** How wide the fade is on an edge with more years past it, in px. */
const FADE = 48;

/** The fade on an edge with more years past it. */
function maskOf({ left, right }: Overflow): string | undefined {
  if (!left && !right) return undefined;
  const from = left ? `transparent 0, black ${FADE}px` : "black 0";
  const to = right ? `black calc(100% - ${FADE}px), transparent 100%` : "black 100%";
  return `linear-gradient(to right, ${from}, ${to})`;
}

/**
 * Where an unscrolled row must scroll so the selected pill sits clear of the
 * right fade, centred where the row allows; undefined when it already does.
 * Both rects are the browser's, so the pill's place is measured from the
 * row's own inner edge, never from the page.
 */
function scrollToShow(row: HTMLElement, pill: HTMLElement): number | undefined {
  if (row.scrollWidth <= row.clientWidth) return undefined;
  const start = pill.getBoundingClientRect().left - row.getBoundingClientRect().left - row.clientLeft + row.scrollLeft;
  const end = start + pill.offsetWidth;
  if (end <= row.scrollLeft + row.clientWidth - FADE) return undefined;
  return start - (row.clientWidth - pill.offsetWidth) / 2;
}

function ArrowButton({ side, enabled, onClick }: { side: "left" | "right"; enabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      aria-label={side === "left" ? "Newer academic years" : "Older academic years"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white-10 text-prt-text transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:text-dim disabled:hover:border-white-10"
    >
      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

function YearSwitch({ years }: { years: NonEmpty<AcademicYear> }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<Overflow>({ left: false, right: false });

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () =>
      setOverflow({
        left: row.scrollLeft > 1,
        right: row.scrollLeft + row.clientWidth < row.scrollWidth - 1,
      });
    update();
    row.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, []);

  // A shared link may select a year past the right edge: bring its pill into
  // the row once, on load, without scrolling the page. Later picks are made
  // on pills already in view.
  useEffect(() => {
    const row = rowRef.current;
    const pill = row?.querySelector<HTMLElement>('[data-state="active"]');
    if (!row || !pill) return;
    const left = scrollToShow(row, pill);
    if (left !== undefined) row.scrollLeft = left;
  }, []);

  const step = (direction: -1 | 1) => {
    const row = rowRef.current;
    if (!row) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({ left: direction * row.clientWidth * 0.6, behavior: reduced ? "auto" : "smooth" });
  };

  const arrows = overflow.left || overflow.right ? "hidden md:flex" : "hidden";
  return (
    <div className="mt-6 flex items-center justify-center gap-3 md:mt-10">
      <div className={arrows}>
        <ArrowButton side="left" enabled={overflow.left} onClick={() => step(-1)} />
      </div>
      <TabsList
        ref={rowRef}
        aria-label="Academic years"
        style={{ maskImage: maskOf(overflow), WebkitMaskImage: maskOf(overflow) }}
        className="-mx-5 min-w-0 gap-1.5 overflow-x-auto px-5 py-1 [scrollbar-width:none] md:mx-0 md:max-w-[760px] md:gap-1 md:rounded-full md:border md:border-white-10 md:bg-white-5 md:p-1 [&::-webkit-scrollbar]:hidden"
      >
        {years.map((y) => (
          <TabsTrigger
            key={y.start}
            value={yearSlug(y)}
            className="h-9 shrink-0 whitespace-nowrap rounded-full bg-white-5 px-5 font-mono text-[13px] tracking-[0.04em] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text data-[state=active]:bg-prt-text data-[state=active]:text-ground md:h-[38px] md:bg-transparent md:px-5 md:text-[14px]"
          >
            {yearLabel(y)}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className={arrows}>
        <ArrowButton side="right" enabled={overflow.right} onClick={() => step(1)} />
      </div>
    </div>
  );
}

function EntryRow({ entry, display }: { entry: Entry; display: string }) {
  return (
    <li className={`min-w-0 flex-col border-b border-white-10 py-3.5 ${display}`}>
      <p className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[15px] leading-tight text-prt-text">{entry.name}</span>
        {entry.tag !== undefined && (
          <span className={`shrink-0 font-mono text-[9px] tracking-[0.2em] ${entry.tag === "LEAD" ? "text-prt-muted" : "text-accent"}`}>
            {entry.tag}
          </span>
        )}
      </p>
      <p className={`mt-1 truncate text-[13px] leading-tight ${entry.lead ? "text-accent" : "text-prt-muted"}`}>{entry.role}</p>
    </li>
  );
}

/**
 * Which rows show before "Show all", at one, two and four columns. Rows past
 * them stay in the page, hidden, so "Show all" moves nothing above it.
 */
function displayOf(i: number, rows: number, everyone: boolean): string {
  if (everyone || i < rows) return "flex";
  if (i < rows * 2) return "hidden md:flex";
  if (i < rows * 4) return "hidden lg:flex";
  return "hidden";
}

/** At which widths the group is longer than its first rows. */
function foldsAt(count: number, rows: number): string | undefined {
  if (count > rows * 4) return "flex";
  if (count > rows * 2) return "flex lg:hidden";
  if (count > rows) return "flex md:hidden";
  return undefined;
}

function Group({ group }: { group: ShownGroup }) {
  const [everyone, setEveryone] = useState(false);
  const count = group.entries.length;
  const folds = everyone ? undefined : foldsAt(count, group.firstRows);
  return (
    <section className="mt-10 border-t border-white-10 pt-10 md:mt-12 md:pt-12">
      <h3 className="flex items-baseline gap-3 text-[22px] font-bold leading-tight tracking-[-0.02em] text-prt-text md:text-[28px]">
        {group.name}
        {group.counted && (
          <span className="font-mono text-[10px] font-normal tracking-[0.2em] text-dim md:text-[11px]">{count} PEOPLE</span>
        )}
      </h3>
      <ul className="mt-3 grid grid-cols-1 md:mt-5 md:grid-cols-2 md:gap-x-8 lg:grid-cols-4">
        {group.entries.map((e, i) => (
          // Stand-in years repeat one name, so the row's place is its key.
          <EntryRow key={i} entry={e} display={displayOf(i, group.firstRows, everyone)} />
        ))}
      </ul>
      {folds !== undefined && (
        <div className={`mt-6 justify-center md:mt-8 ${folds}`}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEveryone(true)}
            className="h-11 w-full rounded-full border-white-10 bg-transparent px-6 text-[15px] font-medium text-prt-text hover:border-border-strong hover:bg-transparent hover:text-prt-text focus-visible:ring-1 focus-visible:ring-prt-text/60 focus-visible:ring-offset-0 md:w-auto"
          >
            Show all {count}
            <ChevronDown aria-hidden strokeWidth={1.75} />
          </Button>
        </div>
      )}
    </section>
  );
}

export function YearByYear({
  eyebrow,
  title,
  years,
  founders,
  initial,
}: {
  eyebrow: string;
  title: string;
  /** Newest first. */
  years: NonEmpty<AcademicYear>;
  founders: readonly Founder[];
  /** The slug of the year selected when the page loads. */
  initial: string;
}) {
  const [selected, setSelected] = useState(initial);

  const select = useCallback((slug: string) => {
    setSelected(slug);
    const url = new URL(window.location.href);
    url.searchParams.set("year", slug);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow={eyebrow} title={title} align="centre" />
        <Tabs value={selected} onValueChange={select}>
          <YearSwitch years={years} />
          {years.map((y) => (
            <TabsContent key={y.start} value={yearSlug(y)}>
              {groupsOf(y, founders).map((g) => (
                <Group key={g.name} group={g} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
