// Linked Google accounts (issue #906, epic #902): a person may sign in to
// their one login with several Google accounts, and adds or removes them
// in the "Google accounts" section of My profile and My account. This file
// holds the rules alone, apart from Better Auth: who may add or remove which
// account, the words a refusal shows, and the Activity log entry each change
// writes. lib/google-accounts-plugin.ts asks these rules before Better Auth
// links or unlinks anything; the section asks the same rules which rows offer
// Remove.
//
// View as shows a person exactly the page their own session shows (issue
// #653), so the section draws the same buttons in both; inside View as the
// server refuses the change itself, and the section shows that refusal.

import { mergeResultNotice } from "./login-merge";

/** One Google account linked to a login, as `better_auth.account` stores it. Never any token. */
export type LinkedGoogleAccount = {
  /** The account row's own id. */
  readonly id: string;
  /** Google's id for the account (`accountId`): what Better Auth's unlink names. */
  readonly googleId: string;
  /** The Google account's email; null only on a row no sign-in or backfill has filled. */
  readonly email: string | null;
};

/** What a change is judged against: the signed-in login's linked Google accounts, and whether the session is a View as one. */
export type GoogleAccountsState = {
  readonly accounts: readonly LinkedGoogleAccount[];
  /** Inside View as nothing is added or removed: no linking for another person. */
  readonly viewingAs: boolean;
};

/** A change the person asks for: add one more Google account, or remove one of theirs by Google's id. */
export type GoogleAccountChange = { readonly kind: "link" } | { readonly kind: "remove"; readonly googleId: string };

export const GOOGLE_ACCOUNT_REFUSALS = ["view-as", "not-yours", "last"] as const;
export type GoogleAccountRefusal = (typeof GOOGLE_ACCOUNT_REFUSALS)[number];

export const GOOGLE_ACCOUNT_REFUSAL_MESSAGES: Readonly<Record<GoogleAccountRefusal, string>> = {
  "view-as": "Google accounts cannot be added or removed during View as.",
  "not-yours": "That Google account is not linked to your account.",
  last: "You cannot remove your last Google account: you sign in with it.",
};

/**
 * Why the change is refused, or null when it may go ahead. Only the signed-in
 * person changes their own accounts, never inside View as; a removal names
 * one of their own accounts, and never the last one, since Google is the only
 * way to sign in (issue #118).
 */
export function googleAccountRefusal(change: GoogleAccountChange, state: GoogleAccountsState): GoogleAccountRefusal | null {
  if (state.viewingAs) return "view-as";
  if (change.kind === "link") return null;
  if (!state.accounts.some((account) => account.googleId === change.googleId)) return "not-yours";
  return state.accounts.length > 1 ? null : "last";
}

/**
 * Whether the section offers Remove on this account's row: on any of the
 * person's accounts but the last. Whether the session is a View as one is not
 * asked here (issue #653); the server refuses that.
 */
export function mayRemove(accounts: readonly LinkedGoogleAccount[], account: LinkedGoogleAccount): boolean {
  return googleAccountRefusal({ kind: "remove", googleId: account.googleId }, { accounts, viewingAs: false }) === null;
}

// What other viewers see (issue #908) ------------------------------------------------

/**
 * Each listed member's linked Google emails beside their sign-in email, by
 * member id: what the member panel and Edit details on Members show and what
 * the Members search matches. A member with none is absent. Read only for the
 * members a viewer's Members page lists, so it reaches exactly the viewers
 * who see member emails, and no one else.
 */
export type MemberGoogleEmails = Readonly<Record<number, readonly string[]>>;

export const NO_GOOGLE_EMAILS: MemberGoogleEmails = {};

/** One login of a member, as the read finds it: the email it signs in with and its linked Google accounts. */
export type MemberLogin = {
  readonly memberId: number;
  readonly signInEmail: string;
  readonly accounts: readonly Pick<LinkedGoogleAccount, "email">[];
};

/**
 * The linked Google emails each member signs in with besides their sign-in
 * email, oldest first, each once in any letter case. The sign-in email itself
 * stays the one address it always was and is never repeated in the list; an
 * account whose email is still unknown is left out.
 */
export function memberGoogleEmailsOf(logins: readonly MemberLogin[]): MemberGoogleEmails {
  const out: Record<number, string[]> = {};
  for (const login of logins) {
    const listed = out[login.memberId] ?? [];
    const seen = new Set([login.signInEmail, ...listed].map((e) => e.trim().toLowerCase()));
    for (const { email } of login.accounts) {
      const key = email?.trim().toLowerCase() ?? "";
      if (email === null || key === "" || seen.has(key)) continue;
      seen.add(key);
      listed.push(email.trim());
    }
    if (listed.length > 0) out[login.memberId] = listed;
  }
  return out;
}

