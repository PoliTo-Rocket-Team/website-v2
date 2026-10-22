import Link from "next/link";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import type { MissionPage, PathStep } from "@/lib/about/mission-types";
import { Split, eyebrow, subTitle } from "./split";

// Boards 29 and 29m, below the header: the mission statement and its three
// points, the vision, the path from Cavour to Efesto, and what we believe.
// Each section sits one section pad below the last and paints no background.

export function Mission({ mission }: { mission: MissionPage["mission"] }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <p className={`text-center ${eyebrow}`}>{mission.eyebrow}</p>
        <p className="mx-auto mt-6 max-w-[960px] text-center text-[24px] font-bold leading-[1.3] tracking-[-0.025em] md:mt-10 md:text-[44px]">
          {mission.statement}
        </p>
        <ul className="mt-10 grid md:mt-24 md:grid-cols-3 md:gap-8">
          {mission.points.map((p) => (
            <li key={p.title} className="border-t border-white-10 py-6 md:pb-0 md:pt-6">
              <h3 className="text-[17px] font-semibold md:text-[20px]">{p.title}</h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-text-2 md:text-[15px]">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Vision({ vision }: { vision: MissionPage["vision"] }) {
  return (
    <Split
      left={
        <>
          <p className={eyebrow}>{vision.eyebrow}</p>
          <h2 className={`mt-4 ${subTitle}`}>{vision.title}</h2>
        </>
      }
      paragraphs={vision.paragraphs}
    />
  );
}

function Step({ step, num, linkLabel }: { step: PathStep; num: number; linkLabel: string }) {
  return (
    <li
      className={`border-t border-white-10 py-6 md:border-t-0 md:py-0 md:pr-8 md:pt-8 ${num > 1 ? "md:border-l md:pl-8" : ""}`}
    >
      <p className="font-mono text-xs tracking-[0.2em] text-accent">{String(num).padStart(2, "0")}</p>
      <h3 className="mt-3 text-[22px] font-semibold leading-tight md:text-[26px]">{step.name}</h3>
      <p className="mt-3 text-[14px] leading-[1.6] text-text-2 md:text-[15px]">{step.body}</p>
      <Link
        href={step.href}
        className="group mt-4 inline-flex items-center gap-2 text-[14px] font-medium text-prt-text transition-colors duration-300 ease-out hover:text-accent"
      >
        {linkLabel}
        <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
      </Link>
    </li>
  );
}

export function Path({ path }: { path: MissionPage["path"] }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="md:text-center">
          <p className={eyebrow}>{path.eyebrow}</p>
          <h2 className={`mt-4 ${subTitle}`}>{path.title}</h2>
        </div>
        <ol className="mt-8 grid md:mt-10 md:grid-cols-3 md:border-t md:border-white-10">
          {path.steps.map((s, i) => (
            <Step key={s.href} step={s} num={i + 1} linkLabel={path.linkLabel} />
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Beliefs({ beliefs }: { beliefs: MissionPage["beliefs"] }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <figure className="mx-auto max-w-[1312px] text-center">
        <p className={eyebrow}>{beliefs.eyebrow}</p>
        <blockquote className="mt-6 space-y-3 text-[22px] font-bold leading-[1.3] tracking-[-0.025em] md:mt-10 md:space-y-5 md:text-[48px] md:leading-[1.25]">
          {beliefs.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </blockquote>
        <figcaption className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-dim md:mt-14">
          {beliefs.credit}
        </figcaption>
      </figure>
    </section>
  );
}
