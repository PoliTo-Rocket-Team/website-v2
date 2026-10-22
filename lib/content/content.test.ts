import assert from "node:assert/strict";
import { test } from "node:test";
import { canReach } from "@/lib/dashboard/access";
import { VIEWER_KINDS, type ViewerStanding } from "@/lib/dashboard/viewer";
import { written } from "@/lib/dashboard/write";
import { contentEditor } from "./editor";
import { maySiteContent } from "./gate";
import { memoryContentStore } from "./memory";
import { moveTo, reorderedSlots } from "./order";
import { publicItems, statusOf, versionedFromRows, versionRows, type ContentItem, type Versioned } from "./versioned";

// The shared content foundation (issue #256) with a content type of its own,
// so nothing here leans on partners: a note with a group.
type Note = { title: string; group: "a" | "b" };

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

function seed(): ContentItem<Note>[] {
  return [
    { id: 1, siteOrder: 1, version: { state: "published", published: { title: "one", group: "a" }, draft: null } },
    { id: 2, siteOrder: 2, version: { state: "published", published: { title: "two", group: "b" }, draft: null } },
    { id: 3, siteOrder: 3, version: { state: "published", published: { title: "three", group: "a" }, draft: null } },
    { id: 4, siteOrder: 4, version: { state: "draft", draft: { title: "four", group: "a" } } },
  ];
}

const as = (content: Note) => async () => written(content);

test("Save draft on a published item keeps the public version until Publish", async () => {
  const store = memoryContentStore(seed());
  const editor = contentEditor(admin, store);

  const drafted = await editor.save(1, "save-draft", as({ title: "one, edited", group: "a" }));
  assert.ok(drafted.ok);
  assert.equal(statusOf(drafted.value.version), "draft-changes");
  assert.deepEqual(publicItems(await store.list()).map((n) => n.title), ["one", "two", "three"]);

  const published = await editor.save(1, "publish", as({ title: "one, edited", group: "a" }));
  assert.ok(published.ok);
  assert.equal(statusOf(published.value.version), "published");
  assert.deepEqual(publicItems(await store.list()).map((n) => n.title), ["one, edited", "two", "three"]);
});

test("the panel opens on the draft, and a new item saved as a draft never reaches the public site", async () => {
  const store = memoryContentStore(seed());
  const editor = contentEditor(admin, store);
  let opened: Note | null = null;
  await editor.save(1, "save-draft", as({ title: "draft", group: "a" }));
  await editor.save(1, "save-draft", async (current) => {
    opened = current;
    return written({ title: "draft 2", group: "a" });
  });
  assert.deepEqual(opened, { title: "draft", group: "a" });

  const created = await editor.save(null, "save-draft", as({ title: "five", group: "b" }));
  assert.ok(created.ok);
  assert.equal(statusOf(created.value.version), "draft");
  assert.equal(created.value.siteOrder, 5, "a new item goes last");
  assert.ok(!publicItems(await store.list()).some((n) => n.title === "five"));
});

test("the public site shows published items only, in site order", () => {
  const items = seed().reverse();
  assert.deepEqual(publicItems(items).map((n) => n.title), ["one", "two", "three"]);
});

test("the gate lets in full access and site-content access, and refuses everyone else before preparing anything", async () => {
  for (const kind of VIEWER_KINDS) {
    for (const siteContent of [false, true]) {
      const viewer = (kind === "operations-lead" ? { kind, seat: null, siteContent, approveOrders: false } : kind === "non-member" ? { kind, siteContent: false, approveOrders: false } : { kind, siteContent, approveOrders: false }) as ViewerStanding;
      const allowed = kind === "operations-lead" || (siteContent && kind !== "non-member");
      assert.equal(maySiteContent(viewer), allowed, JSON.stringify(viewer));
      // The page and its writes read one rule.
      assert.equal(canReach(viewer, "partners"), allowed, JSON.stringify(viewer));

      const store = memoryContentStore(seed());
      const editor = contentEditor(viewer, store);
      let prepared = false;
      const save = await editor.save(1, "publish", async () => {
        prepared = true;
        return written({ title: "x", group: "a" });
      });
      assert.equal(save.ok, allowed);
      assert.equal(prepared, allowed, "nothing sent is used before the gate");
      assert.equal((await editor.remove(2)).ok, allowed);
      assert.equal((await editor.reorder((n) => n.group === "a", [3, 1, 4])).ok, allowed);
      assert.equal((await editor.list()) === null, !allowed);
    }
  }
});

test("reordering one group keeps the slots it held, so the other group does not move", async () => {
  const store = memoryContentStore(seed());
  const editor = contentEditor(admin, store);
  assert.ok((await editor.reorder((n) => n.group === "a", [4, 3, 1])).ok);
  const order = [...(await store.list())].sort((a, b) => a.siteOrder - b.siteOrder).map((i) => i.id);
  assert.deepEqual(order, [4, 2, 3, 1]);
});

test("a reorder that is not exactly the group's items is refused as stale", () => {
  const items = seed();
  const inA = (i: ContentItem<Note>) => i.version.state === "draft" || i.version.published.group === "a";
  assert.equal(reorderedSlots(items, inA, [1, 3]).ok, false);
  assert.equal(reorderedSlots(items, inA, [1, 3, 4, 2]).ok, false);
  assert.equal(reorderedSlots(items, inA, [1, 1, 3]).ok, false);
  assert.deepEqual(reorderedSlots(items, inA, [3, 1, 4]), {
    ok: true,
    value: [
      { id: 3, siteOrder: 1 },
      { id: 1, siteOrder: 3 },
      { id: 4, siteOrder: 4 },
    ],
  });
});

test("moveTo puts an id at a place in the list", () => {
  assert.deepEqual(moveTo([1, 2, 3], 3, 0), [3, 1, 2]);
  assert.deepEqual(moveTo([1, 2, 3], 1, 9), [2, 3, 1]);
  assert.deepEqual(moveTo([1, 2, 3], 7, 0), [1, 2, 3]);
});

test("removing an item that is gone is refused, and a store that refuses a write changes nothing", async () => {
  const editor = contentEditor(admin, memoryContentStore(seed()));
  assert.equal((await editor.remove(99)).ok, false);
  assert.equal((await editor.save(99, "publish", as({ title: "x", group: "a" }))).ok, false);

  const full = memoryContentStore(seed(), async () => "full");
  const refusing = contentEditor(admin, full);
  assert.deepEqual(await refusing.save(1, "publish", as({ title: "x", group: "a" })), { ok: false, error: "full" });
  assert.deepEqual(publicItems(await full.list()).map((n) => n.title), ["one", "two", "three"]);
});

test("an item's versions survive the round trip through their rows", () => {
  for (const item of seed()) assert.deepEqual(versionedFromRows(versionRows(item.version)), item.version);
  const withDraft: Versioned<Note> = { state: "published", published: { title: "p", group: "a" }, draft: { title: "d", group: "b" } };
  assert.deepEqual(versionedFromRows(versionRows(withDraft)), withDraft);
  assert.equal(versionedFromRows([]), null);
});
