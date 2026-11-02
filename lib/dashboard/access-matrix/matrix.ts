import type { DashboardPageKey } from "../access";
import {
  areaGrantsOf,
  BREAK_GLASS_STANDING,
  GRANT_AREAS,
  isOffTeam,
  unitRowsOf,
  viewerStandingOf,
  wholeTeamAreasOf,
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
  /** The areas a `team` row grants across the whole team (`wholeTeamAreasOf`, issue #956); none off the team. */
  readonly wholeTeamAreas: readonly GrantArea[];
  /** The areas a `team` row grants at Can edit (`wholeTeamAreasOf`, issue #957); none off the team. */
  readonly wholeTeamEdits: readonly GrantArea[];
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
    wholeTeamAreas: offTeam ? [] : wholeTeamAreasOf(rows),
    wholeTeamEdits: offTeam ? [] : wholeTeamAreasOf(rows, "edit"),
    heldRoles: roles,
    rawRows: rows,
    onAlumniRecord,
    headDepartment: head === null ? null : { id: head, name: ORG.find((d) => d.id === head)!.name },
    breakGlass: false,
  };
}

/** The break-glass admin as `readIdentity` reads it (issue #646): the team leader's standing, from no member row, role or scope row. */
export function breakGlassViewer(): Viewer {
  return { ...BREAK_GLASS_STANDING, roles: [], grants: [], wholeTeamAreas: [], wholeTeamEdits: [], heldRoles: [], rawRows: [], onAlumniRecord: false, headDepartment: null, breakGlass: true };
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
  /** Whether the Members page is the whole team (`opensWholeTeam`): full access, or a Members grant across the whole team (issue #956). */
  readonly wholeTeamMembers: boolean;
  /**
   * Whether the viewer changes Members as the team (`changesAreaAsTeam`, the
   * actor every Members write checks): full access, the team leader, and a
   * whole-team Members grant at Can edit, whatever the holder's role (Owner
   * decision, 2026-11-02, issue #957). The Team tree's structure is not it.
   */
  readonly membersAsTeam: boolean;
  /**
   * Whether the viewer has full access (`isFullAccess`): what the Members
   * export (issue #539), the sign-in email change (issues #741, #864) and the
   * team's structure key on. A whole-team Members grant is not it (issue #956).
   */
  readonly fullAccess: boolean;
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
  membersAsTeam: true,
  fullAccess: true,
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
  membersAsTeam: false,
  fullAccess: false,
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

/** What a division lead of MA reaches by the role alone: every area in MA, and Orders (`ordersScopeOf`, issue #590). */
const LEAD_OF_MA: Expect = { ...PLAIN_MEMBER, aliases: leadsOrHeads(["MA"]), pages: [...TEAM_BASE, ...LEADING], reads: everywhere(["MA"]), changes: changing(["MA"]), ordersPage: true };
/** What the head of Aerodynamics reaches by the role alone: every area in their department. */
const HEAD_OF_AERODYNAMICS: Expect = { ...LEAD_OF_MA, aliases: leadsOrHeads(AERODYNAMICS), reads: everywhere(AERODYNAMICS), changes: changing(AERODYNAMICS) };

/**
 * The viewers a whole-team grant is given to (issue #957): a member, a
 * division lead (MA) and a department head (Aerodynamics), each with what
 * their role reaches without the grant.
 */
export const WHOLE_TEAM_HOLDERS = [
  { who: "member", roles: [MEMBER_ROLE], base: PLAIN_MEMBER },
  { who: "division lead", roles: [role("lead", 1, 1)], base: LEAD_OF_MA },
  { who: "department head", roles: [role("head", null, 1)], base: HEAD_OF_AERODYNAMICS },
] as const satisfies readonly { who: string; roles: readonly Role[]; base: Expect }[];

/**
 * A whole-team grant on one area at one level, on top of what the role
 * reaches (Owner decision, 2026-11-02, issue #957): the area is read in every
 * unit; at Can edit it is changed in every unit, and Members is changed as
 * the team; at Can view nothing changes beyond what the role changes. Every
 * other field is the role's: the grant opens no other area (#471).
 */
function wholeTeamGrant(base: Expect, area: GrantArea, level: "view" | "edit"): Expect {
  const page = PAGE_OF_AREA[area];
  return {
    ...base,
    pages: base.pages.includes(page) ? base.pages : [...base.pages, page],
    reads: { ...base.reads, [area]: ALL },
    changes: level === "edit" && area !== "orders" ? { ...base.changes, [area]: ALL } : base.changes,
    ordersPage: base.ordersPage || area === "orders",
    wholeTeamMembers: area === "members",
    membersAsTeam: area === "members" && level === "edit",
  };
}

/**
 * The whole-team grant rows other rows already cover: a member's at Can edit
 * (each single grant across the team, below), and the Can view rows of
 * issues #577 and #956.
 */
const COVERED_WHOLE_TEAM = new Set([
  ...GRANT_AREAS.map((area) => `member ${area} edit`),
  "member members view",
  "member applications view",
  "division lead members view",
  "department head members view",
]);

/** Every other whole-team grant row (issue #957): each holder, each area, at each level. */
const WHOLE_TEAM_ROWS: readonly MatrixRow[] = WHOLE_TEAM_HOLDERS.flatMap(({ who, roles, base }) =>
  GRANT_AREAS.flatMap((area) =>
    (["view", "edit"] as const).flatMap((level): MatrixRow[] =>
      COVERED_WHOLE_TEAM.has(`${who} ${area} ${level}`)
        ? []
        : [{ name: `${who} with a ${area} grant (Can ${level}) across the team`, viewer: viewerOf(roles, [row("team", area, level)]), expect: wholeTeamGrant(base, area, level) }],
    ),
  ),
);

/** The team leader's row: every page and action of full access, plus deciding orders and asking for, and managing, any unit's alias. */
const TEAM_LEADER: Expect = { ...FULL_ACCESS, aliases: { requests: ALL, manages: ALL, answers: true }, decidesOrders: true };

export const VIEWERS: readonly MatrixRow[] = [
  // Full access: the seats by role alone (issues #238, #485), or an org scope row.
  { name: "team leader", viewer: viewerOf([role("president", null, null)]), expect: TEAM_LEADER },
  // The break-glass admin (issue #646): an account the break-glass setting names, with no member row, reaches what the team
  // leader reaches. Asking for an alias is a team member's act, since the request names its requester, so it asks for none;
  // and it leads or heads no member, so it manages none. It also reaches the Activity log, which the team leader does not
  // (Owner decision on #727).
  {
    name: "break-glass admin",
    viewer: breakGlassViewer(),
    expect: { ...TEAM_LEADER, pages: [...FULL, "activity-log"], aliases: { ...NO_ALIASES, answers: true } },
  },
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
      // A Members grant across the whole team opens the whole team's Members page (issue #956), and at Can edit
      // changes Members as the team (issue #957).
      expect: { ...singleGrant(area, s.units), wholeTeamMembers: area === "members" && s.kind === "team", membersAsTeam: area === "members" && s.kind === "team" },
    })),
  ),
  // The same at Can view (issue #956): the whole team's Members page, and no change on it.
  {
    name: "member with a members grant (Can view) across the team",
    viewer: viewerOf([MEMBER_ROLE], [row("team", "members", "view")]),
    expect: { ...singleGrant("members", ALL), changes: { positions: NONE, applications: NONE, members: NONE }, wholeTeamMembers: true },
  },
  // A lead's or a head's whole-team Members grant opens the whole team's page too (issue #956); at Can view
  // it changes nothing beyond what their role changes.
  {
    name: "division lead with a members grant (Can view) across the team",
    viewer: viewerOf([role("lead", 1, 1)], [row("team", "members", "view")]),
    expect: {
      ...PLAIN_MEMBER,
      aliases: leadsOrHeads(["MA"]),
      pages: [...TEAM_BASE, ...LEADING],
      reads: { ...everywhere(["MA"]), members: ALL },
      changes: changing(["MA"]),
      ordersPage: true,
      wholeTeamMembers: true,
    },
  },
  {
    name: "department head with a members grant (Can view) across the team",
    viewer: viewerOf([role("head", null, 1)], [row("team", "members", "view")]),
    expect: {
      ...PLAIN_MEMBER,
      aliases: leadsOrHeads(AERODYNAMICS),
      pages: [...TEAM_BASE, ...LEADING],
      reads: { ...everywhere(AERODYNAMICS), members: ALL },
      changes: changing(AERODYNAMICS),
      ordersPage: true,
      wholeTeamMembers: true,
    },
  },
  // Every other whole-team grant, for a member, a lead and a head, at each level (Owner decision, 2026-11-02, issue #957):
  // at Can edit it acts as full access within its own area, and only there; at Can view it shows the whole area.
  ...WHOLE_TEAM_ROWS,
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
