import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { dashboardNotices, divisions, roles, teamAddresses, teamAddressRemovals, teamAddressReroutes, teamAddressRequests } from "@/db/schema";
import { addRows, changeRows, tableRows } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { ALL, UNITS } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import type { TeamSideOverview } from "./overview";
import { moveTeamAddress, readRerouteMove, storeTeamAddressRemoval } from "./database-team-address";
import { NO_TEAM_ADDRESSES, REMOVAL_ALREADY_DONE, REMOVAL_HOLDER_CHANGED, REROUTE_BEING_REMOVED, REROUTE_ROLE_MOVED } from "./team-address";

// Shared team addresses on the migrated in-memory Postgres (epic #578): the
// member side view's Team addresses row (issue #786, board 102), read with
// the role each moves with, for a viewer who reaches the Members page, and
// for nobody else; and Request team address (issue #787, board 102b), stored
// as one open request per address; and the approvers' Decline and Mark
// created (issue #788); and the routing item a role change raises, with Mark
// done (issue #789); and Remove, with its Mark done (issue #797).

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
  assert.deepEqual(
    rows[HOLDER]?.lines.map(({ address, purpose, movesWith }) => ({ address, purpose, movesWith })),
    [
      { address: "logistics@politorocketteam.it", purpose: "Logistics", movesWith: "Mission Analysis Lead" },
      { address: "recruitment@politorocketteam.it", purpose: "Recruitment", movesWith: "IT Lead" },
    ],
  );
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
  assert.deepEqual(
    rows[ASKED_FOR]?.lines.map(({ address, purpose, movesWith }) => ({ address, purpose, movesWith })),
    [{ address: "design@politorocketteam.it", purpose: "Design", movesWith: "IT Lead" }],
  );
  signInAs(accountOf("team leader").userId);
  const again = await actions.answerTeamAddress(REQUEST, { kind: "decline" });
  assert.ok(!again.ok && /already answered/.test(again.error), JSON.stringify(again));
});

test("Mark created's row carries the member's sign-in email, which its dialog shows as Forwards to", async () => {
  await seededWithRequest();
  const [row] = await requestRowsSeenBy("IT lead");
  assert.deepEqual(row?.action, {
    answerTeamAddress: REQUEST,
    member: "Person DM",
    address: "design@politorocketteam.it",
    purpose: "Design",
    signInEmail: "person-dm@mail.test",
  });
});

/** The holder's own team addresses, as their Overview's ready cards read them. */
async function ownAddressesOf(userId: string) {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data.myTeamAddresses();
}

test("after Mark created the holder reads the address as not set up, until they press I've set it up once; nobody else can", async () => {
  await seededWithRequest();
  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.answerTeamAddress(REQUEST, { kind: "created", address: "design@politorocketteam.it" }), { ok: true, value: null });
  const [own] = await ownAddressesOf("person-dm");
  assert.deepEqual(own && { address: own.address, setUp: own.setUp }, { address: "design@politorocketteam.it", setUp: false });
  signInAs(accountOf("team leader").userId);
  assert.equal((await actions.confirmTeamAddressSetUp(own!.id)).ok, false, "the team leader does not hold it");
  signInAs("person-dm");
  assert.deepEqual(await actions.confirmTeamAddressSetUp(own!.id), { ok: true, value: null });
  assert.deepEqual((await ownAddressesOf("person-dm")).map((a) => a.setUp), [true]);
  assert.equal((await actions.confirmTeamAddressSetUp(own!.id)).ok, false, "a second press");
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

/** Edit division's save of a division, as the signed-in viewer sends it. */
async function saveDivision(divisionId: number, change: { newLeads?: number[]; oldLeads?: unknown[] }) {
  const division = (await tableRows(divisions)).find((d) => d.id === divisionId)!;
  return teamActions.saveDivision(divisionId, { name: String(division.name), code: String(division.code), newLeads: [], oldLeads: [], members: [], emails: [], ...change });
}

/** Edit division's save of MA. */
const saveMA = (change: { newLeads?: number[]; oldLeads?: unknown[] }) => saveDivision(UNITS.MA.divisionId, change);

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

test("Mark done clears the set-up, so the new holder reads the ready card and the previous holder no longer holds it", async () => {
  await seededTied();
  signInAs("lead-dm");
  assert.deepEqual(await actions.confirmTeamAddressSetUp(1), { ok: true, value: null });
  signInAs("head-str");
  assert.deepEqual(await actions.answerHandOver(IDS.handOver("DM"), "confirm"), { ok: true, value: null });
  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.markTeamAddressRerouteDone(1), { ok: true, value: null });
  assert.deepEqual(
    (await ownAddressesOf("person-dm")).map((a) => [a.address, a.setUp]),
    [[STRUCTURES, false]],
  );
  assert.deepEqual(await ownAddressesOf("lead-dm"), []);
});

