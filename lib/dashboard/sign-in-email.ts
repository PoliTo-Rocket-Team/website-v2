import { opensWholeTeam } from "./members-view";
import type { ViewerStanding } from "./viewer";

// Correcting a sign-in email in Edit details and Fill details (Owner
// decision, 2026-10-25, issue #741). Someone added with a mistyped address is
// never linked to their sign-in: the `sync_auth_users` trigger
// (drizzle/0001) links a new sign-in account to the `public.users` row with
// the same address. Full access may correct that address, and only on a user
// row no sign-in account holds yet, so the address an account signs in with,
// which identity and access read, is never changed here.

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

/** The user row a correction is aimed at, as stored. */
export type SignInEmailRow = {
  readonly id: string;
  readonly email: string;
  /** Whether a sign-in account holds the row: a Better Auth user with its id. */
  readonly linked: boolean;
};

/** What a sent correction comes to: nothing to write, the one write, or a refusal. */
export type SignInEmailCorrection =
  | { readonly kind: "unchanged" }
  | { readonly kind: "write"; readonly userId: string; readonly email: string }
  | { readonly kind: "refused"; readonly error: string };

/**
 * The correction `sent` (already checked by `checkMemberEdit`, so trimmed and
 * lower case) asks for on `row`. `takenByOther` says whether any other user
 * row holds the address, compared case-insensitively. Sending the address the
 * row already holds changes nothing, so it is allowed to anyone.
 */
export function planSignInEmailCorrection(
  viewer: ViewerStanding,
  sent: string | null,
  row: SignInEmailRow | null,
  takenByOther: boolean,
): SignInEmailCorrection {
  if (sent === null) return { kind: "unchanged" };
  if (row === null) return { kind: "refused", error: SIGN_IN_EMAIL_REFUSALS.noUser };
  if (row.email.trim().toLowerCase() === sent) return { kind: "unchanged" };
  if (!opensWholeTeam(viewer)) return { kind: "refused", error: SIGN_IN_EMAIL_REFUSALS.notFullAccess };
  if (row.linked) return { kind: "refused", error: SIGN_IN_EMAIL_REFUSALS.signedIn };
  if (takenByOther) return { kind: "refused", error: SIGN_IN_EMAIL_REFUSALS.taken };
  return { kind: "write", userId: row.id, email: sent };
}
