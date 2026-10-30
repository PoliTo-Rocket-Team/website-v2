import { opensWholeTeam } from "./members-view";
import type { ViewerStanding } from "./viewer";
import { shortDate } from "./write";

// Correcting a sign-in email in Edit details and Fill details (Owner
// decision, 2026-10-25, issue #741). Someone added with a mistyped address is
// never linked to their sign-in: the `sync_auth_users` trigger
// (drizzle/0001) links a new sign-in account to the `public.users` row with
// the same address. Full access may correct that address, and only on a user
// row no sign-in account holds yet, so the address an account signs in with,
// which identity and access read, is never changed here.
//
// When the corrected address already signed in on its own, that first
// sign-in made a second user row with no member record. Full access may then
// link that login to the member instead (Owner decision, 2026-10-30, issue
// #860): the member record moves onto the login's row, and the row it leaves,
// which no sign-in ever held, is closed.

/**
 * Whether `viewer` may correct the sign-in email of a person whose user row
 * is `linked` to a sign-in account: full access only, by the Members export's
 * whole-team rule (`mayExportMembers`), and never once they sign in.
 */
export function correctsSignInEmail(viewer: ViewerStanding, linked: boolean): boolean {
  return opensWholeTeam(viewer) && !linked;
}

export const SIGN_IN_EMAIL_REFUSALS = {
  notFullAccess: "Only full access may change a sign-in email.",
  signedIn: "They already sign in with this email, so it cannot be changed here.",
  taken: "Someone else on the team already uses this email.",
  noUser: "Their sign-in email could not be found.",
} as const;

/** The refusal for an address another user row holds, naming who when the row has a name. */
export function takenBy(name: string | null): string {
  return name === null ? SIGN_IN_EMAIL_REFUSALS.taken : `${name} already uses this email.`;
}

/** The user row a correction is aimed at, as stored. */
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
  /** The day (YYYY-MM-DD, team time) its sign-in account was made, which is its first sign-in; null when no sign-in account holds it. */
  readonly firstSignIn: string | null;
  /** Whether the row was closed (`users.deleted_at`). */
  readonly deleted: boolean;
  /** Whether the row waits for Confirm NDA in a division, which makes it a member when it lands. */
  readonly waiting: boolean;
  /** Whether its sign-in account is a break-glass one (issue #646), which is never anyone's team record. */
  readonly breakGlass: boolean;
};

/**
 * The day an empty login first signed in: a sign-in account on an open row
 * with no member record, not waiting to join and not a break-glass account.
 * Null for any other row: a link is offered for an empty login only.
 */
export function emptyLoginSince(holder: EmailHolderRow): string | null {
  if (holder.member !== null || holder.deleted || holder.waiting || holder.breakGlass) return null;
  return holder.firstSignIn;
}

/** What Edit details offers when the corrected address is an empty login: everything the confirmation names and the link checks again. */
export type LoginLinkOffer = {
  readonly memberId: number;
  /** The member's user row now, which no sign-in account holds. */
  readonly fromUserId: string;
  /** The empty login's user row. */
  readonly loginUserId: string;
  readonly email: string;
  /** The day (YYYY-MM-DD) the login first signed in. */
  readonly firstSignIn: string;
};

/** The confirmation Link login opens with (issue #860): the question, and when the login first signed in. */
export function loginLinkQuestion(offer: LoginLinkOffer, memberName: string, thisYear: number): { readonly title: string; readonly description: string } {
  return {
    title: `Link that login to ${memberName}?`,
    description: `${offer.email} already signed in on ${shortDate(offer.firstSignIn, thisYear)} with no team record.`,
  };
}

/** What Save reads when an empty login holds the address and nothing was written: shown only where the offer is not. */
export const LINK_OFFERED = "This email already signs in with no team record.";

/** What Edit details' Save comes to: saved, or nothing written and an empty login offered to Link login. */
export type DetailsSaved = { readonly kind: "saved" } | { readonly kind: "link-offered"; readonly offer: LoginLinkOffer };

/** What a sent correction comes to: nothing to write, the one write, an empty login to link, or a refusal. */
export type SignInEmailCorrection =
  | { readonly kind: "unchanged" }
  | { readonly kind: "write"; readonly userId: string; readonly email: string }
  | { readonly kind: "link"; readonly offer: LoginLinkOffer }
  | { readonly kind: "refused"; readonly error: string };

/**
 * The correction `sent` (already checked by `checkMemberEdit`, so trimmed and
 * lower case) asks for on `row`. `holders` are the other user rows that hold
 * the address, compared case-insensitively. Sending the address the row
 * already holds changes nothing, so it is allowed to anyone. An address one
 * empty login alone holds is offered as a link for a member; any other holder
 * refuses, naming who.
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
  if (row.linked) return { kind: "refused", error: SIGN_IN_EMAIL_REFUSALS.signedIn };
  const [holder, ...others] = holders;
  if (holder === undefined) return { kind: "write", userId: row.id, email: sent };
  const since = others.length === 0 ? emptyLoginSince(holder) : null;
  if (since === null || row.member === null) {
    const named = holders.find((h) => emptyLoginSince(h) === null) ?? holder;
    return { kind: "refused", error: takenBy(named.name) };
  }
  return { kind: "link", offer: { memberId: row.member, fromUserId: row.id, loginUserId: holder.userId, email: sent, firstSignIn: since } };
}

export const LOGIN_LINK_REFUSALS = {
  notFullAccess: "Only full access may link a login.",
  changed: "Something changed since this opened. Close it and save again.",
} as const;

/** The link Link login sends back: the offer's three ids. */
export type LoginLinkRequest = Pick<LoginLinkOffer, "memberId" | "fromUserId" | "loginUserId">;

/** The request in `input`, as Link login sends it; null for anything else. */
export function checkLoginLink(input: unknown): LoginLinkRequest | null {
  if (typeof input !== "object" || input === null) return null;
  const { memberId, fromUserId, loginUserId } = input as Record<string, unknown>;
  if (!Number.isInteger(memberId) || (memberId as number) <= 0) return null;
  if (typeof fromUserId !== "string" || fromUserId === "" || typeof loginUserId !== "string" || loginUserId === "" || fromUserId === loginUserId) return null;
  return { memberId: memberId as number, fromUserId, loginUserId };
}

/**
 * Whether Link login may still land on what the database reads now: full
 * access, the member's row still `from` with no sign-in, and the login still
 * an empty one. The write checks the stored facts again inside its batch.
 */
export function planLoginLink(
  viewer: ViewerStanding,
  request: LoginLinkRequest,
  from: SignInEmailRow | null,
  login: EmailHolderRow | null,
): { readonly kind: "link"; readonly request: LoginLinkRequest } | { readonly kind: "refused"; readonly error: string } {
  if (!opensWholeTeam(viewer)) return { kind: "refused", error: LOGIN_LINK_REFUSALS.notFullAccess };
  const fromHolds = from !== null && from.id === request.fromUserId && from.member === request.memberId && !from.linked;
  const loginEmpty = login !== null && login.userId === request.loginUserId && emptyLoginSince(login) !== null;
  return fromHolds && loginEmpty ? { kind: "link", request } : { kind: "refused", error: LOGIN_LINK_REFUSALS.changed };
}