test("adding a co-lead beside the holder raises no routing item, and neither does a refused save", async () => {
  await seededTied();
  signInAs(accountOf("member").userId);
  assert.equal((await saveMA({ newLeads: [MA_MEMBER], oldLeads: [{ personId: MA_LEAD, via: "replaced", outcome: "advisor" }] })).ok, false);
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await saveMA({ newLeads: [MA_MEMBER] }), { ok: true });
  assert.deepEqual(await tableRows(teamAddressReroutes), []);
});

test("a second change before Mark done leaves one open routing item, naming the role's holder now; Mark done moves the address to them", async () => {
  const OA = IDS.person("OA");
  await seededTied();
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await saveMA({ newLeads: [MA_MEMBER], oldLeads: [{ personId: MA_LEAD, via: "replaced", outcome: "advisor" }] }), { ok: true });
  assert.deepEqual(await saveMA({ newLeads: [OA], oldLeads: [{ personId: MA_MEMBER, via: "replaced", outcome: "advisor" }] }), { ok: true });
  assert.deepEqual(
    (await tableRows(teamAddressReroutes)).map((r) => [r.addressId, r.toMember, r.fromMember, r.doneAt]),
    [[2, OA, MA_LEAD, null]],
  );
  assert.deepEqual(
    (await rerouteRowsSeenBy("team leader")).map((r) => r.title),
    ["mission@politorocketteam.it goes to Person OA"],
  );
  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.markTeamAddressRerouteDone(1), { ok: true, value: null });
  assert.deepEqual(
    (await tableRows(teamAddresses)).filter((r) => r.id === 2).map((r) => r.holderId),
    [OA],
  );
  assert.deepEqual((await tableRows(teamAddressReroutes)).map((r) => [r.toMember, r.doneAt !== null]), [[OA, true]]);
});

test("Mark done moves the address to whoever took the tied role over, even when the item named someone who left it since", async () => {
  const OA = IDS.person("OA");
  await seededTied();
  // MA's lead hands MA to its member: the item names MA's member.
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await saveMA({ newLeads: [MA_MEMBER], oldLeads: [{ personId: MA_LEAD, via: "replaced", outcome: "advisor" }] }), { ok: true });
  assert.deepEqual(await saveMA({ newLeads: [OA], oldLeads: [{ personId: MA_MEMBER, via: "replaced", outcome: "advisor" }] }), { ok: true });
  // Laid back to name MA's member, who left the role, as an item stored before this rule reads: Mark done reads the role's holder anyway.
  await changeRows(teamAddressReroutes, { addressId: 2 }, { toMember: MA_MEMBER });
  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.markTeamAddressRerouteDone(1), { ok: true, value: null });
  assert.deepEqual(
    (await tableRows(teamAddresses)).filter((r) => r.id === 2).map((r) => r.holderId),
    [OA],
  );
});

