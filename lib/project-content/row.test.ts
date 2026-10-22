import assert from "node:assert/strict";
import { test } from "node:test";
import { storedProjectRecord as storedBeforeBlocks } from "./before-blocks/check";
import { importedRecords, legacyRecords } from "./import";
import { blocksRecordOf } from "./legacy";
import { newProjectRecord, PROJECT_KINDS } from "./new-project";
import { withIntro } from "./record";
import { newRowContent, rowContentOf, rowRecordOf } from "./row";

// A `project_versions` row since migration 0050 (issue #525): the record in
// `page`, and in `content` the record from before page blocks, which a save
// never rewrites, so a deployment built before page blocks keeps reading it.

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const [cavour] = importedRecords;
const [legacyCavour, legacyVes] = legacyRecords;

test("a row is read from its page, and from its content when it has none", () => {
  assert.deepEqual(rowRecordOf({ content: plain(legacyVes), page: plain(cavour) }), cavour, "the page wins");
  assert.deepEqual(rowRecordOf({ content: plain(legacyCavour), page: null }), cavour);
  assert.deepEqual(rowRecordOf({ content: plain(legacyCavour) }), cavour, "a row inserted with no page column");
  assert.equal(rowRecordOf({ content: plain(legacyCavour), page: { ...plain(cavour), extra: 1 } }), null, "a page that is not a record is not read past");
  assert.equal(rowRecordOf({ content: { name: "Cavour" }, page: null }), null);
});

test("a save keeps the content the project's rows hold", () => {
  const draft = withIntro(cavour, "A new intro.");
  const kept = [
    { version: "published", content: { held: "published" } },
    { version: "draft", content: { held: "draft" } },
  ] as const;
  assert.deepEqual(rowContentOf("draft", kept, draft), { held: "draft" }, "its own version's");
  assert.deepEqual(rowContentOf("draft", [kept[0]], draft), { held: "published" }, "a first draft takes the published one's");
  assert.deepEqual(rowContentOf("published", [kept[1]], draft), { held: "draft" }, "a first publish takes the draft's");
});

test("a project with no rows gets the record New project stored before page blocks, which reads as the same project", () => {
  for (const kind of PROJECT_KINDS) {
    const record = newProjectRecord({ name: "Galileo", slug: "galileo", kind }, 2026);
    const content = plain(newRowContent(record));
    assert.deepEqual(rowContentOf("draft", [], record), newRowContent(record));
    assert.notEqual(storedBeforeBlocks(content), null, `${kind}: the code from before page blocks reads it`);
    assert.deepEqual(blocksRecordOf(storedBeforeBlocks(content)!), plain(record), `${kind}: the same name, address, kind, texture and copy`);
  }
});
