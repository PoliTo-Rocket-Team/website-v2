import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, type PublishStep, type Versioned } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import {
  dummyOutreachStore,
  dummyPhotoFiles,
  parseOutreachEdits,
  PREVIEW_PHOTO_SRC,
  serializeOutreachEdits,
  type DummyOutreachEdits,
} from "@/lib/dummy-data/outreach";
import { postBySlug, slugOf } from "./outreach";
import { outreachEditor, publicOutreach } from "./outreach-editor";
import { importedOutreach } from "./outreach-import";
import { postFieldsOf } from "./outreach-post-fields";
import { publicStorePhotoFiles, type CheckedPhoto, type PhotoFiles, type PublicFileWrites } from "./outreach-photos";
import type { OutreachPost, PhotoSrc } from "./outreach-types";
import { publicStoreHost } from "@/lib/storage/pathname";

// Post photos (issue #291): a post needs a photo, whose description is
// optional (issue #430), the first photo is the cover, a gallery's photos
// are checked as the post's are, uploads wait for the site-content
// gate, a save takes files only from this deployment's own public store, a
// file no version of any post shows is deleted, and a preview writes no file
// anywhere.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const member: ViewerStanding = { kind: "member", areaGrant: false, siteContent: false, approveOrders: false };

const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const upload = { name: "photo.png", contentType: "image/png", bytes: PNG };

/** A cookie that keeps what was saved, read again by each new store as the next request would. */
function cookie() {
  let value: string | undefined;
  return {
    get current(): DummyOutreachEdits {
      return parseOutreachEdits(value);
    },
    save: async (next: DummyOutreachEdits) => {
      value = serializeOutreachEdits(next);
    },
  };
}

test("a photo's description is optional for Save draft and Publish, and the first photo is the post's cover on the public page", async () => {
  const jar = cookie();
  const editor = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
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
  const shown = (store: ReturnType<typeof dummyOutreachStore>) =>
    store.posts.list().then((posts) => publicOutreach({ ...importedOutreach(), posts }));
  const live = postBySlug((await shown(dummyOutreachStore(jar))).posts, slugOf(editorVersion(item.version)));
  assert.deepEqual(live?.photos[0], { src: PREVIEW_PHOTO_SRC, alt: "" }, "the new first photo is the cover, with an empty description");
  assert.deepEqual(live?.photos.slice(1), fields.photos, "the photos it had follow in order");
});

test("a post's gallery is saved with the post, its photos checked and kept as the post's are", async () => {
  const jar = cookie();
  const editor = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
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
  const posts = await dummyOutreachStore(jar).posts.list();
  const live = postBySlug(publicOutreach({ ...importedOutreach(), posts }).posts, slugOf(editorVersion(item.version)));
  assert.deepEqual(live?.gallery, { items: [{ src: PREVIEW_PHOTO_SRC, alt: "", caption: "At the stand" }] });
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
  };

  const refused = outreachEditor(member, dummyOutreachStore(cookie()), files);
  assert.equal((await refused.uploadPhoto(upload)).ok, false);
  assert.equal(put.length, 0, "nothing is stored for a viewer the gate refuses");

  const editor = outreachEditor(admin, dummyOutreachStore(cookie()), files);
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

/** The public store's writes, recorded: what was uploaded and which pathnames were deleted. */
function recordedWrites() {
  const removed: string[] = [];
  const writes: PublicFileWrites = {
    upload: async (pathname) => ({ url: `https://own123.public.blob.vercel-storage.com/${pathname}` }),
    remove: async (pathname) => {
      removed.push(pathname);
    },
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

  const editor = outreachEditor(admin, dummyOutreachStore(cookie()), files);
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
  const editor = outreachEditor(admin, { ...dummyOutreachStore(cookie()), posts: memoryContentStore(seed) }, publicStorePhotoFiles(OWN, writes, () => "new"));
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

test("a preview never writes a file: an upload comes back as a data URL, and a stored file cannot ride a preview save", async () => {
  const uploaded = await outreachEditor(admin, dummyOutreachStore(cookie()), dummyPhotoFiles).uploadPhoto(upload);
  assert.ok(uploaded.ok);
  assert.match(uploaded.value, /^data:image\/png;base64,/);
  assert.ok(!dummyPhotoFiles.owns("https://abc.public.blob.vercel-storage.com/post-photos/a.jpg"), "a preview save cannot carry a stored file");
});
