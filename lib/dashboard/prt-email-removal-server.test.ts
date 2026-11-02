import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { aliasRequests, members, prtEmailRemovals, roles } from "@/db/schema";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { addRows, changeRows, databaseWrites, logRowsSinceSeed, tableRows } from "./access-matrix/test-database";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import type { TeamSideOverview } from "./overview";
import { PRT_EMAIL_REMOVAL_ALREADY_ANSWERED } from "./prt-email-removal";

// Personal PRT email removals on the migrated in-memory Postgres (issue
// #931): every way of leaving the team opens one for the member's PRT email,
// the database judging the roles as each write leaves them (drizzle/0084),
// and cancels the member's own open PRT email request; a member who stays on
// as an advisor keeps the address and the request until that role ends;
// rejoining the team cancels an open removal, taking an advisor role again
// leaves it open; and the alias approvers, every holder of each seat, answer
// it with Mark done or Keep address, once.

const PERSON = IDS.person("DM"); // a member of Design & Manufacturing, "Person DM"
const LEAD = IDS.lead("DM"); // its lead, "Lead DM"
const DM = IDS.division("DM");
const TEAM_LEADER = accountOf("team leader").userId;
const ADDRESS = "person.dm@politorocketteam.it";

async function withPrtEmail(memberId: number, address: string): Promise<void> {
  await changeRows(members, { memberId }, { prtEmail: address });
}

async function removals() {
  return (await tableRows(prtEmailRemovals)).map((r) => ({ memberId: r.memberId, address: r.address, outcome: r.outcome }));
}

async function prtEmailOf(memberId: number) {
  return (await tableRows(members)).find((r) => r.memberId === memberId)?.prtEmail ?? null;
}

async function openIdOf(address: string): Promise<number> {
  const row = (await tableRows(prtEmailRemovals)).find((r) => r.address === address && r.outcome === null);
  assert.ok(row, `an open removal of ${address}`);
  return row.id as number;
}

/** Moves someone to alumni as the team leader, the leave a lead or the team leader makes. */
async function moveToAlumni(memberId: number) {
  signInAs(TEAM_LEADER);
  assert.deepEqual(await teamActions.moveToAlumni(memberId, "2024 – 2026", null), { ok: true }, "the leave is never refused");
}

async function removalRowsSeenBy(userId: string) {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  const overview = (await (opening as { data: DashboardData }).data.overview()) as TeamSideOverview;
  return overview.attention.filter((a) => a.kind === "prt-email-removal");
}

// Opening one on every way of leaving ------------------------------------------

test("a member with a PRT email moved to alumni gets one open removal naming the address", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  assert.deepEqual(await removals(), [{ memberId: PERSON, address: ADDRESS, outcome: null }]);
});

test("a member with no PRT email leaves with no removal", async () => {
  await seedFixture();
  await moveToAlumni(PERSON);
  assert.deepEqual(await removals(), []);
});

test("a member who leaves the team themselves gets a removal of their PRT email", async () => {
  await seedFixture();
  const self = accountOf("member");
  await withPrtEmail(self.memberId!, "viewer.member@politorocketteam.it");
  signInAs(self.userId);
  assert.equal((await actions.leaveTeam("Moving on", false)).ok, true);
  assert.deepEqual(await removals(), [{ memberId: self.memberId, address: "viewer.member@politorocketteam.it", outcome: null }]);
});

test("a lead who hands their division over and leaves the team gets a removal", async () => {
  await seedFixture();
  await withPrtEmail(LEAD, "lead.dm@politorocketteam.it");
  signInAs(TEAM_LEADER);
  const division = { name: "Design & Manufacturing", code: "DMA", members: [], emails: [] };
  const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [PERSON], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "leave" }] });
  assert.equal(saved.ok, true);
  assert.deepEqual(await removals(), [{ memberId: LEAD, address: "lead.dm@politorocketteam.it", outcome: null }]);
});

test("a lead who stays on as an advisor keeps the address; ending that last advisor role opens the removal", async () => {
  await seedFixture();
  await withPrtEmail(LEAD, "lead.dm@politorocketteam.it");
  signInAs("head-str");
  assert.equal((await actions.answerHandOver(IDS.handOver("DM"), "confirm")).ok, true, "the hand-over to an advisor is confirmed");
  const advisor = (await tableRows(roles)).filter((r) => r.memberId === LEAD && r.leavedAt === null);
  assert.deepEqual(advisor.map((r) => r.type), ["advisor"]);
  assert.deepEqual(await removals(), [], "no removal while the advisor role is held");
  await moveToAlumni(LEAD);
  assert.deepEqual(await removals(), [{ memberId: LEAD, address: "lead.dm@politorocketteam.it", outcome: null }]);
});

