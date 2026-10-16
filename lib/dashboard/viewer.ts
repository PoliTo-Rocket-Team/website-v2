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
 * The three seats that hold every access in the dashboard from the role alone
 * (Owner decision, 2026-10-11, issue #238): the team leader, the operations
 * lead and the IT lead. Two things stay apart from full access: deciding
 * orders is the team leader's unless they gave "Approve orders" (./orders.ts),
 * and only the IT lead reaches the Activity log (./access.ts).
 */
export const FULL_ACCESS_SEATS = ["team-leader", "operations-lead", "it-lead"] as const;
export type FullAccessSeat = (typeof FULL_ACCESS_SEATS)[number];

/**
 * The full-access flag a role row carries (`roles.full_access`, drizzle/0018):
 * the operations lead's and the IT lead's seats are marked once in the data,
 * never read from a unit's code or a title. The team leader needs no flag:
 * their role is the `president` type.
 */
export type FlaggedSeat = Exclude<FullAccessSeat, "team-leader">;

/** The seat each `roles.full_access` value flags. */
export const SEAT_OF_FLAG: Readonly<Record<"operations_lead" | "it_lead", FlaggedSeat>> = {
  operations_lead: "operations-lead",
  it_lead: "it-lead",
};

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
  | { readonly kind: Exclude<ViewerKind, OffTeamKind | "operations-lead">; readonly siteContent: boolean; readonly approveOrders: boolean };

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
    default:
      return { kind: viewer.kind, siteContent: viewer.siteContent, approveOrders: viewer.approveOrders };
  }
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

/** "Giulia Rossi" gives "GR"; one word gives its first two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * `scopes.scope`. Once `unitRowsOf` has read the rows, a `team` row left is
 * "Approve orders" (issue #233): it changes no viewer kind and opens the
 * Orders page alone (issue #270).
 */
export type ScopeKind = "admin" | "org" | "department" | "division" | "website" | "team";

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
  readonly scopes: readonly ScopeKind[];
  /** Every role they hold now; none when every role they held has ended. */
  readonly activeRoles: readonly ActiveRoleRef[];
  /**
   * The Alumni record has an entry for them (`alumniOf`, lib/about/alumni-record.ts):
   * read only once they hold no active role, so absent means no entry.
   */
  readonly onAlumniRecord?: boolean;
};

/**
 * The one rule that recognises a full-access seat (issue #238), from the
 * active roles alone, with no scope row: a `president` role is the team
 * leader; a role flagged `operations-lead` or `it-lead` is that seat. A
 * division lead, a department head or a member holds none. Someone in two
 * seats is read as the higher: the team leader, then the IT lead, then the
 * operations lead.
 */
export function fullAccessSeatOf(activeRoles: readonly ActiveRoleRef[]): FullAccessSeat | null {
  if (activeRoles.some((r) => r.type === "president")) return "team-leader";
  if (activeRoles.some((r) => r.fullAccess === "it-lead")) return "it-lead";
  if (activeRoles.some((r) => r.fullAccess === "operations-lead")) return "operations-lead";
  return null;
}

/**
 * A real account's viewer kind, read from all their active roles (issue
 * #229). No member row is a non-member (an applicant). A member row with no
 * active role is off the team, whatever scope rows remain (issue #201): an
 * alumnus when the Alumni record has an entry for them, else a non-member
 * (issue #317). Full access,
 * the `operations-lead` kind, comes from a full-access seat (issue #238) or
 * from an org-wide or admin scope row; a role of type `head` is a department
 * head's (issue #230); a department or division scope, or a lead role in any
 * division, is a division lead's; anyone else on the team is a member.
 */
export function viewerKindOf(access: MemberAccess | null): ViewerKind {
  if (access === null) return "non-member";
  if (access.activeRoles.length === 0) return access.onAlumniRecord === true ? "alumni" : "non-member";
  if (fullAccessSeatOf(access.activeRoles) !== null) return "operations-lead";
  if (access.scopes.some((s) => s === "admin" || s === "org")) return "operations-lead";
  if (access.activeRoles.some((r) => r.type === "head")) return "department-head";
  const leadsSomething = access.activeRoles.some((r) => r.type === "lead");
  if (access.scopes.some((s) => s === "department" || s === "division") || leadsSomething) return "division-lead";
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
 * site-content access from a `website` scope row, and "Approve orders" from a
 * `team` one (`unitRowsOf` leaves no other `team` row).
 */
export function viewerStandingOf(access: MemberAccess | null): ViewerStanding {
  const kind = viewerKindOf(access);
  // Off the team, scope rows that outlived the roles reach nothing (issue #201).
  if (isOffTeam(kind)) return { kind, siteContent: false, approveOrders: false };
  if (access === null) return { kind: "non-member", siteContent: false, approveOrders: false };
  const siteContent = access.scopes.includes("website");
  const approveOrders = access.scopes.includes("team");
  if (kind === "operations-lead") return { kind, seat: fullAccessSeatOf(access.activeRoles), siteContent, approveOrders };
  return { kind, siteContent, approveOrders };
}

/** A scope row as `readIdentity` reads it: which unit it opens. */
export type ScopeUnitRow = {
  readonly scope: ScopeKind;
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
export function unitRowsOf(
  rows: readonly (ScopeUnitRow & { readonly target: string })[],
  openDepartmentIds: readonly number[],
): ScopeUnitRow[] {
  return rows.flatMap((row): ScopeUnitRow[] =>
    row.scope === "team" && row.target !== "approve_orders"
      ? openDepartmentIds.map((deptId) => ({ scope: "department", divisionId: null, deptId }))
      : [{ scope: row.scope, divisionId: row.divisionId, deptId: row.deptId }],
  );
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