test("a role change between Mark done's read and its write refuses the move with a plain reason and leaves the item open, naming the role's holder now", async () => {
  const OA = IDS.person("OA");
  await seededTied();
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await saveMA({ newLeads: [MA_MEMBER], oldLeads: [{ personId: MA_LEAD, via: "replaced", outcome: "advisor" }] }), { ok: true });
  // What Mark done read: the address goes to MA's member, who leads MA now.
  const read = await readRerouteMove(1);
  assert.ok(read.ok, JSON.stringify(read));
  assert.equal(read.value.toId, MA_MEMBER);
  // The role changes hands before Mark done's write: the item now names OA.
  assert.deepEqual(await saveMA({ newLeads: [OA], oldLeads: [{ personId: MA_MEMBER, via: "replaced", outcome: "advisor" }] }), { ok: true });
  const mover = { memberId: accountOf("IT lead").memberId, actingAccountId: null };
  assert.deepEqual(await moveTeamAddress(mover, read.value), { ok: false, error: REROUTE_ROLE_MOVED }, "the item was re-pointed");
  // As if the re-point had not landed: the item names MA's member, who left the role, so the write is refused all the same.
  await changeRows(teamAddressReroutes, { addressId: 2 }, { toMember: MA_MEMBER });
  assert.deepEqual(await moveTeamAddress(mover, read.value), { ok: false, error: REROUTE_ROLE_MOVED }, "the member it chose left the role");
  await changeRows(teamAddressReroutes, { addressId: 2 }, { toMember: OA });
  assert.deepEqual(
    (await tableRows(teamAddresses)).filter((r) => r.id === 2).map((r) => r.holderId),
    [MA_LEAD],
    "nothing was moved",
  );
  assert.deepEqual((await tableRows(teamAddressReroutes)).map((r) => [r.toMember, r.doneAt]), [[OA, null]], "the item stays open");
  assert.deepEqual(
    (await rerouteRowsSeenBy("IT lead")).map((r) => r.title),
    ["mission@politorocketteam.it goes to Person OA"],
  );
  // Mark done again reads the role's holder now and moves the address to them.
  assert.deepEqual(await actions.markTeamAddressRerouteDone(1), { ok: true, value: null });
  assert.deepEqual(
    (await tableRows(teamAddresses)).filter((r) => r.id === 2).map((r) => r.holderId),
    [OA],
  );
});

test("Mark done's write reads each tie kind's holder as the read does: the team leader, a full-access seat, and a department's head on the department or on one of its divisions", async () => {
  const LEADER = accountOf("team leader").memberId!;
  const IT = accountOf("IT lead").memberId!;
  const HEAD = EXTRA.head;
  await seedFixture();
  const tied = [
    { id: 3, address: "leader@politorocketteam.it", movesWith: "team_leader" as const, to: LEADER },
    { id: 4, address: "it@politorocketteam.it", movesWith: "full_access_seat" as const, movesWithSeat: "it_lead" as const, to: IT },
    { id: 5, address: "structures-head@politorocketteam.it", movesWith: "department_head" as const, movesWithDeptId: UNITS.DM.departmentId, to: HEAD },
    { id: 6, address: "structures-office@politorocketteam.it", movesWith: "department_head" as const, movesWithDeptId: UNITS.DM.departmentId, to: HEAD },
  ];
  await addRows(
    teamAddresses,
    tied.map(({ to: _, ...a }) => ({ ...a, purpose: "Office", holderId: MA_MEMBER })),
  );
  await addRows(
    teamAddressReroutes,
    tied.map((a) => ({ id: a.id + 10, addressId: a.id, toMember: a.to, fromMember: MA_MEMBER })),
  );
  signInAs(accountOf("IT lead").userId);
  for (const a of tied.slice(0, 3)) assert.deepEqual(await actions.markTeamAddressRerouteDone(a.id + 10), { ok: true, value: null }, a.address);
  // The head's row kept on one of the department's divisions instead.
  await changeRows(roles, { memberId: HEAD, type: "head" }, { deptId: null, divisionId: UNITS.DM.divisionId });
  assert.deepEqual(await actions.markTeamAddressRerouteDone(16), { ok: true, value: null }, "head row on a division");
  assert.deepEqual(
    (await tableRows(teamAddresses)).filter((r) => Number(r.id) >= 3).map((r) => [r.id, r.holderId]),
    tied.map((a) => [a.id, a.to]),
  );
});

