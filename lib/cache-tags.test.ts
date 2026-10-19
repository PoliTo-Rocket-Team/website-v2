import assert from "node:assert/strict";
import { test } from "node:test";
import { CACHED_READS, cachedReadTags, refreshAfter, type CachedRead, type CacheTag, type WriteKind } from "./cache-tags";

// The cached reads and the writes take their tags from one mapping
// (lib/cache-tags.ts, issue #397): a read through `cachedReadTags`, a write
// through `refreshAfter`. These check that every write that changes a cached
// read refreshes it, and that the read carries no tag no such write refreshes.

const READS = Object.keys(CACHED_READS) as CachedRead[];

/** The tags a write of this kind refreshes, as `refreshAfter` hands them to Next's `updateTag`. */
function refreshedBy(kind: WriteKind): CacheTag[] {
  const refreshed: CacheTag[] = [];
  refreshAfter(kind, (tag) => refreshed.push(tag));
  return refreshed;
}

test("the live positions are refreshed by a position write and by a team write", () => {
  const carried = cachedReadTags("livePositions");
  assert.ok(refreshedBy("positions").some((tag) => carried.includes(tag)), "a position write leaves the live positions stale");
  assert.ok(refreshedBy("team").some((tag) => carried.includes(tag)), "a division or department write leaves the live positions stale");
});

test("every write that changes a cached read refreshes a tag the read carries", () => {
  for (const read of READS) {
    const carried = cachedReadTags(read);
    for (const kind of CACHED_READS[read].changedBy) {
      assert.ok(refreshedBy(kind).some((tag) => carried.includes(tag)), `${kind} leaves ${read} stale`);
    }
  }
});

test("a cached read carries no tag that the writes changing it never refresh", () => {
  for (const read of READS) {
    const refreshed = new Set(CACHED_READS[read].changedBy.flatMap(refreshedBy));
    for (const tag of cachedReadTags(read)) assert.ok(refreshed.has(tag), `${read} carries ${tag}, which no write refreshes`);
  }
});
