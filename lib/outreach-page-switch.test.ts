import assert from "node:assert/strict";
import { test } from "node:test";
import { outreachRecord, phoneNewsCard, slugOf, trackRecordShowing, withEdited } from "./outreach";
import type { IsoDate, OutreachPost } from "./outreach-types";

// The edit shell's page switch (issue #294): the Outreach list and the home
// Track record show the post being edited in place among the published ones.

const dated = (title: string, date: IsoDate): OutreachPost => ({ ...outreachRecord.posts[0], title, date });
const published = [
  dated("Award night", "2026-02-10"),
  dated("Summit", "2025-11-20"),
  dated("School visit", "2025-05-03"),
  dated("Spring fair", "2025-04-02"),
  dated("Expo", "2024-09-30"),
];

test("the version being edited takes its published version's place, even under a new title", () => {
  const draft = dated("School visit, renamed", "2025-05-03");
  const posts = withEdited(published, slugOf(published[2]), draft);
  assert.equal(posts.length, published.length);
  assert.ok(posts.includes(draft));
  assert.ok(!posts.includes(published[2]));

  const fresh = dated("Untitled post", "2026-10-16");
  assert.equal(withEdited(published, null, fresh).length, published.length + 1, "a post never published replaces none");
});

test("on the home Track record the edited post sits where its date puts it", () => {
  const draft = dated("Summit", "2025-11-20");
  const home = trackRecordShowing(withEdited(published, slugOf(published[1]), draft), draft);
  assert.deepEqual([home.featured, ...home.news].map((p) => p.title), ["Award night", "Summit", "School visit", "Spring fair"]);
  assert.equal(home.news[0], draft);
});

test("an edited post older than the four newest takes the last news card's place", () => {
  const draft = dated("Expo", "2024-09-30");
  const home = trackRecordShowing(withEdited(published, slugOf(published[4]), draft), draft);
  assert.deepEqual([home.featured, ...home.news].map((p) => p.title), ["Award night", "Summit", "School visit", "Expo"]);
});

test("in Phone mode the edited post's news card is the one a phone shows; the public page keeps the first", () => {
  const draft = dated("Expo", "2024-09-30");
  const home = trackRecordShowing(withEdited(published, slugOf(published[4]), draft), draft);
  assert.equal(phoneNewsCard(home, draft), draft, "even in the last news card's place");
  assert.equal(phoneNewsCard(home), home.news[0]);

  const featured = dated("Award night", "2026-02-10");
  const top = trackRecordShowing(withEdited(published, slugOf(published[0]), featured), featured);
  assert.equal(phoneNewsCard(top, featured), top.news[0], "a featured post leaves the phone rule as it is");
});

test("the only post is the featured card", () => {
  const draft = dated("Untitled post", "2026-10-16");
  assert.deepEqual(trackRecordShowing(withEdited([], null, draft), draft), { featured: draft, news: [] });
});
