import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { applications, members, users } from "@/db/schema";
import { changeRows, databaseWrites, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { VIEWERS, type MatrixRow, type Unit } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";
import { membersModelOf, NO_MEMBERS_FILTER, shownMembers } from "./members-view";
import { openDashboard } from "./open";
import type { DashboardData } from "./data";

// Mark NDA received, then Confirm join, on the real database (issue #687):
// an accepted applicant whose signed NDA has not arrived cannot join, the
// `set-nda` move ticks it for a viewer who may change the application and
// for nobody else, and the join then goes through. It runs against the
// migrated in-memory Postgres the access matrix uses
// (./access-matrix/test-database.ts); the fixture's joining application has
// its NDA in, so each test takes it back out first.

const UNIT: Unit = "MA";
const JOINING = IDS.joining(UNIT);
const APPLICANT = "joining-ma";
const MAY = "division lead"; // leads Mission Analysis, so changes its Applications
const SET_NDA = { kind: "set-nda", arrived: true } as const;

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
    assert.deepEqual(await recruitmentActions.moveApplication(JOINING, SET_NDA), { ok: true, value: null });
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

  test("every viewer who may not change the application is refused the set-nda move, and nothing is written", async () => {
    const refusedViewers = (VIEWERS as readonly MatrixRow[]).filter((v) => !mayChange(v));
    assert.ok(refusedViewers.length > 0, "some viewer may not change the application, so the check below is not empty");
    for (const { name } of refusedViewers) {
      await seededWithoutNda();
      signInAs(accountOf(name).userId);
      const answer = await recruitmentActions.moveApplication(JOINING, SET_NDA);
      assert.equal(answer.ok, false, `${name}: refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(await databaseWrites(), [], `${name}: no database write`);
      assert.equal((await storedApplication()).ndaArrivedAt, null, `${name}: the NDA stays unmarked`);
    }
  });
});
