import Image from "next/image";

// Board 08 — Partners. Logo marquee scrolls right→left, ~40s loop, pause on hover.
// Full-color logos (grayscale was explicitly rejected). Edge fade masks on site only.
const logos = [
  { src: "/design/sponsors/color-altium.png", alt: "Altium" },
  { src: "/design/sponsors/color-ansys.png", alt: "Ansys" },
  { text: "BETA CAE Systems" }, // their SVG is broken UTF-16; styled text until a clean file exists
  { src: "/design/sponsors/color-camerana.png", alt: "Camerana" },
  { src: "/design/sponsors/color-esss.png", alt: "eSSS" },
  { src: "/design/sponsors/color-evomisure.png", alt: "Evomisure" },
  { src: "/design/sponsors/color-explorer.png", alt: "Explorer" },
  { src: "/design/sponsors/color-magicar.png", alt: "Magicar" },
  { src: "/design/sponsors/color-mul2.png", alt: "Mul2" },
  { src: "/design/sponsors/color-siemens.png", alt: "Siemens" },
  { src: "/design/sponsors/color-sophia.png", alt: "Sophia" },
];

function LogoItem({ logo }: { logo: (typeof logos)[number] }) {
  if ("text" in logo) {
    return (
      <span className="mx-10 whitespace-nowrap font-mono text-lg font-semibold tracking-wide text-text-2">
        {logo.text}
      </span>
    );
  }
  return (
    <Image
      src={logo.src!}
      alt={logo.alt!}
      width={140}
      height={56}
      className="mx-10 h-12 w-auto object-contain opacity-90"
    />
  );
}

export function Partners() {
  const loop = [...logos, ...logos];
  return (
    <section className="border-t border-hairline px-0 py-24">
      <div className="flex flex-col justify-between gap-8 px-6 md:flex-row md:items-end md:px-16">
        <div className="mx-auto w-full max-w-[1312px] md:mx-0">
          <p className="font-mono text-xs tracking-[0.3em] text-accent">PARTNERS</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Their logos fly with the rocket.
          </h2>
        </div>
        <a
          href="mailto:info@politorocketteam.it"
          className="font-mono text-sm tracking-wide text-text-2 underline-offset-4 transition-colors hover:text-accent md:mr-[calc((100vw-1312px)/2)]"
        >
          Become a partner →
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