// Coming back from Google ----------------------------------------------------------

/** Better Auth's error code when the added Google account already signs in to another login: the case the merge answers (issue #907). */
export const HELD_BY_ANOTHER_LOGIN = "account_already_linked_to_different_user";

/**
 * What the section says when Google sends the person back with an error code
 * (Better Auth's `error` query value). A Google account another login holds
 * is not added; the section then offers to merge that login (./login-merge.ts).
 */
const LINK_ERRORS: Readonly<Record<string, string>> = {
  [HELD_BY_ANOTHER_LOGIN]:
    "That Google account already has its own login on this site, so it was not added. If that login is yours and holds no member record, merge it into this account: you sign in with that Google account once more to confirm.",
  access_denied: "Adding the Google account was cancelled.",
};

export const LINK_FAILED = "Could not add that Google account. Please try again.";

/** The message for an error code on return from Google; null when there is none. */
export function linkErrorMessage(code: string | null | undefined): string | null {
  if (code === null || code === undefined || code.trim() === "") return null;
  return LINK_ERRORS[code] ?? LINK_FAILED;
}

/**
 * What the section shows on return from Google: a merge's outcome, or a
 * refused link, which offers the merge when another login holds the Google
 * account. `done` reads as a confirmation, `refused` as an alert.
 */
export type GoogleAccountsNotice = { readonly tone: "done" | "refused"; readonly message: string; readonly offersMerge: boolean };

/** The notice for the query the page came back with (`error` from Better Auth, `google_merge` from the merge); null when it carries neither. */
export function googleAccountsNoticeOf(query: { readonly error?: string | null; readonly merge?: string | null }): GoogleAccountsNotice | null {
  const merged = mergeResultNotice(query.merge);
  if (merged !== null) return { ...merged, offersMerge: false };
  const message = linkErrorMessage(query.error);
  return message === null ? null : { tone: "refused", message, offersMerge: query.error === HELD_BY_ANOTHER_LOGIN };
}

/** The one value of a search parameter, or null when it is absent or repeated. */
export function searchValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

/** Better Auth's words when the session is too old to remove a sign-in account. */
const SESSION_NOT_FRESH = "Session is not fresh";

/**
 * What the section says when a removal is refused: the rules' own words, or,
 * when the person signed in too long ago for Better Auth to remove a sign-in
 * account, how to get past it.
 */
export function unlinkErrorMessage(message: string | null | undefined): string {
  if (message === SESSION_NOT_FRESH) return "To remove a Google account, sign out and sign in again first.";
  return message === null || message === undefined || message.trim() === "" ? "Please try again." : message;
}

// The Activity log -----------------------------------------------------------------

export const GOOGLE_ACCOUNT_EVENTS = ["link", "unlink", "merge"] as const;
export type GoogleAccountEvent = (typeof GOOGLE_ACCOUNT_EVENTS)[number];

/**
 * The `logs.operation` each change is stored under: a link or an unlink on
 * the `better_auth.account` row it names, a merge (issue #907) beside them,
 * naming the merged login's user id.
 */
export const GOOGLE_ACCOUNT_OPERATIONS: Readonly<Record<GoogleAccountEvent, string>> = {
  link: "GOOGLE_ACCOUNT_LINK",
  unlink: "GOOGLE_ACCOUNT_UNLINK",
  merge: "GOOGLE_ACCOUNT_MERGE",
};

/** One link or unlink as the Activity log keeps it: whose login, which account row, and its email. No token is ever part of it. */
export type GoogleAccountEntry = {
  readonly event: Exclude<GoogleAccountEvent, "merge">;
  readonly userId: string;
  readonly accountRowId: string;
  readonly email: string | null;
};

/** The Activity log's sentence for a link, an unlink or a merge; `email` is the Google account's, or for a merge the merged login's. */
export function googleAccountSentence(event: GoogleAccountEvent, email: string | null): string {
  if (event === "merge") return email === null ? "Merged another login into their account" : `Merged the login ${email} into their account`;
  const account = email === null ? "a Google account" : `the Google account ${email}`;
  return event === "link" ? `Linked ${account}` : `Removed ${account}`;
}

/** The event a stored `logs.operation` is, or null when it is no Google account change. */
export function googleAccountEventOf(operation: string): GoogleAccountEvent | null {
  return GOOGLE_ACCOUNT_EVENTS.find((event) => GOOGLE_ACCOUNT_OPERATIONS[event] === operation) ?? null;
}
