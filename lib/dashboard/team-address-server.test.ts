import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { dashboardNotices, divisions, teamAddresses, teamAddressReroutes, teamAddressRequests } from "@/db/schema";
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
// created (issue #788); and the routing item a role change raises, with Mark
// done (issue #789).

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

// Routing when a tied role changes hands (issue #789) ------------------------------

const STRUCTURES = "structures@politorocketteam.it";
const DM_LEAD = IDS.lead("DM");
const DM_MEMBER = IDS.person("DM");
const MA_LEAD = IDS.lead("MA");
const MA_MEMBER = IDS.person("MA");

/** The fixture, with an address tied to DM's lead held by that lead, and one tied to MA's lead held by MA's lead. */
async function seededTied(): Promise<void> {
  await seedFixture();
  await addRows(teamAddresses, [
    { id: 1, address: STRUCTURES, purpose: "Structures", holderId: DM_LEAD, movesWith: "division_lead", movesWithDivisionId: UNITS.DM.divisionId },
    { id: 2, address: "mission@politorocketteam.it", purpose: "Mission", holderId: MA_LEAD, movesWith: "division_lead", movesWithDivisionId: UNITS.MA.divisionId },
  ]);
}

async function rerouteRowsSeenBy(viewer: string) {
  signInAs(accountOf(viewer).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  const overview = (await (opening as { data: DashboardData }).data.overview()) as TeamSideOverview;
  return overview.attention.filter((a) => a.kind === "team-address-reroute");
}

/** Edit division's save of MA, as the team leader sends it. */
async function saveMA(change: { newLeads?: number[]; oldLeads?: unknown[] }) {
  const division = (await tableRows(divisions)).find((d) => d.id === UNITS.MA.divisionId)!;
  return teamActions.saveDivision(UNITS.MA.divisionId, { name: String(division.name), code: String(division.code), newLeads: [], oldLeads: [], members: [], emails: [], ...change });
}

test("a confirmed hand-over of a tied division lead raises one routing item each approver seat sees with the new holder's sign-in email; Mark done moves the address once", async () => {
  await seededTied();
  // Structures' head answers DM's lead's hand-over to DM's member.
  signInAs("head-str");
  assert.deepEqual(await actions.answerHandOver(IDS.handOver("DM"), "confirm"), { ok: true, value: null });
  assert.deepEqual(
    (await tableRows(teamAddressReroutes)).map((r) => [r.addressId, r.toMember, r.fromMember, r.doneAt]),
    [[1, DM_MEMBER, DM_LEAD, null]],
  );
  for (const viewer of ["team leader", "operations lead", "IT lead"]) {
    const rows = await rerouteRowsSeenBy(viewer);
    assert.deepEqual(rows.map((r) => r.title), [`${STRUCTURES} goes to Person DM`], viewer);
    assert.match(rows[0]!.detail, /person-dm@mail\.test$/, viewer);
    assert.deepEqual(rows[0]!.action, { markRerouteDone: 1, address: STRUCTURES, member: "Person DM", signInEmail: "person-dm@mail.test" }, viewer);
  }
  for (const viewer of ["Project Manager", "division lead"]) assert.deepEqual(await rerouteRowsSeenBy(viewer), [], viewer);

  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.markTeamAddressRerouteDone(1), { ok: true, value: null });
  const { rows } = await addressesSeenBy("team leader");
  assert.deepEqual(rows[DM_MEMBER]?.lines.map((l) => l.address), [STRUCTURES], "the address shows under the new holder");
  assert.equal(rows[DM_LEAD]?.lines.some((l) => l.address === STRUCTURES) ?? false, false, "and leaves the previous holder");
  assert.deepEqual(await rerouteRowsSeenBy("team leader"), []);
  signInAs(accountOf("operations lead").userId);
  const again = await actions.markTeamAddressRerouteDone(1);
  assert.ok(!again.ok && /already moved/.test(again.error), JSON.stringify(again));
});

test("adding a co-lead beside the holder raises no routing item, and neither does a refused save", async () => {
  await seededTied();
  signInAs(accountOf("member").userId);
  assert.equal((await saveMA({ newLeads: [MA_MEMBER], oldLeads: [{ personId: MA_LEAD, via: "replaced", outcome: "advisor" }] })).ok, false);
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await saveMA({ newLeads: [MA_MEMBER] }), { ok: true });
  assert.deepEqual(await tableRows(teamAddressReroutes), []);
});

test("a second change before Mark done leaves one open routing item for the address", async () => {
  await seededTied();
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await saveMA({ newLeads: [MA_MEMBER], oldLeads: [{ personId: MA_LEAD, via: "replaced", outcome: "advisor" }] }), { ok: true });
  assert.deepEqual(await saveMA({ newLeads: [IDS.person("OA")], oldLeads: [{ personId: MA_MEMBER, via: "replaced", outcome: "advisor" }] }), { ok: true });
  assert.deepEqual(
    (await tableRows(teamAddressReroutes)).map((r) => [r.addressId, r.toMember, r.fromMember]),
    [[2, MA_MEMBER, MA_LEAD]],
  );
});
