import assert from "node:assert/strict";
import { test } from "node:test";
import { publicVersion } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { outreachRecord, postBySlug, slugOf } from "./outreach";
import { outreachEditor, publicOutreach, type OutreachStore } from "./outreach-editor";
import { filterRows, newestRowsFirst, outreachRow } from "./outreach-list";
import { memoryOutreachStore, memoryPhotoFiles } from "./outreach-memory";
import { outreachPostOf } from "./outreach-rows";

// The dashboard's Outreach list (board 74, issue #289): Unpublish and Delete
// from a row's menu, and what /outreach shows after each. The editor runs
// over an in-memory store holding the import (./outreach-memory.ts).

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const member: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false };

const freshStore = (): OutreachStore => memoryOutreachStore();

/** What /outreach shows from the store as it is now. */
async function site(store: OutreachStore) {
  return publicOutreach({ posts: await store.posts.list(), tags: await store.tags(), featured: await store.featured() });
}

test("Unpublish keeps the post in the list as a draft and takes it off /outreach and its page; Delete removes it from both", async () => {
  const store = freshStore();
  const editor = outreachEditor(admin, store, memoryPhotoFiles);
  const items = (await editor.posts.list())!;
  const [first, second] = items;
  const firstSlug = slugOf(publicVersion(first.version)!);

  const unpublished = await editor.posts.unpublish(first.id);
  assert.ok(unpublished.ok);
  assert.equal(unpublished.value.version.state, "draft");
  const listed = (await editor.posts.list())!.find((item) => item.id === first.id);
  assert.equal(listed?.version.state, "draft", "still in the dashboard list");
  assert.equal(postBySlug((await site(store)).posts, firstSlug), undefined, "off /outreach and its post page");
  assert.equal((await site(store)).posts.length, outreachRecord.posts.length - 1);
  // A draft has nothing left to take down.
  assert.equal((await editor.posts.unpublish(first.id)).ok, false);

  // Draft changes are what the draft keeps, so nothing typed is lost.
  assert.ok((await editor.posts.save(second.id, "save-draft", async (current) => ({ ok: true, value: { ...outreachPostOf(current)!, lead: "Rewritten lead" } }))).ok);
  const withChanges = await editor.posts.unpublish(second.id);
  assert.ok(withChanges.ok && withChanges.value.version.state === "draft");
  assert.equal(withChanges.value.version.draft.lead, "Rewritten lead");

  assert.ok((await editor.posts.remove(first.id)).ok);
  assert.equal((await editor.posts.list())!.some((item) => item.id === first.id), false, "gone from the list");
  const third = items[2];
  assert.ok((await editor.posts.remove(third.id)).ok, "a live post deletes at once");
  const shown = (await site(store)).posts;
  assert.equal(shown.length, outreachRecord.posts.length - 3);
  assert.equal(shown.some((p) => p.title === publicVersion(third.version)!.title), false, "gone from /outreach");
});

test("only the site-content gate's viewers unpublish or delete", async () => {
  const store = freshStore();
  const id = (await outreachEditor(admin, store, memoryPhotoFiles).posts.list())![0].id;
  const refused = outreachEditor(member, store, memoryPhotoFiles);
  assert.equal((await refused.posts.unpublish(id)).ok, false);
  assert.equal((await refused.posts.remove(id)).ok, false);
  assert.equal((await site(store)).posts.length, outreachRecord.posts.length);
});

test("the list is newest first, and the Status filter reads a post with draft changes as Draft, as its pill does", async () => {
  const store = freshStore();
  const editor = outreachEditor(admin, store, memoryPhotoFiles);
  const [newest] = (await editor.posts.list())!;
  assert.ok((await editor.posts.save(newest.id, "save-draft", async (current) => ({ ok: true, value: { ...outreachPostOf(current)!, lead: "Changed" } }))).ok);
  const rows = newestRowsFirst((await editor.posts.list())!.map((item) => outreachRow(item, String(item.id))));
  const dates = rows.map((r) => r.post.date);
  assert.deepEqual(dates, [...dates].sort().reverse());

  const drafts = filterRows(rows, { tag: null, status: "draft" });
  assert.deepEqual(drafts.map((r) => r.id), [newest.id]);
  assert.equal(filterRows(rows, { tag: null, status: "published" }).length, rows.length - 1);
  const award = filterRows(rows, { tag: "Award", status: null }).map((r) => r.post.title);
  assert.deepEqual(award.sort(), ["IAC 2024, Milan", "PLD Space award"]);
});
