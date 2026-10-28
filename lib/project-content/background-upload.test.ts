import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { publicItems } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { publicStorePanelPhotos, type PhotoFiles, type PublicFiles } from "@/lib/outreach-photos";
import { publicStoreHost, type PublicPathname } from "@/lib/storage/pathname";
import { projectEditor } from "./editor";
import { fieldsOf, readProjectFields } from "./fields";
import { importedProjects, importedRecords } from "./import";
import { BACKGROUND_CROP_MAX_BYTES, homeCardOf, landingCardOf, listingOf, type UploadedSrc } from "./record";

// An uploaded project background (board 93f, issue #529): its Tall and Wide
// crops go to the public store under the backgrounds' own folder and nowhere
// else, the server takes only a JPEG, PNG or WebP crop of at most 4 MB, a save
// takes only crops this side stored, and once published the Home card draws
// the Tall crop and the page and the Projects list the Wide one.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const member: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false };

const HOST = publicStoreHost("store_abc123");
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const crop = (bytes: Uint8Array) => ({ name: "crop.png", contentType: "image/png", bytes });

/** A public store that records each write and answers its URL on `HOST`. */
function recordingStore() {
  const written: string[] = [];
  const removed: string[] = [];
  const writes: PublicFiles = {
    upload: async (pathname: PublicPathname) => {
      written.push(pathname);
      return { url: `https://${HOST}/${pathname}` };
    },
    remove: async (pathname: PublicPathname) => void removed.push(pathname),
    uploadedAt: async (pathname) => (removed.includes(pathname) ? null : new Date()),
    unreferenced: async (pathnames) => pathnames,
  };
  let n = 0;
  return { written, removed, files: publicStorePanelPhotos("project-background", HOST, writes, () => `bg${++n}`) };
}

test("a background crop is written only under the public store's project-backgrounds/ folder", async () => {
  const store = recordingStore();
  const editor = projectEditor(admin, memoryContentStore(importedProjects()), undefined, undefined, store.files);
  const tall = await editor.uploadBackground(crop(PNG));
  const wide = await editor.uploadBackground(crop(PNG));
  assert.deepEqual(store.written, ["project-backgrounds/bg1.png", "project-backgrounds/bg2.png"]);
  assert.deepEqual([tall, wide], [
    { ok: true, value: `https://${HOST}/project-backgrounds/bg1.png` },
    { ok: true, value: `https://${HOST}/project-backgrounds/bg2.png` },
  ]);
});

test("the background files own no path-traversal name, private-store folder, foreign folder or other host", () => {
  const { files } = recordingStore();
  assert.ok(files.owns(`https://${HOST}/project-backgrounds/a1.jpg`));
  for (const src of [
    `https://${HOST}/project-backgrounds/../applications/cv.pdf`,
    `https://${HOST}/project-backgrounds/%2e%2e/applications/cv.pdf`,
    `https://${HOST}/applications/cv.pdf`,
    `https://${HOST}/orders/po-17.pdf`,
    `https://${HOST}/project-photos/a1.jpg`,
    `https://${HOST}/photos/a1.jpg`,
    `https://${HOST}/project-backgrounds/`,
    "https://other.public.blob.vercel-storage.com/project-backgrounds/a1.jpg",
    "/backgrounds/orange-tall.webp",
  ]) {
    assert.equal(files.owns(src), false, src);
  }
});

test("the server refuses a crop of another type or over 4 MB, and a viewer the site-content gate refuses", async () => {
  // 4 MB fits one request under the 4.5 MB body limit, so the limit can be reached (issue #831).
  assert.equal(BACKGROUND_CROP_MAX_BYTES, 4 * 1024 * 1024);
  const store = recordingStore();
  const editor = projectEditor(admin, memoryContentStore(importedProjects()), undefined, undefined, store.files);
  const pdf = new Uint8Array(Buffer.from("%PDF-1.7 a CV"));
  assert.deepEqual(await editor.uploadBackground(crop(pdf)), { ok: false, error: "The background must be a JPEG, PNG or WebP file." });
  const big = new Uint8Array(BACKGROUND_CROP_MAX_BYTES + 1);
  big.set(PNG);
  assert.deepEqual(await editor.uploadBackground(crop(big)), { ok: false, error: "The background must be at most 4 MB." });
  const atLimit = new Uint8Array(BACKGROUND_CROP_MAX_BYTES);
  atLimit.set(PNG);
  assert.ok((await editor.uploadBackground(crop(atLimit))).ok, "4 MB itself is taken");
  assert.equal((await projectEditor(member, memoryContentStore(importedProjects()), undefined, undefined, store.files).uploadBackground(crop(PNG))).ok, false);
  assert.deepEqual(store.written, ["project-backgrounds/bg1.png"], "only the one accepted crop was written");
});

