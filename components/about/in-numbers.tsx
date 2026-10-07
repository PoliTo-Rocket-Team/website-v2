import type { InNumbers as InNumbersData, Pie } from "@/lib/about/types";
import { SectionHead } from "./section-head";

// Boards 26 and 26m, "In numbers": three pie charts, each with a legend of
// swatch, label and percent. Desktop: three columns, the pie over its
// legend. Phones: one chart per row under a hairline, a smaller pie with the
// legend beside it.
//
// Colours are tokens only. The first three slices are the accent laid over
// paper at full, 70% and 45% strength, so they read as three oranges from
// strong to light, as the boards draw them; the rest are greys from light to
// dark. The legend's swatches are built the same way.

const tones = [
  { fill: "fill-accent", opacity: 1, swatch: "bg-accent" },
  { fill: "fill-accent", opacity: 0.7, swatch: "bg-accent/70" },
  { fill: "fill-accent", opacity: 0.45, swatch: "bg-accent/[0.45]" },
  { fill: "fill-text-2", opacity: 1, swatch: "bg-text-2" },
  { fill: "fill-prt-muted", opacity: 1, swatch: "bg-prt-muted" },
  { fill: "fill-dim", opacity: 1, swatch: "bg-dim" },
] as const;

const R = 100;

/** The path of a slice from `from` to `to`, as shares of the whole, clockwise from the top. */
function slicePath(from: number, to: number): string {
  const at = (share: number) => {
    const a = share * 2 * Math.PI - Math.PI / 2;
    return `${(R * Math.cos(a)).toFixed(3)} ${(R * Math.sin(a)).toFixed(3)}`;
  };
  const large = to - from > 0.5 ? 1 : 0;
  return `M0 0 L${at(from)} A${R} ${R} 0 ${large} 1 ${at(to)} Z`;
}

function PieChart({ pie, className }: { pie: Pie; className: string }) {
  const total = pie.slices.reduce((s, x) => s + x.percent, 0);
  let start = 0;
  const shapes = pie.slices.map((s, i) => {
    const from = start / total;
    start += s.percent;
    const to = start / total;
    return { from, to, tone: tones[i] };
  });
  return (
    <svg aria-hidden viewBox={`${-R - 1} ${-R - 1} ${2 * R + 2} ${2 * R + 2}`} className={className}>
      <circle r={R} className="fill-prt-text" />
      {shapes.map(({ from, to, tone }, i) =>
        to - from >= 1 ? (
          <circle key={i} r={R} className={tone.fill} fillOpacity={tone.opacity} />
        ) : (
          <path key={i} d={slicePath(from, to)} className={`${tone.fill} stroke-ground`} fillOpacity={tone.opacity} strokeWidth={1.25} strokeLinejoin="round" />
        ),
      )}
    </svg>
  );
}

function Legend({ pie }: { pie: Pie }) {
  return (
    <ul className="flex flex-col gap-2 md:gap-3">
      {pie.slices.map((s, i) => (
        <li key={s.label} className="flex items-center gap-3 text-[13px] md:text-[14px]">
          <span aria-hidden className="relative block h-2.5 w-2.5 shrink-0 overflow-hidden rounded-full bg-prt-text">
            <span className={`absolute inset-0 ${tones[i].swatch}`} />
          </span>
          <span className="flex-1 text-text-2">{s.label}</span>
          <span className="font-mono text-[12px] text-prt-text md:text-[13px]">{s.percent.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

export function InNumbers({ numbers }: { numbers: InNumbersData }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow={numbers.eyebrow} title={numbers.title} align="centre" />
        <div className="mt-8 grid grid-cols-1 md:mt-14 md:grid-cols-3 md:gap-10">
          {numbers.charts.map((pie) => (
            <figure key={pie.title} className="border-t border-white-10 py-5 md:border-0 md:py-0">
              <figcaption className="font-mono text-[11px] tracking-[0.2em] text-prt-muted md:text-center">{pie.title}</figcaption>
              <div className="mt-4 flex items-center gap-6 md:mx-auto md:mt-6 md:max-w-[240px] md:flex-col md:items-stretch md:gap-9">
                <PieChart pie={pie} className="h-[120px] w-[120px] shrink-0 md:h-[240px] md:w-[240px]" />
                <div className="flex-1">
                  <Legend pie={pie} />
                </div>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
