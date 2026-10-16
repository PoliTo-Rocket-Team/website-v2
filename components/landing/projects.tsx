import Link from "next/link";
import { homeCardOf } from "@/lib/project-content/record";
import { publishedProjects } from "@/lib/project-content/public";
import { HomeProjectCard } from "./project-card";
import { RocketArrow } from "./rocket-arrow";
import { SwipeRow } from "./swipe-row";

// Board 21, projects. The published projects in site order (issue #295), on
// their brand textures, each with Cavour live in 3D and a liquid glass info
// box (project-card.tsx). Each card's copy is its project's stored record's
// home card.
//
// Hover: only the card's glass edge brightens. The rocket stays where it
// rests (Huey, 2026-10-06: no hover rise).
//
// Board 24 below md: the cards sit side by side in a horizontal swipe row,
// 210 x 360 each, 10px apart, with scroll-snap, the next card peeking and
// pager dots below (swipe-row.tsx). Phone copy is shorter: `phone` text
// replaces the desktop text below md.

export async function Projects() {
  const cards = (await publishedProjects()).map(homeCardOf);
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
            href="/projects"
            className="group inline-flex shrink-0 items-center gap-3 font-mono text-base text-prt-text transition-colors hover:text-accent md:mb-1"
          >
            All projects
            <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
          </Link>
        </div>

        <SwipeRow
          label="Projects"
          className="mt-6 md:mt-14 md:grid md:gap-8 lg:grid-cols-3 lg:gap-4"
        >
          {cards.map((p) => (
            <HomeProjectCard key={p.name} project={p} />
          ))}
        </SwipeRow>
      </div>
    </section>
  );
}
