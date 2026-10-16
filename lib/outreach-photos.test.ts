import assert from "node:assert/strict";
import { test } from "node:test";
import { editorVersion, type Versioned } from "@/lib/content/versioned";
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
import { unusedPhotoFiles, type CheckedPhoto, type PhotoFiles } from "./outreach-photos";
import type { OutreachPost, PhotoSrc } from "./outreach-types";

// Post photos (issue #291): every photo needs alt text before either button
// saves, the first photo is the cover, uploads wait for the site-content
// gate, a file no version uses any more is deleted, and a preview writes no
// file anywhere.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const member: ViewerStanding = { kind: "member", siteContent: false, approveOrders: false };

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

test("every photo needs alt text before Save draft or Publish, and the first photo is the post's cover on the public page", async () => {
  const jar = cookie();
  const editor = outreachEditor(admin, dummyOutreachStore(jar), dummyPhotoFiles);
  const item = (await editor.posts.list())![0];
  const fields = postFieldsOf(editorVersion(item.version));

  const uploaded = await editor.uploadPhoto(upload);
  assert.ok(uploaded.ok);
  const undescribed = { ...fields, photos: [{ src: uploaded.value, alt: "" }, ...fields.photos] };
  for (const step of ["save-draft", "publish"] as const) {
    assert.deepEqual(await editor.savePost(item.id, step, undescribed), { ok: false, error: "Photo 1 has no description. Click it to add one." }, step);
    assert.deepEqual(await editor.savePost(item.id, step, { ...fields, photos: [] }), { ok: false, error: "Add at least one photo." }, step);
  }

  const described = { ...undescribed, photos: [{ src: uploaded.value, alt: "The team at the stand." }, ...fields.photos] };
  assert.ok((await editor.savePost(item.id, "publish", described)).ok);
  const shown = (store: ReturnType<typeof dummyOutreachStore>) =>
    store.posts.list().then((posts) => publicOutreach({ ...importedOutreach(), posts }));
  const live = postBySlug((await shown(dummyOutreachStore(jar))).posts, slugOf(editorVersion(item.version)));
  assert.deepEqual(live?.photos[0], { src: PREVIEW_PHOTO_SRC, alt: "The team at the stand." }, "the new first photo is the cover");
  assert.deepEqual(live?.photos.slice(1), fields.photos, "the photos it had follow in order");
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

test("a removed or replaced photo's file is deleted once no version of its post uses it; a photo of the site never is", () => {
  const stored = (name: string) => `https://abc.public.blob.vercel-storage.com/post-photos/${name}` as PhotoSrc;
  const post = importedOutreach().posts[0].version;
  assert.equal(post.state, "published");
  const base = editorVersion(post) as OutreachPost;
  const site = base.photos[0];
  const withPhotos = (...photos: PhotoSrc[]): OutreachPost => {
    const [first, ...rest] = photos.map((src) => ({ src, alt: "A photo." }));
    return { ...base, photos: [first, ...rest] };
  };
  const published = (p: OutreachPost, draft: OutreachPost | null = null): Versioned<OutreachPost> => ({ state: "published", published: p, draft });

  // A draft drops b: the published post still shows it, so it stays.
  const before = published(withPhotos(site.src, stored("a.jpg"), stored("b.jpg")));
  assert.deepEqual(unusedPhotoFiles(before, published(withPhotos(site.src, stored("a.jpg"), stored("b.jpg")), withPhotos(stored("a.jpg")))), []);
  // Publishing that draft leaves b and the site photo unused: only b is a stored file.
  assert.deepEqual(unusedPhotoFiles(before, published(withPhotos(stored("a.jpg")))), ["post-photos/b.jpg"]);
  // Deleting the post frees every stored file it had.
  assert.deepEqual(unusedPhotoFiles(before, null), ["post-photos/a.jpg", "post-photos/b.jpg"]);
});

test("a preview never writes a file: an upload comes back as a data URL, and a stored file cannot ride a preview save", async () => {
  const uploaded = await outreachEditor(admin, dummyOutreachStore(cookie()), dummyPhotoFiles).uploadPhoto(upload);
  assert.ok(uploaded.ok);
  assert.match(uploaded.value, /^data:image\/png;base64,/);
  assert.ok(!dummyPhotoFiles.owns("https://abc.public.blob.vercel-storage.com/post-photos/a.jpg"), "a preview save cannot carry a stored file");
});
