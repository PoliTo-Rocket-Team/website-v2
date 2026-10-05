import Link from "next/link";
import { RocketArrow } from "./rocket-arrow";

// Board 21, inside the team: header, four figures, then four small liquid
// glass link cards.
const figures = [
  { value: "150+", label: "students this year" },
  { value: "2021", label: "started by a group of friends" },
  { value: "4", label: "international campaigns" },
  { value: "3", label: "projects: two rockets, one engine" },
];

const routes = [
  { title: "The Team", sub: "The people flying this year's vehicle", href: "/about/the-team" },
  { title: "Alumni", sub: "Everyone who got us off the ground", href: "/about/alumni" },
  { title: "Our University", sub: "Where we study, build and get funded", href: "/about/our-university" },
  { title: "Mission & Vision", sub: "What we're trying to prove", href: "/about/mission-vision" },
];

export function InsideTeam() {
  return (
    // Board 24 below md: 20px sides, 56px top and bottom, 26px heading,
    // figures 2 x 2 with 52px numbers (each under its own rule), link cards
    // stacked.
    <section className="px-5 py-14 md:px-16 md:py-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-8">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-accent">INSIDE THE TEAM</p>
            <h2 className="mt-4 text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:max-w-[16ch] md:text-[48px]">
              Who&apos;s behind the rockets.
            </h2>
          </div>
          <p className="max-w-[460px] text-[15px] leading-relaxed text-text-2 md:text-[17px]">
            People who design, machine, solder, test and fly the vehicle themselves, between
            lectures and exams.
          </p>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:mt-[73px] md:gap-y-10 md:border-t md:border-hairline md:pt-7 lg:grid-cols-4 lg:gap-x-0">
          {figures.map((f) => (
            <div
              key={f.value}
              className="flex flex-col-reverse justify-end border-t border-hairline pt-6 md:border-t-0 md:pt-0"
            >
              <dt className="mt-4 text-[15px] text-text-2 md:mt-3 md:text-base">{f.label}</dt>
              <dd className="text-[52px] font-extrabold leading-none tracking-[-0.01em] md:text-[84px]">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 grid gap-3 md:mt-[67px] md:grid-cols-2 md:gap-4 lg:grid-cols-4">
          {routes.map((r) => (
            <Link
              key={r.title}
              href={r.href}
              className="glass-card group block rounded-xl px-5 py-[22px] transition-colors md:px-6"
            >
              <span className="flex items-center justify-between gap-4">
                <span className="text-lg font-semibold transition-colors group-hover:text-accent md:text-[19px]">
                  {r.title}
                </span>
                <RocketArrow className="shrink-0 opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
              </span>
              <span className="mt-1 block text-[15px] text-text-2">{r.sub}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
