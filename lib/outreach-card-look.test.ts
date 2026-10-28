import assert from "node:assert/strict";
import { test } from "node:test";
import { showsPageSwitch } from "./content/edit-shell";
import { checksAfterEdit, confirmPage, holdsPublish, publishHoldOf, uncheckedFor } from "./content/publish-hold";
import { outreachRecord } from "./outreach";
import { livePostLookOf, postCardLookOf, postPagesToCheck, postPageTargets, type PostCheckedPage } from "./outreach-card-look";
import { blankPost, blankPostFields, postFieldsOf, postViewOf, type PostFields } from "./outreach-post-fields";
import type { IsoDate, OutreachPost, PostItem } from "./outreach-types";

// The Outreach post editor's Publish hold (board 93e, issue #581; the rule is
// lib/content/publish-hold.ts): the Outreach list and Home are held after a
// change to what the post's cards draw, and on a post never published or
// never saved; a featured post is held on the list alone, on what the
// Featured card draws.

const [post] = outreachRecord.posts;
const item = (p: OutreachPost): PostItem => ({ id: 1, siteOrder: 0, version: { state: "published", published: p, draft: null } });
const opened = postFieldsOf(post);

/** The hold on these fields for `edited` (null: a new post), with `ticked` pages confirmed. */
function holdOn(fields: PostFields, edited: PostItem | null, featured = false, ticked: readonly PostCheckedPage[] = []) {
  const checks = ticked.reduce(confirmPage, uncheckedFor<PostCheckedPage>(postCardLookOf(postViewOf(fields, post), featured)));
  return publishHoldOf(checks, livePostLookOf(edited, featured), postPagesToCheck(featured));
}

test("every imported post opens with the look the site shows, so an untouched post publishes freely", () => {
  for (const p of outreachRecord.posts) {
    for (const featured of [false, true]) {
      assert.equal(postCardLookOf(postViewOf(postFieldsOf(p), p), featured), livePostLookOf(item(p), featured), p.title);
    }
  }
  assert.equal(holdsPublish(holdOn(opened, item(post))), false);
  assert.equal(holdsPublish(holdOn(opened, item(post), true)), false);
});

test("edits to what the cards do not draw keep a published post free", () => {
  assert.equal(holdsPublish(holdOn({ ...opened, lead: `${opened.lead} more`, body: [], channels: [] }, item(post))), false);
});

test("a place-only edit keeps a regular post free: neither the list card nor the home cards draw the place", () => {
  assert.equal(holdsPublish(holdOn({ ...opened, place: "Torino, Italy" }, item(post))), false);
});

test("a tags-only edit keeps a featured post free: the Featured card draws no tags", () => {
  assert.equal(holdsPublish(holdOn({ ...opened, tags: [] }, item(post), true)), false);
});

test("a change to what the cards draw holds Publish until the Outreach list and Home are ticked", () => {
  const changes: readonly PostFields[] = [
    { ...opened, title: `${opened.title} again` },
    { ...opened, date: "2020-01-01" },
    { ...opened, summary: `${opened.summary} more` },
    { ...opened, tags: [] },
    { ...opened, photos: opened.photos.slice(1) },
  ];
  for (const fields of changes) {
    assert.equal(holdsPublish(holdOn(fields, item(post))), true, JSON.stringify(fields).slice(0, 60));
    assert.equal(holdsPublish(holdOn(fields, item(post), false, ["list"])), true);
    assert.equal(holdsPublish(holdOn(fields, item(post), false, ["list", "home"])), false);
  }
});

test("a featured post is held on the Outreach list alone, and its switch has no Home", () => {
  const changes: readonly PostFields[] = [
    { ...opened, title: `${opened.title} again` },
    { ...opened, place: "Torino, Italy" },
    { ...opened, summary: `${opened.summary} more` },
  ];
  for (const changed of changes) {
    assert.deepEqual(holdOn(changed, item(post), true), { kind: "checking", pages: [{ page: "list", check: "unchecked" }] });
    assert.equal(holdsPublish(holdOn(changed, item(post), true, ["list"])), false);
  }
  assert.ok(!postPageTargets(true).some((t) => t.id === "home"));
});

test("featuring or unfeaturing a post mid-check clears its ticks, so one card's tick never unlocks the other", () => {
  const view = postViewOf({ ...opened, title: `${opened.title} again` }, post);
  // Ticked on the regular cards, then featured: the Featured card is still to check.
  const regular = confirmPage(confirmPage(uncheckedFor<PostCheckedPage>(postCardLookOf(view, false)), "list"), "home");
  assert.equal(holdsPublish(publishHoldOf(regular, livePostLookOf(item(post), false), postPagesToCheck(false))), false);
  const featured = checksAfterEdit(regular, postCardLookOf(view, true));
  assert.deepEqual(publishHoldOf(featured, livePostLookOf(item(post), true), postPagesToCheck(true)), {
    kind: "checking",
    pages: [{ page: "list", check: "unchecked" }],
  });
  // Ticked on the Featured card, then unfeatured: the list and Home cards are still to check.
  const unfeatured = checksAfterEdit(confirmPage(featured, "list"), postCardLookOf(view, false));
  assert.deepEqual(publishHoldOf(unfeatured, livePostLookOf(item(post), false), postPagesToCheck(false)), {
    kind: "checking",
    pages: [
      { page: "list", check: "unchecked" },
      { page: "home", check: "unchecked" },
    ],
  });
});

test("a new post shows the page switch from the start and is held until both pages are ticked", () => {
  const today = "2026-10-25" as IsoDate;
  assert.ok(showsPageSwitch(postPageTargets(false)));
  const look = postCardLookOf(postViewOf(blankPostFields(today), blankPost(today)), false);
  const hold = (ticked: readonly PostCheckedPage[]) =>
    publishHoldOf(ticked.reduce(confirmPage, uncheckedFor<PostCheckedPage>(look)), livePostLookOf(null, false), postPagesToCheck(false));
  assert.deepEqual(hold([]), {
    kind: "checking",
    pages: [
      { page: "list", check: "unchecked" },
      { page: "home", check: "unchecked" },
    ],
  });
  assert.equal(holdsPublish(hold(["home"])), true);
  assert.equal(holdsPublish(hold(["home", "list"])), false);
});

test("a post saved but never published is held from the start", () => {
  const draft: PostItem = { id: 2, siteOrder: 0, version: { state: "draft", draft: post } };
  assert.equal(livePostLookOf(draft, false), null);
  assert.equal(holdsPublish(holdOn(opened, draft)), true);
});
