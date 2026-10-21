import assert from "node:assert/strict";
import { test } from "node:test";
import type { Versioned } from "@/lib/content/versioned";
import { fieldsOf, projectViewOf, type ProjectFields } from "./fields";
import { importedRecords } from "./import";
import {
  cardLookOf,
  checksAfterEdit,
  confirmTab,
  holdsPublish,
  liveLookOf,
  publishHoldOf,
  uncheckedFor,
  type CardChecks,
} from "./publish-hold";
import type { ProjectRecord } from "./record";

// The Publish hold (board 93e, issue #530): Publish waits for a tick on Home
// and on the Projects list after the visual or the background changes, and on
// a project never published.

const [cavour] = importedRecords;
const published: Versioned<ProjectRecord> = { state: "published", published: cavour, draft: null };
const neverPublished: Versioned<ProjectRecord> = { state: "draft", draft: cavour };

const lookOf = (fields: ProjectFields) => cardLookOf(projectViewOf(fields, cavour));
const opened = fieldsOf(cavour);
const withHero = (hero: Partial<ProjectFields["hero"]>): ProjectFields => ({ ...opened, hero: { ...opened.hero, ...hero } });

/** The hold the editor shows after these steps, starting from the opened fields. */
function holdAfter(version: Versioned<ProjectRecord>, steps: readonly ((c: CardChecks) => CardChecks)[]) {
  const checks = steps.reduce((c, step) => step(c), uncheckedFor(lookOf(opened)));
  return publishHoldOf(checks, liveLookOf(version));
}

const edit = (fields: ProjectFields) => (c: CardChecks) => checksAfterEdit(c, lookOf(fields));

test("every imported project opens with the look the site shows, so an untouched project publishes as before", () => {
  for (const record of importedRecords) {
    const version: Versioned<ProjectRecord> = { state: "published", published: record, draft: null };
    assert.equal(cardLookOf(projectViewOf(fieldsOf(record), record)), liveLookOf(version), record.slug);
  }
  assert.deepEqual(holdAfter(published, []), { kind: "free" });
});

test("edits that touch neither the visual nor the background do not hold Publish", () => {
  const renamed: ProjectFields = { ...opened, blocks: opened.blocks.slice(1), hero: { ...opened.hero, status: "RETIRED", dates: "2023" } };
  const hold = holdAfter(published, [edit(renamed)]);
  assert.deepEqual(hold, { kind: "free" });
  assert.equal(holdsPublish(hold), false);
});

test("a background change holds Publish until both tabs are ticked", () => {
  const moved = edit({ ...opened, background: { kind: "preset", preset: "cloud-grey" } });
  assert.deepEqual(holdAfter(published, [moved]), { kind: "checking", home: false, list: false });
  assert.equal(holdsPublish(holdAfter(published, [moved, (c) => confirmTab(c, "home")])), true);
  const both = holdAfter(published, [moved, (c) => confirmTab(c, "home"), (c) => confirmTab(c, "list")]);
  assert.deepEqual(both, { kind: "checking", home: true, list: true });
  assert.equal(holdsPublish(both), false);
});

test("a visual or caption change holds Publish", () => {
  assert.equal(holdsPublish(holdAfter(published, [edit(withHero({ visual: { kind: "none" } }))])), true);
  assert.equal(holdsPublish(holdAfter(published, [edit(withHero({ caption: `${opened.hero.caption} again` }))])), true);
});

test("a further visual or background change resets both ticks, even back to a look once ticked", () => {
  const first = edit({ ...opened, background: { kind: "preset", preset: "cloud-grey" } });
  const second = edit({ ...opened, background: { kind: "preset", preset: "orange" } });
  const ticked = [first, (c: CardChecks) => confirmTab(c, "home"), (c: CardChecks) => confirmTab(c, "list")];
  assert.deepEqual(holdAfter(published, [...ticked, second]), { kind: "checking", home: false, list: false });
  assert.deepEqual(holdAfter(published, [...ticked, second, first]), { kind: "checking", home: false, list: false });
});

test("an edit that leaves the look as it was keeps the ticks", () => {
  const moved = { ...opened, background: { kind: "preset", preset: "cloud-grey" } } satisfies ProjectFields;
  const hold = holdAfter(published, [edit(moved), (c) => confirmTab(c, "home"), edit({ ...moved, blocks: moved.blocks.slice(1) })]);
  assert.deepEqual(hold, { kind: "checking", home: true, list: false });
});

test("putting the look back to the one the site shows lifts the hold", () => {
  const moved = edit({ ...opened, background: { kind: "preset", preset: "cloud-grey" } });
  assert.deepEqual(holdAfter(published, [moved, edit(opened)]), { kind: "free" });
});

test("a project never published holds Publish from the start, with no change at all", () => {
  assert.deepEqual(holdAfter(neverPublished, []), { kind: "checking", home: false, list: false });
  const both = holdAfter(neverPublished, [(c) => confirmTab(c, "list"), (c) => confirmTab(c, "home")]);
  assert.equal(holdsPublish(both), false);
});