test("a published upload shows its Tall crop on the Home card and its Wide crop on the page and the Projects list", async () => {
  const store = recordingStore();
  const editor = projectEditor(admin, memoryContentStore(importedProjects()), undefined, undefined, store.files);
  const tall = await editor.uploadBackground(crop(PNG));
  const wide = await editor.uploadBackground(crop(PNG));
  assert.ok(tall.ok && wide.ok);
  const ves = importedRecords[1];
  const sent = readProjectFields(JSON.parse(JSON.stringify({ ...fieldsOf(ves), background: { kind: "upload", tall: tall.value, wide: wide.value } })));
  assert.ok(sent !== null, "a request may name uploaded crops");
  assert.ok((await editor.saveFields(2, "publish", sent)).ok);

  const published = publicItems((await editor.list())!)[1];
  assert.deepEqual(published.background, { kind: "upload", tall: tall.value, wide: wide.value });
  assert.equal(homeCardOf(published, 1).texture, tall.value);
  assert.equal(landingCardOf(published, 1).texture, tall.value);
  assert.equal(listingOf(published, 1).texture, wide.value, "the Projects list and the project page's visual panel");
  assert.deepEqual(fieldsOf(published).background, { kind: "upload", tall: tall.value, wide: wide.value }, "the panel reopens on the upload");
});

test("a save takes only crops this side stored as backgrounds; never a project photo, a site file or a file elsewhere", async () => {
  const photo = `https://${HOST}/project-photos/p1.jpg` as UploadedSrc;
  const photos: PhotoFiles = { put: async () => photo, owns: (src): src is UploadedSrc => src === photo, drop: async () => {}, gone: async () => [] };
  const { files } = recordingStore();
  const ves = importedRecords[1];
  for (const src of [photo, "https://example.com/x.jpg", "data:image/png;base64,AAAA"] as UploadedSrc[]) {
    const store = memoryContentStore(importedProjects());
    const fields = { ...fieldsOf(ves), background: { kind: "upload", tall: src, wide: src } } as const;
    const saved = await projectEditor(admin, store, undefined, photos, files).saveFields(2, "publish", fields);
    assert.deepEqual(saved, { ok: false, error: "The background was not uploaded. Upload it again." }, src);
    assert.deepEqual(await store.list(), importedProjects(), `${src}: nothing was written`);
  }
  for (const src of ["/backgrounds/orange-tall.webp", "/project-photos/cavour/euroc-2023-team.webp", "/textures/../x.webp"]) {
    assert.equal(readProjectFields(JSON.parse(JSON.stringify({ ...fieldsOf(ves), background: { kind: "upload", tall: src, wide: src } }))), null, src);
  }
});

test("an uploaded background's crops are deleted once no version of the project shows them", async () => {
  const store = recordingStore();
  const editor = projectEditor(admin, memoryContentStore(importedProjects()), undefined, undefined, store.files);
  const tall = await editor.uploadBackground(crop(PNG));
  const wide = await editor.uploadBackground(crop(PNG));
  assert.ok(tall.ok && wide.ok);
  const ves = importedRecords[1];
  assert.ok((await editor.saveFields(2, "publish", { ...fieldsOf(ves), background: { kind: "upload", tall: tall.value, wide: wide.value } })).ok);
  assert.deepEqual(store.removed, []);
  assert.ok((await editor.saveFields(2, "publish", { ...fieldsOf(ves), background: { kind: "preset", preset: "orange" } })).ok);
  assert.deepEqual(store.removed.sort(), ["project-backgrounds/bg1.png", "project-backgrounds/bg2.png"]);
});
