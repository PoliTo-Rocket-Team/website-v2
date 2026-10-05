import Image from "next/image";
import Link from "next/link";
import { Starfield } from "./starfield";

// Board 21 footer. Its own background: ground, the streaks texture at 30% in
// screen blend, fixed stars with a few twinkling, and one shooting star
// crossing the upper half every ~20s.
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
    <footer className="relative isolate overflow-hidden bg-ground">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image
          src="/textures/streaks.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-30 mix-blend-screen"
        />
        <Starfield count={52} seed={23} twinkleEvery={7} />
        <span className="absolute left-[70%] top-[12%] h-px w-28 animate-shooting-star bg-gradient-to-r from-white to-transparent motion-reduce:hidden" />
      </div>

      <div className="px-6 pb-10 pt-24 md:px-16">
        <div className="mx-auto max-w-[1312px]">
          <div className="grid gap-14 lg:grid-cols-[350px_1fr] lg:gap-0">
            {/* Brand. The block is as wide as the tagline's first line, and the
                logo fills it, so the logo's left edge and width follow the
                tagline whatever the font renders at. */}
            <div className="w-max">
              <Link href="/" className="block" aria-label="Polito Rocket Team">
                <Image
                  src="/brand/prt-logo-white.svg"
                  alt=""
                  width={943}
                  height={137}
                  className="h-auto w-full"
                />
              </Link>
              <p className="mt-8 text-[15px] leading-6 text-prt-muted">
                <span className="block whitespace-nowrap">
                  A student rocketry team at Politecnico di Torino.
                </span>
                <span className="block">Born for space, built in Torino, Italy.</span>
              </p>
            </div>

            {/* Columns */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-10 sm:grid-cols-4 sm:gap-x-6">
              {columns.map((col) => (
                <div key={col.head}>
                  <h3 className="font-mono text-[11px] tracking-[0.2em] text-dim">{col.head}</h3>
                  <ul className="mt-4 space-y-3">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        <Link
                          href={href}
                          className={`text-[15px] transition-colors hover:text-accent ${
                            href.startsWith("mailto:") ? "text-accent" : "text-prt-text"
                          }`}
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

          <hr className="mt-20 border-t border-hairline" />

          <div className="mt-8 flex flex-col justify-between gap-3 font-mono text-[11px] tracking-[0.2em] text-dim md:flex-row">
            <p>POLITO ROCKET TEAM ™ 2026</p>
            <div className="flex flex-col gap-3 md:flex-row md:gap-14">
              <p>CORSO DUCA DEGLI ABRUZZI 24, TORINO, ITALY</p>
              <p>POLITECNICO DI TORINO</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
