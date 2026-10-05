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
    <section className="px-6 py-[120px] md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-accent">INSIDE THE TEAM</p>
            <h2 className="mt-4 max-w-[16ch] text-4xl font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
              Who&apos;s behind the rockets.
            </h2>
          </div>
          <p className="max-w-[460px] text-base leading-relaxed text-text-2">
            People who design, machine, solder, test and fly the vehicle themselves, between
            lectures and exams.
          </p>
        </div>

        <dl className="mt-16 grid grid-cols-2 gap-x-4 gap-y-10 border-t border-hairline pt-9 lg:grid-cols-4">
          {figures.map((f) => (
            <div key={f.value} className="flex flex-col-reverse justify-end">
              <dt className="mt-3 text-base text-text-2">{f.label}</dt>
              <dd className="text-6xl font-extrabold leading-none tracking-[-0.03em] md:text-[84px]">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-[72px] grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {routes.map((r) => (
            <Link
              key={r.title}
              href={r.href}
              className="glass-card group block rounded-xl px-6 py-5 transition-colors"
            >
              <span className="flex items-center justify-between gap-4">
                <span className="text-lg font-semibold transition-colors group-hover:text-accent">
                  {r.title}
                </span>
                <RocketArrow className="shrink-0 opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
              </span>
              <span className="mt-1.5 block text-sm text-text-2">{r.sub}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
