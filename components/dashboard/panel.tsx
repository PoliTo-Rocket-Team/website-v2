import type { ReactNode } from "react";
import Link from "next/link";

/** The dashboard card: panel fill, hairline edge, 12px corners (boards 40 to 46). */
export const PANEL = "rounded-xl border border-hairline bg-panel/60";

// A titled panel: a header row over a hairline, then its rows, each on its own hairline.
export function Panel({
  title,
  detail,
  meta,
  children,
  className = "",
}: {
  title: string;
  detail?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${PANEL} ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug">{title}</h2>
          {detail && <p className="mt-0.5 text-[13px] text-prt-muted">{detail}</p>}
        </div>
        {meta && <div className="shrink-0 pt-0.5 text-[13px] text-prt-muted">{meta}</div>}
      </header>
      <ul className="divide-y divide-hairline">{children}</ul>
    </section>
  );
}

/** The small outlined pill at the end of a row: "Review", "Upload". */
export function RowAction({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 shrink-0 items-center rounded-full border border-white-10 px-3.5 text-[13px] font-medium transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {label}
    </Link>
  );
}
