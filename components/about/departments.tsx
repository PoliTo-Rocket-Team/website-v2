"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DepartmentGroup, Departments as DepartmentsData, DivisionLead, GroupMember } from "@/lib/about/types";
import { groupLayout } from "./group-layout";
import { Avatar, Contacts, PersonCell } from "./person";
import { SectionHead } from "./section-head";

// Boards 26, 26d, 26e, 26f and 26m, "Departments": a carousel of groups,
// sideways on the platform's own scroll with snap. The current group sits in
// the middle; on phones at the left edge with the next one peeking in,
// dimmed. From lg only the current group shows, with chevrons at the edges.
// Arrows and dots below, and the arrow keys on the focused carousel, step it;
// a swipe or a trackpad scrolls it natively and the dots follow. Nothing
// folds away: every head and lead is always shown.
//
// Inside a group, from lg: a grid of person cells, its columns set by the
// group (`groupLayout`), each head with its division leads under it in two
// columns. Below lg: one column, 60px heads and the leads in a tight
// two-column grid with 26px photos.

function Lead({ lead }: { lead: DivisionLead }) {
  return (
    <li className="flex items-start gap-2 lg:gap-3">
      <Avatar
        person={lead}
        sizeClass="h-[26px] w-[26px] lg:h-10 lg:w-10"
        sizes="40px"
        fallback="initials"
        initialsClass="text-[8px] lg:text-[11px]"
      />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold leading-tight text-prt-text lg:text-[15px]">{lead.name}</p>
        <p className="mt-0.5 text-[11px] leading-tight text-prt-muted lg:text-[13px]">{lead.division}</p>
        <Contacts person={lead} iconClass="h-3 w-3 lg:h-3.5 lg:w-3.5" className="mt-1 gap-2 lg:mt-1.5" />
      </div>
    </li>
  );
}

