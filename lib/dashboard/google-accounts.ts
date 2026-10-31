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

// Coming back from Google ----------------------------------------------------------

/**
 * What the section says when Google sends the person back with an error code
 * (Better Auth's `error` query value). Merging a login that already holds the
 * Google account is a later slice of epic #902; until then the section only
 * says why it was not added.
 */
const LINK_ERRORS: Readonly<Record<string, string>> = {
  account_already_linked_to_different_user:
    "That Google account already has its own login on this site, so it was not added. Sign in with it to use that login.",
  access_denied: "Adding the Google account was cancelled.",
};

const LINK_FAILED = "Could not add that Google account. Please try again.";

/** The message for an error code on return from Google; null when there is none. */
export function linkErrorMessage(code: string | null | undefined): string | null {
  if (code === null || code === undefined || code.trim() === "") return null;
  return LINK_ERRORS[code] ?? LINK_FAILED;
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

export const GOOGLE_ACCOUNT_EVENTS = ["link", "unlink"] as const;
export type GoogleAccountEvent = (typeof GOOGLE_ACCOUNT_EVENTS)[number];

/** The `logs.operation` each change is stored under, on the `better_auth.account` row it names. */
export const GOOGLE_ACCOUNT_OPERATIONS: Readonly<Record<GoogleAccountEvent, string>> = {
  link: "GOOGLE_ACCOUNT_LINK",
  unlink: "GOOGLE_ACCOUNT_UNLINK",
};

/** One link or unlink as the Activity log keeps it: whose login, which account row, and its email. No token is ever part of it. */
export type GoogleAccountEntry = {
  readonly event: GoogleAccountEvent;
  readonly userId: string;
  readonly accountRowId: string;
  readonly email: string | null;
};

/** The Activity log's sentence for a link or an unlink. */
export function googleAccountSentence(event: GoogleAccountEvent, email: string | null): string {
  const account = email === null ? "a Google account" : `the Google account ${email}`;
  return event === "link" ? `Linked ${account}` : `Removed ${account}`;
}

/** The event a stored `logs.operation` is, or null when it is no Google account change. */
export function googleAccountEventOf(operation: string): GoogleAccountEvent | null {
  return GOOGLE_ACCOUNT_EVENTS.find((event) => GOOGLE_ACCOUNT_OPERATIONS[event] === operation) ?? null;
}
