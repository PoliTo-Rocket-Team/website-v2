"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Lock, Pencil, Plus } from "lucide-react";
import type { DivisionMembers, WaitingPerson } from "@/lib/dashboard/division-members";
import { divisionLabel, matchesQuery } from "@/lib/dashboard/team";
import { editViewIntro, type StructureDepartment, type StructureDivision, type StructureLeader, type StructureSeat, type TeamStructure } from "@/lib/dashboard/team-structure";
import { Avatar } from "./avatar";
import { DepartmentDrawer, type DepartmentDrawerTarget } from "./department-drawers";
import { SearchField } from "./directory";
import { CloseDivisionDialog } from "./division-dialogs";
import { DivisionDrawer, type DivisionDrawerTarget } from "./division-drawer";
import { DrawerPage } from "./drawer";
import { EditDetailsDrawer, type EditTarget } from "./member-panels";
import { PRIMARY_PILL } from "./page-header";
import { SeatDrawer, type SeatDrawerTarget } from "./seat-drawers";
import { TeamLeaderDrawer } from "./team-leader-drawer";

// The Team tree's edit view (issue #251): the one place structure is edited.
// The team leader and full access get board 77b: every department and
// division as a collapsed box with a pencil, + Add division under each
// department column and + Add department at the end of the row. A department
// head gets board 66t-b: only their own department's divisions have pencils
// and Add division; every other department is dimmed and read-only, and no
// department has a pencil. A division lead gets pencils only on the divisions
// they lead, and no Add division (issue #594). A box opens its panel: Edit
// division (77g, 68b), with Close division (68c) in its footer for a head or
// the team; Add division opens New division
// (77c, 69d) in that column's department; the department boxes open Edit
// department (77e) and its Close department step (77f); Add department opens
// New department (77d). Done returns to the tree. There is no closed-divisions
// list: a closed division never opens again. The Team Leader box opens "Hand
// over your role" (77i, issue #253) for the team leader alone; it is locked
// for everyone else, the operations lead and the IT lead included. Under it,
// the seat row (issue #627): a box per team-level seat that opens Change
// holder, and Add seat at its end, for the team leader and full access; a head
// sees the same seat boxes, which open nothing.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BOX = `relative block w-full rounded-xl border px-3 py-2.5 text-left transition-colors duration-300 ease-out ${FOCUS}`;
// An add box sets its own width: Add seat is the Team Leader box's 200px, the others fill their column.
const ACCENT_BOX = `flex items-center justify-center gap-1.5 rounded-xl border border-accent/60 text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:border-accent hover:bg-accent/10 ${FOCUS}`;

/** The division panel that is open: New division in a department, or Edit division. */
type DivisionPanel = { readonly kind: "new"; readonly departmentId: number } | { readonly kind: "edit"; readonly divisionId: number };

/**
 * A box's fill and edge (issue #405): only the viewer's own box wears the
 * accent tint and edge, as the Team tree marks the viewer's path; "Find
 * someone" rings the box it marks, whoever's it is.
 */
function boxMark(found: boolean, yours: boolean): string {
  const fill = yours ? "bg-accent/[0.06]" : "bg-panel";
  const edge = found ? "border-accent ring-1 ring-accent" : yours ? "border-accent/70" : "border-hairline";
  return `${fill} ${edge}`;
}

