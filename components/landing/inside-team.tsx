import Link from "next/link";
import { RocketArrow } from "./rocket-arrow";

// Board 07 — Inside the team. Title left, numbered route rows right.
const routes = [
  { num: "01", title: "The Team", sub: "The 150+ people flying this year's vehicle", href: "/about/the-team" },
  { num: "02", title: "Alumni", sub: "Everyone who got us off the ground since 2021", href: "/about/alumni" },
  { num: "03", title: "Our University", sub: "Where the team studies, builds and gets its funding", href: "/about/our-university" },
  { num: "04", title: "Mission & Vision", sub: "What we're trying to prove, and where it's going", href: "/about/mission-vision" },
];

export function InsideTeam() {
  return (
    <section className="border-t border-hairline px-6 py-24 md:px-16">
      <div className="mx-auto grid max-w-[1312px] gap-14 lg:grid-cols-[600px_1fr]">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-accent">INSIDE THE TEAM</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Who&apos;s behind the rockets.
          </h2>
          <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-prt-muted">
            People who design, machine, solder, test and fly the vehicle themselves, between
            lectures and exams.
          </p>
        </div>

        <div className="flex flex-col divide-y divide-hairline border-y border-hairline">
          {routes.map((r) => (
            <Link
              key={r.num}
              href={r.href}
              className="group flex items-center gap-6 py-6 transition-colors hover:bg-white-5"
            >
              <span className="w-10 shrink-0 font-mono text-sm text-dim transition-colors group-hover:text-accent">
                {r.num}
              </span>
              <span className="flex-1">
                <span className="block font-semibold transition-colors group-hover:text-accent">
                  {r.title}
                </span>
                <span className="mt-0.5 block text-sm text-prt-muted">{r.sub}</span>
              </span>
              <span className="shrink-0 pr-2 opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100">
                <RocketArrow />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
