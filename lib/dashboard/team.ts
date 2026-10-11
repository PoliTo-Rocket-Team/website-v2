// The Team pages of the dashboard (issue #143): Members (boards 46, 46b),
// Alumni (46c) and the Team tree (42, 42b). Both sides of the data
// interface hand these shapes to the pages; the components render them and
// fetch nothing. The tree is built here from the roster alone, so a person
// added to the roster is a node.

/** The two seats beside the team leader (board 54c): the Project Manager and the Chief Engineer. */
export const BOARD_SEATS = ["project-manager", "chief-engineer"] as const;
export type BoardSeat = (typeof BOARD_SEATS)[number];

export const BOARD_SEAT_TITLES: Readonly<Record<BoardSeat, string>> = {
  "project-manager": "Project Manager",
  "chief-engineer": "Chief Engineer",
};

/** The seat a role's title names, in any case and spacing; null for any other title. */
export function boardSeatOf(title: string): BoardSeat | null {
  const key = title.trim().replace(/\s+/g, " ").toLowerCase();
  return BOARD_SEATS.find((seat) => BOARD_SEAT_TITLES[seat].toLowerCase() === key) ?? null;
}

// Divisions per person (issue #229). One person can be in several divisions
// at once, as lead or member, across departments (Owner decision, 2026-10-11),
// so a person's divisions are a list, each with its own role. The list holds
// a division at most once: only `membershipsOf` builds one, and it folds a
// division named twice into one membership.

/** What someone is in one division. */
export type DivisionRole = "lead" | "member";

export type DivisionMembership = {
  readonly divisionId: number;
  readonly role: DivisionRole;
  /** The day it started ("2024-10-01"): the oldest membership decides where the Team tree draws someone. */
  readonly since: string;
};

declare const ONE_EACH: unique symbol;

/** A person's divisions, oldest first, no division twice. Build it with `membershipsOf`. */
export type Memberships = readonly DivisionMembership[] & { readonly [ONE_EACH]: true };

function byAge(a: DivisionMembership, b: DivisionMembership): number {
  return a.since.localeCompare(b.since) || a.divisionId - b.divisionId;
}

/**
 * The memberships, oldest first, with a division named twice folded into one:
 * a lead in either is a lead, and the earlier start date is kept.
 */
export function membershipsOf(list: readonly DivisionMembership[]): Memberships {
  const byDivision = new Map<number, DivisionMembership>();
  for (const m of list) {
    const seen = byDivision.get(m.divisionId);
    byDivision.set(
      m.divisionId,
      seen === undefined
        ? m
        : {
            divisionId: m.divisionId,
            role: seen.role === "lead" || m.role === "lead" ? "lead" : "member",
            since: seen.since < m.since ? seen.since : m.since,
          },
    );
  }
  return [...byDivision.values()].sort(byAge) as unknown as Memberships;
}

export const NO_MEMBERSHIPS: Memberships = membershipsOf([]);

/** Their role in `divisionId`, or null when they are not in it. */
export function roleIn(memberships: Memberships, divisionId: number): DivisionRole | null {
  return memberships.find((m) => m.divisionId === divisionId)?.role ?? null;
}

/**
 * The memberships with `divisionId` set to `role`. Every other division stays
 * as it was: picking someone as lead of one division never moves them out of
 * the others (Owner decision, 2026-10-11). Unchanged when they are not in it.
 */
export function withRoleIn(memberships: Memberships, divisionId: number, role: DivisionRole): Memberships {
  return membershipsOf(memberships.map((m) => (m.divisionId === divisionId ? { ...m, role } : m)));
}

/** The memberships with `divisionId` added as a member from `since`; unchanged when they are already in it. */
export function withJoined(memberships: Memberships, divisionId: number, since: string): Memberships {
  if (roleIn(memberships, divisionId) !== null) return memberships;
  return membershipsOf([...memberships, { divisionId, role: "member", since }]);
}

/**
 * The one division a person is drawn under on the Team tree, and named by
 * where a page shows a single division: the oldest one they lead, else their
 * oldest membership. Null when they are in no division.
 */
export function homeDivision(memberships: Memberships): number | null {
  return (memberships.find((m) => m.role === "lead") ?? memberships[0])?.divisionId ?? null;
}

