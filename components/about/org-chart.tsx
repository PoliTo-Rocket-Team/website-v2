import type { ReactNode } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { arcVisualOrder } from "@/lib/about/arc-order";
import type { Leader, OrgChart as OrgChartData } from "@/lib/about/types";
import { arcLayout, CENTRE_BELOW_PHOTO, LEADER_PHOTO, type ArcNode } from "./arc-layout";
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

/**
 * One person's photo and label, as the chart draws them inside their place.
 * Unframed (the public page) they sit straight in it, the markup boards 26
 * and 26m were built on (issue #325); the editor's frame gets them as one
 * centred column, so its outline wraps the person and the place is unchanged.
 */
function framed(frame: LeaderFrame | undefined, slot: LeaderSlot, person: ReactNode): ReactNode {
  return frame === undefined ? person : frame(slot, <div className="flex flex-col items-center">{person}</div>);
}

/**
 * The Team page editor's Add leader affordances (board 80e, issue #285): a
 * "+" at each place a leader may be added, numbered as gaps left to right on
 * the desktop arc (lib/about/arc-order.ts): 0 is the left end, the leaders'
 * count the right end.
 */
export type AddLeader = (gap: number) => void;

/** The words a gap's "+" is read by: where the leader would go. */
function gapLabel(leaders: readonly Leader[], gap: number): string {
  const names = arcVisualOrder(leaders.length).map((i) => leaders[i].name);
  if (gap === 0) return "Add leader at the left end";
  if (gap === names.length) return "Add leader at the right end";
  return `Add leader between ${names[gap - 1]} and ${names[gap]}`;
}

/** How far an end's Add leader circle sits out from the outermost leader, and above them (board 80e). */
const END_OUT = 170;
const END_UP = 190;
/** The end circles stay inside the content column. */
const END_MAX_X = 600;
/** How far a "+" between two neighbours sits below the middle of their photos. */
const BETWEEN_DOWN = 30;

const ADD_FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

/** An "Add leader" circle: at each end of the arc, and after the last leader in the stacked tree. */
function AddLeaderCircle({ label, side, sizeClass, onClick }: { label: string; side?: string; sizeClass: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`group/add flex flex-col items-center rounded-2xl ${ADD_FOCUS}`}>
      <span
        className={`flex items-center justify-center rounded-full border-[1.5px] border-accent/60 bg-accent/5 text-accent transition-colors duration-300 ease-out group-hover/add:border-accent group-hover/add:bg-accent/10 ${sizeClass}`}
      >
        <Plus aria-hidden className="h-7 w-7" strokeWidth={1.5} />
      </span>
      <span className="mt-4 text-[17px] font-semibold leading-tight text-accent md:text-[18px]">Add leader</span>
      {side !== undefined && <span className="mt-1.5 text-[13px] leading-tight text-prt-muted">{side}</span>}
    </button>
  );
}

