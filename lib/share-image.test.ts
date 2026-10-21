import assert from "node:assert/strict";
import { test } from "node:test";
import { outreachRecord } from "./outreach";
import type { PhotoSrc } from "./outreach-types";
import { importedRecords } from "./project-content/import";
import { STREAK_TEXTURE, pageShareCard, postShareCard, projectShareCard } from "./share-image";
import { publicStoreHost, type PublicStoreHost } from "./storage/pathname";

// The words and files of each share image (board 90, issue #454).

const [cavour] = importedRecords;
const [post] = outreachRecord.posts;

test("a project's eyebrow is its number, PROJECT and its years", () => {
  const card = projectShareCard(cavour, 0);
  assert.equal(card.eyebrow, `01 · PROJECT · ${cavour.listing.years}`);
  assert.equal(card.title, "Cavour");
  assert.equal(projectShareCard(cavour, 11).eyebrow.slice(0, 2), "12");
});

test("a project's image lies on its own texture and draws its page panel's still", () => {
  const card = projectShareCard(cavour, 0);
  assert.equal(card.layout, "project");
  if (card.layout !== "project") return;
  assert.equal(card.texture, "public/textures/project-cavour.webp");
  assert.equal(card.still, "public/design/cavour/stage-poster.webp");
});

const store = publicStoreHost("store_Own123");
const backdropOf = (src: PhotoSrc, host: PublicStoreHost | null = store) => {
  const card = postShareCard({ ...post, photos: [{ src, alt: "" }] }, host);
  return card.layout === "post" && card.backdrop;
};

test("a post's eyebrow is OUTREACH and the month and year of its date", () => {
  assert.equal(postShareCard({ ...post, date: "2024-10-14" }, store).eyebrow, "OUTREACH · OCTOBER 2024");
});

test("a post's image draws its first photo when it is a file of the site", () => {
  assert.deepEqual(backdropOf("/outreach/iac-2024-milan.webp"), { kind: "photo", file: "public/outreach/iac-2024-milan.webp" });
  assert.deepEqual(backdropOf("/outreach/iac-2024-milan.webp", null), { kind: "photo", file: "public/outreach/iac-2024-milan.webp" });
});

test("a post whose first photo is a post photo in this deployment's own public store draws it from its URL", () => {
  const src = "https://own123.public.blob.vercel-storage.com/post-photos/a.jpg";
  assert.deepEqual(backdropOf(src), { kind: "stored-photo", url: src });
});

test("a post whose first photo is anywhere else lies on the streak texture, with nothing to fetch", () => {
  const texture = { kind: "texture", file: STREAK_TEXTURE };
  assert.deepEqual(backdropOf("https://other456.public.blob.vercel-storage.com/post-photos/a.jpg"), texture);
  assert.deepEqual(backdropOf("https://example.com/post-photos/a.jpg"), texture);
  assert.deepEqual(backdropOf("https://own123.public.blob.vercel-storage.com/photos/a.jpg"), texture);
  assert.deepEqual(backdropOf("data:image/jpeg;base64,/9j/4AAQ"), texture);
  assert.deepEqual(backdropOf("https://own123.public.blob.vercel-storage.com/post-photos/a.jpg", null), texture);
});

test("the Team's image names its section and page and shows the group photo", () => {
  const team = pageShareCard("the-team");
  assert.equal(team.eyebrow, "ABOUT · THE TEAM");
  assert.equal(team.layout === "page" && team.photo, "public/team/team-2022-06.jpg");
});