/** The memberships with the home division (`homeDivision`) first, the rest oldest first. */
export function homeFirst(memberships: Memberships): readonly DivisionMembership[] {
  const home = homeDivision(memberships);
  return [...memberships].sort((a, b) => Number(b.divisionId === home) - Number(a.divisionId === home));
}

/** The role types the `roles` table holds. */
export type RoleType = "president" | "head" | "lead" | "core" | null;

/**
 * What a role of `type` makes its holder in the division it is in: a lead or
 * head role leads it, any other role is a member of it. `standingIn` in
 * ./viewer.ts reads a viewer's division roles by this same rule.
 */
export function divisionRoleOf(type: RoleType): DivisionRole {
  return type === "lead" || type === "head" ? "lead" : "member";
}

/** One active `roles` row, as both data sources read it. */
export type RoleHeld = {
  readonly type: RoleType;
  /** The division it is in; null for a role in no division. */
  readonly divisionId: number | null;
  /** `started_at`: "2024-10-01". */
  readonly since: string;
};

/** The membership one active role gives (`divisionRoleOf`); null for a role in no division. */
export function membershipOfRole(role: RoleHeld): DivisionMembership | null {
  return role.divisionId === null ? null : { divisionId: role.divisionId, role: divisionRoleOf(role.type), since: role.since };
}

/** A person's memberships from their active roles, each division once (`membershipOfRole`, `membershipsOf`). */
export function membershipsOfRoles(roles: readonly RoleHeld[]): Memberships {
  return membershipsOf(roles.flatMap((r) => membershipOfRole(r) ?? []));
}

/** Where someone sits on the team, which also says what they lead. */
export type Placement =
  | { readonly role: "team-leader" }
  | { readonly role: "board"; readonly seat: BoardSeat }
  | { readonly role: "head"; readonly departmentId: number }
  /** In one or more divisions; none yet when they were added to the roster and not placed. */
  | { readonly role: "divisions"; readonly memberships: Memberships };

/** How the Members page and the tree name someone's place: a division lead when they lead any division. */
export type TeamRole = "team-leader" | "board" | "head" | "division-lead" | "member";

export function teamRoleOf(placement: Placement): TeamRole {
  if (placement.role !== "divisions") return placement.role;
  return placement.memberships.some((m) => m.role === "lead") ? "division-lead" : "member";
}

/** A placement in divisions, from its memberships. */
export function inDivisions(list: readonly DivisionMembership[]): Placement {
  return { role: "divisions", memberships: membershipsOf(list) };
}

/** Someone's divisions; none for the team leader, a board seat or a head. */
export function membershipsIn(placement: Placement): Memberships {
  return placement.role === "divisions" ? placement.memberships : NO_MEMBERSHIPS;
}

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

/** The division someone is drawn under on the tree (`homeDivision`); null for a seat, a head or someone not placed. */
export function homeDivisionOf(placement: Placement): number | null {
  return homeDivision(membershipsIn(placement));
}

/**
 * The oldest division someone leads; null when they lead none. Pages scoped
 * to one led division (Access, Orders) read it until #230, #231 and #233 give
 * them every division.
 */
export function ledDivisionOf(placement: Placement): number | null {
  return membershipsIn(placement).find((m) => m.role === "lead")?.divisionId ?? null;
}

/** Whether someone is in `divisionId`, as lead or member. */
export function isIn(placement: Placement, divisionId: number): boolean {
  return roleIn(membershipsIn(placement), divisionId) !== null;
}

/** The department a head heads, or the one their home division is in. */
export function departmentIdOf(placement: Placement, org: OrgChart): number | null {
  if (placement.role === "head") return placement.departmentId;
  const divisionId = homeDivisionOf(placement);
  return org.divisions.find((d) => d.id === divisionId)?.departmentId ?? null;
}

/** The placement with their role in `divisionId` set; other divisions untouched, and anyone not in it unchanged. */
export function placedWithRoleIn(placement: Placement, divisionId: number, role: DivisionRole): Placement {
  return placement.role === "divisions" ? { role: "divisions", memberships: withRoleIn(placement.memberships, divisionId, role) } : placement;
}

export function isLead(role: TeamRole): boolean {
  return role !== "member";
}

/** The roles a drawer can set: a lead or member of the person's own division. */
export type EditableRole = "division-lead" | "member";

