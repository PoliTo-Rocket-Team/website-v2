// Who may start View as (issue #604, epic #597): open the dashboard in a real
// session as another person, through Better Auth's admin plugin. Owner
// decisions on #597 (2026-10-24): on production only the person who holds
// the IT lead seat now, read from their active roles, so the right follows
// the seat through a hand-over and no per-person flag is stored; on a
// preview and under `next dev`, also any seeded admin tester (a stored
// `user.role` of "admin"). The plugin's own role table is not the authority:
// lib/view-as-plugin.ts asks this rule before every start.

import { SEAT_LABELS } from "./division-access";
import type { RoleType } from "./team";
import { VIEWER_KIND_LABELS, type ActiveRoleRef, type FlaggedSeat } from "./viewer";

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

// The View as banner (issue #611): what every dashboard page of a View as
// session says across its top. The live site and a test site say different
// things (boards 96b and 96c), so each variant carries only what its own line
// names, chosen on the server from the site.

/** The banner of a View as session: the person viewed as, the line under their name, and what the variant's line names. */
export type ViewAsBanner =
  | {
      readonly site: "live";
      readonly name: string;
      readonly role: string;
      /** The acting account's title ("IT lead"), as its changes show ("IT lead as Elif Kaya"). */
      readonly actingTitle: string;
    }
  | {
      readonly site: "test";
      readonly name: string;
      readonly role: string;
      /** The person's first name, as the changes save ("changes save as Elif"). */
      readonly firstName: string;
    };

/** The first name of a shown name, for a person with none stored: its first word. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The banner's line. On the live site (board 96b): "Viewing as Elif Kaya ·
 * Member · changes show as “IT lead as Elif Kaya”". On a preview or under
 * `next dev` (board 96c): "Preview · editing as Elif Kaya · Member · changes
 * save as Elif".
 */
export function viewAsBannerLine(banner: ViewAsBanner): string {
  switch (banner.site) {
    case "live":
      return `Viewing as ${banner.name} · ${banner.role} · changes show as “${banner.actingTitle} as ${banner.name}”`;
    case "test":
      return `Preview · editing as ${banner.name} · ${banner.role} · changes save as ${banner.firstName}`;
  }
}

// The View as dialog (issue #610, board 96): the people it offers and the line
// under each name. It offers only people a start would not refuse, so the
// list never shows a row the server then turns down.

/** The address parameter that opens the dialog over any dashboard page. */
export const VIEW_AS_PARAM = "view-as";

/** How many people one search shows. */
export const VIEW_AS_SHOWN = 8;

/** What the dialog needs to open: the title the acting account's changes show under ("IT lead as Sara Conti"). */
export type ViewAsOpening = { readonly actingTitle: string };

/** One of a person's active roles, as the line under their name reads it. */
export type ViewAsRole = {
  readonly type: RoleType;
  /** The full-access seat the role is flagged as; null for every other role. */
  readonly seat: FlaggedSeat | null;
  readonly startedAt: string;
  /** The division it is in, else the department; null for a role in neither. */
  readonly unitName: string | null;
};

/** Someone with an account, as the search reads them. */
export type ViewAsCandidate = {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly storedRole: string | null;
  readonly roles: readonly ViewAsRole[];
  /** Null when the Alumni record does not know them; else the last year they were on the team, when it is set. */
  readonly alumnus: { readonly teamTo: number | null } | null;
};

/** One row of the dialog: the account to start View as on, its name and the line under it. */
export type ViewAsPerson = {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly photoUrl: string | null;
};

/** What a search answers: the people, or why the dialog is refused. */
export type ViewAsSearch = { readonly kind: "people"; readonly people: readonly ViewAsPerson[] } | { readonly kind: "refused"; readonly message: string };

const RANK: Readonly<Record<NonNullable<RoleType>, number>> = { president: 0, head: 1, lead: 2, core: 3, advisor: 3 };

function rankOf(role: ViewAsRole): number {
  if (role.seat !== null) return 0;
  return role.type === null ? 4 : RANK[role.type];
}

/** What a role makes its holder, as the line names it: the seat, else the role's kind. */
function roleLabelOf(role: ViewAsRole): string {
  if (role.seat !== null) return SEAT_LABELS[role.seat];
  switch (role.type) {
    case "president":
      return SEAT_LABELS["team-leader"];
    case "head":
      return VIEWER_KIND_LABELS["department-head"];
    case "lead":
      return VIEWER_KIND_LABELS["division-lead"];
    case "advisor":
      return "Advisor";
    default:
      return VIEWER_KIND_LABELS.member;
  }
}

/**
 * The line under a name (board 96): their highest role, the oldest of those,
 * with its unit ("Division lead · Ground Station"); a seat names no unit, as
 * it spans the team. Off the team: "Alumni · 2024", else "Non-member".
 */
export function viewAsLineOf(candidate: Pick<ViewAsCandidate, "roles" | "alumnus">): string {
  const [top] = [...candidate.roles].sort((a, b) => rankOf(a) - rankOf(b) || a.startedAt.localeCompare(b.startedAt));
  if (top !== undefined) {
    const label = roleLabelOf(top);
    const isSeat = top.seat !== null || top.type === "president";
    return isSeat || top.unitName === null ? label : `${label} · ${top.unitName}`;
  }
  if (candidate.alumnus !== null) {
    return candidate.alumnus.teamTo === null ? VIEWER_KIND_LABELS.alumni : `${VIEWER_KIND_LABELS.alumni} · ${candidate.alumnus.teamTo}`;
  }
  return VIEWER_KIND_LABELS["non-member"];
}

/**
 * The rows the dialog shows, in the order given: never the acting account,
 * never anyone who could use View as on this site (`viewAsRefusalOf` refuses
 * them), and at most `VIEW_AS_SHOWN`.
 */
export function viewAsPeopleOf(candidates: readonly ViewAsCandidate[], actingAccountId: string, site: ViewAsSite): ViewAsPerson[] {
  return candidates
    .filter((c) => c.id !== actingAccountId)
    .filter((c) => !mayUseViewAs({ storedRole: c.storedRole, activeRoles: c.roles.map((r) => ({ fullAccess: r.seat })) }, site))
    .slice(0, VIEW_AS_SHOWN)
    .map((c) => ({ id: c.id, name: c.name, line: viewAsLineOf(c), photoUrl: c.photoUrl }));
}
