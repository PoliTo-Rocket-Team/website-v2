import assert from "node:assert/strict";
import { test } from "node:test";
import { publicItems } from "@/lib/content/versioned";
import { memoryContentStore } from "@/lib/content/memory";
import { canReach } from "@/lib/dashboard/access";
import { VIEWER_KINDS, type ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyProjectHistory, dummyProjectSeed, dummyProjectStore, parseProjectEdits, serializeProjectEdits, type DummyProjectEdits, type DummyProjectEditsStore } from "@/lib/dummy-data/projects";
import { DUMMY_NOW } from "@/lib/dummy-data/team";
import { editedLine } from "./edited";
import { projectEditor } from "./editor";
import { importedProjects } from "./import";
import { homeCardOf, listingOf, type ProjectRecord } from "./record";

// The dashboard Projects page (board 75, issue #297): dragging the cards sets
// the site order Home and /projects read, only the site-content editors reach
// it, a preview keeps the order across a reload, and each card's "edited by"
// line.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

/** A cookie that keeps what was saved, as the browser does between requests. */
function cookie(): DummyProjectEditsStore {
  const jar = {
    value: undefined as string | undefined,
    get current(): DummyProjectEdits {
      return parseProjectEdits(jar.value);
    },
    save: async (next: DummyProjectEdits) => {
      jar.value = serializeProjectEdits(next);
    },
  };
  return jar;
}

const names = (records: readonly ProjectRecord[]) => records.map((r) => r.name);

test("dragging the cards sets the site order the home Projects section and /projects read", async () => {
  const store = memoryContentStore(importedProjects());
  const editor = projectEditor(admin, store);
  assert.ok((await editor.setSiteOrder([3, 1, 2])).ok);

  // Home and /projects both draw publishedProjects(): the published records in site order.
  const shown = publicItems(await store.list());
  assert.deepEqual(names(shown), ["Efesto", "Cavour", "VES"]);
  assert.deepEqual(shown.map((r, i) => homeCardOf(r, i).num), ["01", "02", "03"]);
  assert.deepEqual(shown.map((r, i) => listingOf(r, i).name), ["Efesto", "Cavour", "VES"]);

  // The board lists them in the same order.
  const board = await editor.board();
  assert.deepEqual(board?.items.map((i) => i.id), [3, 1, 2]);
});

test("a site order that leaves out a project, or names one twice, is refused as stale and moves nothing", async () => {
  const store = memoryContentStore(importedProjects());
  const editor = projectEditor(admin, store);
  assert.equal((await editor.setSiteOrder([2, 1])).ok, false);
  assert.equal((await editor.setSiteOrder([2, 2, 1])).ok, false);
  assert.deepEqual(names(publicItems(await store.list())), ["Cavour", "VES", "Efesto"]);
});

test("only the full admins and holders of site-content access reach the page; everyone else is refused", async () => {
  for (const kind of VIEWER_KINDS) {
    for (const siteContent of [false, true]) {
      const viewer = (
        kind === "operations-lead"
          ? { kind, seat: null, siteContent, approveOrders: false }
          : kind === "non-member"
            ? { kind, siteContent: false, approveOrders: false }
            : { kind, siteContent, approveOrders: false }
      ) as ViewerStanding;
      const allowed = kind === "operations-lead" || (siteContent && kind !== "non-member");
      // The sidebar item and the page's not found read this one rule.
      assert.equal(canReach(viewer, "projects"), allowed, JSON.stringify(viewer));

      const store = memoryContentStore(importedProjects());
      const editor = projectEditor(viewer, store);
      assert.equal((await editor.board()) === null, !allowed, JSON.stringify(viewer));
      assert.equal((await editor.setSiteOrder([3, 2, 1])).ok, allowed, JSON.stringify(viewer));
      assert.deepEqual(names(publicItems(await store.list())), allowed ? ["Efesto", "VES", "Cavour"] : ["Cavour", "VES", "Efesto"]);
    }
  }
});

test("a test developer's new order is kept across a reload, and the public pages there keep the seed's", async () => {
  const jar = cookie();
  const before = projectEditor(admin, dummyProjectStore(jar));
  assert.ok((await before.setSiteOrder([2, 3, 1])).ok);

  // A reload opens a new store from what the cookie kept.
  const reloaded = await projectEditor(admin, dummyProjectStore(jar)).board();
  assert.deepEqual(reloaded?.items.map((i) => i.id), [2, 3, 1]);
  assert.deepEqual(names(publicItems(dummyProjectSeed())), ["Cavour", "VES", "Efesto"]);
});

test("each card's line names the last edit, and the one part a draft changes", async () => {
  const jar = cookie();
  const editor = projectEditor(admin, dummyProjectStore(jar), dummyProjectHistory(jar, "Marco Bianchi"));
  const first = await editor.board();
  assert.deepEqual(first?.edited, {
    1: "Edited 12 Sep by Giulia Rossi",
    2: "Top of the page edited today by Marco Bianchi",
    3: "Edited 2 Oct by Elisa Marchi",
  });

  // Moving a card is not an edit.
  assert.ok((await editor.setSiteOrder([3, 2, 1])).ok);
  assert.deepEqual((await editor.board())?.edited, first?.edited);

  // Saving a project is: it reads as edited today by whoever saved it.
  const cavour = importedProjects()[0];
  assert.equal(cavour.version.state, "published");
  if (cavour.version.state !== "published") return;
  const launches = { ...cavour.version.published, launches: { ...(cavour.version.published as { launches: object }).launches, title: "Four flights." } } as ProjectRecord;
  assert.ok((await editor.save(1, "save-draft", async () => ({ ok: true, value: launches }))).ok);
  assert.equal((await editor.board())?.edited[1], "Launch history edited today by Marco Bianchi");
});

test("the line says only Edited when the draft changes more than one part, and names no one it cannot", () => {
  const [cavour] = importedProjects();
  if (cavour.version.state !== "published") throw new Error("Cavour is published");
  const published = cavour.version.published;
  const draft = { ...published, name: "A new name", description: "A new description." };
  const item = { ...cavour, version: { state: "published" as const, published, draft } };
  const now = new Date(DUMMY_NOW).toISOString();
  assert.equal(editedLine(item, { at: "2026-10-09T09:00:00+02:00", by: "Giulia Rossi" }, now), "Edited today by Giulia Rossi");
  assert.equal(editedLine(cavour, { at: "2026-09-30T09:00:00+02:00", by: null }, now), "Edited 30 Sep");
  assert.equal(editedLine(cavour, undefined, now), null);
});
