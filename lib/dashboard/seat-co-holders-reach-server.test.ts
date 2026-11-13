// The dashboard imports server-only modules; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import { aliasRequests, handOverRequests, members, orders, roles, scopes, teamAddressRequests, users } from "@/db/schema";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { ALL, UNITS } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";
import { addRows, tableRows } from "./access-matrix/test-database";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import type { OrdersPage } from "./orders";
import { isAnswerAlias, type AttentionItem, type TeamSideOverview } from "./overview";

// Approvals, notices and routing reach every holder of a seat (epic #861,
// issue #870): with two team leaders, two holders of an alias approver seat
// and two heads of one department, each holder sees on their own Overview
// what waits for the seat, and either may act on it. Read and written through
// the dashboard on the migrated in-memory Postgres
// (./access-matrix/test-database.ts), on the access matrix's fixture with a
// second holder added beside each seat's fixture holder.

const SINCE = "2025-10-01";
const LEADER = () => accountOf("team leader");
const OPERATIONS = () => accountOf("operations lead");
const HEAD = () => accountOf("department head"); // heads Aerodynamics (department 1)

/** The second holder of each seat, with the account they sign in as. */
const CO = {
  leader: { memberId: 950, userId: "co-leader" },
  operations: { memberId: 951, userId: "co-operations" },
  structuresHead: { memberId: 952, userId: "co-head-str" },
} as const;
const STRUCTURES_HEAD = { memberId: EXTRA.head, userId: "head-str" } as const;

/** The fixture, with a second team leader, a second operations lead and a second Head of Structures. */
async function seeded(): Promise<void> {
  await seedFixture();
  const people = Object.values(CO);
  await addRows(members, people.map(({ memberId }) => ({ memberId, ndaSignedAt: SINCE })));
  await addRows(
    users,
    people.map(({ memberId, userId }) => ({ id: userId, email: `${userId}@team.test`, firstName: "Co", lastName: userId, member: memberId, createdAt: SINCE })),
  );
  await addRows(roles, [
    { id: 9_500, memberId: CO.leader.memberId, title: "Team Leader", startedAt: SINCE, type: "president" },
    { id: 9_510, memberId: CO.operations.memberId, title: "Operations Lead", startedAt: SINCE, type: "core", fullAccess: "operations_lead" },
    { id: 9_520, memberId: CO.structuresHead.memberId, deptId: UNITS.DM.departmentId, title: "Head", startedAt: SINCE, type: "head" },
  ]);
}

