import type { RoleType } from "./team";

// A team member's role label (issue #650): the one line that names what
// someone on the team is, wherever the dashboard names them. The user card
// and the View as banner show it alone; the View as dialog's row adds the
// unit after it. Off-team wording (alumni, non-member) is not a role label.

/** A role someone holds now, as their label reads it. */
export type LabelledRole = {
  /** The role row's id: the last key `primaryRoleOf` sorts by, so ties never fall to read order. */
  readonly id: number;
  readonly type: RoleType;
  /** The role's title as stored ("Desktop App Developer", "Team Leader"). */
  readonly title: string;
  readonly startedAt: string;
};

const RANK: Readonly<Record<NonNullable<RoleType>, number>> = { president: 0, head: 1, lead: 2, core: 3, advisor: 3 };

/**
 * Their highest role, the oldest of those when they hold several: a lead role
 * over a member role. Two roles of one rank started on one day go to the
 * lower id, so every reader picks the same one whatever order it read them in.
 */
export function primaryRoleOf<R extends LabelledRole>(roles: readonly R[]): R | null {
  const rank = (r: R) => (r.type === null ? 4 : RANK[r.type]);
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.startedAt.localeCompare(b.startedAt) || a.id - b.id)[0] ?? null;
}

/** The label of someone on the team: their primary role's stored title, "Member" when it is blank or they hold none. */
export function roleLabelOf(roles: readonly LabelledRole[]): string {
  return primaryRoleOf(roles)?.title.trim() || "Member";
}
