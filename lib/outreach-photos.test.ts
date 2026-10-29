import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, type PublishStep, type Versioned } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { postBySlug, slugOf } from "./outreach";
import { outreachEditor, publicOutreach } from "./outreach-editor";
import { importedOutreach } from "./outreach-import";
import { memoryOutreachStore, memoryPhotoFiles } from "./outreach-memory";
import { postFieldsOf } from "./outreach-post-fields";
import { PHOTO_GONE, publicStorePhotoFiles, type CheckedPhoto, type PhotoFiles, type PublicFiles } from "./outreach-photos";
import { CHANGED_SINCE_READ } from "@/lib/content/editor";
import type { OutreachPost, PhotoSrc } from "./outreach-types";
import { publicStoreHost } from "@/lib/storage/pathname";
import { sweepUnusedUploads, UPLOAD_KEPT_MS } from "@/lib/storage/upload-sweep";

// Post photos (issue #291): a post needs a photo, whose description is
// optional (issue #430), the first photo is the cover, a gallery's photos
// are checked as the post's are, uploads wait for the site-content
// gate, a save takes files only from this deployment's own public store, and a
// file no version of any post shows is deleted.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const member: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false };

const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const upload = { name: "photo.png", contentType: "image/png", bytes: PNG };

test("a photo's description is optional for Save draft and Publish, and the first photo is the post's cover on the public page", async () => {
  const store = memoryOutreachStore();
  const editor = outreachEditor(admin, store, memoryPhotoFiles);
  const item = (await editor.posts.list())![0];
  const fields = postFieldsOf(editorVersion(item.version));

  const uploaded = await editor.uploadPhoto(upload);
  assert.ok(uploaded.ok);
  const undescribed = { ...fields, photos: [{ src: uploaded.value, alt: "  " }, ...fields.photos] };
  for (const step of ["save-draft", "publish"] as const) {
    assert.deepEqual(await editor.savePost(item.id, step, { ...fields, photos: [] }), { ok: false, error: "Add at least one photo." }, step);
  }

  // Owner decision (issue #430): no description is needed; the page draws the photo with alt="".
  assert.ok((await editor.savePost(item.id, "publish", undescribed)).ok);
  const shown = publicOutreach({ ...importedOutreach(), posts: await store.posts.list() });
  const live = postBySlug(shown.posts, slugOf(editorVersion(item.version)));
  assert.deepEqual(live?.photos[0], { src: uploaded.value, alt: "" }, "the new first photo is the cover, with an empty description");
  assert.deepEqual(live?.photos.slice(1), fields.photos, "the photos it had follow in order");
});

test("a post's gallery is saved with the post, its photos checked and kept as the post's are", async () => {
  const store = memoryOutreachStore();
  const editor = outreachEditor(admin, store, memoryPhotoFiles);
  const item = (await editor.posts.list())![0];
  const fields = postFieldsOf(editorVersion(item.version));
  assert.deepEqual(fields.gallery, [], "a post with no gallery opens on no photos");

  const uploaded = await editor.uploadPhoto(upload);
  assert.ok(uploaded.ok);
  const photo = { src: uploaded.value, alt: "", caption: "At the stand" };
  // A save cannot point the gallery at a file nobody uploaded.
  const stray = { src: "https://elsewhere.example.com/x.jpg", alt: "", caption: "" };
  assert.deepEqual(await editor.savePost(item.id, "publish", { ...fields, gallery: [stray] }), {
    ok: false,
    error: "A photo was not uploaded. Add it again.",
  });

  // A gallery has no switch and no title (issue #451): its photos are all it is.
  assert.ok((await editor.savePost(item.id, "publish", { ...fields, gallery: [photo] })).ok);
  const posts = await store.posts.list();
  const live = postBySlug(publicOutreach({ ...importedOutreach(), posts }).posts, slugOf(editorVersion(item.version)));
  assert.deepEqual(live?.gallery, { items: [{ src: uploaded.value, alt: "", caption: "At the stand" }] });
  assert.deepEqual(live?.photos, editorVersion(item.version).photos, "the top photo and the photo grid stay as they were");
});

