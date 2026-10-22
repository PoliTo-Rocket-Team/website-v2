import assert from "node:assert/strict";
import { test } from "node:test";
import { editorVersion, publicItems, statusOf } from "@/lib/content/versioned";
import { iressStory, outreachRecord } from "@/lib/outreach";
import { outreachEditor } from "@/lib/outreach-editor";
import { FEATURED_FULL } from "@/lib/outreach-featured";
import { outreachPostOf } from "@/lib/outreach-rows";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import {
  dummyOutreachStore,
  dummyPhotoFiles,
  NO_OUTREACH_EDITS,
  parseOutreachEdits,
  serializeOutreachEdits,
  type DummyOutreachEdits,
  type DummyOutreachEditsStore,
} from "./outreach";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";

// The Outreach content on previews and in test-developer sessions (issue
// #287): the dummy side, with a test developer's changes in their cookie,
// never a database.

const recruitment = { current: dummyRecruitmentOf(undefined), save: async () => {} };
const changes = { current: EMPTY_DUMMY_STATE, save: async () => {} };
const admin: ViewerStanding = { kind: "operations-lead", seat: "operations-lead", siteContent: false, approveOrders: false };

/** A cookie that keeps what was saved, as the browser does between requests. */
function cookie(): DummyOutreachEditsStore & { value: string | undefined } {
  const jar = {
    value: undefined as string | undefined,
    get current(): DummyOutreachEdits {
      return parseOutreachEdits(jar.value);
    },
    save: async (next: DummyOutreachEdits) => {
      jar.value = serializeOutreachEdits(next);
    },
  };
  return jar;
}

test("the test developer's dashboard reads the imported Outreach content, behind the site-content gate", async () => {
  const outreach = dummyDashboardData("operations-lead", recruitment, changes).outreach;
  const posts = await outreach.posts.list();
  assert.ok(posts !== null);
  assert.deepEqual(publicItems(posts), [...outreachRecord.posts, iressStory]);
  const featured = await outreach.featured();
  assert.equal(featured.length, 1);
  assert.deepEqual(posts.find((i) => i.id === featured[0])?.version, { state: "published", published: iressStory, draft: null }, "the summit's story is featured");
  assert.deepEqual(await outreach.tags(), outreachRecord.tags);

  for (const kind of ["department-head", "division-lead", "member", "non-member"] as const) {
    assert.equal(await dummyDashboardData(kind, recruitment, changes).outreach.posts.list(), null, kind);
  }
});

test("a test developer's writes stay in their cookie, across requests", async () => {
  const jar = cookie();
  const outreach = dummyDashboardData("operations-lead", recruitment, changes, undefined, undefined, undefined, undefined, undefined, jar).outreach;

  assert.ok((await outreach.addTag("Workshop")).ok);
  const drafted = await outreach.posts.save(1, "save-draft", async (current) => ({
    ok: true,
    value: { ...outreachPostOf(current)!, title: "Wings for Life, Aosta 2025", tags: ["Charity run", "Workshop"] },
  }));
  assert.ok(drafted.ok, drafted.ok ? "" : drafted.error);
  const created = await outreach.posts.save(null, "save-draft", async () => ({
    ok: true,
    value: { ...outreachRecord.posts[2], title: "A new post", date: "2026-10-01" },
  }));
  assert.ok(created.ok, created.ok ? "" : created.error);
  assert.ok((await outreach.posts.remove(12)).ok);

  // The next request reads the cookie again.
  const next = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
  const items = (await next.posts.list())!;
  const first = items.find((i) => i.id === 1)!;
  assert.equal(statusOf(first.version), "draft-changes");
  assert.equal(editorVersion(first.version).title, "Wings for Life, Aosta 2025");
  assert.deepEqual(editorVersion(first.version).tags, ["Charity run", "Workshop"]);
  assert.equal(statusOf(items.find((i) => i.id === created.value.id)!.version), "draft");
  assert.ok(!items.some((i) => i.id === 12));
  assert.deepEqual((await next.tags())?.at(-1), { name: "Workshop", award: false });
  // What the public pages would show is still the record's and the summit's story, less the removed post.
  assert.deepEqual(publicItems(items), [...outreachRecord.posts.filter((_, i) => i !== 11), iressStory]);
});

