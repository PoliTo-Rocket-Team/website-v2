import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import { applications, applicationStatuses, members } from "@/db/schema";
import { addRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";

// A saved hand pick in the drawer's Status picker, on the real database
// (issue #750, ruling R1.1 on #745): it goes through the one server move the
// action buttons use. A built-in status is written with the effects of the
// step that sets it; an added status changes the status reference and nothing
// else. It runs against the migrated in-memory Postgres the access matrix
// uses (./access-matrix/test-database.ts).

const NEW_APPLICATION = IDS.application("MA");
const MAY = "division lead"; // leads Mission Analysis, so changes its Applications

const stored = async (id: number) => (await tableRows(applications)).find((a) => a.id === id)!;

describe("A saved hand pick in the Status picker, on the real database (issue #750)", () => {
  test("an added status changes only the application's status reference", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [{ key: "second_interview", name: "Second interview", colour: "#FF5E00", sortOrder: 1, parentKey: "interview" }]);
    const before = await stored(NEW_APPLICATION);
    signInAs(accountOf(MAY).userId);

    assert.deepEqual(await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "pick-added", key: "second_interview" }), { ok: true, value: null });
    assert.deepEqual(await stored(NEW_APPLICATION), { ...before, statusKey: "second_interview" });

    const unknown = await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "pick-added", key: "no_such_status" });
    assert.equal(unknown.ok, false, "a key the list does not hold is refused");
    assert.equal((await stored(NEW_APPLICATION)).statusKey, "second_interview");
  });

  test("a built-in status no button of the current status sets is written with the effects of the step that sets it", async () => {
    await seedFixture();
    signInAs(accountOf(MAY).userId);

    // New to NDA received: what Accept and NDA received record, the acceptance day and the NDA's.
    assert.deepEqual(await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "pick", to: "nda_received" }), { ok: true, value: null });
    const received = await stored(NEW_APPLICATION);
    assert.equal(received.statusKey, "nda_received");
    assert.equal(received.status, "accepted");
    assert.notEqual(received.acceptedAt, null);
    assert.notEqual(received.ndaArrivedAt, null);

    // Then Joined runs Confirm join: the person becomes a member.
    const membersBefore = (await tableRows(members)).length;
    assert.deepEqual(await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "pick", to: "joined" }), { ok: true, value: null });
    assert.equal((await stored(NEW_APPLICATION)).statusKey, "joined");
    assert.equal((await tableRows(members)).length, membersBefore + 1, "one members row added");
  });

  test("Accepted for another position and Withdrawn write what Confirm join elsewhere and the applicant's Withdraw write", async () => {
    await seedFixture();
    signInAs(accountOf(MAY).userId);
    assert.deepEqual(await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "pick", to: "accepted_for_another_position" }), { ok: true, value: null });
    const taken = await stored(NEW_APPLICATION);
    assert.equal(taken.statusKey, "accepted_for_another_position");
    assert.equal(taken.status, "accepted_by_another_team");
    assert.notEqual(taken.rejectedAt, null, "the decision day");

    const interview = IDS.interview("MA");
    assert.deepEqual(await recruitmentActions.moveApplication(interview, { kind: "pick", to: "withdrawn" }), { ok: true, value: null });
    const withdrawn = await stored(interview);
    assert.equal(withdrawn.statusKey, "withdrawn");
    assert.notEqual(withdrawn.withdrawnAt, null, "it leaves the lead's list");
  });

  test("Rejected · email sent from a status never rejected records the decision day, as Reject then Mark email sent would", async () => {
    await seedFixture();
    signInAs(accountOf(MAY).userId);
    assert.equal((await stored(NEW_APPLICATION)).rejectedAt, null);
    assert.deepEqual(await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "pick", to: "rejected_email_sent" }), { ok: true, value: null });
    const rejected = await stored(NEW_APPLICATION);
    assert.equal(rejected.statusKey, "rejected_email_sent");
    assert.notEqual(rejected.rejectedAt, null, "the applicant's pages count one month from this day");
  });

  test("a built-in status picked from an added status under it sets the built-in status, where its button keeps the added one", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [{ key: "second_interview", name: "Second interview", colour: "#FF5E00", sortOrder: 1, parentKey: "interview" }]);
    signInAs(accountOf(MAY).userId);
    const interview = IDS.interview("MA");
    const start = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const times = (at: number) => [{ start: new Date(at).toISOString(), end: new Date(at + 30 * 60 * 1000).toISOString() }];
    assert.deepEqual(await recruitmentActions.moveApplication(interview, { kind: "pick-added", key: "second_interview" }), { ok: true, value: null });

    // Change times keeps Second interview.
    assert.deepEqual(await recruitmentActions.moveApplication(interview, { kind: "offer-interview", slots: times(start) }), { ok: true, value: null });
    assert.equal((await stored(interview)).statusKey, "second_interview");

    // A saved pick of Interview, with the same times, sets Interview.
    assert.deepEqual(await recruitmentActions.moveApplication(interview, { kind: "pick", to: "interview", slots: times(start) }), { ok: true, value: null });
    assert.equal((await stored(interview)).statusKey, "interview");
  });

  test("Joined by hand is refused until the signed NDA is in, and nothing is written", async () => {
    await seedFixture();
    signInAs(accountOf(MAY).userId);
    const before = await stored(NEW_APPLICATION);
    const answer = await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "pick", to: "joined" });
    assert.equal(answer.ok, false);
    assert.deepEqual(await stored(NEW_APPLICATION), before);
  });
});
