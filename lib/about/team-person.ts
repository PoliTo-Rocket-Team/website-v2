import type { BoardRole, FurtherSeat, RosterEntry } from "@/lib/dashboard/team";
import type { Person, PersonPhoto } from "./types";

// Someone on this year's team as the Team page reads them (issue #282), and
// how the page draws them. Both the roles build (./team-roles.ts) and the
// visual layer (./team-layer.ts) draw people this one way.

/** Someone on this year's team, as the Team page reads them. */
export type TeamPerson = Pick<RosterEntry, "id" | "name" | "placement" | "pageTitle"> & {
  /**
   * Every team-level seat and department head they hold beside the one
   * `placement` draws them in: a team leader, or someone on another seat,
   * who took a seat or a head on a hand-over (#852). Only a page seat bound
   * to that seat or head shows them there; the roles build draws each person
   * in their placement alone.
   */
  readonly furtherSeats: readonly FurtherSeat[];
  /** `members.picture`, null when they uploaded none. */
  readonly photo: string | null;
  /** `users.linkedin` as the dashboard keeps it: "linkedin.com/in/elifkaya". Null or "" when none. */
  readonly linkedin: string | null;
  /** `members.prt_email`. Null or "" when none. */
  readonly teamEmail: string | null;
};

// The seats someone holds beside their placement are read where the roster
// reads them (lib/dashboard/team.ts), so the Team page and the dashboard's
// Team tree share one rule (issue #929).
export { furtherSeatsOf, type FurtherSeat } from "@/lib/dashboard/team";

/** A department's head someone holds, with the title its row carries. */
export type HeadSeat = Extract<FurtherSeat, { readonly kind: "head" }>;

/** Every team-level seat someone holds: the one they are drawn in first, then the rest. */
export function teamSeatsOf(p: TeamPerson): BoardRole[] {
  return [...(p.placement.role === "board" ? [p.placement.seat] : []), ...p.furtherSeats.flatMap((s) => (s.kind === "board" ? [s.seat] : []))];
}

/** Every department someone heads: the one they are drawn in first, then the rest. */
export function headSeatsOf(p: TeamPerson): HeadSeat[] {
  const { placement } = p;
  return [
    ...(placement.role === "head" ? [{ kind: "head" as const, departmentId: placement.departmentId, title: placement.title }] : []),
    ...p.furtherSeats.flatMap((s) => (s.kind === "head" ? [s] : [])),
  ];
}

/** A photo the page can draw: one in public/team/, or a public store URL. */
export function photoOf(url: string | null | undefined): PersonPhoto | undefined {
  const value = url?.trim() ?? "";
  return value.startsWith("/team/") || value.startsWith("https://") ? (value as PersonPhoto) : undefined;
}

/** "linkedin.com/in/elif-kaya" is the handle "elif-kaya". */
export function linkedinHandleOf(profile: string | null): string | undefined {
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
