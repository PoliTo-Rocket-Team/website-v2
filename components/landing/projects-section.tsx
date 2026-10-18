import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { newestFirst, type HomeCardView, type LandingCardView } from "@/lib/project-content/record";
import { FILLS_FRAME, HOME_CARD_LAYOUT, HomeProjectCard } from "./project-card";
import { RocketArrow } from "./rocket-arrow";
import { SwipeRow } from "./swipe-row";
import { PAGES } from "@/lib/landing-links";

// Board 21, projects: the home Projects section as it draws the cards it is
// handed, newest first (issue #359, `newestFirst`). Home hands it the
// published projects (projects.tsx); the edit
// shell's page switch (board 75d, issue #300) hands it the same list with the
// project being edited in its place, and a `frame` that outlines that card
// and dims the others. Each card is on its brand texture, with its rocket
// live in 3D and a liquid glass info box (project-card.tsx).
//
// Hover: only the card's glass edge brightens. The rocket stays where it
// rests (Huey, 2026-10-06: no hover rise).
//
// The cards sit side by side in one horizontal swipe row at every width
// (issue #359), the next card peeking, so a fourth project never wraps to a
// new line: board 24 below md, 210 x 360 each, 10px apart, with pager dots
// below; from md 618px tall, 16px apart, two to a view below lg and three
// from lg, as board 21 shows them (swipe-row.tsx, `HOME_CARD_LAYOUT`).
// Phone copy is shorter: `phone` text replaces the desktop text below md.

/** Wraps one card in place: the card drawn to fill the frame, and the box the row gives it. */
export type HomeCardFrame = (card: HomeCardView, node: ReactNode, layout: string) => ReactNode;

/**
 * Home hands linked cards and no frame: each card opens its project's page
 * (issue #372) and its rocket turns while hovered (issue #385). The edit shell hands
 * plain cards and a frame: no card links, and every rocket holds still.
 */
export type ProjectsSectionProps =
  | { cards: readonly LandingCardView[]; frame?: undefined }
  | { cards: readonly HomeCardView[]; frame: HomeCardFrame };

export function ProjectsSection(props: ProjectsSectionProps) {
  return (
    // Board 24 below md: 20px sides, 56px top and bottom, 26px heading, then
    // the swipe row.
    <section className="px-5 py-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-accent">PROJECTS</p>
            <h2 className="mt-4 text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
              Built in Torino.
              <br />
              Flown around the world.
            </h2>
          </div>
          <Link
            href={PAGES.projects}
            className="group inline-flex shrink-0 items-center gap-3 font-mono text-base text-prt-text transition-colors hover:text-accent md:mb-1"
          >
            All projects
            <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
          </Link>
        </div>

        {/* The row's own 24px top room is the gap to the cards below md, and
            with mt-8 the 56px gap from md. */}
        <SwipeRow label="Projects" className="md:mt-8">
          {props.frame === undefined
            ? newestFirst(props.cards).map((p) => <HomeProjectCard key={p.num} project={p} href={p.href} rocketTurns />)
            : newestFirst(props.cards).map((p) => (
                <Fragment key={p.num}>{props.frame(p, <HomeProjectCard project={p} layout={FILLS_FRAME} />, HOME_CARD_LAYOUT)}</Fragment>
              ))}
        </SwipeRow>
      </div>
    </section>
  );
}