test("a test developer's featured posts stay in their cookie, two at most, and a removed post leaves its place", async () => {
  const jar = cookie();
  const editor = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
  const nextRequest = () => outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles).featured();
  const [story] = await editor.featured();
  assert.ok(story !== undefined);
  assert.ok((await editor.feature(1)).ok);
  assert.deepEqual(await nextRequest(), [story, 1], "the next request reads both");
  assert.deepEqual(await editor.feature(2), { ok: false, error: FEATURED_FULL }, "a third is refused");
  assert.deepEqual(await nextRequest(), [story, 1], "and nothing changed");
  assert.ok((await editor.unfeature(story)).ok);
  assert.deepEqual(await nextRequest(), [1]);
  assert.ok((await editor.posts.remove(1)).ok);
  assert.deepEqual(await nextRequest(), [], "a removed post is featured no more");
});

// Unpublish and Delete free a featured post's slot (Owner decision, issue #502).

test("unpublishing a featured post drops its id from the featured ids in the same cookie write as the post edit", async () => {
  const jar = cookie();
  const editor = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
  const [story] = await editor.featured();
  assert.ok(story !== undefined);
  assert.ok((await editor.feature(1)).ok);

  const saved: DummyOutreachEdits[] = [];
  const watched: DummyOutreachEditsStore = {
    get current() {
      return jar.current;
    },
    save: async (next) => {
      saved.push(next);
      await jar.save(next);
    },
  };
  const unpublished = await outreachEditor(admin, dummyOutreachStore(watched), dummyPhotoFiles).posts.unpublish(1);
  assert.ok(unpublished.ok, unpublished.ok ? "" : unpublished.error);
  assert.equal(saved.length, 1, "one cookie write");
  assert.equal(saved[0].posts.saved.find((item) => item.id === 1)?.version.state, "draft", "it holds the post edit");
  assert.deepEqual(saved[0].featured, [story], "and the featured ids without the post");
  assert.deepEqual(await outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles).featured(), [story], "the next request reads it");
});

test("with two posts featured on the dummy-data path, unpublishing one frees its slot and a third published post can then be featured", async () => {
  const jar = cookie();
  const editor = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
  const [story] = await editor.featured();
  assert.ok((await editor.feature(1)).ok);
  assert.deepEqual(await editor.feature(2), { ok: false, error: FEATURED_FULL });
  assert.ok((await editor.posts.unpublish(1)).ok);
  assert.deepEqual(await editor.feature(2), { ok: true, value: null });
  assert.deepEqual(await outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles).featured(), [story, 2]);
});

test("deleting a featured post on the dummy-data path frees its slot, so a third published post can then be featured", async () => {
  const jar = cookie();
  const editor = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
  const [story] = await editor.featured();
  assert.ok((await editor.feature(1)).ok);
  assert.ok((await editor.posts.remove(1)).ok);
  assert.deepEqual(jar.current.featured, [story], "the same cookie write drops its id");
  assert.deepEqual(await editor.feature(2), { ok: true, value: null });
  assert.deepEqual(await outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles).featured(), [story, 2]);
});

test("a cookie this code did not write reads as no changes", () => {
  assert.deepEqual(parseOutreachEdits(undefined), NO_OUTREACH_EDITS);
  assert.deepEqual(parseOutreachEdits("not json"), NO_OUTREACH_EDITS);
  const forgedPost = { posts: { saved: [{ id: 1, siteOrder: 1, version: { state: "draft", draft: { patch: { body: "not blocks" } } } }], removed: [], order: [] }, tags: [] };
  assert.deepEqual(parseOutreachEdits(encodeURIComponent(JSON.stringify(forgedPost))).posts.saved, []);
  const forgedTag = { posts: { saved: [], removed: [], order: [] }, tags: ["Award"] };
  assert.deepEqual(parseOutreachEdits(encodeURIComponent(JSON.stringify(forgedTag))), NO_OUTREACH_EDITS);
  // A cookie holds two featured posts at most, each once, by id.
  for (const featured of [[1, 2, 3], [1, 1], ["1"], { id: 1 }]) {
    const forged = { posts: { saved: [], removed: [], order: [] }, tags: [], featured };
    assert.deepEqual(parseOutreachEdits(encodeURIComponent(JSON.stringify(forged))), NO_OUTREACH_EDITS, JSON.stringify(featured));
  }
});