/** The division role a drawer's choice sets. */
export const DIVISION_ROLE_OF: Readonly<Record<EditableRole, DivisionRole>> = { "division-lead": "lead", member: "member" };

/**
 * What the member drawer saves (board 46b). `role` is null for a person whose
 * role the drawer does not set (the team leader, a head, someone in no
 * division): their placement stays and only the title changes.
 */
export type MemberEdit = {
  readonly role: EditableRole | null;
  readonly pageTitle: string | null;
};

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
 * Someone accepted for one of the division's positions who is not on the
 * team yet (board 59): the lead confirms they join once the signed NDA is in.
 */
export type Joining = {
  /** The accepted application: what Confirm join acts on. */
  readonly applicationId: number;
  readonly name: string;
  /** The position they were accepted for: "Mission Analyst". */
  readonly position: string;
  /** "The signed NDA arrived" is ticked on the application: Confirm join waits for it. */
  readonly ndaArrived: boolean;
};

/** A head of the division's department: who a promotion tells (board 59e, ./notices.ts). */
export type DepartmentHead = {
  readonly memberId: number;
  readonly name: string;
  /** "Aerodynamics" */
  readonly department: string;
};

/**
 * Who a viewer's Members page lists: the whole team for the operations lead
 * (board 46), one division for a division lead (boards 59 and 59b), with the
 * people joining it and its department head.
 */
export type MemberDirectory =
  | { readonly scope: "team"; readonly rows: readonly MemberRow[]; readonly departments: readonly string[] }
  | {
      readonly scope: "division";
      readonly division: string;
      readonly rows: readonly MemberRow[];
      readonly joining: readonly Joining[];
      /** The department's heads, the viewer among them when they head it. */
      readonly heads: readonly DepartmentHead[];
      /** The viewer's member id: the lead who would promote. */
      readonly viewerId: number | null;
    };

/** A division lead with nothing to list: no division, nobody joining, no head. */
export const NO_DIVISION: MemberDirectory = { scope: "division", division: "", rows: [], joining: [], heads: [], viewerId: null };

function roleLabelOf(placement: Placement, role: TeamRole, org: OrgChart): string {
  if (placement.role === "board") return BOARD_SEAT_TITLES[placement.seat];
  if (placement.role === "head") {
    const department = org.departments.find((d) => d.id === placement.departmentId);
    return department ? `Head of ${department.name}` : "Head";
  }
  return role === "team-leader" ? "Team Leader" : role === "division-lead" ? "Division Lead" : "Member";
}

const ROLE_ORDER: Readonly<Record<TeamRole, number>> = { "team-leader": 0, board: 1, head: 2, "division-lead": 3, member: 4 };

/**
 * The person's row. Seen from one division (`divisionId`), the row is their
 * place in that division. Seen from the whole team it names their home
 * division (`homeDivision`), as the Members page lists one division per
 * person until #231 lists them all.
 */
