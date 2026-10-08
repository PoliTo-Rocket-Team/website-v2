import Image from "next/image";
import Link from "next/link";
import { ShootingStar } from "./shooting-star";
import { Starfield } from "./starfield";

// Board 21 footer. Its own background: the page sky's streak tile and grain
// (the board is "footer background throughout": the page sky was cut from
// it), so it reads as the same even dark streaks with no blotches; fixed
// stars with a few twinkling, and one shooting star crossing the upper half
// every ~20s. Board 24 below md: 20px sides, the
// brand block, then the link columns 2 x 2, then the address lines stacked.
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
      ["Instagram", "https://www.instagram.com/politorocketteam"],
      ["LinkedIn", "https://www.linkedin.com/company/politorocketteam"],
      ["X / Twitter", "https://x.com/PoliTo_RT"],
    ],
  },
];

export function LandingFooter() {
  return (
    // pt-section: the footer is the last section, so its top pad is the
    // section rhythm's and the gap after the apply band matches the others.
    <footer className="relative isolate overflow-hidden bg-ground pt-section">
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* Drawn down from the top edge, where the page sky above ends its
            tiles, so a sky that meets the footer runs on into it with no
            line (.page-sky-to-footer in app/globals.css). */}
        <div className="page-sky-light" />
        <div className="page-sky-grain" />
        <Starfield count={52} seed={23} twinkleEvery={7} />
        <ShootingStar />
      </div>

      <div className="px-5 pb-12 md:px-16">
        <div className="mx-auto max-w-[1312px]">
          {/* From lg the brand block and the four columns are one row, each as
              wide as its widest line, spread edge to edge: the space between
              every pair of columns, brand to ABOUT included, is the same. */}
          <div className="grid gap-11 md:gap-14 lg:flex lg:justify-between lg:gap-0">
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
              <p className="mt-[21px] text-[14px] leading-[22px] text-prt-muted md:text-[15px] md:leading-6">
                <span className="block whitespace-nowrap">
                  A student rocketry team at Politecnico di Torino.
                </span>
                <span className="block">Born for space, built in Torino, Italy.</span>
              </p>
            </div>

            {/* Columns */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-[14px] lg:contents">
              {columns.map((col) => (
                <div key={col.head}>
                  <h3 className="font-mono text-[11px] tracking-[0.2em] text-dim">{col.head}</h3>
                  <ul className="mt-2.5 md:space-y-2">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        <Link
                          href={href}
                          className={`text-[15px] leading-[25px] transition-colors hover:text-accent md:leading-normal ${
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

          <hr className="mt-8 border-t border-hairline md:mt-16" />

          <div className="mt-7 flex flex-col justify-between gap-3 font-mono text-[11px] tracking-[0.12em] text-dim md:flex-row md:tracking-[0.2em]">
            <p>POLITO ROCKET TEAM ™ 2026</p>
            <div className="flex flex-col gap-3 md:flex-row md:gap-14">
              <p>CORSO DUCA DEGLI ABRUZZI 24, TORINO, ITALY</p>
              <p className="hidden md:block">POLITECNICO DI TORINO</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