test("a second leave for an address whose removal is open opens no second one, in any letter case", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await withPrtEmail(LEAD, ADDRESS.toUpperCase());
  await moveToAlumni(PERSON);
  await moveToAlumni(LEAD);
  assert.deepEqual(await removals(), [{ memberId: PERSON, address: ADDRESS, outcome: null }]);
});

// Cancelled by a role started again -------------------------------------------

test("a member who rejoins before the removal is answered has it cancelled", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  await addRows(roles, [{ id: 9_100, memberId: PERSON, divisionId: DM, title: "Member", startedAt: "2026-10-31", type: "core" }]);
  assert.deepEqual(await removals(), [{ memberId: PERSON, address: ADDRESS, outcome: "cancelled" }]);
  assert.deepEqual(await removalRowsSeenBy(accountOf("IT lead").userId), [], "the row leaves the approvers' Overview");
});

test("a member who takes an advisor role again before the removal is answered leaves it open for the approvers", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  const id = await openIdOf(ADDRESS);
  await addRows(roles, [{ id: 9_101, memberId: PERSON, divisionId: DM, title: "Advisor", startedAt: "2026-10-31", type: "advisor" }]);
  assert.deepEqual(await removals(), [{ memberId: PERSON, address: ADDRESS, outcome: null }]);
  assert.equal((await removalRowsSeenBy(accountOf("IT lead").userId)).length, 1, "the row stays on the approvers' Overview");
  assert.deepEqual(await actions.answerPrtEmailRemoval(id, "kept"), { ok: true, value: null }, "the approvers still answer it");
  assert.deepEqual(await removals(), [{ memberId: PERSON, address: ADDRESS, outcome: "kept" }]);
});

// The member's own open PRT email request ------------------------------------

async function requestsOf(memberId: number) {
  return (await tableRows(aliasRequests)).filter((r) => r.memberId === memberId).map((r) => ({ id: r.id, outcome: r.outcome }));
}

test("leaving the team with no advisor role left cancels the member's own open PRT email request, logged under who made the leave", async () => {
  await seedFixture();
  const request = IDS.aliasRequest("DM");
  assert.deepEqual(await requestsOf(LEAD), [{ id: request, outcome: null }], "the lead's request is open");
  await moveToAlumni(LEAD);
  assert.deepEqual(await requestsOf(LEAD), [{ id: request, outcome: "cancelled" }]);
  const logged = (await logRowsSinceSeed()).filter((r) => r.tableName === "alias_requests");
  assert.deepEqual(logged.map((r) => [r.operation, r.recordId, r.changedBy]), [["UPDATE", String(request), TEAM_LEADER]]);
});

test("a member who stays on as an advisor keeps their own open PRT email request until the last advisor role ends", async () => {
  await seedFixture();
  const request = IDS.aliasRequest("DM");
  signInAs("head-str");
  assert.equal((await actions.answerHandOver(IDS.handOver("DM"), "confirm")).ok, true, "the hand-over to an advisor is confirmed");
  assert.deepEqual(await requestsOf(LEAD), [{ id: request, outcome: null }], "the request stays open while the advisor role is held");
  await moveToAlumni(LEAD);
  assert.deepEqual(await requestsOf(LEAD), [{ id: request, outcome: "cancelled" }]);
});

// Who sees and answers it ------------------------------------------------------

test("every holder of each alias approver seat sees the row with both answers; nobody else does", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  const id = await openIdOf(ADDRESS);
  for (const viewer of ["team leader", "operations lead", "IT lead"]) {
    const rows = await removalRowsSeenBy(accountOf(viewer).userId);
    assert.equal(rows.length, 1, viewer);
    assert.equal(rows[0]!.title, `Remove ${ADDRESS} from Person DM`, viewer);
    assert.match(rows[0]!.detail, /^Personal · left the team · today$/, viewer);
    assert.deepEqual(rows[0]!.action, { answerPrtEmailRemoval: id, address: ADDRESS, member: "Person DM" }, viewer);
  }
  for (const viewer of ["Project Manager", "Chief Engineer", "division lead", "member"]) {
    assert.deepEqual(await removalRowsSeenBy(accountOf(viewer).userId), [], viewer);
  }
  // A second IT lead, beside the seated one (epic #861), sees it and answers it too.
  await addRows(roles, [{ id: 9_102, memberId: IDS.person("MA"), title: "IT Lead", startedAt: "2026-10-01", type: "core", fullAccess: "it_lead" }]);
  assert.equal((await removalRowsSeenBy("person-ma")).length, 1, "the co-holder sees it");
  assert.deepEqual(await actions.answerPrtEmailRemoval(id, "kept"), { ok: true, value: null }, "the co-holder answers it");
});

