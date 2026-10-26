import type { ReactNode } from "react";
import Image from "next/image";
import { MarkFallback } from "@/components/mark-fallback";
import type { Copy } from "@/lib/projects";
import type { Fact, LaunchPhoto, Title } from "@/lib/project-pages";

// Pieces every project-page section shares: the accent rule over a numbered
// eyebrow and the section title, the mono status pill, a photo slot, a row of
// key facts, the text that has a shorter phone version, and the column a
// page block sits in.

/**
 * Wraps a block's content on the page's column. The editor outlines it there
 * (components/dashboard/project-edit.tsx); the public page draws it as it is.
 */
export type BlockFrame = (node: ReactNode) => ReactNode;

export const asIs: BlockFrame = (node) => node;

/** A page block's section: the block rhythm's top room, then its content on the page's column, wrapped in `frame`. */
export function BlockColumn({ frame = asIs, children }: { frame?: BlockFrame; children: ReactNode }) {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto max-w-[1312px]">{frame(children)}</div>
    </section>
  );
}

/**
 * A set holding a value as long as board 25's "Regenerative" needs room a
 * short set does not. A phone column is about 106px at 360 wide, so it is set
 * at board 25m's 17px, not board 23m's 20px. A six-column desktop row is
 * about 149px at 1024 wide, under the 172px such a value takes at 28px, so it
 * stays 3 x 2 until xl, where a column is 192px.
 */
const LONG_FACT = 10;
const factLayout = (facts: readonly Fact[]) =>
  facts.some((f) => f.value.length > LONG_FACT)
    ? { grid: "md:grid-cols-3 md:gap-y-6 xl:grid-cols-6 xl:gap-y-0", size: "text-[17px]" }
    : { grid: "md:grid-cols-6", size: "text-[20px]" };

/** Key facts: big numbers over their labels, three to a row on phones, up to six on desktop (`factLayout`). */
export function FactList({ facts, className = "" }: { facts: readonly Fact[]; className?: string }) {
  const layout = factLayout(facts);
  return (
    <dl className={`${className} grid grid-cols-3 ${layout.grid} md:border-t md:border-hairline md:pt-6`}>
      {facts.map((f) => (
        // Label under the value, as drawn; the markup keeps term before value.
        <div key={f.label.text} className="flex flex-col-reverse border-t border-hairline py-3 md:border-0 md:py-0">
          <dt className="mt-1 font-mono text-[9px] tracking-[0.2em] text-dim md:mt-2 md:text-[10px]">
            <CopyText copy={f.label} />
          </dt>
          <dd className={`whitespace-nowrap ${layout.size} font-bold tracking-[-0.02em] md:text-[28px]`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A title's forced line breaks; a plain string wraps where it falls. */
export function TitleText({ title }: { title: Title }) {
  if (typeof title === "string") return <>{title}</>;
  return (
    <>
      {title.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}

/** Text with its phone version below md, when it has one. */
export function CopyText({ copy }: { copy: Copy }) {
  if (copy.phone === undefined) return <>{copy.text}</>;
  return (
    <>
      <span className="md:hidden">{copy.phone}</span>
      <span className="hidden md:inline">{copy.text}</span>
    </>
  );
}

export function SectionHead({
  num,
  label,
  title,
  className = "",
}: {
  num: string;
  label: string;
  title: Title;
  className?: string;
}) {
  return (
    <div className={className}>
      <span aria-hidden className="block h-[3px] w-10 bg-accent" />
      <p className="mt-4 font-mono text-[11px] tracking-[0.3em] text-accent md:mt-6 md:text-xs">
        {num} – {label}
      </p>
      <h2 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] md:mt-4 md:text-[42px] md:tracking-[-0.03em]">
        <TitleText title={title} />
      </h2>
    </div>
  );
}

/** Status pills pair a -soft fill with the solid text colour (manifest, Colour). No red: a failure is orange. */
const pillTone = {
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent",
} as const;

export type PillTone = keyof typeof pillTone;

export function Pill({ tone, children, className = "" }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.15em] md:py-1.5 md:text-[11px] ${pillTone[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A photo slot: the launch's photo when it has one, else the project's texture under a dark fade, with the PRT mark (issue #366). */
export function PhotoSlot({ texture, photo, sizes, className = "" }: { texture: string; photo?: LaunchPhoto; sizes: string; className?: string }) {
  if (photo !== undefined) {
    return (
      <div className={`relative overflow-hidden rounded-xl ${className}`}>
        {/* An uploaded photo (the public store, or a preview's data URL) is served as it is, as Outreach photos are. */}
        <Image src={photo.src} alt={photo.alt} fill sizes={sizes} unoptimized={!photo.src.startsWith("/")} className="object-cover" />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: `url('${texture}')` }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-ground/80 via-ground/40 to-transparent" />
      <MarkFallback fit="frame" />
    </div>
  );
}

/** A spec value, or a dimmed dash where the sources give none. */
export function Value({ value }: { value: string | null }) {
  if (value !== null) return <>{value}</>;
  return (
    <>
      <span aria-hidden className="text-dim">
        –
      </span>
      <span className="sr-only">Not given</span>
    </>
  );
}
