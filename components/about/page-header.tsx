import type { ReactNode } from "react";
import { CopyText } from "@/components/project-page/parts";
import type { HeaderFigures } from "@/lib/about/types";

// An About page's header (boards 26, 26m, 28, 29, 29m, 30 and 30m): the
// eyebrow, the title, the intro and, on a page that has them, four figures
// over a hairline (two on the Outreach page, in the first two columns,
// issue #496). The About pages are in the navbar's About menu (board 27),
// so a page starts with this header: 40px under the bar on phones, 96px from
// md. From md the figures are one row of four. On phones they stay one row
// (boards 26m, 28) unless the page asks for 2 x 2 (board 30m), where each
// row sits under its own hairline.

/** The intro's type, so a text box in its place reads the same. */
export const PAGE_INTRO = "text-[15px] leading-[1.6] text-text-2 md:text-[18px]";

/** How far the intro sits under the title. */
const INTRO_TOP = "mt-4 md:mt-7";
/** How wide the intro runs. */
export const INTRO_WIDTH = "max-w-[600px]";
/** Where the intro sits under the title. */
const INTRO_BOX = `${INTRO_TOP} ${INTRO_WIDTH}`;

type Figures =
  | { stats?: undefined; statsOnPhone?: undefined }
  | { stats: HeaderFigures; statsOnPhone?: "row" | "two-by-two" };

export function PageHeader({
  eyebrow,
  title,
  intro,
  introFrame,
  stats,
  statsOnPhone = "row",
}: {
  eyebrow: string;
  title: string;
  intro: string;
  /**
   * Wraps the intro and the figures under it as one block: the Team page
   * editor outlines them, or puts its fields in their place (board 80,
   * issues #284 and #510).
   */
  introFrame?: (intro: ReactNode) => ReactNode;
} & Figures) {
  const figures = stats !== undefined && <Stats stats={stats} onPhone={statsOnPhone} />;
  return (
    <div className="px-5 md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <header className="pt-10 md:pt-24">
          <p className="font-mono text-xs tracking-[0.3em] text-accent">{eyebrow}</p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.025em] md:mt-6 md:text-[64px] md:leading-[1.03]">
            {title}
          </h1>
          {/* The public page draws the intro and figures as they always were
              (issue #325); only the editor's frame gets a box around them. */}
          {introFrame === undefined ? (
            <>
              <p className={`${INTRO_BOX} ${PAGE_INTRO}`}>{intro}</p>
              {figures}
            </>
          ) : (
            <div className={INTRO_TOP}>
              {introFrame(
                <>
                  <p className={`${INTRO_WIDTH} ${PAGE_INTRO}`}>{intro}</p>
                  {figures}
                </>,
              )}
            </div>
          )}
        </header>
      </div>
    </div>
  );
}

const layout = {
  row: { list: "grid-cols-4 border-t border-white-10 pt-4", cell: "" },
  "two-by-two": {
    list: "grid-cols-2 md:grid-cols-4 md:border-t md:border-white-10",
    cell: "border-t border-white-10 py-4 md:border-t-0 md:py-0",
  },
} as const;

function Stats({ stats, onPhone }: { stats: HeaderFigures; onPhone: keyof typeof layout }) {
  const { list, cell } = layout[onPhone];
  return (
    <dl className={`mt-5 grid md:mt-7 md:pt-7 ${list}`}>
      {stats.map((s) => (
        <div key={s.label.text} className={`flex flex-col-reverse ${cell}`}>
          <dt className="mt-1.5 font-mono text-[9px] tracking-[0.15em] text-prt-muted md:mt-3 md:text-[11px] md:tracking-[0.2em]">
            <CopyText copy={s.label} />
          </dt>
          <dd className="text-[22px] font-bold leading-none tracking-[-0.02em] text-prt-text md:text-[36px]">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
