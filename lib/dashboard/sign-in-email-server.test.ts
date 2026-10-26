import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { betterAuthUsers, teamJoins, users } from "@/db/schema";
import { addRows, databaseWrites, logRowsSinceSeed, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import type { DetailsTarget } from "./division-members";
import { membersModelOf } from "./members-view";
import { openDashboard } from "./open";
import { SIGN_IN_EMAIL_REFUSALS } from "./sign-in-email";

// Correcting a sign-in email in Edit details (issue #741), on the migrated
// in-memory Postgres the access matrix uses (./access-matrix/test-database.ts).
// Full access corrects the `public.users` email of a person no sign-in
// account holds yet; everyone else is refused, and no attempt ever changes
// the email a sign-in account holds in `better_auth."user"`.

const MA = IDS.division("MA");
const PERSON = { kind: "person", id: IDS.person("MA") } as const satisfies DetailsTarget;
const PERSON_USER = "person-ma";
const WAITING = { kind: "waiting", joinId: IDS.join("MA") } as const satisfies DetailsTarget;
const WAITING_USER = "joiner-ma";
const TARGETS: readonly DetailsTarget[] = [PERSON, WAITING];
/** Each target with the user row it names. */
const TARGET_USERS: readonly (readonly [DetailsTarget, string])[] = [
  [PERSON, PERSON_USER],
  [WAITING, WAITING_USER],
];
const CORRECTED = "corrected.person@example.com";
const DETAILS = { phone: "", politoId: "", programme: "", level: "", country: "", birthDate: "", linkedin: "", prtEmail: "", discord: "", gender: "" };

const FULL_ACCESS = ["operations lead", "team leader"];
// Each may edit the person's other details in Mission Analysis, never their sign-in email.
const MAY_EDIT_DETAILS_ONLY = ["division lead", "department head", "member with a members grant across the division"];

const emailOf = async (userId: string) => (await tableRows(users)).find((u) => u.id === userId)?.email;
const signInAccounts = () => tableRows(betterAuthUsers);

/** A save of Edit details as `viewer`, on the database as it stands; `signInEmail` left out sends no correction. */
async function save(viewer: string, target: DetailsTarget, signInEmail?: string) {
  signInAs(accountOf(viewer).userId);
  const answer = await teamActions.saveMemberDetails(target, MA, { title: "Member", details: DETAILS, ...(signInEmail === undefined ? {} : { signInEmail }) });
  return { answer, writes: await databaseWrites() };
}

/** A fresh database where `userId`'s user row is held by a sign-in account with the address it already has. */
async function seededSignedIn(userId: string): Promise<void> {
  await seedFixture();
  const email = await emailOf(userId);
  await addRows(betterAuthUsers, [{ id: userId, name: "Signed In", email, emailVerified: true }]);
}

describe("full access corrects the sign-in email of someone who has not signed in (issue #741)", () => {
  test("for a member and for someone waiting: the users row's email alone, logged under the acting account", async () => {
    for (const viewer of FULL_ACCESS) {
      for (const [target, userId] of TARGET_USERS) {
        await seedFixture();
        const accounts = await signInAccounts();
        const { answer } = await save(viewer, target, "  Corrected.Person@Example.com ");
        assert.deepEqual(answer, { ok: true }, `${viewer} on ${userId}`);
        assert.equal(await emailOf(userId), CORRECTED, "trimmed and lower case");
        assert.deepEqual(await signInAccounts(), accounts, "no sign-in account changed");
        const logged = (await logRowsSinceSeed()).filter((r) => r.tableName === "users" && r.recordId === userId);
        assert.ok(
          logged.some((r) => (r.newData as { email?: string } | null)?.email === CORRECTED && r.changedBy === accountOf(viewer).userId),
          `${viewer}: the change is in the activity log under their account`,
        );
      }
    }
  });

  test("a sign-in account created with the corrected address is linked to the person's row by the sync trigger", async () => {
    await seedFixture();
    assert.deepEqual((await save("operations lead", WAITING, CORRECTED)).answer, { ok: true });
    await addRows(betterAuthUsers, [{ id: "new-sign-in", name: "Joiner", email: CORRECTED, emailVerified: true }]);
    const rows = await tableRows(users);
    assert.equal(rows.find((u) => u.id === WAITING_USER), undefined, "the added row took the sign-in account's id");
    assert.equal(rows.find((u) => u.id === "new-sign-in")?.email, CORRECTED, "one row, linked");
    assert.equal(rows.filter((u) => u.email === CORRECTED).length, 1, "no second, unlinked row");
    assert.equal((await tableRows(teamJoins)).find((j) => j.id === WAITING.joinId)?.userId, "new-sign-in", "the wait follows the row");
  });
});

describe("every other viewer is refused a sign-in email correction, with nothing written (issue #741)", () => {
  test("a division lead, a head and a Members grant at Can edit save the other details, never the sign-in email", async () => {
    for (const viewer of MAY_EDIT_DETAILS_ONLY) {
      await seedFixture();
      assert.deepEqual((await save(viewer, PERSON)).answer, { ok: true }, `${viewer} edits the person's other details`);
      for (const target of TARGETS) {
        await seedFixture();
        const { answer, writes } = await save(viewer, target, CORRECTED);
        assert.deepEqual(answer, { ok: false, error: SIGN_IN_EMAIL_REFUSALS.notFullAccess }, `${viewer} on ${target.kind}`);
        assert.deepEqual(writes, [], `${viewer} on ${target.kind}: nothing written`);
      }
    }
  });

  test("a plain member is refused on someone else and on their own record", async () => {
    const own: DetailsTarget = { kind: "person", id: accountOf("member").memberId! };
    for (const target of [PERSON, own] satisfies DetailsTarget[]) {
      await seedFixture();
      const { answer, writes } = await save("member", target, CORRECTED);
      assert.equal((answer as { ok: boolean }).ok, false, target.kind);
      assert.deepEqual(writes, []);
    }
  });
});

describe("a correction never changes an existing sign-in account's verified email (issue #741)", () => {
  test("full access is refused on a person who already signs in, and both their rows read back unchanged", async () => {
    for (const [target, userId] of TARGET_USERS) {
      await seededSignedIn(userId);
      const before = { email: await emailOf(userId), accounts: await signInAccounts() };
      const { answer, writes } = await save("operations lead", target, CORRECTED);
      assert.deepEqual(answer, { ok: false, error: SIGN_IN_EMAIL_REFUSALS.signedIn }, userId);
      assert.deepEqual(writes, [], `${userId}: nothing written`);
      assert.equal(await emailOf(userId), before.email);
      assert.deepEqual(await signInAccounts(), before.accounts, "better_auth.user reads back unchanged");
    }
  });

  test("no viewer's attempt changes any better_auth.user row, whatever it aims at", async () => {
    for (const viewer of [...FULL_ACCESS, ...MAY_EDIT_DETAILS_ONLY, "member"]) {
      for (const target of TARGETS) {
        await seededSignedIn(PERSON_USER);
        const own = accountOf(viewer).userId;
        await addRows(betterAuthUsers, [{ id: own, name: "Viewer", email: await emailOf(own), emailVerified: true }]);
        const accounts = await signInAccounts();
        await save(viewer, target, CORRECTED);
        assert.deepEqual(await signInAccounts(), accounts, `${viewer} on ${target.kind}`);
      }
    }
  });
});

describe("a correction is checked before anything is written (issue #741)", () => {
  test("an address that is not an email is refused with the field's message", async () => {
    await seedFixture();
    const { answer, writes } = await save("operations lead", PERSON, "not-an-email");
    assert.deepEqual(answer, { ok: false, error: "Write an email address." });
    assert.deepEqual(writes, []);
  });

  test("an address another user row holds, in any case, is refused: a member, someone waiting, or an account", async () => {
    for (const taken of ["LEAD-MA@mail.test", "join-oa@mail.test", "appl-dm@mail.test"]) {
      await seedFixture();
      const { answer, writes } = await save("operations lead", PERSON, taken);
      assert.deepEqual(answer, { ok: false, error: SIGN_IN_EMAIL_REFUSALS.taken }, taken);
      assert.deepEqual(writes, [], `${taken}: nothing written`);
    }
  });
});

describe("Edit details offers the field from one flag the server sets (issue #741)", () => {
  /** The flag the viewer's Members page sets for the person and for the one waiting in Mission Analysis. */
  async function flagsOf(viewer: string) {
    signInAs(accountOf(viewer).userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    const page = membersModelOf(await (opening as { data: DashboardData }).data.members(null));
    assert.ok(page !== null);
    const person = page.everyone.find((p) => p.id === PERSON.id)?.actions?.correctsSignInEmail ?? false;
    const waiting = page.queues.flatMap((q) => q.waiting).find((w) => w.joinId === WAITING.joinId)?.correctsSignInEmail ?? false;
    return { person, waiting };
  }

  test("set for full access on people who have not signed in, and for nobody else", async () => {
    await seedFixture();
    assert.deepEqual(await flagsOf("operations lead"), { person: true, waiting: true });
    for (const viewer of ["division lead", "department head"]) assert.deepEqual(await flagsOf(viewer), { person: false, waiting: false }, viewer);
    await seededSignedIn(PERSON_USER);
    assert.equal((await flagsOf("operations lead")).person, false, "never once they sign in");
  });
});
