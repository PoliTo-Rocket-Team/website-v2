import { Award } from "lucide-react";
import { twoDigits, type LaunchLog, type LogEntry, type Outcome } from "@/lib/project-pages";
import { CopyText, PhotoSlot, Pill, SectionHead, type PillTone } from "./parts";

// Launch history. Boards 23 and 24: one row per campaign under a hairline:
// number, date, place, version and outcome left; title, summary, award and
// four numbers in the middle; two photo slots right. Boards 23m and 24m: one
// glass card per campaign. No red: a setback takes the orange accent pill.

const outcome: Record<Outcome, { label: string; tone: PillTone }> = {
  nominal: { label: "NOMINAL", tone: "success" },
  "recovery-failed": { label: "RECOVERY FAILED", tone: "accent" },
  "did-not-fly": { label: "DID NOT FLY", tone: "accent" },
};

function Stats({ stats, className }: { stats: LogEntry["stats"] | LogEntry["phoneStats"]; className: string }) {
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

function EntryRow({ entry, num, texture }: { entry: LogEntry; num: string; texture: string }) {
  const o = outcome[entry.outcome];
  return (
    <article className="hidden grid-cols-[200px_1fr] gap-x-10 gap-y-8 border-t border-hairline pb-16 pt-10 md:grid lg:grid-cols-[300px_1fr_300px] lg:gap-x-12">
      <div>
        <p aria-hidden className="text-[64px] font-extrabold leading-none tracking-[-0.03em] text-dim">
          {num}
        </p>
        <p className="mt-4 text-[22px] font-bold">{entry.date}</p>
        <p className="mt-2 text-base text-prt-muted">{entry.place.text}</p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
          {entry.version} · {entry.motor}
        </p>
        <Pill tone={o.tone} className="mt-4">
          {o.label}
        </Pill>
      </div>

      <div className="min-w-0">
        <h3 className="text-[32px] font-bold leading-[1.15] tracking-[-0.025em]">{entry.title}</h3>
        <p className="mt-6 text-[17px] leading-[26px] text-text-2">{entry.summary.text}</p>
        {entry.award && (
          <p className="mt-6 flex items-start gap-2 font-mono text-xs tracking-[0.15em] text-accent">
            <Award aria-hidden className="mt-px h-4 w-4 shrink-0" />
            <span>
              {entry.award.name}
              {entry.award.citation && <span className="tracking-normal"> · {entry.award.citation}</span>}
            </span>
          </p>
        )}
        <Stats stats={entry.stats} className="mt-6 grid grid-cols-4 border-t border-hairline pt-6" />
      </div>

      {/* Beside the copy from lg; under it, side by side, from md to lg. */}
      <div className="col-start-2 flex gap-3 lg:col-start-auto lg:flex-col">
        <PhotoSlot texture={texture} className="h-[180px] flex-1 lg:flex-none" />
        <PhotoSlot texture={texture} className="h-[180px] flex-1 lg:h-[96px] lg:flex-none" />
      </div>
    </article>
  );
}

function EntryCard({ entry, num, texture }: { entry: LogEntry; num: string; texture: string }) {
  const o = outcome[entry.outcome];
  return (
    <article className="glass-card rounded-2xl p-3 md:hidden">
      <PhotoSlot texture={texture} className="h-[112px]" />
      <div className="px-1 pb-1">
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] tracking-[0.15em] text-prt-muted">
            {num} · {entry.date.toUpperCase()}
          </p>
          <Pill tone={o.tone}>{o.label}</Pill>
        </div>
        <h3 className="mt-2 text-[20px] font-bold tracking-[-0.02em]">{entry.title}</h3>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-text-2">
          <CopyText copy={entry.place} />
        </p>
        <p className="mt-3 text-[15px] leading-[22px] text-text-2">{entry.summary.phone}</p>
        {entry.award && (
          <p className="mt-3 flex items-start gap-2 font-mono text-[10px] tracking-[0.15em] text-accent">
            <Award aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span>{entry.award.name}</span>
          </p>
        )}
        <Stats stats={entry.phoneStats} className="mt-3 grid grid-cols-3 border-t border-hairline pt-3" />
      </div>
    </article>
  );
}

export function ProjectLaunches({ num, log, texture }: { num: string; log: LaunchLog; texture: string }) {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead num={num} label="LAUNCH HISTORY" title={log.title} />
        <div className="mt-6 flex flex-col gap-4 md:mt-12 md:gap-0">
          {log.entries.map((e, i) => {
            const n = twoDigits(i + 1);
            return (
              <div key={e.date}>
                <EntryRow entry={e} num={n} texture={texture} />
                <EntryCard entry={e} num={n} texture={texture} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
