import type { ApplicationStatus } from "./overview";

// The viewer's own pages (issue #145, folded from #146): My profile for a
// team member (board 45) and My account for an applicant (board 45b).

/** How the viewer signs in; Google is the only way (issue #118). */
export type SignIn = {
  readonly provider: "google";
  readonly email: string;
};

/** Where the person stands on leaving: nothing asked yet, or asked and waiting for the lead. */
export type LeaveState = "on-team" | "leave-requested";

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
};

/** One of the applicant's own applications, as My account lists it. */
export type AccountApplication = {
  readonly id: number;
  readonly title: string;
  /** "Aerodynamics · sent 9 Oct 2026" */
  readonly detail: string;
  readonly status: ApplicationStatus;
};

export type MyAccount = {
  readonly name: string;
  readonly applications: readonly AccountApplication[];
  readonly signIn: SignIn;
};

/** Still being looked at, so it can be withdrawn. */
export function isOpenApplication(status: ApplicationStatus): boolean {
  return status === "received" || status === "in-review";
}

/** What Delete account does beyond removing the sign-in: only what the person ticked. */
export type DeleteAccount = {
  readonly withdrawOpenApplications: boolean;
};

/**
 * A team member deletes their account only after leaving: their name and
 * photo are on the site until their lead confirms they left.
 */
export function canDeleteAccount(leave: LeaveState | null): boolean {
  return leave === null;
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
