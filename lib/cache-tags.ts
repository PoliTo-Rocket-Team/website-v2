// Cache tags that more than one cached read carries, kept in one module with
// no server imports so the tests can read them (issue #397). A cached read
// may only carry tags that a write refreshes: a tag no write refreshes would
// keep its read stale until the cache life runs out.

/**
 * Positions. Every position write refreshes it: open or close, create, edit
 * (lib/dashboard/database-recruitment.ts), the recruitment switch
 * (lib/dashboard/database.ts), a division's new code, and closing a division
 * or a department (lib/dashboard/database-team.ts).
 */
export const PUBLIC_POSITIONS_CACHE_TAG = "public-apply-positions";

/**
 * The team and its org chart. Every write that changes who holds a role, or
 * a division or department (create, rename, recode, close), refreshes it
 * (`done` in lib/dashboard/database-team.ts, lib/dashboard/database-self.ts,
 * lib/dashboard/database-recruitment.ts).
 */
export const TEAM_ROSTER_CACHE_TAG = "team-roster";

/**
 * The dashboard's read of every live position in an open division and
 * department, with its division and department names (`readLivePositions`,
 * lib/dashboard/database.ts). A position write changes its rows; renaming or
 * closing a division or a department changes the names and which rows count.
 */
export const LIVE_POSITIONS_CACHE_TAGS = [PUBLIC_POSITIONS_CACHE_TAG, TEAM_ROSTER_CACHE_TAG] as const;

/** Every tag a write refreshes. */
export const WRITE_REFRESHED_TAGS: ReadonlySet<string> = new Set([PUBLIC_POSITIONS_CACHE_TAG, TEAM_ROSTER_CACHE_TAG]);
