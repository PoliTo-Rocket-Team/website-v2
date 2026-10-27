import assert from "node:assert/strict";
import { test } from "node:test";
import { importedRecords } from "./import";
import { rowRecordOf } from "./row";

// A `project_versions` row since migrations 0072 and 0073 (issue #535): its
// one record is in `page`.

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const [cavour] = importedRecords;

test("a row is read from its page", () => {
  assert.deepEqual(rowRecordOf({ page: plain(cavour) }), cavour);
  assert.equal(rowRecordOf({ page: { ...plain(cavour), extra: 1 } }), null, "a page that is not a record is not read past");
  assert.equal(rowRecordOf({ page: { name: "Cavour" } }), null);
});
