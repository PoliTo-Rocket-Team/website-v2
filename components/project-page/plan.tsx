import { planSteps, type Plan, type PlanStatus } from "@/lib/project-pages";
import { CopyText, SectionHead } from "./parts";

// The plan (board 25): the steps in a row, each under a top rule; the step
// under way has the accent rule and label. Board 25m: a vertical timeline,
// one dot per step on a hairline; done steps are filled, the step under way
// is accent, steps to come are rings.

const look: Record<
  PlanStatus,
  { label: string; rule: string; status: string; title: string; dot: string }
> = {
  done: { label: "DONE", rule: "h-0.5 bg-prt-muted", status: "text-prt-text", title: "text-prt-text", dot: "bg-prt-text" },
  now: { label: "NOW", rule: "h-[3px] bg-accent", status: "text-accent", title: "text-prt-text", dot: "bg-accent" },
  next: { label: "NEXT", rule: "h-px bg-white-10", status: "text-text-2", title: "text-text-2", dot: "border border-prt-muted" },
  later: { label: "LATER", rule: "h-px bg-white-10", status: "text-text-2", title: "text-text-2", dot: "border border-prt-muted" },
};

export function ProjectPlan({ num, plan }: { num: string; plan: Plan }) {
  const steps = planSteps(plan);
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead className="md:max-w-[660px]" num={num} label="THE PLAN" title={plan.title} />
        <p className="mt-4 text-[15px] leading-[24px] text-text-2 md:mt-6 md:text-[17px] md:leading-[27px]">
          <CopyText copy={plan.intro} />
        </p>

        <ol className="mt-6 md:mt-12 md:grid md:gap-4" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((step, i) => {
            const l = look[step.status];
            const last = i === steps.length - 1;
            return (
              <li key={step.title} className="relative grid grid-cols-[26px_1fr] md:block">
                {/* Phone: the dot, and the line down to the next one. */}
                <span aria-hidden className="relative md:hidden">
                  <span className={`absolute left-0 top-[3px] h-2.5 w-2.5 rounded-full ${l.dot}`} />
                  {!last && <span className="absolute bottom-0 left-[4.5px] top-[19px] w-px bg-white-10" />}
                </span>
                {/* Desktop: the rule over the step, in a box as tall as the
                    thickest rule so every step's text starts on one line. */}
                <span aria-hidden className="hidden h-[3px] md:block">
                  <span className={`block ${l.rule}`} />
                </span>
                <div className={`md:pt-6 ${last ? "" : "pb-7 md:pb-0"}`}>
                  <p className="font-mono text-[10px] tracking-[0.2em] md:text-[11px]">
                    <span className={l.status}>{l.label}</span>
                    {step.date && <span className="ml-3 text-text-2">{step.date}</span>}
                  </p>
                  <h3 className={`mt-1.5 text-[17px] font-bold tracking-[-0.01em] md:mt-3 md:text-[20px] ${l.title}`}>
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-[21px] text-text-2 md:mt-3">
                    <CopyText copy={step.text} />
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
