import type { ReactNode } from "react";
import { TopBarAction } from "./top-bar-slot";

// The title block over a dashboard page (boards 43 to 45b, 59 to 61): the
// page name, one line under it, and the page's main action on the right. On
// phones the shell's top bar shows the page name (boards 50m, 55m), so the
// heading is kept for screen readers only. With `phone` "full" the line stays
// and the action drops under it; with "bar" the page shows nothing above its
// content and the action moves into the top bar (boards 59m, 60m, 61m).
export function PageHeader({
  title,
  intro,
  action,
  phone = "full",
}: {
  title: string;
  intro: string;
  action?: ReactNode;
  phone?: "full" | "bar";
}) {
  const bar = phone === "bar";
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] max-md:sr-only">{title}</h1>
        <p className={`text-[14px] text-prt-muted md:mt-1 ${bar ? "max-md:hidden" : ""}`}>{intro}</p>
      </div>
      {action && <div className={`shrink-0 sm:pt-1 ${bar ? "max-md:hidden" : ""}`}>{action}</div>}
      {action && bar && (
        <TopBarAction>
          <div className="md:hidden">{action}</div>
        </TopBarAction>
      )}
    </header>
  );
}

/** The paper pill: a page's main action (board 43 "Give access", board 44 "New order"). */
export const PRIMARY_PILL =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-prt-text px-4 text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70";

/** The outlined pill: a secondary action in a row ("Save changes", "Withdraw"). */
export const GHOST_PILL =
  "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-full border border-white-10 px-3.5 text-[13px] font-medium text-prt-text transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

/** The small mono heading over a group ("Your access"). */
export const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.3em] text-dim";
