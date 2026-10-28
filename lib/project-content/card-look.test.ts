import assert from "node:assert/strict";
import { test } from "node:test";
import { holdsPublish, publishHoldOf, uncheckedFor } from "@/lib/content/publish-hold";
import type { Versioned } from "@/lib/content/versioned";
import { cardLookOf, liveLookOf, PROJECT_CHECKED_PAGES } from "./card-look";
import { fieldsOf, projectViewOf, type ProjectFields } from "./fields";
import { importedRecords } from "./import";
import type { ProjectRecord } from "./record";

// The project editor's Publish hold (board 93e, issue #530; the rule is
// lib/content/publish-hold.ts): Home and the Projects list are held after the
// visual or the background changes, and on a project never published.

const [cavour] = importedRecords;
const published: Versioned<ProjectRecord> = { state: "published", published: cavour, draft: null };
const neverPublished: Versioned<ProjectRecord> = { state: "draft", draft: cavour };

const lookOf = (fields: ProjectFields) => cardLookOf(projectViewOf(fields, cavour));
const opened = fieldsOf(cavour);
const withHero = (hero: Partial<ProjectFields["hero"]>): ProjectFields => ({ ...opened, hero: { ...opened.hero, ...hero } });

/** Whether Publish is held on these fields, nothing ticked yet. */
const held = (fields: ProjectFields, version: Versioned<ProjectRecord> = published) =>
  holdsPublish(publishHoldOf(uncheckedFor(lookOf(fields)), liveLookOf(version), PROJECT_CHECKED_PAGES));

test("every imported project opens with the look the site shows, so an untouched project publishes as before", () => {
  for (const record of importedRecords) {
    const version: Versioned<ProjectRecord> = { state: "published", published: record, draft: null };
    assert.equal(cardLookOf(projectViewOf(fieldsOf(record), record)), liveLookOf(version), record.slug);
  }
  assert.equal(held(opened), false);
});

test("edits that touch neither the visual nor the background do not hold Publish", () => {
  assert.equal(held({ ...opened, blocks: opened.blocks.slice(1), hero: { ...opened.hero, status: "RETIRED", dates: "2023" } }), false);
});

test("a background, visual or caption change holds Publish on Home and the Projects list", () => {
  assert.equal(held({ ...opened, background: { kind: "preset", preset: "cloud-grey" } }), true);
  assert.equal(held(withHero({ visual: { kind: "none" } })), true);
  assert.equal(held(withHero({ caption: `${opened.hero.caption} again` })), true);});

test("a project never published, as New project stores it, holds Publish from the start", () => {
  assert.equal(held(opened, neverPublished), true);
});
