import { PartnerLogo, type LogoHeights } from "@/components/partners/partner-logo";
import { partners, type Partner } from "@/lib/partners";
import { Marquee } from "./marquee";
import { RocketArrow } from "./rocket-arrow";

// Board 08 / 21 — Partners. Logo marquee scrolls right→left, ~40s loop, pause on
// hover and while nobody can see it (marquee.tsx).
// Full-color logos (grayscale was explicitly rejected); a logo too dark for
// the page is drawn white (`darkLogo`). Edge fade masks on site only.
// The logos are every partner in lib/partners.ts, the record the Partners
// page reads, in its order. A logo with a site links to it in a new tab; one
// with none is a plain logo, never a dead link. A near-square mark is drawn
// taller than the wordmarks, as board 21 draws Sophia.

/** Drawn heights in px, below md and from md (the h-[…] classes below). */
const LOGO_H: LogoHeights = { wordmark: [25, 50], mark: [38, 76] };

function LogoItem({ partner }: { partner: Partner }) {
  const className = "mx-[18px] flex shrink-0 items-center opacity-80 md:mx-10 transition-opacity duration-300 hover:opacity-100";
  const mark = (
    <PartnerLogo
      logo={partner.logo}
      alt={partner.name}
      heights={LOGO_H}
      className={partner.logo.kind === "mark" ? "h-[38px] md:h-[76px]" : "h-[25px] md:h-[50px]"}
    />
  );
  if (partner.website === undefined) return <span className={className}>{mark}</span>;
  return (
    <a href={partner.website} target="_blank" rel="noopener noreferrer" aria-label={partner.name} className={className}>
      {mark}
    </a>
  );
}

export function Partners() {
  const loop = [...partners, ...partners];
  return (
    // No box and no fill: the page sky shows behind the logo strip. Board 24
    // below md: 20px sides, 56px top and bottom, 26px heading, then "Become a
    // partner", then the logos at half size in a 56px marquee.
    <section className="px-0 py-section">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col justify-between gap-4 px-5 md:flex-row md:items-end md:gap-8 md:px-16">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-accent">PARTNERS</p>
          <h2 className="mt-4 text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
            Their logos fly with the rocket.
          </h2>
        </div>
        <a
          href="mailto:info@politorocketteam.it"
          className="group inline-flex shrink-0 items-center gap-3 font-mono text-base text-prt-text transition-colors hover:text-accent md:mb-2"
        >
          Become a partner
          <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
        </a>
      </div>

      <Marquee>
        {loop.map((partner, i) => (
          <LogoItem key={i} partner={partner} />
        ))}
      </Marquee>
    </section>
  );
}
