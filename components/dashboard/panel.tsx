import type { ReactNode } from "react";
import Link from "next/link";

/** The dashboard card: panel fill, hairline edge, 12px corners (boards 40 to 46). */
export const PANEL = "rounded-xl border border-hairline bg-panel/60";

// A titled panel: a header row over a hairline, then its rows, each on its own
// hairline. With `phoneCards`, phones drop the frame (boards 56m, the phone
// rule "tables become stacked cards"): the title sits on the page and each row
// is its own card.
export function Panel({
  title,
  detail,
  meta,
  phoneMeta,
  phoneCards = false,
  children,
  className = "",
}: {
  title: string;
  detail?: string;
  meta?: ReactNode;
  /** What phones show beside the title instead of `detail` and `meta` (board 52m: "2 of 4 done"). */
  phoneMeta?: ReactNode;
  phoneCards?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const frame = phoneCards ? `md:rounded-xl md:border md:border-hairline md:bg-panel/60` : PANEL;
  return (
    <section className={`${frame} ${className}`}>
      <header
        className={`flex items-start justify-between gap-4 md:border-b md:border-hairline md:px-5 md:py-4 ${
          phoneCards ? "max-md:pb-3" : "border-b border-hairline px-4 py-3.5"
        }`}
      >
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug">{title}</h2>
          {detail && <p className={`mt-0.5 text-[13px] text-prt-muted ${phoneMeta ? "max-md:hidden" : ""}`}>{detail}</p>}
        </div>
        {meta && <div className={`shrink-0 pt-0.5 text-[13px] text-prt-muted ${phoneMeta ? "max-md:hidden" : ""}`}>{meta}</div>}
        {phoneMeta && <div className="shrink-0 pt-0.5 text-[13px] text-prt-muted md:hidden">{phoneMeta}</div>}
      </header>
      <ul
        className={
          phoneCards
            ? "flex flex-col gap-2.5 md:gap-0 md:divide-y md:divide-hairline max-md:[&>li]:rounded-xl max-md:[&>li]:border max-md:[&>li]:border-hairline max-md:[&>li]:bg-panel/60"
            : "divide-y divide-hairline"
        }
      >
        {children}
      </ul>
    </section>
  );
}

/**
 * The small pill at the end of a row: outlined ("Review", "Upload"), or as a
 * `chip`, the smaller filled one board 56m puts on its attention cards.
 */
export function RowAction({ label, href, chip = false }: { label: string; href: string; chip?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center rounded-full font-medium transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        chip ? "h-6 bg-white-10 px-2.5 text-[12px] hover:text-accent" : "h-8 border border-white-10 px-3.5 text-[13px] hover:border-border-strong"
      }`}
    >
      {label}
    </Link>
  );
}
