import assert from "node:assert/strict";
import { test } from "node:test";
import { editorVersion, type ContentItem } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyOutreachStore, dummyPhotoFiles, parseOutreachEdits, serializeOutreachEdits, type DummyOutreachEdits } from "@/lib/dummy-data/outreach";
import { awardPosts, postBySlug, slugOf } from "./outreach";
import { outreachEditor, publicOutreach, type OutreachEditor } from "./outreach-editor";
import { importedOutreach } from "./outreach-import";
import { postFieldsOf, type PostFields } from "./outreach-post-fields";
import { postColumns, postFromColumns } from "./outreach-rows";
import type { OutreachPost } from "./outreach-types";

// The Edit post panel's writes (boards 74c, 74d and 74h, issue #290): the
// rules both buttons enforce, tags added inline, and what Save draft and
// Publish leave on the public pages. Run over the dummy-data store, the one
// previews use, through the outreach editor the server action calls.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

function editorOverCookie(): { editor: OutreachEditor; shown: () => Promise<ReturnType<typeof publicOutreach>> } {
  let value: string | undefined;
  const jar = {
    get current(): DummyOutreachEdits {
      return parseOutreachEdits(value);
    },
    save: async (next: DummyOutreachEdits) => {
      value = serializeOutreachEdits(next);
    },
  };
  const store = dummyOutreachStore(jar);
  const editor = outreachEditor(admin, store, dummyPhotoFiles);
  const shown = async () => publicOutreach({ ...importedOutreach(), posts: await store.posts.list(), tags: await store.tags() });
  return { editor, shown };
}

async function firstPost(editor: OutreachEditor): Promise<ContentItem<OutreachPost>> {
  const items = await editor.posts.list();
  assert.ok(items !== null && items.length > 1);
  return items[0];
}

test("Save draft and Publish both refuse a post with no tag, or with no Instagram or LinkedIn post", async () => {
  const { editor } = editorOverCookie();
  const item = await firstPost(editor);
  const fields = postFieldsOf(editorVersion(item.version));

  const noTag: PostFields = { ...fields, tags: [] };
  const youtubeOnly: PostFields = { ...fields, channels: [{ name: "youtube", url: "https://youtube.com/watch?v=1", caption: "The talk" }] };
  for (const step of ["save-draft", "publish"] as const) {
    assert.deepEqual(await editor.savePost(item.id, step, noTag), { ok: false, error: "Pick at least one tag." }, step);
    assert.deepEqual(await editor.savePost(item.id, step, { ...fields, channels: [] }), { ok: false, error: "Add the Instagram or LinkedIn post." }, step);
    assert.deepEqual(await editor.savePost(item.id, step, youtubeOnly), { ok: false, error: "Add the Instagram or LinkedIn post." }, step);
  }
  assert.deepEqual((await firstPost(editor)).version, item.version, "a refused save changes nothing");

  // An extra channel beside Instagram or LinkedIn is kept, and reads back from its row.
  const withYoutube: PostFields = { ...fields, channels: [...fields.channels, ...youtubeOnly.channels] };
  const saved = await editor.savePost(item.id, "publish", withYoutube);
  assert.ok(saved.ok);
  const post = editorVersion(saved.value.version);
  assert.deepEqual(post.channels.youtube, { url: "https://youtube.com/watch?v=1", caption: "The talk" });
  assert.deepEqual(postFromColumns(JSON.parse(JSON.stringify(postColumns(post))), [...post.tags]), post);
});

test("a tag typed inline joins the tag data, another post can pick it, and Award still feeds the award count", async () => {
  const { editor, shown } = editorOverCookie();
  const [first, second] = (await editor.posts.list())!;
  const awardsBefore = awardPosts(await shown()).length;

  assert.deepEqual(await editor.addTag("Workshop"), { ok: true, value: { name: "Workshop", award: false } });
  assert.deepEqual((await editor.tags())?.at(-1), { name: "Workshop", award: false });

  // The post it was typed on, and then another one, carry it.
  const onFirst = postFieldsOf(editorVersion(first.version));
  assert.ok((await editor.savePost(first.id, "publish", { ...onFirst, tags: ["Workshop"] })).ok);
  const onSecond = postFieldsOf(editorVersion(second.version));
  const picked = await editor.savePost(second.id, "publish", { ...onSecond, tags: ["Workshop", "Award"] });
  assert.ok(picked.ok);
  assert.deepEqual(editorVersion(picked.value.version).tags, ["Workshop", "Award"]);

  // Award counts by the tag list's mark, not by any new tag.
  const after = await shown();
  const wasAward = (item: ContentItem<OutreachPost>) => editorVersion(item.version).tags.includes("Award");
  const expected = awardsBefore - (wasAward(first) ? 1 : 0) + (wasAward(second) ? 0 : 1);
  assert.equal(awardPosts(after).length, expected);
  assert.ok(awardPosts(after).some((p) => p.title === editorVersion(second.version).title));
});

test("Save draft keeps the published post live; Publish replaces it", async () => {
  const { editor, shown } = editorOverCookie();
  const item = await firstPost(editor);
  const published = editorVersion(item.version);
  const fields: PostFields = { ...postFieldsOf(published), title: "Renamed in a draft", lead: "A new lead." };

  const drafted = await editor.savePost(item.id, "save-draft", fields);
  assert.ok(drafted.ok);
  assert.equal(drafted.value.version.state, "published");
  assert.equal(editorVersion(drafted.value.version).title, "Renamed in a draft", "the panel reopens on the draft");
  const live = await shown();
  assert.equal(postBySlug(live.posts, slugOf(published))?.lead, published.lead, "the public page still shows the published post");
  assert.equal(postBySlug(live.posts, "renamed-in-a-draft"), undefined);

  const replaced = await editor.savePost(item.id, "publish", fields);
  assert.ok(replaced.ok);
  assert.deepEqual(replaced.value.version.state === "published" && replaced.value.version.draft, null);
  const after = await shown();
  assert.equal(postBySlug(after.posts, "renamed-in-a-draft")?.lead, "A new lead.");
  assert.equal(postBySlug(after.posts, slugOf(published)), undefined);
});
