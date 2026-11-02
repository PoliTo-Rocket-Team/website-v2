// Merging an empty second login (issue #907, epic #902). A person who once
// signed in with another Google account holds a second login on this site.
// When they add that Google account in the "Google accounts" section, Better
// Auth refuses it (`account_already_linked_to_different_user`); the section
// then offers the merge. The person signs in with that Google account through
// the same Google sign-in and redirect URI as always, which proves they hold
// it, and a short-lived, single-use merge ticket binds that sign-in to the
// login that asked (lib/google-accounts-plugin.ts). This file holds the rules
// alone: which login may be merged into which, the ticket, and the words each
// outcome shows. ./database-login-merge.ts reads what they need and writes
// what they allow, in one guarded batch.

/** A login as the merge rules read it: its `public.users` row and its sign-in account. */
export type MergeLogin = {
  readonly userId: string;
  /** The row's sign-in email (`users.email`), named in the Activity log entry. */
  readonly email: string;
  /** The member record the row holds; null for an empty login. */
  readonly member: number | null;
  /** Whether the row was closed (`users.deleted_at`). */
  readonly deleted: boolean;
  /** Whether the row waits for Confirm NDA in a division (`team_joins`). */
  readonly waiting: boolean;
  /** Whether its sign-in account is a break-glass one (issue #646). */
  readonly breakGlass: boolean;
  /** The positions the row has an application to that is not withdrawn: one live application per position (`applications_user_position_active`). */
  readonly livePositions: readonly number[];
};

export const LOGIN_MERGE_REFUSALS = [
  "view-as",
  "self",
  "member",
  "break-glass",
  "closed",
  "waiting",
  "same-position",
  "changed",
  "expired",
  "failed",
] as const;
export type LoginMergeRefusal = (typeof LOGIN_MERGE_REFUSALS)[number];

/** The refusal of each kind, in plain words, as the "Google accounts" section shows it. */
export const LOGIN_MERGE_REFUSAL_MESSAGES: Readonly<Record<LoginMergeRefusal, string>> = {
  "view-as": "Logins cannot be merged during View as.",
  self: "That Google account already signs in to this account, so there is nothing to merge. Choose the other Google account at Google.",
  member: "That Google account belongs to another member's login, so it was not merged. Nothing changed.",
  "break-glass": "That login cannot be merged. Nothing changed.",
  closed: "That login was closed, so it cannot be merged. Nothing changed.",
  waiting:
    "That login is waiting to join the team, and this account already holds a member record or a wait of its own, so it was not merged. Nothing changed.",
  "same-position": "Both logins have an open application to the same position. Withdraw one of them first. Nothing changed.",
  changed: "Something changed while the logins were being merged, so nothing was merged. Please try again.",
  expired: "The merge took too long or was started from another session. Nothing changed. Please try again.",
  failed: "Could not merge that login. Nothing changed. Please try again.",
};

/**
 * A merge the rules allow: the empty login `from` goes into the signed-in
 * login `into`. Each side keeps what the plan read of it, which the batch's
 * guard checks again when it writes.
 */
export type LoginMerge = {
  readonly into: { readonly userId: string; readonly member: number | null; readonly waiting: boolean };
  readonly from: { readonly userId: string; readonly email: string; readonly waiting: boolean };
};

export type LoginMergePlan = { readonly kind: "merge"; readonly merge: LoginMerge } | { readonly kind: "refused"; readonly refusal: LoginMergeRefusal };

const refused = (refusal: LoginMergeRefusal): LoginMergePlan => ({ kind: "refused", refusal });

/**
 * Whether the login `from`, which Google just signed in, may be merged into
 * the signed-in login `into`. Only outside View as, never a login into itself,
 * never a break-glass account on either side, never a login that holds a
 * member record (another member's account) or was closed. A login that waits
 * for Confirm NDA moves only onto a login with no member record and no wait
 * of its own, as the sign-in email move does (issue #864). Two open
 * applications to one position cannot share a login, so that refuses too. A
 * side the read could not find refuses as changed.
 */
