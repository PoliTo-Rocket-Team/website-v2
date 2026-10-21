import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyOutreachStore, dummyPhotoFiles, parseOutreachEdits, serializeOutreachEdits, type DummyOutreachEdits } from "@/lib/dummy-data/outreach";
import { awardPosts, featuredCard, iressStory, outreachRecord, outreachStats, postBySlug, postsWithPages, slugOf, trackRecord } from "./outreach";
import { outreachEditor, publicOutreach, type StoredOutreach } from "./outreach-editor";
import { importedOutreach, outreachImportSql, pinnedStoryImportSql } from "./outreach-import";
import { draftFromColumns, outreachPostOf, postColumns, postFromColumns, summitColumns, summitFromColumns } from "./outreach-rows";
import type { IsoDate, OutreachPost } from "./outreach-types";

// The Outreach store (issue #287): the import that carries lib/outreach.ts
// into the database, the rows it is stored as, the published read the public
// pages make, tags as data, and the editor's rules over an in-memory store.

const drizzle = join(__dirname, "..", "drizzle");
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const member: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false };

/** A cookie that keeps what was saved, as the browser does between requests. */
function cookie() {
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

/** A post as the database hands it back: its JSON columns through a JSON round trip, as jsonb stores them. */
function throughRow(post: OutreachPost): OutreachPost {
  const columns = JSON.parse(JSON.stringify(postColumns(post)));
  return postFromColumns(columns, [...post.tags]);
}

test("migrations 0031 and 0032 come after 0030 in that order, and 0032 holds exactly the import of the record", () => {
  const files = readdirSync(drizzle).filter((f) => f.endsWith(".sql")).sort();
  const at = files.indexOf("0031_outreach.sql");
  assert.ok(at > files.indexOf("0030_application_rejected_at.sql"), files.join(", "));
  assert.equal(files[at + 1], "0032_outreach_audit_and_import.sql");
  const tables = readFileSync(join(drizzle, "0031_outreach.sql"), "utf8");
  for (const table of ["outreach_tags", "outreach_posts", "outreach_post_versions", "outreach_post_tags", "outreach_summit_versions"]) {
    assert.match(tables, new RegExp(`CREATE TABLE "${table}"`), table);
  }
  const migration = readFileSync(join(drizzle, "0032_outreach_audit_and_import.sql"), "utf8");
  assert.ok(migration.trimEnd().endsWith(outreachImportSql()), "regenerate the migration's import from outreachImportSql()");
  // The tag list, the summit, then one statement per post.
  assert.equal(outreachImportSql().split("--> statement-breakpoint").length, 2 + outreachRecord.posts.length);
});

test("migration 0044 adds the pinned flag with its one-pinned index, then holds exactly the import of the pinned summit story", () => {
  const files = readdirSync(drizzle).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.indexOf("0044_outreach_pinned_post.sql") > files.indexOf("0043_efesto_engine_model.sql"), files.join(", "));
  const migration = readFileSync(join(drizzle, "0044_outreach_pinned_post.sql"), "utf8");
  assert.match(migration, /ALTER TABLE "outreach_posts" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;/);
  assert.match(migration, /CREATE UNIQUE INDEX "outreach_posts_one_pinned" ON "outreach_posts" USING btree \("pinned"\) WHERE "outreach_posts"\."pinned";/);
  assert.ok(migration.trimEnd().endsWith(pinnedStoryImportSql()), "regenerate the migration's import from pinnedStoryImportSql()");
});

test("the imports carry every post, tag and the summit as published, the summit's story pinned, and the public pages show the record unchanged", () => {
  const stored = importedOutreach();
  assert.equal(stored.posts.length, outreachRecord.posts.length + 1);
  for (const item of stored.posts) assert.deepEqual({ state: item.version.state, draft: "draft" in item.version ? item.version.draft : null }, { state: "published", draft: null });
  assert.deepEqual(stored.summit, { state: "published", published: outreachRecord.feature, draft: null });
  assert.deepEqual(stored.tags, outreachRecord.tags);
  assert.equal(stored.posts.find((item) => item.id === stored.pinned)?.siteOrder, outreachRecord.posts.length + 1, "the story comes after every record post");

  const shown = publicOutreach(stored);
  assert.deepEqual(shown, { feature: outreachRecord.feature, pinned: iressStory, posts: outreachRecord.posts, tags: outreachRecord.tags });
  // The /outreach header figures and the home Track record cards are the record's: the pinned post counts toward neither.
  assert.deepEqual(outreachStats(shown), outreachStats(outreachRecord));
  assert.deepEqual(trackRecord(shown.posts), trackRecord(outreachRecord.posts));
  // The photos stay at their /outreach/ paths.
  for (const post of postsWithPages(shown)) for (const photo of post.photos) assert.match(photo.src, /^\/outreach\/[a-z0-9-]+\.webp$/);
});

