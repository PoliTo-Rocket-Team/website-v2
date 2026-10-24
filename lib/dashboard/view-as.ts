// Who may start View as (issue #604, epic #597): open the dashboard in a real
// session as another person, through Better Auth's admin plugin. Owner
// decisions on #597 (2026-10-24): on production only the person who holds
// the IT lead seat now, read from their active roles, so the right follows
// the seat through a hand-over and no per-person flag is stored; on a
// preview and under `next dev`, also any seeded admin tester (a stored
// `user.role` of "admin"). The plugin's own role table is not the authority:
// lib/view-as-plugin.ts asks this rule before every start.

import type { ActiveRoleRef } from "./viewer";

/**
 * Where the request runs. `live` is production and anything not proven to be
 * a test site; `test` is a Vercel preview, or `next dev` off Vercel. A
 * stored admin role counts only on `test`.
 */
export type ViewAsSite = "live" | "test";

/** The two variables the site is read from. */
export type ViewAsSiteEnv = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
};

function processSiteEnv(): ViewAsSiteEnv {
  return { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
}

/** A preview deploy, or `next dev` with no Vercel deploy, is a test site; everything else reads as live. */
export function viewAsSiteOf(env: ViewAsSiteEnv = processSiteEnv()): ViewAsSite {
  if (env.VERCEL_ENV === "preview") return "test";
  if (!env.VERCEL_ENV && env.NODE_ENV === "development") return "test";
  return "live";
}

/** What decides whether an account may use View as: their active roles, and the role Better Auth stores for them. */
export type ViewAsAccount = {
  readonly activeRoles: readonly Pick<ActiveRoleRef, "fullAccess">[];
  /** `better_auth.user.role`, as stored (a comma-separated list); null when none is. */
  readonly storedRole: string | null;
};

/** Whether one of their active roles is the IT lead seat. A role they left is not active, so a hand-over moves this at once. */
export function holdsItLeadSeat(account: ViewAsAccount): boolean {
  return account.activeRoles.some((r) => r.fullAccess === "it-lead");
}

/** Whether Better Auth stores them as an admin: what a seeded admin tester is. */
export function isAdminTester(account: ViewAsAccount): boolean {
  return (account.storedRole ?? "").split(",").some((role) => role.trim() === "admin");
}

/** Whether the account may start View as on this site: the IT lead seat anywhere, an admin tester on a test site only. */
export function mayUseViewAs(account: ViewAsAccount, site: ViewAsSite): boolean {
  return holdsItLeadSeat(account) || (site === "test" && isAdminTester(account));
}

/** Why a View as start is refused. */
export type ViewAsRefusal = "signed-out" | "already-viewing-as" | "not-allowed" | "same-person" | "no-such-person" | "person-may-view-as";

/** The plain message each refusal answers with. */
export const VIEW_AS_REFUSAL_MESSAGES: Readonly<Record<ViewAsRefusal, string>> = {
  "signed-out": "Sign in to use View as.",
  "already-viewing-as": "Stop viewing as this person before you view as someone else.",
  "not-allowed": "Only the IT lead can use View as.",
  "same-person": "You cannot view as yourself.",
  "no-such-person": "There is no account to view as.",
  "person-may-view-as": "You cannot view as someone who can use View as.",
};

/** A View as start as the server reads it: the acting account, whether its session is already a View as one, and the person asked for. */
export type ViewAsStart = {
  readonly actingAccountId: string;
  readonly acting: ViewAsAccount | null;
  /** The acting session is itself a View as session. */
  readonly viewingAs: boolean;
  readonly personId: string;
  /** Null when no account has that id. */
  readonly person: ViewAsAccount | null;
};

/**
 * Why the start is refused, or null when it may go ahead. Nobody views as
 * from inside a View as session, and nobody is viewed as who could use View
 * as themselves on this site, so one acting account never chains into
 * another's rights.
 */
export function viewAsRefusalOf(start: ViewAsStart, site: ViewAsSite): ViewAsRefusal | null {
  if (start.acting === null) return "signed-out";
  if (start.viewingAs) return "already-viewing-as";
  if (!mayUseViewAs(start.acting, site)) return "not-allowed";
  if (start.personId === start.actingAccountId) return "same-person";
  if (start.person === null) return "no-such-person";
  if (mayUseViewAs(start.person, site)) return "person-may-view-as";
  return null;
}

/** One View as start or stop, as the Activity log records it: the session, the person viewed as and the acting account. */
export type ViewAsEntry = {
  readonly event: "start" | "stop";
  readonly sessionId: string;
  readonly personId: string;
  readonly actingAccountId: string;
};

/** The `logs.operation` each event is written under, beside the row changes the audit trigger writes. */
export const VIEW_AS_OPERATIONS: Readonly<Record<ViewAsEntry["event"], string>> = {
  start: "VIEW_AS_START",
  stop: "VIEW_AS_STOP",
};