test("a lead handing a division over to someone who already co-leads raises one routing item naming that co-lead", async () => {
  await seededTied();
  // DM's member becomes a co-lead beside DM's lead, who holds the address: nothing is raised.
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await saveDivision(UNITS.DM.divisionId, { newLeads: [DM_MEMBER] }), { ok: true });
  assert.deepEqual(await tableRows(teamAddressReroutes), []);
  // DM's lead hands DM over to that co-lead.
  signInAs("head-str");
  assert.deepEqual(await actions.answerHandOver(IDS.handOver("DM"), "confirm"), { ok: true, value: null });
  assert.deepEqual(
    (await tableRows(teamAddressReroutes)).map((r) => [r.addressId, r.toMember, r.fromMember, r.doneAt]),
    [[1, DM_MEMBER, DM_LEAD, null]],
  );
  assert.deepEqual(
    (await rerouteRowsSeenBy("team leader")).map((r) => r.title),
    [`${STRUCTURES} goes to Person DM`],
  );
});

// Remove (issue #797) ------------------------------------------------------------------

const LOGISTICS = "logistics@politorocketteam.it";

/** The id `address` is stored under. */
async function idOf(address: string): Promise<number> {
  return Number((await tableRows(teamAddresses)).find((r) => r.address === address)!.id);
}

async function removalRowsSeenBy(viewer: string) {
  signInAs(accountOf(viewer).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  const overview = (await (opening as { data: DashboardData }).data.overview()) as TeamSideOverview;
  return overview.attention.filter((a) => a.kind === "team-address-removal");
}

test("Remove stores one open removal the approver seats alone see; Mark done frees the address, keeps the removal, and the address is requested and created for someone else", async () => {
  await seeded();
  const id = await idOf(LOGISTICS);
  // A plain member may not remove it, and nothing is written.
  signInAs(accountOf("member").userId);
  assert.equal((await actions.removeTeamAddress(id)).ok, false);
  assert.deepEqual(await tableRows(teamAddressRemovals), []);
  // MA's lead may, as they may request one for MA's member; a second Remove while it waits is refused.
  signInAs("lead-ma");
  assert.deepEqual(await actions.removeTeamAddress(id), { ok: true, value: null });
  const again = await actions.removeTeamAddress(id);
  assert.ok(!again.ok && /already waiting/.test(again.error), JSON.stringify(again));
  assert.equal((await tableRows(teamAddressRemovals)).length, 1);
  // The line shows the waiting removal, and the address still counts as held.
  const { rows } = await addressesSeenBy("team leader");
  assert.deepEqual(
    rows[HOLDER]?.lines.map((l) => [l.address, l.removal]),
    [
      [LOGISTICS, "waiting"],
      ["recruitment@politorocketteam.it", "removable"],
    ],
  );
  const ask = () => actions.requestTeamAddress({ memberId: DM_MEMBER, address: "Logistics@PoliToRocketTeam.it", purpose: "Logistics", movesWith: null });
  const held = await ask();
  assert.ok(!held.ok && /already a team address/.test(held.error), JSON.stringify(held));

  for (const viewer of ["team leader", "operations lead", "IT lead"]) {
    assert.deepEqual(
      (await removalRowsSeenBy(viewer)).map((r) => [r.title, r.action]),
      [[`Remove ${LOGISTICS} from Person MA`, { markRemovalDone: 1, address: LOGISTICS, member: "Person MA" }]],
      viewer,
    );
  }
  for (const viewer of ["Project Manager", "Chief Engineer", "division lead"]) assert.deepEqual(await removalRowsSeenBy(viewer), [], viewer);
  signInAs(accountOf("Project Manager").userId);
  assert.equal((await actions.markTeamAddressRemovalDone(1)).ok, false, "the Project Manager may not mark it done");

  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.markTeamAddressRemovalDone(1), { ok: true, value: null });
  assert.deepEqual(await actions.markTeamAddressRemovalDone(1), { ok: false, error: REMOVAL_ALREADY_DONE }, "a second Mark done");
  assert.deepEqual(
    (await addressesSeenBy("team leader")).rows[HOLDER]?.lines.map((l) => l.address),
    ["recruitment@politorocketteam.it"],
  );
  assert.deepEqual(
    (await ownAddressesOf(`person-ma`)).map((a) => a.address),
    ["recruitment@politorocketteam.it"],
    "and from the holder's Overview",
  );
  assert.deepEqual(
    (await tableRows(teamAddressRemovals)).map((r) => [r.addressId, r.address, r.fromMember, r.removedBy, r.doneBy, r.doneAt !== null]),
    [[null, LOGISTICS, HOLDER, MA_LEAD, accountOf("IT lead").memberId, true]],
  );

  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await ask(), { ok: true, value: null });
  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.answerTeamAddress(1, { kind: "created", address: LOGISTICS }), { ok: true, value: null });
  assert.deepEqual(
    (await tableRows(teamAddresses)).filter((r) => r.address === LOGISTICS).map((r) => r.holderId),
    [DM_MEMBER],
  );
});