function Member({ member }: { member: GroupMember }) {
  const head = member.kind === "head";
  const leads = head ? member.leads : [];
  return (
    <div>
      <PersonCell
        person={member}
        role={head ? member.role : member.division}
        accent={head}
        phone={{ avatar: "h-[60px] w-[60px]", gap: "gap-3" }}
        fallback="mark-to-initials"
      />
      {leads.length > 0 && (
        <ul className="ml-[72px] mt-3 grid grid-cols-2 gap-x-2.5 gap-y-3 lg:ml-0 lg:mt-5 lg:gap-x-5 lg:gap-y-4 lg:border-l lg:border-white-10 lg:pl-5">
          {leads.map((l) => (
            <Lead key={l.division} lead={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** CSS custom properties the classes below read. */
type Vars = Record<`--${string}`, string | number>;

function Group({ group }: { group: DepartmentGroup }) {
  const { columns, gap, width } = groupLayout(group);
  const grid: Vars = { "--cols": columns, "--gap": `${gap}px`, "--w": `${width}px` };
  return (
    <>
      <h3 className="text-[20px] font-bold tracking-[-0.02em] lg:text-center lg:text-[30px]">{group.name}</h3>
      <div
        style={grid}
        className="mt-5 grid grid-cols-1 gap-y-6 lg:mx-auto lg:mt-10 lg:max-w-[var(--w)] lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))] lg:gap-x-[var(--gap)] lg:gap-y-16"
      >
        {group.members.map((m, i) => (
          <Member key={`${m.name}-${i}`} member={m} />
        ))}
      </div>
    </>
  );
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Carousel({ groups, label }: { groups: readonly DepartmentGroup[]; label: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const count = groups.length;

  /** The scroll position that puts slide i where its snap aligns it: centred from lg, at the start below. */
  const targetOf = useCallback((i: number) => {
    const el = scroller.current;
    const slide = slides.current[i];
    if (!el || !slide) return 0;
    const centred = getComputedStyle(slide).scrollSnapAlign.includes("center");
    return centred
      ? slide.offsetLeft + slide.offsetWidth / 2 - el.clientWidth / 2
      : slide.offsetLeft - parseFloat(getComputedStyle(el).scrollPaddingLeft || "0");
  }, []);

  // The current slide is the one whose snap position is nearest the scroll
  // position, so the dots follow a swipe as well as the buttons.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let best = 0;
        for (let i = 1; i < count; i++) {
          if (Math.abs(targetOf(i) - el.scrollLeft) < Math.abs(targetOf(best) - el.scrollLeft)) best = i;
        }
        setCurrent(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, [count, targetOf]);

  const go = (i: number) => {
    const to = Math.min(count - 1, Math.max(0, i));
    scroller.current?.scrollTo({ left: targetOf(to), behavior: reducedMotion() ? "auto" : "smooth" });
    setCurrent(to);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(current - 1);
    else if (e.key === "ArrowRight") go(current + 1);
    else return;
    e.preventDefault();
  };

  const arrow =
    "flex h-11 w-11 items-center justify-center rounded-full border text-prt-text transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 disabled:cursor-default disabled:border-white-5 disabled:text-dim";

  // From lg one group fills the content column, with no neighbour peeking in;
  // a large chevron at each edge of the column steps to the next or previous
  // group, as on the old site.
  const peek =
    "absolute top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 items-center justify-center text-prt-text/80 transition-colors duration-200 ease-out hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 lg:flex";

  return (
    <div className="relative [container-type:inline-size]">
      {current < count - 1 && (
        <button type="button" aria-label="Next group" onClick={() => go(current + 1)} className={`${peek} right-0`}>
          <ChevronRight aria-hidden className="h-11 w-11" strokeWidth={1.25} />
        </button>
      )}
      {current > 0 && (
        <button type="button" aria-label="Previous group" onClick={() => go(current - 1)} className={`${peek} left-0`}>
          <ChevronLeft aria-hidden className="h-11 w-11" strokeWidth={1.25} />
        </button>
      )}
      {/* Bleeds to the screen edge on phones, so the next group peeks in
          from the edge; from lg each group fills the content column. */}
      <div
        ref={scroller}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative -mx-5 flex snap-x snap-mandatory items-start overflow-x-auto px-5 [scroll-padding-inline:20px] [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 md:-mx-16 md:px-16 md:[scroll-padding-inline:64px] lg:mx-0 lg:gap-0 lg:px-0 lg:[scroll-padding-inline:0] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((g, i) => (
          <div
            key={g.name}
            ref={(el) => {
              slides.current[i] = el;
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${g.name}`}
            className={`w-[calc(100vw-52px)] max-w-[560px] shrink-0 snap-start pr-5 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out md:pr-10 lg:w-[100cqw] lg:max-w-none lg:snap-center lg:px-[72px] ${
              i === current ? "opacity-100" : "opacity-[0.35]"
            }`}
          >
            <Group group={g} />
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-10 flex items-center justify-center gap-6 lg:mt-12">
          <button
            type="button"
            aria-label="Previous group"
            disabled={current === 0}
            onClick={() => go(current - 1)}
            className={`${arrow} border-white-10 hover:border-border-strong`}
          >
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-2">
            {groups.map((g, i) => (
              <button
                key={g.name}
                type="button"
                aria-label={`Show ${g.name}`}
                aria-current={i === current ? "true" : undefined}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-300 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 ${
                  i === current ? "w-6 bg-accent" : "w-1.5 bg-dim hover:bg-prt-muted"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next group"
            disabled={current === count - 1}
            onClick={() => go(current + 1)}
            className={`${arrow} border-white-10 hover:border-border-strong`}
          >
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {`${groups[current].name}, group ${current + 1} of ${count}`}
      </p>
    </div>
  );
}

export function Departments({ departments }: { departments: DepartmentsData }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead title={departments.title} intro={departments.intro} align="centre" />
        <div className="mt-10 lg:mt-14">
          <Carousel groups={departments.groups} label={departments.title} />
        </div>
      </div>
    </section>
  );
}
