import { twoDigits, type Reasons } from "@/lib/project-pages";
import { SectionHead } from "./parts";

// Numbered reasons (board 25 "Why liquid"): up to three columns, each under
// a hairline. Board 25m: stacked rows, the number beside the title.
export function ProjectReasons({ num, reasons }: { num: string; reasons: Reasons }) {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead num={num} label={reasons.eyebrow} title={reasons.title} />
        <ol className="mt-6 md:mt-12 md:grid md:grid-cols-3 md:gap-12">
          {reasons.items.map((r, i) => (
            <li key={r.title} className="border-t border-hairline py-5 md:pb-0 md:pt-6">
              <h3 className="flex items-baseline gap-3 text-[18px] font-bold tracking-[-0.01em] md:block md:text-[24px]">
                <span className="font-mono text-[10px] font-normal tracking-normal text-accent md:block md:text-[11px]">
                  {twoDigits(i + 1)}
                </span>
                <span className="md:mt-3 md:block">{r.title}</span>
              </h3>
              <p className="mt-2 text-[15px] leading-[24px] text-text-2 md:mt-3 md:leading-[26px]">{r.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
