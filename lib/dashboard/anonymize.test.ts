import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableColumns, type InferSelectModel, type Table } from "drizzle-orm";
import { applications, members, users } from "@/db/schema";
import {
  ANONYMIZED_EMAIL,
  anonymizationPlan,
  anonymizeDeletedAccounts,
  CLEARED_APPLICATION,
  CLEARED_MEMBER,
  clearedUser,
  LOG_SCRUBS,
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
  return { userId: "u-1", memberId: 7, deletedAt: daysAgo(366), anonymizedAt: null, signedInAgain: false, ...overrides };
}

/** A store over fixed accounts: it returns every one, so the rule under test is the domain's own. */
function fakeStore(accounts: DeletedAccount[], files: PersonalFile[] = []) {
  const runs: AnonymizationStep[][] = [];
  const deleted: PersonalFile[] = [];
  const store: AnonymizationStore = {
    deletedAccounts: async () => accounts,
    personalFiles: async () => files,
    deleteFile: async (file) => {
      deleted.push(file);
    },
    run: async (plan) => {
      runs.push([...plan]);
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

test("the person's application files and member photo are deleted before the rows are cleared", async () => {
  const files: PersonalFile[] = [
    { store: "private", pathname: "applications/cv.pdf" },
    { store: "public", pathname: "photo/7-a.jpg" },
  ];
  const { store, deleted, runs } = fakeStore([account()], files);
  await anonymizeDeletedAccounts(NOW, store);
  assert.deepEqual(deleted, files);
  assert.ok(runs[0]?.some((step) => step.kind === "delete-application-files"));
});

test("when a file cannot be deleted, the account's rows stay for the next run", async () => {
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
  assert.equal(runs.length, 0);
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

const member: InferSelectModel<typeof members> = {
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
};

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
  customAnswers: [{ question: "Why?", answer: "Rockets" }],
  withdrawnAt: null,
  acceptedAt: "2024-09-20T10:00:00.000Z",
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
    if (step.kind === "clear-applications") assert.deepEqual(Object.keys(step.set).sort(), ["cvName", "mlName"]);
  }
  assert.ok(plan.every((step) => ["clear-user", "clear-member", "clear-applications", "delete-application-files", "scrub-logs"].includes(step.kind)));
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
