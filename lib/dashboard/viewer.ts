// Who is looking at the dashboard (issue #141). Every page and the sidebar
// decide what to show from the viewer's standing: their kind, plus the
// site-content access the Alumni page reads (issue #234), plus the "Approve
// orders" grant the Orders page reads (issue #270), plus, for full access,
// which full-access seat they hold (issue #238). Someone off the team is an
// alumnus when the Alumni record knows them, else a non-member (issue #317).
// The access table in ./access.ts says which standing reaches which page.

import { divisionRoleOf, type DivisionRole, type RoleType } from "./team";

export const VIEWER_KINDS = [
  "operations-lead",
  "department-head",
  "division-lead",
  "member",
  "alumni",
  "non-member",
] as const;

export type ViewerKind = (typeof VIEWER_KINDS)[number];

export const VIEWER_KIND_LABELS: Readonly<Record<ViewerKind, string>> = {
  "operations-lead": "Operations lead",
  "department-head": "Department head",
  "division-lead": "Division lead",
  member: "Member",
  alumni: "Alumni",
  "non-member": "Non-member",
};

/** The kinds off the team: they hold no role, so no access (issues #201, #317). */
export type OffTeamKind = "alumni" | "non-member";

export function isOffTeam(kind: ViewerKind): kind is OffTeamKind {
  return kind === "alumni" || kind === "non-member";
}

export function isViewerKind(value: unknown): value is ViewerKind {
  return typeof value === "string" && (VIEWER_KINDS as readonly string[]).includes(value);
}

/**
 * How the viewer signed in, which decides how they sign out. A test developer
 * holds no account and no database session (lib/test-developer.ts).
 */
export const VIEWER_SESSIONS = ["account", "test-developer"] as const;
export type ViewerSession = (typeof VIEWER_SESSIONS)[number];

export function isViewerSession(value: unknown): value is ViewerSession {
  return typeof value === "string" && (VIEWER_SESSIONS as readonly string[]).includes(value);
}

/**
 * The seats that hold every access in the dashboard from the role alone
 * (Owner decision, 2026-10-11, issue #238): the team leader, the operations
 * lead and the IT lead, and since issue #485 the Project Manager and the
 * Chief Engineer. Two things stay apart from full access: deciding orders is
 * the team leader's unless they gave "Approve orders" (./orders.ts), and only
 * the IT lead reaches the Activity log (./access.ts).
 */
export const FULL_ACCESS_SEATS = ["team-leader", "operations-lead", "it-lead", "project-manager", "chief-engineer"] as const;
export type FullAccessSeat = (typeof FULL_ACCESS_SEATS)[number];

/**
 * The full-access flag a role row carries (`roles.full_access`, drizzle/0018,
 * drizzle/0047): every seat but the team leader's is marked on the seat's
 * role row in the data, and the code reads only that flag, never a unit's
 * code or a title. The team leader needs no flag: their role is the
 * `president` type.
 */
export type FlaggedSeat = Exclude<FullAccessSeat, "team-leader">;

/** A `roles.full_access` value, as stored. */
export type SeatFlag = "operations_lead" | "it_lead" | "project_manager" | "chief_engineer";

/** The seat each `roles.full_access` value flags. */
export const SEAT_OF_FLAG: Readonly<Record<SeatFlag, FlaggedSeat>> = {
  operations_lead: "operations-lead",
  it_lead: "it-lead",
  project_manager: "project-manager",
  chief_engineer: "chief-engineer",
};

/** The `roles.full_access` value each seat is stored as: `SEAT_OF_FLAG` read the other way. */
export const FLAG_OF_SEAT: Readonly<Record<FlaggedSeat, SeatFlag>> = {
  "operations-lead": "operations_lead",
  "it-lead": "it_lead",
  "project-manager": "project_manager",
  "chief-engineer": "chief_engineer",
};

/**
 * The areas an area grant opens a dashboard page in (docs/dashboard-rules.md,
 * "Access"): each names the one page it opens to a member (issue #471).
 */
export const GRANT_AREAS = ["positions", "applications", "members", "orders"] as const;
export type GrantArea = (typeof GRANT_AREAS)[number];

