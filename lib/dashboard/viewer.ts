// Who is looking at the dashboard (issue #141). Every page and the sidebar
// decide what to show from the viewer's standing: their kind, plus the
// site-content access the Alumni page reads (issue #234). The access table in
// ./access.ts says which standing reaches which page.

import { divisionRoleOf, type DivisionRole, type RoleType } from "./team";

export const VIEWER_KINDS = [
  "operations-lead",
  "division-lead",
  "member",
  "non-member",
] as const;

export type ViewerKind = (typeof VIEWER_KINDS)[number];

export const VIEWER_KIND_LABELS: Readonly<Record<ViewerKind, string>> = {
  "operations-lead": "Operations lead",
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

/**
 * What decides the dashboard pages a viewer reaches: their kind, and whether
 * they hold site-content access (a `website` scope row) on top of it. Someone
 * off the team holds none, whatever scope rows remain (issue #201).
 */
export type ViewerStanding =
  | { readonly kind: "non-member"; readonly siteContent: false }
  | { readonly kind: Exclude<ViewerKind, "non-member">; readonly siteContent: boolean };

/** A test developer holds no scope rows, so their standing is their kind alone. */
export function testDeveloperStanding(kind: ViewerKind): ViewerStanding {
  return { kind, siteContent: false };
}

export type DashboardViewer = ViewerStanding & {
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

/** One of a member's active roles, as the viewer reads it. */
export type ActiveRoleRef = {
  readonly type: RoleType;
  /** The division it is in; null for a role in no division. */
  readonly divisionId: number | null;
};

/** The scope rows and every active role that decide a real member's viewer kind. */
export type MemberAccess = {
  readonly scopes: readonly ("admin" | "org" | "department" | "division" | "website")[];
  /** Every role they hold now; none when every role they held has ended. */
  readonly activeRoles: readonly ActiveRoleRef[];
};

/**
 * A real account's viewer kind, read from all their active roles (issue
 * #229). No member row is a non-member (an applicant), and so is a member row
 * with no active role: someone who left or was moved to alumni gets the
 * applicant's pages, whatever scope rows remain (issue #201). Org-wide or
 * admin access is the operations lead's; a department or division scope, or a
 * lead or head role in any division, is a division lead's; anyone else on the
 * team is a member.
 */
export function viewerKindOf(access: MemberAccess | null): ViewerKind {
  if (access === null || access.activeRoles.length === 0) return "non-member";
  if (access.scopes.some((s) => s === "admin" || s === "org")) return "operations-lead";
  const leadsSomething = access.activeRoles.some((r) => r.type === "lead" || r.type === "head");
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

/** A real account's standing: its viewer kind, and site-content access from a `website` scope row. */
export function viewerStandingOf(access: MemberAccess | null): ViewerStanding {
  const kind = viewerKindOf(access);
  if (kind === "non-member") return { kind, siteContent: false };
  return { kind, siteContent: access?.scopes.includes("website") ?? false };
}
