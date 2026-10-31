import { opensWholeTeam } from "./members-view";
import type { ViewerStanding } from "./viewer";

// Changing a sign-in email in Edit details and Fill details. Someone added
// with a mistyped address is never linked to their sign-in: the
// `sync_auth_users` trigger (drizzle/0001) links a new sign-in account to the
// `public.users` row with the same address, so a wrong stored address can
// even hand the member's record to a stranger who signs in with it. Full
// access may change the address (Owner decision, 2026-10-25, issue #741), in
// one plain Save with no confirmation step (Owner decision, 2026-10-31,
// issue #864):
//
// - When a sign-in account holds the member's user row, or another login
//   with no member record already holds the new address, the member record
//   moves off that row (`RecordMove`). The row it leaves is detached, and a
//   login on it is signed out at once: every session of it ends.
// - Otherwise the row keeps the record and takes the new address, so the
//   person lands on it at their first sign-in.
//
// The address a sign-in account signs in with, in `better_auth."user"`, is
// never changed here.

/**
 * Whose sign-in email this is: a member's, on the user row that holds their
 * member record, or the one of someone waiting for Confirm NDA, whose user
 * row holds no record yet.
 */
export type SignInEmailOwner = "member" | "waiting";

/**
 * Whether `viewer` may change the sign-in email of `owner`, whose user row is
 * `linked` to a sign-in account: full access only, by the Members export's
 * whole-team rule (`mayExportMembers`). A member's always, since the record
 * can move off a login; someone waiting's only before they sign in, since
 * they hold no record to move.
 */
export function correctsSignInEmail(viewer: ViewerStanding, owner: SignInEmailOwner, linked: boolean): boolean {
  return opensWholeTeam(viewer) && (owner === "member" || !linked);
}

export const SIGN_IN_EMAIL_REFUSALS = {
  notFullAccess: "Only full access may change a sign-in email.",
  signedIn: "They already sign in with this email, so it cannot be changed here.",
  taken: "Someone else on the team already uses this email.",
  noUser: "Their sign-in email could not be found.",
  changed: "Something changed since this opened. Close it and save again.",
} as const;

/** The refusal for an address another user row holds, naming who when the row has a name. */
export function takenBy(name: string | null): string {
  return name === null ? SIGN_IN_EMAIL_REFUSALS.taken : `${name} already uses this email.`;
}

/** The user row a change is aimed at, as stored. */
export type SignInEmailRow = {
  readonly id: string;
  readonly email: string;
  /** Whether a sign-in account holds the row: a Better Auth user with its id. */
  readonly linked: boolean;
  /** The member record the row holds; null for someone waiting to join. */
  readonly member: number | null;
};

/** Another user row that holds an address, as stored. */
export type EmailHolderRow = {
  readonly userId: string;
  /** Their first and last name on the row; null when it has none. */
  readonly name: string | null;
  readonly member: number | null;
  /** Whether a sign-in account holds the row. */
  readonly linked: boolean;
  /** Whether the row was closed (`users.deleted_at`). */
  readonly deleted: boolean;
  /** Whether the row waits for Confirm NDA in a division, which makes it a member when it lands. */
  readonly waiting: boolean;
  /** Whether its sign-in account is a break-glass one (issue #646), which is never anyone's team record. */
  readonly breakGlass: boolean;
};

/**
 * Whether the row is an empty login: a sign-in account on an open row with
 * no member record, not waiting to join and not a break-glass account. Only
 * an empty login may take a member record.
 */
export function isEmptyLogin(holder: EmailHolderRow): boolean {
  return holder.linked && holder.member === null && !holder.deleted && !holder.waiting && !holder.breakGlass;
}

/**
 * Where a moving member record lands: the empty login that already holds the
 * new address, or a new user row with no sign-in account that holds it, which
 * the sync trigger links at that address's first sign-in.
 */
export type RecordDestination = { readonly kind: "login"; readonly userId: string } | { readonly kind: "new-row" };

/**
 * A member record moving off the user row `from` because its sign-in email
 * changed. The row it leaves no longer holds the record. When a sign-in
 * account holds that row, the row stays open as that login's own and every
 * session of it ends; when none does, the row is closed (`deleted_at`),
 * never deleted.
 */
export type RecordMove = {
  readonly memberId: number;
  readonly from: { readonly userId: string; readonly linked: boolean };
  readonly to: RecordDestination;
  /** The new sign-in email, trimmed and lower case. */
  readonly email: string;
};

/** What a sent change comes to: nothing to write, the address written on the row, the record moved, or a refusal. */
export type SignInEmailCorrection =
  | { readonly kind: "unchanged" }
  | { readonly kind: "write"; readonly userId: string; readonly email: string }
  | { readonly kind: "move"; readonly move: RecordMove }
  | { readonly kind: "refused"; readonly error: string };

/**
 * The change `sent` (already checked by `checkMemberEdit`, so trimmed and
 * lower case) asks for on `row`. `holders` are the other user rows that hold
 * the address, compared case-insensitively. Sending the address the row
 * already holds changes nothing, so it is allowed to anyone. A member's
 * record moves onto an address one empty login alone holds, and off a row a
 * sign-in account holds; any other holder refuses, naming who.
 */
export function planSignInEmailCorrection(
  viewer: ViewerStanding,
  sent: string | null,
  row: SignInEmailRow | null,
  holders: readonly EmailHolderRow[],
): SignInEmailCorrection {
  if (sent === null) return { kind: "unchanged" };
  if (row === null) return { kind: "refused", error: SIGN_IN_EMAIL_REFUSALS.noUser };
  if (row.email.trim().toLowerCase() === sent) return { kind: "unchanged" };
  if (!opensWholeTeam(viewer)) return { kind: "refused", error: SIGN_IN_EMAIL_REFUSALS.notFullAccess };
  if (row.member === null && row.linked) return { kind: "refused", error: SIGN_IN_EMAIL_REFUSALS.signedIn };
  const [holder, ...others] = holders;
  const moving = (to: RecordDestination, memberId: number): SignInEmailCorrection => ({
    kind: "move",
    move: { memberId, from: { userId: row.id, linked: row.linked }, to, email: sent },
  });
  if (holder === undefined) return row.member !== null && row.linked ? moving({ kind: "new-row" }, row.member) : { kind: "write", userId: row.id, email: sent };
  if (row.member !== null && others.length === 0 && isEmptyLogin(holder)) return moving({ kind: "login", userId: holder.userId }, row.member);
  const named = holders.find((h) => !isEmptyLogin(h)) ?? holder;
  return { kind: "refused", error: takenBy(named.name) };
}
