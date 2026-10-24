import { z } from "zod";
import type { ViewerKind } from "./viewer";

// A team member's first and last name, as a rename sets them (Owner decision,
// 2026-10-24, issue #668): division leads, department heads, the team leader
// and the full-access seats rename the people they may edit, in Members Edit
// details, and themselves, in My profile. A plain member, a grant or not, sees
// their name set by their lead. Both names are kept as `users.first_name` and
// `users.last_name`, which the dashboard and the public Team page read.

export type PersonName = {
  readonly firstName: string;
  readonly lastName: string;
};

/** No name stored yet. */
export const NO_NAME: PersonName = { firstName: "", lastName: "" };

/** The longest first or last name, as Add member takes it. */
export const MAX_NAME = 100;

/** One name as a rename takes it: trimmed, never blank, so the Team page never shows a nameless person. */
export function nameRule(missing: string) {
  return z.string().trim().min(1, missing).max(MAX_NAME, "Too long.");
}

/**
 * Whether a viewer of this kind renames themselves in My profile: a division
 * lead, a department head, and the `operations-lead` kind, which is the team
 * leader and every full-access seat. A member, with or without a grant, does not.
 */
export function namesThemselves(kind: ViewerKind): boolean {
  return kind === "division-lead" || kind === "department-head" || kind === "operations-lead";
}
