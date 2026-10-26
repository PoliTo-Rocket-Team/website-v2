import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import { dashboardNotices, teamAddresses, teamAddressRequests } from "@/db/schema";
import { addRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { ALL, UNITS } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import type { TeamSideOverview } from "./overview";
import { NO_TEAM_ADDRESSES } from "./team-address";

// Shared team addresses on the migrated in-memory Postgres (epic #578): the
// member side view's Team addresses row (issue #786, board 102), read with
// the role each moves with, for a viewer who reaches the Members page, and
// for nobody else; and Request team address (issue #787, board 102b), stored
// as one open request per address; and the approvers' Decline and Mark
// created (issue #788).

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

// Decline and Mark created (issue #788) --------------------------------------------

const REQUEST = 1;
const ASKED_FOR = IDS.person("DM");
const REQUESTER = IDS.lead("DM");

/** The seeded addresses, and one open request for DM's member sent by DM's lead, tied to the IT lead's seat. */
async function seededWithRequest(): Promise<void> {
  await seeded();
  await addRows(teamAddressRequests, [
    { id: REQUEST, memberId: ASKED_FOR, address: "design@politorocketteam.it", purpose: "Design", movesWith: "full_access_seat", movesWithSeat: "it_lead", requestedBy: REQUESTER },
  ]);
}

async function requestRowsSeenBy(viewer: string) {
  signInAs(accountOf(viewer).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  const overview = (await (opening as { data: DashboardData }).data.overview()) as TeamSideOverview;
  return overview.attention.filter((a) => a.kind === "team-address-request");
}

test("the team leader, the operations lead and the IT lead each see the open request; the Project Manager, the Chief Engineer and a lead do not", async () => {
  await seededWithRequest();
  for (const viewer of ["team leader", "operations lead", "IT lead"]) {
    const rows = await requestRowsSeenBy(viewer);
    assert.equal(rows.length, 1, viewer);
    assert.match(rows[0]!.title, /asks for design@politorocketteam\.it for /, viewer);
    assert.match(rows[0]!.detail, /^Design · moves with IT Lead · sent /, viewer);
  }
  for (const viewer of ["Project Manager", "Chief Engineer", "division lead"]) assert.deepEqual(await requestRowsSeenBy(viewer), [], viewer);
});

test("Mark created stores the address under the member with its purpose and role, closes the request and tells the requester; a second answer is refused", async () => {
  await seededWithRequest();
  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.answerTeamAddress(REQUEST, { kind: "created", address: "Design@PoliToRocketTeam.it" }), { ok: true, value: null });
  const held = (await tableRows(teamAddresses)).filter((r) => r.holderId === ASKED_FOR);
  assert.deepEqual(
    held.map((r) => [r.address, r.purpose, r.movesWith, r.movesWithSeat]),
    [["design@politorocketteam.it", "Design", "full_access_seat", "it_lead"]],
  );
  assert.deepEqual((await tableRows(teamAddressRequests)).map((r) => r.outcome), ["created"]);
  const told = (await tableRows(dashboardNotices)).filter((r) => r.kind === "team-address-created");
  assert.deepEqual(
    told.map((r) => [r.recipientId, r.subjectId, r.data]),
    [[REQUESTER, ASKED_FOR, { address: "design@politorocketteam.it" }]],
  );
  const { rows } = await addressesSeenBy("team leader");
  assert.deepEqual(rows[ASKED_FOR]?.lines, [{ address: "design@politorocketteam.it", purpose: "Design", movesWith: "IT Lead" }]);
  signInAs(accountOf("team leader").userId);
  const again = await actions.answerTeamAddress(REQUEST, { kind: "decline" });
  assert.ok(!again.ok && /already answered/.test(again.error), JSON.stringify(again));
});

test("Decline closes the request, stores nothing under the member and tells the requester who declined", async () => {
  await seededWithRequest();
  signInAs(accountOf("operations lead").userId);
  assert.deepEqual(await actions.answerTeamAddress(REQUEST, { kind: "decline" }), { ok: true, value: null });
  assert.deepEqual((await tableRows(teamAddresses)).filter((r) => r.holderId === ASKED_FOR), []);
  assert.deepEqual((await tableRows(teamAddressRequests)).map((r) => r.outcome), ["declined"]);
  const told = (await tableRows(dashboardNotices)).filter((r) => r.kind === "team-address-declined");
  assert.deepEqual(
    told.map((r) => r.recipientId),
    [REQUESTER],
  );
  assert.equal((told[0]!.data as { address: string }).address, "design@politorocketteam.it");
});

test("Mark created on an address that became a team address meanwhile is refused and leaves the request open", async () => {
  await seededWithRequest();
  await addRows(teamAddresses, [{ address: "DESIGN@politorocketteam.it", purpose: "Design", holderId: HOLDER }]);
  signInAs(accountOf("team leader").userId);
  const answer = await actions.answerTeamAddress(REQUEST, { kind: "created", address: "design@politorocketteam.it" });
  assert.ok(!answer.ok && /already a team address/.test(answer.error), JSON.stringify(answer));
  assert.deepEqual((await tableRows(teamAddressRequests)).map((r) => r.outcome), [null]);
  assert.deepEqual((await tableRows(teamAddresses)).filter((r) => r.holderId === ASKED_FOR), []);
});
