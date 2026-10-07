"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DepartmentGroup, Departments as DepartmentsData, DivisionLead, GroupMember } from "@/lib/about/types";
import { Avatar, Contacts } from "./person";
import { SectionHead } from "./section-head";

// Boards 26, 26d, 26e, 26f and 26m, "Departments": a carousel of groups,
// sideways on the platform's own scroll with snap. The current group sits in
// the middle (on phones at the left edge) and the next one peeks in, dimmed.
// Arrows and dots below, and the arrow keys on the focused carousel, step it;
// a swipe or a trackpad scrolls it natively and the dots follow. Nothing
// folds away: every head and lead is always shown.
//
// Inside a group, from lg: two mirror-image columns about a dashed centre
// line, the members alternating left and right in order, each head with its
// division leads under it. Below lg: one column, 60px heads and the leads in
// a tight two-column grid with 26px photos.

/** A side of the centre line, from lg. Phones always have the photo first. */
type Side = "left" | "right";

function Lead({ lead, side }: { lead: DivisionLead; side: Side }) {
  return (
    <li className={`flex items-start gap-2 lg:items-center lg:gap-[13px] ${side === "left" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
      <Avatar
        person={lead}
        sizeClass="h-[26px] w-[26px] lg:h-[52px] lg:w-[52px]"
        sizes="52px"
        fallback="initials"
        initialsClass="text-[8px] lg:text-[11px]"
      />
      <div className={`min-w-0 ${side === "left" ? "lg:flex lg:flex-col lg:items-end" : ""}`}>
        <p className="text-[12px] font-semibold leading-tight text-prt-text lg:text-[14px]">{lead.name}</p>
        <p className="mt-0.5 text-[11px] leading-tight text-prt-muted lg:text-[12px]">{lead.division}</p>
        <Contacts person={lead} iconClass="h-3 w-3" className="mt-1 gap-2" />
      </div>
    </li>
  );
}

function Member({ member, side }: { member: GroupMember; side: Side }) {
  const role = member.kind === "head" ? member.role : member.division;
  const leads = member.kind === "head" ? member.leads : [];
  return (
    <div className={`flex flex-col ${side === "left" ? "lg:items-end" : "lg:items-start"}`}>
      <div className={`flex items-center gap-3 lg:gap-[23px] ${side === "left" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
        <Avatar person={member} sizeClass="h-[60px] w-[60px] lg:h-[120px] lg:w-[120px]" sizes="120px" fallback="mark" />
        <div className={`min-w-0 ${side === "left" ? "lg:flex lg:flex-col lg:items-end" : ""}`}>
          <p className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-prt-text lg:text-[22px]">{member.name}</p>
          <p className={`mt-0.5 text-[13px] leading-tight lg:mt-1.5 lg:text-[16px] ${member.kind === "head" ? "text-accent" : "text-text-2"}`}>
            {role}
          </p>
          <Contacts person={member} iconClass="h-4 w-4 lg:h-[18px] lg:w-[18px]" className="mt-1.5 lg:mt-2.5" />
        </div>
      </div>
      {leads.length > 0 && (
        <ul
          className={`ml-[72px] mt-3 grid grid-cols-2 gap-x-2.5 gap-y-3 lg:mt-5 lg:flex lg:flex-col lg:gap-3 ${
            side === "left" ? "lg:ml-0 lg:mr-[34px] lg:items-end" : "lg:ml-[34px]"
          }`}
        >
          {leads.map((l) => (
            <Lead key={l.division} lead={l} side={side} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Group({ group }: { group: DepartmentGroup }) {
  return (
    <>
      <h3 className="text-[20px] font-bold tracking-[-0.02em] lg:text-center lg:text-[30px]">{group.name}</h3>
      <div className="relative mt-5 grid grid-cols-1 gap-y-6 lg:mt-9 lg:grid-cols-2 lg:gap-x-20 lg:gap-y-14">
        <span aria-hidden className="absolute inset-y-0 left-1/2 hidden border-l border-dashed border-dim lg:block" />
        {group.members.map((m, i) => (
          <Member key={`${m.name}-${i}`} member={m} side={i % 2 === 0 ? "left" : "right"} />
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

  return (
    <div>
      {/* Bleeds to the screen edge on phones, so the next group peeks in
          from the edge; from lg it stays on the content column, the current
          group centred and the next one clipped at the column's edge. */}
      <div
        ref={scroller}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative -mx-5 flex snap-x snap-mandatory items-start overflow-x-auto px-5 [scroll-padding-inline:20px] [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 md:-mx-16 md:px-16 md:[scroll-padding-inline:64px] lg:mx-0 lg:px-[calc((100%-840px)/2)] lg:[scroll-padding-inline:0] [&::-webkit-scrollbar]:hidden"
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
            className={`w-[calc(100vw-52px)] max-w-[560px] shrink-0 snap-start pr-5 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out md:pr-10 lg:w-[840px] lg:max-w-none lg:snap-center lg:px-0 ${
              i === current ? "opacity-100" : "opacity-[0.35]"
            }`}
          >
            <Group group={g} />
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-10 flex items-center justify-center gap-6 lg:mt-14">
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
        <SectionHead eyebrow={departments.eyebrow} title={departments.title} intro={departments.intro} align="centre" />
        <div className="mt-10 lg:mt-14">
          <Carousel groups={departments.groups} label={departments.title} />
        </div>
      </div>
    </section>
  );
}
