// Who is looking at the dashboard (issue #141). Every page and the sidebar
// decide what to show from the viewer's standing: their kind, plus the
// site-content access the Alumni page reads (issue #234). The access table in
// ./access.ts says which standing reaches which page.

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

/** The scope rows and the active role that decide a real member's viewer kind. */
export type MemberAccess = {
  readonly scopes: readonly ("admin" | "org" | "department" | "division" | "website")[];
  /** Their newest active role; null when every role they held has ended. */
  readonly activeRole: { readonly type: "president" | "head" | "lead" | "core" | null } | null;
};

/**
 * A real account's viewer kind. No member row is a non-member (an applicant),
 * and so is a member row with no active role: someone who left or was moved
 * to alumni gets the applicant's pages, whatever scope rows remain (issue
 * #201). Org-wide or admin access is the operations lead's; a department or
 * division scope, or a lead role, is a division lead's; anyone else on the
 * team is a member.
 */
export function viewerKindOf(access: MemberAccess | null): ViewerKind {
  if (access === null || access.activeRole === null) return "non-member";
  if (access.scopes.some((s) => s === "admin" || s === "org")) return "operations-lead";
  const roleType = access.activeRole.type;
  if (access.scopes.some((s) => s === "department" || s === "division") || roleType === "lead" || roleType === "head") {
    return "division-lead";
  }
  return "member";
}

/** A real account's standing: its viewer kind, and site-content access from a `website` scope row. */
export function viewerStandingOf(access: MemberAccess | null): ViewerStanding {
  const kind = viewerKindOf(access);
  if (kind === "non-member") return { kind, siteContent: false };
  return { kind, siteContent: access?.scopes.includes("website") ?? false };
}
