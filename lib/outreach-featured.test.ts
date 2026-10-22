import assert from "node:assert/strict";
import { test } from "node:test";
import { publicVersion } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyOutreachStore, dummyPhotoFiles, parseOutreachEdits, serializeOutreachEdits, type DummyOutreachEdits } from "@/lib/dummy-data/outreach";
import { featuredCard, slugOf } from "./outreach";
import { outreachEditor, publicOutreach } from "./outreach-editor";
import {
  FEATURE_LOCKED,
  FEATURED_FULL,
  featuredCardFeature,
  featuredOpen,
  featureStateOf,
  isFeatured,
  listedCardFeature,
  runFeatureMove,
  unfeaturing,
  withFeatured,
  type CardFeature,
} from "./outreach-featured";
import { isLive, outreachRow } from "./outreach-list";
import { titleOf } from "./outreach-types";

// Feature and Unfeature on the edit shell's Outreach list (issues #431,
// #496): each card names the post it moves, and the move goes through the
// outreach editor's own gate, as the list menu's does.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

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

/** The editor over a fresh store, and what the editor page is handed and shows from it. */
async function opened() {
  const editor = outreachEditor(admin, dummyOutreachStore(cookie()), dummyPhotoFiles);
  const read = async () => {
    const posts = (await editor.posts.list())!;
    const featured = await editor.featured();
    return { posts, featured, shown: publicOutreach({ posts, featured, tags: (await editor.tags())! }) };
  };
  return { editor, read };
}

const asMove = (move: CardFeature | null) => {
  assert.ok(move !== null && move.kind !== "locked", `a move, not ${JSON.stringify(move)}`);
  return move;
};

test("after Unpublish the Outreach list drops the post from its featured state, as the server does, and its row's Feature is locked", async () => {
  const { editor, read } = await opened();
  assert.ok((await editor.feature(1)).ok);
  const before = await read();
  assert.ok(isFeatured(before.featured, 1));

  const unpublished = await editor.posts.unpublish(1);
  assert.ok(unpublished.ok, unpublished.ok ? "" : unpublished.error);
  // What components/dashboard/outreach.tsx keeps after a successful Unpublish (issue #502).
  const kept = unfeaturing(before.featured, 1);
  assert.deepEqual(kept, (await read()).featured, "the page keeps what the server now holds");
  assert.ok(!isFeatured(kept, 1), "its row shows no Featured mark");
  const row = outreachRow(unpublished.value, "row");
  assert.equal(isLive(row.status), false, "so the row offers Feature locked with FEATURE_LOCKED");
  assert.deepEqual(await editor.feature(1), { ok: false, error: FEATURE_LOCKED }, "the server refuses it with the same words");
});

test("Feature on a listed card features that card's post beside the one featured, and the page keeps what the server now shows", async () => {
  const { editor, read } = await opened();
  const before = await read();
  const state = featureStateOf(before.posts, before.featured);
  const card = before.shown.posts[2];

  const result = await runFeatureMove(asMove(listedCardFeature({ slug: slugOf(card), title: titleOf(card) }, null, state.ids, state.featured)), editor);
  assert.ok(result.ok, JSON.stringify(result));

  const after = await read();
  assert.equal(after.featured.length, 2);
  assert.ok(after.shown.featured.some((p) => p.title === card.title));
  const kept = withFeatured(before.shown, state.ids, after.featured);
  assert.deepEqual(
    kept.featured.map((p) => p.title),
    after.shown.featured.map((p) => p.title),
  );
  assert.deepEqual(new Set(kept.posts.map((p) => p.title)), new Set(after.shown.posts.map((p) => p.title)));
});

test("while two posts are featured, Feature on every other card is locked with the words the server refuses a third with", async () => {
  const { editor, read } = await opened();
  assert.ok((await editor.feature(1)).ok);
  const { posts, featured, shown } = await read();
  const state = featureStateOf(posts, featured);
  const card = shown.posts[0];
  const locked = listedCardFeature({ slug: slugOf(card), title: titleOf(card) }, null, state.ids, state.featured);
  assert.deepEqual(locked, { kind: "locked", title: card.title, reason: FEATURED_FULL });
  const id = state.ids[slugOf(card)];
  assert.deepEqual(await editor.feature(id), { ok: false, error: FEATURED_FULL });
});

test("Unfeature on a Featured card puts its post back in the list", async () => {
  const { editor, read } = await opened();
  const before = await read();
  const state = featureStateOf(before.posts, before.featured);
  const [story] = before.shown.featured;
  assert.ok(story !== undefined);

  const result = await runFeatureMove(asMove(featuredCardFeature(featuredCard(story), null, state.ids)), editor);
  assert.ok(result.ok, JSON.stringify(result));
  assert.deepEqual(await editor.featured(), []);

  const kept = withFeatured(before.shown, state.ids, []);
  assert.deepEqual(kept.featured, []);
  assert.equal(kept.posts.length, before.shown.posts.length + 1);
});

test("the card of a post being edited features it by its id, and stays off with the gate's reason until it is published", async () => {
  const { editor, read } = await opened();
  const saved = await editor.posts.save(null, "save-draft", async () => {
    const { shown } = await read();
    return { ok: true, value: { ...shown.posts[0], title: "Not yet live" } };
  });
  assert.ok(saved.ok);
  const card = { slug: "not-yet-live", title: "Not yet live" };

  const locked = listedCardFeature(card, { id: saved.value.id, live: false }, {}, [])!;
  assert.deepEqual(locked, { kind: "locked", title: "Not yet live", reason: FEATURE_LOCKED });
  assert.deepEqual(await editor.feature(saved.value.id), { ok: false, error: FEATURE_LOCKED }, "the same words the gate refuses with");

  // A published post being edited under a draft's new title still features itself.
  const { posts } = await read();
  const live = posts.find((item) => publicVersion(item.version) !== null && item.id !== saved.value.id)!;
  const result = await runFeatureMove(asMove(listedCardFeature({ slug: "renamed-in-the-draft", title: "Renamed" }, { id: live.id, live: true }, {}, [])), editor);
  assert.ok(result.ok);
  assert.ok((await editor.featured()).some((id) => id === live.id));
});

test("a refused move comes back as the gate refused it", async () => {
  const { editor } = await opened();
  const result = await runFeatureMove({ kind: "feature", id: 999, title: "Gone" }, editor);
  assert.deepEqual(result, await editor.feature(999));
});

test("a Featured card opens Title and details while its post is the one edited, else that post's own editor", async () => {
  const { read } = await opened();
  const { shown } = await read();
  const [story] = shown.featured;
  assert.ok(story !== undefined);
  const card = featuredCard(story);
  assert.deepEqual(featuredOpen(card, true), { kind: "details" });
  assert.deepEqual(featuredOpen(card, false), { kind: "editor", href: `/dashboard/outreach/${slugOf(story)}` });
});
