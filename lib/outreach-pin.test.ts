import assert from "node:assert/strict";
import { test } from "node:test";
import { publicVersion } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyOutreachStore, dummyPhotoFiles, parseOutreachEdits, serializeOutreachEdits, type DummyOutreachEdits } from "@/lib/dummy-data/outreach";
import { featuredCard, slugOf } from "./outreach";
import { outreachEditor, publicOutreach } from "./outreach-editor";
import { featuredCardPin, featuredOpen, listedCardPin, pinStateOf, runPinMove, withPinned, type CardPin } from "./outreach-pin";
import { titleOf } from "./outreach-types";

// Pin to top and Unpin on the edit shell's Outreach list (issue #431): each
// card names the post it pins, and the move goes through the outreach
// editor's own gate, as the list menu's does (issue #392).

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
    const pinned = await editor.pinned();
    return { posts, pinned, shown: publicOutreach({ posts, pinned, summit: (await editor.summit())!, tags: (await editor.tags())! }) };
  };
  return { editor, read };
}

const asMove = (pin: CardPin | null) => {
  assert.ok(pin !== null && pin.kind !== "locked", `a move, not ${JSON.stringify(pin)}`);
  return pin;
};

test("Pin to top on a listed card pins that card's post, and the post pinned before goes back to the list", async () => {
  const { editor, read } = await opened();
  const before = await read();
  const pins = pinStateOf(before.posts, before.pinned);
  assert.ok(before.shown.pinned !== null);
  const card = before.shown.posts[2];

  const result = await runPinMove(asMove(listedCardPin({ slug: slugOf(card), title: titleOf(card) }, null, pins.ids)), editor);
  assert.ok(result.ok, JSON.stringify(result));

  const after = await read();
  assert.equal(after.shown.pinned?.title, card.title);
  assert.ok(after.shown.posts.some((p) => p.title === before.shown.pinned!.title), "the post pinned before is listed again");
  // What the editor keeps on its page after the move is what the server now shows.
  const kept = withPinned(before.shown, pins.ids, after.pinned);
  assert.equal(kept.pinned?.title, after.shown.pinned?.title);
  assert.deepEqual(new Set(kept.posts.map((p) => p.title)), new Set(after.shown.posts.map((p) => p.title)));
});

test("Unpin on the Featured card leaves no post pinned, and the page keeps every post in the list", async () => {
  const { editor, read } = await opened();
  const before = await read();
  const pins = pinStateOf(before.posts, before.pinned);
  const feature = featuredCard(before.shown.feature, before.shown.pinned);

  const result = await runPinMove(asMove(featuredCardPin(feature)), editor);
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(await editor.pinned(), null);

  const kept = withPinned(before.shown, pins.ids, null);
  assert.equal(kept.pinned, null);
  assert.equal(kept.posts.length, before.shown.posts.length + 1);
  assert.equal(featuredCardPin(featuredCard(kept.feature, kept.pinned)), null, "the summit alone has nothing to unpin");
});

test("the card of a post being edited pins it by its id, and stays off with the gate's reason until it is published", async () => {
  const { editor, read } = await opened();
  const saved = await editor.posts.save(null, "save-draft", async () => {
    const { shown } = await read();
    return { ok: true, value: { ...shown.posts[0], title: "Not yet live" } };
  });
  assert.ok(saved.ok);
  const card = { slug: "not-yet-live", title: "Not yet live" };

  const locked = listedCardPin(card, { id: saved.value.id, live: false }, {});
  assert.equal(locked?.kind, "locked");
  const refusal = await editor.pin(saved.value.id);
  assert.ok(!refusal.ok);
  assert.equal(locked.kind === "locked" && locked.reason, refusal.error, "the same words the gate refuses with");

  // A published post being edited under a draft's new title still pins itself.
  const { posts } = await read();
  const live = posts.find((item) => publicVersion(item.version) !== null && item.id !== saved.value.id)!;
  const result = await runPinMove(asMove(listedCardPin({ slug: "renamed-in-the-draft", title: "Renamed" }, { id: live.id, live: true }, {})), editor);
  assert.ok(result.ok);
  assert.equal(await editor.pinned(), live.id);
});

test("a refused move comes back as the gate refused it", async () => {
  const { editor } = await opened();
  const result = await runPinMove({ kind: "pin", id: 999, title: "Gone" }, editor);
  assert.deepEqual(result, await editor.pin(999));
});

test("the Featured card opens Title and details while its post is the one edited, else that post's own editor", async () => {
  const { read } = await opened();
  const { shown } = await read();
  const feature = featuredCard(shown.feature, shown.pinned);
  assert.deepEqual(featuredOpen(feature, true), { kind: "details" });
  assert.deepEqual(featuredOpen(feature, false), { kind: "editor", href: `/dashboard/outreach/${slugOf(shown.pinned!)}` });
  assert.equal(featuredOpen(featuredCard(shown.feature, null), false), null, "the summit alone opens no post");
});
