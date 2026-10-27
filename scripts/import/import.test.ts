import "@/lib/dashboard/access-matrix/install";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  alumniEntries,
  alumniImportedRoles,
  applyPositions,
  betterAuthUsers,
  departments,
  divisions,
  faqVersions,
  members,
  orders,
  roles,
  scopes,
  teamLeaves,
  teamPageAdvisorVersions,
  users,
} from "@/db/schema";
import sharp from "sharp";
import type { AdvisorVersion } from "@/lib/about/advisors";
import { alumniOf } from "@/lib/about/alumni-record";
import { ownsTeamPageUpload } from "@/lib/about/team-page-photos";
import { readAlumniRecord } from "@/lib/dashboard/database-alumni";
import { storedPhotoPathname } from "@/lib/dashboard/database-self";
import { checkMemberPhoto } from "@/lib/dashboard/division-members";
import type { PublicFileWrites } from "@/lib/outreach-photos";
import { publicStoreHost } from "@/lib/storage/pathname";
import { myAlumniOf } from "@/lib/dashboard/my-alumni";
import { addRows, databaseWrites, restore, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import type { ConflictKind } from "./conflicts";
import { TABLES } from "./plan";
import { runImport } from "./run";
import type { ImportDb } from "./snapshot";

// The team data import (issue #677) over the fake files in ./fixtures/files,
// on the in-memory Postgres every migration in drizzle/ built
// (lib/dashboard/access-matrix/test-database.ts). Migrations create no
// department or division, so the test lays the units a production database
// already holds, plus the rows a conflict needs: a seated chief engineer, an
// account with no member row, and an imported Alumni entry.

const FILES = join(__dirname, "fixtures", "files");
const db = testDb as unknown as ImportDb;
const PROPULSION = 1;
const STRUCTURES = 2;
const OPERATIONS = 3;
const HYBRID_MOTORS = 2;
const INFORMATION_TECHNOLOGY = 4;
const SEATED = 900;
const OLGA = 901;

async function world(): Promise<void> {
  await restore("team-import-world", async () => {
    await addRows(departments, [
      { id: PROPULSION, name: "Propulsion", code: "PRP" },
      { id: STRUCTURES, name: "Structures", code: "STR" },
      { id: OPERATIONS, name: "Operations", code: "OPS", kind: "operations" },
    ]);
    await addRows(divisions, [
      { id: 1, deptId: PROPULSION, name: "Liquid Systems", code: "LQS" },
      { id: HYBRID_MOTORS, deptId: PROPULSION, name: "Hybrid Motors", code: "HYB" },
      { id: 3, deptId: STRUCTURES, name: "Design and Manufacturing", code: "DAM" },
      { id: INFORMATION_TECHNOLOGY, deptId: OPERATIONS, name: "Information Technology", code: "IT" },
      { id: 5, deptId: OPERATIONS, name: "Communications", code: "COM" },
    ]);
    await addRows(members, [{ memberId: SEATED }, { memberId: OLGA }]);
    await addRows(users, [
      { id: "seated-account", email: "seated.chief@example.com", firstName: "Seated", lastName: "Chief", member: SEATED },
      { id: "olga-account", email: "olga.serra@example.com", firstName: "Olga", lastName: "Serra", member: OLGA },
      { id: "applicant-account", email: "wanda.riva@example.com", firstName: "Wanda", lastName: "Riva" },
    ]);
    await addRows(roles, [{ memberId: SEATED, title: "Chief Engineer", type: "core", fullAccess: "chief_engineer", startedAt: "2025-10-01" }]);
    await addRows(alumniEntries, [{ id: 9000, kind: "imported", recordName: "Paolo Lombardi" }]);
    await addRows(alumniImportedRoles, [{ entryId: 9000, year: 2023, groupName: "Propulsion", role: "Test Engineer", position: 1 }]);
  });
}

const importOnce = () => runImport({ mode: "import", directory: FILES, db });

async function userNamed(first: string, last: string) {
  const row = (await tableRows(users)).find((u) => u.firstName === first && u.lastName === last);
  return row as (typeof users.$inferSelect) | undefined;
}

async function rolesOf(memberId: number) {
  return ((await tableRows(roles)) as (typeof roles.$inferSelect)[]).filter((r) => r.memberId === memberId);
}

const kinds = (list: readonly { kind: ConflictKind }[]) => new Set(list.map((c) => c.kind));

test("a dry run reports every planted conflict and unclear quitter, and writes nothing", async () => {
  await world();
  const before = await Promise.all([users, members, roles, teamLeaves, departments, divisions, orders].map((t) => tableRows(t)));
  const { plan, report } = await runImport({ mode: "dry-run", directory: FILES, db });
  assert.deepEqual(await databaseWrites(), []);
  assert.deepEqual(await Promise.all([users, members, roles, teamLeaves, departments, divisions, orders].map((t) => tableRows(t))), before);

  for (const kind of [
    "duplicate",
    "ambiguous-match",
    "missing-email",
    "account-without-member",
    "unknown-title",
    "seat-taken",
    "csv-disagrees",
    "imported-alumni-match",
    "schema-misfit",
    "unresolved-requester",
    "project-only-unit",
    "quitter-on-current-sheet",
  ] as const) {
    assert.ok(kinds(plan.conflicts).has(kind), `the plan reports ${kind}`);
    assert.match(report, new RegExp(`\\[${kind}\\] `), `the report lists ${kind}`);
  }
  // Three seat clashes this year: a second head of Propulsion, a second team leader, and the chief engineer the database already seats.
  assert.deepEqual(
    plan.conflicts.filter((c) => c.kind === "seat-taken").map((c) => `${c.at.sheet} ${c.at.row}`),
    ["2025-2026 6", "2025-2026 7", "2025-2026 16"],
  );
  // Ugo Sala, on Quitters only with the day he left, is an alumnus (issue #816).
  assert.equal(plan.alumni, 4);
  assert.equal(plan.multiYear, 4);
  assert.equal(plan.unclearQuitters, 1);
  for (const table of TABLES) assert.match(report, new RegExp(`^${table} +\\d+ +\\d+ +\\d+$`, "m"), `the report counts ${table}`);
  assert.match(report, /^Alumni: 4$/m);
  assert.match(report, /^People found in more than one year sheet: 4$/m);
  assert.match(report, /^Unclear quitters: 1$/m);
  assert.match(report, /roster\.xlsx › sheet 2025-2026 › row 9 › field title/);
  // "Underwater Basket Weaving" and "Avionics Legacy" are on the current sheet: units to create, open (issue #816), so none is unresolved.
  assert.equal(plan.unresolvedUnits, 0);
  assert.match(report, /^Distinct unresolved unit names \(subteam and division cells\): 0$/m);
  // The old open positions are not imported at all (issue #820): the file is listed as left out, and raises no conflict.
  assert.ok(!plan.conflicts.some((c) => c.at.file === "positions_rows.csv"));
  assert.match(report, /^Skipped:\n(?: {2}.*\n)* {2}positions_rows\.csv: not imported \(owner decision\); recruitment creates new positions$/m);
});

test("a dry run given no database says the units were not checked", async () => {
  const { plan, report } = await runImport({ mode: "dry-run", directory: FILES });
  assert.equal(plan.unresolvedUnits, null);
  assert.match(report, /^Distinct unresolved unit names \(subteam and division cells\): not checked \(no database given\)$/m);
});

test("the report prints no personal value from the sources", async () => {
  await world();
  const { report } = await runImport({ mode: "dry-run", directory: FILES, db });
  const values = new Set<string>();
  for (const file of readdirSync(FILES).filter((f) => f.endsWith(".csv"))) {
    for (const cell of readFileSync(join(FILES, file), "utf8").split(/[,\n]/)) if (/@|^[A-Z][a-z]+$/.test(cell.trim())) values.add(cell.trim());
  }
  for (const name of ["Alice", "Marino", "Sara", "Testa", "Giulia", "Russo", "Ugo", "Sala", "Wanda", "Riva", "s900001", "+39 000 0000001", "alice.marino@example.com"]) values.add(name);
  for (const value of values) assert.ok(!report.includes(value), `the report leaves out a source value`);
});

test("an import inserts the planned rows once, and a second run inserts none and finds them present", async () => {
  await world();
  const first = await importOnce();
  assert.ok(first.written !== undefined);
  for (const table of TABLES) assert.equal(first.written[table], first.plan.counts[table].insert, `${table} inserted as planned`);
  assert.deepEqual(
    { users: first.written.users, roles: first.written.roles, team_leaves: first.written.team_leaves },
    { users: 21, roles: 25, team_leaves: 4 },
  );
  assert.ok((await databaseWrites()).every((w) => w.kind === "insert"), "every write is an insert");

  const second = await importOnce();
  for (const table of TABLES) {
    assert.equal(second.written?.[table], 0, `${table}: nothing inserted the second time`);
    assert.equal(second.plan.counts[table].present, first.plan.counts[table].present + first.plan.counts[table].insert, `${table}: all present`);
  }
  assert.match(second.report, /^users +0 +22 +2$/m);
});

test("the import creates only the current sheet's units the database lacks, open, and changes no existing row", async () => {
  await world();
  const before = {
    departments: await tableRows(departments),
    divisions: await tableRows(divisions),
    seated: await rolesOf(SEATED),
    applicant: (await tableRows(users)).find((u) => u.id === "applicant-account"),
    imported: [await tableRows(alumniEntries), await tableRows(alumniImportedRoles)],
  };
  await importOnce();
  const afterDepartments = await tableRows(departments);
  const afterDivisions = await tableRows(divisions);
  assert.deepEqual(afterDepartments.slice(0, before.departments.length), before.departments);
  assert.deepEqual(afterDivisions.slice(0, before.divisions.length), before.divisions);
  assert.deepEqual(
    afterDepartments.slice(before.departments.length).map((d) => [d.name, d.startedAt, d.closedAt]),
    [["Avionics Legacy", "2025-10-01", null]],
  );
  assert.deepEqual(
    afterDivisions.slice(before.divisions.length).map((d) => [d.name, d.deptId, d.startedAt, d.closedAt]),
    [["Underwater Basket Weaving", PROPULSION, "2025-10-01", null]],
  );
  assert.deepEqual(await rolesOf(SEATED), before.seated);
  assert.deepEqual((await tableRows(users)).find((u) => u.id === "applicant-account"), before.applicant);
  assert.deepEqual([await tableRows(alumniEntries), await tableRows(alumniImportedRoles)], before.imported);
  assert.ok((await databaseWrites()).every((w) => w.kind === "insert"));
});

test("a person in two years under different email columns is one user and member, with a role per year", async () => {
  await world();
  await importOnce();
  const alice = await userNamed("Alice", "Marino");
  assert.ok(alice?.member != null);
  assert.equal(alice.email, "alice.marino@example.com");
  assert.equal(alice.linkedin, "https://www.linkedin.com/in/alice-marino-example");
  assert.equal(await userNamed("Alice", "M. Marino"), undefined, "the 2024 spelling is the same person");
  const [member] = (await tableRows(members)).filter((m) => m.memberId === alice.member);
  assert.equal(member.prtEmail, "alice.marino@team.example.com");
  const held = (await rolesOf(alice.member)).map((r) => [r.title, r.type, r.startedAt, r.leavedAt]);
  assert.deepEqual(held, [
    ["Valve Engineer", "core", "2024-10-01", "2025-09-30"],
    ["Team Leader", "president", "2025-10-01", null],
  ]);
});

test("two past holders of one seat in one year are both inserted, as ended roles", async () => {
  await world();
  await importOnce();
  const heads = ((await tableRows(roles)) as (typeof roles.$inferSelect)[]).filter((r) => r.title === "Head of Structures");
  assert.equal(heads.length, 2);
  for (const h of heads) assert.deepEqual([h.type, h.deptId, h.startedAt, h.leavedAt], ["head", STRUCTURES, "2024-10-01", "2025-09-30"]);
});

test("an alumnus has their years, a team leave, ended roles only and no access, and the Alumni record lists them", async () => {
  await world();
  await importOnce();
  const sara = await userNamed("Sara", "Testa");
  assert.ok(sara?.member != null);
  const [member] = (await tableRows(members)).filter((m) => m.memberId === sara.member);
  assert.deepEqual([member.teamFrom, member.teamTo], [2023, 2024]);
  const leaves = (await tableRows(teamLeaves)).filter((l) => l.memberId === sara.member);
  assert.equal(leaves.length, 1);
  assert.match(String(leaves[0].leftAt), /^2025-07-15/);
  assert.equal(leaves[0].reason, null);
  const held = await rolesOf(sara.member);
  assert.deepEqual(
    held.map((r) => [r.title, r.type, r.divisionId, r.startedAt, r.leavedAt]),
    [
      ["Grain Engineer", "core", HYBRID_MOTORS, "2023-10-01", "2024-09-30"],
      ["Hybrid Motors Lead", "lead", HYBRID_MOTORS, "2024-10-01", "2025-09-30"],
    ],
  );
  assert.equal((await tableRows(scopes)).filter((s) => s.memberId === sara.member).length, 0);

  const alumnus = alumniOf(await readAlumniRecord(), 2025).find((a) => a.key === `m${sara.member}`);
  assert.ok(alumnus !== undefined, "the Alumni record lists her");
  assert.equal(alumnus.onTeam, false);
  assert.deepEqual([...new Set(alumnus.lines.map((l) => l.year))], [2023, 2024]);
  const mine = myAlumniOf(alumnus);
  assert.deepEqual(
    mine.history.map((h) => [h.year, h.role]),
    [
      ["2024 – 25", "Hybrid Motors Lead"],
      ["2023 – 24", "Grain Engineer"],
    ],
  );

  const tommaso = await userNamed("Tommaso", "Neri");
  const [left] = (await tableRows(teamLeaves)).filter((l) => l.memberId === tommaso?.member);
  assert.match(String(left.leftAt), /^2025-09-30/, "no Quitters day: the last year's end");
});

test("a quitter on the current sheet imports as an active member; one in no year sheet is an alumnus of the year they left in", async () => {
  await world();
  await importOnce();
  const giulia = await userNamed("Giulia", "Russo");
  assert.ok(giulia?.member != null);
  assert.deepEqual(
    (await rolesOf(giulia.member)).map((r) => [r.title, r.leavedAt]),
    [["Structural Analyst", null]],
  );
  assert.equal((await tableRows(teamLeaves)).filter((l) => l.memberId === giulia.member).length, 0);
  const ugo = await userNamed("Ugo", "Sala");
  assert.ok(ugo?.member != null);
  assert.deepEqual(
    (await rolesOf(ugo.member)).map((r) => [r.title, r.type, r.deptId, r.startedAt, r.leavedAt]),
    [["Engineer", "core", STRUCTURES, "2023-10-01", "2024-03-01"]],
  );
  const [member] = (await tableRows(members)).filter((m) => m.memberId === ugo.member);
  assert.deepEqual([member.teamFrom, member.teamTo], [2023, 2023]);
  assert.deepEqual((await tableRows(teamLeaves)).filter((l) => l.memberId === ugo.member).map((l) => String(l.leftAt).slice(0, 10)), ["2024-03-01"]);
});

test("a person matching an imported Alumni entry gets no role for a year that entry lists", async () => {
  await world();
  await importOnce();
  const paolo = await userNamed("Paolo", "Lombardi");
  assert.ok(paolo?.member != null);
  assert.deepEqual(
    (await rolesOf(paolo.member)).map((r) => r.startedAt).sort(),
    ["2024-10-01", "2025-10-01"],
  );
});

test("a seat conflict this year refuses that role only; the run goes on", async () => {
  await world();
  const { written } = await importOnce();
  assert.ok(written !== undefined && written.roles > 0);
  const active = ((await tableRows(roles)) as (typeof roles.$inferSelect)[]).filter((r) => r.leavedAt === null);
  assert.equal(active.filter((r) => r.type === "president").length, 1);
  assert.equal(active.filter((r) => r.type === "head" && r.deptId === PROPULSION).length, 1);
  assert.deepEqual(active.filter((r) => r.fullAccess === "chief_engineer").map((r) => r.memberId), [SEATED]);
  assert.deepEqual(active.filter((r) => r.fullAccess === "it_lead").map((r) => [r.title, r.divisionId]), [["IT Lead", INFORMATION_TECHNOLOGY]]);
  for (const [first, last] of [["Elena", "Greco"], ["Zeno", "Fabbri"], ["Fabio", "Ricci"]]) {
    const person = await userNamed(first, last);
    assert.ok(person?.member != null, `${first} is imported`);
    assert.deepEqual(await rolesOf(person.member), [], `${first}'s clashing seat is not`);
  }
});

test("CSV rows fill gaps only, advisors, FAQs and orders land where they resolve, and no position is imported", async () => {
  await world();
  await importOnce();
  const marta = await userNamed("Marta", "Villa");
  assert.equal(marta?.program, "Physics", "the workbook wins");
  assert.equal(marta?.linkedin, "https://www.linkedin.com/in/marta-villa-example", "the CSV fills a gap");
  const dario = await userNamed("Dario", "Gallo");
  assert.equal(dario?.program, "Computer Engineering");

  const advisorNames = (await tableRows(teamPageAdvisorVersions)).map((v) => (v.advisor as { name: string }).name);
  assert.ok(advisorNames.includes("Prof. Ada Example") && advisorNames.includes("Sam Specialist"));
  assert.equal(advisorNames.filter((n) => n === "Sam Specialist").length, 1);

  assert.deepEqual(await tableRows(applyPositions), [], "positions_rows.csv is not imported (issue #820)");

  const faq = (await tableRows(faqVersions)).find((v) => v.question === "Can I join while on exchange?");
  assert.deepEqual(faq?.answer, ["Yes, if you can work remotely.", "Tell us in your application."]);
  assert.equal(faq?.version, "published");

  const placed = await tableRows(orders);
  assert.deepEqual(
    placed.map((o) => [o.requester, o.status, o.divisionId, o.quantity, o.name]),
    [[dario?.member, "accepted", INFORMATION_TECHNOLOGY, 2, "Router"]],
  );
});

test("an imported person's first Google sign-in lands on their imported user row and member", async () => {
  await world();
  await importOnce();
  const before = await userNamed("Sara", "Testa");
  assert.ok(before !== undefined && before.id.startsWith("imported:"));
  // Better Auth creates the account on the first Google sign-in; the sync_auth_users trigger (drizzle/0001) links it by email.
  await testDb.insert(betterAuthUsers).values({ id: "google-account-sara", name: "Sara Testa", email: before.email, emailVerified: true });
  const after = (await tableRows(users)).filter((u) => u.email === before.email);
  assert.equal(after.length, 1, "no second users row");
  assert.equal(after[0].id, "google-account-sara");
  assert.equal(after[0].member, before.member);
});

test("a multi-seat title cell gives one role per seat, read through codes, projects, N/A and advisor markers", async () => {
  await world();
  const { plan } = await importOnce();
  assert.ok(plan.conflicts.some((c) => c.kind === "project-only-unit" && c.at.sheet === "2025-2026"));

  const rita = await userNamed("Rita", "Longo");
  assert.ok(rita?.member != null);
  assert.deepEqual(
    (await rolesOf(rita.member)).map((r) => [r.title, r.type, r.fullAccess, r.deptId, r.divisionId, r.leavedAt]).sort(),
    [
      ["Design and Manufacturing Division Lead Engineer (acting)", "lead", null, STRUCTURES, 3, null],
      ["Head of Department", "head", null, STRUCTURES, null, null],
    ],
  );

  const sofia = await userNamed("Sofia", "Marchi");
  assert.ok(sofia?.member != null);
  assert.deepEqual(
    (await rolesOf(sofia.member)).map((r) => [r.title, r.type, r.deptId, r.divisionId]),
    [["Senior Advisor", "advisor", null, null]],
  );

  const ettore = await userNamed("Ettore", "Bassi");
  assert.ok(ettore?.member != null, "Ettore is imported");
  assert.deepEqual(await rolesOf(ettore.member), [], "Ettore's subteam names only a project");

  // Pietro's "Avionics Legacy" is on the current sheet and in no unit: it is created open, and each seat sits in both departments.
  const pietro = await userNamed("Pietro", "Rinaldi");
  assert.ok(pietro?.member != null, "Pietro is imported");
  const legacy = (await tableRows(departments)).find((d) => d.name === "Avionics Legacy")?.id;
  assert.deepEqual(
    (await rolesOf(pietro.member)).map((r) => [r.title, r.deptId]).sort(),
    [
      ["Recruitment Coordinator", OPERATIONS],
      ["Recruitment Coordinator", legacy],
      ["Social Media Manager", OPERATIONS],
      ["Social Media Manager", legacy],
    ].sort(),
  );
});

// Photos -----------------------------------------------------------------------

const HOST = publicStoreHost("store_FakeImportStore1");

/** A public store that keeps nothing and answers the URL the Blob SDK would. */
function fakeStore() {
  const uploads: { pathname: string; bytes: Uint8Array; contentType: string }[] = [];
  const writes: PublicFileWrites = {
    async upload(pathname, bytes, contentType) {
      uploads.push({ pathname, bytes, contentType });
      return { url: `https://${HOST}/${pathname}` };
    },
    async remove() {
      throw new Error("the import never deletes a file");
    },
  };
  return { uploads, store: { host: HOST, writes } };
}

async function memberOf(first: string, last: string) {
  const user = await userNamed(first, last);
  assert.ok(user?.member != null, `${first} is imported`);
  return ((await tableRows(members)) as (typeof members.$inferSelect)[]).find((m) => m.memberId === user.member)!;
}

test("the report counts each photo outcome, by row, and a dry run uploads nothing", async () => {
  await world();
  // A dry run takes no photo store (RunOptions), so it has nothing to upload with.
  const { plan, report } = await runImport({ mode: "dry-run", directory: FILES, db });
  assert.deepEqual(await databaseWrites(), []);
  assert.deepEqual(plan.photos, {
    found: 9,
    matchedMembers: 4,
    matchedAdvisors: 1,
    surnameDiffers: 2,
    noIdMatch: 1,
    noSurnameMatch: 1,
    surnameAmbiguous: 0,
    alreadyPresent: 1,
    notImported: 0,
    unfit: 0,
    missing: 2,
    toUpload: 4,
  });
  const photoRows = (kind: ConflictKind) => plan.conflicts.filter((c) => c.kind === kind).map((c) => `${c.at.file} ${c.at.row}`);
  assert.deepEqual(photoRows("photo-surname-differs"), ["photos/ 2", "photos/ 5"]);
  assert.deepEqual(photoRows("photo-no-id-match"), ["photos/ 6"]);
  assert.deepEqual(photoRows("photo-no-surname-match"), ["photos/ 9"]);
  assert.deepEqual(photoRows("photo-missing"), ["advisors_rows.csv 5", "people_rows.csv 5"]);
  for (const line of [
    "found: 9",
    "matched to members: 4",
    "matched to advisors: 1",
    "id found, surname differs (held): 2",
    "id on no people_rows.csv row: 1",
    "surname only, no advisor has it: 1",
    "surname only, more than one advisor has it: 0",
    "skipped, person or advisor already in the database: 1",
    "has_pp with no file: 2",
    "to upload: 4",
  ]) {
    assert.ok(report.includes(`  ${line}\n`), `the report says ${line}`);
  }
  for (const name of readdirSync(join(FILES, "photos"))) {
    assert.ok(!report.includes(name) && !report.includes(name.replace(/^\d+-|\.jpeg$/g, "")), "no photo file name or surname in the report");
  }
});

test("an import stores member photos as the dashboard does and advisor photos as the Team page editor does", async () => {
  await world();
  const { uploads, store } = fakeStore();
  const { uploaded, report } = await runImport({ mode: "import", directory: FILES, db, photoStore: store });
  assert.deepEqual(uploaded, { members: 3, advisors: 1, skipped: 0 });
  assert.equal(uploads.length, 4);
  assert.match(report, /^ {2}uploaded: 4$/m);
  assert.ok((await databaseWrites()).every((w) => w.kind === "insert"), "a photo goes in with its row; no row is updated");

  // Dario's id (30) is also an advisor row's id: an id is always a people_rows.csv id (issue #816).
  // Sofia's file is a surname only: the one advisor with it is her advisor row in the workbook.
  for (const [first, last] of [["Marta", "Villa"], ["Dario", "Gallo"], ["Sofia", "Marchi"]]) {
    const member = await memberOf(first, last);
    assert.ok(member.picture !== null, `${first} has a picture`);
    const pathname = storedPhotoPathname(member.picture);
    assert.ok(pathname !== null && pathname.startsWith(`photos/${member.memberId}-`) && pathname.endsWith(".jpg"), "the dashboard's pathname, which it can replace or remove");
    const upload = uploads.find((u) => u.pathname === pathname);
    assert.ok(upload !== undefined);
    assert.equal(upload.contentType, "image/jpeg");
    assert.equal(checkMemberPhoto({ type: upload.contentType, size: upload.bytes.byteLength }), null);
    const { width, height, format } = await sharp(upload.bytes).metadata();
    assert.deepEqual([format, width === height, width! <= 800], ["jpeg", true, true], "a centred square JPEG of at most 800 px");
  }
  // Marta's file is 40 × 24: the square is its centred 24 × 24.
  const marta = await memberOf("Marta", "Villa");
  const martaUpload = uploads.find((u) => u.pathname === storedPhotoPathname(marta.picture));
  assert.deepEqual([(await sharp(martaUpload!.bytes).metadata()).width], [24]);

  const ada = (await tableRows(teamPageAdvisorVersions)).map((v) => v.advisor as AdvisorVersion).find((a) => a.name === "Prof. Ada Example");
  assert.ok(ada?.photo !== undefined && ownsTeamPageUpload(HOST)(ada.photo), "the advisor's photo, matched by her surname, is a Team page upload");
  const uploadedAdvisorPhotos = (await tableRows(teamPageAdvisorVersions)).flatMap((v) => (v.advisor as AdvisorVersion).photo ?? []).filter(ownsTeamPageUpload(HOST));
  assert.equal(uploadedAdvisorPhotos.length, 1, "only the matched advisor's photo is uploaded");

  for (const [first, last] of [["Bruno", "Conti"], ["Paolo", "Lombardi"], ["Carla", "Ferri"]]) {
    assert.equal((await memberOf(first, last)).picture, null, `${first}: no photo matched`);
  }
  assert.equal((await tableRows(members)).find((m) => m.memberId === OLGA)?.picture, null, "a member already there is not updated");
});

test("a second import uploads nothing, and an import without a storage credential skips the photos only", async () => {
  await world();
  const { uploads, store } = fakeStore();
  await runImport({ mode: "import", directory: FILES, db, photoStore: store });
  const firstUploads = uploads.length;
  const second = await runImport({ mode: "import", directory: FILES, db, photoStore: store });
  assert.equal(uploads.length, firstUploads, "nothing new uploaded");
  assert.deepEqual(second.uploaded, { members: 0, advisors: 0, skipped: 0 });
  assert.equal(second.plan.photos?.alreadyPresent, 5, "every matched photo's person or advisor is already there");

  await world();
  const bare = await importOnce();
  assert.deepEqual(bare.uploaded, { members: 0, advisors: 0, skipped: 4 });
  assert.match(bare.report, /^ {2}skipped, no storage credential given: 4$/m);
  assert.equal((await memberOf("Marta", "Villa")).picture, null);
  assert.equal(bare.written?.members, 21, "everything else is imported");
});