test("anyone outside the approver seats is refused and writes nothing", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  const id = await openIdOf(ADDRESS);
  const before = (await databaseWrites()).length;
  for (const viewer of ["Project Manager", "division lead"]) {
    signInAs(accountOf(viewer).userId);
    const answer = await actions.answerPrtEmailRemoval(id, "removed");
    assert.ok(!answer.ok, viewer);
  }
  assert.equal((await databaseWrites()).length, before, "no write");
  assert.equal(await prtEmailOf(PERSON), ADDRESS);
});

// Mark done and Keep address ----------------------------------------------------

test("Mark done closes the removal, clears the PRT email, and is logged under the approver", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  const id = await openIdOf(ADDRESS);
  const it = accountOf("IT lead");
  signInAs(it.userId);
  assert.deepEqual(await actions.answerPrtEmailRemoval(id, "removed"), { ok: true, value: null });
  const [row] = await tableRows(prtEmailRemovals);
  assert.deepEqual([row!.outcome, row!.answeredBy], ["removed", it.memberId]);
  assert.equal(await prtEmailOf(PERSON), null);
  const logged = (await logRowsSinceSeed()).filter((r) => r.tableName === "prt_email_removals");
  assert.deepEqual(
    logged.map((r) => [r.operation, r.changedBy]),
    [
      ["INSERT", TEAM_LEADER],
      ["UPDATE", it.userId],
    ],
    "opened with the leave, under who made it; answered under the approver",
  );
  assert.deepEqual(await removalRowsSeenBy(it.userId), [], "the row leaves");
});

test("Keep address closes the removal, leaves the PRT email, and is logged under the approver", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  const id = await openIdOf(ADDRESS);
  const ops = accountOf("operations lead");
  signInAs(ops.userId);
  assert.deepEqual(await actions.answerPrtEmailRemoval(id, "kept"), { ok: true, value: null });
  const [row] = await tableRows(prtEmailRemovals);
  assert.deepEqual([row!.outcome, row!.answeredBy], ["kept", ops.memberId]);
  assert.equal(await prtEmailOf(PERSON), ADDRESS);
  const logged = (await logRowsSinceSeed()).filter((r) => r.tableName === "prt_email_removals");
  assert.deepEqual(
    logged.map((r) => [r.operation, r.changedBy]),
    [
      ["INSERT", TEAM_LEADER],
      ["UPDATE", ops.userId],
    ],
  );
});

test("a kept address gets no new removal for the same leave; a later leave opens one as usual", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  signInAs(accountOf("IT lead").userId);
  assert.equal((await actions.answerPrtEmailRemoval(await openIdOf(ADDRESS), "kept")).ok, true);
  // A fix to the role they left ends no active role, so it is not a leave.
  await changeRows(roles, { id: 5_000 + PERSON }, { title: "CAD Engineer" });
  assert.deepEqual(await removals(), [{ memberId: PERSON, address: ADDRESS, outcome: "kept" }]);
  await addRows(roles, [{ id: 9_103, memberId: PERSON, divisionId: DM, title: "Member", startedAt: "2026-10-31", type: "core" }]);
  await moveToAlumni(PERSON);
  assert.deepEqual(await removals(), [
    { memberId: PERSON, address: ADDRESS, outcome: "kept" },
    { memberId: PERSON, address: ADDRESS, outcome: null },
  ]);
});

test("of two approvers answering one removal, the second is refused cleanly and writes nothing", async () => {
  await seedFixture();
  await withPrtEmail(PERSON, ADDRESS);
  await moveToAlumni(PERSON);
  const id = await openIdOf(ADDRESS);
  signInAs(accountOf("IT lead").userId);
  assert.equal((await actions.answerPrtEmailRemoval(id, "removed")).ok, true);
  const before = (await databaseWrites()).length;
  for (const [viewer, answer] of [["team leader", "kept"], ["operations lead", "removed"]] as const) {
    signInAs(accountOf(viewer).userId);
    assert.deepEqual(await actions.answerPrtEmailRemoval(id, answer), { ok: false, error: PRT_EMAIL_REMOVAL_ALREADY_ANSWERED }, viewer);
  }
  assert.equal((await databaseWrites()).length, before, "no second write");
  assert.deepEqual(await removals(), [{ memberId: PERSON, address: ADDRESS, outcome: "removed" }]);
});
