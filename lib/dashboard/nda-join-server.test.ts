import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { applications, members, roles, users } from "@/db/schema";
import { addRows, changeRows, databaseWrites, logRowsSinceSeed, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { VIEWERS, type MatrixRow, type Unit } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";
import { membersModelOf, NO_MEMBERS_FILTER, shownMembers } from "./members-view";
import { confirmJoin, type ReadStatus } from "./database-recruitment";
import { openDashboard } from "./open";
import type { DashboardData } from "./data";

// Mark NDA received, then Confirm join, on the real database (issues #687,
// #749 and #761): an accepted applicant whose signed NDA has not arrived cannot
// join, the `nda-received` move records it for a viewer who may change the
// application and for nobody else, the join then goes through, and a second
// join on the same read writes nothing. It runs against the
// migrated in-memory Postgres the access matrix uses
// (./access-matrix/test-database.ts); the fixture's joining application has
// its NDA in, so each test takes it back out first.

const UNIT: Unit = "MA";
const JOINING = IDS.joining(UNIT);
const APPLICANT = "joining-ma";
const MAY = "division lead"; // leads Mission Analysis, so changes its Applications
const NDA_RECEIVED = { kind: "nda-received" } as const;

const mayChange = (row: MatrixRow) => row.expect.changes.applications.includes(UNIT);

/** A freshly seeded database whose joining application in the unit is accepted and still waits for the NDA. */
async function seededWithoutNda(): Promise<void> {
  await seedFixture();
  await changeRows(applications, { id: JOINING }, { statusKey: "accepted_email_sent", ndaArrivedAt: null });
}

const storedApplication = async () => (await tableRows(applications)).find((a) => a.id === JOINING)!;
const applicant = async () => (await tableRows(users)).find((u) => u.id === APPLICANT)!;

/** The joining banner the viewer's Members page shows for the application. */
async function bannerOf(name: string) {
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  const page = membersModelOf(await (opening as { data: DashboardData }).data.members(null));
  assert.ok(page !== null, `${name}: the Members page opens`);
  return shownMembers(page, NO_MEMBERS_FILTER).joining.find((j) => j.joining.applicationId === JOINING)?.joining;
}

describe("Mark NDA received, then Confirm join, on the real database (issue #687)", () => {
  test("Confirm join is refused until the NDA is marked received, and then writes the join", async () => {
    assert.ok(mayChange(VIEWERS.find((v) => v.name === MAY) as MatrixRow), `${MAY} changes Applications in ${UNIT}`);
    await seededWithoutNda();
    const membersBefore = (await tableRows(members)).length;
    signInAs(accountOf(MAY).userId);

    // The banner's action answers one plain refusal; the same call goes through below once only the NDA changed.
    assert.deepEqual(await teamActions.confirmJoin(JOINING), { ok: false, error: "This change could not be saved." }, "refused before the NDA arrived");
    assert.equal((await tableRows(members)).length, membersBefore, "no members row added");
    assert.equal((await applicant()).member, null, "the applicant is linked to no member");
    assert.equal((await storedApplication()).status, "accepted");
    assert.equal((await bannerOf(MAY))?.ndaArrived, false, "the banner waits for the NDA");

    signInAs(accountOf(MAY).userId);
    assert.deepEqual(await recruitmentActions.moveApplication(JOINING, NDA_RECEIVED), { ok: true, value: null });
    assert.notEqual((await storedApplication()).ndaArrivedAt, null, "the stored application carries ndaArrivedAt");
    assert.equal((await storedApplication()).statusKey, "nda_received", "the application references NDA received");

    const banner = await bannerOf(MAY);
    assert.equal(banner?.ndaArrived, true, "the Members page's joining banner reports the NDA in");

    signInAs(accountOf(MAY).userId);
    assert.deepEqual(await teamActions.confirmJoin(JOINING), { ok: true });
    const joined = await storedApplication();
    assert.equal(joined.status, "joined");
    assert.equal(joined.statusKey, "joined");
    assert.equal((await tableRows(members)).length, membersBefore + 1, "one members row added");
    assert.notEqual((await applicant()).member, null, "the applicant is now a member");
  });

  test("every viewer who may not change the application is refused the NDA received move, and nothing is written", async () => {
    const refusedViewers = (VIEWERS as readonly MatrixRow[]).filter((v) => !mayChange(v));
    assert.ok(refusedViewers.length > 0, "some viewer may not change the application, so the check below is not empty");
    for (const { name } of refusedViewers) {
      await seededWithoutNda();
      signInAs(accountOf(name).userId);
      const answer = await recruitmentActions.moveApplication(JOINING, NDA_RECEIVED);
      assert.equal(answer.ok, false, `${name}: refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(await databaseWrites(), [], `${name}: no database write`);
      assert.equal((await storedApplication()).ndaArrivedAt, null, `${name}: the NDA stays unmarked`);
    }
  });

  test("Confirm join sets the person's other open applications to Accepted for another position, and leaves their decided and withdrawn ones (issue #749)", async () => {
    await seedFixture();
    const since = "2026-10-01 09:00:00+02";
    await addRows(applications, [
      // Open: at interview for OA.
      { id: 990, applyPositionId: IDS.position("OA"), userId: APPLICANT, appliedAt: since, status: "interview", statusKey: "interview", customAnswers: [] },
      // Decided: rejected for DM, the email sent.
      { id: 991, applyPositionId: IDS.position("DM"), userId: APPLICANT, appliedAt: since, status: "rejected", statusKey: "rejected_email_sent", rejectedAt: since, customAnswers: [] },
      // Withdrawn from OA earlier, while it was New.
      { id: 992, applyPositionId: IDS.position("OA"), userId: APPLICANT, appliedAt: since, status: "received", statusKey: "new", withdrawnAt: since, customAnswers: [] },
    ]);
    signInAs(accountOf(MAY).userId);
    assert.deepEqual(await teamActions.confirmJoin(JOINING), { ok: true });

    const rows = await tableRows(applications);
    const statusKeyOf = (id: number) => rows.find((a) => a.id === id)?.statusKey;
    assert.equal(statusKeyOf(JOINING), "joined");
    assert.equal(statusKeyOf(990), "accepted_for_another_position", "the open application");
    assert.equal(rows.find((a) => a.id === 990)?.status, "accepted_by_another_team", "the old column beside it");
    assert.equal(statusKeyOf(991), "rejected_email_sent", "the decided application keeps its status");
    assert.equal(statusKeyOf(992), "new", "the withdrawn application keeps its status");
  });

  test("a second Confirm join on the status the first one read writes nothing (issue #761)", async () => {
    await seedFixture();
    const since = "2026-10-01 09:00:00+02";
    // Open: at interview for OA, so the join sets it to Accepted for another position.
    await addRows(applications, [{ id: 990, applyPositionId: IDS.position("OA"), userId: APPLICANT, appliedAt: since, status: "interview", statusKey: "interview", customAnswers: [] }]);
    const membersBefore = (await tableRows(members)).length;
    assert.equal((await applicant()).member, null, "the applicant is not yet a member");

    // What two approvers acting at once both read: the application before either join landed.
    const stored = await storedApplication();
    const read: ReadStatus = { id: JOINING, status: stored.status as ReadStatus["status"], status_key: stored.statusKey as string | null };
    const approver = { memberId: accountOf(MAY).memberId, actingAccountId: null };

    assert.equal(await confirmJoin(approver, read, "2026-10-26T09:00:00Z", "new-member"), true, "the first join lands");
    const writesAfterFirst = (await databaseWrites()).length;
    assert.equal(await confirmJoin(approver, read, "2026-10-26T09:00:05Z", "new-member"), false, "the second finds no row in the status it read");
    assert.equal((await databaseWrites()).length, writesAfterFirst, "the second join writes nothing");

    const memberId = (await applicant()).member;
    assert.notEqual(memberId, null, "the applicant is now a member");
    assert.equal((await tableRows(members)).length, membersBefore + 1, "exactly one members row added");
    const activeRoles = (await tableRows(roles)).filter((r) => r.memberId === memberId && r.divisionId === IDS.division(UNIT) && r.leavedAt === null);
    assert.equal(activeRoles.length, 1, "exactly one active role in the division");
    const otherChanges = (await logRowsSinceSeed()).filter((l) => l.tableName === "applications" && l.recordId === "990");
    assert.equal(otherChanges.length, 1, "the other open application was changed once");
    assert.equal((await tableRows(applications)).find((a) => a.id === 990)?.statusKey, "accepted_for_another_position");
  });
});
