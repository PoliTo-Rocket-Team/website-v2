import assert from "node:assert/strict";
import { test } from "node:test";
import { json, jsonb, pgTable } from "drizzle-orm/pg-core";
import { seedClient } from "../../db/seed/connection";
import { insertStatement, rowsOf } from "../../db/seed/rows";

// The seed's parameters are already JSON text when drizzle builds them, so the
// client must send that text once. Encoding it again stores a JSON string, not
// the array, and a jsonb check such as `jsonb_typeof(body) = 'array'` refuses it.
const doc = pgTable("doc", { body: jsonb("body"), meta: json("meta") });

test("the seed client sends drizzle's json and jsonb text once, so an array is stored as an array", async () => {
  const value = [{ kind: "paragraph", text: "On May 4th 2025" }];
  const { params } = insertStatement(rowsOf(doc, [{ body: value, meta: value }]));
  const client = seedClient("postgres://seed@localhost/prt");
  try {
    for (const [param, type] of [
      [params[0], 3802],
      [params[1], 114],
    ] as const) {
      const sent = client.options.serializers[type](param);
      assert.deepEqual(JSON.parse(sent as string), value, `type ${type} encoded twice`);
    }
  } finally {
    await client.end();
  }
});
