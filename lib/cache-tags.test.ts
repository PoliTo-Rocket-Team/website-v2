import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_POSITIONS_CACHE_TAGS, PUBLIC_POSITIONS_CACHE_TAG, TEAM_ROSTER_CACHE_TAG, WRITE_REFRESHED_TAGS } from "./cache-tags";

// The dashboard's cached read of the live positions (issue #397) must be
// refreshed by every write that changes what it holds.

test("a position write (open, close, create, edit) refreshes the dashboard's live positions", () => {
  // database-recruitment.ts's position writes and the recruitment switch call updateTag(PUBLIC_POSITIONS_CACHE_TAG).
  assert.ok((LIVE_POSITIONS_CACHE_TAGS as readonly string[]).includes(PUBLIC_POSITIONS_CACHE_TAG));
});

test("renaming or closing a division or a department refreshes the dashboard's live positions", () => {
  // database-team.ts's division and department writes end in `done`, which calls updateTag(TEAM_ROSTER_CACHE_TAG).
  assert.ok((LIVE_POSITIONS_CACHE_TAGS as readonly string[]).includes(TEAM_ROSTER_CACHE_TAG));
});

test("the live positions carry no tag that no write refreshes", () => {
  for (const tag of LIVE_POSITIONS_CACHE_TAGS) assert.ok(WRITE_REFRESHED_TAGS.has(tag), tag);
});
