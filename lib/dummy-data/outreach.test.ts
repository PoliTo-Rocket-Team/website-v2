import assert from "node:assert/strict";
import { test } from "node:test";
import { editorVersion, publicItems, statusOf } from "@/lib/content/versioned";
import { outreachRecord } from "@/lib/outreach";
import { outreachEditor } from "@/lib/outreach-editor";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import {
  dummyOutreachStore,
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
  assert.deepEqual(publicItems(posts), outreachRecord.posts);
  assert.deepEqual((await outreach.summit())?.published, outreachRecord.feature);
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
    value: { ...current!, title: "Wings for Life, Aosta 2025", tags: ["Charity run", "Workshop"] },
  }));
  assert.ok(drafted.ok, drafted.ok ? "" : drafted.error);
  const created = await outreach.posts.save(null, "save-draft", async () => ({
    ok: true,
    value: { ...outreachRecord.posts[2], title: "A new post", date: "2026-10-01" },
  }));
  assert.ok(created.ok, created.ok ? "" : created.error);
  assert.ok((await outreach.saveSummit("save-draft", async (current) => ({ ok: true, value: { ...current, title: "IRESS" } }))).ok);
  assert.ok((await outreach.posts.remove(12)).ok);

  // The next request reads the cookie again.
  const next = outreachEditor(admin, dummyOutreachStore(jar));
  const items = (await next.posts.list())!;
  const first = items.find((i) => i.id === 1)!;
  assert.equal(statusOf(first.version), "draft-changes");
  assert.equal(editorVersion(first.version).title, "Wings for Life, Aosta 2025");
  assert.deepEqual(editorVersion(first.version).tags, ["Charity run", "Workshop"]);
  assert.equal(statusOf(items.find((i) => i.id === created.value.id)!.version), "draft");
  assert.ok(!items.some((i) => i.id === 12));
  assert.equal((await next.summit())?.draft?.title, "IRESS");
  assert.equal((await next.summit())?.published.title, outreachRecord.feature.title);
  assert.deepEqual((await next.tags())?.at(-1), { name: "Workshop", award: false });
  // What the public pages would show is still the record's, less the removed post.
  assert.deepEqual(publicItems(items), outreachRecord.posts.filter((_, i) => i !== 11));
});

test("a cookie this code did not write reads as no changes", () => {
  assert.deepEqual(parseOutreachEdits(undefined), NO_OUTREACH_EDITS);
  assert.deepEqual(parseOutreachEdits("not json"), NO_OUTREACH_EDITS);
  const forgedPost = { posts: { saved: [{ id: 1, siteOrder: 1, version: { state: "draft", draft: { patch: { body: [] } } } }], removed: [], order: [] }, summit: null, tags: [] };
  assert.deepEqual(parseOutreachEdits(encodeURIComponent(JSON.stringify(forgedPost))).posts.saved, []);
  const forgedTag = { posts: { saved: [], removed: [], order: [] }, summit: null, tags: ["Award"] };
  assert.deepEqual(parseOutreachEdits(encodeURIComponent(JSON.stringify(forgedTag))), NO_OUTREACH_EDITS);
  const forgedSummit = { posts: { saved: [], removed: [], order: [] }, summit: { state: "draft", draft: {} }, tags: [] };
  assert.deepEqual(parseOutreachEdits(encodeURIComponent(JSON.stringify(forgedSummit))), NO_OUTREACH_EDITS);
});