test("a photo is uploaded only once the site-content gate admits the viewer, and a save cannot point at a file nobody uploaded", async () => {
  const put: CheckedPhoto[] = [];
  const files: PhotoFiles = {
    put: async (photo) => {
      put.push(photo);
      return "https://store.public.blob.vercel-storage.com/post-photos/new.png";
    },
    owns: (src): src is PhotoSrc => src === "https://store.public.blob.vercel-storage.com/post-photos/new.png",
    drop: async () => {},
    gone: async () => [],
  };

  const refused = outreachEditor(member, memoryOutreachStore(), files);
  assert.equal((await refused.uploadPhoto(upload)).ok, false);
  assert.equal(put.length, 0, "nothing is stored for a viewer the gate refuses");

  const editor = outreachEditor(admin, memoryOutreachStore(), files);
  assert.deepEqual(await editor.uploadPhoto({ ...upload, contentType: "image/png", bytes: new TextEncoder().encode("<html>") }), {
    ok: false,
    error: "The photo must be a JPEG, PNG or WebP file.",
  });
  assert.equal(put.length, 0);
  assert.ok((await editor.uploadPhoto(upload)).ok);
  assert.equal(put.length, 1);

  const item = (await editor.posts.list())![0];
  const fields = postFieldsOf(editorVersion(item.version));
  const elsewhere = { ...fields, photos: [{ src: "https://example.com/photo.jpg" as PhotoSrc, alt: "A photo." }] };
  assert.deepEqual(await editor.savePost(item.id, "publish", elsewhere), { ok: false, error: "A photo was not uploaded. Add it again." });
});

const OWN = publicStoreHost("store_Own123");
const ownFile = (name: string) => `https://own123.public.blob.vercel-storage.com/post-photos/${name}` as PhotoSrc;

/**
 * The public store's writes, recorded: what was uploaded and which pathnames
 * were deleted. A deleted file is no longer stored; a file in `named` is one
 * another row names, so no drop deletes it. A file counts as uploaded now,
 * unless `uploadedOn` dates it.
 */
function recordedWrites(named: readonly string[] = [], uploadedOn: ReadonlyMap<string, Date> = new Map()) {
  const removed: string[] = [];
  const writes: PublicFiles = {
    upload: async (pathname) => ({ url: `https://own123.public.blob.vercel-storage.com/${pathname}` }),
    remove: async (pathname) => {
      removed.push(pathname);
    },
    uploadedAt: async (pathname) => (removed.includes(pathname) ? null : (uploadedOn.get(pathname) ?? new Date())),
    unreferenced: async (pathnames) => pathnames.filter((p) => !named.includes(p)),
  };
  return { removed, writes };
}

test("a save accepts an uploaded photo only from this deployment's own public store, and no delete reaches a pathname read off another host", async () => {
  assert.equal(OWN, "own123.public.blob.vercel-storage.com");
  const { removed, writes } = recordedWrites();
  const files = publicStorePhotoFiles(OWN, writes, () => "new");

  const foreign = [
    "https://other456.public.blob.vercel-storage.com/post-photos/a.jpg",
    "https://own123.public.blob.vercel-storage.com.example.com/post-photos/a.jpg",
    "https://own123.public.blob.vercel-storage.com/post-photos/a.jpg?download=1",
    "https://own123.public.blob.vercel-storage.com/logos/a.png",
  ] as PhotoSrc[];
  assert.ok(files.owns(ownFile("a.jpg")));
  for (const src of foreign) assert.ok(!files.owns(src), src);
  assert.ok(!publicStorePhotoFiles(null, writes, () => "new").owns(ownFile("a.jpg")), "with no store configured, no URL is ours");

  await files.drop([...foreign, ownFile("a.jpg")]);
  assert.deepEqual(removed, ["post-photos/a.jpg"], "only the file in our own store is deleted");

  const editor = outreachEditor(admin, memoryOutreachStore(), files);
  const uploaded = await editor.uploadPhoto(upload);
  assert.deepEqual(uploaded, { ok: true, value: ownFile("new.png") });
  const item = (await editor.posts.list())![0];
  const fields = postFieldsOf(editorVersion(item.version));
  assert.deepEqual(
    await editor.savePost(item.id, "publish", { ...fields, photos: [{ src: foreign[0], alt: "A photo." }] }),
    { ok: false, error: "A photo was not uploaded. Add it again." },
    "another Blob store's file cannot ride a save",
  );
  assert.ok((await editor.savePost(item.id, "publish", { ...fields, photos: [{ src: ownFile("new.png"), alt: "A photo." }] })).ok);
});

