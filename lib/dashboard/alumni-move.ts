// What Move to alumni changes (board 59d, issue #201), the same on both sides
// of the data interface. It touches only what the person moving them
// manages: the operations lead (an org or admin scope) ends the whole
// membership, a division lead ends only the person's roles in their own
// division and that division's access. The person leaves the team, with
// their years and a team_leaves row, only when no active role is left.

/** What the person moving someone reaches. */
export type MoveReach =
  | { readonly kind: "team" }
  | { readonly kind: "division"; readonly divisionId: number };

/** One of the person's active roles. */
export type MovedRole = { readonly divisionId: number | null };

export type AlumniMove<R extends MovedRole> = {
  /** The active roles that end today. */
  readonly ending: readonly R[];
  /** Which access grants go: every one of the person's for the team, that division's `division` grants for a division. */
  readonly grants: MoveReach;
  /** No active role is left after the move: the person leaves the team. */
  readonly leavesTeam: boolean;
};

/** The move, or null when none of the person's active roles is in reach. */
export function alumniMove<R extends MovedRole>(active: readonly R[], reach: MoveReach): AlumniMove<R> | null {
  const ending = reach.kind === "team" ? active : active.filter((role) => role.divisionId === reach.divisionId);
  if (ending.length === 0) return null;
  return { ending, grants: reach, leavesTeam: ending.length === active.length };
}
