import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import { teamAddresses, teamAddressRequests } from "@/db/schema";
import { addRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { ALL, UNITS } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { NO_TEAM_ADDRESSES } from "./team-address";

// Shared team addresses on the migrated in-memory Postgres (epic #578): the
// member side view's Team addresses row (issue #786, board 102), read with
// the role each moves with, for a viewer who reaches the Members page, and
// for nobody else; and Request team address (issue #787, board 102b), stored
// as one open request per address.

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

test("the team leader reads both addresses the member holds, by address, each with its role", async () => {
  await seeded();
  const { rows } = await addressesSeenBy("team leader");
  assert.deepEqual(rows[HOLDER]?.lines, [
    { address: "logistics@politorocketteam.it", purpose: "Logistics", movesWith: "Mission Analysis Lead" },
    { address: "recruitment@politorocketteam.it", purpose: "Recruitment", movesWith: "IT Lead" },
  ]);
});

test("a viewer who does not reach the Members page reads no team address", async () => {
  await seeded();
  assert.deepEqual(await addressesSeenBy("member"), NO_TEAM_ADDRESSES);
});

test("Request team address stores one open request; the same address again in another case, or one already held, is refused and stores nothing", async () => {
  await seeded();
  signInAs(accountOf("team leader").userId);
  const ask = (address: string) => actions.requestTeamAddress({ memberId: HOLDER, address, purpose: "Events", movesWith: "team-leader" });
  assert.deepEqual(await ask("Events@politorocketteam.it"), { ok: true, value: null });
  const again = await ask("EVENTS@PoliToRocketTeam.it");
  assert.ok(!again.ok && /already requested/.test(again.error), JSON.stringify(again));
  const held = await ask("logistics@politorocketteam.it");
  assert.ok(!held.ok && /already a team address/.test(held.error), JSON.stringify(held));
  const stored = await tableRows(teamAddressRequests);
  assert.deepEqual(
    stored.map((r) => [r.address, r.memberId, r.movesWith, r.outcome]),
    [["events@politorocketteam.it", HOLDER, "team_leader", null]],
  );
});
