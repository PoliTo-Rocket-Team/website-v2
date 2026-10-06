import type { WorkLine } from "@/lib/projects";

// Efesto's five work lines and its milestone note (board 22), in place of a
// launch log: the engine has not flown.

const label = "font-mono text-[11px] tracking-[0.2em]";

/** From md: the note over five chips in a row. */
export function WorkLines({
  workLines,
  milestone,
}: {
  workLines: readonly WorkLine[];
  milestone: string;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-6">
        <h3 className={`${label} font-normal text-prt-muted`}>FIVE WORK LINES</h3>
        <p className={`${label} text-right text-accent`}>{milestone}</p>
      </div>
      <ul className="mt-5 grid grid-cols-3 gap-3 lg:grid-cols-5">
        {workLines.map((w) => (
          <li key={w.code} className="rounded-xl border border-white-10 bg-white-5 px-4 py-4">
            <p className="text-[22px] font-extrabold leading-none tracking-[-0.01em] text-prt-text">
              {w.code}
            </p>
            <p className="mt-2.5 font-mono text-[11px] leading-[1.3] tracking-[0.05em] text-text-2">
              {w.name}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Below md: the chips stacked inside the accordion, the note under them. */
export function WorkLinesStacked({
  workLines,
  milestone,
}: {
  workLines: readonly WorkLine[];
  milestone: string;
}) {
  return (
    <>
      <ul className="space-y-2">
        {workLines.map((w) => (
          <li
            key={w.code}
            className="flex items-baseline gap-3 rounded-xl border border-white-10 bg-white-5 px-3.5 py-3"
          >
            <span className="w-12 shrink-0 text-[18px] font-extrabold leading-none text-prt-text">
              {w.code}
            </span>
            <span className="font-mono text-[11px] tracking-[0.05em] text-text-2">{w.name}</span>
          </li>
        ))}
      </ul>
      <p className={`${label} mt-4 leading-[1.6] text-accent`}>{milestone}</p>
    </>
  );
}