/**
 * What decides the dashboard pages a viewer reaches: their kind, and whether
 * they hold site-content access (a `website` scope row) or "Approve orders"
 * (the `team` row on `approve_orders`, issue #270) on top of it. Someone off
 * the team holds neither, whatever scope rows remain (issue #201). Full
 * access is the `operations-lead` kind, and it says which seat gives it:
 * null when an `admin` or `org` scope row gives it and no seat does.
 */
export type ViewerStanding =
  | { readonly kind: OffTeamKind; readonly siteContent: false; readonly approveOrders: false }
  | {
      readonly kind: "operations-lead";
      readonly seat: FullAccessSeat | null;
      readonly siteContent: boolean;
      readonly approveOrders: boolean;
    }
  | { readonly kind: "department-head" | "division-lead"; readonly siteContent: boolean; readonly approveOrders: boolean }
  | {
      readonly kind: "member";
      /**
       * The areas their grants in a division or department name (issues #160,
       * #471), in `GRANT_AREAS` order; none when they hold no grant. Each opens
       * its own page, over the units the grants name, and makes them no
       * division lead. What they may change there follows the grant's area
       * and level (`mayChange`).
       */
      readonly grantedAreas: readonly GrantArea[];
      readonly siteContent: boolean;
      readonly approveOrders: boolean;
    };

/**
 * Who a test developer looks as (issue #141): one of the viewer kinds, the
 * alumnus included (issue #317), or the team leader (issue #247), who has
 * full access like the operations lead but sits in the team leader's seat,
 * so decides orders and gives "Approve orders".
 */
export const TEST_VIEWERS = ["team-leader", ...VIEWER_KINDS] as const;
export type TestViewer = (typeof TEST_VIEWERS)[number];

export const TEST_VIEWER_LABELS: Readonly<Record<TestViewer, string>> = { "team-leader": "Team leader", ...VIEWER_KIND_LABELS };

export function isTestViewer(value: unknown): value is TestViewer {
  return typeof value === "string" && (TEST_VIEWERS as readonly string[]).includes(value);
}

/** The viewer kind a test viewer is: the team leader is full access, the `operations-lead` kind. */
export function kindOfTestViewer(viewer: TestViewer): ViewerKind {
  return viewer === "team-leader" ? "operations-lead" : viewer;
}

/**
 * A test developer holds no scope rows, so their standing is who they look
 * as: the operations-lead test developer sits in the operations lead's seat,
 * the team-leader one in the team leader's. `approveOrders` is whether the
 * person they look as holds "Approve orders" in the dummy data, which the
 * team leader gives on the Access page (issue #270); someone off the team
 * never holds it.
 */
export function testDeveloperStanding(viewer: TestViewer, approveOrders = false): ViewerStanding {
  switch (viewer) {
    case "non-member":
    case "alumni":
      return { kind: viewer, siteContent: false, approveOrders: false };
    case "team-leader":
      return { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders };
    case "operations-lead":
      return { kind: viewer, seat: "operations-lead", siteContent: false, approveOrders };
    case "member":
      return { kind: viewer, grantedAreas: [], siteContent: false, approveOrders };
    default:
      return { kind: viewer, siteContent: false, approveOrders };
  }
}

/** The test viewer a standing shows as in View as: the team leader's seat is its own entry. */
export function testViewerOf(viewer: ViewerStanding): TestViewer {
  return seatOf(viewer) === "team-leader" ? "team-leader" : viewer.kind;
}

/** The standing alone, out of anything that carries one (an identity, a viewer). */
export function standingOf(viewer: ViewerStanding): ViewerStanding {
  switch (viewer.kind) {
    case "non-member":
    case "alumni":
      return { kind: viewer.kind, siteContent: false, approveOrders: false };
    case "operations-lead":
      return { kind: viewer.kind, seat: viewer.seat, siteContent: viewer.siteContent, approveOrders: viewer.approveOrders };
    case "member":
      return { kind: viewer.kind, grantedAreas: viewer.grantedAreas, siteContent: viewer.siteContent, approveOrders: viewer.approveOrders };
    default:
      return { kind: viewer.kind, siteContent: viewer.siteContent, approveOrders: viewer.approveOrders };
  }
}

