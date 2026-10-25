import type { DashboardPageKey } from "../access";
import {
  areaGrantsOf,
  BREAK_GLASS_STANDING,
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
  type ScopeUnitRow,
  type ViewerStanding,
} from "../viewer";
import type { RecruitmentRole } from "../application-documents";
import type { RoleType } from "../team";

// The dashboard access matrix (issue #477): every viewer kind against every
// page, every area's reads and changes in every unit, the CV and letter
// links, site content (a Content grant, the Alumni page included since issue #589),
// the recruitment switch and Orders. The matrix is data
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

/** Each division's code, as the fixture stores it (./fixture.ts): none is Logistics, so no matrix viewer is the recruitment manager. */
const DIVISION_CODES: Readonly<Record<number, string>> = { 1: "MSA", 2: "OPT", 3: "DMA" };

export type Role = RecruitmentRole & ActiveRoleRef;
export const role = (type: RoleType, divisionId: number | null, departmentId: number | null, fullAccess: FlaggedSeat | null = null): Role => ({
  type,
  divisionId,
  departmentId,
  divisionCode: divisionId === null ? null : (DIVISION_CODES[divisionId] ?? null),
  divisionClosedAt: null,
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
  readonly roles: readonly RecruitmentRole[];
  readonly grants: readonly AreaGrant[];
  /** The active roles as stored, before an alumnus's are dropped. */
  readonly heldRoles: readonly Role[];
  readonly rawRows: readonly ScopeUnitRow[];
  readonly onAlumniRecord: boolean;
  readonly headDepartment: { id: number; name: string } | null;
  /** Whether the break-glass setting names this viewer's sign-in email (issue #646): they then stand as the team leader with no member row. */
  readonly breakGlass: boolean;
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
    breakGlass: false,
  };
}

/** The break-glass admin as `readIdentity` reads it (issue #646): the team leader's standing, from no member row, role or scope row. */
export function breakGlassViewer(): Viewer {
  return { ...BREAK_GLASS_STANDING, roles: [], grants: [], heldRoles: [], rawRows: [], onAlumniRecord: false, headDepartment: null, breakGlass: true };
}

// The matrix ------------------------------------------------------------------

export const TEAM_BASE: readonly DashboardPageKey[] = ["overview", "my-applications", "team-tree", "my-profile"];
/** The editors a Content grant opens (issue #504), the Alumni page among them (Owner decision, 2026-10-22, issue #589). */
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
  /**
   * Email alias requests (epic #538): the units whose member the viewer may
   * request an alias for (Request alias in the drawer and on the server), the
   * units whose member they lead or head (`managesMember`, which also lets
   * them cancel a request they did not send), and whether they answer
   * requests (the Overview rows, Decline and Mark created). Full access asks
   * for anyone on the team (Owner decision, 2026-10-25, issue #721); a lead
   * or a head asks for the members they lead or head; only the team leader,
   * the operations lead and the IT lead answer.
   */
  readonly aliases: { readonly requests: readonly Unit[]; readonly manages: readonly Unit[]; readonly answers: boolean };
  /**
   * Whether they decide orders (`decideRightOf`): the team leader, and anyone
   * holding "Approve orders". Deciding is team-wide, and their Overview says
   * what waits for a decision, whatever its shape (issue #592).
   */
  readonly decidesOrders: boolean;
};

const NO_ALIASES = { requests: NONE, manages: NONE, answers: false } as const;
/** Full access with no lead or head role: asks for anyone (issue #721), manages nobody. */
const FULL_ACCESS_ALIASES = { requests: ALL, manages: NONE, answers: false } as const;
/** The operations lead and the IT lead: full access, and they answer. */
const APPROVER_ALIASES = { ...FULL_ACCESS_ALIASES, answers: true } as const;
/** A lead or a head without full access: asks for, and manages, the members of `units`. */
const leadsOrHeads = (units: readonly Unit[]) => ({ requests: units, manages: units, answers: false });

const nothing = { positions: NONE, applications: NONE, members: NONE, orders: NONE } as const;
const everywhere = (units: readonly Unit[]) => ({ positions: units, applications: units, members: units, orders: units });
const changing = (units: readonly Unit[]) => ({ positions: units, applications: units, members: units });

/** Full access, by any seat or an org or admin row: it includes the recruitment switch (Owner decision, issue #621). */
const FULL_ACCESS: Expect = {
  pages: FULL,
  reads: everywhere(ALL),
  changes: changing(ALL),
  siteContent: true,
  switchesRecruitment: true,
  ordersPage: true,
  wholeTeamMembers: true,
  aliases: FULL_ACCESS_ALIASES,
  decidesOrders: false,
};

