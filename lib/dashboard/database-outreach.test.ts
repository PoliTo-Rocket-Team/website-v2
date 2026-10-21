import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { outreachPosts, outreachPostTags, outreachPostVersions, outreachTags } from "@/db/schema";
import { outreachRecord } from "@/lib/outreach";
import { publicOutreach } from "@/lib/outreach-editor";
import { FEATURED_FULL, type FeaturedSlot } from "@/lib/outreach-featured";
import { postColumns } from "@/lib/outreach-rows";
import { insertRows, recordedWrites, resetFakeDb } from "./access-matrix/fake-db";
import { databaseOutreachStore, readStoredOutreach } from "./database-outreach";

// The database path of featured posts (issue #496): the store reads which
// posts hold the two featured slots of `outreach_posts` (migration 0048),
// with no summit read at all, and refuses a third before it writes. It runs
// against the in-memory database of the access tests (./access-matrix/),
// which stores the rows a test puts in and records every write.

const NOW = "2026-10-21 10:00:00+00";

/** Posts 1, 2 and 3 of the record (May 4 2025, April 28 2025, November 22 2024), each holding the slot given, and nothing in the summit's table. */
function seed(slots: readonly (FeaturedSlot | null)[]) {
  resetFakeDb();
  const posts = outreachRecord.posts.slice(0, 3);
  insertRows(
    outreachTags,
    outreachRecord.tags.map((tag, i) => ({ id: i + 1, name: tag.name, award: tag.award, listOrder: i + 1, createdAt: NOW })),
  );
  insertRows(
    outreachPosts,
    posts.map((_, i) => ({ id: i + 1, siteOrder: i + 1, featuredSlot: slots[i] ?? null, createdAt: NOW })),
  );
  insertRows(
    outreachPostVersions,
    posts.map((post, i) => {
      const c = postColumns(post);
      return { id: i + 1, postId: i + 1, version: "published", ...c, body: [...c.body], photos: [...c.photos], updatedAt: NOW };
    }),
  );
  insertRows(
    outreachPostTags,
    posts.flatMap((post, i) => post.tags.map((tagName, at) => ({ postId: i + 1, version: "published", tagName, position: at + 1 }))),
  );
  return posts;
}

const titles = (posts: readonly { title: string }[]) => posts.map((p) => p.title);

test("with no post featured the database read gives no Featured card and lists every post, with the summit's table empty", async () => {
  const posts = seed([null, null, null]);
  const stored = await readStoredOutreach();
  assert.deepEqual(stored.featured, []);
  const shown = publicOutreach(stored);
  assert.deepEqual(shown.featured, []);
  assert.deepEqual(titles(shown.posts), titles(posts));
});

test("one featured post gives one Featured card and leaves the list", async () => {
  const [may, april, november] = seed([null, 1, null]);
  assert.deepEqual(await databaseOutreachStore.featured(), [2]);
  const shown = publicOutreach(await readStoredOutreach());
  assert.deepEqual(titles(shown.featured), [april.title]);
  assert.deepEqual(titles(shown.posts), [may.title, november.title]);
});

test("two featured posts give two Featured cards, newest first, whatever slot each holds", async () => {
  const [may, april, november] = seed([2, 1, null]);
  assert.deepEqual(await databaseOutreachStore.featured(), [2, 1], "slot 1 first");
  const shown = publicOutreach(await readStoredOutreach());
  assert.deepEqual(titles(shown.featured), [may.title, april.title]);
  assert.deepEqual(titles(shown.posts), [november.title]);
});

test("featuring a post writes its slot while one is free, and a third is refused with no write", async () => {
  seed([1, null, null]);
  assert.deepEqual(await databaseOutreachStore.feature(2), { ok: true, value: null });
  assert.deepEqual(recordedWrites(), [{ kind: "update", table: "outreach_posts" }]);

  seed([1, 2, null]);
  assert.deepEqual(await databaseOutreachStore.feature(3), { ok: false, error: FEATURED_FULL });
  assert.deepEqual(recordedWrites(), [], "a refused third writes nothing");
  // A featured post featured again changes nothing.
  assert.deepEqual(await databaseOutreachStore.feature(2), { ok: true, value: null });
  assert.deepEqual(recordedWrites(), []);

  assert.deepEqual(await databaseOutreachStore.unfeature(2), { ok: true, value: null });
  assert.deepEqual(recordedWrites(), [{ kind: "update", table: "outreach_posts" }]);
});