test("the Featured card tells the pinned story as the card showed the summit, and opens its page; with none pinned it is the summit alone", () => {
  const { feature } = outreachRecord;
  const card = featuredCard(feature, iressStory);
  assert.deepEqual(card, {
    eyebrow: feature.eyebrow,
    title: feature.title,
    story: feature.story,
    photo: feature.photo,
    editions: feature.editions,
    slug: "iress-the-italian-rocket-engineering-student-summit",
  });
  assert.equal(postBySlug(postsWithPages(publicOutreach(importedOutreach())), card.slug!)?.title, iressStory.title, "the card's address has a page");
  assert.deepEqual(featuredCard(feature, null), { ...card, slug: null });
});

test("at most one post is pinned: pinning one unpins the one before, only a published post can be pinned, and only site-content editors pin", async () => {
  const editor = outreachEditor(admin, dummyOutreachStore(cookie()), dummyPhotoFiles);
  const story = await editor.pinned();
  assert.ok(story !== null);

  assert.deepEqual(await editor.pin(1), { ok: true, value: null });
  assert.equal(await editor.pinned(), 1);
  const stored = async (): Promise<StoredOutreach> => ({
    posts: (await editor.posts.list())!,
    summit: (await editor.summit())!,
    tags: (await editor.tags())!,
    pinned: await editor.pinned(),
  });
  const shown = publicOutreach(await stored());
  assert.equal(shown.pinned?.title, outreachRecord.posts[0].title);
  assert.ok(!shown.posts.some((p) => p.title === outreachRecord.posts[0].title), "the pinned post leaves the list");
  assert.ok(shown.posts.some((p) => p.title === iressStory.title), "the post pinned before goes back to the list");

  assert.deepEqual(await editor.unpin(), { ok: true, value: null });
  assert.equal(await editor.pinned(), null);
  assert.equal(publicOutreach(await stored()).pinned, null);

  const draft = await editor.posts.save(null, "save-draft", async () => ({ ok: true, value: { ...outreachRecord.posts[0], title: "Not yet live" } }));
  assert.ok(draft.ok);
  assert.deepEqual(await editor.pin(draft.value.id), { ok: false, error: "Publish the post before you pin it." });
  assert.deepEqual(await editor.pin(999), { ok: false, error: "This post was removed. Reload the page." });
  assert.equal(await editor.pinned(), null);

  const refused = outreachEditor(member, dummyOutreachStore(cookie()), dummyPhotoFiles);
  assert.equal(await refused.pinned(), null);
  assert.equal((await refused.pin(1)).ok, false);
  assert.equal((await refused.unpin()).ok, false);
});

test("a pinned post that is not published shows nowhere, and the Featured card falls back to the summit", () => {
  const stored = importedOutreach();
  const posts = stored.posts.map((item) =>
    item.id === stored.pinned && item.version.state === "published" ? { ...item, version: { state: "draft" as const, draft: item.version.published } } : item,
  );
  const shown = publicOutreach({ ...stored, posts });
  assert.equal(shown.pinned, null);
  assert.deepEqual(shown.posts, outreachRecord.posts);
});

test("every record post, the summit's story and the summit read back from their rows as they were", () => {
  for (const post of [...outreachRecord.posts, iressStory]) assert.deepEqual(throughRow(post), post, post.title);
  const summit = JSON.parse(JSON.stringify(summitColumns(outreachRecord.feature)));
  assert.deepEqual(summitFromColumns(summit), outreachRecord.feature);
  // Every tag a record post carries is on the tag list.
  const names = new Set(outreachRecord.tags.map((t) => t.name));
  for (const post of outreachRecord.posts) for (const tag of post.tags) assert.ok(names.has(tag), `${post.title}: ${tag}`);
});

