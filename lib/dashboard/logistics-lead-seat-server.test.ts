import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { divisions, roles, scopes, users } from "@/db/schema";
import { DIVISION } from "@/db/seed/structure";
import { seatOf } from "@/lib/seeded-accounts";
import { inShow, NO_ACCESS_FILTER, shownAccess, accessModelOf, type AccessRow } from "./access-view";
import { addRows, changeRows, tableRows } from "./access-matrix/test-database";
import { signInAs } from "./access-matrix/session";
import { seeded } from "./access-matrix/whole-seed";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { standingOf, type ViewerStanding } from "./viewer";

// The Logistics lead seat on the real database (issue #885): every active
// lead of the open Logistics division holds full access by the role, with no
// scope row, and the team's Access page lists them as a full-access seat. The
// database is the migrated in-memory Postgres of
// ./access-matrix/test-database.ts with the whole seed loaded, where the
// Logistics lead is member 23 and the lead of another division is the
// `division-lead` seat, who leads Test Bench.

const LOGISTICS_LEAD_MEMBER = 23;
const TEST_BENCH_LEAD = seatOf("division-lead");
const TEAM_LEADER = seatOf("team-leader");

async function userOfMember(memberId: number): Promise<string> {
  const user = (await tableRows(users)).find((u) => u.member === memberId);
  assert.ok(user, `member ${memberId} has a seeded sign-in`);
  return user.id as string;
}

/** The dashboard of whoever is signed in. */
async function dashboard(): Promise<DashboardData> {
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data;
}

/** The standing the account's dashboard opens with. */
async function standingAs(userId: string): Promise<ViewerStanding> {
  signInAs(userId);
  return standingOf((await dashboard()).viewer);
}

const seatIn = (standing: ViewerStanding) => (standing.kind === "operations-lead" ? standing.seat : null);

/** Every scope row, to show the seat writes and removes none. */
const scopeRows = async () => (await tableRows(scopes)).map((r) => r.id).sort();

describe("the Logistics lead seat, on the whole seed (issue #885)", () => {
  test("the Logistics lead opens the dashboard with full access in the Logistics lead seat, with no admin or org scope row", async () => {
    await seeded();
    const own = (await tableRows(scopes)).filter((s) => s.memberId === LOGISTICS_LEAD_MEMBER && (s.scope === "admin" || s.scope === "org"));
    assert.deepEqual(own, [], "member 23 holds no admin or org row");
    const standing = await standingAs(await userOfMember(LOGISTICS_LEAD_MEMBER));
    assert.equal(standing.kind, "operations-lead");
    assert.equal(seatIn(standing), "logistics-lead");
  });

  test("the team's Access page lists the Logistics lead as a full-access seat, under Logistics Lead, and the Full access switch counts them", async () => {
    await seeded();
    signInAs(TEAM_LEADER.id);
    const page = await (await dashboard()).divisionAccess();
    assert.ok(page !== null && page.unit.kind === "team", "the team leader's page covers the whole team");
    const role = page.roleAccess.find((r) => r.person.id === LOGISTICS_LEAD_MEMBER);
    assert.ok(role !== undefined && role.place.kind === "team" && "seat" in role, JSON.stringify(role));
    assert.deepEqual([role.seat, role.title], ["logistics-lead", "Logistics Lead"]);

    const rows: AccessRow[] = page.roleAccess.map((r) => ({ kind: "role", role: r }));
    assert.equal(inShow({ kind: "role", role }, "full-access"), true);
    const shown = shownAccess(accessModelOf(page.unit), page.unit, rows, { ...NO_ACCESS_FILTER, show: "full-access" });
    assert.ok(shown.rows.some((r) => r.kind === "role" && r.role.person.id === LOGISTICS_LEAD_MEMBER), "listed under Full access");
    assert.equal(shown.counts["full-access"], shown.rows.length);
  });

  test("a second lead of Logistics, a co-holder, gets full access too; before it they were only another division's lead", async () => {
    await seeded();
    const coHolder = TEST_BENCH_LEAD.memberId!;
    const before = await standingAs(TEST_BENCH_LEAD.id);
    assert.equal(before.kind, "division-lead", "the Test Bench lead has no full access");
    const scopesBefore = await scopeRows();

    await addRows(roles, [{ id: 9001, memberId: coHolder, title: "Logistics Lead", startedAt: "2026-10-01", type: "lead", divisionId: DIVISION.logistics }]);
    const after = await standingAs(TEST_BENCH_LEAD.id);
    assert.equal(after.kind, "operations-lead");
    assert.equal(seatIn(after), "logistics-lead");
    assert.equal(seatIn(await standingAs(await userOfMember(LOGISTICS_LEAD_MEMBER))), "logistics-lead", "the first holder keeps it");
    assert.deepEqual(await scopeRows(), scopesBefore, "no scope row written");
  });

  test("a holder whose lead role ends loses full access with it, and nobody holds it while Logistics is closed", async () => {
    await seeded();
    const lead = await userOfMember(LOGISTICS_LEAD_MEMBER);
    const scopesBefore = await scopeRows();
    const leadRow = (await tableRows(roles)).find(
      (r) => r.memberId === LOGISTICS_LEAD_MEMBER && r.leavedAt === null && r.type === "lead" && r.divisionId === DIVISION.logistics,
    );
    assert.ok(leadRow, "member 23's Logistics lead role");

    // A hand-over, a leaving or a removal ends the role row: the seat goes with it.
    await changeRows(roles, { id: leadRow.id }, { leavedAt: "2026-10-30" });
    assert.notEqual((await standingAs(lead)).kind, "operations-lead");
    assert.deepEqual(await scopeRows(), scopesBefore, "no scope row removed");

    // With the role back but Logistics closed, the lead role finds no seat.
    await changeRows(roles, { id: leadRow.id }, { leavedAt: null });
    await changeRows(divisions, { id: DIVISION.logistics }, { closedAt: "2026-10-30" });
    const closed = await standingAs(lead);
    assert.equal(closed.kind, "division-lead");
    assert.equal(seatIn(closed), null);
  });
});