function peopleLine(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

/** Whether a box holds what "Find someone" asks for: its unit's name, or the person it names. */
function matches(query: string, fields: readonly (string | null | undefined)[]): boolean {
  return query.trim() !== "" && matchesQuery(fields.filter((f): f is string => typeof f === "string"), query);
}

export function TeamTreeEditView({ structure }: { structure: TeamStructure }) {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<DivisionPanel | null>(null);
  const [closing, setClosing] = useState<number | null>(null);
  const [department, setDepartment] = useState<DepartmentDrawerTarget | null>(null);
  const [seat, setSeat] = useState<SeatDrawerTarget | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  // Each opening of "Hand over your role" starts from nothing picked.
  const [handOver, setHandOver] = useState<{ readonly open: boolean; readonly round: number }>({ open: false, round: 0 });

  const divisions = structure.departments.flatMap((d) => d.divisions);
  const pageOf = (divisionId: number | null): DivisionMembers | null => divisions.find((d) => d.id === divisionId)?.page ?? null;
  // The drawer reads the division from the page, so a change made in it (Add member, Confirm NDA) shows at once.
  const drawerTarget: DivisionDrawerTarget | null = (() => {
    if (division === null) return null;
    if (division.kind === "new") {
      const d = structure.departments.find((x) => x.id === division.departmentId);
      return d ? { kind: "new", department: { id: d.id, name: d.name } } : null;
    }
    const tab = pageOf(division.divisionId);
    return tab ? { kind: "edit", tab } : null;
  })();
  const closingTab = pageOf(closing);
  const fill = (w: WaitingPerson, tab: DivisionMembers) => {
    setDivision(null);
    setEditing({ kind: "waiting", waiting: w, division: tab.division });
  };

  const intro = editViewIntro(structure);
  // Close division is a head's or the team's: a lead's Edit division offers none (issue #594).
  const mayClose = (tab: DivisionMembers) => structure.departments.some((d) => d.divisionsEditable && d.divisions.some((v) => v.id === tab.division.id));
  const drawerOpen = drawerTarget !== null || department !== null || seat !== null || editing !== null || handOver.open;

  return (
    <DrawerPage drawerOpen={drawerOpen}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <header>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] md:text-[28px]">Edit team tree</h1>
          <p className="mt-1 text-[14px] text-prt-muted">{intro}</p>
        </header>
        <div className="flex items-center gap-2">
          <SearchField value={query} onChange={setQuery} placeholder="Find someone" className="md:w-[240px]" />
          <Link href="/dashboard/team-tree" className={`${PRIMARY_PILL} h-10 shrink-0 px-4`}>
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Done
          </Link>
        </div>
      </div>

      <StructureCanvas
        structure={structure}
        query={query}
        onDepartment={(id) => setDepartment({ kind: "edit", departmentId: id })}
        onAddDepartment={() => setDepartment({ kind: "new" })}
        onDivision={(id) => setDivision({ kind: "edit", divisionId: id })}
        onAddDivision={(id) => setDivision({ kind: "new", departmentId: id })}
        onHandOver={() => setHandOver((h) => ({ open: true, round: h.round + 1 }))}
        onSeat={(roleId) => setSeat({ kind: "change", roleId })}
        onAddSeat={() => setSeat({ kind: "new" })}
      />

      <DivisionDrawer
        target={drawerTarget}
        takenCodes={structure.takenCodes}
        seats={structure.seats}
        editable
        onClose={() => setDivision(null)}
        onFill={fill}
        mayClose={mayClose}
        onCloseDivision={(tab) => {
          setDivision(null);
          setClosing(tab.division.id);
        }}
      />
      <CloseDivisionDialog
        tab={closingTab}
        openPositions={divisions.find((d) => d.id === closing)?.openPositions ?? 0}
        onClose={() => setClosing(null)}
        onEdit={() => {
          if (closing !== null) setDivision({ kind: "edit", divisionId: closing });
          setClosing(null);
        }}
      />
      {structure.departmentsEditable && <DepartmentDrawer target={department} structure={structure} onClose={() => setDepartment(null)} onTarget={setDepartment} />}
      {structure.departmentsEditable && <SeatDrawer target={seat} structure={structure} onClose={() => setSeat(null)} />}
      <EditDetailsDrawer target={editing} onClose={() => setEditing(null)} />
      {structure.leader?.handsOver && (
        <TeamLeaderDrawer key={handOver.round} open={handOver.open} leader={structure.leader} onClose={() => setHandOver((h) => ({ ...h, open: false }))} />
      )}
    </DrawerPage>
  );
}

