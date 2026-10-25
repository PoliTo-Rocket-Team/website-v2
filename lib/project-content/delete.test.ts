import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { publicItems, statusOf } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import type { PhotoFiles } from "@/lib/outreach-photos";
import { projectEditor } from "./editor";
import { fieldsOf } from "./fields";
import { importedProjects, importedRecords } from "./import";
import type { UploadedSrc } from "./record";

// Delete project (issue #768): anyone who edits projects deletes any one, a
// draft, a published project or one with draft changes, and the uploaded
// files only it showed go with it; a file another project shows stays.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

const src = (name: string) => `https://store.public.blob.vercel-storage.com/project-backgrounds/${name}.png` as UploadedSrc;

/** Background files this side stored, each named in `owned`; like the public store, it deletes only its own, and records each. */
function backgroundFiles(owned: readonly UploadedSrc[]) {
  const dropped: string[] = [];
  const owns = (s: string): s is UploadedSrc => owned.includes(s as UploadedSrc);
  const files: PhotoFiles = {
    put: async () => {
      throw new Error("no upload here");
    },
    owns,
    drop: async (srcs) => void dropped.push(...srcs.filter(owns)),
  };
  return { dropped, files };
}

test("deleting a project drops the uploaded files only it showed and keeps the one another project shows", async () => {
  const [onlyVes, shared, onlyEfesto] = [src("ves"), src("shared"), src("efesto")];
  const { dropped, files } = backgroundFiles([onlyVes, shared, onlyEfesto]);
  const editor = projectEditor(admin, memoryContentStore(importedProjects()), undefined, undefined, files);
  const [, ves, efesto] = importedRecords;
  assert.ok((await editor.saveFields(2, "publish", { ...fieldsOf(ves), background: { kind: "upload", tall: onlyVes, wide: shared } })).ok);
  assert.ok((await editor.saveFields(3, "publish", { ...fieldsOf(efesto), background: { kind: "upload", tall: shared, wide: onlyEfesto } })).ok);
  assert.deepEqual(dropped, []);

  assert.ok((await editor.remove(2)).ok);
  assert.deepEqual(dropped, [onlyVes]);
});

test("a draft, a published project and one with draft changes are each deleted, and leave the list and the public site", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const created = await editor.create({ name: "Test rocket", slug: "test-rocket", kind: "vehicle" });
  assert.ok(created.ok);
  const [, ves] = importedRecords;
  assert.ok((await editor.saveFields(2, "save-draft", { ...fieldsOf(ves), background: { kind: "preset", preset: "orange" } })).ok);
  const states = Object.fromEntries((await editor.list())!.map((item) => [item.id, statusOf(item.version)]));
  assert.deepEqual([states[created.value.id], states[1], states[2]], ["draft", "published", "draft-changes"]);

  for (const id of [created.value.id, 1, 2]) assert.deepEqual(await editor.remove(id), { ok: true, value: null }, `project ${id}`);
  const left = (await editor.list())!;
  assert.deepEqual(left.map((item) => item.id), [3]);
  assert.deepEqual(publicItems(left).map((r) => r.name), ["Efesto"]);
});