/** The arc's add affordances, placed from the leaders' own nodes. */
function ArcAdds({ nodes, leaders, centreY, onAdd }: { nodes: readonly ArcNode[]; leaders: readonly Leader[]; centreY: number; onAdd: AddLeader }) {
  const visual = arcVisualOrder(nodes.length).map((i) => nodes[i]);
  const end = (outer: ArcNode, side: -1 | 1) => ({ x: side * Math.min(Math.abs(outer.x) + END_OUT, END_MAX_X), y: outer.y - END_UP });
  const ends = [
    { gap: 0, at: end(visual[0], -1), side: "on the left" },
    { gap: visual.length, at: end(visual[visual.length - 1], 1), side: "on the right" },
  ];
  return (
    <>
      {ends.map(({ gap, at, side }) => (
        // The circle's centre on the point; its label hangs below.
        <div key={gap} className="absolute -translate-x-1/2 -translate-y-[72px]" style={{ left: `calc(50% + ${at.x}px)`, top: centreY + at.y }}>
          <AddLeaderCircle label={gapLabel(leaders, gap)} side={side} sizeClass="h-36 w-36" onClick={() => onAdd(gap)} />
        </div>
      ))}
      {visual.slice(1).map((b, i) => {
        const a = visual[i];
        const gap = i + 1;
        return (
          <div
            key={gap}
            className="group/add absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `calc(50% + ${(a.x + b.x) / 2}px)`, top: centreY + (a.y + b.y) / 2 + BETWEEN_DOWN }}
          >
            <button
              type="button"
              onClick={() => onAdd(gap)}
              aria-label={gapLabel(leaders, gap)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/60 text-accent transition-colors duration-300 ease-out hover:border-accent hover:bg-accent hover:text-accent-on-accent focus-visible:border-accent focus-visible:bg-accent focus-visible:text-accent-on-accent focus-visible:outline-none"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-hairline bg-panel px-2 py-1 text-[12px] text-prt-text opacity-0 transition-opacity duration-300 ease-out group-focus-within/add:opacity-100 group-hover/add:opacity-100"
            >
              Add leader here
            </span>
          </div>
        );
      })}
    </>
  );
}

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

/**
 * The arc, from xl, for one leader or more. Every position is measured from
 * the centre of the circle round the team leader; with no team leader (ADR
 * 0019 Decision 9) the leaders keep their places and draw no line to it.
 */
function Arc({ leader, leaders, frame, onAdd }: { leader: Leader | null; leaders: readonly Leader[]; frame?: LeaderFrame; onAdd: AddLeader | null }) {
  const nodes = arcLayout(leaders.length);
  const centreY = LEADER_PHOTO / 2 + CENTRE_BELOW_PHOTO;
  // The lowest leader's photo, then room for its name, role and icons.
  const height = Math.max(...nodes.map((n) => centreY + n.y + n.photo / 2)) + 110;
  return (
    <div className="relative mx-auto" style={{ height }}>
      {leader !== null && (
        <>
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

          <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
            {framed(
              frame,
              "leader",
              <>
                <Avatar photo={leader.photo} sizeClass="h-[176px] w-[176px]" sizes="176px" />
                <div className="mt-5">
                  <LeaderLabel leader={leader} size="top" />
                </div>
              </>,
            )}
          </div>
        </>
      )}

      {leaders.map((l, i) => {
        const n = nodes[i];
        const px = `${n.photo}px`;
        return (
          <div
            key={i}
            className="absolute flex -translate-x-1/2 flex-col items-center"
            style={{ left: `calc(50% + ${n.x}px)`, top: centreY + n.y - n.photo / 2 }}
          >
            {framed(
              frame,
              i,
              <>
                <span className="block" style={{ width: px, height: px }}>
                  <Avatar photo={l.photo} sizeClass="h-full w-full" sizes={px} />
                </span>
                <div className="mt-[18px]">
                  <LeaderLabel leader={l} size="arc" />
                </div>
              </>,
            )}
          </div>
        );
      })}

      {onAdd !== null && <ArcAdds nodes={nodes} leaders={leaders} centreY={centreY} onAdd={onAdd} />}
    </div>
  );
}

/**
 * Board 26m's tree, below xl: the leader, a rule branching to the grid, then
 * the others. A part the stored layout leaves empty (ADR 0019 Decision 9) is
 * not drawn, and neither is the rule that would join it.
 */
function Tree({ leader, leaders, frame, onAdd }: { leader: Leader | null; leaders: readonly Leader[]; frame?: LeaderFrame; onAdd: AddLeader | null }) {
  const joined = leader !== null && leaders.length > 0;
  return (
    <div className="flex flex-col items-center">
      {leader !== null &&
        framed(
          frame,
          "leader",
          <>
            <Avatar photo={leader.photo} sizeClass="h-[120px] w-[120px]" sizes="120px" />
            <div className="mt-3">
              <LeaderLabel leader={leader} size="top" />
            </div>
          </>,
        )}
      {/* A line down from the leader, a rule across to the first row's
          outer columns, and a short drop to each. */}
      {joined && <span aria-hidden className="mt-3 block h-6 w-px bg-white-10" />}
      <div className="grid w-full max-w-[880px] grid-cols-2 md:grid-cols-4">
        {joined && (
          <span
            aria-hidden
            className="col-span-2 mx-[25%] block h-4 border-x border-t border-white-10 md:col-span-4 md:mx-[12.5%]"
          />
        )}
        {leaders.map((l, i) => (
          <div key={i} className="mt-2 flex flex-col items-center pb-8">
            {framed(
              frame,
              i,
              <>
                <Avatar photo={l.photo} sizeClass="h-24 w-24" sizes="96px" />
                <div className="mt-3">
                  <LeaderLabel leader={l} size="grid" />
                </div>
              </>,
            )}
          </div>
        ))}
        {/* The grid has no gaps to click between: the editor adds after the
            last leader here, and the panel's Place field moves them. */}
        {onAdd !== null && (
          <div className="mt-2 flex flex-col items-center pb-8">
            <AddLeaderCircle label={gapLabel(leaders, leaders.length)} sizeClass="h-24 w-24" onClick={() => onAdd(leaders.length)} />
          </div>
        )}
      </div>
    </div>
  );
}

export function OrgChart({
  chart,
  frame,
  onAdd = null,
}: {
  chart: OrgChartData;
  /** The editor's outline round each person; none (the public page) draws the chart as boards 26 and 26m. */
  frame?: LeaderFrame;
  /** The editor's Add leader affordances; null (the public page, or a full arc) draws none. */
  onAdd?: AddLeader | null;
}) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow={chart.eyebrow} title={chart.title} align="centre-to-left" />
        <div className="mt-8 md:mt-14">
          <University university={chart.university} />
          {/* The line from the logo to the leader: solid and joined on
              phones (board 26m), dashed with a gap at each end on desktop.
              With no team leader there is nothing for it to join. */}
          {chart.leader !== null && (
            <span aria-hidden className="mx-auto block h-6 w-px bg-white-10 xl:mt-1 xl:h-[34px] xl:w-0 xl:border-l xl:border-dashed xl:border-dim xl:bg-transparent" />
          )}
          <div className={chart.leader === null ? "mt-6 xl:mt-9" : "xl:mt-9"}>
            {/* An arc needs a leader on it; with none the team leader stands alone, as the tree draws them at every width. */}
            {chart.leaders.length > 0 ? (
              <>
                <div className="hidden xl:block">
                  <Arc leader={chart.leader} leaders={chart.leaders} frame={frame} onAdd={onAdd} />
                </div>
                <div className="xl:hidden">
                  <Tree leader={chart.leader} leaders={chart.leaders} frame={frame} onAdd={onAdd} />
                </div>
              </>
            ) : (
              <Tree leader={chart.leader} leaders={chart.leaders} frame={frame} onAdd={onAdd} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
