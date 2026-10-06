import { Award } from "lucide-react";
import { flights, type Flight, type FlightOutcome } from "./data";
import { PhotoSlot, Pill, SectionHead } from "./parts";

// 04 Launch history. Board 23: one row per flight under a hairline: number,
// date, place, configuration and outcome left; title, summary, award and four
// numbers in the middle; two photo slots right. Board 23m: one glass card per
// flight. No red: a failed recovery takes the orange accent pill.

const outcome: Record<FlightOutcome, { label: string; tone: "success" | "accent" }> = {
  nominal: { label: "NOMINAL", tone: "success" },
  "recovery-failed": { label: "RECOVERY FAILED", tone: "accent" },
};

function Stats({ stats, className }: { stats: Flight["stats"] | Flight["phoneStats"]; className: string }) {
  return (
    <dl className={className}>
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col-reverse">
          <dt className="mt-1 font-mono text-[9px] tracking-[0.2em] text-dim md:mt-2 md:text-[10px]">{s.label}</dt>
          <dd className="whitespace-nowrap text-[19px] font-bold tracking-[-0.02em] md:text-[28px]">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FlightRow({ flight }: { flight: Flight }) {
  const o = outcome[flight.outcome];
  return (
    <article className="hidden grid-cols-[200px_1fr] gap-x-10 gap-y-8 border-t border-hairline pb-16 pt-10 md:grid lg:grid-cols-[300px_1fr_300px] lg:gap-x-12">
      <div>
        <p aria-hidden className="text-[64px] font-extrabold leading-none tracking-[-0.03em] text-dim">
          {flight.num}
        </p>
        <p className="mt-4 text-[22px] font-bold">{flight.date}</p>
        <p className="mt-2 text-base text-prt-muted">{flight.place}</p>
        <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-dim">
          CVR {flight.config} · {flight.motor}
        </p>
        <Pill tone={o.tone} className="mt-4">
          {o.label}
        </Pill>
      </div>

      <div className="min-w-0">
        <h3 className="text-[32px] font-bold leading-[1.15] tracking-[-0.025em]">{flight.title}</h3>
        <p className="mt-6 text-[17px] leading-[26px] text-text-2">{flight.summary}</p>
        {flight.award && (
          <p className="mt-6 flex items-start gap-2 font-mono text-xs tracking-[0.15em] text-accent">
            <Award aria-hidden className="mt-px h-4 w-4 shrink-0" />
            <span>
              {flight.award.name}
              {flight.award.citation && <span className="tracking-normal"> · {flight.award.citation}</span>}
            </span>
          </p>
        )}
        <Stats stats={flight.stats} className="mt-6 grid grid-cols-4 border-t border-hairline pt-6" />
      </div>

      {/* Beside the copy from lg; under it, side by side, from md to lg. */}
      <div className="col-start-2 flex gap-3 lg:col-start-auto lg:flex-col">
        <PhotoSlot className="h-[180px] flex-1 lg:flex-none" />
        <PhotoSlot className="h-[180px] flex-1 lg:h-[96px] lg:flex-none" />
      </div>
    </article>
  );
}

function FlightCard({ flight }: { flight: Flight }) {
  const o = outcome[flight.outcome];
  return (
    <article className="glass-card rounded-2xl p-3 md:hidden">
      <PhotoSlot className="h-[112px]" />
      <div className="px-1 pb-1">
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] tracking-[0.15em] text-prt-muted">
            {flight.num} · {flight.date.toUpperCase()}
          </p>
          <Pill tone={o.tone}>{o.label}</Pill>
        </div>
        <h3 className="mt-2 text-[20px] font-bold tracking-[-0.02em]">{flight.title}</h3>
        <p className="mt-2 font-mono text-[11px] tracking-[0.15em] text-text-2">{flight.place.toUpperCase()}</p>
        <p className="mt-3 text-[15px] leading-[22px] text-text-2">{flight.phoneSummary}</p>
        {flight.award && (
          <p className="mt-3 flex items-start gap-2 font-mono text-[10px] tracking-[0.15em] text-accent">
            <Award aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span>{flight.award.phoneName}</span>
          </p>
        )}
        <Stats stats={flight.phoneStats} className="mt-3 grid grid-cols-3 border-t border-hairline pt-3" />
      </div>
    </article>
  );
}

export function CavourLaunches() {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow="04 – LAUNCH HISTORY" title="Three flights. Two countries. One hard landing." />
        <div className="mt-6 flex flex-col gap-4 md:mt-12 md:gap-0">
          {flights.map((f) => (
            <div key={f.num}>
              <FlightRow flight={f} />
              <FlightCard flight={f} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
