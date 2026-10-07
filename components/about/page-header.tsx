import { CopyText } from "@/components/project-page/parts";
import type { HeaderStat } from "@/lib/about/types";

// An About page's header (boards 26, 26m and 28): the eyebrow, the title, the
// intro and four figures over a hairline. The About pages are in the navbar's
// About menu (board 27), so a page starts with this header: 40px under the
// bar on phones, 96px from md.

export function PageHeader({
  eyebrow,
  title,
  intro,
  stats,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  stats: readonly [HeaderStat, HeaderStat, HeaderStat, HeaderStat];
}) {
  return (
    <div className="px-5 md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <header className="pt-10 md:pt-24">
          <p className="font-mono text-xs tracking-[0.3em] text-accent">{eyebrow}</p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.025em] md:mt-6 md:text-[64px] md:leading-[1.03]">
            {title}
          </h1>
          <p className="mt-4 max-w-[600px] text-[15px] leading-[1.6] text-text-2 md:mt-7 md:text-[18px]">{intro}</p>
          <dl className="mt-5 grid grid-cols-4 border-t border-white-10 pt-4 md:mt-7 md:pt-7">
            {stats.map((s) => (
              <div key={s.label.text} className="flex flex-col-reverse">
                <dt className="mt-1.5 font-mono text-[9px] tracking-[0.15em] text-prt-muted md:mt-3 md:text-[11px] md:tracking-[0.2em]">
                  <CopyText copy={s.label} />
                </dt>
                <dd className="text-[22px] font-bold leading-none tracking-[-0.02em] text-prt-text md:text-[36px]">{s.value}</dd>
              </div>
            ))}
          </dl>
        </header>
      </div>
    </div>
  );
}
