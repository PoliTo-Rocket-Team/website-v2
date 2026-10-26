import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { teamAddresses } from "@/db/schema";
import { addRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { ALL, UNITS } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";

// The member side view's Team addresses row on the migrated in-memory
// Postgres (epic #578, issue #786, board 102): the rows `team_addresses`
// stores, read with the role each moves with, for a viewer who reaches the
// Members page, and for nobody else.

const HOLDER = IDS.person("MA");

async function seeded(): Promise<void> {
  await seedFixture();
  await addRows(teamAddresses, [
    { address: "recruitment@politorocketteam.it", purpose: "Recruitment", holderId: HOLDER, movesWith: "full_access_seat", movesWithSeat: "it_lead" },
    { address: "logistics@politorocketteam.it", purpose: "Logistics", holderId: HOLDER, movesWith: "division_lead", movesWithDivisionId: UNITS.MA.divisionId },
  ]);
}

async function addressesSeenBy(viewer: string) {
  signInAs(accountOf(viewer).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data.memberTeamAddresses(ALL.map((u) => IDS.person(u)));
}

test("the team leader reads both addresses the member holds, by address, each with its role; members holding none have no row", async () => {
  await seeded();
  assert.deepEqual(await addressesSeenBy("team leader"), {
    [HOLDER]: [
      { address: "logistics@politorocketteam.it", purpose: "Logistics", movesWith: "Mission Analysis Lead" },
      { address: "recruitment@politorocketteam.it", purpose: "Recruitment", movesWith: "IT Lead" },
    ],
  });
});

test("a viewer who does not reach the Members page reads no team address", async () => {
  await seeded();
  assert.deepEqual(await addressesSeenBy("member"), {});
});
