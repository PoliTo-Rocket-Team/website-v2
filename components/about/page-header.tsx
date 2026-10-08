import { CopyText } from "@/components/project-page/parts";
import type { HeaderStats } from "@/lib/about/types";

// An About page's header (boards 26, 26m, 28, 29, 29m, 30 and 30m): the
// eyebrow, the title, the intro and, on a page that has them, four figures
// over a hairline. The About pages are in the navbar's About menu (board 27),
// so a page starts with this header: 40px under the bar on phones, 96px from
// md. From md the figures are one row of four. On phones they stay one row
// (boards 26m, 28) unless the page asks for 2 x 2 (board 30m), where each
// row sits under its own hairline.

type Figures =
  | { stats?: undefined; statsOnPhone?: undefined }
  | { stats: HeaderStats; statsOnPhone?: "row" | "two-by-two" };

export function PageHeader({
  eyebrow,
  title,
  intro,
  stats,
  statsOnPhone = "row",
}: {
  eyebrow: string;
  title: string;
  intro: string;
} & Figures) {
  return (
    <div className="px-5 md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <header className="pt-10 md:pt-24">
          <p className="font-mono text-xs tracking-[0.3em] text-accent">{eyebrow}</p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.025em] md:mt-6 md:text-[64px] md:leading-[1.03]">
            {title}
          </h1>
          <p className="mt-4 max-w-[600px] text-[15px] leading-[1.6] text-text-2 md:mt-7 md:text-[18px]">{intro}</p>
          {stats !== undefined && <Stats stats={stats} onPhone={statsOnPhone} />}
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

function Stats({ stats, onPhone }: { stats: HeaderStats; onPhone: keyof typeof layout }) {
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
