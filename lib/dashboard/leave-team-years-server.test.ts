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
// Leaving through a Team tree structure edit uses the same rule (issue #986).

const PERSON = IDS.person("DM");
const LEAD = IDS.lead("DM");
const DM = IDS.division("DM");
const THIS_YEAR = new Date().getUTCFullYear();

async function yearsOf(memberId: number): Promise<{ from: unknown; to: unknown }> {
  const row = (await tableRows(members)).find((r) => r.memberId === memberId);
  return { from: row?.teamFrom, to: row?.teamTo };
}

async function leave(): Promise<{ from: unknown; to: unknown }> {
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await teamActions.moveToAlumni(PERSON, "graduated"), { ok: true });
  return yearsOf(PERSON);
}

/** The division's lead hands it to Person DM and leaves the team, from the Team tree's division edit. */
async function leaveThroughStructureEdit(): Promise<{ from: unknown; to: unknown }> {
  signInAs(accountOf("team leader").userId);
  const division = { name: "Design & Manufacturing", code: "DMA", members: [], emails: [] };
  const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [PERSON], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "leave" }] });
  assert.equal(saved.ok, true);
  return yearsOf(LEAD);
}

/** Someone who joined in 2022 and whose only role, the one they still hold, started in 2025. */
async function joinedBeforeTheirOnlyRole(memberId: number): Promise<void> {
  await changeRows(members, { memberId }, { joinedTeamOn: "2022-10-03" });
  await changeRows(roles, { memberId }, { startedAt: "2025-10-01" });
}

test("Leaves the team: someone who joined before their only remaining role is on the team from the year they joined", async () => {
  await seedFixture();
  await joinedBeforeTheirOnlyRole(PERSON);
  assert.deepEqual(await leave(), { from: 2022, to: THIS_YEAR });
});

test("a structure edit: someone who joined before their only remaining role is on the team from the year they joined", async () => {
  await seedFixture();
  await joinedBeforeTheirOnlyRole(LEAD);
  assert.deepEqual(await leaveThroughStructureEdit(), { from: 2022, to: THIS_YEAR });
});

test("a structure edit: with no stored join day, the years run from their earliest role start, ended roles included", async () => {
  await seedFixture();
  await changeRows(members, { memberId: LEAD }, { joinedTeamOn: null });
  await addRows(roles, [{ memberId: LEAD, divisionId: DM, title: "", type: "core", startedAt: "2019-10-01", leavedAt: "2020-09-30" }]);
  assert.deepEqual(await leaveThroughStructureEdit(), { from: 2019, to: THIS_YEAR });
});

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