export const PLAIN_MEMBER: Expect = {
  pages: TEAM_BASE,
  reads: nothing,
  changes: { positions: NONE, applications: NONE, members: NONE },
  siteContent: false,
  switchesRecruitment: false,
  ordersPage: false,
  wholeTeamMembers: false,
  aliases: NO_ALIASES,
  decidesOrders: false,
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

/** The team leader's row: every page and action of full access, plus deciding orders and asking for, and managing, any unit's alias. */
const TEAM_LEADER: Expect = { ...FULL_ACCESS, aliases: { requests: ALL, manages: ALL, answers: true }, decidesOrders: true };

export const VIEWERS: readonly MatrixRow[] = [
  // Full access: the seats by role alone (issues #238, #485), or an org scope row.
  { name: "team leader", viewer: viewerOf([role("president", null, null)]), expect: TEAM_LEADER },
  // The break-glass admin (issue #646): an account the break-glass setting names, with no member row, reaches what the team
  // leader reaches. Asking for an alias is a team member's act, since the request names its requester, so it asks for none;
  // and it leads or heads no member, so it manages none.
  { name: "break-glass admin", viewer: breakGlassViewer(), expect: { ...TEAM_LEADER, aliases: { ...NO_ALIASES, answers: true } } },
  { name: "operations lead", viewer: viewerOf([role("core", null, null, "operations-lead")]), expect: { ...FULL_ACCESS, aliases: APPROVER_ALIASES } },
  // A full-access seat that is not the team leader decides orders only with Approve orders (issue #592).
  {
    name: "operations lead with Approve orders",
    viewer: viewerOf([role("core", null, null, "operations-lead")], [row("team", "approve_orders", "edit")]),
    expect: { ...FULL_ACCESS, aliases: APPROVER_ALIASES, decidesOrders: true },
  },
  {
    name: "IT lead",
    viewer: viewerOf([role("core", null, null, "it-lead")]),
    expect: { ...FULL_ACCESS, pages: [...FULL, "activity-log"], aliases: APPROVER_ALIASES },
  },
  // The board seats (issue #485): a flagged role in no unit, the operations lead's expectations.
  { name: "Project Manager", viewer: viewerOf([role(null, null, null, "project-manager")]), expect: FULL_ACCESS },
  { name: "Chief Engineer", viewer: viewerOf([role(null, null, null, "chief-engineer")]), expect: FULL_ACCESS },
  { name: "org-wide editor", viewer: viewerOf([MEMBER_ROLE], [row("org", "all", "edit")]), expect: FULL_ACCESS },
  // A department head: every area in their department, by the role.
  {
    name: "department head",
    viewer: viewerOf([role("head", null, 1)]),
    expect: { ...PLAIN_MEMBER, aliases: leadsOrHeads(AERODYNAMICS), pages: [...TEAM_BASE, ...LEADING], reads: everywhere(AERODYNAMICS), changes: changing(AERODYNAMICS), ordersPage: true },
  },
  // Approve orders adds deciding across the team to a head's role, and nothing else (issue #592).
  {
    name: "department head with Approve orders",
    viewer: viewerOf([role("head", null, 1)], [row("team", "approve_orders", "edit")]),
    expect: {
      ...PLAIN_MEMBER,
      aliases: leadsOrHeads(AERODYNAMICS),
      pages: [...TEAM_BASE, ...LEADING],
      reads: everywhere(AERODYNAMICS),
      changes: changing(AERODYNAMICS),
      ordersPage: true,
      decidesOrders: true,
    },
  },
  // A head's grant adds its own area in its own unit, and nothing else (issue #477).
  {
    name: "department head with an Applications grant in DM",
    viewer: viewerOf([role("head", null, 1)], [row("division", "applications", "edit", { divisionId: 3 })]),
    expect: {
      ...PLAIN_MEMBER,
      aliases: leadsOrHeads(AERODYNAMICS),
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
      aliases: leadsOrHeads(AERODYNAMICS),
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
    // A lead's role opens Orders with no Orders row, editing their own division's orders (`ordersScopeOf`, issue #590).
    expect: { ...PLAIN_MEMBER, aliases: leadsOrHeads(["MA"]), pages: [...TEAM_BASE, ...LEADING], reads: everywhere(["MA"]), changes: changing(["MA"]), ordersPage: true },
  },
  // The same for a lead (issue #592).
  {
    name: "division lead with Approve orders",
    viewer: viewerOf([role("lead", 1, 1)], [row("team", "approve_orders", "edit")]),
    expect: {
      ...PLAIN_MEMBER,
      aliases: leadsOrHeads(["MA"]),
      pages: [...TEAM_BASE, ...LEADING],
      reads: everywhere(["MA"]),
      changes: changing(["MA"]),
      ordersPage: true,
      decidesOrders: true,
    },
  },
  // The leak #477 fixes: a lead's Positions grant elsewhere opened every area there, CVs included.
  {
    name: "division lead with a Positions grant (Can view) in DM",
    viewer: viewerOf([role("lead", 1, 1)], [row("division", "positions", "view", { divisionId: 3 })]),
    expect: {
      ...PLAIN_MEMBER,
      aliases: leadsOrHeads(["MA"]),
      pages: [...TEAM_BASE, ...LEADING],
      reads: { ...everywhere(["MA"]), positions: ["MA", "DM"] },
      changes: changing(["MA"]),
      ordersPage: true,
    },
  },
  // A lead's grant where they do not lead gives what it gives a member there, and no Access there (Owner decision, #478; #488).
  {
    name: "division lead with a Positions grant (Can edit) in DM",
    viewer: viewerOf([role("lead", 1, 1)], [row("division", "positions", "edit", { divisionId: 3 })]),
    expect: {
      ...PLAIN_MEMBER,
      aliases: leadsOrHeads(["MA"]),
      pages: [...TEAM_BASE, ...LEADING],
      reads: { ...everywhere(["MA"]), positions: ["MA", "DM"] },
      changes: { ...changing(["MA"]), positions: ["MA", "DM"] },
      ordersPage: true,
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
  // Can edit changes only the unit it names, beside a unit read at Can view (issue #487).
  {
    name: "member with a Positions grant (Can edit) in MA and (Can view) in DM",
    viewer: viewerOf([MEMBER_ROLE], [row("division", "positions", "edit", { divisionId: 1 }), row("division", "positions", "view", { divisionId: 3 })]),
    expect: { ...singleGrant("positions", ["MA", "DM"]), changes: { positions: ["MA"], applications: NONE, members: NONE } },
  },
  // The same for Applications (issue #577): a whole-team grant at Can view
  // moves nothing, and Can edit moves only in the unit it names.
  {
    name: "member with an Applications grant (Can view) across the team",
    viewer: viewerOf([MEMBER_ROLE], [row("team", "applications", "view", {})]),
    expect: { ...singleGrant("applications", ALL), changes: { positions: NONE, applications: NONE, members: NONE } },
  },
  {
    name: "member with an Applications grant (Can edit) in MA and (Can view) in DM",
    viewer: viewerOf([MEMBER_ROLE], [row("division", "applications", "edit", { divisionId: 1 }), row("division", "applications", "view", { divisionId: 3 })]),
    expect: { ...singleGrant("applications", ["MA", "DM"]), changes: { positions: NONE, applications: ["MA"], members: NONE } },
  },
  // The Alumni page is site content (Owner decision, 2026-10-22, issue #589,
  // replacing #504's separate Alumni grant): a Content grant, an edit grant,
  // opens the six editors and their actions, the Alumni page among them. No
  // Can view `website` row is a Content grant, and the old Alumni row (a
  // `website` row on `all`) opens nothing at either level.
  {
    name: "member with a Content grant",
    viewer: viewerOf([MEMBER_ROLE], [row("website", "content", "edit")]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...CONTENT], siteContent: true },
  },
  {
    name: "member with a Can view website row on content",
    viewer: viewerOf([MEMBER_ROLE], [row("website", "content", "view")]),
    expect: PLAIN_MEMBER,
  },
  {
    name: "member with a Can view website row on all",
    viewer: viewerOf([MEMBER_ROLE], [row("website", "all", "view")]),
    expect: PLAIN_MEMBER,
  },
  {
    name: "member with a Can edit website row on all",
    viewer: viewerOf([MEMBER_ROLE], [row("website", "all", "edit")]),
    expect: PLAIN_MEMBER,
  },
  {
    name: "division lead with a Content grant",
    viewer: viewerOf([role("lead", 1, 1)], [row("website", "content", "edit")]),
    expect: { ...PLAIN_MEMBER, aliases: leadsOrHeads(["MA"]), pages: [...TEAM_BASE, ...LEADING, ...CONTENT], reads: everywhere(["MA"]), changes: changing(["MA"]), siteContent: true, ordersPage: true },
  },
  {
    name: "member with Approve orders",
    viewer: viewerOf([MEMBER_ROLE], [row("team", "approve_orders", "edit")]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, "orders"], ordersPage: true, decidesOrders: true },
  },
  // Off the team, every scope row that outlived the roles reaches nothing (issues #201, #477).
  {
    name: "alumnus with scope rows left over",
    viewer: viewerOf(
      [],
      [
        row("org", "all", "edit"),
        row("admin", "all", "edit"),
        row("division", "all", "edit", { divisionId: 1 }),
        row("website", "all", "edit"),
        row("website", "content", "edit"),
        row("team", "approve_orders", "edit"),
      ],
      true,
    ),
    expect: { ...PLAIN_MEMBER, pages: ["overview", "my-alumni", "my-applications", "my-account"] },
  },
  { name: "non-member", viewer: viewerOf([]), expect: { ...PLAIN_MEMBER, pages: ["overview", "my-applications", "my-account"] } },
];

/** What every reach and read answers when nobody is signed in: the dashboard does not open (`dashboardOpening`), so every cell refuses. */
export const SIGNED_OUT: Expect = { ...PLAIN_MEMBER, pages: [] };

/** The units, by name, where `check` holds. */
export const unitsWhere = (check: (unit: DivisionUnit) => boolean): Unit[] => ALL.filter((u) => check(UNITS[u]));
