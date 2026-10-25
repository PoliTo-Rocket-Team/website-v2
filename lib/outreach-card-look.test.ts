import assert from "node:assert/strict";
import { test } from "node:test";
import { showsPageSwitch } from "./content/edit-shell";
import { confirmPage, holdsPublish, publishHoldOf, uncheckedFor } from "./content/publish-hold";
import { outreachRecord } from "./outreach";
import { livePostLookOf, postCardLookOf, postPagesToCheck, postPageTargets, type PostCheckedPage } from "./outreach-card-look";
import { blankPost, blankPostFields, postFieldsOf, postViewOf, type PostFields } from "./outreach-post-fields";
import type { IsoDate, OutreachPost, PostItem } from "./outreach-types";

// The Outreach post editor's Publish hold (board 93e, issue #581; the rule is
// lib/content/publish-hold.ts): the Outreach list and Home are held after a
// change to what the post's card draws, and on a post never published or
// never saved; a featured post is held on the list alone.

const [post] = outreachRecord.posts;
const item = (p: OutreachPost): PostItem => ({ id: 1, siteOrder: 0, version: { state: "published", published: p, draft: null } });
const opened = postFieldsOf(post);

/** The hold on these fields for `edited` (null: a new post), with `ticked` pages confirmed. */
function holdOn(fields: PostFields, edited: PostItem | null, featured = false, ticked: readonly PostCheckedPage[] = []) {
  const checks = ticked.reduce(confirmPage, uncheckedFor<PostCheckedPage>(postCardLookOf(postViewOf(fields, post))));
  return publishHoldOf(checks, livePostLookOf(edited), postPagesToCheck(featured));
}

test("every imported post opens with the look the site shows, so an untouched post publishes freely", () => {
  for (const p of outreachRecord.posts) {
    assert.equal(postCardLookOf(postViewOf(postFieldsOf(p), p)), livePostLookOf(item(p)), p.title);
  }
  assert.equal(holdsPublish(holdOn(opened, item(post))), false);
});

test("edits to what the cards do not draw keep a published post free", () => {
  assert.equal(holdsPublish(holdOn({ ...opened, lead: `${opened.lead} more`, body: [], channels: [] }, item(post))), false);
});

test("a change to what the cards draw holds Publish until the Outreach list and Home are ticked", () => {
  const changes: readonly PostFields[] = [
    { ...opened, title: `${opened.title} again` },
    { ...opened, date: "2020-01-01" },
    { ...opened, place: "Torino, Italy" },
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
  const changed = { ...opened, title: `${opened.title} again` };
  assert.equal(holdsPublish(holdOn(changed, item(post), true)), true);
  assert.equal(holdsPublish(holdOn(changed, item(post), true, ["list"])), false);
  assert.ok(!postPageTargets(true).some((t) => t.id === "home"));
});

test("a new post shows the page switch from the start and is held until both pages are ticked", () => {
  const today = "2026-10-25" as IsoDate;
  assert.ok(showsPageSwitch(postPageTargets(false)));
  const look = postCardLookOf(postViewOf(blankPostFields(today), blankPost(today)));
  const hold = (ticked: readonly PostCheckedPage[]) =>
    publishHoldOf(ticked.reduce(confirmPage, uncheckedFor<PostCheckedPage>(look)), livePostLookOf(null), postPagesToCheck(false));
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
  assert.equal(livePostLookOf(draft), null);
  assert.equal(holdsPublish(holdOn(opened, draft)), true);
});
