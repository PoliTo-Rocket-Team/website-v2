// The Team pages of the dashboard (issue #143): Members (boards 46, 46b),
// Alumni (46c) and the Team tree (42, 42b). Both sides of the data
// interface hand these shapes to the pages; the components render them and
// fetch nothing. The tree is built here from the roster alone, so a person
// added to the roster is a node.

/** Where someone sits on the team, which also says what they lead. */
export type Placement =
  | { readonly role: "team-leader" }
  | { readonly role: "head"; readonly departmentId: number }
  | { readonly role: "division-lead"; readonly divisionId: number }
  /** A division of null: added to the roster, not yet placed. */
  | { readonly role: "member"; readonly divisionId: number | null };

export type TeamRole = Placement["role"];

export type OrgDepartment = { readonly id: number; readonly name: string };
export type OrgDivision = { readonly id: number; readonly name: string; readonly departmentId: number };

/** The departments and divisions that are open now, in display order. */
export type OrgChart = {
  readonly departments: readonly OrgDepartment[];
  readonly divisions: readonly OrgDivision[];
};

/** One person on this year's team, as both sides of the data interface read them. */
export type RosterEntry = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly placement: Placement;
  /** The title under their name on the public Team page, when one is set. */
  readonly pageTitle: string | null;
  /** The year they joined the team. */
  readonly joined: number;
  /** "Aerospace Eng." */
  readonly program: string | null;
  /** "MSc · year 1" */
  readonly study: string | null;
  /** What they can reach beyond their own pages: "Applications · view". */
  readonly access: readonly string[];
};

export function divisionIdOf(placement: Placement): number | null {
  return placement.role === "division-lead" || placement.role === "member" ? placement.divisionId : null;
}

export function departmentIdOf(placement: Placement, org: OrgChart): number | null {
  if (placement.role === "head") return placement.departmentId;
  const divisionId = divisionIdOf(placement);
  return org.divisions.find((d) => d.id === divisionId)?.departmentId ?? null;
}

export function isLead(role: TeamRole): boolean {
  return role !== "member";
}

/** The roles a drawer can set: a lead or member of the person's own division. */
export type EditableRole = "division-lead" | "member";

/** What the member drawer saves (board 46b). */
export type MemberEdit = {
  readonly role: EditableRole;
  readonly pageTitle: string | null;
};

// ---------------------------------------------------------------------------
// Members (boards 46 and 46b)

export type MemberRow = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: TeamRole;
  /** The pill: "Head of Operations", "Division Lead", "Member". */
  readonly roleLabel: string;
  /** "Operations", or null for the team leader and anyone not yet placed. */
  readonly department: string | null;
  /** The line under the department; null when there is none. */
  readonly division: string | null;
  readonly joined: number;
  readonly program: string | null;
  readonly study: string | null;
  readonly pageTitle: string | null;
  readonly access: readonly string[];
  /** The viewer's own row: the drawer shows it but offers no changes. */
  readonly self: boolean;
};

/**
 * Who a viewer's Members page lists: the whole team for the operations lead
 * (board 46), one division for a division lead (board 46b).
 */
export type MemberDirectory =
  | { readonly scope: "team"; readonly rows: readonly MemberRow[]; readonly departments: readonly string[] }
  | { readonly scope: "division"; readonly division: string; readonly rows: readonly MemberRow[] };

function roleLabelOf(placement: Placement, org: OrgChart): string {
  switch (placement.role) {
    case "team-leader":
      return "Team Leader";
    case "head": {
      const department = org.departments.find((d) => d.id === placement.departmentId);
      return department ? `Head of ${department.name}` : "Head";
    }
    case "division-lead":
      return "Division Lead";
    case "member":
      return "Member";
  }
}

const ROLE_ORDER: Readonly<Record<TeamRole, number>> = { "team-leader": 0, head: 1, "division-lead": 2, member: 3 };

export function memberRowOf(entry: RosterEntry, org: OrgChart, selfId: number | null = null): MemberRow {
  const departmentId = departmentIdOf(entry.placement, org);
  const divisionId = divisionIdOf(entry.placement);
  return {
    id: entry.id,
    name: entry.name,
    email: entry.email,
    role: entry.placement.role,
    roleLabel: roleLabelOf(entry.placement, org),
    department: org.departments.find((d) => d.id === departmentId)?.name ?? null,
    division: org.divisions.find((d) => d.id === divisionId)?.name ?? null,
    joined: entry.joined,
    program: entry.program,
    study: entry.study,
    pageTitle: entry.pageTitle,
    access: entry.access,
    self: entry.id === selfId,
  };
}

