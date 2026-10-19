import assert from "node:assert/strict";
import { test } from "node:test";
import { publicVersion } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyOutreachStore, dummyPhotoFiles, parseOutreachEdits, serializeOutreachEdits, type DummyOutreachEdits } from "@/lib/dummy-data/outreach";
import { outreachRecord, postBySlug, slugOf } from "./outreach";
import { outreachEditor, publicOutreach, type OutreachStore } from "./outreach-editor";
import { filterRows, newestRowsFirst, outreachRow } from "./outreach-list";
import { outreachPostOf } from "./outreach-rows";
import { checkSummitFields, summitFieldsOf } from "./outreach-summit-fields";

// The dashboard's Outreach list (board 74, issue #289): Unpublish and Delete
// from a row's menu, the featured summit's Save draft and Publish, and what
// /outreach shows after each. The editor runs over the dummy-data store, the
// one previews and test developers write to.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const member: ViewerStanding = { kind: "member", areaGrant: false, siteContent: false, approveOrders: false };

function freshStore(): OutreachStore {
  const jar = {
    value: undefined as string | undefined,
    get current(): DummyOutreachEdits {
      return parseOutreachEdits(jar.value);
    },
    save: async (next: DummyOutreachEdits) => {
      jar.value = serializeOutreachEdits(next);
    },
  };
  return dummyOutreachStore(jar);
}

/** What /outreach shows from the store as it is now. */
async function site(store: OutreachStore) {
  return publicOutreach({ posts: await store.posts.list(), summit: await store.summit(), tags: await store.tags(), pinned: await store.pinned() });
}

test("Unpublish keeps the post in the list as a draft and takes it off /outreach and its page; Delete removes it from both", async () => {
  const store = freshStore();
  const editor = outreachEditor(admin, store, dummyPhotoFiles);
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
  const id = (await outreachEditor(admin, store, dummyPhotoFiles).posts.list())![0].id;
  const refused = outreachEditor(member, store, dummyPhotoFiles);
  assert.equal((await refused.posts.unpublish(id)).ok, false);
  assert.equal((await refused.posts.remove(id)).ok, false);
  assert.equal((await site(store)).posts.length, outreachRecord.posts.length);
});

test("the summit's Save draft leaves /outreach as it was, and Publish puts the edited summit on it", async () => {
  const store = freshStore();
  const editor = outreachEditor(admin, store, dummyPhotoFiles);
  const fields = summitFieldsOf(outreachRecord.feature);
  const edited = {
    ...fields,
    title: "IRESS, the student summit",
    // Typed newest first; the summit keeps them oldest first.
    editions: [{ year: "2026", place: "Milan" }, ...fields.editions],
  };

  const drafted = await editor.saveSummit("save-draft", async (current) => checkSummitFields(edited, current));
  assert.ok(drafted.ok);
  assert.deepEqual((await site(store)).feature, outreachRecord.feature, "a draft stays off the site");

  const published = await editor.saveSummit("publish", async (current) => checkSummitFields(edited, current));
  assert.ok(published.ok);
  const feature = (await site(store)).feature;
  assert.equal(feature.title, "IRESS, the student summit");
  assert.deepEqual(
    feature.editions.map((e) => e.year),
    [2023, 2024, 2025, 2026],
  );
  assert.equal(feature.photo.src, outreachRecord.feature.photo.src, "the photo file is kept");
  assert.equal(published.value.draft, null);
});

test("the summit is refused without a title, an edition, or with one year twice", () => {
  const fields = summitFieldsOf(outreachRecord.feature);
  const feature = outreachRecord.feature;
  assert.equal(checkSummitFields({ ...fields, title: "  " }, feature).ok, false);
  assert.equal(checkSummitFields({ ...fields, editions: [] }, feature).ok, false);
  assert.equal(checkSummitFields({ ...fields, editions: [...fields.editions, { year: "2024", place: "Bari" }] }, feature).ok, false);
  assert.equal(checkSummitFields({ ...fields, editions: [{ year: "24", place: "Bari" }] }, feature).ok, false);
});

test("the list is newest first, and the Status filter reads a post with draft changes as Draft, as its pill does", async () => {
  const store = freshStore();
  const editor = outreachEditor(admin, store, dummyPhotoFiles);
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
