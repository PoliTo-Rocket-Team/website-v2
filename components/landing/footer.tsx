import Image from "next/image";
import Link from "next/link";
import { ShootingStar } from "./shooting-star";
import { Starfield } from "./starfield";
import { type FooterProject, LEGAL_LINKS, PAGES, footerColumns, opensOf } from "@/lib/landing-links";

// Board 21 footer. Its own background: the page sky's streak tile and grain
// (the board is "footer background throughout": the page sky was cut from
// it), so it reads as the same even dark streaks with no blotches; fixed
// stars with a few twinkling, and one shooting star crossing the upper half
// every ~20s. Board 24 below md: 20px sides, the
// brand block (logo, tagline, street address), then the link columns 2 x 2,
// then the bottom row stacked.
// A server page renders it through SiteFooter (./site-footer.tsx), which reads
// the published projects; a view shared with a dashboard editor takes them as
// a prop from its page.
export function LandingFooter({ inSky = false, projects }: {
  /**
   * The footer sits inside a PageSky, which already paints the streak tile
   * and grain behind it; the footer then adds only its own stars and
   * shooting star, so the sky runs on into it with no line.
   */
  inSky?: boolean;
  /** The published projects, in site order: the PROJECTS column (issue #378). */
  projects: readonly FooterProject[];
}) {
  return (
    // pt-section: the footer is the last section, so its top pad is the
    // section rhythm's and the gap after the apply band matches the others.
    <footer className={`relative isolate overflow-hidden pt-section ${inSky ? "" : "bg-ground"}`}>
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* On its own (after the apply band) the footer paints the page
            sky's tile and grain itself, drawn down from its top edge. */}
        {!inSky && (
          <>
            <div className="page-sky-light" />
            <div className="page-sky-grain" />
          </>
        )}
        <Starfield count={52} seed={23} twinkleEvery={7} />
        <ShootingStar />
      </div>

      <div className="px-5 pb-10 md:px-16">
        <div className="mx-auto max-w-[1312px]">
          {/* From lg the brand block and the four columns are one row, each as
              wide as its widest line, spread edge to edge: the space between
              every pair of columns, brand to ABOUT included, is the same. */}
          <div className="grid gap-11 md:gap-14 lg:flex lg:justify-between lg:gap-0">
            {/* Brand. The block is as wide as the tagline's first line, and the
                logo fills it, so the logo's left edge and width follow the
                tagline whatever the font renders at. */}
            <div className="w-max max-w-full">
              <Link href={PAGES.home} className="block" aria-label="Polito Rocket Team">
                {/* w-0 + min-w-full: the logo adds nothing to the block's
                    max-content width, then fills it. With a plain w-full,
                    Safari counts the SVG's own 943px in the block's width, so
                    on a phone the logo grew past the screen and pushed the
                    right-hand link columns off it. */}
                <Image
                  src="/brand/prt-logo-white.svg"
                  alt=""
                  width={943}
                  height={137}
                  className="h-auto w-0 min-w-full"
                />
              </Link>
              <p className="mt-[21px] text-[14px] leading-[22px] text-prt-muted md:text-[15px] md:leading-6">
                <span className="block whitespace-nowrap">
                  A student rocketry team at Politecnico di Torino.
                </span>
                <span className="block">Born for space, built in Torino, Italy.</span>
              </p>
              {/* The street address, under the tagline in its muted type
                  (issue #737). w-0 + min-w-full, as on the logo: the line adds
                  nothing to the block's width, so the block stays as wide as
                  the tagline's first line and the logo keeps its width. */}
              <p className="mt-3 w-0 min-w-full text-[14px] leading-[22px] text-prt-muted md:text-[15px] md:leading-6">
                Corso Duca degli Abruzzi 24, Torino, Italy
              </p>
            </div>

            {/* Columns */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-[14px] lg:contents">
              {footerColumns(projects).map((col) => (
                <div key={col.head}>
                  <h3 className="font-mono text-[11px] tracking-[0.2em] text-dim">{col.head}</h3>
                  <ul className="mt-2.5 md:space-y-2">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        <Link
                          href={href}
                          {...opensOf(href)}
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

          {/* No item ever breaks inside itself (issue #774). At the wide
              tracking the full row needs about 770px, more than the md
              content width up to ~900px, so it stays stacked until lg. */}
          <div className="mt-10 flex flex-col justify-between gap-3 font-mono text-[11px] tracking-[0.12em] text-dim md:tracking-[0.2em] lg:flex-row">
            <p className="whitespace-nowrap">POLITO ROCKET TEAM ™ 2026</p>
            {/* The legal pages (issue #122) sit on the right, where the street
                address was before it moved under the tagline (issue #737). */}
            <div className="flex flex-col gap-3 lg:flex-row lg:gap-14">
              <ul className="flex gap-6">
                {LEGAL_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="whitespace-nowrap uppercase transition-colors duration-300 ease-out hover:text-accent">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="hidden whitespace-nowrap md:block">POLITECNICO DI TORINO</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
