import assert from "node:assert/strict";
import { test } from "node:test";
import { outreachRecord } from "./outreach";
import { importedRecords } from "./project-content/import";
import { STREAK_TEXTURE, pageShareCard, postShareCard, projectShareCard } from "./share-image";

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

test("a post's eyebrow is OUTREACH and the month and year of its date", () => {
  assert.equal(postShareCard({ ...post, date: "2024-10-14" }).eyebrow, "OUTREACH · OCTOBER 2024");
});

test("a post's image draws its first photo when it is a file of the site", () => {
  const card = postShareCard({ ...post, photos: [{ src: "/outreach/iac-2024-milan.webp", alt: "" }] });
  assert.deepEqual(card.layout === "post" && card.backdrop, { kind: "photo", file: "public/outreach/iac-2024-milan.webp" });
});

test("a post whose first photo is in the Blob store lies on the streak texture, with no photo", () => {
  const card = postShareCard({ ...post, photos: [{ src: "https://store.public.blob.vercel-storage.com/a.jpg", alt: "" }] });
  assert.deepEqual(card.layout === "post" && card.backdrop, { kind: "texture", file: STREAK_TEXTURE });
});

test("the Team's image names its section and page and shows the group photo", () => {
  const team = pageShareCard("the-team");
  assert.equal(team.eyebrow, "ABOUT · THE TEAM");
  assert.equal(team.layout === "page" && team.photo, "public/team/team-2022-06.jpg");
});
