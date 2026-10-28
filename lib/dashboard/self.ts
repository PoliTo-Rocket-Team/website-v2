import type { DetailsEditor, YourDetails } from "./details";
import type { HandOverOffer } from "./hand-over-request";
import type { RoleType } from "./team";

// The viewer's own pages (issue #145, folded from #146; Dashboard v2 in issue
// #169): My profile for a team member (board 55) and My account for an
// applicant (board 51). Their applications are My applications
// (./my-applications.ts).

/** How the viewer signs in; Google is the only way (issue #118). */
export type SignIn = {
  readonly provider: "google";
  readonly email: string;
};

/** On the team, or left it from My profile and now on the Alumni list (board 55b). */
export type LeaveState = "on-team" | "left";

/** One role on My profile: its title and the division it is in; null for a role in no division, such as a head's. */
export type ProfileRole = {
  readonly title: string;
  readonly division: string | null;
};

/** "Member · Mission Analysis Division", or the title alone for a role in no division. */
export function profileRoleLine(role: ProfileRole): string {
  return role.division === null ? role.title : `${role.title} · ${role.division}`;
}

/** A role row as the profile reads it: its title (empty when none was set), type and division. */
export type ProfileRoleSource = {
  readonly title: string | null;
  readonly type: RoleType;
  readonly divisionName: string | null;
};

const UNTITLED: Readonly<Record<NonNullable<RoleType> | "none", string>> = {
  president: "Team Leader",
  head: "Head",
  lead: "Lead",
  core: "Member",
  advisor: "Advisor",
  none: "Member",
};

/**
 * Every role the person holds now, one per division they are in (issue
 * #185): `primary` first, the role a single-division page names, then the
 * rest in the order given. A role with no title reads by its type. Someone on
 * the team with no role row reads "Member".
 */
export function profileRolesOf<R extends ProfileRoleSource>(primary: R | null, roles: readonly R[]): readonly [ProfileRole, ...ProfileRole[]] {
  const ordered = primary === null ? roles : [primary, ...roles.filter((r) => r !== primary)];
  const [first, ...rest] = ordered.map((r): ProfileRole => ({ title: r.title || UNTITLED[r.type ?? "none"], division: r.divisionName }));
  return first === undefined ? [{ title: UNTITLED.none, division: null }] : [first, ...rest];
}

export type MyProfile = {
  readonly name: string;
  /** Every role they hold, one per division they are in, the home one first (issue #185). */
  readonly roles: readonly [ProfileRole, ...ProfileRole[]];
  /** The team address shown on the site; null when the person has none. */
  readonly teamEmail: string | null;
  readonly linkedin: string | null;
  /** The public URL of the photo; null shows the PRT mark. */
  readonly photoUrl: string | null;
  readonly signIn: SignIn;
  readonly leave: LeaveState;
  readonly details: YourDetails;
  /**
   * Who sets their name (issue #668): a `lead` renames themselves in "Your
   * details", a `member`'s lead does. The server's save reads the same rule
   * (`detailsEditorOf`).
   */
  readonly detailsEditor: Exclude<DetailsEditor, "applicant">;
  /**
   * A division lead's or a department head's "Hand over your role" (board
   * 55d, issue #262), in place of "Leave the team"; null for everyone else.
   */
  readonly handOver: HandOverOffer | null;
};

export type MyAccount = {
  readonly name: string;
  /** Their stored photo, the one the sidebar shows (`DashboardViewer.photoUrl`, issue #656); null shows the PRT mark. */
  readonly photoUrl: string | null;
  readonly signIn: SignIn;
  readonly details: YourDetails;
  /** Applications still in progress: what "Also withdraw my open applications" would withdraw. */
  readonly openApplications: number;
};

/** What Delete account does beyond closing the account: only what the person ticked. */
export type DeleteAccount = {
  readonly withdrawOpenApplications: boolean;
  /** A member ticked "Remove my name from the Alumni page" (board 55c). */
  readonly removeFromAlumni: boolean;
};

/** The box on Leave the team and Delete account (boards 55b and 55c, issue #257). Unticked at first. */
export const REMOVE_FROM_ALUMNI_LABEL = "Remove my name from the Alumni page";
export const REMOVE_FROM_ALUMNI_HINT =
  "If you leave it, your name and years stay as part of the team's history. You can also ask us later.";

/** Delete account's body for a member (board 55c): their alumni entry stays unless they tick the box. */
export const DELETE_MEMBER_DIALOG_COPY =
  "You leave the team and can't sign in with this account again. Your private data is anonymized and kept only for statistics.";

/**
 * The Delete account copy (boards 51, 51c and 55c). The data is kept a year,
 * then anonymized (issue #191, ./anonymize.ts).
 */
export const DELETE_ACCOUNT_COPY =
  "Closes your account, so you can't sign in with it again. Your data is kept at least one year, then anonymized and kept only for statistics.";

/** The same copy on My profile's Leave or delete card (board 55), for someone on the team. */
export const DELETE_MEMBER_ACCOUNT_COPY =
  "Closes your account, so you can't sign in with it again. You leave the team first. Your data is kept at least one year, then anonymized and kept only for statistics.";

/** The word the person types to confirm Delete account. */
export const DELETE_WORD = "DELETE";

export function deleteConfirmed(typed: string): boolean {
  return typed.trim() === DELETE_WORD;
}

/** Leave the team, refused for a lead or a head: they hand their role over instead (board 55d, issue #262). */
export const HAND_OVER_FIRST = "You hold a role: hand it over first, and choose Leave the team there.";

/** The longest reason for leaving the page keeps. */
export const MAX_LEAVE_REASON = 1000;

/** The optional reason for leaving as typed: trimmed, capped, null when empty. */
export function leaveReason(text: unknown): string | null {
  const trimmed = typeof text === "string" ? text.trim().slice(0, MAX_LEAVE_REASON) : "";
  return trimmed === "" ? null : trimmed;
}

/** A photo is a JPEG or PNG of at most 2 MB (board 45). */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

export function checkPhoto(file: { type: string; size: number }): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return "The photo must be a JPEG or PNG.";
  if (file.size > MAX_PHOTO_BYTES) return "The photo must be 2 MB or less.";
  return null;
}

/**
 * A LinkedIn profile as typed: "linkedin.com/in/elifkaya", with or without
 * https:// and www. Answers the short form the page shows, null for an empty
 * field, or an error for anything that is not a LinkedIn profile.
 */
export function normalizeLinkedin(text: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  const match = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})\/?$/i.exec(trimmed);
  if (!match) return { ok: false, error: "Paste your profile link, like linkedin.com/in/your-name." };
  return { ok: true, value: `linkedin.com/in/${match[1]}` };
}