/**
 * Whether the viewer reads `area`'s pages and data at all (issue #471): full
 * access, a department head and a division lead by their role; a member only
 * on an area their grants name; nobody off the team. Each grant area stands
 * alone: one grant opens no other area, and a granted member never reads as
 * a division lead. What they may change there checks `mayChange`.
 */
export function readsArea(viewer: ViewerStanding, area: GrantArea): boolean {
  switch (viewer.kind) {
    case "operations-lead":
    case "department-head":
    case "division-lead":
      return true;
    case "member":
      return viewer.grantedAreas.includes(area);
    case "alumni":
    case "non-member":
      return false;
  }
}

/** A viewer as an area's reads see them: their standing, their active roles, and each area grant. */
export type AreaReader = ViewerStanding & {
  readonly roles: readonly ScopedRole[];
  readonly grants: readonly AreaGrant[];
};

/**
 * The units where the viewer reads `area` (issues #471, #477): the units
 * their grants on that area (or on every area) name, plus, for a head or a
 * lead, the units their roles lead (`viewerUnitsOf`); none for anyone who
 * does not read the area. A grant on another area adds no unit here, for a
 * lead or a head as for a member: no grant opens another area. Full access
 * reads it everywhere (`readsAreaIn`), whatever units it names.
 */
export function areaUnitsOf(viewer: AreaReader, area: GrantArea): ViewerUnits {
  if (!readsArea(viewer, area)) return { divisionIds: [], departmentIds: [] };
  const onArea = viewer.grants.filter((g) => g.target === area || g.target === "all");
  const byRole = viewer.kind === "member" ? { divisionIds: [], departmentIds: [] } : viewerUnitsOf([], viewer.roles);
  return {
    divisionIds: [...new Set([...byRole.divisionIds, ...onArea.flatMap((g) => (g.unit.kind === "division" ? [g.unit.divisionId] : []))])],
    departmentIds: [...new Set([...byRole.departmentIds, ...onArea.flatMap((g) => (g.unit.kind === "department" ? [g.unit.departmentId] : []))])],
  };
}

/** Whether the viewer reads `area` in one division: full access everywhere, anyone else where `areaUnitsOf` covers it. */
export function readsAreaIn(viewer: AreaReader, area: GrantArea, unit: DivisionUnit): boolean {
  if (!readsArea(viewer, area)) return false;
  if (viewer.kind === "operations-lead") return true;
  const units = areaUnitsOf(viewer, area);
  return units.divisionIds.includes(unit.divisionId) || units.departmentIds.includes(unit.departmentId);
}

/**
 * The areas a member's `division` and `department` scope rows grant (issue
 * #471), in `GRANT_AREAS` order: a row on one of them grants it, and a row on
 * `all` grants every one. A row of any other kind grants none.
 */
export function grantedAreasOf(scopes: readonly ScopeRef[]): GrantArea[] {
  const targets = scopes.flatMap((s) => (s.scope === "division" || s.scope === "department" ? [s.target] : []));
  return GRANT_AREAS.filter((area) => targets.includes("all") || targets.includes(area));
}

/** The full-access seat the viewer holds; null for anyone else, and for full access from a scope row alone. */
export function seatOf(viewer: ViewerStanding): FullAccessSeat | null {
  return viewer.kind === "operations-lead" ? viewer.seat : null;
}

/** Whether the viewer is the team leader: the one who decides orders by default (`decideRightOf`, ./orders.ts). */
export function isTeamLeader(viewer: ViewerStanding): boolean {
  return seatOf(viewer) === "team-leader";
}

export type DashboardViewer = ViewerStanding & {
  readonly name: string;
  /** The line under the name in the user card: "Operations Lead", "Member". */
  readonly role: string;
  readonly session: ViewerSession;
};

/**
 * The line under the name on the user card. Someone off the team reads
 * "Alumni" (board 56), or "Applicant" while an application of theirs is
 * shown, else "Signed in" (boards 50e, 50f); the team reads their role's title.
 */
export function userCardRole(viewer: DashboardViewer, hasShownApplications: boolean): string {
  switch (viewer.kind) {
    case "alumni":
      return VIEWER_KIND_LABELS.alumni;
    case "non-member":
      return hasShownApplications ? "Applicant" : "Signed in";
    default:
      return viewer.role;
  }
}

