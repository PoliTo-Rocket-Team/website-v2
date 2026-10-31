import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { betterAuthUsers, teamJoins, users } from "@/db/schema";
import { addRows, changeRows, databaseWrites, logRowsSinceSeed, tableRows, testDb, writesByTransaction } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { linkedLogin, saveInputOn, savedOn, type DetailsTarget, type OpenedSent, type SaveBasis } from "./division-members";
import { membersModelOf } from "./members-view";
import { openDashboard } from "./open";
import { LOGIN_LINK_REFUSALS, loginLinkQuestion, SIGN_IN_EMAIL_REFUSALS, takenBy, type LoginLinkOffer } from "./sign-in-email";

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

  test("an address another user row holds, in any case, is refused naming who: a member, someone waiting, or an account", async () => {
    for (const [taken, holder] of [
      ["LEAD-MA@mail.test", "Lead MA"],
      ["join-oa@mail.test", "Joiner OA"],
      ["appl-dm@mail.test", "Applicant appl-dm"],
    ]) {
      await seedFixture();
      const { answer, writes } = await save("operations lead", PERSON, taken);
      assert.deepEqual(answer, { ok: false, error: takenBy(holder) }, taken);
      assert.deepEqual(writes, [], `${taken}: nothing written`);
    }
  });
});

