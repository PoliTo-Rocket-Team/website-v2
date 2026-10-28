import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableColumns, type InferSelectModel, type Table } from "drizzle-orm";
import { applications, members, users } from "@/db/schema";
import { alumniOf, alumniYears, type AlumniEntry, type AlumniRecord } from "@/lib/about/alumni-record";
import {
  ANONYMIZED_EMAIL,
  anonymizationPlan,
  anonymizeDeletedAccounts,
  CLEARED_APPLICATION,
  CLEARED_MEMBER,
  clearedUser,
  LOG_SCRUBS,
  logScrubsOf,
  scrubLogData,
  scrubReaches,
  type AnonymizationStep,
  type AnonymizationStore,
  type DeletedAccount,
  type LogRow,
  type PersonalFile,
} from "./anonymize";

const NOW = new Date("2026-10-10T03:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

function account(overrides: Partial<DeletedAccount> = {}): DeletedAccount {
  return {
    userId: "u-1",
    memberId: 7,
    deletedAt: daysAgo(366),
    anonymizedAt: null,
    signedInAgain: false,
    alumni: { name: "Giulia Rossi", removed: false },
    ...overrides,
  };
}

/**
 * A store over fixed accounts: it returns every one, so the rule under test
 * is the domain's own. `stillDue` is what the batch's own check finds, and
 * `named` the files another row still names, which the run keeps.
 */
function fakeStore(accounts: DeletedAccount[], files: PersonalFile[] = [], stillDue = true, named: readonly string[] = []) {
  const runs: AnonymizationStep[][] = [];
  const deleted: PersonalFile[] = [];
  const store: AnonymizationStore = {
    deletedAccounts: async () => accounts,
    personalFiles: async () => files,
    deleteFile: async (file) => {
      deleted.push(file);
    },
    run: async (_userId, plan, sent) => {
      if (!stillDue) return null;
      runs.push([...plan]);
      return sent.filter((file) => !named.includes(file.pathname));
    },
  };
  return { store, runs, deleted };
}

test("an account deleted 366 days ago is anonymized", async () => {
  const { store, runs } = fakeStore([account({ deletedAt: daysAgo(366) })]);
  const run = await anonymizeDeletedAccounts(NOW, store);
  assert.deepEqual(run, { anonymized: ["u-1"], failed: [] });
  assert.equal(runs.length, 1);
});

test("an account deleted 364 days ago is left alone", async () => {
  const { store, runs } = fakeStore([account({ deletedAt: daysAgo(364) })]);
  assert.deepEqual(await anonymizeDeletedAccounts(NOW, store), { anonymized: [], failed: [] });
  assert.equal(runs.length, 0);
});

test("an account already anonymized is left alone", async () => {
  const { store, runs } = fakeStore([account({ anonymizedAt: daysAgo(10) })]);
  assert.deepEqual(await anonymizeDeletedAccounts(NOW, store), { anonymized: [], failed: [] });
  assert.equal(runs.length, 0);
});

test("an account whose person signed in again is left alone", async () => {
  const { store, runs } = fakeStore([account({ signedInAgain: true })]);
  assert.deepEqual(await anonymizeDeletedAccounts(NOW, store), { anonymized: [], failed: [] });
  assert.equal(runs.length, 0);
});

test("the person's application files and member photo are deleted once the rows are cleared", async () => {
  const files: PersonalFile[] = [
    { store: "private", pathname: "applications/cv.pdf" },
    { store: "public", pathname: "photo/7-a.jpg" },
  ];
  const { store, deleted, runs } = fakeStore([account()], files);
  await anonymizeDeletedAccounts(NOW, store);
  assert.deepEqual(deleted, files);
  assert.ok(runs[0]?.some((step) => step.kind === "delete-application-files"));
});

test("someone who signs in again during the run keeps their data and their files (#831)", async () => {
  const files: PersonalFile[] = [
    { store: "private", pathname: "applications/cv.pdf" },
    { store: "public", pathname: "photo/7-a.jpg" },
  ];
  // The accounts were read as due; the batch's own check then finds a sign-in.
  const { store, deleted, runs } = fakeStore([account()], files, false);
  assert.deepEqual(await anonymizeDeletedAccounts(NOW, store), { anonymized: [], failed: [] });
  assert.equal(runs.length, 0, "nothing was written");
  assert.deepEqual(deleted, [], "no file was deleted");
});

test("a photo another row still names stays in the store (#831)", async () => {
  const files: PersonalFile[] = [
    { store: "private", pathname: "applications/cv.pdf" },
    { store: "public", pathname: "photo/7-a.jpg" },
  ];
  const { store, deleted } = fakeStore([account()], files, true, ["photo/7-a.jpg"]);
  await anonymizeDeletedAccounts(NOW, store);
  assert.deepEqual(deleted, [files[0]]);
});

test("when the write fails, no file is deleted and the next run retries the account", async () => {
  const { store, deleted } = fakeStore([account()], [{ store: "private", pathname: "applications/cv.pdf" }]);
  store.run = async () => {
    throw new Error("database down");
  };
  const original = console.error;
  console.error = () => undefined;
  try {
    assert.deepEqual(await anonymizeDeletedAccounts(NOW, store), { anonymized: [], failed: ["u-1"] });
  } finally {
    console.error = original;
  }
  assert.deepEqual(deleted, []);
});

test("when a file cannot be deleted after the rows are cleared, the run reports the account as failed", async () => {
  const { store, runs } = fakeStore([account()], [{ store: "private", pathname: "applications/cv.pdf" }]);
  store.deleteFile = async () => {
    throw new Error("store down");
  };
  const original = console.error;
  console.error = () => undefined;
  try {
    assert.deepEqual(await anonymizeDeletedAccounts(NOW, store), { anonymized: [], failed: ["u-1"] });
  } finally {
    console.error = original;
  }
  assert.equal(runs.length, 1, "the rows were cleared first");
});

// The rows before and after -------------------------------------------------

const user: InferSelectModel<typeof users> = {
  id: "u-1",
  email: "giulia.rossi@example.com",
  firstName: "Giulia",
  lastName: "Rossi",
  origin: "Italy",
  levelOfStudy: "Master",
  linkedin: "https://www.linkedin.com/in/giuliarossi",
  politoId: "s123456",
  program: "Aerospace Engineering",
  phone: "+39 333 1234567",
  dateOfBirth: "2001-04-02",
  gender: "female",
  referralSource: "instagram",
  country: "Italy",
  member: 7,
  createdAt: "2024-09-01T10:00:00.000Z",
  updatedAt: "2025-01-01T10:00:00.000Z",
  access: [],
  deletedAt: "2025-10-01T10:00:00.000Z",
  anonymizedAt: null,
};

// The old `email_alias` column is gone: drizzle/0075 dropped it (issue #569).
const member = {
  memberId: 7,
  prtEmail: "giulia.rossi@politorocketteam.it",
  mobileNumber: "+39 333 7654321",
  discord: "giulia#1234",
  ndaSignedAt: "2024-10-01T10:00:00.000Z",
  ndaName: "Giulia Rossi",
  ndaConfirmedBy: 3,
  picture: "https://store.example/photo/7-a.jpg",
  teamFrom: 2024,
  teamTo: 2025,
  emailAliasSetUpAt: null,
} satisfies Partial<InferSelectModel<typeof members>>;

const application: InferSelectModel<typeof applications> = {
  id: 41,
  applyPositionId: 5,
  userId: "u-1",
  cvFileId: 90,
  coverLetterFileId: 91,
  mlName: "giulia-rossi-letter.pdf",
  cvName: "giulia-rossi-cv.pdf",
  appliedAt: "2024-09-02T10:00:00.000Z",
  status: "joined",
  statusKey: "joined",
  customAnswers: [{ question: "Why?", answer: "I am Giulia Rossi, I led the Turin model rocket club" }],
  withdrawnAt: null,
  acceptedAt: "2024-09-20T10:00:00.000Z",
  rejectedAt: null,
  ndaArrivedAt: "2024-09-25T10:00:00.000Z",
  joinedAt: "2024-10-01T10:00:00.000Z",
};

const USER_STATISTICS = ["gender", "dateOfBirth", "origin", "country", "levelOfStudy", "program", "referralSource", "createdAt", "member"] as const;
const MEMBER_STATISTICS = ["teamFrom", "teamTo", "ndaSignedAt"] as const;
const APPLICATION_STATISTICS = ["applyPositionId", "status", "appliedAt", "withdrawnAt", "acceptedAt", "ndaArrivedAt", "joinedAt"] as const;

const userAfter = { ...user, ...clearedUser(NOW) };
const memberAfter = { ...member, ...CLEARED_MEMBER };
const applicationAfter = { ...application, ...CLEARED_APPLICATION };

test("anonymization clears the identifying fields", () => {
  assert.equal(userAfter.email, ANONYMIZED_EMAIL);
  for (const key of ["firstName", "lastName", "phone", "linkedin", "politoId"] as const) assert.equal(userAfter[key], null, key);
  for (const key of ["prtEmail", "mobileNumber", "discord", "ndaName", "picture"] as const) assert.equal(memberAfter[key], null, key);
  assert.equal(applicationAfter.mlName, null);
  assert.equal(applicationAfter.cvName, null);
  // The free-text answers can name or describe the person (issue #729).
  assert.equal(applicationAfter.customAnswers, null);
  assert.equal(userAfter.anonymizedAt, NOW.toISOString());
});

test("anonymization keeps every statistics field and deletes no statistics row", () => {
  for (const key of USER_STATISTICS) assert.deepEqual(userAfter[key], user[key], key);
  for (const key of MEMBER_STATISTICS) assert.deepEqual(memberAfter[key], member[key], key);
  for (const key of APPLICATION_STATISTICS) assert.deepEqual(applicationAfter[key], application[key], key);

  const plan = anonymizationPlan(account(), NOW);
  const deletes = plan.filter((step) => step.kind.startsWith("delete-"));
  assert.deepEqual(deletes, [{ kind: "delete-application-files", userId: "u-1" }]);
  // Each update names only the columns it clears: no other column is written.
  for (const step of plan) {
    if (step.kind === "clear-user") assert.deepEqual(Object.keys(step.set).sort(), ["anonymizedAt", "email", "firstName", "lastName", "linkedin", "phone", "politoId"]);
    if (step.kind === "clear-member") assert.deepEqual(Object.keys(step.set).sort(), ["discord", "mobileNumber", "ndaName", "picture", "prtEmail"]);
    if (step.kind === "clear-applications") assert.deepEqual(Object.keys(step.set).sort(), ["customAnswers", "cvName", "mlName"]);
  }
  assert.ok(
    plan.every((step) =>
      ["keep-alumni-entry", "clear-user", "clear-member", "clear-applications", "delete-application-files", "scrub-logs"].includes(step.kind),
    ),
  );
});

// The alumni entry (issue #257) ---------------------------------------------------

/** One member with two years of roles, as the Alumni page reads the record. */
function alumniRecordAfter(entry: Pick<AlumniEntry, "who" | "founder" | "removed">): AlumniRecord {
  return {
    units: { departments: [{ id: 1, name: "Aerodynamics" }], divisions: [{ id: 4, name: "Wind Tunnel", departmentId: 1 }] },
    roles: [{ memberId: 7, type: "core", title: "Aerodynamicist", startedAt: "2024-10-01", leftAt: "2025-09-15", departmentId: null, divisionId: 4 }],
    // Anonymized: the team record holds no name any more.
    people: [{ memberId: 7, name: null, email: ANONYMIZED_EMAIL }],
    entries: [{ id: 3, name: null, photo: null, shown: true, fixes: [], ...entry }],
    imported: [],
  };
}

test("anonymizing keeps the alumni entry: the record's name is copied to it before the user row loses it", () => {
  const plan = anonymizationPlan(account(), NOW);
  assert.deepEqual(plan[0], { kind: "keep-alumni-entry", memberId: 7, name: "Giulia Rossi" });
  assert.ok(plan.findIndex((step) => step.kind === "keep-alumni-entry") < plan.findIndex((step) => step.kind === "clear-user"));
  assert.ok(plan.every((step) => step.kind !== "clear-alumni-entry"));
  // Every private field it cleared before is still cleared.
  assert.deepEqual(plan.find((step) => step.kind === "clear-user"), { kind: "clear-user", userId: "u-1", set: clearedUser(NOW) });
  assert.deepEqual(plan.find((step) => step.kind === "clear-member"), { kind: "clear-member", memberId: 7, set: CLEARED_MEMBER });
  assert.deepEqual(plan.find((step) => step.kind === "clear-applications"), { kind: "clear-applications", userId: "u-1", set: CLEARED_APPLICATION });
});

test("after anonymization the Alumni page still lists them: name, years, roles and founder mark", () => {
  const record = alumniRecordAfter({ who: { kind: "member", memberId: 7, keptName: "Giulia Rossi" }, founder: "co-founder", removed: false });
  const [giulia] = alumniOf(record, 2026);
  assert.equal(giulia?.name, "Giulia Rossi");
  assert.equal(giulia?.founder, "co-founder");
  assert.deepEqual(giulia?.lines.map((l) => [l.year, l.group, l.role]), [[2024, "Aerodynamics", "Aerodynamicist"]]);
  const years = alumniYears(alumniOf(record, 2026), 2025);
  assert.deepEqual(years.map((y) => y.groups.map((g) => g.entries.map((e) => [e.name, e.role, e.tag]))), [[[["Giulia Rossi", "Aerodynamicist", "CO-FOUNDER"]]]]);
});

test("someone who ticked the remove box loses every name and photo on the entry, and the page lists them nowhere", () => {
  const plan = anonymizationPlan(account({ alumni: { name: "Giulia Rossi", removed: true } }), NOW);
  assert.deepEqual(plan[0], { kind: "clear-alumni-entry", memberId: 7, set: { recordName: null, name: null, photo: null } });
  assert.ok(plan.every((step) => step.kind !== "keep-alumni-entry"));
  assert.ok(plan.some((step) => step.kind === "clear-user") && plan.some((step) => step.kind === "clear-member"));
  const record = alumniRecordAfter({ who: { kind: "member", memberId: 7, keptName: null }, founder: "co-founder", removed: true });
  assert.deepEqual(alumniYears(alumniOf(record, 2026), 2025), []);
});

test("someone never on the team has no alumni step", () => {
  const plan = anonymizationPlan(account({ memberId: null, alumni: null }), NOW);
  assert.ok(plan.every((step) => step.kind !== "keep-alumni-entry" && step.kind !== "clear-alumni-entry"));
});

test("the alumni entry's log rows keep a kept name, and lose it when the person asked to be removed", () => {
  const person = { userId: "u-1", memberId: 7 };
  const row = log("public", "alumni_entries", "3", null, { id: 3, member_id: 7, record_name: "Giulia Rossi", name: "Giulia R.", photo: "https://store.example/photo/alumni-a.jpg", shown: true });
  const scrubbedWith = (removed: boolean) => {
    const keys = logScrubsOf({ memberId: 7, alumni: { name: "Giulia Rossi", removed } })
      .filter((scrub) => scrubReaches(scrub, person, row))
      .flatMap((scrub) => scrub.keys);
    return scrubLogData(row.newData, keys);
  };
  assert.deepEqual(scrubbedWith(false), { id: 3, member_id: 7, record_name: "Giulia Rossi", name: "Giulia R.", shown: true });
  assert.deepEqual(scrubbedWith(true), { id: 3, member_id: 7, shown: true });
  const someoneElse = log("public", "alumni_entries", "4", null, { id: 4, member_id: 8, record_name: "Marco Bianchi" });
  assert.ok(logScrubsOf({ memberId: 7, alumni: { name: null, removed: true } }).every((scrub) => !scrubReaches(scrub, person, someoneElse)));
});

test("a person who was never on the team has no member step", () => {
  assert.ok(anonymizationPlan(account({ memberId: null }), NOW).every((step) => step.kind !== "clear-member"));
});

test("the log scrub runs last, after the writes whose log rows it must reach", () => {
  const plan = anonymizationPlan(account(), NOW);
  assert.equal(plan.at(-1)?.kind, "scrub-logs");
});

// The audit log ---------------------------------------------------------------

/** A row as the audit trigger copies it: `to_jsonb`, so SQL column names. */
function asLogged<T extends Table>(table: T, row: Record<string, unknown>): Record<string, unknown> {
  const columns = getTableColumns(table) as Record<string, { name: string }>;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [columns[key]?.name ?? key, value]));
}