test("Save, Delete and Remove photo free a stored file only when no version of any post shows it", async () => {
  const [first, second] = importedOutreach().posts;
  const base = editorVersion(first.version) as OutreachPost;
  const site = base.photos[0].src;
  const withPhotos = (...photos: PhotoSrc[]): OutreachPost => {
    const [one, ...rest] = photos.map((src) => ({ src, alt: "A photo." }));
    return { ...base, photos: [one, ...rest] };
  };
  const published = (post: OutreachPost): Versioned<OutreachPost> => ({ state: "published", published: post, draft: null });
  // Post A shows a and b; post B shares a.
  const seed = [
    { ...first, version: published(withPhotos(site, ownFile("a.jpg"), ownFile("b.jpg"))) },
    { ...second, version: published(withPhotos(ownFile("a.jpg"))) },
  ];
  const { removed, writes } = recordedWrites();
  const editor = outreachEditor(admin, { ...memoryOutreachStore(), posts: memoryContentStore(seed) }, publicStorePhotoFiles(OWN, writes, () => "new"));
  const save = (id: number, step: PublishStep, post: OutreachPost) => editor.posts.save(id, step, async () => ({ ok: true, value: post }));

  // A draft on A drops b: the published version still shows it.
  assert.ok((await save(first.id, "save-draft", withPhotos(site))).ok);
  assert.deepEqual(removed, []);
  // Publishing that draft frees b; a stays, because B still shows it; the site photo is no stored file.
  assert.ok((await save(first.id, "publish", withPhotos(site))).ok);
  assert.deepEqual(removed, ["post-photos/b.jpg"]);
  // Remove photo makes the same check: a is still on B.
  assert.ok((await editor.discardPhoto(ownFile("a.jpg"))).ok);
  assert.deepEqual(removed, ["post-photos/b.jpg"]);
  // Deleting B leaves a shown nowhere, so its file goes.
  assert.ok((await editor.posts.remove(second.id)).ok);
  assert.deepEqual(removed, ["post-photos/b.jpg", "post-photos/a.jpg"]);
});

// Issue #831: a stored file goes only when no row names it, and a stale save
// never puts back a photo another save deleted.

/** Post A shows the site photo, a and b, in an editor over the public store's recorded writes. */
function twoPhotoPost(named: readonly string[] = []) {
  const [first] = importedOutreach().posts;
  const base = editorVersion(first.version) as OutreachPost;
  const site = base.photos[0].src;
  const withPhotos = (...photos: PhotoSrc[]): OutreachPost => {
    const [one, ...rest] = photos.map((src) => ({ src, alt: "A photo." }));
    return { ...base, photos: [one, ...rest] };
  };
  const seed = [{ ...first, version: { state: "published", published: withPhotos(site, ownFile("a.jpg"), ownFile("b.jpg")), draft: null } as Versioned<OutreachPost> }];
  const { removed, writes } = recordedWrites(named);
  const editor = outreachEditor(admin, { ...memoryOutreachStore(), posts: memoryContentStore(seed) }, publicStorePhotoFiles(OWN, writes, () => "new"));
  const save = (post: OutreachPost, during?: () => Promise<unknown>) =>
    editor.posts.save(first.id, "publish", async () => {
      await during?.();
      return { ok: true, value: post };
    });
  return { site, withPhotos, removed, save };
}

