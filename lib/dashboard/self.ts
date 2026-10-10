import type { YourDetails } from "./details";

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

export type MyProfile = {
  readonly name: string;
  /** "Member · Mission Analysis Division" */
  readonly role: string;
  /** The team address shown on the site; null when the person has none. */
  readonly teamEmail: string | null;
  readonly linkedin: string | null;
  /** The public URL of the photo; null shows initials. */
  readonly photoUrl: string | null;
  readonly signIn: SignIn;
  readonly leave: LeaveState;
  readonly details: YourDetails;
};

export type MyAccount = {
  readonly name: string;
  readonly signIn: SignIn;
  readonly details: YourDetails;
  /** Applications still in progress: what "Also withdraw my open applications" would withdraw. */
  readonly openApplications: number;
};

/** What Delete account does beyond closing the account: only what the person ticked. */
export type DeleteAccount = {
  readonly withdrawOpenApplications: boolean;
};

/** The Delete account copy (boards 51, 51c and 55c). */
export const DELETE_ACCOUNT_COPY =
  "Closes your account, so you can't sign in with it again. Your data is anonymized and kept only for statistics.";

/** The word the person types to confirm Delete account. */
export const DELETE_WORD = "DELETE";

export function deleteConfirmed(typed: string): boolean {
  return typed.trim() === DELETE_WORD;
}

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
