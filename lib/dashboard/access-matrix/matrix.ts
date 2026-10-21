import type { DashboardPageKey } from "../access";
import {
  areaGrantsOf,
  GRANT_AREAS,
  isOffTeam,
  unitRowsOf,
  viewerStandingOf,
  type ActiveRoleRef,
  type AreaGrant,
  type ChangeArea,
  type DivisionUnit,
  type FlaggedSeat,
  type GrantArea,
  type ScopedRole,
  type ScopeUnitRow,
  type ViewerStanding,
} from "../viewer";
import type { RoleType } from "../team";

// The dashboard access matrix (issue #477): every viewer kind against every
// page, every area's reads and changes in every unit, the CV and letter
// links, site content, the recruitment switch and Orders. The matrix is data
// (VIEWERS below). Two suites assert it: ../access-matrix.test.ts against
// each domain rule, cell by cell, and ../access-matrix-server.test.ts by
// calling every loader, server action and file route as each viewer. Each
// viewer is built from active roles and scope rows the way `readIdentity`
// (../database.ts) builds the signed-in account, so a cell is what the
// database side decides.
//
// The rules the matrix encodes (Owner decision, 2026-10-21): grants are
// independent, so no grant implies another area and no grant holder reads
// or acts as a division lead; a grant reaches only the units it names; a
// `team` row on an area is a grant in every open department (`unitRowsOf`).
// Applications data (counts, new markers, quiet lines, interviews, CVs) is
// read only where Applications is (issue #477, scope update).
//
// The org: Aerodynamics (1) holds Mission Analysis (MA, 1) and Optimization
// (OA, 2); Structures (2) holds Design & Manufacturing (DM, 3).

export const UNITS = { MA: { divisionId: 1, departmentId: 1 }, OA: { divisionId: 2, departmentId: 1 }, DM: { divisionId: 3, departmentId: 2 } } as const;
export type Unit = keyof typeof UNITS;
export const ALL: readonly Unit[] = ["MA", "OA", "DM"];
export const AERODYNAMICS: readonly Unit[] = ["MA", "OA"];
export const NONE: readonly Unit[] = [];
export const OPEN_DEPARTMENTS = [1, 2];
export const ORG = [
  { id: 1, name: "Aerodynamics", divisions: [{ id: 1, name: "Mission Analysis" }, { id: 2, name: "Optimization" }] },
  { id: 2, name: "Structures", divisions: [{ id: 3, name: "Design & Manufacturing" }] },
];

export type Role = ScopedRole & ActiveRoleRef;
export const role = (type: RoleType, divisionId: number | null, departmentId: number | null, fullAccess: FlaggedSeat | null = null): Role => ({
  type,
  divisionId,
  departmentId,
  fullAccess,
});
export const MEMBER_ROLE = role("core", 1, 1);

/** One scope row as the `scopes` table stores it. */
export const row = (scope: ScopeUnitRow["scope"], target: ScopeUnitRow["target"], level: "view" | "edit", at: { divisionId?: number; deptId?: number } = {}): ScopeUnitRow => ({
  scope,
  target,
  level,
  divisionId: at.divisionId ?? null,
  deptId: at.deptId ?? null,
});

/** A viewer as the database reads them (`readIdentity`): standing, roles and area grants, and the raw rows and roles they were built from. */
export type Viewer = ViewerStanding & {
  readonly roles: readonly ScopedRole[];
  readonly grants: readonly AreaGrant[];
  /** The active roles as stored, before an alumnus's are dropped. */
  readonly heldRoles: readonly Role[];
  readonly rawRows: readonly ScopeUnitRow[];
  readonly onAlumniRecord: boolean;
  readonly headDepartment: { id: number; name: string } | null;
};

export function viewerOf(roles: readonly Role[], rows: readonly ScopeUnitRow[] = [], onAlumniRecord = false): Viewer {
  const unitRows = unitRowsOf(rows, rows.some((r) => r.scope === "team" && r.target !== "approve_orders") ? OPEN_DEPARTMENTS : []);
  const standing = viewerStandingOf({ scopes: unitRows, activeRoles: roles, onAlumniRecord });
  const offTeam = isOffTeam(standing.kind);
  const head = standing.kind === "department-head" ? roles.find((r) => r.type === "head")?.departmentId ?? null : null;
  return {
    ...standing,
    roles: offTeam ? [] : roles,
    grants: offTeam ? [] : areaGrantsOf(unitRows),
    heldRoles: roles,
    rawRows: rows,
    onAlumniRecord,
    headDepartment: head === null ? null : { id: head, name: ORG.find((d) => d.id === head)!.name },
  };
}

// The matrix ------------------------------------------------------------------

