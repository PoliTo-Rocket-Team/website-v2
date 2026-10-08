import Image from "next/image";
import type { PartnerLogo as Logo } from "@/lib/partners";

// A partner's logo at a fixed drawn height, in full colour. A logo the
// luminance check measured too dark for the page (`darkLogo`) is drawn all
// white by a filter: no plate behind it and no recoloured file (Huey, issue
// #107).

/** Drawn heights in px for each logo kind: [phone, from md]. */
export type LogoHeights = Record<Logo["kind"], readonly [number, number]>;

/** `sizes` for a logo drawn at a fixed height: its width at each height, capped where its box caps it. */
function logoSizes(logo: Logo, heights: LogoHeights, maxWidth: number) {
  const [phone, desktop] = heights[logo.kind].map((h) => Math.min(maxWidth, Math.ceil((h * logo.width) / logo.height)));
  return `(min-width: 768px) ${desktop}px, ${phone}px`;
}

export function PartnerLogo({
  logo,
  alt,
  heights,
  maxWidth = Number.POSITIVE_INFINITY,
  className,
}: {
  logo: Logo;
  alt: string;
  heights: LogoHeights;
  /** The widest the logo is ever drawn, when its box is narrower than the logo at full height. */
  maxWidth?: number;
  /** The height classes, which must match `heights`. */
  className: string;
}) {
  return (
    <Image
      src={logo.src}
      alt={alt}
      width={logo.width}
      height={logo.height}
      sizes={logoSizes(logo, heights, maxWidth)}
      className={`w-auto object-contain ${logo.darkLogo ? "brightness-0 invert" : ""} ${className}`}
    />
  );
}
