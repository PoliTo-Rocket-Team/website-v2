"use client";

import { useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, LocateFixed } from "lucide-react";
import {
  EXPANDED_VIEW,
  matchesQuery,
  type TeamTree,
  type TreeDepartment,
  type TreeDivision,
  type TreePerson,
} from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import { SearchField } from "./directory";
import { PANEL } from "./panel";

// The Team tree (boards 54 and 54b), drawn from the roster the data
// interface returns. Folded (54): the team leader, the departments, and the
// branch that is open, the viewer's own path first, highlighted in accent.
// Expanding another department opens every department (54b), each one's
// divisions stacked under its head; "Collapse" folds back. Below xl, where
// six departments no longer fit side by side, the folded tree is a stacked
// list instead. `?view=all` opens on the expanded tree, so it can be linked.

type Open = { readonly departmentId: number | null; readonly divisionId: number | null };

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PILL = `inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-hairline px-3.5 text-[14px] font-medium text-prt-text transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`;

function openOnPath(tree: TeamTree): Open {
  return { departmentId: tree.path?.departmentId ?? null, divisionId: tree.path?.divisionId ?? null };
}

/** Where a person sits in the tree, for "Find someone". */
function locate(tree: TeamTree, id: number): Open | null {
  for (const department of tree.departments) {
    if (department.head?.id === id) return { departmentId: department.id, divisionId: null };
    for (const division of department.divisions) {
      if (division.lead?.id === id || division.members.some((m) => m.id === id)) {
        return { departmentId: department.id, divisionId: division.id };
      }
    }
  }
  return null;
}

function everyone(tree: TeamTree): TreePerson[] {
  return [
    ...(tree.leader ? [tree.leader] : []),
    ...tree.departments.flatMap((d) => [
      ...(d.head ? [d.head] : []),
      ...d.divisions.flatMap((v) => [...(v.lead ? [v.lead] : []), ...v.members]),
    ]),
  ];
}