/**
 * The boxes (boards 77b, 66t-b): the team leader on top, the seat row under
 * it (issue #627), then one column per department, its head's box over its
 * divisions' boxes. From md the seats and the columns each hang from a bus,
 * and a row too wide for the frame shrinks to fit it; on a phone they stack.
 */
function StructureCanvas({
  structure,
  query,
  onDepartment,
  onAddDepartment,
  onDivision,
  onAddDivision,
  onHandOver,
  onSeat,
  onAddSeat,
}: {
  structure: TeamStructure;
  query: string;
  onDepartment: (id: number) => void;
  onAddDepartment: () => void;
  onDivision: (id: number) => void;
  onAddDivision: (departmentId: number) => void;
  onHandOver: () => void;
  onSeat: (roleId: number) => void;
  onAddSeat: () => void;
}) {
  const frame = useRef<HTMLElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const { leader } = structure;
  // The seat row (issue #627): a box per team-level seat, built like the Team Leader box, then Add seat where the viewer may add one.
  const seats: { key: string; node: ReactNode }[] = structure.board.map((s) => ({
    key: `s${s.roleId}`,
    node: <SeatBox seat={s} editable={structure.departmentsEditable} found={matches(query, [s.holder.name, s.title])} onOpen={() => onSeat(s.roleId)} />,
  }));
  if (structure.departmentsEditable) {
    seats.push({
      key: "add-seat",
      node: (
        <button type="button" onClick={onAddSeat} className={`${ACCENT_BOX} h-[112px] w-[200px] flex-col bg-accent/[0.04]`}>
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add seat
        </button>
      ),
    });
  }
  const columns: { key: string; node: ReactNode }[] = structure.departments.map((d) => ({
    key: `d${d.id}`,
    node: <DepartmentColumn department={d} editable={structure.departmentsEditable} query={query} onDepartment={onDepartment} onDivision={onDivision} onAddDivision={onAddDivision} />,
  }));
  if (structure.departmentsEditable) {
    columns.push({
      key: "add",
      node: (
        <button type="button" onClick={onAddDepartment} className={`${ACCENT_BOX} h-[90px] w-full flex-col bg-accent/[0.04]`}>
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add department
        </button>
      ),
    });
  }

  // A row wider than the frame shrinks to fit it, so Add department and Add seat always show at the end of their rows (77b).
  // A scroller would hide it: a scroll offset does not survive every relayout.
  useLayoutEffect(() => {
    const outer = frame.current;
    const inner = row.current;
    if (!outer || !inner) return;
    const fit = () => {
      inner.style.zoom = "";
      const { paddingLeft, paddingRight } = getComputedStyle(outer);
      const room = outer.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);
      const zoom = Math.min(1, room / inner.getBoundingClientRect().width);
      inner.style.zoom = zoom < 1 ? String(zoom) : "";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [columns.length, seats.length]);

  // "Find someone" brings the first box it marks into view.
  useEffect(() => {
    if (query.trim() === "") return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    frame.current?.querySelector("[data-found]")?.scrollIntoView({ block: "nearest", inline: "center", behavior: still ? "auto" : "smooth" });
  }, [query]);

  return (
    <section ref={frame} aria-label="Team structure" className="mt-6 overflow-x-auto rounded-xl border border-hairline px-4 py-6 md:px-8 md:py-8">
      <div ref={row} className="md:mx-auto md:w-max">
        {leader && (
          <div className="flex flex-col items-center">
            <LeaderBox leader={leader} found={matches(query, [leader.name])} onHandOver={onHandOver} />
            <span aria-hidden className="hidden h-4 border-l border-border-strong md:block" />
          </div>
        )}
        {seats.length > 0 && (
          <div className="flex flex-col items-center">
            <ol aria-label="Team-level seats" className="mt-4 flex flex-col items-center gap-3 md:mt-0 md:flex-row md:items-start md:gap-2.5">
              {seats.map((s, i) => (
                <li key={s.key} className="relative md:shrink-0 md:pt-4">
                  {leader && <Bus first={i === 0} last={i === seats.length - 1} />}
                  {s.node}
                </li>
              ))}
            </ol>
            {/* The trunk runs on from the seat row down to the departments' bus. */}
            {columns.length > 0 && <span aria-hidden className="hidden h-4 border-l border-border-strong md:block" />}
          </div>
        )}
        <ol className="mt-4 flex flex-col gap-6 md:mt-0 md:flex-row md:justify-center md:gap-2.5">
          {columns.map((column, i) => (
            <li key={column.key} className="relative md:w-[150px] md:shrink-0 md:pt-4">
              {/* The bus under the leader, and the tick down to this column. */}
              {leader && <Bus first={i === 0} last={i === columns.length - 1} />}
              {column.node}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The bus a row of boxes hangs from, and the tick down to one box, from md (board 77b). */
function Bus({ first, last }: { first: boolean; last: boolean }) {
  return (
    <span aria-hidden className="hidden md:block">
      {/* Half the 10px gap on each side, so the bus runs on unbroken from box to box. */}
      <span className={`absolute top-0 border-t border-border-strong ${first ? "left-1/2" : "-left-[5px]"} ${last ? "right-1/2" : "-right-[5px]"}`} />
      <span className="absolute left-1/2 top-0 h-4 border-l border-border-strong" />
    </span>
  );
}

/**
 * A seat box on the seat row (issue #627), built like the Team Leader box:
 * the holder's name and the seat's stored title. For the team leader and full
 * access a button that opens Change holder, with a pencil; for a head it
 * opens nothing.
 */
function SeatBox({ seat, editable, found, onOpen }: { seat: StructureSeat; editable: boolean; found: boolean; onOpen: () => void }) {
  const frame = `relative flex h-[112px] w-[200px] flex-col items-center justify-center rounded-xl border px-3 text-center ${boxMark(found, seat.yours)}`;
  const body = (
    <>
      <Avatar size="ml" accent />
      <span className="mt-2 max-w-full truncate text-[14px] font-semibold text-prt-text">{seat.holder.name}</span>
      <span className="max-w-full truncate text-[12px] text-prt-muted">{seat.title}</span>
    </>
  );
  if (!editable) {
    return (
      <div data-found={found || undefined} className={frame}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-found={found || undefined}
      onClick={onOpen}
      aria-label={`Change who holds ${seat.title}`}
      className={`${frame} transition-colors duration-300 ease-out ${seat.yours ? "hover:border-accent" : "hover:border-border-strong"} ${FOCUS}`}
    >
      {body}
      <PencilMark />
    </button>
  );
}

/**
 * The Team Leader box (boards 77b, 77i): for the team leader a button that
 * opens "Hand over your role", with a pencil; for everyone else locked, with a
 * lock and the reason, since only the team leader hands this role over.
 */
function LeaderBox({ leader, found, onHandOver }: { leader: StructureLeader; found: boolean; onHandOver: () => void }) {
  const frame = `relative flex h-[112px] w-[200px] flex-col items-center justify-center rounded-xl border px-3 text-center ${boxMark(found, leader.yours)}`;
  const body = (
    <>
      <Avatar size="ml" accent />
      <span className="mt-2 max-w-full truncate text-[14px] font-semibold text-prt-text">{leader.name}</span>
      <span className="text-[12px] text-prt-muted">Team Leader</span>
    </>
  );
  if (leader.handsOver) {
    return (
      <button type="button" data-found={found || undefined} onClick={onHandOver} aria-label="Hand over your role" className={`${frame} transition-colors duration-300 ease-out hover:border-accent ${FOCUS}`}>
        {body}
        <PencilMark />
      </button>
    );
  }
  return (
    <div data-found={found || undefined} className={frame} title="Only the team leader can hand over this role">
      {body}
      <Lock aria-hidden className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-prt-muted" strokeWidth={1.75} />
      <span className="sr-only">Locked: only the team leader can hand over this role.</span>
    </div>
  );
}

function PencilMark() {
  return <Pencil aria-hidden className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-prt-muted" strokeWidth={1.75} />;
}

/** One department's column: its box, its divisions' boxes joined by a line, and Add division where the viewer may add one. */
function DepartmentColumn({
  department,
  editable,
  query,
  onDepartment,
  onDivision,
  onAddDivision,
}: {
  department: StructureDepartment;
  /** The department pencils: the team leader and full access. */
  editable: boolean;
  query: string;
  onDepartment: (id: number) => void;
  onDivision: (id: number) => void;
  onAddDivision: (departmentId: number) => void;
}) {
  // A head's view (66t-b): their own department reads normally, every other one is dimmed and read-only.
  // A lead's: the department holding a division they lead reads normally (issue #594).
  const dimmed = !editable && !department.divisionsEditable && department.divisions.every((d) => d.page === null);
  const found = matches(query, [department.name, department.head?.name]);
  const box = (
    <>
      <span className={`block truncate pr-5 font-mono text-[10px] uppercase tracking-[0.2em] ${dimmed ? "text-dim" : "text-prt-muted"}`}>{department.name}</span>
      <span className="mt-1 block truncate text-[13px] font-semibold leading-tight text-prt-text">{department.head?.name ?? "No head"}</span>
      <span className="mt-0.5 block truncate text-[12px] text-prt-muted">{department.head ? `Head · ${peopleLine(department.size)}` : peopleLine(department.size)}</span>
    </>
  );
  const frame = `${BOX} ${boxMark(found, department.yours)}`;
  return (
    <div className={dimmed ? "opacity-40" : undefined}>
      {editable ? (
        <button type="button" data-found={found || undefined} onClick={() => onDepartment(department.id)} aria-label={`Edit ${department.name} Department`} className={`${frame} ${department.yours ? "hover:border-accent" : "hover:border-border-strong"}`}>
          {box}
          <PencilMark />
        </button>
      ) : (
        <div data-found={found || undefined} className={frame}>
          {box}
        </div>
      )}
      <ul>
        {department.divisions.map((division) => (
          <Linked key={division.id}>
            <DivisionBox division={division} found={matches(query, [division.name, division.lead?.name])} onOpen={() => onDivision(division.id)} />
          </Linked>
        ))}
        {department.divisionsEditable && (
          <Linked>
            <button type="button" onClick={() => onAddDivision(department.id)} className={`${ACCENT_BOX} h-9 w-full`}>
              <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Add division
            </button>
          </Linked>
        )}
      </ul>
    </div>
  );
}

/** A box under the one above it, joined to it by a short line on the left (boards 77b, 66t-b). */
function Linked({ children }: { children: ReactNode }) {
  return (
    <li className="relative pt-2.5">
      <span aria-hidden className="absolute left-5 top-0 h-2.5 border-l border-border-strong" />
      {children}
    </li>
  );
}

/**
 * A division's box, set like a department's: its name as the small label, its
 * lead in bold, then "Lead" and how many are in it; a pencil where the viewer
 * may change it.
 */
function DivisionBox({ division, found, onOpen }: { division: StructureDivision; found: boolean; onOpen: () => void }) {
  const body = (
    <>
      <span className="block truncate pr-5 font-mono text-[10px] uppercase tracking-[0.2em] text-prt-muted">{divisionLabel(division.name)}</span>
      <span className="mt-1 block truncate text-[13px] font-semibold leading-tight text-prt-text">{division.lead?.name ?? "No lead"}</span>
      <span className="mt-0.5 block truncate text-[12px] text-prt-muted">{division.lead ? `Lead · ${peopleLine(division.size)}` : peopleLine(division.size)}</span>
    </>
  );
  const frame = `${BOX} ${boxMark(found, division.yours)}`;
  if (division.page === null) {
    return (
      <div data-found={found || undefined} className={frame}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" data-found={found || undefined} onClick={onOpen} aria-label={`Edit ${division.name}`} className={`${frame} ${division.yours ? "hover:border-accent" : "hover:border-border-strong"}`}>
      {body}
      <PencilMark />
    </button>
  );
}
