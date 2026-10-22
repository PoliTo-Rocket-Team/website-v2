import assert from "node:assert/strict";
import { test } from "node:test";
import { editorVersion } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyOutreachStore, dummyPhotoFiles, parseOutreachEdits, serializeOutreachEdits, type DummyOutreachEdits } from "@/lib/dummy-data/outreach";
import { awardPosts, outreachRecord, postBySlug, slugOf } from "./outreach";
import { outreachEditor, publicOutreach, type OutreachEditor } from "./outreach-editor";
import { importedOutreach } from "./outreach-import";
import { checkPostFields, draftOfFields, postFieldsOf, removePostGalleryPhoto, type PostFields } from "./outreach-post-fields";
import { postColumns, postFromColumns } from "./outreach-rows";
import type { OutreachPost, PostItem } from "./outreach-types";

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

async function firstPost(editor: OutreachEditor): Promise<PostItem> {
  const items = await editor.posts.list();
  assert.ok(items !== null && items.length > 1);
  return items[0];
}

test("Save draft and Publish both refuse a post with no tag, or a channel added with no link", async () => {
  const { editor } = editorOverCookie();
  const item = await firstPost(editor);
  const fields = postFieldsOf(editorVersion(item.version));

  const noTag: PostFields = { ...fields, tags: [] };
  const noLink: PostFields = { ...fields, channels: [{ name: "youtube", url: " ", caption: "The talk" }] };
  for (const step of ["save-draft", "publish"] as const) {
    assert.deepEqual(await editor.savePost(item.id, step, noTag), { ok: false, error: "Pick at least one tag." }, step);
    assert.deepEqual(await editor.savePost(item.id, step, noLink), { ok: false, error: "YouTube: paste the post's link." }, step);
  }
  assert.deepEqual((await firstPost(editor)).version, item.version, "a refused save changes nothing");
});

test("an original post is optional: a post with no channel, or only another one, publishes and reads back from its row", async () => {
  const { editor, shown } = editorOverCookie();
  const item = await firstPost(editor);
  const fields = postFieldsOf(editorVersion(item.version));
  const slug = slugOf(editorVersion(item.version));

  // Owner decision (issue #430): no Instagram or LinkedIn post is needed.
  const none = await editor.savePost(item.id, "publish", { ...fields, channels: [] });
  assert.ok(none.ok);
  assert.deepEqual(postBySlug((await shown()).posts, slug)?.channels, {});
  const bare = editorVersion(none.value.version);
  assert.deepEqual(postFromColumns(JSON.parse(JSON.stringify(postColumns(bare))), [...bare.tags]), bare);

  const youtubeOnly: PostFields = { ...fields, channels: [{ name: "youtube", url: "https://youtube.com/watch?v=1", caption: "The talk" }] };
  const saved = await editor.savePost(item.id, "publish", youtubeOnly);
  assert.ok(saved.ok);
  const post = editorVersion(saved.value.version);
  assert.deepEqual(post.channels, { youtube: { url: "https://youtube.com/watch?v=1", caption: "The talk" } });
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
  const wasAward = (item: PostItem) => editorVersion(item.version).tags.includes("Award");
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

// A post's gallery has no switch and no title (Owner decision, issue #451):
// Save draft and Publish never refuse because of it, a post with no gallery
// photo has no gallery, and the last photo can be taken out.

test("checkPostFields and draftOfFields never refuse because of the gallery, with no photo or with photos and no title", () => {
  const post: OutreachPost = outreachRecord.posts[0];
  const fields = postFieldsOf(post);
  const photo = { src: "/outreach/gallery-one.webp", alt: "", caption: "" };
  const captioned = { src: "/outreach/gallery-two.webp", alt: " Two ", caption: " At the stand " };
  const cases = [
    { gallery: [], saved: undefined },
    { gallery: [photo, captioned], saved: { items: [{ src: photo.src, alt: "" }, { src: captioned.src, alt: "Two", caption: "At the stand" }] } },
  ];
  for (const { gallery, saved } of cases) {
    const checked = checkPostFields({ ...fields, gallery }, post, outreachRecord.tags);
    assert.ok(checked.ok, JSON.stringify(checked));
    assert.deepEqual(checked.value.gallery, saved);
    const drafted = draftOfFields({ ...fields, gallery }, post, outreachRecord.tags);
    assert.ok(drafted.ok, JSON.stringify(drafted));
    assert.deepEqual(drafted.value.gallery, saved);
  }
});

test("the last gallery photo can be removed, and its uploaded file is let go", () => {
  const photo = { src: "/outreach/gallery-one.webp", alt: "", caption: "" };
  assert.deepEqual(removePostGalleryPhoto([photo], 0), { items: [], letGo: [photo.src] });
});