export const TEAM_BASE: readonly DashboardPageKey[] = ["overview", "my-applications", "team-tree", "my-profile"];
export const CONTENT: readonly DashboardPageKey[] = ["projects", "outreach", "partners", "alumni", "faq", "team-page"];
export const LEADING: readonly DashboardPageKey[] = ["positions", "applications", "members", "division-access", "orders"];
export const FULL: readonly DashboardPageKey[] = [...TEAM_BASE, ...LEADING, ...CONTENT];
export const PAGE_OF_AREA: Readonly<Record<GrantArea, DashboardPageKey>> = { positions: "positions", applications: "applications", members: "members", orders: "orders" };
export const CHANGE_AREAS: readonly ChangeArea[] = ["positions", "applications", "members"];

/**
 * One row of the matrix. `pages`: every dashboard page the viewer reaches.
 * `reads`: per area, the units where they read it (its page's rows, the
 * Overview figures, and for Applications every CV and letter link and every
 * figure about applications). `changes`: per area, the units where they
 * change it. `ordersPage`: whether the Orders loader answers a page. Every
 * cell not listed is refused.
 */
export type Expect = {
  readonly pages: readonly DashboardPageKey[];
  readonly reads: Readonly<Record<GrantArea, readonly Unit[]>>;
  readonly changes: Readonly<Record<ChangeArea, readonly Unit[]>>;
  readonly siteContent: boolean;
  readonly switchesRecruitment: boolean;
  readonly ordersPage: boolean;
  readonly wholeTeamMembers: boolean;
};

const nothing = { positions: NONE, applications: NONE, members: NONE, orders: NONE } as const;
const everywhere = (units: readonly Unit[]) => ({ positions: units, applications: units, members: units, orders: units });
const changing = (units: readonly Unit[]) => ({ positions: units, applications: units, members: units });

const FULL_ACCESS: Omit<Expect, "switchesRecruitment"> = {
  pages: FULL,
  reads: everywhere(ALL),
  changes: changing(ALL),
  siteContent: true,
  ordersPage: true,
  wholeTeamMembers: true,
};

export const PLAIN_MEMBER: Expect = {
  pages: TEAM_BASE,
  reads: nothing,
  changes: { positions: NONE, applications: NONE, members: NONE },
  siteContent: false,
  switchesRecruitment: false,
  ordersPage: false,
  wholeTeamMembers: false,
};

/** A member holding one area grant at Can edit over `units`: that area's page and units alone. */
function singleGrant(area: GrantArea, units: readonly Unit[]): Expect {
  return {
    ...PLAIN_MEMBER,
    pages: [...TEAM_BASE, PAGE_OF_AREA[area]],
    reads: { ...nothing, [area]: units },
    changes: { positions: NONE, applications: NONE, members: NONE, ...(area === "orders" ? {} : { [area]: units }) },
    ordersPage: area === "orders",
  };
}

export const SCOPES = {
  division: { at: { divisionId: 1 }, kind: "division", units: ["MA"] },
  department: { at: { deptId: 1 }, kind: "department", units: AERODYNAMICS },
  team: { at: {}, kind: "team", units: ALL },
} as const satisfies Record<string, { at: { divisionId?: number; deptId?: number }; kind: ScopeUnitRow["scope"]; units: readonly Unit[] }>;

export type MatrixRow = { readonly name: string; readonly viewer: Viewer; readonly expect: Expect };

