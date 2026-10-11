// Who is looking at the dashboard (issue #141). Every page and the sidebar
// decide what to show from the viewer's kind alone; the access table in
// ./access.ts says which kind reaches which page.

export const VIEWER_KINDS = [
  "operations-lead",
  "department-head",
  "division-lead",
  "member",
  "non-member",
] as const;

export type ViewerKind = (typeof VIEWER_KINDS)[number];

export const VIEWER_KIND_LABELS: Readonly<Record<ViewerKind, string>> = {
  "operations-lead": "Operations lead",
  "department-head": "Department head",
  "division-lead": "Division lead",
  member: "Member",
  "non-member": "Non-member",
};

export function isViewerKind(value: unknown): value is ViewerKind {
  return typeof value === "string" && (VIEWER_KINDS as readonly string[]).includes(value);
}

/**
 * How the viewer signed in, which decides how they sign out. A test developer
 * holds no account and no database session (lib/test-developer.ts).
 */
export type ViewerSession = "account" | "test-developer";

export type DashboardViewer = {
  readonly kind: ViewerKind;
  readonly name: string;
  /** The line under the name in the user card: "Operations Lead", "Member". */
  readonly role: string;
  readonly session: ViewerSession;
};

/** "Giulia Rossi" gives "GR"; one word gives its first two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export type ScopeKind = "admin" | "org" | "department" | "division" | "website";
export type RoleType = "president" | "head" | "lead" | "core";

/** The scope rows and the active role that decide a real member's viewer kind. */
export type MemberAccess = {
  readonly scopes: readonly ScopeKind[];
  /** Their newest active role; null when every role they held has ended. */
  readonly activeRole: { readonly type: RoleType | null } | null;
};

/**
 * A real account's viewer kind. No member row is a non-member (an applicant),
 * and so is a member row with no active role: someone who left or was moved
 * to alumni gets the applicant's pages, whatever scope rows remain (issue
 * #201). Org-wide or admin access is the operations lead's; a role of type
 * `head` is a department head's (issue #230); a department or division
 * scope, or a lead role, is a division lead's; anyone else on the team is a
 * member.
 */
export function viewerKindOf(access: MemberAccess | null): ViewerKind {
  if (access === null || access.activeRole === null) return "non-member";
  if (access.scopes.some((s) => s === "admin" || s === "org")) return "operations-lead";
  const roleType = access.activeRole.type;
  if (roleType === "head") return "department-head";
  if (access.scopes.some((s) => s === "department" || s === "division") || roleType === "lead") return "division-lead";
  return "member";
}

/** A scope row as `readIdentity` reads it: which unit it opens. */
export type ScopeUnitRow = {
  readonly scope: ScopeKind;
  readonly divisionId: number | null;
  readonly deptId: number | null;
};

/** The active role as `readIdentity` reads it: its type, its division, and its department. */
export type ScopedRole = {
  readonly type: RoleType | null;
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
 * What a team member's pages cover (issues #184, #230): the divisions and
 * departments their scope rows name, plus their role's own unit. A lead role
 * adds its division; a head role adds its department, with no `department`
 * scope row needed.
 */
export function viewerUnitsOf(scopeRows: readonly ScopeUnitRow[], role: ScopedRole | null): ViewerUnits {
  const divisionIds = scopeRows.flatMap((s) => (s.scope === "division" && s.divisionId !== null ? [s.divisionId] : []));
  const departmentIds = scopeRows.flatMap((s) => (s.scope === "department" && s.deptId !== null ? [s.deptId] : []));
  if (role?.type === "lead" && role.divisionId !== null) divisionIds.push(role.divisionId);
  if (role?.type === "head" && role.departmentId !== null) departmentIds.push(role.departmentId);
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
