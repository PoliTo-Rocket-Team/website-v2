import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deleteBestEffort } from "./best-effort-delete";

const PATHNAME = "applications/giulia_rossi_cv_u-17.pdf";

function failingStore(message: string) {
  const removed: string[] = [];
  const remove = async (pathname: string) => {
    removed.push(pathname);
    throw new Error(message);
  };
  return { remove, removed };
}

describe("best-effort Blob delete", () => {
  test("a failed delete logs one line with the store, the area and the reason, and does not throw", async () => {
    const store = failingStore("store down");
    const lines: string[] = [];
    await deleteBestEffort({ store: "private", area: "delete-account", pathname: PATHNAME, remove: store.remove }, (line) => lines.push(line));
    assert.deepEqual(store.removed, [PATHNAME]);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /private/);
    assert.match(lines[0], /delete-account/);
    assert.match(lines[0], /store down/);
  });

  test("the line never carries the pathname or file name, even when the error repeats them", async () => {
    const store = failingStore(`Vercel Blob: could not delete ${PATHNAME} (giulia_rossi_cv_u-17.pdf)`);
    const lines: string[] = [];
    await deleteBestEffort({ store: "public", area: "member-photo", pathname: PATHNAME, remove: store.remove }, (line) => lines.push(line));
    assert.equal(lines.length, 1);
    assert.ok(!lines[0].includes(PATHNAME));
    assert.ok(!lines[0].includes("giulia_rossi_cv_u-17.pdf"));
    assert.match(lines[0], /public/);
    assert.match(lines[0], /member-photo/);
  });

  test("a delete that succeeds logs nothing", async () => {
    const lines: string[] = [];
    await deleteBestEffort({ store: "public", area: "partner-logo", pathname: "logos/a.png", remove: async () => undefined }, (line) => lines.push(line));
    assert.deepEqual(lines, []);
  });
});
