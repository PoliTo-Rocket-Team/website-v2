import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { members, roles } from "@/db/schema";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { addRows, changeRows, tableRows } from "./access-matrix/test-database";

// Leaves the team on the migrated in-memory Postgres (issue #980): the years
// written for the Alumni page come from stored data, never from the browser.

const PERSON = IDS.person("DM");
const DM = IDS.division("DM");
const THIS_YEAR = new Date().getUTCFullYear();

async function leave(): Promise<{ from: unknown; to: unknown }> {
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await teamActions.moveToAlumni(PERSON, "graduated"), { ok: true });
  const row = (await tableRows(members)).find((r) => r.memberId === PERSON);
  return { from: row?.teamFrom, to: row?.teamTo };
}

test("the years run from the stored join day to the year they leave", async () => {
  await seedFixture();
  await changeRows(members, { memberId: PERSON }, { joinedTeamOn: "2021-10-04" });
  assert.deepEqual(await leave(), { from: 2021, to: THIS_YEAR });
});

test("with no stored join day, the years run from their earliest role start, ended roles included", async () => {
  await seedFixture();
  await changeRows(members, { memberId: PERSON }, { joinedTeamOn: null });
  await addRows(roles, [{ memberId: PERSON, divisionId: DM, title: "", type: "core", startedAt: "2019-10-01", leavedAt: "2020-09-30" }]);
  assert.deepEqual(await leave(), { from: 2019, to: THIS_YEAR });
});