describe("Edit details links an empty login to the member it belongs to (issue #860)", () => {
  const LOGIN_USER = "login-ma";
  const REAL = "real.person@example.com";
  const MEMBER = PERSON.id;

  /**
   * A fresh database where the person's real address signed in on its own:
   * the sync trigger made a second user row with no member record. Their
   * imported row carries an access grant the login lacks; the login already
   * has a phone of its own.
   */
  async function seededEmptyLogin(): Promise<void> {
    await seedFixture();
    await changeRows(users, { id: PERSON_USER }, { phone: "+39 333 111 1111", country: "Italy", access: ["members"] });
    await addRows(betterAuthUsers, [{ id: LOGIN_USER, name: "Person MA", email: REAL, emailVerified: true, createdAt: new Date("2026-10-20T09:00:00Z") }]);
    await changeRows(users, { id: LOGIN_USER }, { phone: "+39 333 222 2222" });
  }

  const userRow = async (userId: string) => (await tableRows(users)).find((u) => u.id === userId);

  /** Save as full access with the real address: the offer Link login confirms. */
  async function offer(): Promise<LoginLinkOffer> {
    const { answer, writes } = await save("operations lead", PERSON, REAL);
    assert.deepEqual(writes, [], "Save wrote nothing");
    assert.equal(answer.ok, false);
    assert.ok("offer" in answer, "Save answers the offer instead of the taken refusal");
    return answer.offer;
  }

  async function link(viewer: string, sent: LoginLinkOffer) {
    signInAs(accountOf(viewer).userId);
    const answer = await teamActions.linkLogin({ memberId: sent.memberId, fromUserId: sent.fromUserId, loginUserId: sent.loginUserId, email: sent.email });
    return { answer, writes: await databaseWrites() };
  }

  /** What Edit details opens with for the person, as full access's Members page hands it: their details and name. */
  async function opened(): Promise<OpenedSent> {
    signInAs(accountOf("operations lead").userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    const page = membersModelOf(await (opening as { data: DashboardData }).data.members(null));
    const actions = page?.everyone.find((p) => p.id === PERSON.id)?.actions;
    assert.ok(actions);
    return { details: actions.person.details, ...actions.position.name };
  }

  /** A Save after Link login, as Edit details sends it on `basis`: the form as it opened with `changed` typed over it. */
  async function followUpSave(basis: SaveBasis, form: OpenedSent, changed: Partial<OpenedSent["details"]>) {
    signInAs(accountOf("operations lead").userId);
    const { details, ...name } = form;
    return teamActions.saveMemberDetails(PERSON, MA, saveInputOn(basis, { title: "Member", details: { ...details, ...changed }, ...name, signInEmail: REAL }));
  }

  /** What a Save sends: the form as it opened with `changed` typed over it. */
  const typedOver = (form: OpenedSent, changed: Partial<OpenedSent["details"]>): OpenedSent => ({ ...form, details: { ...form.details, ...changed } });

  test("Save offers the login, with the day it first signed in, and the confirmation asks to link it to the member", async () => {
    await seededEmptyLogin();
    const sent = await offer();
    assert.deepEqual(sent, { memberId: MEMBER, fromUserId: PERSON_USER, loginUserId: LOGIN_USER, email: REAL, firstSignIn: "2026-10-20" });
    assert.deepEqual(loginLinkQuestion(sent, "Person MA", 2026), {
      title: "Link that login to Person MA?",
      description: `${REAL} already signed in on 20 Oct with no team record.`,
    });
  });

  test("Link login moves the record onto the login in one audited batch, fills its empty fields, and closes the old row", async () => {
    await seededEmptyLogin();
    const sent = await offer();
    const { answer } = await link("operations lead", sent);
    assert.deepEqual(answer, { ok: true });
    const login = await userRow(LOGIN_USER);
    assert.equal(login?.member, MEMBER, "the login holds the member record");
    assert.equal(login?.firstName, "Person", "an empty field takes the record row's value");
    assert.equal(login?.lastName, "MA");
    assert.equal(login?.country, "Italy");
    assert.equal(login?.phone, "+39 333 222 2222", "a field the login already has stays its own");
    assert.deepEqual(login?.access, ["members"], "the grant the login lacked comes with the record");
    const old = await userRow(PERSON_USER);
    assert.ok(old !== undefined, "the old row is not deleted");
    assert.equal(old.member, null, "the old row no longer holds the record");
    assert.notEqual(old.deletedAt, null, "the old row is closed");
    assert.equal((await writesByTransaction()).length, 1, "one batch");
    const logged = (await logRowsSinceSeed()).filter((r) => r.tableName === "users");
    assert.deepEqual(new Set(logged.map((r) => r.recordId)), new Set([LOGIN_USER, PERSON_USER]));
    assert.ok(logged.every((r) => r.changedBy === accountOf("operations lead").userId), "in the activity log under the viewer");
  });

  test("the Save after Link login writes only what the viewer changed: a field the login already held survives the whole flow", async () => {
    await seededEmptyLogin();
    const form = await opened();
    assert.equal(form.details.phone, "+39 333 111 1111", "the form opens with the record row's phone");
    const sent = await offer();
    assert.deepEqual((await link("operations lead", sent)).answer, { ok: true });
    // The viewer typed a new country and left the phone as the form showed it.
    assert.deepEqual(await followUpSave(linkedLogin(form), form, { country: "France" }), { ok: true });
    const login = await userRow(LOGIN_USER);
    assert.equal(login?.member, MEMBER);
    assert.equal(login?.email, REAL, "the address is now the record row's own");
    assert.equal(login?.phone, "+39 333 222 2222", "the login's own phone is neither overwritten nor cleared");
    assert.equal(login?.country, "France", "a field the viewer changed is written");
    assert.equal(login?.firstName, "Person", "the name the viewer left stays");
  });

  test("every Save after Link login keeps the login's own fields: the retry after a failed follow-up writes only what the viewer changed", async () => {
    await seededEmptyLogin();
    const form = await opened();
    const sent = await offer();
    assert.deepEqual((await link("operations lead", sent)).answer, { ok: true });
    // The follow-up Save, then the retries once a step after it failed and left the form open; each Save moves the basis as the form does.
    let basis = linkedLogin(form);
    for (const [round, changed] of [
      ["the follow-up Save", { country: "France" }],
      ["a retry of the same Save", { country: "France" }],
      ["a retry with one more change", { country: "France", gender: "Female" }],
    ] as const) {
      assert.deepEqual(await followUpSave(basis, form, changed), { ok: true }, round);
      basis = savedOn(basis, typedOver(form, changed));
      const login = await userRow(LOGIN_USER);
      assert.equal(login?.phone, "+39 333 222 2222", `${round}: the login's own phone is neither overwritten nor cleared`);
      assert.equal(login?.country, "France", `${round}: a field the viewer changed is written`);
    }
    assert.equal((await userRow(LOGIN_USER))?.gender, "Female", "the retry's own change is written");
  });

  test("a field set back to its opening value on a later Save after Link login is written, and the login's own fields still survive", async () => {
    await seededEmptyLogin();
    const form = await opened();
    assert.equal(form.details.country, "Italy", "the form opens with the record row's country");
    const sent = await offer();
    assert.deepEqual((await link("operations lead", sent)).answer, { ok: true });
    // The follow-up Save writes France; a move after it fails, or the drawer closes and reopens on the same form.
    const first = { country: "France" } as const;
    assert.deepEqual(await followUpSave(linkedLogin(form), form, first), { ok: true });
    assert.equal((await userRow(LOGIN_USER))?.country, "France");
    // The viewer sets the country back to what the form opened with and saves again.
    const basis = savedOn(linkedLogin(form), typedOver(form, first));
    assert.deepEqual(await followUpSave(basis, form, { country: "Italy" }), { ok: true });
    const login = await userRow(LOGIN_USER);
    assert.equal(login?.country, "Italy", "the value set back is written, not dropped behind a success");
    assert.equal(login?.phone, "+39 333 222 2222", "the login's own phone is still neither overwritten nor cleared");
  });

  test("an address held by an account that has a member record keeps the refusal, naming who", async () => {
    await seededEmptyLogin();
    await changeRows(users, { id: LOGIN_USER }, { member: IDS.lead("MA"), firstName: "Lead", lastName: "Twice" });
    const { answer, writes } = await save("operations lead", PERSON, REAL);
    assert.deepEqual(answer, { ok: false, error: takenBy("Lead Twice") });
    assert.deepEqual(writes, []);
  });

  /** Each change to either row that makes the confirmation stale. */
  const STALE: readonly (readonly [string, () => Promise<void>])[] = [
    ["the login took a record", () => changeRows(users, { id: LOGIN_USER }, { member: IDS.lead("MA") })],
    ["the login was closed", () => changeRows(users, { id: LOGIN_USER }, { deletedAt: new Date().toISOString() })],
    ["the login no longer holds the address the confirmation named", () => changeRows(users, { id: LOGIN_USER }, { email: "another.address@example.com" })],
    ["the record moved off its row", () => changeRows(users, { id: PERSON_USER }, { member: null })],
    [
      "the record's row signed in",
      async () => addRows(betterAuthUsers, [{ id: PERSON_USER, name: "Person MA", email: "person-ma@mail.test", emailVerified: true }]),
    ],
  ];

  /** Asserts Link login was refused as stale and left `before` as it was, with no write and no activity-log row. */
  async function assertRefusedUnchanged(change: string, before: readonly Record<string, unknown>[], { answer, writes }: Awaited<ReturnType<typeof link>>) {
    assert.deepEqual(answer, { ok: false, error: LOGIN_LINK_REFUSALS.changed }, change);
    assert.deepEqual(writes, [], `${change}: nothing written`);
    assert.deepEqual(await tableRows(users), before, change);
    assert.deepEqual(await logRowsSinceSeed(), [], `${change}: nothing in the activity log`);
  }

  test("Link login refuses, writing nothing, when either row changed since the confirmation opened", async () => {
    for (const [change, apply] of STALE) {
      await seededEmptyLogin();
      const sent = await offer();
      await apply();
      const before = await tableRows(users);
      await assertRefusedUnchanged(change, before, await link("operations lead", sent));
    }
  });

  test("the guard inside the batch refuses a change that lands after Link login's first read", async () => {
    for (const [change, apply] of STALE) {
      await seededEmptyLogin();
      const sent = await offer();
      // The change lands between the read that plans the link and the batch that writes it.
      const batch = testDb.batch;
      const landed: { before?: readonly Record<string, unknown>[] } = {};
      testDb.batch = async (queries) => {
        testDb.batch = batch;
        await apply();
        landed.before = await tableRows(users);
        return batch(queries);
      };
      try {
        const linked = await link("operations lead", sent);
        assert.ok(landed.before !== undefined, `${change}: the change landed before the batch`);
        await assertRefusedUnchanged(change, landed.before, linked);
      } finally {
        testDb.batch = batch;
      }
    }
  });

  test("only full access may link: every other viewer is refused, writing nothing", async () => {
    for (const viewer of [...MAY_EDIT_DETAILS_ONLY, "member"]) {
      await seededEmptyLogin();
      const sent = await offer();
      const { answer, writes } = await link(viewer, sent);
      // A plain member does not reach the Members page at all; the others reach it and are refused the link.
      if (viewer === "member") assert.equal(answer.ok, false, viewer);
      else assert.deepEqual(answer, { ok: false, error: LOGIN_LINK_REFUSALS.notFullAccess }, viewer);
      assert.deepEqual(writes, [], `${viewer}: nothing written`);
      assert.equal((await userRow(LOGIN_USER))?.member, null, viewer);
    }
  });

  test("someone waiting has no record to link, so the address stays refused", async () => {
    await seededEmptyLogin();
    const { answer, writes } = await save("operations lead", WAITING, REAL);
    assert.deepEqual(answer, { ok: false, error: takenBy(null) });
    assert.deepEqual(writes, []);
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
