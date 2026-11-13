import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { betterAuthUsers, members, teamJoins, users } from "@/db/schema";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { addRows, tableRows } from "./access-matrix/test-database";

// Add member by email when several `users` rows share the email (issue #930),
// on the migrated database: the join goes to the open row, a row with a
// member first, then the row a login holds, and never to a closed row.

const EMAIL = "twin@mail.test";
const DIVISION = IDS.division("DM");
const SINCE = "2026-01-01 09:00:00+01";

/** A login on `email`, as Better Auth stores it at a first sign-in; the sign-in sync gives it its `users` row. */
async function addLogin(id: string, email: string): Promise<void> {
  await addRows(betterAuthUsers, [{ id, name: id, email, emailVerified: true }]);
}

/** Add member by email into DM, by the team leader. */
async function addByEmail() {
  signInAs(accountOf("team leader").userId);
  return teamActions.addMember({ kind: "email", divisionId: DIVISION, email: EMAIL, firstName: "Twin", lastName: "Person", title: "Member", details: null });
}

/** The ids of the `users` rows the joins waiting in DM name. */
async function joinedRows(): Promise<unknown[]> {
  return (await tableRows(teamJoins)).filter((j) => j.divisionId === DIVISION).map((j) => j.userId);
}

/** The rows the joins added since `before` name. */
async function joinsSince(before: unknown[]): Promise<unknown[]> {
  return (await joinedRows()).filter((id) => !before.includes(id));
}

const userRow = async (id: string) => (await tableRows(users)).find((u) => u.id === id);

describe("Add member by email with several rows on the email (issue #930)", () => {
  test("of two open rows with no member, the one a login holds gets the join", async () => {
    await seedFixture();
    await addLogin("new-login", EMAIL);
    assert.ok(await userRow("new-login"), "the sign-in sync gave the login its row");
    // A preserved record on the same email that no login holds; its id sorts first.
    await addRows(users, [{ id: "aaa-record", email: EMAIL, firstName: "Old", createdAt: SINCE }]);
    const before = await joinedRows();

    assert.deepEqual(await addByEmail(), { ok: true, value: "waiting" });
    assert.deepEqual(await joinsSince(before), ["new-login"], "the join names the login's row");
    assert.equal((await userRow("aaa-record"))?.lastName, null, "the preserved record is not filled in");
  });

  test("a row with a member is still preferred over the row a login holds", async () => {
    await seedFixture();
    await addLogin("aaa-login", EMAIL);
    // Someone with a member row and no active role: off the team, so they wait.
    await addRows(members, [{ memberId: 930, ndaSignedAt: SINCE }]);
    await addRows(users, [{ id: "zzz-member", email: EMAIL, member: 930, createdAt: SINCE }]);
    const before = await joinedRows();

    assert.deepEqual(await addByEmail(), { ok: true, value: "waiting" });
    assert.deepEqual(await joinsSince(before), ["zzz-member"]);
  });

  test("a closed row beside an open one is skipped, and the open row gets the join", async () => {
    await seedFixture();
    await addRows(users, [
      { id: "aaa-closed", email: EMAIL, createdAt: SINCE, deletedAt: SINCE },
      { id: "zzz-open", email: EMAIL, createdAt: SINCE },
    ]);
    const before = await joinedRows();

    assert.deepEqual(await addByEmail(), { ok: true, value: "waiting" });
    assert.deepEqual(await joinsSince(before), ["zzz-open"]);
    assert.equal((await userRow("aaa-closed"))?.firstName, null, "the closed row is not updated");
  });

  test("when only a closed row matches, it is left as it is and the join goes to a new row", async () => {
    await seedFixture();
    await addRows(users, [{ id: "aaa-closed", email: EMAIL, createdAt: SINCE, deletedAt: SINCE }]);
    const closedBefore = await userRow("aaa-closed");
    const before = await joinedRows();

    assert.deepEqual(await addByEmail(), { ok: true, value: "waiting" });
    const [joined] = await joinsSince(before);
    assert.notEqual(joined, "aaa-closed", "the join does not name the closed row");
    assert.deepEqual(await userRow("aaa-closed"), closedBefore, "the closed row is unchanged");
    const fresh = await userRow(String(joined));
    assert.deepEqual({ email: fresh?.email, firstName: fresh?.firstName, deletedAt: fresh?.deletedAt }, { email: EMAIL, firstName: "Twin", deletedAt: null });
  });
});