/**
 * `scopes.scope`. Once `unitRowsOf` has read the rows, a `team` row left is
 * "Approve orders" (issue #233): it changes no viewer kind and opens the
 * Orders page alone (issue #270).
 */
export type ScopeKind = "admin" | "org" | "department" | "division" | "website" | "team";

/** `scopes.target`: the area a row is on; `all` covers every area. */
export type ScopeTarget = "all" | "positions" | "applications" | "members" | "orders" | "faq" | "blog" | "logs" | "approve_orders";

/** `scopes.access_level`: Can view or Can edit (docs/dashboard-rules.md, "Access"). */
export type AccessLevel = "view" | "edit";

/** One scope row as the viewer reads it: its kind, its area and its level. */
export type ScopeRef = {
  readonly scope: ScopeKind;
  readonly target: ScopeTarget;
  readonly level: AccessLevel;
};

/** One of a member's active roles, as the viewer reads it. */
export type ActiveRoleRef = {
  readonly type: RoleType;
  /** The division it is in; null for a role in no division. */
  readonly divisionId: number | null;
  /** The full-access seat the role is flagged as; null for every other role. */
  readonly fullAccess: FlaggedSeat | null;
};

/** The scope rows and every active role that decide a real member's viewer kind. */
export type MemberAccess = {
  readonly scopes: readonly ScopeRef[];
  /** Every role they hold now; none when every role they held has ended. */
  readonly activeRoles: readonly ActiveRoleRef[];
  /**
   * The Alumni record has an entry for them (`alumniOf`, lib/about/alumni-record.ts):
   * read only once they hold no active role, so absent means no entry.
   */
  readonly onAlumniRecord?: boolean;
};

/**
 * The flagged seats, highest first: the IT lead, the operations lead, the
 * Project Manager, then the Chief Engineer (issue #485). It decides only which
 * seat shows for someone who holds two; the newer seats rank last, so no
 * earlier seat holder's seat changes.
 */
const SEAT_PRECEDENCE: readonly FlaggedSeat[] = ["it-lead", "operations-lead", "project-manager", "chief-engineer"];

/**
 * The one rule that recognises a full-access seat (issue #238), from the
 * active roles alone, with no scope row: a `president` role is the team
 * leader; a role flagged with a seat (`FlaggedSeat`) is that seat. A division
 * lead, a department head or a member holds none. Someone in two seats is
 * read as the higher, in `SEAT_PRECEDENCE` order.
 */
export function fullAccessSeatOf(activeRoles: readonly ActiveRoleRef[]): FullAccessSeat | null {
  if (activeRoles.some((r) => r.type === "president")) return "team-leader";
  return SEAT_PRECEDENCE.find((seat) => activeRoles.some((r) => r.fullAccess === seat)) ?? null;
}

/**
 * A real account's viewer kind, read from all their active roles (issue
 * #229). No member row is a non-member (an applicant). A member row with no
 * active role is off the team, whatever scope rows remain (issue #201): an
 * alumnus when the Alumni record has an entry for them, else a non-member
 * (issue #317). Full access,
 * the `operations-lead` kind, comes from a full-access seat (issue #238) or
 * from an org-wide or admin scope row; a role of type `head` is a department
 * head's (issue #230); a lead role in any division is a division lead's;
 * anyone else on the team is a member. A department or division scope row is
 * an area grant, at any area and level: it makes nobody a division lead
 * (issue #160).
 */
export function viewerKindOf(access: MemberAccess | null): ViewerKind {
  if (access === null) return "non-member";
  if (access.activeRoles.length === 0) return access.onAlumniRecord === true ? "alumni" : "non-member";
  if (fullAccessSeatOf(access.activeRoles) !== null) return "operations-lead";
  if (access.scopes.some((s) => s.scope === "admin" || s.scope === "org")) return "operations-lead";
  if (access.activeRoles.some((r) => r.type === "head")) return "department-head";
  if (access.activeRoles.some((r) => r.type === "lead")) return "division-lead";
  return "member";
}

/**
 * What the viewer is in one division, by the rule the Team pages place
 * people with (`divisionRoleOf`, ./team.ts): a lead where they hold a lead or
 * head role in it, a member where they hold any other role in it, null where
 * they hold none. Someone who leads division A and is a member of division B
 * is a lead for A and a member for B.
 */
