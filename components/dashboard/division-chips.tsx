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
            className="inline-flex h-6 items-center rounded-md border border-hairline bg-white-5 px-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-prt-text"
          >
            {chip.label}
          </span>
        ) : (
          <span key={chip.divisionId} className="inline-flex h-6 items-center rounded-md bg-white-5 px-2 text-[12px] text-prt-muted">
            {chip.label}
          </span>
        ),
      )}
    </span>
  );
}