test("a save leaves a stored file another row still names, such as a member's or a Team page's", async () => {
  const { site, withPhotos, removed, save } = twoPhotoPost(["post-photos/b.jpg"]);
  assert.ok((await save(withPhotos(site))).ok);
  assert.deepEqual(removed, ["post-photos/a.jpg"], "b is named by another row, so only a goes");
});

test("a save made on a version another save replaced in the meantime is refused, and puts back no deleted photo", async () => {
  const { site, withPhotos, removed, save } = twoPhotoPost();
  // The second save lands while the first is still being made: it drops b, whose file goes.
  const stale = await save(withPhotos(site, ownFile("a.jpg"), ownFile("b.jpg")), async () => {
    assert.ok((await save(withPhotos(site, ownFile("a.jpg")))).ok);
  });
  assert.deepEqual(stale, { ok: false, error: CHANGED_SINCE_READ });
  assert.deepEqual(removed, ["post-photos/b.jpg"]);
});

test("a panel opened before another save deleted a photo cannot save that photo back", async () => {
  const { site, withPhotos, removed, save } = twoPhotoPost();
  assert.ok((await save(withPhotos(site, ownFile("a.jpg")))).ok);
  assert.deepEqual(removed, ["post-photos/b.jpg"]);
  // The older panel still holds b: its save reads the post fresh, but b's file is gone.
  assert.deepEqual(await save(withPhotos(site, ownFile("a.jpg"), ownFile("b.jpg"))), { ok: false, error: PHOTO_GONE });
});

test("a save landing between the daily sweep's read and its delete cannot keep the file the sweep deletes, on a new post or an old one", async () => {
  const now = new Date();
  const HOUR = 60 * 60 * 1000;
  const old = "post-photos/old.jpg";
  const posts = memoryContentStore(importedOutreach().posts.slice(0, 1));
  const [first] = await posts.list();
  const base = editorVersion(first.version) as OutreachPost;
  const withPhoto = (src: PhotoSrc): OutreachPost => ({ ...base, photos: [{ src, alt: "A photo." }] });
  const { removed, writes } = recordedWrites([], new Map([[old, new Date(now.getTime() - UPLOAD_KEPT_MS - HOUR)]]));
  const editor = outreachEditor(admin, { ...memoryOutreachStore(), posts }, publicStorePhotoFiles(OWN, writes, () => "new"));
  const keep = (id: number | null, src: PhotoSrc) => editor.posts.save(id, "publish", async () => ({ ok: true, value: withPhoto(src) }));

  const during: unknown[] = [];
  const swept = await sweepUnusedUploads(now, {
    list: async (prefix) => (prefix === "post-photos/" ? [{ pathname: old, uploadedAt: new Date(now.getTime() - UPLOAD_KEPT_MS - HOUR) }] : []),
    unreferenced: async (pathnames) => {
      // A panel opened a day ago saves the photo after the sweep read that no row names it.
      during.push(await keep(null, ownFile("old.jpg")), await keep(first.id, ownFile("old.jpg")));
      return pathnames;
    },
    remove: writes.remove,
  });
  assert.deepEqual(during, [{ ok: false, error: PHOTO_GONE }, { ok: false, error: PHOTO_GONE }], "both saves are refused");
  assert.deepEqual(swept, { deleted: 1, failed: 0 });
  assert.deepEqual(removed, [old]);
  assert.ok(!JSON.stringify(await posts.list()).includes(old), "no post names the deleted file");

  // An upload younger than half the sweep's day is still the panel's to save, on a new post too.
  assert.ok((await keep(null, ownFile("new.jpg"))).ok);
});
