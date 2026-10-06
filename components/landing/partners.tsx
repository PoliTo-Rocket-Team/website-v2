import Image from "next/image";
import { Marquee } from "./marquee";
import { RocketArrow } from "./rocket-arrow";

// Board 08 / 21 — Partners. Logo marquee scrolls right→left, ~40s loop, pause on
// hover and while nobody can see it (marquee.tsx).
// Full-color logos (grayscale was explicitly rejected). Edge fade masks on site only.
// Static list for now; partners will come from the database, with real URLs.
// Every logo is a link; "#" stands in until the URLs exist.
// `tall` marks a near-square mark that board 21 draws taller than the wordmarks.
type Logo = { href: string } & ({ src: string; alt: string; tall?: boolean } | { text: string });

const logos: Logo[] = [
  { src: "/design/sponsors/color-altium.png", alt: "Altium", href: "#" },
  { src: "/design/sponsors/color-ansys.png", alt: "Ansys", href: "#" },
  { text: "BETA CAE Systems", href: "#" }, // SVG is UTF-16; styled text until it is converted
  { src: "/design/sponsors/color-camerana.png", alt: "Camerana", href: "#" },
  { src: "/design/sponsors/color-esss.png", alt: "eSSS", href: "#" },
  { src: "/design/sponsors/color-evomisure.png", alt: "Evomisure", href: "#" },
  { src: "/design/sponsors/color-explorer.png", alt: "Explorer", href: "#" },
  { src: "/design/sponsors/color-magicar.png", alt: "Magicar", href: "#" },
  { src: "/design/sponsors/color-mul2.png", alt: "Mul2", href: "#" },
  { src: "/design/sponsors/color-siemens.png", alt: "Siemens", href: "#" },
  { src: "/design/sponsors/color-sophia.png", alt: "Sophia", href: "#", tall: true },
];

function LogoItem({ logo }: { logo: Logo }) {
  // Real partner sites open in a new tab; the "#" placeholder stays put.
  const external = logo.href !== "#";
  return (
    <a
      href={logo.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={"text" in logo ? logo.text : logo.alt}
      className="mx-[18px] flex shrink-0 items-center opacity-80 md:mx-10 transition-opacity duration-300 hover:opacity-100"
    >
      {"text" in logo ? (
        <span className="whitespace-nowrap font-mono text-[11px] font-semibold md:text-lg tracking-wide text-text-2">
          {logo.text}
        </span>
      ) : (
        <Image
          src={logo.src}
          alt={logo.alt}
          width={140}
          height={56}
          className={`w-auto object-contain ${logo.tall ? "h-[38px] md:h-[76px]" : "h-[25px] md:h-[50px]"}`}
        />
      )}
    </a>
  );
}

export function Partners() {
  const loop = [...logos, ...logos];
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
        {loop.map((logo, i) => (
          <LogoItem key={i} logo={logo} />
        ))}
      </Marquee>
    </section>
  );
}