export const VIEWERS: readonly MatrixRow[] = [
  // Full access: the seats by role alone (issues #238, #485), or an org scope row.
  { name: "team leader", viewer: viewerOf([role("president", null, null)]), expect: { ...FULL_ACCESS, switchesRecruitment: true } },
  // Open owner question (see the PR): the database switch needs an org or admin row beside the seat.
  { name: "operations lead", viewer: viewerOf([role("core", null, null, "operations-lead")]), expect: { ...FULL_ACCESS, switchesRecruitment: false } },
  {
    name: "IT lead",
    viewer: viewerOf([role("core", null, null, "it-lead")]),
    expect: { ...FULL_ACCESS, pages: [...FULL, "activity-log"], switchesRecruitment: false },
  },
  // The board seats (issue #485): a flagged role in no unit, the operations lead's expectations.
  { name: "Project Manager", viewer: viewerOf([role(null, null, null, "project-manager")]), expect: { ...FULL_ACCESS, switchesRecruitment: false } },
  { name: "Chief Engineer", viewer: viewerOf([role(null, null, null, "chief-engineer")]), expect: { ...FULL_ACCESS, switchesRecruitment: false } },
  { name: "org-wide editor", viewer: viewerOf([MEMBER_ROLE], [row("org", "all", "edit")]), expect: { ...FULL_ACCESS, switchesRecruitment: true } },
  // A department head: every area in their department, by the role.
  {
    name: "department head",
    viewer: viewerOf([role("head", null, 1)]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...LEADING], reads: everywhere(AERODYNAMICS), changes: changing(AERODYNAMICS), ordersPage: true },
  },
  // A head's grant adds its own area in its own unit, and nothing else (issue #477).
  {
    name: "department head with an Applications grant in DM",
    viewer: viewerOf([role("head", null, 1)], [row("division", "applications", "edit", { divisionId: 3 })]),
    expect: {
      ...PLAIN_MEMBER,
      pages: [...TEAM_BASE, ...LEADING],
      reads: { ...everywhere(AERODYNAMICS), applications: ALL },
      changes: { ...changing(AERODYNAMICS), applications: ALL },
      ordersPage: true,
    },
  },
  // A head's Positions grant elsewhere: the roles there, and no figure about their applications (issue #477).
  {
    name: "department head with a Positions grant in DM",
    viewer: viewerOf([role("head", null, 1)], [row("division", "positions", "edit", { divisionId: 3 })]),
    expect: {
      ...PLAIN_MEMBER,
      pages: [...TEAM_BASE, ...LEADING],
      reads: { ...everywhere(AERODYNAMICS), positions: ALL },
      changes: { ...changing(AERODYNAMICS), positions: ALL },
      ordersPage: true,
    },
  },
  // A division lead: every area in the division they lead.
  {
    name: "division lead",
    viewer: viewerOf([role("lead", 1, 1)]),
    // The Orders loader answers no page to a lead with no Orders row (`ordersScopeOf`): narrower than the sidebar, not a leak.
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...LEADING], reads: everywhere(["MA"]), changes: changing(["MA"]) },
  },
  // The leak #477 fixes: a lead's Positions grant elsewhere opened every area there, CVs included.
  {
    name: "division lead with a Positions grant (Can view) in DM",
    viewer: viewerOf([role("lead", 1, 1)], [row("division", "positions", "view", { divisionId: 3 })]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...LEADING], reads: { ...everywhere(["MA"]), positions: ["MA", "DM"] }, changes: changing(["MA"]) },
  },
  // A lead's grant where they do not lead gives what it gives a member there, and no Access there (Owner decision, #478; #488).
  {
    name: "division lead with a Positions grant (Can edit) in DM",
    viewer: viewerOf([role("lead", 1, 1)], [row("division", "positions", "edit", { divisionId: 3 })]),
    expect: {
      ...PLAIN_MEMBER,
      pages: [...TEAM_BASE, ...LEADING],
      reads: { ...everywhere(["MA"]), positions: ["MA", "DM"] },
      changes: { ...changing(["MA"]), positions: ["MA", "DM"] },
    },
  },
  { name: "member", viewer: viewerOf([MEMBER_ROLE]), expect: PLAIN_MEMBER },
  // Each single grant, at each scope, at Can edit: its own page and units alone.
  ...GRANT_AREAS.flatMap((area) =>
    Object.entries(SCOPES).map(([scope, s]): MatrixRow => ({
      name: `member with a ${area} grant across the ${scope}`,
      viewer: viewerOf([MEMBER_ROLE], [row(s.kind, area, "edit", s.at)]),
      expect: singleGrant(area, s.units),
    })),
  ),
  // A grant at Can view reads and changes nothing.
  {
    name: "member with a Positions grant (Can view) in MA",
    viewer: viewerOf([MEMBER_ROLE], [row("division", "positions", "view", { divisionId: 1 })]),
    expect: { ...singleGrant("positions", ["MA"]), changes: { positions: NONE, applications: NONE, members: NONE } },
  },
  {
    name: "member with site-content access",
    viewer: viewerOf([MEMBER_ROLE], [row("website", "all", "edit")]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...CONTENT], siteContent: true },
  },
  {
    name: "member with Approve orders",
    viewer: viewerOf([MEMBER_ROLE], [row("team", "approve_orders", "edit")]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, "orders"], ordersPage: true },
  },
  // Off the team, every scope row that outlived the roles reaches nothing (issues #201, #477).
  {
    name: "alumnus with scope rows left over",
    viewer: viewerOf([], [row("org", "all", "edit"), row("admin", "all", "edit"), row("division", "all", "edit", { divisionId: 1 }), row("website", "all", "edit"), row("team", "approve_orders", "edit")], true),
    expect: { ...PLAIN_MEMBER, pages: ["overview", "my-alumni", "my-applications", "my-account"] },
  },
  { name: "non-member", viewer: viewerOf([]), expect: { ...PLAIN_MEMBER, pages: ["overview", "my-applications", "my-account"] } },
];

/** What every reach and read answers when nobody is signed in: the dashboard does not open (`dashboardOpening`), so every cell refuses. */
export const SIGNED_OUT: Expect = { ...PLAIN_MEMBER, pages: [] };

/** The units, by name, where `check` holds. */
export const unitsWhere = (check: (unit: DivisionUnit) => boolean): Unit[] => ALL.filter((u) => check(UNITS[u]));