/** Leads first (team leader, heads, division leads), then members; by name within each. */
function byRoleThenName(a: MemberRow, b: MemberRow): number {
  return ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name);
}

export function teamDirectory(roster: readonly RosterEntry[], org: OrgChart, selfId: number | null = null): MemberDirectory {
  const rows = roster.map((entry) => memberRowOf(entry, org, selfId)).sort(byRoleThenName);
  const present = new Set(rows.map((r) => r.department));
  return { scope: "team", rows, departments: org.departments.map((d) => d.name).filter((n) => present.has(n)) };
}

export function divisionDirectory(
  roster: readonly RosterEntry[],
  org: OrgChart,
  divisionId: number,
  selfId: number | null = null,
): MemberDirectory {
  const division = org.divisions.find((d) => d.id === divisionId);
  const rows = roster
    .filter((entry) => divisionIdOf(entry.placement) === divisionId)
    .map((entry) => memberRowOf(entry, org, selfId))
    .sort(byRoleThenName);
  return { scope: "division", division: division?.name ?? "", rows };
}

export const MEMBER_TABS = ["all", "leads", "members"] as const;
export type MemberTab = (typeof MEMBER_TABS)[number];

export const MEMBER_TAB_LABELS: Readonly<Record<MemberTab, string>> = { all: "All", leads: "Leads", members: "Members" };

export function inMemberTab(row: MemberRow, tab: MemberTab): boolean {
  if (tab === "all") return true;
  return tab === "leads" ? isLead(row.role) : !isLead(row.role);
}

/** A name or email holds every word of the query, in any case. */
export function matchesQuery(fields: readonly string[], query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = fields.join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export type MemberFilter = {
  readonly tab: MemberTab;
  /** A department name, or null for all departments. */
  readonly department: string | null;
  readonly query: string;
};

/** The filter before the tab: what the tab counts are counted over. */
export function memberRowsFor(rows: readonly MemberRow[], filter: Omit<MemberFilter, "tab">): MemberRow[] {
  return rows.filter(
    (row) =>
      (filter.department === null || row.department === filter.department) &&
      matchesQuery([row.name, row.email], filter.query),
  );
}

// ---------------------------------------------------------------------------
// Alumni (board 46c)

export type AlumnusRow = {
  readonly id: number;
  readonly name: string;
  readonly lastRole: string;
  /** The unit under the last role: "Propulsion", "Board". */
  readonly unit: string;
  /** The department the filter files them under. */
  readonly department: string;
  readonly from: number;
  readonly to: number;
  /**
   * Whether the public Team page lists them. Null where the source keeps no
   * such flag (the database has no column for it yet), and the page then
   * shows no switch.
   */
  readonly shownOnSite: boolean | null;
};

export type AlumniDirectory = {
  readonly rows: readonly AlumnusRow[];
  readonly departments: readonly string[];
};

/** Most recent leavers first, then by name. */
export function alumniDirectory(rows: readonly AlumnusRow[]): AlumniDirectory {
  const sorted = [...rows].sort((a, b) => b.to - a.to || b.from - a.from || a.name.localeCompare(b.name));
  return { rows: sorted, departments: [...new Set(sorted.map((r) => r.department))].sort() };
}

/** The team year a date falls in: a year runs from October, so 9 Oct 2026 gives "2026–27". */
export function seasonAt(date: Date): string {
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 9 ? year : year - 1;
  return seasonOf(start + 1);
}

/** The team year someone left in, by the year they left: 2025 gives "2024–25". */
export function seasonOf(leftIn: number): string {
  return `${leftIn - 1}–${String(leftIn % 100).padStart(2, "0")}`;
}

/** The two latest years people left in, newest first: the tabs beside "All years". */
export function recentSeasons(rows: readonly AlumnusRow[], count = 2): number[] {
  return [...new Set(rows.map((r) => r.to))].sort((a, b) => b - a).slice(0, count);
}

export type AlumniFilter = {
  /** A year people left in, or null for all years. */
  readonly leftIn: number | null;
  readonly department: string | null;
  readonly query: string;
};

export function alumniRowsFor(rows: readonly AlumnusRow[], filter: Omit<AlumniFilter, "leftIn">): AlumnusRow[] {
  return rows.filter(
    (row) => (filter.department === null || row.department === filter.department) && matchesQuery([row.name], filter.query),
  );
}

// ---------------------------------------------------------------------------
// Paging (boards 46 and 46c)

export const PAGE_SIZE = 9;

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export function pageOf<T>(rows: readonly T[], page: number, size = PAGE_SIZE): T[] {
  const last = pageCount(rows.length, size);
  const current = Math.min(Math.max(1, page), last);
  return rows.slice((current - 1) * size, current * size);
}

/**
 * The page numbers a pager shows: the first three, the current one and its
 * neighbours, and the last, with null for each gap ("1 2 3 … 12").
 */
export function pagerItems(current: number, last: number): (number | null)[] {
  const keep = new Set([1, 2, 3, current - 1, current, current + 1, last]);
  const pages = [...keep].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]));
}

