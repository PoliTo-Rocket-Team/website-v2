import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { members, users } from "@/db/schema";
import { changeRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { NO_MEMBER_DETAILS } from "./details";
import type { DetailsTarget } from "./division-members";

// Issue #887: phones imported from the old roster often have no country code.
// A save that sends the stored phone back unchanged keeps it; a changed phone
// is checked as before. The server reads the stored phone itself, so a form
// cannot make a bad phone pass by claiming it opened with it. On the migrated
// in-memory Postgres the access matrix uses (./access-matrix/test-database.ts).

const MA = IDS.division("MA");
const PERSON = { kind: "person", id: IDS.person("MA") } as const satisfies DetailsTarget;
const WAITING = { kind: "waiting", joinId: IDS.join("MA") } as const satisfies DetailsTarget;
const IMPORTED = "3890247022";
const REFUSED = { ok: false, error: "Start with + and the country code." };

const phoneOf = async (userId: string) => (await tableRows(users)).find((u) => u.id === userId)?.phone;

describe("Edit details keeps an unchanged phone whatever its format (issue #887)", () => {
  /** Saves Edit details as the operations lead, with `phone` in the form. */
  const save = (target: DetailsTarget, phone: string) => {
    signInAs(accountOf("operations lead").userId);
    return teamActions.saveMemberDetails(target, MA, { title: "Member", details: { ...NO_MEMBER_DETAILS, phone } });
  };

  test("a member whose stored phone has no country code saves with it unchanged, from users.phone or the members row", async () => {
    await seedFixture();
    await changeRows(users, { id: "person-ma" }, { phone: IMPORTED });
    assert.deepEqual(await save(PERSON, IMPORTED), { ok: true });
    assert.equal(await phoneOf("person-ma"), IMPORTED);

    await seedFixture();
    await changeRows(users, { id: "person-ma" }, { phone: null });
    await changeRows(members, { memberId: PERSON.id }, { mobileNumber: IMPORTED });
    assert.deepEqual(await save(PERSON, IMPORTED), { ok: true });
  });

  test("someone waiting saves with their stored phone unchanged", async () => {
    await seedFixture();
    await changeRows(users, { id: "joiner-ma" }, { phone: IMPORTED });
    assert.deepEqual(await save(WAITING, IMPORTED), { ok: true });
    assert.equal(await phoneOf("joiner-ma"), IMPORTED);
  });

  test("a changed phone without the country code is refused, and one the record does not hold counts as changed", async () => {
    for (const [target, userId] of [
      [PERSON, "person-ma"],
      [WAITING, "joiner-ma"],
    ] as const) {
      await seedFixture();
      await changeRows(users, { id: userId }, { phone: IMPORTED });
      assert.deepEqual(await save(target, "3890247023"), REFUSED, target.kind);

      await changeRows(users, { id: userId }, { phone: "+39 333 111 1111" });
      assert.deepEqual(await save(target, IMPORTED), REFUSED, `${target.kind}: the form's phone is not the stored one`);
      assert.equal(await phoneOf(userId), "+39 333 111 1111");
    }
  });
});

describe("Your details keeps an unchanged phone whatever its format (issue #887)", () => {
  const DETAILS = { firstName: "A", lastName: "B", phone: "", politoId: "", programme: "", level: "", country: "", birthDate: "", linkedin: "" };

  for (const viewer of ["member", "non-member"]) {
    test(`${viewer}: the stored phone saves unchanged, a changed bad one is refused`, async () => {
      await seedFixture();
      const { userId } = accountOf(viewer);
      await changeRows(users, { id: userId }, { phone: IMPORTED });
      signInAs(userId);
      const kept = await actions.saveDetails({ ...DETAILS, phone: IMPORTED });
      assert.equal(kept.ok, true, JSON.stringify(kept));
      assert.equal(await phoneOf(userId), IMPORTED);

      assert.deepEqual(await actions.saveDetails({ ...DETAILS, phone: "3890247023" }), REFUSED);

      await changeRows(users, { id: userId }, { phone: "+39 333 111 1111" });
      assert.deepEqual(await actions.saveDetails({ ...DETAILS, phone: IMPORTED }), REFUSED, "the form's phone is not the stored one");
      assert.equal(await phoneOf(userId), "+39 333 111 1111");
    });
  }
});
