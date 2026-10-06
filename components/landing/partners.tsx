import Image from "next/image";
import { RocketArrow } from "./rocket-arrow";

// Board 08 / 21 — Partners. Logo marquee scrolls right→left, ~40s loop, pause on hover.
// Full-color logos (grayscale was explicitly rejected). Edge fade masks on site only.
// Static list for now; partners will come from the database, with real URLs.
// Every logo is a link; "#" stands in until the URLs exist.
// `tall` marks a near-square mark that board 21 draws taller than the wordmarks.
// `width` and `height` are the file's own pixels: they give the logo its true
// shape before it loads, and its drawn width for `sizes`.
type Logo = { href: string } & (
  | { src: string; width: number; height: number; alt: string; tall?: boolean }
  | { text: string }
);

/** Drawn heights in px, below md and from md (the h-[…] classes below). */
const LOGO_H = { regular: [25, 50], tall: [38, 76] } as const;

/** `sizes` for a logo drawn at a fixed height: its width at each height. */
function logoSizes(width: number, height: number, tall?: boolean) {
  const [phone, desktop] = LOGO_H[tall ? "tall" : "regular"].map((h) => Math.ceil((h * width) / height));
  return `(min-width: 768px) ${desktop}px, ${phone}px`;
}

const logos: Logo[] = [
  { src: "/design/sponsors/color-altium.png", width: 743, height: 163, alt: "Altium", href: "#" },
  { src: "/design/sponsors/color-ansys.png", width: 207, height: 66, alt: "Ansys", href: "#" },
  { text: "BETA CAE Systems", href: "#" }, // SVG is UTF-16; styled text until it is converted
  { src: "/design/sponsors/color-camerana.png", width: 1600, height: 508, alt: "Camerana", href: "#" },
  { src: "/design/sponsors/color-esss.png", width: 768, height: 260, alt: "eSSS", href: "#" },
  { src: "/design/sponsors/color-evomisure.png", width: 742, height: 137, alt: "Evomisure", href: "#" },
  { src: "/design/sponsors/color-explorer.png", width: 310, height: 78, alt: "Explorer", href: "#" },
  { src: "/design/sponsors/color-magicar.png", width: 857, height: 324, alt: "Magicar", href: "#" },
  { src: "/design/sponsors/color-mul2.png", width: 173, height: 100, alt: "Mul2", href: "#" },
  { src: "/design/sponsors/color-siemens.png", width: 794, height: 127, alt: "Siemens", href: "#" },
  { src: "/design/sponsors/color-sophia.png", width: 514, height: 463, alt: "Sophia", href: "#", tall: true },
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
          width={logo.width}
          height={logo.height}
          sizes={logoSizes(logo.width, logo.height, logo.tall)}
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

      <div className="group relative mt-6 flex h-14 items-center overflow-hidden md:mt-14 md:block md:h-auto [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-marquee items-center motion-reduce:animate-none group-hover:[animation-play-state:paused]">
          {loop.map((logo, i) => (
            <LogoItem key={i} logo={logo} />
          ))}
        </div>
      </div>
    </section>
  );
}
