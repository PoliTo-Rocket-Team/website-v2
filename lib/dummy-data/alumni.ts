import { importedEntries } from "@/lib/about/alumni-import";
import {
  academicYearOfDay,
  alumniOf,
  withEntryChange,
  type AlumniEntry,
  type AlumniRecord,
  type Alumnus,
  type AlumnusKey,
  type RecordRole,
} from "@/lib/about/alumni-record";
import { BOARD_SEAT_TITLES, type OrgChart, type OrgDivision, type Placement, type RosterEntry } from "@/lib/dashboard/team";
import type { DummyAlumniEdits } from "./edits";
import { DUMMY_NOW, type DummyAlumnus } from "./team";

// The test developer's Alumni record (issue #257): the dummy team's roles,
// as the database would hold them, with the real one-time import beside
// them and the test developer's fixes and advisors laid over it. The public
// Alumni page reads it with no edits in dummy mode (lib/about/alumni-data.ts).

/** This academic year on the dummy clock: 2026–27. */
export const DUMMY_ALUMNI_YEAR = academicYearOfDay(DUMMY_NOW.slice(0, 10));

/** Someone off the team: their Alumni row, and the place they held when they left, when the roster knew them. */
export type DummyFormer = { readonly row: DummyAlumnus; readonly placement: Placement | null };

const IMPORTED_FIRST_ID = 5000;
const ADVISOR_FIRST_ID = 8000;

/** The roles one placement holds: the seat or head row, and one per division beside it. */
function placementRoles(memberId: number, placement: Placement, org: OrgChart, startedAt: string, leftAt: string | null): RecordRole[] {
  const base = { memberId, startedAt, leftAt, departmentId: null, divisionId: null };
  const seat: RecordRole[] =
    placement.role === "team-leader"
      ? [{ ...base, type: "president", title: "Team Leader" }]
      : placement.role === "board"
        ? [{ ...base, type: null, title: BOARD_SEAT_TITLES[placement.seat] }]
        : placement.role === "head"
          ? [{ ...base, type: "head", title: `Head of ${org.departments.find((d) => d.id === placement.departmentId)?.name ?? "Department"}`, departmentId: placement.departmentId }]
          : [];
  const inDivisions = placement.memberships.map(
    (m): RecordRole => ({
      ...base,
      // A membership keeps its own start, never before the person joined.
      startedAt: leftAt === null && m.since > startedAt ? m.since : startedAt,
      type: m.role === "lead" ? "lead" : "core",
      title: m.role === "lead" ? "Division Lead" : "Member",
      divisionId: m.divisionId,
    }),
  );
  return [...seat, ...inDivisions];
}

/** The one role an Alumni row stands for, when the roster no longer knows the person. */
function rowRole(row: DummyAlumnus, units: AlumniRecord["units"], startedAt: string, leftAt: string): RecordRole {
  const department = units.departments.find((d) => d.name === row.department);
  const division = units.divisions.find((d) => d.name === row.unit || d.name === `${row.unit} Division`);
  const type = row.lastRole === "Team Leader" ? "president" : row.lastRole.startsWith("Head of") ? "head" : row.lastRole === "Division Lead" ? "lead" : "core";
  return { memberId: row.id, type, title: row.lastRole, startedAt, leftAt, departmentId: department?.id ?? null, divisionId: division?.id ?? null };
}

/**
 * The record: the roster's active roles, each former member's ended ones, the
 * import, and the test developer's changes. Departments the dummy team no
 * longer has (Propulsion) stay as names, as closed ones do.
 */
export function dummyAlumniRecord(input: {
  readonly team: readonly RosterEntry[];
  readonly former: readonly DummyFormer[];
  readonly org: OrgChart;
  readonly closed: readonly OrgDivision[];
  readonly edits: DummyAlumniEdits;
}): AlumniRecord {
  const { team, former, org, closed, edits } = input;
  const known = new Set(org.departments.map((d) => d.name));
  const gone = [...new Set(former.map((f) => f.row.department))].filter((name) => name !== "Board" && !known.has(name));
  const units: AlumniRecord["units"] = {
    departments: [...org.departments, ...gone.map((name, i) => ({ id: 900 + i, name }))],
    divisions: [...org.divisions, ...closed].sort((a, b) => a.id - b.id),
  };
  const roles = [
    ...team.flatMap((e) => placementRoles(e.id, e.placement, org, `${e.joined}-10-01`, null)),
    ...former.flatMap(({ row, placement }) => {
      const startedAt = `${row.from}-10-01`;
      const leftAt = `${row.to}-06-30`;
      return placement === null ? [rowRole(row, units, startedAt, leftAt)] : placementRoles(row.id, placement, org, startedAt, leftAt);
    }),
  ];
  const imported = importedEntries(IMPORTED_FIRST_ID);
  const hidden = former.flatMap(({ row }): AlumniEntry[] =>
    row.shownOnSite ? [] : [{ id: row.id, who: { kind: "member", memberId: row.id, keptName: null }, name: null, founder: null, photo: null, shown: false, removed: false, fixes: [] }],
  );
  const advisors = edits.advisors.map(
    (a, i): AlumniEntry => ({
      id: ADVISOR_FIRST_ID + i,
      who: { kind: "advisor", ...a },
      name: null,
      founder: null,
      photo: null,
      shown: true,
      removed: false,
      fixes: [],
    }),
  );
  const base: AlumniRecord = {
    units,
    roles,
    people: [...team.map((e) => ({ memberId: e.id, name: e.name, email: e.email })), ...former.map(({ row }) => ({ memberId: row.id, name: row.name, email: null }))],
    entries: [...hidden, ...imported.entries, ...advisors],
    imported: imported.imported,
  };
  return Object.entries(edits.entries).reduce((record, [key, change]) => withEntryChange(record, key as AlumnusKey, change), base);
}

/** Everyone the dummy record lists. */
export function dummyAlumni(record: AlumniRecord): Alumnus[] {
  return alumniOf(record, DUMMY_ALUMNI_YEAR);
}
