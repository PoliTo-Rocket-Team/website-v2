import { levelLabel, type MemberDetails } from "./details";
import { matchesPerson, type DivisionChip, type DivisionHeader, type PersonDivision, type PersonRecord, type SignedNda } from "./division-members";
import { beyondTitle, BOARD_SEAT_TITLES, divisionLabel, homeFirst, leadsChangedBy, type OrgChart, type TeamRole } from "./team";

// The team leader's Members page (boards 73 to 73c, issue #252): the whole
// team in one list, heads and leads first, narrowed by a department select, a
// division select and a search; a Table view of every member field with a
// filter on seven columns. Both sides of the data interface build it here
// from the records the division pages read (./division-members.ts), so the
// rules are one.

/** One person on the whole team, as the list, the table and the member panel show them. */
export type TeamMember = {
  readonly id: number;
  readonly name: string;
  /** The account they sign in with: the list's line under the name. */
  readonly signInEmail: string;
  readonly photoUrl: string | null;
  /** The year they joined the team. */
  readonly since: number;
  /** Where they rank: team leader, board seat, head, division lead, then member. */
  readonly role: TeamRole;
  /** The Role column: "Head of Department", "Division Lead", their title, or "Member". */
  readonly roleLabel: string;
  /** Every department they are in or head: what the department select matches. */
  readonly departmentIds: readonly number[];
  /** Every division they are in, and for a head every division of their department: what the division select matches. */
  readonly divisionIds: readonly number[];
  /** The Divisions column (board 73): a code per division; a head shows their department's codes. */
  readonly chips: readonly DivisionChip[];
  /** Every division they are in, for the member panel, each with its department. */
  readonly divisions: readonly PersonDivision[];
  readonly details: MemberDetails;
  readonly nda: SignedNda | null;
  /** The viewer's own row. */
  readonly self: boolean;
};

/** A department with its open divisions: the department and division selects. */
export type TeamUnit = {
  readonly id: number;
  readonly name: string;
  readonly divisions: readonly { readonly id: number; readonly name: string; readonly code: string | null }[];
};

export type WholeTeamMembers = {
  /** Heads and leads first (`byRank`). */
  readonly people: readonly TeamMember[];
  readonly departments: readonly TeamUnit[];
  /** Add member's Division select: every open division of the team. */
  readonly divisions: readonly DivisionHeader[];
};

const RANK: Readonly<Record<TeamRole, number>> = { "team-leader": 0, board: 1, head: 2, "division-lead": 3, member: 4 };

/** Heads and leads first (the team leader, the board seats, heads, division leads), then members; by name within each. */
export function byRank(a: Pick<TeamMember, "role" | "name">, b: Pick<TeamMember, "role" | "name">): number {
  return RANK[a.role] - RANK[b.role] || a.name.localeCompare(b.name);
}

function rankOf(record: PersonRecord): TeamRole {
  const kinds = record.beyondDivisions.map((b) => b.kind);
  if (kinds.includes("team-leader")) return "team-leader";
  if (kinds.includes("board")) return "board";
  if (kinds.includes("head")) return "head";
  return record.memberships.some((m) => m.role === "lead") ? "division-lead" : "member";
}

function roleLabelOf(record: PersonRecord, role: TeamRole, org: OrgChart): string {
  switch (role) {
    case "team-leader":
      return "Team Leader";
    case "board": {
      const seat = record.beyondDivisions.find((b) => b.kind === "board");
      return seat?.kind === "board" ? BOARD_SEAT_TITLES[seat.seat] : "Board";
    }
    case "head":
      return "Head of Department";
    case "division-lead":
      return "Division Lead";
    case "member": {
      const home = homeFirst(record.memberships)[0];
      const title = home === undefined ? null : (record.titles[home.divisionId] ?? null);
      if (title !== null) return title;
      // A role kept on a department or on the team names its own title.
      const other = record.beyondDivisions[0];
      return other === undefined ? "Member" : beyondTitle(other, org);
    }
  }
}

/** The person on the whole team, as `org` places their divisions. */
export function teamMemberOf(record: PersonRecord, org: OrgChart, selfId: number | null): TeamMember {
  const role = rankOf(record);
  const headOf = record.beyondDivisions.flatMap((b) => (b.kind === "head" && b.departmentId !== null ? [b.departmentId] : []));
  const own = homeFirst(record.memberships).flatMap((m) => {
    const division = org.divisions.find((d) => d.id === m.divisionId);
    return division ? [{ membership: m, division }] : [];
  });
  const headed = org.divisions.filter((d) => headOf.includes(d.departmentId));
  const shown = [...headed, ...own.map((o) => o.division).filter((d) => !headed.some((h) => h.id === d.id))];
  return {
    id: record.id,
    name: record.name,
    signInEmail: record.signInEmail,
    photoUrl: record.photoUrl,
    since: record.since,
    role,
    roleLabel: roleLabelOf(record, role, org),
    departmentIds: [...new Set([...headOf, ...own.map((o) => o.division.departmentId)])],
    divisionIds: shown.map((d) => d.id),
    chips: shown.map((d) => ({ divisionId: d.id, label: d.code ?? divisionLabel(d.name), code: d.code != null })),
    divisions: own.map(({ membership, division }) => ({
      divisionId: division.id,
      name: divisionLabel(division.name),
      code: division.code ?? null,
      department: org.departments.find((x) => x.id === division.departmentId)?.name ?? "",
      sameDepartment: false,
      role: membership.role,
      title: record.titles[division.id] ?? null,
    })),
    details: record.details,
    nda: record.nda,
    self: record.id === selfId,
  };
}

