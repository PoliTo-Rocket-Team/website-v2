"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DepartmentGroup, Departments as DepartmentsData, DivisionLead, GroupMember } from "@/lib/about/types";
import { GAP, groupLayout } from "./group-layout";
import { Avatar, Contacts, PersonCell } from "./person";
import { SectionHead } from "./section-head";

// Boards 26, 26d, 26e, 26f and 26m, "Departments": a carousel of groups,
// sideways on the platform's own scroll with snap, the groups not in view
// dimmed. On phones the current group sits at the left edge with the next one
// peeking in from the screen edge. From lg each group is as wide as its grid
// and the current one sits in the middle of the content column. Owner
// decision on issue #363: the groups sit far apart, so only a narrow slice of
// a neighbour shows at the column's edge and the groups never read as one
// slide, and a chevron at each edge of the column steps the carousel. Where
// the column is too narrow for that (from lg to about 1310px wide), the group
// shrinks so the slice still shows.
// Arrows and dots below, the edge chevrons from lg, and the arrow keys on the
// focused carousel step it; a swipe or a trackpad scrolls it natively and the
// dots follow. Nothing folds away: every head and lead is always shown.
//
// Inside a group, from lg: a grid of person cells, its columns set by the
// group (`groupLayout`), each head with its division leads under it in two
// columns. Below lg: one column, 60px heads and the leads in a tight
// two-column grid with 26px photos.

