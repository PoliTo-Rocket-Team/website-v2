import assert from "node:assert/strict";
import { test } from "node:test";
import { insertStatement, type TableSeed } from "../../db/seed/rows";
import { SEED_MODULES } from "../../db/seed/registry";
import { insertTarget, journaledSchema } from "./journal";

// The preview build migrates the shared branch from the journal and then
// seeds it (ADR 0016). The unit tests build the seed's SQL without a server, so
// only this check sees a seed insert that names a column the journal never
// creates — the gap that once stopped every preview build at the seed step.

const tableModules = SEED_MODULES.flatMap((m) => ("seed" in m ? [(m as typeof m & { seed: TableSeed }).seed] : []));

test("every column a seed insert names is created by a journaled migration", () => {
  const schema = journaledSchema();
  const missing: string[] = [];
  for (const seed of tableModules) {
    for (const set of seed.rows) {
      const { table, columns } = insertTarget(insertStatement(set).sql);
      const journaled = schema.get(table);
      if (journaled === undefined) {
        missing.push(`${seed.name}: table ${table}`);
        continue;
      }
      for (const column of columns) if (!journaled.has(column)) missing.push(`${seed.name}: ${table}.${column}`);
    }
  }
  assert.deepEqual(missing, []);
});
