import Link from "next/link";

// Board 07 — Inside the team. Title left, numbered route rows right.
const routes = [
  { num: "01", title: "The Team", sub: "The 150+ people flying this year's vehicle", href: "/about/the-team" },
  { num: "02", title: "Alumni", sub: "Everyone who got us off the ground since 2021", href: "/about/alumni" },
  { num: "03", title: "Our University", sub: "Where the team studies, builds and gets its funding", href: "/about/our-university" },
  { num: "04", title: "Mission & Vision", sub: "What we're trying to prove, and where it's going", href: "/about/mission-vision" },
];

/**
 * Cavour at arrow size, nose to the right: black hull, white seam ring, orange
 * nose, swept fins trailing past the tail, a stub of nozzle. 1em tall like
 * the → it replaces; the fins set the height, the hull is a third of it.
 */
function RocketArrow() {
  return (
    <svg viewBox="0 0 48 16" aria-hidden="true" className="h-[1em] w-[3em]">
      {/* fins: swept trapezoids, tip trailing past the tail like the real ones */}
      <path d="M6 6.4 H13 L8.5 3.2 H4 Z M6 9.6 H13 L8.5 12.8 H4 Z" fill="#6E6E75" />
      {/* nozzle */}
      <path d="M6 6.8 H3.8 L3 8 L3.8 9.2 H6 Z" fill="#8A8A8F" />
      {/* hull: lifted well off black so it reads on the page ground */}
      <rect x="6" y="6.2" width="26" height="3.6" fill="#5A5A60" />
      {/* white seam ring between hull and nose */}
      <rect x="31" y="6.2" width="2.2" height="3.6" fill="#F2F2F0" />
      {/* orange nose */}
      <path d="M33 6.2 Q42 6.3 47 8 Q42 9.7 33 9.8 Z" fill="#FF5100" />
    </svg>
  );
}

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
