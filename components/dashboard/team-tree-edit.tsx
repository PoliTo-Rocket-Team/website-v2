"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Lock, Pencil, Plus } from "lucide-react";
import type { DivisionHeader, DivisionMembers, WaitingPerson } from "@/lib/dashboard/division-members";
import { divisionLabel, matchesQuery } from "@/lib/dashboard/team";
import type { StructureDepartment, StructureDivision, StructureLeader, TeamStructure } from "@/lib/dashboard/team-structure";
import { Avatar } from "./avatar";
import { DepartmentDrawer, type DepartmentDrawerTarget } from "./department-drawers";
import { SearchField } from "./directory";
import { CloseDivisionDialog } from "./division-dialogs";
import { DivisionDrawer, type DivisionDrawerTarget } from "./division-drawer";
import { DrawerPage } from "./drawer";
import { EditDetailsDrawer, type EditTarget } from "./member-panels";
import { PRIMARY_PILL } from "./page-header";
import { TeamLeaderDrawer } from "./team-leader-drawer";

// The Team tree's edit view (issue #251): the one place structure is edited.
// The team leader and full access get board 77b: every department and
// division as a collapsed box with a pencil, + Add division under each
// department column and + Add department at the end of the row. A department
// head gets board 66t-b: only their own department's divisions have pencils
// and Add division; every other department is dimmed and read-only, and no
// department has a pencil. A box opens its panel: Edit division (77g, 68b),
// with Close division (68c) in its footer; Add division opens New division
// (77c, 69d) in that column's department; the department boxes open Edit
// department (77e) and its Close department step (77f); Add department opens
// New department (77d). Done returns to the tree. There is no closed-divisions
// list: a closed division never opens again. The Team Leader box opens "Hand
// over your role" (77i, issue #253) for the team leader alone; it is locked
// for everyone else, the operations lead and the IT lead included.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BOX = `relative block w-full rounded-xl border px-3 py-2.5 text-left transition-colors duration-300 ease-out ${FOCUS}`;
const ACCENT_BOX = `flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent/60 text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:border-accent hover:bg-accent/10 ${FOCUS}`;

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
  const [editing, setEditing] = useState<EditTarget | null>(null);
  // The division whose waiting person Fill details edits; kept while the drawer closes.
  const [editDivision, setEditDivision] = useState<DivisionHeader | null>(null);
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
    setEditDivision(tab.division);
    setEditing({ kind: "waiting", waiting: w });
  };

  const own = structure.departments.filter((d) => d.divisionsEditable).map((d) => d.name);
  const intro = structure.departmentsEditable
    ? "Click a box to rename it, change its head or lead, or close it."
    : `You can edit the divisions of ${own.join(" and ")}. Ask the team leader to change a department.`;
  const drawerOpen = drawerTarget !== null || department !== null || editing !== null || handOver.open;

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
      />

      <DivisionDrawer
        target={drawerTarget}
        takenCodes={structure.takenCodes}
        seats={structure.seats}
        editable
        onClose={() => setDivision(null)}
        onFill={fill}
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
      {editDivision && <EditDetailsDrawer target={editing} division={editDivision} onClose={() => setEditing(null)} />}
      {structure.leader?.handsOver && (
        <TeamLeaderDrawer key={handOver.round} open={handOver.open} leader={structure.leader} onClose={() => setHandOver((h) => ({ ...h, open: false }))} />
      )}
    </DrawerPage>
  );
}

/**
 * The boxes (boards 77b, 66t-b): the team leader on top, then one column per
 * department, its head's box over its divisions' boxes. From md the columns
 * hang from one bus under the leader and scroll sideways when they do not
 * fit; on a phone they stack.
 */
function StructureCanvas({
  structure,
  query,
  onDepartment,
  onAddDepartment,
  onDivision,
  onAddDivision,
  onHandOver,
}: {
  structure: TeamStructure;
  query: string;
  onDepartment: (id: number) => void;
  onAddDepartment: () => void;
  onDivision: (id: number) => void;
  onAddDivision: (departmentId: number) => void;
  onHandOver: () => void;
}) {
  const frame = useRef<HTMLElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const { leader } = structure;
  const columns: { key: string; node: ReactNode }[] = structure.departments.map((d) => ({
    key: `d${d.id}`,
    node: <DepartmentColumn department={d} editable={structure.departmentsEditable} query={query} onDepartment={onDepartment} onDivision={onDivision} onAddDivision={onAddDivision} />,
  }));
  if (structure.departmentsEditable) {
    columns.push({
      key: "add",
      node: (
        <button type="button" onClick={onAddDepartment} className={`${ACCENT_BOX} h-[90px] flex-col bg-accent/[0.04]`}>
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add department
        </button>
      ),
    });
  }

  // A row wider than the frame shrinks to fit it, so Add department always shows at the end of the row (77b).
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
  }, [columns.length]);

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
        <ol className="mt-4 flex flex-col gap-6 md:mt-0 md:flex-row md:gap-2.5">
          {columns.map((column, i) => (
            <li key={column.key} className="relative md:w-[150px] md:shrink-0 md:pt-4">
              {/* The bus under the leader, and the tick down to this column. */}
              {leader && (
                <span aria-hidden className="hidden md:block">
                  {/* Half the 10px gap on each side, so the bus runs on unbroken from column to column. */}
                  <span
                    className={`absolute top-0 border-t border-border-strong ${i === 0 ? "left-1/2" : "-left-[5px]"} ${i === columns.length - 1 ? "right-1/2" : "-right-[5px]"}`}
                  />
                  <span className="absolute left-1/2 top-0 h-4 border-l border-border-strong" />
                </span>
              )}
              {column.node}
            </li>
          ))}
        </ol>
      </div>
    </section>
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
  const dimmed = !editable && !department.divisionsEditable;
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
            <button type="button" onClick={() => onAddDivision(department.id)} className={`${ACCENT_BOX} h-9`}>
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
