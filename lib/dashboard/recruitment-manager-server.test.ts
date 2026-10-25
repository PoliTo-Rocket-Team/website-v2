import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { applications, divisions, roles, users } from "@/db/schema";
import { APPLICATION, POSITION_ROWS } from "@/db/seed/recruitment";
import { DIVISION } from "@/db/seed/structure";
import { seatOf } from "@/lib/seeded-accounts";
import { changeRows, databaseWrites, tableRows } from "./access-matrix/test-database";
import { signInAs } from "./access-matrix/session";
import { seeded } from "./access-matrix/whole-seed";
import { DashboardRefused, type DashboardData } from "./data";
import { openDashboard } from "./open";

// The recruitment manager on the real database (issue #194, Owner decisions
// on the issue, 2026-10-22 and 2026-10-25): the lead of the open Logistics
// division reads every division's applications and makes every move a lead
// may make on them, team-wide. The database is the migrated in-memory
// Postgres of ./access-matrix/test-database.ts with the whole seed loaded
// (./access-matrix/whole-seed.ts), so the Logistics lead is the seeded
// person who holds that role, Ettore De Bartolo (member 23), and the lead of
// another division is the `division-lead` seat, Stefano Motta, who leads Test
// Bench.

const LOGISTICS_LEAD_MEMBER = 23;
const TEST_BENCH_LEAD = seatOf("division-lead");

/** Communications applications: one in review, and one accepted that waits for the signed NDA. */
const IN_REVIEW = APPLICATION.inReview;
const WAITING_FOR_NDA = APPLICATION.waitingForNda;
/** A Logistics application (position 7), still pending in the seed. */
const LOGISTICS_APPLICATION = 8;

const positionDivision = (positionId: number) => POSITION_ROWS.rows.find((p) => p.id === positionId)?.divisionId;
const stored = async (id: number) => (await tableRows(applications)).find((a) => a.id === id)!;

/** The seeded sign-in of the Logistics lead. */
async function logisticsLead(): Promise<string> {
  const user = (await tableRows(users)).find((u) => u.member === LOGISTICS_LEAD_MEMBER);
  assert.ok(user, "member 23 has a seeded sign-in");
  return user.id as string;
}

/** The dashboard data of whoever is signed in. */
async function dashboard(): Promise<DashboardData> {
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data;
}

describe("the recruitment manager, the Logistics lead, on the whole seed (issue #194)", () => {
  test("the seed's member 23 is an active lead of the open Logistics division", async () => {
    await seeded();
    const logistics = (await tableRows(divisions)).find((d) => d.id === DIVISION.logistics)!;
    assert.equal(logistics.code, "LGS");
    assert.equal(logistics.closedAt, null);
    const held = (await tableRows(roles)).filter((r) => r.memberId === LOGISTICS_LEAD_MEMBER && r.leavedAt === null);
    assert.ok(held.some((r) => r.type === "lead" && r.divisionId === DIVISION.logistics), JSON.stringify(held));
  });

  test("the Applications page lists other divisions' applications, and they and their documents open", async () => {
    await seeded();
    signInAs(await logisticsLead());
    const data = await dashboard();
    const page = await data.applications();
    assert.deepEqual(page.scope, { kind: "team" });
    const elsewhere = page.applications.filter((a) => a.position.division !== "Logistics");
    assert.ok(elsewhere.length > 0, "applications of a division other than Logistics are listed");
    assert.ok(elsewhere.every((a) => a.canChange), "and each offers its moves");
    const inReview = page.applications.find((a) => a.id === IN_REVIEW);
    assert.equal(inReview?.position.division, "Communications");

    for (const kind of ["cv", "motivation-letter"] as const) {
      const document = await data.applicationDocument(IN_REVIEW, kind);
      assert.notEqual(document, null, `the ${kind} opens`);
    }
    signInAs(await logisticsLead());
    assert.deepEqual(await recruitmentActions.moveApplication(IN_REVIEW, { kind: "open" }), { ok: true, value: null }, "opening it in the panel");
  });

  test("a move, the NDA tick and Confirm join on another division's application are accepted by the server", async () => {
    await seeded();
    assert.notEqual(positionDivision((await stored(IN_REVIEW)).applyPositionId as number), DIVISION.logistics);
    assert.notEqual(positionDivision((await stored(WAITING_FOR_NDA)).applyPositionId as number), DIVISION.logistics);
    const lead = await logisticsLead();

    signInAs(lead);
    assert.deepEqual(await recruitmentActions.moveApplication(IN_REVIEW, { kind: "reject" }), { ok: true, value: null });
    assert.equal((await stored(IN_REVIEW)).status, "rejected");

    signInAs(lead);
    assert.deepEqual(await recruitmentActions.moveApplication(WAITING_FOR_NDA, { kind: "set-nda", arrived: true }), { ok: true, value: null });
    assert.notEqual((await stored(WAITING_FOR_NDA)).ndaArrivedAt, null);

    signInAs(lead);
    assert.deepEqual(await teamActions.confirmJoin(WAITING_FOR_NDA), { ok: true });
    assert.equal((await stored(WAITING_FOR_NDA)).status, "joined");
  });

  test("the Test Bench lead is refused a move, the NDA tick and Confirm join on a Logistics application", async () => {
    await seeded();
    assert.equal(positionDivision((await stored(LOGISTICS_APPLICATION)).applyPositionId as number), DIVISION.logistics);
    await changeRows(applications, { id: LOGISTICS_APPLICATION }, { status: "accepted", statusKey: "accepted_email_sent", acceptedAt: "2026-10-06 17:00:00+02", ndaArrivedAt: null });

    signInAs(TEST_BENCH_LEAD.id);
    const reject = await recruitmentActions.moveApplication(LOGISTICS_APPLICATION, { kind: "reject" });
    assert.equal(reject.ok, false, `the move: ${JSON.stringify(reject)}`);
    signInAs(TEST_BENCH_LEAD.id);
    const nda = await recruitmentActions.moveApplication(LOGISTICS_APPLICATION, { kind: "set-nda", arrived: true });
    assert.equal(nda.ok, false, `the NDA tick: ${JSON.stringify(nda)}`);
    assert.deepEqual(await databaseWrites(), [], "no write");

    // With the NDA in, only the access check is left to refuse Confirm join.
    await changeRows(applications, { id: LOGISTICS_APPLICATION }, { statusKey: "nda_received", ndaArrivedAt: "2026-10-08 09:30:00+02" });
    signInAs(TEST_BENCH_LEAD.id);
    assert.deepEqual(await teamActions.confirmJoin(LOGISTICS_APPLICATION), { ok: false, error: "This change could not be saved." });
    assert.deepEqual(await databaseWrites(), [], "no write");
    assert.equal((await stored(LOGISTICS_APPLICATION)).status, "accepted");

    signInAs(TEST_BENCH_LEAD.id);
    const data = await dashboard();
    await assert.rejects(() => data.applicationDocument(LOGISTICS_APPLICATION, "cv"), DashboardRefused, "its documents stay closed to them");

    // The same Confirm join goes through for the Logistics lead, so the refusal above is the access rule's.
    signInAs(await logisticsLead());
    assert.deepEqual(await teamActions.confirmJoin(LOGISTICS_APPLICATION), { ok: true });
  });
});