// ---------------------------------------------------------------------------
// Team tree (boards 42 and 42b)

export type TreePerson = {
  readonly id: number;
  readonly name: string;
  /** The viewer: marked "YOU" and on the highlighted path. */
  readonly self: boolean;
};

export type TreeDivision = {
  readonly id: number;
  readonly name: string;
  readonly lead: TreePerson | null;
  readonly members: readonly TreePerson[];
  /** Everyone in it, lead included. */
  readonly size: number;
};

export type TreeDepartment = {
  readonly id: number;
  readonly name: string;
  readonly head: TreePerson | null;
  readonly divisions: readonly TreeDivision[];
  /** Everyone in it, head included. */
  readonly size: number;
};

export type TeamTree = {
  /** "2026–27" */
  readonly season: string;
  readonly leader: TreePerson | null;
  readonly departments: readonly TreeDepartment[];
  /** Everyone on the roster. */
  readonly size: number;
  /** The viewer's place, for the highlighted path; null when they are not in a division or department. */
  readonly path: { readonly departmentId: number; readonly divisionId: number | null } | null;
};

/** The tree of this year's roster as `selfId` sees it. Departments and divisions with nobody in them are left out. */
export function buildTeamTree(
  roster: readonly RosterEntry[],
  org: OrgChart,
  season: string,
  selfId: number | null,
): TeamTree {
  const node = (entry: RosterEntry): TreePerson => ({ id: entry.id, name: entry.name, self: entry.id === selfId });
  const byName = (a: RosterEntry, b: RosterEntry) => a.name.localeCompare(b.name);

  const departments = org.departments.flatMap((department): TreeDepartment[] => {
    const head = roster.find((e) => e.placement.role === "head" && e.placement.departmentId === department.id);
    const divisions = org.divisions
      .filter((d) => d.departmentId === department.id)
      .flatMap((division): TreeDivision[] => {
        const inDivision = roster.filter((e) => divisionIdOf(e.placement) === division.id);
        if (inDivision.length === 0) return [];
        const lead = inDivision.find((e) => e.placement.role === "division-lead");
        const members = inDivision.filter((e) => e !== lead).sort(byName);
        return [{ id: division.id, name: division.name, lead: lead ? node(lead) : null, members: members.map(node), size: inDivision.length }];
      });
    const size = (head ? 1 : 0) + divisions.reduce((sum, d) => sum + d.size, 0);
    return size === 0 ? [] : [{ id: department.id, name: department.name, head: head ? node(head) : null, divisions, size }];
  });

  const leader = roster.find((e) => e.placement.role === "team-leader");
  const me = roster.find((e) => e.id === selfId);
  const myDepartment = me ? departmentIdOf(me.placement, org) : null;
  return {
    season,
    leader: leader ? node(leader) : null,
    departments,
    size: roster.length,
    path: me && myDepartment !== null ? { departmentId: myDepartment, divisionId: divisionIdOf(me.placement) } : null,
  };
}

/** How many of a division's members a tree card lists before "+N more": all when five or fewer. */
export function shownMembers(members: readonly TreePerson[], limit = 4): { shown: readonly TreePerson[]; more: number } {
  if (members.length <= limit + 1) return { shown: members, more: 0 };
  // The viewer is always listed.
  const self = members.find((m) => m.self);
  const head = members.slice(0, limit);
  const shown = self && !head.includes(self) ? [...head.slice(0, limit - 1), self] : head;
  return { shown, more: members.length - shown.length };
}
