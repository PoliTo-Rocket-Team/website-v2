import assert from "node:assert/strict";
import { test } from "node:test";
import { editorVersion, statusOf } from "@/lib/content/versioned";
import { draftFromColumns, postColumns, postFromColumns } from "./outreach-rows";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyOutreachStore, dummyPhotoFiles, parseOutreachEdits, serializeOutreachEdits, type DummyOutreachEdits } from "@/lib/dummy-data/outreach";
import { checklistDone } from "./content/edit-shell";
import { outreachRecord, postBySlug } from "./outreach";
import { outreachEditor, publicOutreach } from "./outreach-editor";
import { importedOutreach } from "./outreach-import";
import { listStatusOf, outreachRow } from "./outreach-list";
import { blankPostFields, publishChecklist, type PostFields } from "./outreach-post-fields";

// New post (board 74f, issue #292), through the outreach editor the server
// action calls, over the dummy-data store previews use: Save draft takes a
// new post as it is, Publish waits on the checklist and the server refuses
// one that fails it, and a title may not take another post's address.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

function fresh() {
  let value: string | undefined;
  const store = dummyOutreachStore({
    get current(): DummyOutreachEdits {
      return parseOutreachEdits(value);
    },
    save: async (next: DummyOutreachEdits) => {
      value = serializeOutreachEdits(next);
    },
  });
  const editor = outreachEditor(admin, store, dummyPhotoFiles);
  const shown = async () => publicOutreach({ ...importedOutreach(), posts: await store.posts.list(), tags: await store.tags() });
  return { editor, shown };
}

/** A new post with everything Publish asks for; the photo is an upload, as a preview answers it. */
const whole: PostFields = {
  ...blankPostFields("2026-10-11"),
  title: "Space Festival, Torino",
  tags: [outreachRecord.tags[0].name],
  lead: "Our rockets at the city's space week.",
  summary: "Our rockets at the city's space week",
  body: [{ kind: "paragraph", text: "We brought two rockets to the festival." }],
  photos: [{ src: "data:image/webp;base64,AAAA", alt: "The team beside a rocket" }],
  channels: [{ name: "instagram", url: "https://www.instagram.com/p/abc/", caption: "Space week!" }],
};

test("Publish waits on each checklist line, and the server refuses a publish that fails one", async () => {
  const blank = publishChecklist(blankPostFields("2026-10-11"));
  assert.deepEqual(
    blank.map((c) => [c.label, c.done]),
    [
      ["Title", false],
      ["At least 1 tag", false],
      ["Cover photo", false],
      ["Some text", false],
      ["An Instagram or LinkedIn link", false],
      ["Date", true],
    ],
  );
  assert.ok(checklistDone(publishChecklist(whole)));

  const missing: [string, Partial<PostFields>][] = [
    ["Title", { title: "  " }],
    ["At least 1 tag", { tags: [] }],
    ["Cover photo", { photos: [] }],
    ["Some text", { body: [] }],
    ["An Instagram or LinkedIn link", { channels: [{ name: "youtube", url: "https://youtu.be/x", caption: "Video" }] }],
    ["Date", { date: "" }],
  ];
  for (const [label, change] of missing) {
    const fields = { ...whole, ...change };
    const checks = publishChecklist(fields);
    assert.deepEqual(
      checks.filter((c) => !c.done).map((c) => c.label),
      [label],
    );
    const { editor, shown } = fresh();
    assert.equal((await editor.savePost(null, "publish", fields)).ok, false, `Publish without: ${label}`);
    assert.equal((await shown()).posts.length, outreachRecord.posts.length);
  }
});

test("a new post saved as a draft is listed as Draft and stays off /outreach until it is published", async () => {
  const { editor, shown } = fresh();
  // Save draft works at any point: an empty post is kept, as "Untitled post".
  const empty = await editor.savePost(null, "save-draft", blankPostFields("2026-10-11"));
  assert.ok(empty.ok);
  assert.equal(outreachRow(empty.value, "untitled-post").post.title, "");
  // The database keeps such a draft and reads it back the same.
  const kept = editorVersion(empty.value.version);
  assert.deepEqual(draftFromColumns(JSON.parse(JSON.stringify(postColumns(kept))), [...kept.tags]), kept);
  assert.throws(() => postFromColumns(JSON.parse(JSON.stringify(postColumns(kept))), []), "a published row must be a whole post");

  const drafted = await editor.savePost(null, "save-draft", { ...whole, photos: [], channels: [] });
  assert.ok(drafted.ok);
  assert.equal(listStatusOf(statusOf(drafted.value.version)), "draft");
  assert.equal(postBySlug((await shown()).posts, "space-festival-torino"), undefined);

  const published = await editor.savePost(drafted.value.id, "publish", whole);
  assert.ok(published.ok);
  assert.equal(listStatusOf(statusOf(published.value.version)), "published");
  assert.equal(postBySlug((await shown()).posts, "space-festival-torino")?.lead, whole.lead);
});

test("a title whose address another post has is refused, and so is the New post page's own", async () => {
  const { editor } = fresh();
  const taken = outreachRecord.posts[0].title;
  const refused = await editor.savePost(null, "save-draft", { ...whole, title: taken.toUpperCase() });
  assert.ok(!refused.ok);
  assert.match(refused.error, /already has the address \/outreach\/.+\. Change the title\./);

  assert.ok((await editor.savePost(null, "save-draft", blankPostFields("2026-10-11"))).ok);
  const secondUntitled = await editor.savePost(null, "save-draft", blankPostFields("2026-10-12"));
  assert.deepEqual(secondUntitled, { ok: false, error: '"Untitled post" already has the address /outreach/untitled-post. Change the title.' });

  assert.deepEqual(await editor.savePost(null, "save-draft", { ...whole, title: "New" }), {
    ok: false,
    error: "The address /outreach/new is kept for the dashboard. Change the title.",
  });
});