async function dataOf(userId: string): Promise<DashboardData> {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${userId}: the dashboard opens`);
  return (opening as { data: DashboardData }).data;
}

async function attentionOf(userId: string): Promise<readonly AttentionItem[]> {
  return ((await (await dataOf(userId)).overview()) as TeamSideOverview).attention;
}

const isRefused = (answer: unknown) => (answer as { ok?: boolean }).ok === false;

describe("with two team leaders, both decide orders (issue #870)", () => {
  test("both see the orders waiting for a decision, and both may decide one", async () => {
    await seeded();
    const leaders = [LEADER().userId, CO.leader.userId];
    for (const userId of leaders) {
      const attention = await attentionOf(userId);
      assert.ok(
        attention.some((a) => a.kind === "orders-to-decide" && a.title === `${ALL.length} orders wait for your decision`),
        `${userId}: the orders waiting for a decision show`,
      );
      const page = (await (await dataOf(userId)).orders()) as OrdersPage | null;
      assert.equal(page?.scope.decides, "team-leader", `${userId}: decides by the seat`);
    }
    const [first, second] = leaders;
    for (const [userId, order] of [
      [first, IDS.order("MA")],
      [second, IDS.order("OA")],
    ] as const) {
      signInAs(userId);
      const answer = await actions.decideOrder(order, { kind: "approve" });
      assert.ok(!isRefused(answer), `${userId}: ${JSON.stringify(answer)}`);
    }
    const decided = (await tableRows(orders)).filter((o) => o.id === IDS.order("MA") || o.id === IDS.order("OA"));
    assert.deepEqual(decided.map((o) => o.status), ["accepted", "accepted"]);
  });

  test("neither team leader gives the other Approve orders, by Give access or by the direct write, and a refusal writes nothing", async () => {
    await seeded();
    for (const [userId, target] of [
      [LEADER().userId, CO.leader.memberId],
      [CO.leader.userId, LEADER().memberId!],
    ] as const) {
      const before = await tableRows(scopes);
      signInAs(userId);
      const saved = await actions.saveAccess({ personId: target, where: "team", areas: {}, approveOrders: true });
      assert.ok(isRefused(saved), `${userId} by Give access: ${JSON.stringify(saved)}`);
      const direct = await (await dataOf(userId)).setApproveOrders({ personId: target, holds: true });
      assert.ok(isRefused(direct), `${userId} by the direct write: ${JSON.stringify(direct)}`);
      assert.deepEqual(await tableRows(scopes), before, `${userId}: no scope row written`);
    }
  });
});

describe("with two holders of an alias approver seat, both answer PRT email requests (issue #870)", () => {
  test("both see every waiting alias request and team address request, and either may answer one", async () => {
    await seeded();
    await addRows(teamAddressRequests, [
      { id: 870, memberId: IDS.person("MA"), address: "sponsoring@politorocketteam.it", purpose: "Sponsoring", requestedBy: LEADER().memberId },
    ]);
    const holders = [OPERATIONS().userId, CO.operations.userId];
    for (const userId of holders) {
      const attention = await attentionOf(userId);
      const aliases = attention.flatMap((a) => (a.kind === "prt-email-request" && isAnswerAlias(a.action) ? [a.action.answerAlias] : []));
      assert.deepEqual(aliases.sort(), ALL.map((u) => IDS.aliasRequest(u)).sort(), `${userId}: every waiting alias request`);
      assert.ok(
        attention.some((a) => a.kind === "prt-email-request" && "answerTeamAddress" in a.action && a.action.answerTeamAddress === 870),
        `${userId}: the waiting team address request`,
      );
    }
    const [first, second] = holders;
    signInAs(first);
    assert.ok(!isRefused(await actions.answerAlias(IDS.aliasRequest("MA"), { kind: "decline" })), `${first} declines one`);
    signInAs(second);
    const created = await actions.answerAlias(IDS.aliasRequest("OA"), { kind: "created", address: "lead.oa@politorocketteam.it" });
    assert.ok(!isRefused(created), `${second} marks one created: ${JSON.stringify(created)}`);
    assert.ok(!isRefused(await actions.answerTeamAddress(870, { kind: "decline" })), `${second} declines the team address request`);
    const outcomes = new Map((await tableRows(aliasRequests)).map((r) => [r.id, r.outcome]));
    assert.equal(outcomes.get(IDS.aliasRequest("MA")), "declined");
    assert.equal(outcomes.get(IDS.aliasRequest("OA")), "created");
    assert.deepEqual((await tableRows(teamAddressRequests)).map((r) => r.outcome), ["declined"]);
  });
});

describe("a hand-over request reaches every holder of the seat above the sender (issue #870)", () => {
  test("with two team leaders, both see a head's request and either may answer it", async () => {
    await seeded();
    const head = HEAD().memberId!;
    await addRows(handOverRequests, [{ id: 871, fromId: head, role: "head", deptId: UNITS.MA.departmentId, toId: IDS.person("MA"), outcome: "advisor", createdAt: SINCE }]);
    for (const userId of [LEADER().userId, CO.leader.userId]) {
      const rows = (await attentionOf(userId)).filter((a) => a.kind === "hand-over" && "answerHandOver" in a.action && a.action.answerHandOver === 871);
      assert.equal(rows.length, 1, `${userId}: the head's request shows`);
    }
    assert.equal((await attentionOf(HEAD().userId)).filter((a) => a.kind === "hand-over").length, 0, "the sender answers nothing");
    signInAs(CO.leader.userId);
    assert.ok(!isRefused(await actions.answerHandOver(871, "decline")), "the second team leader declines it");
    assert.equal((await tableRows(handOverRequests)).find((r) => r.id === 871)?.decision, "declined");
  });

  test("with two heads, both see a lead's request in their department and either may answer it", async () => {
    await seeded();
    const request = IDS.handOver("DM"); // the DM lead's, in Structures
    for (const { userId } of [STRUCTURES_HEAD, CO.structuresHead]) {
      const rows = (await attentionOf(userId)).filter((a) => a.kind === "hand-over" && "answerHandOver" in a.action && a.action.answerHandOver === request);
      assert.equal(rows.length, 1, `${userId}: the lead's request shows`);
    }
    signInAs(CO.structuresHead.userId);
    assert.ok(!isRefused(await actions.answerHandOver(request, "decline")), "the second head declines it");
    assert.equal((await tableRows(handOverRequests)).find((r) => r.id === request)?.decision, "declined");
  });
});
