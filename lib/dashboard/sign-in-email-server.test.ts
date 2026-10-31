import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { applicationFiles, applications, betterAuthSessions, betterAuthUsers, members, teamJoins, users } from "@/db/schema";
import { addRows, changeRows, databaseWrites, logRowsSinceSeed, tableRows, testDb, writesByTransaction } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { NO_DETAILS, type MemberDetails } from "./details";
import type { DetailsTarget, LandedSent } from "./division-members";
import { membersModelOf } from "./members-view";
import { openDashboard } from "./open";
import { SIGN_IN_EMAIL_REFUSALS, takenBy } from "./sign-in-email";

// Changing a sign-in email in Edit details (issues #741 and #864), on the
// migrated in-memory Postgres the access matrix uses
// (./access-matrix/test-database.ts). Full access changes the address in one
// Save; everyone else is refused. When a sign-in account holds the member's
// row, or an empty login holds the new address, the member record moves off
// that row and a login on it is signed out. No attempt ever changes the email
// a sign-in account holds in `better_auth."user"`.

const MA = IDS.division("MA");
const PERSON = { kind: "person", id: IDS.person("MA") } as const satisfies DetailsTarget;
const PERSON_USER = "person-ma";
const MEMBER = PERSON.id;
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
const userRow = async (userId: string) => (await tableRows(users)).find((u) => u.id === userId);
const signInAccounts = () => tableRows(betterAuthUsers);

/** A save of Edit details as `viewer`, on the database as it stands; `signInEmail` left out sends no change. */
async function save(viewer: string, target: DetailsTarget, signInEmail?: string) {
  signInAs(accountOf(viewer).userId);
  const answer = await teamActions.saveMemberDetails(target, MA, { title: "Member", details: DETAILS, ...(signInEmail === undefined ? {} : { signInEmail }) });
  return { answer, writes: await databaseWrites() };
}