export function memberRowOf(entry: RosterEntry, org: OrgChart, selfId: number | null = null, divisionId: number | null = null): MemberRow {
  const memberships = membershipsIn(entry.placement);
  const inDivision = divisionId === null ? null : roleIn(memberships, divisionId);
  const shownDivision = inDivision === null ? homeDivision(memberships) : divisionId;
  const role: TeamRole = inDivision === null ? teamRoleOf(entry.placement) : inDivision === "lead" ? "division-lead" : "member";
  const departmentId =
    entry.placement.role === "head" ? entry.placement.departmentId : (org.divisions.find((d) => d.id === shownDivision)?.departmentId ?? null);
  return {
    id: entry.id,
    name: entry.name,
    email: entry.email,
    role,
    roleLabel: roleLabelOf(entry.placement, role, org),
    department: org.departments.find((d) => d.id === departmentId)?.name ?? null,
    division: org.divisions.find((d) => d.id === shownDivision)?.name ?? null,
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
  joining: readonly Joining[] = [],
): MemberDirectory {
  const division = org.divisions.find((d) => d.id === divisionId);
  // Everyone in the division, each with their role in it, whatever else they are in.
  const rows = roster
    .filter((entry) => isIn(entry.placement, divisionId))
    .map((entry) => memberRowOf(entry, org, selfId, divisionId))
    .sort(byRoleThenName);
  const department = org.departments.find((d) => d.id === division?.departmentId);
  const heads: DepartmentHead[] = department
    ? roster
        .filter((e) => e.placement.role === "head" && e.placement.departmentId === department.id)
        .map((e) => ({ memberId: e.id, name: e.name, department: department.name }))
    : [];
  return { scope: "division", division: division?.name ?? "", rows, joining, heads, viewerId: selfId };
}

// Promote and Move to alumni (boards 59e and 59d)

/**
 * Promote (board 59e): the person leads the division beside the lead, or
 * takes it over and the lead becomes a member of it.
 */
export const PROMOTE_MODES = ["together", "hand-over"] as const;
export type PromoteMode = (typeof PROMOTE_MODES)[number];

export function isPromoteMode(value: unknown): value is PromoteMode {
  return typeof value === "string" && (PROMOTE_MODES as readonly string[]).includes(value);
}

/** Who may be promoted: a member of a division, never a lead or someone not yet placed. */
export function canPromote(row: Pick<MemberRow, "role" | "division" | "self">): boolean {
  return row.role === "member" && row.division !== null && !row.self;
}

/** Why someone left, as the Move to alumni confirm offers it (board 59d). Optional. */
export const LEAVE_REASONS = ["graduated", "studying-abroad", "no-time", "other"] as const;
export type LeaveReason = (typeof LEAVE_REASONS)[number];

export const LEAVE_REASON_LABELS: Readonly<Record<LeaveReason, string>> = {
  graduated: "Graduated",
  "studying-abroad": "Studying abroad",
  "no-time": "No time left",
  other: "Other",
};

/**
 * Moving someone to alumni (board 59d): the years they were on the team, and
 * why they left when the lead says. Their roles end and their access goes;
 * their account stays, so they can still sign in and apply again.
 */
export type Departure = {
  readonly from: number;
  readonly to: number;
  readonly reason: LeaveReason | null;
};

/** The earliest year a Move to alumni accepts. */
export const FIRST_SEASON = 2010;

/** "2024 – 2026" for the years field. */
export function yearsLabel(from: number, to: number): string {
  return from === to ? String(from) : `${from} – ${to}`;
}

/** The years field as the lead typed it: "2024 – 2026", "2024-2026", or one year. */
export function parseYears(text: string): { from: number; to: number } | null {
  const match = /^\s*(\d{4})\s*(?:[-–—]\s*(\d{4}))?\s*$/.exec(text);
  if (!match) return null;
  const from = Number(match[1]);
  return { from, to: match[2] === undefined ? from : Number(match[2]) };
}

/**
 * Checks a Move to alumni request: years in order, none after this year and
 * none before the team's first season; a reason from the list or none. Runs
 * in the browser and again on the server.
 */
export function checkDeparture(
  input: { years: string; reason: string | null },
  thisYear: number,
): { ok: true; value: Departure } | { ok: false; error: string } {
  const years = parseYears(input.years);
  if (years === null) return { ok: false, error: "Write the years like 2024 – 2026." };
  if (years.from > years.to) return { ok: false, error: "The first year comes before the last." };
  if (years.from < FIRST_SEASON || years.to > thisYear) {
    return { ok: false, error: `Use years from ${FIRST_SEASON} to ${thisYear}.` };
  }
  const reason = input.reason === null || input.reason === "" ? null : input.reason;
  if (reason !== null && !(LEAVE_REASONS as readonly string[]).includes(reason)) {
    return { ok: false, error: "Choose a reason from the list." };
  }
  return { ok: true, value: { from: years.from, to: years.to, reason: reason as LeaveReason | null } };
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

// Team tree (boards 54c and 54c-m)

export type TreePerson = {
  readonly id: number;
  readonly name: string;
  /** The viewer: marked "YOU" and on the highlighted path. */
  readonly self: boolean;
  /** The other divisions they are in, as the tree names them; each gets an "also" tag and a dashed line (board 54e). */
  readonly also: readonly { readonly divisionId: number; readonly label: string }[];
};

export type TreeDivision = {
  readonly id: number;
  readonly name: string;
  /** Its lead, when the tree draws them here: a lead whose home is another division is drawn there. */
  readonly lead: TreePerson | null;
  readonly members: readonly TreePerson[];
  /** People in it who are drawn under another division (board 54e): the dashed lines run from here to them. */
  readonly elsewhere: readonly number[];
  /** Everyone in it, lead and people drawn elsewhere included. */
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

/** Someone in a board seat, under the team leader and over the heads. */
export type TreeBoardMember = { readonly seat: BoardSeat; readonly person: TreePerson };

export type TeamTree = {
  /** "2026–27" */
  readonly season: string;
  readonly leader: TreePerson | null;
  /** The Project Manager, then the Chief Engineer: whoever holds each seat. */
  readonly board: readonly TreeBoardMember[];
  readonly departments: readonly TreeDepartment[];
  /** Everyone on the roster. */
  readonly size: number;
  /** The viewer's place, for the highlighted path; null when they are not in a division or department. */
  readonly path: { readonly departmentId: number; readonly divisionId: number | null } | null;
};

/**
 * The tree of this year's roster as `selfId` sees it. Departments and
 * divisions with nobody in them are left out. Each person is drawn once,
 * under their home division (`homeDivision`), and every other division they
 * are in lists them as `elsewhere` (Owner decision, 2026-10-11).
 */
export function buildTeamTree(
  roster: readonly RosterEntry[],
  org: OrgChart,
  season: string,
  selfId: number | null,
): TeamTree {
  const visible = new Set(org.divisions.map((d) => d.id));
  // The home rule over the divisions still open: a closed home division is not drawn.
  const drawnUnder = (entry: RosterEntry): number | null =>
    homeDivision(membershipsOf(membershipsIn(entry.placement).filter((m) => visible.has(m.divisionId))));
  const node = (entry: RosterEntry): TreePerson => {
    const home = drawnUnder(entry);
    const also = membershipsIn(entry.placement).flatMap((m) => {
      const division = org.divisions.find((d) => d.id === m.divisionId);
      return m.divisionId === home || !division ? [] : [{ divisionId: division.id, label: divisionLabel(division.name) }];
    });
    return { id: entry.id, name: entry.name, self: entry.id === selfId, also };
  };
  const byName = (a: RosterEntry, b: RosterEntry) => a.name.localeCompare(b.name);

  const departments = org.departments.flatMap((department): TreeDepartment[] => {
    const head = roster.find((e) => e.placement.role === "head" && e.placement.departmentId === department.id);
    const divisions = org.divisions
      .filter((d) => d.departmentId === department.id)
      .flatMap((division): TreeDivision[] => {
        const inDivision = roster.filter((e) => isIn(e.placement, division.id));
        if (inDivision.length === 0) return [];
        const here = inDivision.filter((e) => drawnUnder(e) === division.id);
        const lead = here.find((e) => roleIn(membershipsIn(e.placement), division.id) === "lead");
        const members = here.filter((e) => e !== lead).sort(byName);
        const elsewhere = inDivision.filter((e) => drawnUnder(e) !== division.id).sort(byName);
        return [
          {
            id: division.id,
            name: division.name,
            lead: lead ? node(lead) : null,
            members: members.map(node),
            elsewhere: elsewhere.map((e) => e.id),
            size: inDivision.length,
          },
        ];
      });
    // Someone in two of its divisions counts once.
    const people = new Set(roster.filter((e) => divisions.some((d) => isIn(e.placement, d.id))).map((e) => e.id));
    const size = (head ? 1 : 0) + people.size;
    return size === 0 ? [] : [{ id: department.id, name: department.name, head: head ? node(head) : null, divisions, size }];
  });

  const leader = roster.find((e) => e.placement.role === "team-leader");
  const board = BOARD_SEATS.flatMap((seat): TreeBoardMember[] => {
    const holder = roster.find((e) => e.placement.role === "board" && e.placement.seat === seat);
    return holder ? [{ seat, person: node(holder) }] : [];
  });
  const me = roster.find((e) => e.id === selfId);
  const myDivision = me ? drawnUnder(me) : null;
  const myDepartment =
    me?.placement.role === "head" ? me.placement.departmentId : (org.divisions.find((d) => d.id === myDivision)?.departmentId ?? null);
  return {
    season,
    leader: leader ? node(leader) : null,
    board,
    departments,
    size: roster.length,
    path: myDepartment !== null ? { departmentId: myDepartment, divisionId: myDivision } : null,
  };
}

/** A division as the tree names it: "Mission Analysis Division" reads "Mission Analysis" (board 54c). */
export function divisionLabel(name: string): string {
  return name.replace(/\s+Division$/i, "");
}
