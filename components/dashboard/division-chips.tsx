import type { DivisionChip } from "@/lib/dashboard/division-members";

/**
 * A person's divisions as chips (board 61e, issue #231): a boxed mono code
 * for a division in the page's department, the department's name for one
 * outside it.
 */
export function Chips({ chips }: { chips: readonly DivisionChip[] }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {chips.map((chip) =>
        chip.code ? (
          <span
            key={chip.divisionId}
            className="inline-flex h-6 items-center whitespace-nowrap rounded-md border border-hairline bg-white-5 px-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-prt-text"
          >
            {chip.label}
          </span>
        ) : (
          // A department name truncates where a narrow column (an open side panel) leaves it short.
          <span key={chip.divisionId} className="inline-block h-6 max-w-full truncate rounded-md bg-white-5 px-2 text-[12px] leading-6 text-prt-muted">
            {chip.label}
          </span>
        ),
      )}
    </span>
  );
}