export function planLoginMerge(into: MergeLogin | null, from: MergeLogin | null, viewingAs: boolean): LoginMergePlan {
  if (viewingAs) return refused("view-as");
  if (into === null || from === null || into.deleted) return refused("changed");
  if (into.userId === from.userId) return refused("self");
  if (into.breakGlass || from.breakGlass) return refused("break-glass");
  if (from.member !== null) return refused("member");
  if (from.deleted) return refused("closed");
  if (from.waiting && (into.member !== null || into.waiting)) return refused("waiting");
  if (from.livePositions.some((position) => into.livePositions.includes(position))) return refused("same-position");
  return {
    kind: "merge",
    merge: {
      into: { userId: into.userId, member: into.member, waiting: into.waiting },
      from: { userId: from.userId, email: from.email, waiting: from.waiting },
    },
  };
}

/** What a merge came to: done, naming the merged login's email, or refused with nothing changed. */
export type LoginMergeOutcome = { readonly kind: "merged"; readonly email: string } | { readonly kind: "refused"; readonly refusal: LoginMergeRefusal };

// The merge ticket ---------------------------------------------------------------------

/** How long a merge ticket holds: the same ten minutes Better Auth gives the Google trip's own state. */
export const MERGE_TICKET_SECONDS = 10 * 60;

/** The key the ticket rides under in the merge's Google sign-in: Better Auth's `additionalData`, kept in the trip's OAuth state. */
export const MERGE_TICKET_STATE_KEY = "googleMergeTicket";

/** The prefix of a ticket's `better_auth.verification` identifier. */
export const MERGE_TICKET_PREFIX = "google-merge:";

/** A merge ticket as stored: the login that asked for it, and until when it holds. */
export type MergeTicket = { readonly userId: string; readonly expiresAt: Date };

/**
 * Whether the ticket binds a Google sign-in to `userId`, the login whose
 * session came back from Google: it was asked for by that login and has not
 * run out. It is taken off the store as it is read, so it holds once.
 */
export function ticketHolds(ticket: MergeTicket | null, userId: string | null, now: Date): boolean {
  return ticket !== null && userId !== null && ticket.userId === userId && ticket.expiresAt.getTime() > now.getTime();
}

/** The login a stored ticket value names, or null when the value is not one this file wrote. */
export function ticketUserOf(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    const userId = typeof parsed === "object" && parsed !== null ? (parsed as { userId?: unknown }).userId : undefined;
    return typeof userId === "string" && userId !== "" ? userId : null;
  } catch {
    return null;
  }
}

// Back on the page ----------------------------------------------------------------------

/** The query parameter the merge's return to the page carries: `merged`, or the refusal. */
export const MERGE_RESULT_PARAM = "google_merge";

/** The value of `MERGE_RESULT_PARAM` for an outcome. */
export function mergeResultValue(outcome: LoginMergeOutcome): string {
  return outcome.kind === "merged" ? "merged" : outcome.refusal;
}

/** `path` with the outcome added to its query, any earlier outcome or error dropped. */
export function withMergeResult(path: string, outcome: LoginMergeOutcome): string {
  const url = new URL(path, "http://merge.invalid");
  url.searchParams.delete("error");
  url.searchParams.set(MERGE_RESULT_PARAM, mergeResultValue(outcome));
  return path.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
}

export const LOGIN_MERGED_MESSAGE = "That login was merged into this account. Its applications and Google accounts are yours now.";

/** What the section says about a merge's return value; null when the value is none this file writes. */
export function mergeResultNotice(value: string | null | undefined): { readonly tone: "done" | "refused"; readonly message: string } | null {
  if (value === "merged") return { tone: "done", message: LOGIN_MERGED_MESSAGE };
  const refusal = LOGIN_MERGE_REFUSALS.find((r) => r === value);
  return refusal === undefined ? null : { tone: "refused", message: LOGIN_MERGE_REFUSAL_MESSAGES[refusal] };
}
