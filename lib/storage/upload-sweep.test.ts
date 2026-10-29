import assert from "node:assert/strict";
import { test } from "node:test";
import type { PublicPathname } from "./pathname";
import { EDITOR_UPLOAD_PREFIXES, sweepUnusedUploads, UPLOAD_KEPT_MS, type ListedUpload } from "./upload-sweep";

// The daily sweep of editor uploads no save kept (issue #831).

const NOW = new Date("2026-10-29T04:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const DAY = UPLOAD_KEPT_MS;

/** A store over `files`, where `named` are the files some row names; it records each delete. */
function store(files: readonly ListedUpload[], named: readonly string[] = [], failing: readonly string[] = []) {
  const removed: string[] = [];
  return {
    removed,
    store: {
      list: async (prefix: string) => files.filter((f) => f.pathname.startsWith(prefix)),
      unreferenced: async (pathnames: readonly PublicPathname[]) => pathnames.filter((p) => !named.includes(p)),
      remove: async (pathname: PublicPathname) => {
        if (failing.includes(pathname)) throw new Error("Blob is down");
        removed.push(pathname);
      },
    },
  };
}

test("the sweep reads the Team page's, Outreach's, the projects' and the partners' upload folders, and no member or alumni photo", () => {
  assert.deepEqual(EDITOR_UPLOAD_PREFIXES, ["photos/team-page-", "post-photos/", "project-photos/", "project-backgrounds/", "logos/"]);
});

test("an upload a day old that no row names is deleted; a newer one, or one a row names, stays", async () => {
  const files = [
    { pathname: "post-photos/old.jpg", uploadedAt: ago(DAY + 1) },
    { pathname: "post-photos/new.jpg", uploadedAt: ago(DAY - 1) },
    { pathname: "project-photos/saved.jpg", uploadedAt: ago(3 * DAY) },
    { pathname: "photos/team-page-left.jpg", uploadedAt: ago(DAY) },
    { pathname: "project-backgrounds/left.webp", uploadedAt: ago(2 * DAY) },
  ];
  const { removed, store: s } = store(files, ["project-photos/saved.jpg"]);
  assert.deepEqual(await sweepUnusedUploads(NOW, s), { deleted: 3, failed: 0 });
  assert.deepEqual(removed.sort(), ["photos/team-page-left.jpg", "post-photos/old.jpg", "project-backgrounds/left.webp"]);
});

test("a member's own photo in the same folder is never swept", async () => {
  const { removed, store: s } = store([{ pathname: "photos/116-a.jpg", uploadedAt: ago(10 * DAY) }]);
  assert.deepEqual(await sweepUnusedUploads(NOW, s), { deleted: 0, failed: 0 });
  assert.deepEqual(removed, []);
});

test("a failed delete is counted and logged without the file's name, and the rest still go", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const files = [
    { pathname: "post-photos/stuck.jpg", uploadedAt: ago(2 * DAY) },
    { pathname: "post-photos/fine.jpg", uploadedAt: ago(2 * DAY) },
  ];
  const { removed, store: s } = store(files, [], ["post-photos/stuck.jpg"]);
  assert.deepEqual(await sweepUnusedUploads(NOW, s), { deleted: 1, failed: 1 });
  assert.deepEqual(removed, ["post-photos/fine.jpg"]);
  assert.deepEqual(log.mock.calls.map((c) => c.arguments), [["Blob delete failed (store: public, area: unused-upload): Blob is down"]]);
});
