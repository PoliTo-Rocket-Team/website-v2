// Cache tags that more than one cached read carries, and the one mapping the
// cached reads and the writes both take them from (issue #397). The module has
// no server imports, so the tests read the same mapping the code runs on. A
// cached read may only carry tags that a write refreshes: a tag no write
// refreshes would keep its read stale until the cache life runs out.

/** Positions: the public list of open roles, and the dashboard's live positions. */
export const PUBLIC_POSITIONS_CACHE_TAG = "public-apply-positions";

/** The team: who holds a role, and the divisions and departments of its org chart. */
export const TEAM_ROSTER_CACHE_TAG = "team-roster";

export type CacheTag = typeof PUBLIC_POSITIONS_CACHE_TAG | typeof TEAM_ROSTER_CACHE_TAG;

/**
 * What each kind of write changes, as the tags it refreshes. A write refreshes
 * through `refreshAfter`, never by naming a tag itself.
 */
export const WRITE_REFRESHES = {
  /**
   * A position opened or closed, created or edited
   * (lib/dashboard/database-recruitment.ts), the recruitment switch
   * (lib/dashboard/database.ts), and a division's new code, which every
   * position code is built from (lib/dashboard/database-team.ts).
   */
  positions: [PUBLIC_POSITIONS_CACHE_TAG],
  /**
   * Who holds a role (lib/dashboard/database-self.ts, a join in
   * lib/dashboard/database-recruitment.ts), and a division or department
   * created, renamed, recoded, moved or closed (`done` in
   * lib/dashboard/database-team.ts). Mark created on an alias request too,
   * since it saves the member's PRT email (lib/dashboard/database-alias.ts).
   */
  team: [TEAM_ROSTER_CACHE_TAG],
} as const satisfies Record<string, readonly CacheTag[]>;

export type WriteKind = keyof typeof WRITE_REFRESHES;

/** Refresh every tag a write of this kind changes; the server passes Next's `updateTag`. */
export function refreshAfter(kind: WriteKind, refresh: (tag: CacheTag) => void): void {
  for (const tag of WRITE_REFRESHES[kind]) refresh(tag);
}

type CachedReadSpec = {
  /** The tags the read carries. */
  readonly tags: readonly CacheTag[];
  /** The kinds of write that change what it holds. */
  readonly changedBy: readonly WriteKind[];
};

/** The shared cached reads (ADR 0003) that take their tags from here. */
export const CACHED_READS = {
  /**
   * Every live position in an open division and department, with its division
   * and department names (`readLivePositions`, lib/dashboard/database.ts). A
   * position write changes its rows; renaming or closing a division or a
   * department changes the names and which rows count.
   */
  livePositions: { tags: [PUBLIC_POSITIONS_CACHE_TAG, TEAM_ROSTER_CACHE_TAG], changedBy: ["positions", "team"] },
} as const satisfies Record<string, CachedReadSpec>;

export type CachedRead = keyof typeof CACHED_READS;

/** The tags a cached read carries; the read passes them to Next's `cacheTag`. */
export function cachedReadTags(read: CachedRead): CacheTag[] {
  return [...CACHED_READS[read].tags];
}
