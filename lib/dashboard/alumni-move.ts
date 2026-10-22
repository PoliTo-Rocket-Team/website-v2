// What "Leaves the team" changes (board 59d; widened by issue #231), the same
// on both sides of the data interface. Whoever may use it (`mayLeaveTeam` in
// ./team.ts) ends every role the person holds and every access grant, in every
// division, and the person moves to Alumni with their years and a team_leaves
// row. Before #231 a division lead ended only their own division's roles; the
// permission rule is what makes ending all of them safe.

/** One of the person's active roles. */
export type MovedRole = { readonly divisionId: number | null };

export type AlumniMove<R extends MovedRole> = {
  /** The active roles that end today: all of them. */
  readonly ending: readonly R[];
};

/** The move, or null when the person holds no active role (they already left). */
export function alumniMove<R extends MovedRole>(active: readonly R[]): AlumniMove<R> | null {
  return active.length === 0 ? null : { ending: active };
}