export function standingIn(access: MemberAccess, divisionId: number): DivisionRole | null {
  const here = access.activeRoles.filter((r) => r.divisionId === divisionId);
  if (here.length === 0) return null;
  return here.some((r) => divisionRoleOf(r.type) === "lead") ? "lead" : "member";
}

/** Every division the viewer leads by role, in the order their roles come. */
export function ledDivisionIds(access: MemberAccess): number[] {
  const ids = access.activeRoles.flatMap((r) => (r.divisionId !== null && standingIn(access, r.divisionId) === "lead" ? [r.divisionId] : []));
  return [...new Set(ids)];
}

/**
 * A real account's standing: its viewer kind, its full-access seat,
 * site-content access from a `website` scope row, "Approve orders" from a
 * `team` one (`unitRowsOf` leaves no other `team` row), and, for a member,
 * the areas their `division` and `department` rows grant (`grantedAreasOf`).
 */
export function viewerStandingOf(access: MemberAccess | null): ViewerStanding {
  const kind = viewerKindOf(access);
  // Off the team, scope rows that outlived the roles reach nothing (issue #201).
  if (isOffTeam(kind)) return { kind, siteContent: false, approveOrders: false };
  if (access === null) return { kind: "non-member", siteContent: false, approveOrders: false };
  const siteContent = access.scopes.some((s) => s.scope === "website");
  const approveOrders = access.scopes.some((s) => s.scope === "team");
  if (kind === "operations-lead") return { kind, seat: fullAccessSeatOf(access.activeRoles), siteContent, approveOrders };
  if (kind === "member") return { kind, grantedAreas: grantedAreasOf(access.scopes), siteContent, approveOrders };
  return { kind, siteContent, approveOrders };
}

/** A scope row as `readIdentity` reads it: which unit it opens, on which area, at which level. */
export type ScopeUnitRow = ScopeRef & {
  readonly divisionId: number | null;
  readonly deptId: number | null;
};

/**
 * The scope rows as the units they open (issue #247). A `team` row on an
 * area is a grant across the whole team, so it stands for a `department` row
 * in every open department: it opens that area's pages there, and in any
 * department opened later. The other `team` row, "Approve orders", is in no
 * unit and stays as it is (it opens the Orders page, issue #270); so does
 * every other row.
 */
export function unitRowsOf(rows: readonly ScopeUnitRow[], openDepartmentIds: readonly number[]): ScopeUnitRow[] {
  return rows.flatMap((row): ScopeUnitRow[] =>
    row.scope === "team" && row.target !== "approve_orders"
      ? openDepartmentIds.map((deptId) => ({ scope: "department", target: row.target, level: row.level, divisionId: null, deptId }))
      : [{ scope: row.scope, target: row.target, level: row.level, divisionId: row.divisionId, deptId: row.deptId }],
  );
}

/**
 * An area grant (docs/dashboard-rules.md, "Access"): one area at one level, in
 * one division or across one department. A `team` row on an area reaches here
 * as a grant in every open department (`unitRowsOf`).
 */
export type AreaGrant = {
  readonly target: ScopeTarget;
  readonly level: AccessLevel;
  readonly unit: { readonly kind: "division"; readonly divisionId: number } | { readonly kind: "department"; readonly departmentId: number };
};

/** The area grants among the scope rows: each `division` or `department` row that names its unit. */
export function areaGrantsOf(rows: readonly ScopeUnitRow[]): AreaGrant[] {
  return rows.flatMap((row): AreaGrant[] => {
    if (row.scope === "division" && row.divisionId !== null) {
      return [{ target: row.target, level: row.level, unit: { kind: "division", divisionId: row.divisionId } }];
    }
    if (row.scope === "department" && row.deptId !== null) {
      return [{ target: row.target, level: row.level, unit: { kind: "department", departmentId: row.deptId } }];
    }
    return [];
  });
}

/** The areas whose changes `mayChange` decides: the recruitment pages' (issue #160) and the Members page's (issue #342). */
export type ChangeArea = "positions" | "applications" | "members";

