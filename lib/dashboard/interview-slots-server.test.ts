import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import { interviewSlots, users } from "@/db/schema";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import type { UpcomingInterview } from "./overview";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { addRows, changeRows, removeRows, tableRows } from "./access-matrix/test-database";
import { signInAs } from "./access-matrix/session";

// Who set an interview's times (issue #652, drizzle/0064), on the real
// database (issue #760): Change times records the signed-in account in
// `interview_slots.offered_by`, and the upcoming interviews read it back as a
// name. It runs on the access matrix's migrated in-memory Postgres
// (./access-matrix/test-database.ts). The department head reads the
// interviews, since their Overview lists the Mission Analysis ones.

const INTERVIEW = IDS.interview("MA");
const HOUR = 3_600_000;

/** The Mission Analysis interview on the Overview of `name`. */
async function interviewOn(name: string): Promise<UpcomingInterview | undefined> {
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  const overview = await (opening as { data: DashboardData }).data.overview();
  assert.ok(overview.shape === "department", overview.shape);
  return overview.interviews.find((i) => i.applicant === "Interviewee appl-ma");
}

/** Change times on the interview, as the division lead. */
async function changeTimesAsLead(): Promise<string> {
  const { userId } = accountOf("division lead");
  signInAs(userId);
  const start = Date.now() + 3 * 24 * HOUR;
  const slots = [{ start: new Date(start).toISOString(), end: new Date(start + HOUR).toISOString() }];
  assert.deepEqual(await recruitmentActions.moveApplication(INTERVIEW, { kind: "offer-interview", slots }), { ok: true, value: null });
  return userId;
}

/** `offered_by` of each stored time of the interview. */
async function settersStored(): Promise<unknown[]> {
  return (await tableRows(interviewSlots)).filter((s) => s.applicationId === INTERVIEW).map((s) => s.offeredBy);
}

test("a time stored with no setter reads no setter", async () => {
  await seedFixture();
  assert.deepEqual(await settersStored(), [null], "the fixture's time has no setter");
  assert.equal((await interviewOn("department head"))?.setBy, null);
});

test("Change times records the account that set them, and the Overview names it", async () => {
  await seedFixture();
  const setter = await changeTimesAsLead();
  assert.deepEqual(await settersStored(), [setter], "the new time keeps the lead's users.id");
  assert.equal((await interviewOn("department head"))?.setBy, `Viewer ${setter}`);
});

// The write's own audit log row keeps the lead's account, so the setter here
// is an account that wrote nothing else: the foreign key alone is under test.
test("deleting the setter's account keeps the time and reads no setter", async () => {
  await seedFixture();
  await addRows(users, [{ id: "setter", email: "setter@team.test", firstName: "Gone", lastName: "Setter", createdAt: "2026-01-01" }]);
  await changeRows(interviewSlots, { applicationId: INTERVIEW }, { offeredBy: "setter" });
  assert.equal((await interviewOn("department head"))?.setBy, "Gone Setter");
  await removeRows(users, { id: "setter" });
  assert.deepEqual(await settersStored(), [null], "the time stays, with no setter");
  assert.equal((await interviewOn("department head"))?.setBy, null);
});
