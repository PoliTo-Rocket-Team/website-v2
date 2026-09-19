import Image from "next/image";
import { RocketArrow } from "./rocket-arrow";

// Board 08 — Partners. Logo marquee scrolls right→left, ~40s loop, pause on hover.
// Full-color logos (grayscale was explicitly rejected). Edge fade masks on site only.
// Static list for now; partners will come from the database, with real URLs.
// Every logo is a link; "#" stands in until the URLs exist.
type Logo = { href: string } & ({ src: string; alt: string } | { text: string });

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
  { src: "/design/sponsors/color-sophia.png", alt: "Sophia", href: "#" },
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
      className="mx-10 flex shrink-0 items-center opacity-80 transition-opacity duration-300 hover:opacity-100"
    >
      {"text" in logo ? (
        <span className="whitespace-nowrap font-mono text-lg font-semibold tracking-wide text-text-2">
          {logo.text}
        </span>
      ) : (
        <Image src={logo.src} alt={logo.alt} width={140} height={56} className="h-12 w-auto object-contain" />
      )}
    </a>
  );
}

export function Partners() {
  const loop = [...logos, ...logos];
  return (
    <section className="border-t border-hairline px-0 py-24">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col justify-between gap-8 px-6 md:flex-row md:items-end md:px-16">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-accent">PARTNERS</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Their logos fly with the rocket.
          </h2>
        </div>
        <a
          href="mailto:info@politorocketteam.it"
          className="group inline-flex shrink-0 items-center gap-3 font-mono text-sm tracking-wide text-text-2 transition-colors hover:text-accent"
        >
          Become a partner
          <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
        </a>
      </div>

      <div className="group relative mt-14 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-marquee items-center group-hover:[animation-play-state:paused]">
          {loop.map((logo, i) => (
            <LogoItem key={i} logo={logo} />
          ))}
        </div>
      </div>
    </section>
  );
}