test("a row whose JSON is not a post's is refused, never shown", () => {
  const row = () => JSON.parse(JSON.stringify(postColumns(outreachRecord.posts[0])));
  assert.throws(() => postFromColumns({ ...row(), body: [] }, ["Award"]));
  assert.throws(() => postFromColumns({ ...row(), channels: { instagram: { url: "", caption: "" } } }, ["Award"]));
  assert.throws(() => postFromColumns(row(), []));
  // A gallery's photos are checked as the post's are.
  assert.throws(() => postFromColumns({ ...row(), gallery: { items: [{ src: "javascript:x", alt: "" }] } }, ["Award"]));
  assert.throws(() => postFromColumns({ ...row(), gallery: { items: "none" } }, ["Award"]));
  // Original posts and photo descriptions are optional (issue #430).
  assert.deepEqual(postFromColumns({ ...row(), channels: {} }, ["Award"]).channels, {});
  assert.equal(postFromColumns({ ...row(), photos: [{ ...row().photos[0], alt: "" }] }, ["Award"]).photos[0].alt, "");
});

test("a stored post gallery reads back as its photos only, whatever switch or title a row saved before kept (issue #451)", () => {
  const row = () => JSON.parse(JSON.stringify(postColumns(outreachRecord.posts[0])));
  const photo = { ...row().photos[0], caption: "At the stand" };
  for (const read of [postFromColumns, draftFromColumns]) {
    for (const gallery of [{ shown: false, title: "", items: [photo] }, { shown: true, title: "X", items: [photo] }, { items: [photo] }]) {
      assert.deepEqual(read({ ...row(), gallery }, ["Award"]).gallery, { items: [photo] }, JSON.stringify(gallery));
    }
    // A stored gallery with no photo is no gallery.
    for (const gallery of [{ shown: true, title: "More", items: [] }, { shown: false, title: "", items: [] }, { items: [] }]) {
      assert.equal(read({ ...row(), gallery }, ["Award"]).gallery, undefined, JSON.stringify(gallery));
    }
  }
});

test("/outreach and the post pages show only published posts: a draft-only post is not listed and its page is not found", async () => {
  const stored = importedOutreach();
  const posts = memoryContentStore(stored.posts);
  const editor = outreachEditor(admin, { ...dummyOutreachStore(cookie()), posts }, dummyPhotoFiles);
  const draftOnly: OutreachPost = { ...outreachRecord.posts[0], title: "A post still in draft", date: "2026-10-01" };
  const created = await editor.posts.save(null, "save-draft", async () => ({ ok: true, value: draftOnly }));
  assert.ok(created.ok);
  const changed = await editor.posts.save(1, "save-draft", async (current) => ({ ok: true, value: { ...outreachPostOf(current)!, title: "Changed in a draft" } }));
  assert.ok(changed.ok);

  const shown = publicOutreach({ ...stored, posts: await posts.list() });
  assert.equal(shown.posts.length, outreachRecord.posts.length, "the draft-only post is not listed");
  assert.equal(postBySlug(shown.posts, slugOf(draftOnly)), undefined, "its page is not found");
  assert.equal(postBySlug(shown.posts, slugOf(outreachRecord.posts[0]))?.title, outreachRecord.posts[0].title, "draft changes stay off the site");
  assert.equal(postBySlug(shown.posts, "changed-in-a-draft"), undefined);
  // The home Track record section (issue #293) leaves the draft-only post out, though it is the newest.
  const home = trackRecord(shown.posts);
  assert.ok(home !== null);
  assert.ok(![home.featured, ...home.news].some((p) => p.title === draftOnly.title || p.title === "Changed in a draft"));

  const published = await editor.posts.save(created.value.id, "publish", async (current) => ({ ok: true, value: outreachPostOf(current)! }));
  assert.ok(published.ok);
  const live = publicOutreach({ ...stored, posts: await posts.list() });
  assert.equal(postBySlug(live.posts, slugOf(draftOnly))?.title, draftOnly.title);
  assert.equal(trackRecord(live.posts)?.featured.title, draftOnly.title, "once published, the newest post is the featured card");
});

