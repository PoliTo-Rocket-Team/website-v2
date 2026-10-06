import type { ReactNode } from "react";

// Pieces every board 23 section shares: the accent rule over a numbered
// eyebrow and the section title, and the mono status pill.

export function SectionHead({ eyebrow, title, className = "" }: { eyebrow: string; title: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span aria-hidden className="block h-[3px] w-10 bg-accent" />
      <p className="mt-4 font-mono text-[11px] tracking-[0.3em] text-accent md:mt-6 md:text-xs">{eyebrow}</p>
      <h2 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] md:mt-4 md:text-[42px] md:tracking-[-0.03em]">{title}</h2>
    </div>
  );
}

/** Status pills pair a -soft fill with the solid text colour (manifest, Colour). No red: a failure is orange. */
const pillTone = {
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent",
} as const;

export function Pill({ tone, children, className = "" }: { tone: keyof typeof pillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.15em] md:py-1.5 md:text-[11px] ${pillTone[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A labelled photo slot: the Cavour texture under a dark fade until real photos exist. */
export function PhotoSlot({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/textures/project-cavour.webp')] bg-cover bg-center opacity-70"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-ground/80 via-ground/40 to-transparent" />
      <p className="absolute bottom-3 left-4 font-mono text-[10px] tracking-[0.2em] text-prt-muted">
        PHOTO · FROM ARCHIVE
      </p>
    </div>
  );
}