/** What Edit details opens with for the person, as full access's Members page hands it: their details and name. */
async function opened(): Promise<{ readonly details: MemberDetails; readonly firstName: string; readonly lastName: string }> {
  signInAs(accountOf("operations lead").userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  const page = membersModelOf(await (opening as { data: DashboardData }).data.members(null));
  const actions = page?.everyone.find((p) => p.id === PERSON.id)?.actions;
  assert.ok(actions);
  return { details: actions.person.details, ...actions.position.name };
}

/** One Save of Edit details as full access sends it: the form as it opened, with `changed` typed over it and the new sign-in email. */
async function saveForm(signInEmail: string, changed: Partial<MemberDetails> = {}) {
  const { details, ...name } = await opened();
  const answer = await teamActions.saveMemberDetails(PERSON, MA, { title: "Member", details: { ...details, ...changed }, ...name, signInEmail });
  return { answer, writes: await databaseWrites() };
}

/** A fresh database where `userId`'s user row is held by a sign-in account with the address it already has. */
async function seededSignedIn(userId: string): Promise<void> {
  await seedFixture();
  const email = await emailOf(userId);
  await addRows(betterAuthUsers, [{ id: userId, name: "Signed In", email, emailVerified: true }]);
}

/** Two open sessions of `userId` and one of a bystander's own account, which no change touches. */
async function openSessions(userId: string): Promise<void> {
  await addRows(betterAuthUsers, [{ id: "bystander", name: "Bystander", email: "bystander@example.com", emailVerified: true }]);
  const session = (id: string, owner: string) => ({ id, token: `token-${id}`, userId: owner, expiresAt: new Date("2099-01-01T00:00:00Z"), updatedAt: new Date() });
  await addRows(betterAuthSessions, [session("s1", userId), session("s2", userId), session("s3", "bystander")]);
}

const sessionOwners = async () => (await tableRows(betterAuthSessions)).map((s) => s.userId).sort();

/** The member's profile on the user row the record leaves, every field set (issue #881). */
const PROFILE = {
  firstName: "Person",
  lastName: "MA",
  origin: "Turin",
  levelOfStudy: "Bachelor",
  linkedin: "linkedin.com/in/person-ma",
  politoId: "312456",
  program: "Aerospace Engineering",
  phone: "+39 333 111 1111",
  gender: "Male",
  referralSource: "A friend",
  country: "Italy",
  dateOfBirth: "2003-03-14",
} as const;
type ProfileField = keyof typeof PROFILE;
const PROFILE_FIELDS = Object.keys(PROFILE) as ProfileField[];

/** The profile fields of `userId`'s row as stored, or undefined when no row has that id. */
async function profileOf(userId: string): Promise<Record<ProfileField, unknown> | undefined> {
  const row = await userRow(userId);
  return row === undefined ? undefined : (Object.fromEntries(PROFILE_FIELDS.map((key) => [key, row[key]])) as Record<ProfileField, unknown>);
}

const EMPTY_PROFILE = Object.fromEntries(PROFILE_FIELDS.map((key) => [key, null])) as Record<ProfileField, null>;

/** An application of the person's row's own, with a CV file, which no change of the sign-in email touches. */
const OWN_APPLICATION = 9_881;
const OWN_FILE = 9_881;

/** Gives `userId`'s row an application of its own, with its CV file. */
async function addOwnApplication(userId: string): Promise<void> {
  await addRows(applicationFiles, [
    { id: OWN_FILE, pathname: "applications/cv-own.pdf", originalFilename: "cv-own.pdf", fileHash: "hash-cv-own", fileSize: 1, uploadedAt: new Date().toISOString(), userId },
  ]);
  await addRows(applications, [
    { id: OWN_APPLICATION, applyPositionId: IDS.position("MA"), userId, cvFileId: OWN_FILE, cvName: "cv-own.pdf", status: "received", statusKey: "new", customAnswers: [{ question: "Why?", answer: "own" }] },
  ]);
}

/** Who holds the own application and its file, and which file the application names. */
async function ownApplicationOf(): Promise<{ application: unknown; file: unknown; cv: unknown }> {
  const application = (await tableRows(applications)).find((a) => a.id === OWN_APPLICATION);
  const file = (await tableRows(applicationFiles)).find((f) => f.id === OWN_FILE);
  return { application: application?.userId, file: file?.userId, cv: application?.cvFileId };
}

/** "Your details" as `userId` reads them on My account. */
async function yourDetailsOf(userId: string) {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  return (await (opening as { data: DashboardData }).data.myAccount())?.details;
}

/** How the dashboard reads `userId` now: their standing's kind. */
async function standingOf(userId: string): Promise<string> {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  return (opening as { data: DashboardData }).data.viewer.kind;
}

describe("full access changes the sign-in email of someone who has not signed in (issue #741)", () => {
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
          logged.some(
            (r) =>
              (r.oldData as { email?: string } | null)?.email !== CORRECTED &&
              (r.newData as { email?: string } | null)?.email === CORRECTED &&
              r.changedBy === accountOf(viewer).userId,
          ),
          `${viewer}: the change is in the activity log with the old and the new address, under their account`,
        );
      }
    }
  });

  test("the person lands on their record at the new address's first sign-in, through the sync trigger", async () => {
    for (const [target, userId] of TARGET_USERS) {
      await seedFixture();
      const before = await userRow(userId);
      assert.deepEqual((await save("operations lead", target, CORRECTED)).answer, { ok: true });
      await addRows(betterAuthUsers, [{ id: "new-sign-in", name: "Real Person", email: CORRECTED, emailVerified: true }]);
      const rows = await tableRows(users);
      assert.equal(rows.find((u) => u.id === userId), undefined, `${userId}: the row took the sign-in account's id`);
      assert.equal(rows.filter((u) => u.email === CORRECTED).length, 1, "one row, linked");
      assert.equal(rows.find((u) => u.id === "new-sign-in")?.member, before?.member, "the member record, or none for someone waiting, stays on it");
    }
    assert.equal((await tableRows(teamJoins)).find((j) => j.id === WAITING.joinId)?.userId, "new-sign-in", "the wait follows the row");
  });
});