test("the home Track record section shows the four newest published posts by date, whatever their site order", () => {
  const dated = (title: string, date: IsoDate): OutreachPost => ({ ...outreachRecord.posts[0], title, date });
  const posts = [
    dated("Spring fair", "2025-04-02"),
    dated("Summit", "2025-11-20"),
    dated("Old talk", "2023-01-15"),
    dated("School visit", "2025-05-03"),
    dated("Award night", "2026-02-10"),
    dated("Expo", "2024-09-30"),
  ];
  const home = trackRecord(posts);
  assert.equal(home?.featured.title, "Award night");
  assert.deepEqual(home?.news.map((p) => p.title), ["Summit", "School visit", "Spring fair"]);

  // Fewer than four: every post shows; none: no cards.
  assert.deepEqual(trackRecord(posts.slice(0, 2)), { featured: posts[1], news: [posts[0]] });
  assert.equal(trackRecord([]), null);
});

test("tags are data: a post tagged Award counts toward the award figure, and the award tag is the list's to say", () => {
  const awards = awardPosts(outreachRecord).map((p) => p.title);
  assert.deepEqual(awards, ["IAC 2024, Milan", "PLD Space award"]);
  assert.deepEqual(outreachStats(outreachRecord)[3], { value: "2", label: { text: "AWARDS" } });

  // A new post tagged Award adds one; a new tag that is not the award one adds none.
  const tags = [...outreachRecord.tags, { name: "Workshop", award: false }];
  const won: OutreachPost = { ...outreachRecord.posts[0], title: "A new award", tags: ["Workshop", "Award"] };
  const workshop: OutreachPost = { ...outreachRecord.posts[0], title: "A workshop", tags: ["Workshop"] };
  const content = { ...outreachRecord, tags, posts: [...outreachRecord.posts, won, workshop] };
  assert.deepEqual(outreachStats(content)[3], { value: "3", label: { text: "AWARDS" } });

  // What counts is the tag the list marks, not the word: a renamed award tag still counts.
  const renamed: StoredOutreach["tags"] = outreachRecord.tags.map((t) => (t.award ? { ...t, name: "Prize" } : t));
  const posts = outreachRecord.posts.map((p) => ({ ...p, tags: p.tags.map((t) => (t === "Award" ? "Prize" : t)) as unknown as OutreachPost["tags"] }));
  assert.equal(awardPosts({ tags: renamed, posts }).length, 2);
});

test("the editor keeps a post's tags to the list, adds a tag inline, and lets only site-content editors in", async () => {
  const jar = cookie();
  const editor = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
  const unknown = await editor.posts.save(1, "save-draft", async (current) => ({ ok: true, value: { ...outreachPostOf(current)!, tags: ["Workshop"] } }));
  assert.deepEqual(unknown, { ok: false, error: "Workshop is not a tag. Add it to the tag list first." });

  assert.deepEqual(await editor.addTag(" Workshop "), { ok: true, value: { name: "Workshop", award: false } });
  assert.deepEqual(await editor.addTag("award"), { ok: false, error: "Award is already a tag." });
  assert.deepEqual(await editor.addTag("  "), { ok: false, error: "Write the tag." });
  assert.ok((await editor.posts.save(1, "save-draft", async (current) => ({ ok: true, value: { ...outreachPostOf(current)!, tags: ["Workshop"] } }))).ok);
  assert.deepEqual((await editor.tags())?.at(-1), { name: "Workshop", award: false });

  const refused = outreachEditor(member, dummyOutreachStore(cookie()), dummyPhotoFiles);
  assert.equal(await refused.posts.list(), null);
  assert.equal(await refused.summit(), null);
  assert.equal(await refused.tags(), null);
  assert.equal((await refused.addTag("Workshop")).ok, false);
  assert.equal((await refused.saveSummit("publish", async (current) => ({ ok: true, value: current }))).ok, false);
});

test("the summit keeps its published version under a draft until Publish", async () => {
  const editor = outreachEditor(admin, dummyOutreachStore(cookie()), dummyPhotoFiles);
  const drafted = await editor.saveSummit("save-draft", async (current) => ({ ok: true, value: { ...current, title: "IRESS, drafted" } }));
  assert.ok(drafted.ok);
  assert.equal(drafted.value.published.title, outreachRecord.feature.title);
  assert.equal(drafted.value.draft?.title, "IRESS, drafted");
  const published = await editor.saveSummit("publish", async (current) => ({ ok: true, value: current }));
  assert.ok(published.ok);
  assert.deepEqual(published.value, { state: "published", published: { ...outreachRecord.feature, title: "IRESS, drafted" }, draft: null });
});