export function TeamTreeView({ tree, startExpanded = false }: { tree: TeamTree; startExpanded?: boolean }) {
  const [expanded, setExpandedState] = useState(startExpanded);
  const [open, setOpen] = useState<Open>(() => openOnPath(tree));
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<number | null>(null);

  const setExpanded = (next: boolean) => {
    setExpandedState(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("view", EXPANDED_VIEW);
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  };

  const fold = (next: Open) => {
    setExpanded(false);
    setOpen(next);
  };

  const find = (next: string) => {
    setQuery(next);
    const match = next.trim() === "" ? null : everyone(tree).find((p) => matchesQuery([p.name], next)) ?? null;
    setFound(match?.id ?? null);
    const place = match ? locate(tree, match.id) : null;
    if (place) fold(place);
  };

  const showMe = () => {
    fold(openOnPath(tree));
    setQuery("");
    setFound(null);
  };

  const people = `${tree.size} ${tree.size === 1 ? "person" : "people"}`;
  const detail = `${tree.season} team · ${people}.${tree.path ? " Your path is highlighted." : ""}`;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <header>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] md:text-[36px]">Team tree</h1>
          <p className="mt-1 text-[14px] text-prt-muted md:text-[15px]">{detail}</p>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={query} onChange={find} placeholder="Find someone" className="sm:w-[240px]" />
          {expanded ? (
            <button type="button" onClick={() => setExpanded(false)} className={PILL}>
              <LocateFixed aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Collapse
            </button>
          ) : (
            tree.path && (
              <button type="button" onClick={showMe} className={PILL}>
                <LocateFixed aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Show me
              </button>
            )
          )}
        </div>
      </div>

      <section className={`${PANEL} mt-6 overflow-x-auto p-3 md:p-8`}>
        {expanded ? (
          <ExpandedTree tree={tree} open={open} found={found} onFold={fold} />
        ) : (
          <>
            <div className="xl:hidden">
              <FoldedList tree={tree} open={open} found={found} onOpen={setOpen} onExpandAll={() => setExpanded(true)} />
            </div>
            <div className="hidden xl:block">
              <FoldedTree tree={tree} open={open} found={found} onOpen={setOpen} onExpandAll={() => setExpanded(true)} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// Folded (board 54): cards laid out at their board sizes on one canvas, joined
// by lines. The canvas never grows past those sizes, and in a narrower panel
// it narrows as a whole: every left edge and width is a share of the canvas,
// so all six departments stay in view with the leader centred over them.

const GAP = 12;
const LEADER = { w: 200, h: 110 };
const DEPT = { w: 165, h: 96 };
const DIV = { w: 300, open: 60, closed: 80 };
const PERSON = { w: 100, h: 104, self: 124, gap: 8 };
const DROP = 16;

type Box = { x: number; y: number; w: number; h: number };
type Line = { x1: number; y1: number; x2: number; y2: number; accent: boolean };

function rowStart(anchor: number, rowWidth: number, canvas: number): number {
  return Math.max(0, Math.min(anchor, canvas - rowWidth));
}

function centre(box: Box): number {
  return box.x + box.w / 2;
}

/** A horizontal run joining `xs` at `y`, in hairline, with the part from `from` to `to` in accent. */
function run(xs: number[], y: number, accentFrom: number | null, accentTo: number | null): Line[] {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const lines: Line[] = lo === hi ? [] : [{ x1: lo, y1: y, x2: hi, y2: y, accent: false }];
  if (accentFrom !== null && accentTo !== null && accentFrom !== accentTo) {
    lines.push({ x1: Math.min(accentFrom, accentTo), y1: y, x2: Math.max(accentFrom, accentTo), y2: y, accent: true });
  }
  return lines;
}

function FoldedTree({ tree, open, found, onOpen, onExpandAll }: FoldedProps) {
  const departments = tree.departments;
  const n = departments.length;
  const path = tree.path;
  const deptRow = n * DEPT.w + Math.max(0, n - 1) * GAP;

  const openDepartment = departments.find((d) => d.id === open.departmentId) ?? null;
  const divisions = openDepartment?.divisions ?? [];
  const divRow = divisions.length * DIV.w + Math.max(0, divisions.length - 1) * GAP;
  const openDivision = divisions.find((d) => d.id === open.divisionId) ?? null;
  const people = openDivision ? [...(openDivision.lead ? [openDivision.lead] : []), ...openDivision.members] : [];
  const personRow = people.length * PERSON.w + Math.max(0, people.length - 1) * PERSON.gap;
  const width = Math.max(deptRow, divRow, personRow, LEADER.w);

  const lines: Line[] = [];
  const leader: Box = { x: (width - LEADER.w) / 2, y: 0, w: LEADER.w, h: LEADER.h };
  const line1 = LEADER.h + DROP;
  const deptTop = line1 + DROP;
  const deptOffset = (width - deptRow) / 2;
  const deptBoxes = departments.map((_, i): Box => ({ x: deptOffset + i * (DEPT.w + GAP), y: deptTop, w: DEPT.w, h: DEPT.h }));
  const pathIndex = departments.findIndex((d) => d.id === path?.departmentId);

  if (tree.leader && n > 0) {
    lines.push({ x1: centre(leader), y1: LEADER.h, x2: centre(leader), y2: line1, accent: path !== null });
    lines.push(
      ...run(
        deptBoxes.map(centre),
        line1,
        pathIndex >= 0 ? centre(leader) : null,
        pathIndex >= 0 ? centre(deptBoxes[pathIndex]) : null,
      ),
    );
    deptBoxes.forEach((box, i) => lines.push({ x1: centre(box), y1: line1, x2: centre(box), y2: deptTop, accent: i === pathIndex }));
  }

  let height = deptTop + DEPT.h;
  let divBoxes: Box[] = [];
  let personBoxes: Box[] = [];
  if (openDepartment && divisions.length > 0) {
    const parent = deptBoxes[departments.indexOf(openDepartment)];
    const onPath = openDepartment.id === path?.departmentId;
    const line2 = parent.y + DEPT.h + DROP;
    const divTop = line2 + DROP;
    const start = rowStart(parent.x, divRow, width);
    divBoxes = divisions.map((d, i): Box => ({
      x: start + i * (DIV.w + GAP),
      y: divTop,
      w: DIV.w,
      h: d.id === open.divisionId ? DIV.open : DIV.closed,
    }));
    const pathDiv = divisions.findIndex((d) => onPath && d.id === path?.divisionId);
    lines.push({ x1: centre(parent), y1: parent.y + DEPT.h, x2: centre(parent), y2: line2, accent: pathDiv >= 0 });
    lines.push(...run([centre(parent), ...divBoxes.map(centre)], line2, pathDiv >= 0 ? centre(parent) : null, pathDiv >= 0 ? centre(divBoxes[pathDiv]) : null));
    divBoxes.forEach((box, i) => lines.push({ x1: centre(box), y1: line2, x2: centre(box), y2: divTop, accent: i === pathDiv }));
    height = divTop + DIV.closed;

    if (openDivision && people.length > 0) {
      const parentDiv = divBoxes[divisions.indexOf(openDivision)];
      const personTop = parentDiv.y + parentDiv.h + 2 * DROP;
      const pStart = rowStart(parentDiv.x, personRow, width);
      personBoxes = people.map((p, i): Box => ({
        x: pStart + i * (PERSON.w + PERSON.gap),
        y: personTop,
        w: PERSON.w,
        h: p.self ? PERSON.self : PERSON.h,
      }));
      // One drop from the division into its row of people (board 54).
      lines.push({
        x1: centre(parentDiv),
        y1: parentDiv.y + parentDiv.h,
        x2: centre(parentDiv),
        y2: personTop,
        accent: people.some((p) => p.self),
      });
      height = personTop + Math.max(...personBoxes.map((b) => b.h));
    }
  }

  const share = (x: number) => `${(x / width) * 100}%`;
  const at = (box: Box): CSSProperties => ({ left: share(box.x), top: box.y, width: share(box.w), minHeight: box.h });

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: width, height }}>
      {/* Stretched sideways only, with strokes kept at 1px. */}
      <svg
        aria-hidden
        className="absolute inset-0"
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {lines
          .filter((l) => !l.accent)
          .map((l, i) => (
            <line key={`h${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="stroke-border-strong" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        {lines
          .filter((l) => l.accent)
          .map((l, i) => (
            <line key={`a${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="stroke-accent" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
      </svg>

      {tree.leader && (
        <div className="absolute" style={at(leader)}>
          <LeaderCard person={tree.leader} onPath={path !== null} found={found === tree.leader.id} />
        </div>
      )}

      {departments.map((department, i) => (
        <div key={department.id} className="absolute" style={at(deptBoxes[i])}>
          <DepartmentCard
            department={department}
            onPath={department.id === path?.departmentId}
            isOpen={department.id === open.departmentId}
            found={found !== null && department.head?.id === found}
            onToggle={() =>
              department.id === open.departmentId ? onOpen({ departmentId: null, divisionId: null }) : onExpandAll()
            }
          />
        </div>
      ))}

      {divisions.map((division, i) => (
        <div key={division.id} className="absolute" style={at(divBoxes[i])}>
          <DivisionCard
            division={division}
            onPath={openDepartment?.id === path?.departmentId && division.id === path?.divisionId}
            isOpen={division.id === open.divisionId}
            onOpen={() => onOpen({ departmentId: open.departmentId, divisionId: division.id })}
          />
        </div>
      ))}

      {people.map((person, i) => (
        <div key={person.id} className="absolute" style={at(personBoxes[i])}>
          <PersonCard person={person} lead={person.id === openDivision?.lead?.id} found={person.id === found} />
        </div>
      ))}
    </div>
  );
}

type FoldedProps = {
  tree: TeamTree;
  open: Open;
  found: number | null;
  onOpen: (open: Open) => void;
  onExpandAll: () => void;
};

/** Folded on a phone: the same cards and the same open branch, stacked and indented instead of spread out. */
function FoldedList({ tree, open, found, onOpen, onExpandAll }: FoldedProps) {
  const path = tree.path;
  const branch = "ml-3 flex flex-col gap-2 border-l pl-3";
  return (
    <div className="flex flex-col gap-2">
      {tree.leader && (
        <div className="h-[110px]">
          <LeaderCard person={tree.leader} onPath={path !== null} found={found === tree.leader.id} />
        </div>
      )}
      <div className={`${branch} ${path ? "border-accent/70" : "border-border-strong"}`}>
        {tree.departments.map((department) => {
          const isOpen = department.id === open.departmentId;
          const openDivision = isOpen ? department.divisions.find((d) => d.id === open.divisionId) ?? null : null;
          const onPath = department.id === path?.departmentId;
          return (
            <div key={department.id} className="flex flex-col gap-2">
              <div className="min-h-[96px]">
                <DepartmentCard
                  department={department}
                  onPath={onPath}
                  isOpen={isOpen}
                  found={found !== null && department.head?.id === found}
                  onToggle={() => (isOpen ? onOpen({ departmentId: null, divisionId: null }) : onExpandAll())}
                />
              </div>
              {isOpen && (
                <div className={`${branch} ${onPath ? "border-accent/70" : "border-border-strong"}`}>
                  {department.divisions.map((division) => (
                    <div key={division.id} className="flex flex-col gap-2">
                      <div className={division.id === openDivision?.id ? "min-h-[60px]" : "min-h-[80px]"}>
                        <DivisionCard
                          division={division}
                          onPath={onPath && division.id === path?.divisionId}
                          isOpen={division.id === openDivision?.id}
                          onOpen={() => onOpen({ departmentId: department.id, divisionId: division.id })}
                        />
                      </div>
                      {division.id === openDivision?.id && (
                        <div className="grid grid-cols-3 gap-2">
                          {[...(division.lead ? [division.lead] : []), ...division.members].map((person) => (
                            <div key={person.id} className={person.self ? "min-h-[124px]" : "min-h-[104px]"}>
                              <PersonCard person={person} lead={person.id === division.lead?.id} found={person.id === found} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function cardTone(highlight: boolean): string {
  return highlight ? "border-accent/70 bg-accent/[0.06]" : "border-hairline bg-panel";
}

function LeaderCard({ person, onPath, found }: { person: TreePerson; onPath: boolean; found: boolean }) {
  return (
    <div className={`flex h-full flex-col items-center justify-center rounded-xl border px-3 text-center ${cardTone(onPath || found)}`}>
      <Avatar name={person.name} size="ml" accent />
      <p className="mt-2 truncate text-[13px] font-semibold">{person.name}</p>
      <p className="text-[12px] text-prt-muted">Team Leader</p>
    </div>
  );
}

function DepartmentCard({
  department,
  onPath,
  isOpen,
  found,
  onToggle,
}: {
  department: TreeDepartment;
  onPath: boolean;
  isOpen: boolean;
  found: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex h-full flex-col rounded-xl border px-3.5 py-3 ${cardTone((onPath && isOpen) || found)}`}>
      <p className={`truncate font-mono text-[9px] uppercase tracking-[0.12em] ${onPath ? "text-accent" : "text-dim"}`}>
        {department.name}
      </p>
      <p className="mt-1 truncate text-[13px] font-semibold">{department.head?.name ?? department.name}</p>
      <p className="truncate text-[12px] text-prt-muted">
        {department.head ? "Head · " : ""}
        {department.size} people
      </p>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`mt-auto flex w-max items-center gap-1 rounded text-[11px] transition-colors duration-300 ease-out ${FOCUS} ${
          isOpen ? "text-accent hover:text-accent-hover" : "text-prt-muted hover:text-prt-text"
        }`}
      >
        {isOpen ? <ChevronUp aria-hidden className="h-3 w-3" /> : <ChevronDown aria-hidden className="h-3 w-3" />}
        {isOpen ? "Collapse" : "Expand"}
      </button>
    </div>
  );
}

function DivisionCard({
  division,
  onPath,
  isOpen,
  onOpen,
}: {
  division: TreeDivision;
  onPath: boolean;
  isOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <div className={`flex h-full flex-col rounded-xl border px-3.5 py-3 ${cardTone(onPath && isOpen)}`}>
      <p className="truncate text-[13px] font-semibold">{division.name}</p>
      <p className="truncate text-[12px] text-prt-muted">
        {division.lead ? `Lead: ${division.lead.name} · ` : ""}
        {division.size} people
      </p>
      {!isOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={false}
          className={`mt-auto flex w-max items-center gap-1 rounded text-[11px] text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
        >
          <ChevronDown aria-hidden className="h-3 w-3" />
          Expand
        </button>
      )}
    </div>
  );
}

function PersonCard({ person, lead, found }: { person: TreePerson; lead: boolean; found: boolean }) {
  return (
    <div className={`flex h-full flex-col items-center rounded-xl border px-1.5 pt-3 text-center ${cardTone(person.self || found)}`}>
      <Avatar name={person.name} accent={lead} />
      <p className="mt-2 w-full truncate text-[12px] font-semibold">{person.name}</p>
      <p className="text-[11px] text-prt-muted">{lead ? "Division lead" : "Member"}</p>
      {person.self && <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-accent">You</p>}
    </div>
  );
}

// Expanded (board 54b): the same leader and head row as the folded tree, and
// under each head every division of that department, stacked in its column.

/** The centre of column `i` of six, 12px apart, as a CSS length. */
function columnCentre(i: number): string {
  return `calc((100% - ${5 * GAP}px) / 6 * ${i + 0.5} + ${GAP * i}px)`;
}

/** The short line joining a card to the one above it, in line with the cards' avatars (board 54b). */
function Connector() {
  return <span aria-hidden className="ml-[21px] block h-4 border-l border-border-strong" />;
}

function ExpandedTree({
  tree,
  open,
  found,
  onFold,
}: {
  tree: TeamTree;
  open: Open;
  found: number | null;
  onFold: (open: Open) => void;
}) {
  const departments = tree.departments;
  const pathIndex = departments.findIndex((d) => d.id === tree.path?.departmentId);
  const six = departments.length === 6;
  return (
    <div className="min-w-[280px]">
      {tree.leader && (
        <div className="mx-auto h-[110px] w-[200px]">
          <LeaderCard person={tree.leader} onPath={tree.path !== null} found={found === tree.leader.id} />
        </div>
      )}
      {six && (
        // The joining lines show only when all six columns sit in one row.
        <div aria-hidden className="relative hidden h-8 xl:block">
          <span className="absolute left-1/2 top-0 h-4 border-l border-border-strong" />
          <span
            className="absolute top-4 border-t border-border-strong"
            style={{ left: columnCentre(0), right: `calc(100% - ${columnCentre(5)})` }}
          />
          {pathIndex >= 0 && (
            <>
              <span className="absolute left-1/2 top-0 h-4 border-l border-accent" />
              <span
                className="absolute top-4 border-t border-accent"
                style={
                  pathIndex < 3
                    ? { left: columnCentre(pathIndex), right: "50%" }
                    : { left: "50%", right: `calc(100% - ${columnCentre(pathIndex)})` }
                }
              />
            </>
          )}
          {departments.map((d, i) => (
            <span
              key={d.id}
              className={`absolute top-4 h-4 border-l ${i === pathIndex ? "border-accent" : "border-border-strong"}`}
              style={{ left: columnCentre(i) }}
            />
          ))}
        </div>
      )}
      <div className={`grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 ${six ? "mt-4 xl:mt-0 xl:grid-cols-6" : "mt-6"}`}>
        {departments.map((department) => {
          const isOpen = department.id === open.departmentId;
          const onPath = department.id === tree.path?.departmentId;
          return (
            <div key={department.id} className="flex flex-col">
              <div className="min-h-[96px]">
                <DepartmentCard
                  department={department}
                  onPath={onPath}
                  isOpen={isOpen}
                  found={found !== null && department.head?.id === found}
                  onToggle={() =>
                    onFold(isOpen ? open : { departmentId: department.id, divisionId: null })
                  }
                />
              </div>
              {department.divisions.map((division) => (
                <div key={division.id}>
                  <Connector />
                  <ExpandedDivision
                    division={division}
                    onPath={onPath && division.id === tree.path?.divisionId}
                    found={found}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A small mono tag beside a name: LEAD, YOU. */
function Tag({ children }: { children: string }) {
  return <span className="ml-1.5 inline-block whitespace-nowrap font-mono text-[8px] font-normal uppercase tracking-[0.2em] text-accent">{children}</span>;
}

/** A division and every one of its people, the lead first (board 54b). */
function ExpandedDivision({ division, onPath, found }: { division: TreeDivision; onPath: boolean; found: number | null }) {
  const people = [...(division.lead ? [division.lead] : []), ...division.members];
  return (
    <div className={`rounded-xl border px-3 pb-2.5 pt-3 ${cardTone(onPath)}`}>
      <p className="text-[13px] font-semibold leading-snug">{division.name}</p>
      <ul className="mt-2 flex flex-col">
        {people.map((person) => {
          const lead = person.id === division.lead?.id;
          return (
            <li
              key={person.id}
              className={`-mx-1.5 flex min-h-[26px] items-center gap-2 rounded-md px-1.5 ${person.self ? "bg-accent/[0.1]" : ""} ${
                person.id === found ? "ring-1 ring-accent" : ""
              }`}
            >
              <Avatar name={person.name} size="xs" accent={lead} />
              {/* The name wraps rather than cut when a tag leaves it too little room. */}
              <span
                className={`min-w-0 py-1 text-[11px] leading-tight ${lead || person.self ? "font-semibold text-prt-text" : "text-text-2"}`}
              >
                {person.name}
                {lead && <Tag>Lead</Tag>}
                {person.self && <Tag>You</Tag>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