describe("every other viewer is refused a sign-in email change, with nothing written (issue #741)", () => {
  test("a division lead, a head and a Members grant at Can edit save the other details, never the sign-in email", async () => {
    for (const viewer of MAY_EDIT_DETAILS_ONLY) {
      await seedFixture();
      assert.deepEqual((await save(viewer, PERSON)).answer, { ok: true }, `${viewer} edits the person's other details`);
      for (const target of TARGETS) {
        for (const seed of [seedFixture, () => seededSignedIn(PERSON_USER)]) {
          await seed();
          const { answer, writes } = await save(viewer, target, CORRECTED);
          assert.deepEqual(answer, { ok: false, error: SIGN_IN_EMAIL_REFUSALS.notFullAccess }, `${viewer} on ${target.kind}`);
          assert.deepEqual(writes, [], `${viewer} on ${target.kind}: nothing written`);
        }
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

describe("a change never touches a sign-in account's own email (issues #741, #864)", () => {
  test("someone waiting who already signs in is refused, and both their rows read back unchanged", async () => {
    await seededSignedIn(WAITING_USER);
    const before = { email: await emailOf(WAITING_USER), accounts: await signInAccounts() };
    const { answer, writes } = await save("operations lead", WAITING, CORRECTED);
    assert.deepEqual(answer, { ok: false, error: SIGN_IN_EMAIL_REFUSALS.signedIn });
    assert.deepEqual(writes, [], "nothing written");
    assert.equal(await emailOf(WAITING_USER), before.email);
    assert.deepEqual(await signInAccounts(), before.accounts, "better_auth.user reads back unchanged");
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

describe("a change is checked before anything is written (issue #741)", () => {
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

describe("a stranger signed in on a member's wrong stored address loses the record on Save (issue #864)", () => {
  /**
   * A fresh database where a stranger signed in with the person's wrong
   * stored address and holds their row, with the member's whole profile on
   * it, an application of the login's own and sessions open.
   */
  async function seededStranger(): Promise<void> {
    await seededSignedIn(PERSON_USER);
    await changeRows(users, { id: PERSON_USER }, { ...PROFILE, access: ["members"] });
    await addOwnApplication(PERSON_USER);
    await openSessions(PERSON_USER);
    assert.equal(await standingOf(PERSON_USER), "member", "the stranger reaches the member's dashboard");
  }

  test("nobody signed in on the new address: a new row holds it and the record, the stranger is signed out and holds no record", async () => {
    await seededStranger();
    const accounts = await signInAccounts();
    const { answer } = await saveForm(CORRECTED, { gender: "Female" });
    assert.deepEqual(answer, { ok: true }, "one Save, no confirmation step");
    assert.equal((await writesByTransaction()).length, 1, "one batch");
    const holders = (await tableRows(users)).filter((u) => u.member === MEMBER);
    assert.equal(holders.length, 1, "one row holds the record");
    const [moved] = holders;
    assert.equal(moved.email, CORRECTED);
    assert.equal(await signInAccounts().then((a) => a.some((x) => x.id === moved.id)), false, "no sign-in account holds the new row yet");
    assert.deepEqual(await profileOf(String(moved.id)), { ...PROFILE, gender: "Female" }, "the record's whole profile comes along, with the field the viewer changed");
    assert.deepEqual(moved.access, ["members"]);
    const stranger = await userRow(PERSON_USER);
    assert.equal(stranger?.member, null, "the stranger's row no longer holds the record");
    assert.equal(stranger?.deletedAt, null, "the stranger's own login stays open");
    assert.equal(stranger?.email, "person-ma@mail.test", "the stranger's address is left as it is");
    assert.deepEqual(await profileOf(PERSON_USER), EMPTY_PROFILE, "the stranger's row is emptied of the member's profile (issue #881)");
    assert.deepEqual(await ownApplicationOf(), { application: PERSON_USER, file: PERSON_USER, cv: OWN_FILE }, "the stranger's own application and its file stay");
    assert.deepEqual(await sessionOwners(), ["bystander"], "every session of the stranger ended; nobody else's");
    assert.deepEqual(await signInAccounts(), accounts, "better_auth.user reads back unchanged");
    assert.equal(await standingOf(PERSON_USER), "non-member", "on any later sign-in the stranger has no member record");
    assert.deepEqual(await yourDetailsOf(PERSON_USER), NO_DETAILS, "the stranger's Your details read none of the member's");
    await addRows(betterAuthUsers, [{ id: "real-person", name: "Person MA", email: CORRECTED, emailVerified: true }]);
    assert.equal((await userRow("real-person"))?.member, MEMBER, "the person lands on their record at their first sign-in");
    assert.equal(await standingOf("real-person"), "member");
  });

  test("an empty login already on the new address takes the record, keeping its own fields and applications", async () => {
    await seededStranger();
    const LOGIN = "applicant-ma";
    const REAL = "appl-ma@mail.test";
    await addRows(betterAuthUsers, [{ id: LOGIN, name: "Applicant", email: REAL, emailVerified: true }]);
    await changeRows(users, { id: LOGIN }, { country: null });
    const owned = (await tableRows(applications)).filter((a) => a.userId === LOGIN).map((a) => a.id);
    assert.ok(owned.length > 0, "the login has applied");
    const { answer } = await saveForm(REAL, { gender: "Female" });
    assert.deepEqual(answer, { ok: true });
    assert.equal((await writesByTransaction()).length, 1, "one batch");
    const login = await userRow(LOGIN);
    assert.equal(login?.member, MEMBER, "the login holds the member record");
    assert.equal(login?.phone, "appl-ma-phone", "a field the login already has stays its own");
    assert.equal(login?.country, "Italy", "an empty field takes the record row's value");
    assert.equal(login?.gender, "Female", "a field the viewer changed is written");
    assert.deepEqual(login?.access, ["members"], "the grant the login lacked comes with the record");
    assert.deepEqual(
      await profileOf(LOGIN),
      { ...PROFILE, firstName: "Applicant", lastName: "appl-ma", phone: "appl-ma-phone", gender: "Female" },
      "every field the login had empty takes the record row's value",
    );
    assert.deepEqual((await tableRows(applications)).filter((a) => a.userId === LOGIN).map((a) => a.id), owned, "its applications stay its own");
    const stranger = await userRow(PERSON_USER);
    assert.equal(stranger?.member, null);
    assert.equal(stranger?.deletedAt, null);
    assert.deepEqual(await profileOf(PERSON_USER), EMPTY_PROFILE, "the stranger's row is emptied of the member's profile (issue #881)");
    assert.deepEqual(await ownApplicationOf(), { application: PERSON_USER, file: PERSON_USER, cv: OWN_FILE }, "the stranger's own application and its file stay");
    assert.deepEqual(await sessionOwners(), ["bystander"], "every session of the stranger ended; nobody else's");
    assert.equal(await standingOf(PERSON_USER), "non-member");
    assert.deepEqual(await yourDetailsOf(PERSON_USER), NO_DETAILS, "the stranger's Your details read none of the member's");
    assert.equal(await standingOf(LOGIN), "member", "the login reaches the member's dashboard");
  });
});

describe("an empty login takes the record off a row nobody signed in on (issues #860, #864)", () => {
  const LOGIN_USER = "login-ma";
  const REAL = "real.person@example.com";

  /**
   * A fresh database where the person's real address signed in on its own:
   * the sync trigger made a second user row with no member record. Their
   * imported row carries an access grant the login lacks; the login already
   * has a phone of its own.
   */
  async function seededEmptyLogin(): Promise<void> {
    await seedFixture();
    await changeRows(users, { id: PERSON_USER }, { phone: "+39 333 111 1111", country: "Italy", access: ["members"] });
    await addRows(betterAuthUsers, [{ id: LOGIN_USER, name: "Person MA", email: REAL, emailVerified: true }]);
    await changeRows(users, { id: LOGIN_USER }, { phone: "+39 333 222 2222" });
  }

  test("Save moves the record onto the login in one audited batch, fills its empty fields, and closes the old row", async () => {
    await seededEmptyLogin();
    const { answer } = await saveForm(REAL, { country: "France" });
    assert.deepEqual(answer, { ok: true }, "one Save, no confirmation step");
    const login = await userRow(LOGIN_USER);
    assert.equal(login?.member, MEMBER, "the login holds the member record");
    assert.deepEqual([login?.firstName, login?.lastName], ["Person", "MA"], "an empty field takes the record row's value");
    assert.equal(login?.phone, "+39 333 222 2222", "a field the login already has, which the viewer left, stays its own");
    assert.equal(login?.country, "France", "a field the viewer changed is written");
    assert.deepEqual(login?.access, ["members"]);
    const old = await userRow(PERSON_USER);
    assert.ok(old !== undefined, "the old row is not deleted");
    assert.equal(old.member, null, "the old row no longer holds the record");
    assert.notEqual(old.deletedAt, null, "the old row, which no sign-in held, is closed");
    assert.deepEqual(await profileOf(PERSON_USER), EMPTY_PROFILE, "and emptied of the member's profile (issue #881)");
    assert.equal((await writesByTransaction()).length, 1, "one batch");
    const logged = (await logRowsSinceSeed()).filter((r) => r.tableName === "users");
    assert.deepEqual(new Set(logged.map((r) => r.recordId)), new Set([LOGIN_USER, PERSON_USER]));
    assert.ok(logged.every((r) => r.changedBy === accountOf("operations lead").userId), "in the activity log under the viewer");
  });

  test("a retry of the same open form after the record moved writes only what changed since: the login's own fields survive", async () => {
    await seededEmptyLogin();
    const { details, ...name } = await opened();
    assert.equal(details.phone, "+39 333 111 1111", "the form opens with the old row's phone");
    /** One Save of the form as it opened, with `changed` typed over it and what an earlier Save landed, as Edit details sends it. */
    const send = (changed: Partial<MemberDetails>, landed?: LandedSent) => {
      signInAs(accountOf("operations lead").userId);
      return teamActions.saveMemberDetails(PERSON, MA, { title: "Member", details: { ...details, ...changed }, ...name, signInEmail: REAL, ...(landed === undefined ? {} : { landed }) });
    };
    const landedOf = (changed: Partial<MemberDetails>): LandedSent => ({ details: { ...details, ...changed }, ...name });
    // The first Save moves the record; a placement move after it fails and leaves the form open.
    assert.deepEqual(await send({ country: "France" }), { ok: true });
    assert.equal((await userRow(LOGIN_USER))?.member, MEMBER);
    let landed = landedOf({ country: "France" });
    for (const [round, changed] of [
      ["a retry of the same Save", { country: "France" }],
      ["a retry with one more change", { country: "France", gender: "Female" }],
    ] as const) {
      assert.deepEqual(await send(changed, landed), { ok: true }, round);
      landed = landedOf(changed);
      const login = await userRow(LOGIN_USER);
      assert.equal(login?.phone, "+39 333 222 2222", `${round}: the login's own phone is not overwritten with the old row's`);
      assert.equal(login?.country, "France", `${round}: a field the viewer changed stays written`);
    }
    assert.equal((await userRow(LOGIN_USER))?.gender, "Female", "the retry's own change is written");
    // A field set back to its opening value is a change since the last Save, so it is written too.
    assert.deepEqual(await send({ country: "Italy", gender: "Female" }, landed), { ok: true });
    const login = await userRow(LOGIN_USER);
    assert.equal(login?.country, "Italy", "the value set back is written, not dropped behind a success");
    assert.equal(login?.phone, "+39 333 222 2222", "the login's own phone still survives");
  });

  test("a field the viewer left keeps the login's own value where the form showed another than the old row stores", async () => {
    await seededEmptyLogin();
    // The old row has no phone of its own, a programme that is no longer an option, and an empty stored Polito ID.
    await changeRows(users, { id: PERSON_USER }, { phone: null, program: "A programme since retired", politoId: "" });
    await changeRows(members, { memberId: MEMBER }, { mobileNumber: "+39 333 999 9999" });
    await changeRows(users, { id: LOGIN_USER }, { program: "The login's own programme", politoId: "123456" });
    const { details } = await opened();
    assert.equal(details.phone, "+39 333 999 9999", "the form shows the member record's mobile number");
    assert.equal(details.programme, "", "a programme no longer an option reads empty");
    assert.equal(details.politoId, "", "an empty stored text reads empty");
    assert.deepEqual((await saveForm(REAL, { country: "France" })).answer, { ok: true });
    const login = await userRow(LOGIN_USER);
    assert.equal(login?.member, MEMBER, "the login holds the member record");
    assert.equal(login?.phone, "+39 333 222 2222", "the mobile number the form showed does not replace the login's own phone");
    assert.equal(login?.program, "The login's own programme", "a programme that read empty is not cleared");
    assert.equal(login?.politoId, "123456", "an empty stored text does not clear the login's own");
    assert.equal(login?.country, "France", "a field the viewer changed is written");
  });

  test("an address held by an account that has a member record is refused, naming who", async () => {
    await seededEmptyLogin();
    await changeRows(users, { id: LOGIN_USER }, { member: IDS.lead("MA"), firstName: "Lead", lastName: "Twice" });
    const { answer, writes } = await save("operations lead", PERSON, REAL);
    assert.deepEqual(answer, { ok: false, error: takenBy("Lead Twice") });
    assert.deepEqual(writes, []);
  });

  test("someone waiting has no record to move, so the address stays refused", async () => {
    await seededEmptyLogin();
    const { answer, writes } = await save("operations lead", WAITING, REAL);
    assert.deepEqual(answer, { ok: false, error: takenBy(null) });
    assert.deepEqual(writes, []);
  });

  /** Each change to either row, landing between the read that plans the move and the batch that writes it. */
  const STALE: readonly (readonly [string, () => Promise<void>])[] = [
    ["the login took a record", () => changeRows(users, { id: LOGIN_USER }, { member: IDS.lead("MA") })],
    ["the login was closed", () => changeRows(users, { id: LOGIN_USER }, { deletedAt: new Date().toISOString() })],
    ["the login no longer holds the address", () => changeRows(users, { id: LOGIN_USER }, { email: "another.address@example.com" })],
    ["the record moved off its row", () => changeRows(users, { id: PERSON_USER }, { member: null })],
    [
      "the record's row signed in",
      async () => addRows(betterAuthUsers, [{ id: PERSON_USER, name: "Person MA", email: "person-ma@mail.test", emailVerified: true }]),
    ],
  ];

  test("the guard inside the batch refuses, writing nothing, when either row changed after the first read", async () => {
    for (const [change, apply] of STALE) {
      await seededEmptyLogin();
      const batch = testDb.batch;
      const landed: { before?: readonly Record<string, unknown>[] } = {};
      testDb.batch = async (queries) => {
        testDb.batch = batch;
        await apply();
        landed.before = await tableRows(users);
        return batch(queries);
      };
      try {
        const { answer, writes } = await saveForm(REAL);
        assert.ok(landed.before !== undefined, `${change}: the change landed before the batch`);
        assert.deepEqual(answer, { ok: false, error: SIGN_IN_EMAIL_REFUSALS.changed }, change);
        assert.deepEqual(writes, [], `${change}: nothing written`);
        assert.deepEqual(await tableRows(users), landed.before, change);
        assert.deepEqual(await logRowsSinceSeed(), [], `${change}: nothing in the activity log`);
      } finally {
        testDb.batch = batch;
      }
    }
  });
});

describe("Edit details offers the field from one flag the server sets (issues #741, #864)", () => {
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

  test("set for full access on every member, signed in or not, and on someone waiting until they sign in; for nobody else", async () => {
    await seedFixture();
    assert.deepEqual(await flagsOf("operations lead"), { person: true, waiting: true });
    for (const viewer of ["division lead", "department head"]) assert.deepEqual(await flagsOf(viewer), { person: false, waiting: false }, viewer);
    await seededSignedIn(PERSON_USER);
    assert.equal((await flagsOf("operations lead")).person, true, "a member who signs in keeps the field");
    await seededSignedIn(WAITING_USER);
    assert.equal((await flagsOf("operations lead")).waiting, false, "someone waiting loses it once they sign in");
  });
});
