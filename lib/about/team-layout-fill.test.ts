import assert from "node:assert/strict";
import { test } from "node:test";
import { teamPageLayerVersions } from "@/db/schema";
import { publishedTeamPageLayerOf, SEED_DATA } from "@/db/seed/cases";
import { addRows, changeRows, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { seeded } from "@/lib/dashboard/access-matrix/whole-seed";
import { queryTeamSnapshot, teamRolesOf } from "@/lib/dashboard/team-snapshot";
import { NO_TEAM_LAYER, type TeamPageLayer } from "./team-layer";
import { snapshot } from "./team-layout";
import { fillTeamPageLayouts } from "./team-layout-fill";

// The post-migration step that fills the Team page layout (issue #850), on a
// migrated in-memory Postgres holding the whole seed
// (lib/dashboard/access-matrix/whole-seed.ts): every stored layer version
// with no layout gets the one its layer snapshots to on the stored roles, a
// row that has one is left alone, and a second run writes nothing.

const layer = publishedTeamPageLayerOf(SEED_DATA)!;
const draft: TeamPageLayer = { ...layer, intro: "A draft intro.", spots: {} };

test("the step fills every stored layer version with no layout from its layer, and a second run writes nothing", async () => {
  await seeded();
  await changeRows(teamPageLayerVersions, { version: "published" }, { layout: null });
  await addRows(teamPageLayerVersions, [{ version: "draft", layer: draft }]);
  const roles = teamRolesOf(await queryTeamSnapshot(testDb));

  assert.equal(await fillTeamPageLayouts(testDb), 2);
  const filled = await tableRows(teamPageLayerVersions);
  assert.deepEqual(
    filled.map((r) => [r.version, r.layer, r.layout]),
    [
      ["published", layer, snapshot(roles, layer).layout],
      ["draft", draft, snapshot(roles, draft).layout],
    ],
  );

  assert.equal(await fillTeamPageLayouts(testDb), 0, "a second run writes nothing");
  assert.deepEqual(await tableRows(teamPageLayerVersions), filled);
});

test("the step leaves a row that already has a layout as it is", async () => {
  await seeded();
  const kept = snapshot(teamRolesOf(await queryTeamSnapshot(testDb)), NO_TEAM_LAYER).layout;
  await changeRows(teamPageLayerVersions, { version: "published" }, { layout: kept });
  await addRows(teamPageLayerVersions, [{ version: "draft", layer: draft }]);

  assert.equal(await fillTeamPageLayouts(testDb), 1);
  const rows = await tableRows(teamPageLayerVersions);
  assert.deepEqual(rows.find((r) => r.version === "published")?.layout, kept, "the stored layout is not replaced");
  assert.notEqual(rows.find((r) => r.version === "draft")?.layout, null);
});