/** The division a change lands in, with its department. */
export type DivisionUnit = {
  readonly divisionId: number;
  readonly departmentId: number;
};

/** What decides whether a viewer may change an area in a division: their kind, active roles and area grants. */
export type ChangeAuthority = {
  readonly kind: ViewerKind;
  readonly roles: readonly ScopedRole[];
  readonly grants: readonly AreaGrant[];
};

/**
 * Whether the viewer may change `area` in the division (issues #160, #342): full
 * access anywhere; a lead role in the division or a head role over its
 * department; else a grant on that area (or on every area) at Can edit that
 * covers the division. A grant at Can view, or on another area, shows the
 * page and changes nothing (docs/dashboard-rules.md, "Access").
 */
export function mayChange(authority: ChangeAuthority, area: ChangeArea, unit: DivisionUnit): boolean {
  if (authority.kind === "operations-lead") return true;
  if (isOffTeam(authority.kind)) return false;
  const byRole = authority.roles.some(
    (r) =>
      (r.divisionId === unit.divisionId && divisionRoleOf(r.type) === "lead") ||
      (r.type === "head" && r.departmentId === unit.departmentId),
  );
  if (byRole) return true;
  return authority.grants.some((g) => (g.target === area || g.target === "all") && g.level === "edit" && grantCovers(g, unit));
}

/** Whether the grant's unit is the division, or the department it is in. */
function grantCovers(grant: AreaGrant, unit: DivisionUnit): boolean {
  return grant.unit.kind === "division" ? grant.unit.divisionId === unit.divisionId : grant.unit.departmentId === unit.departmentId;
}

/** An active role as `readIdentity` reads it: its type, its division, and its department. */
export type ScopedRole = {
  readonly type: RoleType;
  readonly divisionId: number | null;
  /** `roles.dept_id`, or the department of the role's division when that is null. */
  readonly departmentId: number | null;
};

/** The divisions and departments a viewer's figures and pages cover. */
export type ViewerUnits = {
  readonly divisionIds: readonly number[];
  readonly departmentIds: readonly number[];
};

/**
 * What a team member's pages cover (issues #184, #229, #230): the divisions
 * and departments their scope rows name, plus each active role's own unit. A
 * role that leads its division (`divisionRoleOf`) adds that division; a head
 * role adds its department, with no `department` scope row needed.
 */
export function viewerUnitsOf(scopeRows: readonly ScopeUnitRow[], roles: readonly ScopedRole[]): ViewerUnits {
  const divisionIds = scopeRows.flatMap((s) => (s.scope === "division" && s.divisionId !== null ? [s.divisionId] : []));
  const departmentIds = scopeRows.flatMap((s) => (s.scope === "department" && s.deptId !== null ? [s.deptId] : []));
  for (const role of roles) {
    if (role.divisionId !== null && divisionRoleOf(role.type) === "lead") divisionIds.push(role.divisionId);
    if (role.type === "head" && role.departmentId !== null) departmentIds.push(role.departmentId);
  }
  return { divisionIds: [...new Set(divisionIds)], departmentIds: [...new Set(departmentIds)] };
}

/**
 * Every division the viewer's units cover (issue #351): each division they
 * name, in their order, then each division of a department they name. A grant
 * across a whole department reaches every division of it, so a page that
 * lists divisions finds them all.
 */
export function coveredDivisionIds(
  units: ViewerUnits,
  divisions: readonly { readonly id: number; readonly departmentId: number | null }[],
): number[] {
  const inDepartments = divisions.flatMap((d) => (d.departmentId !== null && units.departmentIds.includes(d.departmentId) ? [d.id] : []));
  return [...new Set([...units.divisionIds, ...inDepartments])];
}

/** A division as the org tables hold it. */
export type OrgDivisionRow = {
  readonly id: number;
  readonly name: string;
  readonly departmentId: number | null;
  /** `divisions.closed_at`; null while the division is open. */
  readonly closedAt: string | null;
};

/**
 * The divisions a department head sees (issue #230): every open division of
 * their department, by name, and none from another department.
 */
export function headDivisionsOf<D extends OrgDivisionRow>(departmentId: number, divisions: readonly D[]): D[] {
  return divisions
    .filter((d) => d.departmentId === departmentId && d.closedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
