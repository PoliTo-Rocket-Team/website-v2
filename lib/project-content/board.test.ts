import assert from "node:assert/strict";
import { test } from "node:test";
import { publicItems } from "@/lib/content/versioned";
import { memoryContentStore } from "@/lib/content/memory";
import { canReach } from "@/lib/dashboard/access";
import { VIEWER_KINDS, type ViewerStanding } from "@/lib/dashboard/viewer";
import { editedLine, type EditStamp } from "./edited";
import { projectEditor } from "./editor";
import { importedProjects } from "./import";
import { homeCardOf, listingOf, type ProjectRecord } from "./record";
import { sectionBlockOf, withSectionBlock } from "./sections";

// The dashboard Projects page (board 75, issue #297): dragging the cards sets
// the site order Home and /projects read, only the site-content editors reach
// it, and each card's "edited by" line.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

/** The moment the lines below count "today" from. */
const NOW = "2026-10-09T16:00:00+02:00";

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

test("each card's line names the last edit, and the one part a draft changes", async () => {
  // The stamps as the database's audit log gives them (readProjectStamps, lib/dashboard/database-projects.ts).
  const stamps = new Map<number, EditStamp>([
    [1, { at: "2026-09-12T11:00:00+02:00", by: "Giulia Rossi" }],
    [3, { at: "2026-10-02T15:00:00+02:00", by: "Elisa Marchi" }],
  ]);
  const store = memoryContentStore(importedProjects());
  const editor = projectEditor(admin, store, { stamps: async () => stamps, now: () => new Date(NOW) });
  const first = await editor.board();
  assert.deepEqual(first?.edited, { 1: "Edited 12 Sep by Giulia Rossi", 3: "Edited 2 Oct by Elisa Marchi" }, "a project with no stamp has no line");

  // Saving a project is an edit: once logged, it reads as edited today, naming the part its draft changes.
  const cavour = importedProjects()[0];
  assert.equal(cavour.version.state, "published");
  if (cavour.version.state !== "published") return;
  const record = cavour.version.published;
  const launches = withSectionBlock(record, "launches", { ...sectionBlockOf(record, "launches")!, title: "Four flights." });
  assert.ok((await editor.save(1, "save-draft", async () => ({ ok: true, value: launches }))).ok);
  stamps.set(1, { at: NOW, by: "Marco Bianchi" });
  assert.equal((await editor.board())?.edited[1], "Launch history edited today by Marco Bianchi");
});

test("the line says only Edited when the draft changes more than one part, and names no one it cannot", () => {
  const [cavour] = importedProjects();
  if (cavour.version.state !== "published") throw new Error("Cavour is published");
  const published = cavour.version.published;
  const draft = { ...published, name: "A new name", description: "A new description." };
  const item = { ...cavour, version: { state: "published" as const, published, draft } };
  const now = new Date(NOW).toISOString();
  assert.equal(editedLine(item, { at: "2026-10-09T09:00:00+02:00", by: "Giulia Rossi" }, now), "Edited today by Giulia Rossi");
  assert.equal(editedLine(cavour, { at: "2026-09-30T09:00:00+02:00", by: null }, now), "Edited 30 Sep");
  assert.equal(editedLine(cavour, undefined, now), null);
});
