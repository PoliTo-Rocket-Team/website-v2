import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { departments } from "@/db/schema";
import { addRows, databaseWrites, resetDatabase, tableRows, testDb, writesByTransaction } from "./test-database";

// The test database itself (issue #649): a batch is one transaction, as the
// neon-http driver sends it in production, the journal names the server's
// writes and not a test's own rows, and a restore takes every write away.

const names = async () => (await tableRows(departments)).map((d) => d.name);

test("a batch commits as one transaction, and a statement that fails rolls back every one before it", async () => {
  await resetDatabase();
  await testDb.batch([testDb.insert(departments).values({ name: "First" }), testDb.insert(departments).values({ name: "Second" })]);
  assert.deepEqual(await names(), ["First", "Second"]);
  assert.deepEqual(await writesByTransaction(), [
    [
      { kind: "insert", table: "departments" },
      { kind: "insert", table: "departments" },
    ],
  ]);

  await resetDatabase();
  // The second insert takes the first one's id, which the primary key refuses.
  await assert.rejects(testDb.batch([testDb.insert(departments).values({ id: 1, name: "Kept?" }), testDb.insert(departments).values({ id: 1, name: "Twice" })]));
  assert.deepEqual(await names(), [], "the first insert rolled back with the failing one");
  assert.deepEqual(await databaseWrites(), []);
});

test("the journal names a write that changed a row, never one that matched none, nor a test's own rows", async () => {
  await resetDatabase();
  await addRows(departments, [{ id: 1, name: "Seeded" }]);
  assert.deepEqual(await databaseWrites(), [], "a test's own rows");
  await testDb.update(departments).set({ name: "Nobody" }).where(eq(departments.id, 99));
  assert.deepEqual(await databaseWrites(), [], "an update that matched no row");
  await testDb.update(departments).set({ name: "Renamed" }).where(eq(departments.id, 1));
  assert.deepEqual(await databaseWrites(), [{ kind: "update", table: "departments" }]);
  // The id sequence moved past the test's own row, as a seed leaves it.
  await testDb.insert(departments).values({ name: "New" });
  assert.deepEqual(await names(), ["Renamed", "New"]);
});

test("a restore takes every write and every test row away", async () => {
  await resetDatabase();
  await addRows(departments, [{ id: 1, name: "Seeded" }]);
  await testDb.insert(departments).values({ name: "Written" });
  await resetDatabase();
  assert.deepEqual(await names(), []);
  assert.deepEqual(await databaseWrites(), []);
});
