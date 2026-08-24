import Image from "next/image";
import Link from "next/link";
import { Starfield } from "./starfield";

// Board 10 — Footer. Starfield bookend (stars ONLY on hero + footer): fixed stars,
// a few twinkling, one shooting star crossing the upper half every ~20s.
const columns = [
  {
    head: "ABOUT",
    links: [
      ["The Team", "/about/the-team"],
      ["Alumni", "/about/alumni"],
      ["Our University", "/about/our-university"],
      ["Mission & Vision", "/about/mission-vision"],
    ],
  },
  {
    head: "PROJECTS",
    links: [
      ["Cavour", "/projects/cavour"],
      ["VES", "/projects/ves"],
      ["VES Mark II", "/projects/ves-mark-ii"],
      ["Efesto", "/projects/efesto"],
    ],
  },
  {
    head: "GET INVOLVED",
    links: [
      ["Apply", "/apply"],
      ["Partners", "/partners"],
      ["Outreach", "/outreach"],
    ],
  },
  {
    head: "CONTACT",
    links: [
      ["info@politorocketteam.it", "mailto:info@politorocketteam.it"],
      ["Instagram", "https://instagram.com/politorocketteam"],
      ["LinkedIn", "https://linkedin.com/company/polito-rocket-team"],
      ["X / Twitter", "https://x.com/politorocketteam"],
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-ground">
      {/* Starfield bookend */}
      <div className="absolute inset-0">
        <Starfield count={52} seed={23} twinkleEvery={7} />
        <span
          aria-hidden
          className="absolute left-[70%] top-[12%] h-px w-28 animate-shooting-star bg-gradient-to-r from-white to-transparent"
        />
      </div>

      <div className="relative px-6 pb-10 pt-24 md:px-16">
        <div className="mx-auto max-w-[1312px]">
          <div className="flex flex-col justify-between gap-14 lg:flex-row">
            {/* Brand */}
            <div className="max-w-[320px]">
              <Image src="/design/prt-mark.png" alt="" width={40} height={50} />
              <p className="mt-6 text-sm leading-relaxed text-prt-muted">
                A student rocketry team at Politecnico di Torino. Born for space, built in Torino,
                Italy.
              </p>
            </div>

            {/* Columns */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-10 sm:grid-cols-4">
              {columns.map((col) => (
                <div key={col.head}>
                  <h3 className="font-mono text-xs tracking-widest text-dim">{col.head}</h3>
                  <ul className="mt-5 space-y-3">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        <Link
                          href={href}
                          className="text-sm text-text-2 transition-colors hover:text-accent"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <hr className="mt-16 border-t border-hairline" />

          <div className="mt-6 flex flex-col justify-between gap-3 font-mono text-xs tracking-wider text-dim md:flex-row">
            <p>POLITO ROCKET TEAM ™ 2026</p>
            <p>
              POLITECNICO DI TORINO · CORSO DUCA DEGLI ABRUZZI 24, TORINO, ITALY
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
