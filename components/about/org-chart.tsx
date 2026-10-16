import type { ReactNode } from "react";
import Image from "next/image";
import type { Leader, OrgChart as OrgChartData } from "@/lib/about/types";
import { arcLayout, CENTRE_BELOW_PHOTO, LEADER_PHOTO } from "./arc-layout";
import { Avatar, Contacts } from "./person";
import { SectionHead } from "./section-head";

// Boards 26, 26b and 26m, "Who leads": the university's logo, a line down to
// the team leader, then the other leaders. From xl they sit on an arc below
// the team leader, placed by count (arc-layout.ts), each joined to the
// leader by a dashed line. Below xl the arc does not fit beside its labels,
// so the chart is board 26m's stacked tree: logo, leader, then the others in
// a two-column grid (four columns from md).

/** Who a frame wraps: the team leader, or a leader on the arc by their place in `OrgChart.leaders`. */
export type LeaderSlot = "leader" | number;

/** Wraps one person on the chart: the Team page editor outlines them (board 80, issue #284). */
export type LeaderFrame = (slot: LeaderSlot, person: ReactNode) => ReactNode;

const unframed: LeaderFrame = (_slot, person) => person;

function LeaderLabel({ leader, size }: { leader: Leader; size: "top" | "arc" | "grid" }) {
  const name = { top: "text-[18px] md:text-[26px]", arc: "text-[22px]", grid: "text-[17px]" }[size];
  const role = { top: "text-[15px] md:text-[18px]", arc: "text-[16px]", grid: "text-[14px]" }[size];
  return (
    <div className="flex flex-col items-center text-center">
      <p className={`whitespace-nowrap font-semibold leading-tight tracking-[-0.01em] text-prt-text ${name}`}>{leader.name}</p>
      <p className={`mt-1 whitespace-nowrap leading-tight text-accent md:mt-1.5 ${role}`}>{leader.role}</p>
      <Contacts person={leader} iconClass="h-[18px] w-[18px]" className="mt-2.5 md:mt-3" />
    </div>
  );
}

function University({ university }: { university: OrgChartData["university"] }) {
  return (
    <Image
      src={university.logo}
      alt={university.name}
      width={248}
      height={109}
      className="mx-auto h-auto w-[160px] md:w-[220px]"
    />
  );
}

/** The arc, from xl. Every position is measured from the centre of the circle round the team leader. */
function Arc({ leader, leaders, frame }: { leader: Leader; leaders: readonly Leader[]; frame: LeaderFrame }) {
  const nodes = arcLayout(leaders.length);
  const centreY = LEADER_PHOTO / 2 + CENTRE_BELOW_PHOTO;
  // The lowest leader's photo, then room for its name, role and icons.
  const height = Math.max(...nodes.map((n) => centreY + n.y + n.photo / 2)) + 110;
  return (
    <div className="relative mx-auto" style={{ height }}>
      <svg aria-hidden className="absolute left-1/2 top-0 overflow-visible" width="1" height="1">
        {nodes.map((n, i) => (
          <line
            key={i}
            x1={n.line.x1}
            y1={centreY + n.line.y1}
            x2={n.line.x2}
            y2={centreY + n.line.y2}
            className="stroke-dim"
            strokeWidth={1.25}
            strokeDasharray="6 5"
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-0 -translate-x-1/2">
        {frame(
          "leader",
          <div className="flex flex-col items-center">
            <Avatar person={leader} sizeClass="h-[176px] w-[176px]" sizes="176px" fallback="mark" />
            <div className="mt-5">
              <LeaderLabel leader={leader} size="top" />
            </div>
          </div>,
        )}
      </div>

      {leaders.map((l, i) => {
        const n = nodes[i];
        const px = `${n.photo}px`;
        return (
          <div key={i} className="absolute -translate-x-1/2" style={{ left: `calc(50% + ${n.x}px)`, top: centreY + n.y - n.photo / 2 }}>
            {frame(
              i,
              <div className="flex flex-col items-center">
                <span className="block" style={{ width: px, height: px }}>
                  <Avatar person={l} sizeClass="h-full w-full" sizes={px} fallback="mark" />
                </span>
                <div className="mt-[18px]">
                  <LeaderLabel leader={l} size="arc" />
                </div>
              </div>,
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Board 26m's tree, below xl: the leader, a rule branching to the grid, then the others. */
function Tree({ leader, leaders, frame }: { leader: Leader; leaders: readonly Leader[]; frame: LeaderFrame }) {
  return (
    <div className="flex flex-col items-center">
      {frame(
        "leader",
        <div className="flex flex-col items-center">
          <Avatar person={leader} sizeClass="h-[120px] w-[120px]" sizes="120px" fallback="mark" />
          <div className="mt-3">
            <LeaderLabel leader={leader} size="top" />
          </div>
        </div>,
      )}
      {/* A line down from the leader, a rule across to the first row's
          outer columns, and a short drop to each. */}
      <span aria-hidden className="mt-3 block h-6 w-px bg-white-10" />
      <div className="grid w-full max-w-[880px] grid-cols-2 md:grid-cols-4">
        <span
          aria-hidden
          className="col-span-2 mx-[25%] block h-4 border-x border-t border-white-10 md:col-span-4 md:mx-[12.5%]"
        />
        {leaders.map((l, i) => (
          <div key={i} className="mt-2 flex justify-center pb-8">
            {frame(
              i,
              <div className="flex flex-col items-center">
                <Avatar person={l} sizeClass="h-24 w-24" sizes="96px" fallback="mark" />
                <div className="mt-3">
                  <LeaderLabel leader={l} size="grid" />
                </div>
              </div>,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrgChart({ chart, frame = unframed }: { chart: OrgChartData; frame?: LeaderFrame }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow={chart.eyebrow} title={chart.title} align="centre-to-left" />
        <div className="mt-8 md:mt-14">
          <University university={chart.university} />
          {/* The line from the logo to the leader: solid and joined on
              phones (board 26m), dashed with a gap at each end on desktop. */}
          <span aria-hidden className="mx-auto block h-6 w-px bg-white-10 xl:mt-1 xl:h-[34px] xl:w-0 xl:border-l xl:border-dashed xl:border-dim xl:bg-transparent" />
          <div className="xl:mt-9">
            <div className="hidden xl:block">
              <Arc leader={chart.leader} leaders={chart.leaders} frame={frame} />
            </div>
            <div className="xl:hidden">
              <Tree leader={chart.leader} leaders={chart.leaders} frame={frame} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
