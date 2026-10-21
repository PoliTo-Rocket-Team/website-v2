import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { outreachRecord } from "./outreach";
import { PHOTO_MAX_BYTES } from "./outreach-photos";
import type { PhotoSrc } from "./outreach-types";
import { STREAK_TEXTURE, postShareCard, type RepoFile } from "./share-image";
import { drawnBackdrop, type PhotoFetch } from "./share-image-backdrop";
import { publicStoreHost, type PublicStoreHost } from "./storage/pathname";

// A post's share image fetches its photo only from this deployment's own
// public store, and lies on the streak texture whenever that fetch or its
// decode fails (issue #469).

const [post] = outreachRecord.posts;
const store = publicStoreHost("store_Own123");
const OWN_PHOTO = "https://own123.public.blob.vercel-storage.com/post-photos/a.jpg";

const photoBytes = () => sharp({ create: { width: 8, height: 4, channels: 3, background: "#c84" } }).jpeg().toBuffer();

/** The post share image's reads, with the network stubbed and the real `sharp` decode. */
function reads(fetchPhoto: PhotoFetch) {
  const fetched: string[] = [];
  const files: RepoFile[] = [];
  return {
    fetched,
    files,
    reads: {
      file: async (file: RepoFile) => {
        files.push(file);
        return photoBytes();
      },
      fetch: (url: string, init: { readonly signal: AbortSignal }) => {
        fetched.push(url);
        return fetchPhoto(url, init);
      },
      picture: async (bytes: Uint8Array) => {
        const out = await sharp(bytes).resize(1200, 630, { fit: "cover" }).jpeg().toBuffer();
        return `data:image/jpeg;base64,${out.toString("base64")}`;
      },
    },
  };
}

const backdropOf = (src: PhotoSrc, host: PublicStoreHost | null = store) => {
  const card = postShareCard({ ...post, photos: [{ src, alt: "" }] }, host);
  if (card.layout !== "post") throw new Error("not a post card");
  return card.backdrop;
};

const answer = (body: BodyInit | null, status = 200): PhotoFetch => async () => new Response(body, { status });
const neverFetch: PhotoFetch = () => Promise.reject(new Error("no fetch was expected"));

test("a post photo in this deployment's own store is fetched, decoded and drawn as the photo backdrop", async () => {
  const bytes = await photoBytes();
  const run = reads(answer(new Uint8Array(bytes)));
  const drawn = await drawnBackdrop(backdropOf(OWN_PHOTO), run.reads);
  assert.equal(drawn.shade, "photo");
  assert.deepEqual(run.fetched, [OWN_PHOTO]);
  assert.deepEqual(run.files, []);
  const decoded = await sharp(Buffer.from(drawn.src.split(",")[1], "base64")).metadata();
  assert.deepEqual([decoded.width, decoded.height], [1200, 630]);
});

test("a failed fetch lies on the streak texture", async () => {
  const run = reads(() => Promise.reject(new TypeError("fetch failed")));
  const drawn = await drawnBackdrop(backdropOf(OWN_PHOTO), run.reads);
  assert.equal(drawn.shade, "texture");
  assert.deepEqual(run.files, [STREAK_TEXTURE]);
});

test("a fetch answering anything but 200 lies on the streak texture", async () => {
  const run = reads(answer(new Uint8Array(await photoBytes()), 404));
  assert.equal((await drawnBackdrop(backdropOf(OWN_PHOTO), run.reads)).shade, "texture");
  assert.deepEqual(run.files, [STREAK_TEXTURE]);
});

test("a fetch that outlasts the time limit is abandoned and lies on the streak texture", async () => {
  let aborted = false;
  const run = reads((_url, { signal }) => {
    signal.addEventListener("abort", () => (aborted = true));
    return new Promise<Response>(() => {});
  });
  const started = Date.now();
  const drawn = await drawnBackdrop(backdropOf(OWN_PHOTO), run.reads, 20);
  assert.equal(drawn.shade, "texture");
  assert.ok(aborted, "the request is aborted");
  assert.ok(Date.now() - started < 1000);
});

test("bytes sharp cannot decode lie on the streak texture", async () => {
  const run = reads(answer(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e])));
  assert.equal((await drawnBackdrop(backdropOf(OWN_PHOTO), run.reads)).shade, "texture");
  assert.deepEqual(run.files, [STREAK_TEXTURE]);
});

test("a photo larger than the largest upload lies on the streak texture", async () => {
  const run = reads(answer(new Uint8Array(PHOTO_MAX_BYTES + 1)));
  assert.equal((await drawnBackdrop(backdropOf(OWN_PHOTO), run.reads)).shade, "texture");
});

test("a photo on any other host, another Blob store included, is never fetched", async () => {
  for (const src of <const>[
    "https://other456.public.blob.vercel-storage.com/post-photos/a.jpg",
    "https://example.com/post-photos/a.jpg",
    "https://own123.public.blob.vercel-storage.com/logos/a.jpg",
  ]) {
    const run = reads(neverFetch);
    const drawn = await drawnBackdrop(backdropOf(src), run.reads);
    assert.equal(drawn.shade, "texture", src);
    assert.deepEqual(run.fetched, [], src);
    assert.deepEqual(run.files, [STREAK_TEXTURE], src);
  }
});

test("a data: photo, and a stored photo with no public store set up, are never fetched", async () => {
  for (const backdrop of [backdropOf("data:image/jpeg;base64,/9j/4AAQ"), backdropOf(OWN_PHOTO, null)]) {
    const run = reads(neverFetch);
    assert.equal((await drawnBackdrop(backdrop, run.reads)).shade, "texture");
    assert.deepEqual(run.fetched, []);
  }
});

test("a photo that is a file of the site is read from disk, with no fetch", async () => {
  const run = reads(neverFetch);
  const drawn = await drawnBackdrop(backdropOf("/outreach/iac-2024-milan.webp"), run.reads);
  assert.equal(drawn.shade, "photo");
  assert.deepEqual(run.files, ["public/outreach/iac-2024-milan.webp"]);
  assert.deepEqual(run.fetched, []);
});