function Lead({ lead }: { lead: DivisionLead }) {
  return (
    <li className="flex items-start gap-2 lg:gap-3">
      <Avatar photo={lead.photo} sizeClass="h-[26px] w-[26px] lg:h-10 lg:w-10" sizes="40px" />
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
      />
      {leads.length > 0 && (
        <ul className="ml-[72px] mt-3 grid grid-cols-2 gap-x-2.5 gap-y-3 lg:ml-0 lg:mt-5 lg:gap-x-3 lg:gap-y-4 lg:border-l lg:border-white-10 lg:pl-5">
          {leads.map((l, i) => (
            <Lead key={`${l.division}-${l.name}-${i}`} lead={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** CSS custom properties the classes below read. */
type Vars = Record<`--${string}`, string | number>;

/**
 * What the Team page editor wraps (board 80e, issue #285): each member of a
 * slide by their place across all the slides in order, and each slide's
 * heading, where "+ Add department" sits.
 */
export type DepartmentFrames = {
  readonly member?: (index: number, member: ReactNode) => ReactNode;
  readonly heading?: (heading: ReactNode) => ReactNode;
};

/** A group's grid, as the CSS custom properties its slide sets for itself and its grid. */
function gridVars(group: DepartmentGroup): Vars {
  const { columns, width } = groupLayout(group);
  return { "--cols": columns, "--w": `${width}px` };
}

function Group({ group, offset, frames }: { group: DepartmentGroup; offset: number; frames: DepartmentFrames }) {
  const heading = <h3 className="text-[20px] font-bold tracking-[-0.02em] lg:text-center lg:text-[30px]">{group.name}</h3>;
  return (
    <>
      {frames.heading?.(heading) ?? heading}
      <div
        className="mt-5 grid grid-cols-1 gap-y-6 lg:mx-auto lg:mt-10 lg:max-w-[var(--w)] lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))] lg:gap-x-[var(--gap)] lg:gap-y-16"
      >
        {group.members.map((m, i) => {
          const member = <Member member={m} />;
          return <Fragment key={`${m.name}-${i}`}>{frames.member?.(offset + i, member) ?? member}</Fragment>;
        })}
      </div>
    </>
  );
}

/** From lg: how much of a neighbouring group shows at the column's edge, px. */
const PEEK = 48;
/** From lg: the least space between two groups, px; wider than the column gap inside a group. */
const GROUP_GAP = 64;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Carousel({ groups, label, frames }: { groups: readonly DepartmentGroup[]; label: string; frames: DepartmentFrames }) {
  const scroller = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const [shownSlide, setCurrent] = useState(0);
  const count = groups.length;
  // In the editor a slide can go while it is in view.
  const current = Math.min(shownSlide, count - 1);
  const offsets = groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.members.length, 0));

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

  // From lg: the widest a group may be, the column less a group gap and a
  // peek on each side; each end's padding, half the column less half that
  // end group as shown, so the end groups centre too; and the space before
  // each group but the first, which puts a neighbour's near edge one peek
  // in from the column's edge whenever the current group is the wider of the
  // two. When it is the narrower, the neighbour would show half their
  // difference more, so the carousel is clipped by that much on that side:
  // a neighbour always shows exactly one peek, at the clip's edge.
  const fit = `(100cqw - ${2 * (GROUP_GAP + PEEK)}px)`;
  const shown = (width: number) => `min(${width}px, ${fit})`;
  const widths = groups.map((g) => groupLayout(g).width);
  const clip = (n: number) =>
    n < 0 || n >= count ? "0px" : `calc((${shown(Math.max(widths[n], widths[current]))} - ${shown(widths[current])}) / 2)`;
  const spacing: Vars = {
    "--gap": `${GAP}px`,
    "--fit": `calc${fit}`,
    "--pad-start": `calc(50cqw - ${shown(widths[0])} / 2)`,
    "--pad-end": `calc(50cqw - ${shown(widths[count - 1])} / 2)`,
    "--clip-l": clip(current - 1),
    "--clip-r": clip(current + 1),
    // 2px all round for the focus ring.
    "--clip": "inset(-2px calc(var(--clip-r) - 2px) -2px calc(var(--clip-l) - 2px))",
  };
  const before = (i: number): Vars => ({
    "--before": i === 0 ? "0px" : `calc(50cqw - ${shown(Math.max(widths[i - 1], widths[i]))} / 2 - ${PEEK}px)`,
  });

  // From lg a chevron at each edge of the carousel as clipped, over the
  // neighbour's slice, steps to the previous or next group; none past
  // either end. The chevron slides with the clip edge only under motion-safe.
  // A step that reaches an end removes the chevron that took it, so focus
  // moves to the carousel first, where the arrow keys go on stepping it.
  const edge =
    "absolute top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 items-center justify-center text-prt-text/80 transition-colors duration-300 ease-out motion-safe:transition-[color,left,right] motion-safe:duration-300 motion-safe:ease-out hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 lg:flex";
  const step = (to: number) => {
    if (to <= 0 || to >= count - 1) scroller.current?.focus({ preventScroll: true });
    go(to);
  };

  return (
    <div style={spacing} className="relative [container-type:inline-size]">
      {current > 0 && (
        <button type="button" aria-label="Previous group" onClick={() => step(current - 1)} className={`${edge} left-[var(--clip-l)]`}>
          <ChevronLeft aria-hidden className="h-11 w-11" strokeWidth={1.25} />
        </button>
      )}
      {current < count - 1 && (
        <button type="button" aria-label="Next group" onClick={() => step(current + 1)} className={`${edge} right-[var(--clip-r)]`}>
          <ChevronRight aria-hidden className="h-11 w-11" strokeWidth={1.25} />
        </button>
      )}
      {/* Bleeds to the screen edge on phones, so the next group peeks in
          from the edge; from lg the groups sit far apart in the content
          column, so only a slice of a neighbour shows at its edges. */}
      <div
        ref={scroller}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative -mx-5 flex snap-x snap-mandatory items-start overflow-x-auto px-5 [scroll-padding-inline:20px] [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 md:-mx-16 md:px-16 md:[scroll-padding-inline:64px] lg:mx-0 lg:pl-[var(--pad-start)] lg:pr-[var(--pad-end)] lg:[clip-path:var(--clip)] lg:[scroll-padding-inline:0] lg:motion-safe:[transition:clip-path_300ms_ease-out] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((g, i) => (
          <div
            key={`${i}-${g.name}`}
            ref={(el) => {
              slides.current[i] = el;
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${g.name}`}
            style={{ ...gridVars(g), ...before(i) }}
            className={`w-[calc(100vw-52px)] max-w-[560px] shrink-0 snap-start pr-5 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out md:pr-10 lg:ml-[var(--before)] lg:w-[min(var(--w),var(--fit))] lg:max-w-none lg:snap-center lg:pr-0 ${
              i === current ? "opacity-100" : "opacity-[0.35]"
            }`}
          >
            <Group group={g} offset={offsets[i]} frames={frames} />
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
                key={`${i}-${g.name}`}
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

export function Departments({ departments, frames = {} }: { departments: DepartmentsData; frames?: DepartmentFrames }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow={departments.eyebrow} title={departments.title} intro={departments.intro} align="centre" />
        <div className="mt-10 lg:mt-14">
          <Carousel groups={departments.groups} label={departments.title} frames={frames} />
        </div>
      </div>
    </section>
  );
}