/** The team leader's Members page: everyone once, heads and leads first, with the selects' departments and divisions. */
export function wholeTeamMembers(input: {
  readonly records: readonly PersonRecord[];
  readonly org: OrgChart;
  readonly selfId: number | null;
}): WholeTeamMembers {
  const { org } = input;
  return {
    people: input.records.map((r) => teamMemberOf(r, org, input.selfId)).sort(byRank),
    departments: org.departments.map((d) => ({
      id: d.id,
      name: d.name,
      divisions: org.divisions.filter((v) => v.departmentId === d.id).map((v) => ({ id: v.id, name: v.name, code: v.code ?? null })),
    })),
    divisions: org.divisions.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code ?? null,
      department: org.departments.find((x) => x.id === d.departmentId)?.name ?? "",
      leadsHint: leadsChangedBy(d.id, org),
    })),
  };
}

/** "Whole team · 112 people in 6 departments" under the title (board 73). */
export function wholeTeamLine(page: Pick<WholeTeamMembers, "people" | "departments">): string {
  const people = page.people.length;
  const departments = page.departments.length;
  return `Whole team · ${people} ${people === 1 ? "person" : "people"} in ${departments} ${departments === 1 ? "department" : "departments"}`;
}

/** The selects and the search over the page (board 73). Null is all departments or all divisions. */
export type TeamFilter = {
  readonly departmentId: number | null;
  readonly divisionId: number | null;
  readonly query: string;
};

export const NO_TEAM_FILTER: TeamFilter = { departmentId: null, divisionId: null, query: "" };

/** The people the selects and the search leave, in the order they came (heads and leads first). */
export function filterTeam(people: readonly TeamMember[], filter: TeamFilter): TeamMember[] {
  return people.filter(
    (p) =>
      (filter.departmentId === null || p.departmentIds.includes(filter.departmentId)) &&
      (filter.divisionId === null || p.divisionIds.includes(filter.divisionId)) &&
      matchesPerson(p, filter.query),
  );
}

/**
 * The division select's options: every division of the chosen department, or
 * of the whole team when none is chosen. A division left chosen from another
 * department reads as all divisions.
 */
export function divisionChoices(departments: readonly TeamUnit[], departmentId: number | null): TeamUnit["divisions"] {
  return departments.filter((d) => departmentId === null || d.id === departmentId).flatMap((d) => d.divisions);
}

// The Table view's column filters (boards 73b and 73c)

export const TABLE_FILTERS = ["divisions", "role", "program", "level", "from", "gender", "nda"] as const;
export type TableFilter = (typeof TABLE_FILTERS)[number];

export const TABLE_FILTER_LABELS: Readonly<Record<TableFilter, string>> = {
  divisions: "Divisions",
  role: "Role",
  program: "Program",
  level: "Level",
  from: "From",
  gender: "Gender",
  nda: "NDA",
};

/** The values ticked in each filtered column; a column with none ticked does not narrow. */
export type ColumnPicks = Readonly<Partial<Record<TableFilter, readonly string[]>>>;

export const NO_PICKS: ColumnPicks = {};

/** What a person holds in a filtered column: each division chip, or the one value; an empty field holds none. */
export function columnValues(person: TeamMember, column: TableFilter): string[] {
  const d = person.details;
  const one = (value: string) => (value === "" ? [] : [value]);
  switch (column) {
    case "divisions":
      return person.chips.map((c) => c.label);
    case "role":
      return [person.roleLabel];
    case "program":
      return one(d.programme);
    case "level":
      return d.level === "" ? [] : [levelLabel(d.level)];
    case "from":
      return one(d.country);
    case "gender":
      return one(d.gender);
    case "nda":
      return [person.nda === null ? "Not signed" : "Signed"];
  }
}

function matchesPicks(person: TeamMember, picks: ColumnPicks, skip: TableFilter | null): boolean {
  return TABLE_FILTERS.every((column) => {
    const ticked = picks[column];
    if (column === skip || ticked === undefined || ticked.length === 0) return true;
    return columnValues(person, column).some((value) => ticked.includes(value));
  });
}

/** The people every column's ticks leave: within a column any ticked value matches, across columns all must. */
export function withPicks(people: readonly TeamMember[], picks: ColumnPicks): TeamMember[] {
  return people.filter((p) => matchesPicks(p, picks, null));
}

export type ColumnOption = { readonly value: string; readonly count: number };

/**
 * A column's popover (board 73c): each value with how many people hold it,
 * counted over the people the other columns' ticks leave, most first, then
 * by name.
 */
export function columnOptions(people: readonly TeamMember[], picks: ColumnPicks, column: TableFilter): ColumnOption[] {
  const counts = new Map<string, number>();
  for (const person of people) {
    if (!matchesPicks(person, picks, column)) continue;
    for (const value of new Set(columnValues(person, column))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** The picks with one value ticked or unticked in one column. */
export function togglePick(picks: ColumnPicks, column: TableFilter, value: string): ColumnPicks {
  const ticked = picks[column] ?? [];
  const next = ticked.includes(value) ? ticked.filter((v) => v !== value) : [...ticked, value];
  return { ...picks, [column]: next };
}

/** The picks with one column cleared. */
export function clearPicks(picks: ColumnPicks, column: TableFilter): ColumnPicks {
  return { ...picks, [column]: [] };
}
