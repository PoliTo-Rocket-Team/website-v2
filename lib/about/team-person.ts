import type { RosterEntry } from "@/lib/dashboard/team";
import type { Person, PersonPhoto } from "./types";

// Someone on this year's team as the Team page reads them (issue #282), and
// how the page draws them. Both the roles build (./team-roles.ts) and the
// visual layer (./team-layer.ts) draw people this one way.

/** Someone on this year's team, as the Team page reads them. */
export type TeamPerson = Pick<RosterEntry, "id" | "name" | "placement" | "pageTitle"> & {
  /** `members.picture`, null when they uploaded none. */
  readonly photo: string | null;
  /** `users.linkedin` as the dashboard keeps it: "linkedin.com/in/elifkaya". Null or "" when none. */
  readonly linkedin: string | null;
  /** `members.prt_email`. Null or "" when none. */
  readonly teamEmail: string | null;
};

/** A photo the page can draw: one in public/team/, or a public store URL. */
export function photoOf(url: string | null | undefined): PersonPhoto | undefined {
  const value = url?.trim() ?? "";
  return value.startsWith("/team/") || value.startsWith("https://") ? (value as PersonPhoto) : undefined;
}

/** "linkedin.com/in/elif-kaya" is the handle "elif-kaya". */
function linkedinHandleOf(profile: string | null): string | undefined {
  const match = /linkedin\.com\/in\/([^/?#\s]+)/i.exec(profile ?? "");
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** A person as the page draws them: a missing photo, LinkedIn or email is an absent key. */
export function personOf(p: TeamPerson): Person {
  const photo = photoOf(p.photo);
  const linkedin = linkedinHandleOf(p.linkedin);
  const email = p.teamEmail?.trim() ?? "";
  return {
    name: p.name,
    ...(photo !== undefined && { photo }),
    ...(linkedin !== undefined && { linkedin }),
    ...(email !== "" && { email }),
  };
}

/** The title their role carries for the page, when one is set. */
export function titleOf(p: TeamPerson): string | undefined {
  const title = p.pageTitle?.trim() ?? "";
  return title === "" ? undefined : title;
}

export const byName = (a: TeamPerson, b: TeamPerson) => a.name.localeCompare(b.name, "en");
