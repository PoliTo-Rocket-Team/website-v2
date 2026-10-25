import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import { applications, applicationStatuses } from "@/db/schema";
import { TEAM_LEADER_ONLY_REFUSAL } from "./application-status";
import { addRows, changeRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";

// Only the team leader sets "Accepted · email sent", because the team leader
// sends the acceptance email with the NDA (owner decision on epic #588,
// 2026-10-25, issue #751). The server move refuses anyone else, by Mark email
// sent and by a saved hand pick alike, and writes nothing; "Rejected · email
// sent" stays open to anyone who may move the application. It runs against
// the migrated in-memory Postgres the access matrix uses.

const APPLICATION = IDS.application("MA");
const LEADER = "team leader";
const LEAD = "division lead"; // leads Mission Analysis, so changes its Applications

const stored = async (id: number) => (await tableRows(applications)).find((a) => a.id === id)!;
const REFUSED = { ok: false, error: TEAM_LEADER_ONLY_REFUSAL };

/** Lays the application over the seeded row as Accept left it: "Accepted · email to be sent". */
async function acceptedEmailToBeSent() {
  await changeRows(applications, { id: APPLICATION }, { status: "accepted", statusKey: "accepted_email_to_be_sent", acceptedAt: new Date(Date.now() - 86_400_000).toISOString() });
}

describe("Only the team leader sets Accepted · email sent (issue #751)", () => {
  test("Mark email sent on an acceptance is refused for a division lead and nothing is written; the team leader's lands", async () => {
    await seedFixture();
    await acceptedEmailToBeSent();
    const before = await stored(APPLICATION);

    signInAs(accountOf(LEAD).userId);
    assert.deepEqual(await recruitmentActions.moveApplication(APPLICATION, { kind: "mark-email-sent" }), REFUSED);
    assert.deepEqual(await stored(APPLICATION), before);

    signInAs(accountOf(LEADER).userId);
    assert.deepEqual(await recruitmentActions.moveApplication(APPLICATION, { kind: "mark-email-sent" }), { ok: true, value: null });
    assert.equal((await stored(APPLICATION)).statusKey, "accepted_email_sent");
  });

  test("a hand pick of Accepted · email sent, or of a status added under it, is refused for a division lead; the team leader's lands", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [{ key: "courier_sent", name: "Sent by courier", colour: "#4DA3FF", sortOrder: 1, parentKey: "accepted_email_sent" }]);
    const before = await stored(APPLICATION);

    signInAs(accountOf(LEAD).userId);
    assert.deepEqual(await recruitmentActions.moveApplication(APPLICATION, { kind: "pick", to: "accepted_email_sent" }), REFUSED);
    assert.deepEqual(await recruitmentActions.moveApplication(APPLICATION, { kind: "pick-added", key: "courier_sent" }), REFUSED);
    assert.deepEqual(await stored(APPLICATION), before);

    signInAs(accountOf(LEADER).userId);
    assert.deepEqual(await recruitmentActions.moveApplication(APPLICATION, { kind: "pick", to: "accepted_email_sent" }), { ok: true, value: null });
    const sent = await stored(APPLICATION);
    assert.equal(sent.statusKey, "accepted_email_sent");
    assert.notEqual(sent.acceptedAt, null, "the acceptance day Accept would have recorded");
  });

  test("a division lead sets Rejected · email sent, by Mark email sent and by a hand pick", async () => {
    await seedFixture();
    signInAs(accountOf(LEAD).userId);
    assert.deepEqual(await recruitmentActions.moveApplication(APPLICATION, { kind: "reject" }), { ok: true, value: null });
    assert.deepEqual(await recruitmentActions.moveApplication(APPLICATION, { kind: "mark-email-sent" }), { ok: true, value: null });
    assert.equal((await stored(APPLICATION)).statusKey, "rejected_email_sent");

    const interview = IDS.interview("MA");
    assert.deepEqual(await recruitmentActions.moveApplication(interview, { kind: "pick", to: "rejected_email_sent" }), { ok: true, value: null });
    assert.equal((await stored(interview)).statusKey, "rejected_email_sent");
  });
});