const log = (schemaName: string, tableName: string, recordId: string | null, oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): LogRow => ({
  schemaName,
  tableName,
  recordId,
  oldData,
  newData,
});

test("no log row about the person keeps a cleared value, the anonymizing updates' own rows included", () => {
  const person = { userId: "u-1", memberId: 7 };
  const rows: LogRow[] = [
    // Written while the person used the dashboard.
    log("public", "users", "u-1", null, asLogged(users, user)),
    log("public", "members", "7", null, asLogged(members, member)),
    log("public", "applications", "41", null, asLogged(applications, application)),
    log("public", "application_files", "90", { id: 90, r2_key: "applications/giulia-rossi-cv.pdf", original_filename: "giulia-rossi-cv.pdf", user_id: "u-1" }, null),
    // Delete account.
    log("better_auth", "user", "u-1", { id: "u-1", name: "Giulia Rossi", email: "giulia.rossi@example.com", image: "https://lh3.example/giulia" }, null),
    log("better_auth", "session", "s-1", { id: "s-1", token: "tok", ipAddress: "93.0.0.1", userAgent: "Firefox", userId: "u-1" }, null),
    log("better_auth", "account", "a-1", { id: "a-1", accountId: "google-sub-1", accessToken: "at", idToken: "it", userId: "u-1" }, null),
    // The anonymizing updates themselves.
    log("public", "users", "u-1", asLogged(users, user), asLogged(users, userAfter)),
    log("public", "members", "7", asLogged(members, member), asLogged(members, memberAfter)),
    log("public", "applications", "41", asLogged(applications, application), asLogged(applications, applicationAfter)),
  ];
  const scrubbed = rows.map((row) => {
    const reaching = LOG_SCRUBS.filter((scrub) => scrubReaches(scrub, person, row));
    const keys = reaching.flatMap((scrub) => scrub.keys);
    return { ...row, oldData: scrubLogData(row.oldData, keys), newData: scrubLogData(row.newData, keys) };
  });

  const cleared = [
    user.email, user.firstName, user.lastName, user.phone, user.linkedin, user.politoId,
    member.prtEmail, member.mobileNumber, member.discord, member.ndaName, member.picture,
    application.mlName, application.cvName,
    "applications/giulia-rossi-cv.pdf", "Giulia Rossi", "https://lh3.example/giulia", "tok", "93.0.0.1", "google-sub-1", "at", "it",
  ];
  const text = JSON.stringify(scrubbed);
  for (const value of cleared) assert.ok(!text.includes(JSON.stringify(value)), `${value} is still in the log`);
  // No copy of the application keeps its free-text answers (issue #729).
  assert.ok(!text.includes("Turin model rocket club"), "a custom answer is still in the log");
  for (const row of scrubbed.filter((r) => r.tableName === "applications")) {
    assert.ok(row.oldData === null || !("custom_answers" in row.oldData), "custom_answers is still in old_data");
    assert.ok(row.newData === null || !("custom_answers" in row.newData), "custom_answers is still in new_data");
  }
  // The statistics stay in the log too.
  for (const value of [user.gender, user.program, user.dateOfBirth, member.teamFrom, application.status]) {
    assert.ok(text.includes(JSON.stringify(value)), `${value} left the log`);
  }
});

test("the scrub reaches no one else's log rows", () => {
  const person = { userId: "u-1", memberId: 7 };
  const others: LogRow[] = [
    log("public", "users", "u-2", null, { id: "u-2", email: "someone@example.com" }),
    log("public", "members", "8", null, { member_id: 8, prt_email: "someone@politorocketteam.it" }),
    log("public", "applications", "42", null, { id: 42, user_id: "u-2", cv_name: "cv.pdf" }),
    log("better_auth", "session", "s-2", { id: "s-2", userId: "u-2", ipAddress: "1.1.1.1" }, null),
    // Same record id, other table.
    log("public", "orders", "7", null, { id: 7, name: "Valve" }),
  ];
  for (const row of others) {
    assert.ok(LOG_SCRUBS.every((scrub) => !scrubReaches(scrub, person, row)), `${row.tableName} ${row.recordId}`);
  }
  assert.ok(LOG_SCRUBS.every((scrub) => !scrubReaches(scrub, { userId: "u-1", memberId: null }, log("public", "members", "7", null, {}))));
});