test("while a removal waits, the address's routing item is hidden and its Mark done refused; the removal's Mark done takes the item with the address", async () => {
  await seededTied();
  signInAs("head-str");
  assert.deepEqual(await actions.answerHandOver(IDS.handOver("DM"), "confirm"), { ok: true, value: null });
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await actions.removeTeamAddress(1), { ok: true, value: null });
  assert.deepEqual(await rerouteRowsSeenBy("IT lead"), []);
  assert.deepEqual(await actions.markTeamAddressRerouteDone(1), { ok: false, error: REROUTE_BEING_REMOVED });
  assert.deepEqual(
    (await tableRows(teamAddresses)).filter((r) => r.id === 1).map((r) => r.holderId),
    [DM_LEAD],
    "the address did not move",
  );
  assert.deepEqual(await actions.markTeamAddressRemovalDone(1), { ok: true, value: null });
  assert.deepEqual(await tableRows(teamAddressReroutes), []);
  assert.deepEqual((await tableRows(teamAddresses)).filter((r) => r.address === STRUCTURES), []);
});

test("a removal whose holder then leaves the team stays with the approver seats, and its Mark done frees the address", async () => {
  await seeded();
  const id = await idOf(LOGISTICS);
  signInAs("lead-ma");
  assert.deepEqual(await actions.removeTeamAddress(id), { ok: true, value: null });
  // The holder leaves the team: every role they hold ends.
  signInAs("person-ma");
  assert.equal((await actions.leaveTeam("Moving on", false)).ok, true, "the holder leaves");
  assert.ok((await tableRows(roles)).filter((r) => r.memberId === HOLDER).every((r) => r.leavedAt !== null), "no active role is left");
  for (const viewer of ["team leader", "operations lead", "IT lead"]) {
    assert.deepEqual(
      (await removalRowsSeenBy(viewer)).map((r) => [r.title, r.action]),
      [[`Remove ${LOGISTICS} from Person MA`, { markRemovalDone: 1, address: LOGISTICS, member: "Person MA" }]],
      viewer,
    );
  }
  signInAs(accountOf("IT lead").userId);
  assert.deepEqual(await actions.markTeamAddressRemovalDone(1), { ok: true, value: null });
  assert.deepEqual((await tableRows(teamAddresses)).filter((r) => r.address === LOGISTICS), [], "the address is free");
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(
    await actions.requestTeamAddress({ memberId: DM_MEMBER, address: LOGISTICS, purpose: "Logistics", movesWith: null }),
    { ok: true, value: null },
    "and can be requested again",
  );
});

test("an address that moves to another member between Remove's check and its write is refused, and no removal is stored", async () => {
  await seeded();
  const id = await idOf(LOGISTICS);
  signInAs(accountOf("team leader").userId);
  // What Remove's check read: the address, held by MA's member.
  const checked = { addressId: id, address: LOGISTICS, holderId: HOLDER, removerId: accountOf("team leader").memberId! };
  // A routing item's Mark done moves it before the write.
  await changeRows(teamAddresses, { id }, { holderId: DM_MEMBER });
  assert.deepEqual(await storeTeamAddressRemoval({ actingAccountId: null }, checked), { ok: false, error: REMOVAL_HOLDER_CHANGED });
  assert.deepEqual(await tableRows(teamAddressRemovals), [], "nothing is stored");
  // Read again, the check names the new holder, and Remove goes through against them.
  assert.deepEqual(await actions.removeTeamAddress(id), { ok: true, value: null });
  assert.deepEqual((await tableRows(teamAddressRemovals)).map((r) => r.fromMember), [DM_MEMBER]);
});
