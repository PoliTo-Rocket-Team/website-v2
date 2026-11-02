import "./access-matrix/install";

import assert from "node:assert/strict";
import { beforeEach, test, type TestContext } from "node:test";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { GET as legacyGET } from "@/app/(legacy)/docs/applications/[r2key]/[filename]/route";
import {
  alumniEntries,
  applicationFiles,
  applications,
  betterAuthUsers,
  members,
  orders,
  outreachPostVersions,
  partnerVersions,
  projectVersions,
  teamPageAdvisorVersions,
  teamPageLayerVersions,
  users,
} from "@/db/schema";
import { advisorRowsOf } from "@/lib/about/advisors";
import { NO_TEAM_LAYER } from "@/lib/about/team-layer";
import { snapshot, type TeamLayout } from "@/lib/about/team-layout";
import type { PersonPhoto } from "@/lib/about/types";
import { CHANGED_SINCE_READ } from "@/lib/content/editor";
import { versionRows } from "@/lib/content/versioned";
import { referencedPublicFiles } from "@/lib/storage/public-references";
import type { PublicPathname } from "@/lib/storage/pathname";
import { anonymizeDeletedAccounts } from "./anonymize";
import type { DashboardData } from "./data";
import { databaseAnonymizationStore } from "./database-anonymize";
import { writeOverExpected } from "./database-guarded-write";
import { databaseProjectStore } from "./database-projects";
import { openDashboard } from "./open";
import { queryTeamSnapshot, teamRolesOf } from "./team-snapshot";
import { accountOf, cvHash, cvPathname, IDS, seedFixture } from "./access-matrix/fixture";
import { publicUrlOf, resetPublicFiles } from "./access-matrix/fakes/public-store";
import { signInAs } from "./access-matrix/session";
import { addRows, changeRows, databaseWrites, tableRows, testDb } from "./access-matrix/test-database";

// File deletes never take a file another row still names (issue #831), on
// the access matrix's migrated in-memory Postgres
// (./access-matrix/test-database.ts). The file stores are the fakes beside
// it: each upload, copy and delete is noted in the write journal, so a test
// reads which files a call deleted.

// A file one test deleted is stored again for the next.
beforeEach(resetPublicFiles);

const MA = "MA" as const;
const DAY = 86_400_000;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PDF = new Uint8Array(Buffer.from("%PDF-1.7 a quote"));
const photoUpload = (bytes: Uint8Array = JPEG, contentType = "image/jpeg") => ({ name: "photo.jpg", contentType, bytes });
const quoteUpload = (bytes: Uint8Array = PDF) => ({ name: "quote.pdf", contentType: "application/pdf", bytes });
const ORDER = { item: "Bolts", link: "https://example.com/bolts", price: "1", quantity: "1", reason: "Needed", division: String(IDS.division(MA)) };

async function dataAs(name: string): Promise<DashboardData> {
  signInAs(name.startsWith("applicant-") ? name : accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  return (opening as { data: DashboardData }).data;
}

/** The pathnames the journal shows a file store's call `kind` on, in order. */
async function filesWritten(kind: string): Promise<string[]> {
  return (await databaseWrites()).filter((w) => w.kind === kind).map((w) => w.table);
}

const MEMBER = accountOf("member").memberId!;
const MEMBER_FILE = `photos/${MEMBER}-old.jpg`;

/** The member's own picture is a file in the public store. */
async function memberWithPicture(): Promise<void> {
  await changeRows(members, { memberId: MEMBER }, { picture: publicUrlOf(MEMBER_FILE) });
}

// Which rows name a file -------------------------------------------------------

test("the reference read finds a file named in each column that may hold one, and no other", async () => {
  await seedFixture();
  const named = (column: string) => `photos/${column}.jpg`;
  await changeRows(members, { memberId: MEMBER }, { picture: publicUrlOf(named("member")) });
  await addRows(alumniEntries, [{ kind: "advisor", recordName: "Ada", advisorRole: "Advisor", advisorFrom: 2022, advisorTo: 2023, photo: publicUrlOf(named("alumni")) }]);
  await addRows(teamPageLayerVersions, [{ version: "draft", layer: { ...NO_TEAM_LAYER, leader: { photo: publicUrlOf(named("layer")) } } }]);
  const [advisor] = await tableRows(teamPageAdvisorVersions);
  await changeRows(teamPageAdvisorVersions, { id: advisor.id }, { advisor: { ...(advisor.advisor as object), photo: publicUrlOf(named("advisor")) } });
  const [post] = await tableRows(outreachPostVersions);
  await changeRows(outreachPostVersions, { id: post.id }, { photos: [{ src: publicUrlOf(named("post")), alt: "" }] });
  const [project] = await tableRows(projectVersions);
  await changeRows(projectVersions, { id: project.id }, { page: { ...(project.page as object), extra: publicUrlOf(named("project")) } });
  const [partner] = await tableRows(partnerVersions);
  await changeRows(partnerVersions, { id: partner.id }, { logoUrl: publicUrlOf(named("partner")) });

  const columns = ["member", "alumni", "layer", "advisor", "post", "project", "partner"];
  const asked = [...columns.map(named), "photos/nobody.jpg"] as PublicPathname[];
  const referenced = await referencedPublicFiles(getDb(), asked);
  assert.deepEqual(referenced.rows.map((r) => r.pathname).sort(), columns.map(named).sort());
});

// A member's photo picked for another row is copied (Owner decision) ----------

test("the Team page keeps a copy of a member's picture, and replacing that picture leaves the copy", async () => {
  await seedFixture();
  await memberWithPicture();
  const leader = await dataAs("team leader");
  const rows = advisorRowsOf((await leader.teamAdvisors.list()) ?? []);
  const opened = await leader.teamPage.open();
  assert.ok(opened);
  const { layout, text } = opened.content;
  const showing: TeamLayout = { ...layout, leader: { ...layout.leader!, overrides: { photo: publicUrlOf(MEMBER_FILE) as PersonPhoto } } };
  const saved = await leader.teamPage.save("publish", { layout: showing, text }, rows);
  assert.ok(saved.ok, JSON.stringify(saved));
  const [copy] = await filesWritten("copy-public");
  assert.match(copy, /^photos\/team-page-/, "the copy has a Team page name of its own");
  const leaderPhoto = (row: Record<string, unknown>) => (row.layout as TeamLayout).leader?.overrides.photo;
  const [layoutRow] = await tableRows(teamPageLayerVersions);
  assert.equal(leaderPhoto(layoutRow), publicUrlOf(copy), "the layout names the copy, not the member's file");

  const member = await dataAs("member");
  assert.ok((await member.setPhoto(photoUpload())).ok);
  assert.deepEqual(await filesWritten("delete-public"), [MEMBER_FILE], "the member's old file goes, and only it");
  const [after] = await tableRows(teamPageLayerVersions);
  assert.equal(leaderPhoto(after), publicUrlOf(copy), "the Team page still shows its copy");
});

test("End advising gives the Alumni entry a copy of the advisor's photo, and the member's file stays", async () => {
  await seedFixture();
  await memberWithPicture();
  const [advisor] = await tableRows(teamPageAdvisorVersions);
  await changeRows(teamPageAdvisorVersions, { advisorId: advisor.advisorId }, { advisor: { ...(advisor.advisor as object), photo: publicUrlOf(MEMBER_FILE) } });
  const leader = await dataAs("team leader");
  const ended = await leader.teamAdvisors.end(Number(advisor.advisorId), { from: 2022, to: 2023 });
  assert.ok(ended.ok, JSON.stringify(ended));
  const [copy] = await filesWritten("copy-public");
  assert.match(copy, /^photos\/alumni-/);
  const entry = (await tableRows(alumniEntries)).find((e) => e.kind === "advisor" && e.photo === publicUrlOf(copy));
  assert.ok(entry, "the entry names the copy");
  assert.deepEqual(await filesWritten("delete-public"), [], "the member still shows their own file");
});

// A delete re-checks every row ---------------------------------------------------

test("a member replacing a picture an older Team page version still shows keeps the file", async () => {
  await seedFixture();
  await memberWithPicture();
  // A layer saved before copies existed names the member's file itself.
  await addRows(teamPageLayerVersions, [{ version: "published", layer: { ...NO_TEAM_LAYER, leader: { photo: publicUrlOf(MEMBER_FILE) } } }]);
  const member = await dataAs("member");
  assert.ok((await member.setPhoto(photoUpload())).ok);
  assert.deepEqual(await filesWritten("delete-public"), [], "the Team page still shows it");
});

test("a photo only a stored Team page layout shows keeps its file, and the reference read finds it there (issue #850)", async () => {
  await seedFixture();
  await memberWithPicture();
  const layout = snapshot(teamRolesOf(await queryTeamSnapshot(testDb)), NO_TEAM_LAYER).layout;
  const showing = (pathname: string): TeamLayout => ({ ...layout, leader: { ...layout.leader!, overrides: { photo: publicUrlOf(pathname) as PersonPhoto } } });
  await addRows(teamPageLayerVersions, [
    { version: "published", layer: NO_TEAM_LAYER, layout: showing(MEMBER_FILE) },
    { version: "draft", layer: NO_TEAM_LAYER, layout: showing("photos/layout-only.jpg") },
  ]);
  const referenced = await referencedPublicFiles(getDb(), ["photos/layout-only.jpg", "photos/nobody.jpg"] as PublicPathname[]);
  assert.deepEqual(referenced.rows.map((r) => r.pathname), ["photos/layout-only.jpg"]);
  const member = await dataAs("member");
  assert.ok((await member.setPhoto(photoUpload())).ok);
  assert.deepEqual(await filesWritten("delete-public"), [], "the stored layout still shows it");
});

test("an Alumni photo change keeps a file a member row still names", async () => {
  await seedFixture();
  await memberWithPicture();
  await addRows(alumniEntries, [{ id: 900, kind: "advisor", recordName: "Ada", advisorRole: "Advisor", advisorFrom: 2022, advisorTo: 2023, photo: publicUrlOf(MEMBER_FILE) }]);
  const editor = await dataAs("member with a Content grant");
  assert.ok(editor.teamWrites !== null, "they reach the Alumni page's writes");
  assert.ok((await editor.teamWrites.setAlumnusPhoto("e900", photoUpload())).ok);
  assert.deepEqual(await filesWritten("delete-public"), [], "the member's own picture stays");
});

// Uploads are typed by their bytes ------------------------------------------------

test("a photo or a quote whose bytes are not what it claims is refused, and nothing is stored", async () => {
  await seedFixture();
  const member = await dataAs("member");
  const html = new TextEncoder().encode("<html>");
  assert.deepEqual(await member.setPhoto(photoUpload(html, "image/png")), { ok: false, error: "The photo must be a JPEG or PNG." });
  const leader = await dataAs("team leader");
  assert.deepEqual(await leader.placeOrder(ORDER, quoteUpload(html)), { ok: false, error: "The quote must be a PDF." });
  assert.deepEqual(await filesWritten("upload-public"), []);
  assert.deepEqual(await filesWritten("upload"), []);
});

// Order quotes ---------------------------------------------------------------------

/** Makes the next batch run `before` first, or fail in its place. */
function aroundNextBatch(t: TestContext, around: { before?: () => Promise<void>; fail?: true; afterwards?: () => void }) {
  const batch = testDb.batch;
  let used = false;
  t.mock.method(testDb, "batch", async (queries: readonly PromiseLike<unknown>[]) => {
    if (used) return batch(queries);
    used = true;
    await around.before?.();
    if (around.fail) throw new Error("the database is down");
    const results = await batch(queries);
    around.afterwards?.();
    return results;
  });
}

test("placeOrder keeps the quote of an order that is in, even when reading it back fails", async (t) => {
  await seedFixture();
  const leader = await dataAs("team leader");
  let placed = false;
  aroundNextBatch(t, { afterwards: () => void (placed = true) });
  const select = testDb.select.bind(testDb);
  t.mock.method(testDb, "select", (...args: Parameters<typeof testDb.select>) => {
    if (placed) throw new Error("the read-back failed");
    return select(...args);
  });
  await assert.rejects(leader.placeOrder(ORDER, quoteUpload()), /read-back failed/);
  t.mock.restoreAll();
  const [quote] = await filesWritten("upload");
  assert.ok((await tableRows(orders)).some((o) => o.quoteName === quote), "the order is in and names the quote");
  assert.deepEqual(await filesWritten("delete-file"), [], "its quote stays");
});

test("placeOrder deletes the quote when the insert itself fails", async (t) => {
  await seedFixture();
  const leader = await dataAs("team leader");
  aroundNextBatch(t, { fail: true });
  await assert.rejects(leader.placeOrder(ORDER, quoteUpload()), /database is down/);
  const [quote] = await filesWritten("upload");
  assert.deepEqual(await filesWritten("delete-file"), [quote]);
});

test("editing an order with a new quote deletes the old quote once the edit is in", async () => {
  await seedFixture();
  await changeRows(orders, { id: IDS.order(MA) }, { quoteName: "orders/old-quote.pdf" });
  const leader = await dataAs("team leader");
  const edited = await leader.editOrder(IDS.order(MA), ORDER, quoteUpload());
  assert.ok(edited.ok, JSON.stringify(edited));
  const [order] = (await tableRows(orders)).filter((o) => o.id === IDS.order(MA));
  const [quote] = await filesWritten("upload");
  assert.equal(order.quoteName, quote);
  assert.deepEqual(await filesWritten("delete-file"), ["orders/old-quote.pdf"]);
});

test("editing an order with no new quote keeps its quote", async () => {
  await seedFixture();
  await changeRows(orders, { id: IDS.order(MA) }, { quoteName: "orders/old-quote.pdf" });
  const leader = await dataAs("team leader");
  assert.ok((await leader.editOrder(IDS.order(MA), ORDER, null)).ok);
  assert.deepEqual(await filesWritten("delete-file"), []);
});

// Delete account (Owner decision) ----------------------------------------------------

test("Delete account withdraws an application accepted between its read and its write, with the files it deletes", async (t) => {
  await seedFixture();
  const applicant = await dataAs("applicant-ma");
  // A lead accepts the application while Delete account is on its way.
  aroundNextBatch(t, { before: () => changeRows(applications, { id: IDS.application(MA) }, { status: "accepted", statusKey: "accepted_email_sent" }) });
  assert.ok((await applicant.deleteAccount({ withdrawOpenApplications: true, removeFromAlumni: false })).ok);
  const [application] = (await tableRows(applications)).filter((a) => a.id === IDS.application(MA));
  assert.equal(application.statusKey, "withdrawn", "withdrawn, whatever status it reached");
  assert.notEqual(application.withdrawnAt, null);
  assert.deepEqual((await tableRows(applicationFiles)).filter((f) => f.userId === "applicant-ma"), []);
  assert.deepEqual((await filesWritten("delete-file")).sort(), [cvPathname(MA), "applications/letter-ma.pdf"].sort());
});

/** A second application of applicant-ma on the same CV, withdrawn at `withdrawnAt`, or not withdrawn when null. */
const secondApplication = (withdrawnAt: string | null) => ({
  id: 990,
  applyPositionId: IDS.position("OA"),
  userId: "applicant-ma",
  cvFileId: IDS.cvFile(MA),
  appliedAt: new Date().toISOString(),
  status: "received" as const,
  statusKey: withdrawnAt === null ? "new" : "withdrawn",
  withdrawnAt,
});

test("Delete account withdraws an application sent while it is on its way too, and deletes the files only the applications it withdrew use", async (t) => {
  await seedFixture();
  const applicant = await dataAs("applicant-ma");
  aroundNextBatch(t, { before: () => addRows(applications, [secondApplication(null)]) });
  assert.ok((await applicant.deleteAccount({ withdrawOpenApplications: true, removeFromAlumni: false })).ok);
  const mine = (await tableRows(applications)).filter((a) => a.userId === "applicant-ma");
  assert.ok(mine.some((a) => a.id === 990));
  for (const a of mine) assert.ok(a.statusKey === "withdrawn" && a.withdrawnAt !== null, `application ${a.id} is withdrawn`);
  assert.deepEqual((await filesWritten("delete-file")).sort(), [cvPathname(MA), "applications/letter-ma.pdf"].sort());
});

test("Delete account keeps a file an application withdrawn before still uses", async () => {
  await seedFixture();
  await addRows(applications, [secondApplication("2026-01-01T00:00:00.000Z")]);
  const applicant = await dataAs("applicant-ma");
  assert.ok((await applicant.deleteAccount({ withdrawOpenApplications: true, removeFromAlumni: false })).ok);
  assert.deepEqual(await filesWritten("delete-file"), ["applications/letter-ma.pdf"], "the CV stays with the application withdrawn before");
  assert.ok((await tableRows(applicationFiles)).some((f) => f.id === IDS.cvFile(MA)));
});

// Anonymization ------------------------------------------------------------------------

const YEARS_AGO = new Date(Date.now() - 400 * DAY).toISOString();

/** The member's account, deleted more than a year ago, with their own picture. */
async function deletedMember(): Promise<string> {
  await memberWithPicture();
  const userId = accountOf("member").userId;
  await changeRows(users, { id: userId }, { deletedAt: YEARS_AGO });
  return userId;
}

test("someone who signs in again while the run is on keeps their data and their files", async () => {
  await seedFixture();
  const userId = await deletedMember();
  const run = await anonymizeDeletedAccounts(new Date(), {
    ...databaseAnonymizationStore,
    async personalFiles(account) {
      const files = await databaseAnonymizationStore.personalFiles(account);
      if (account.userId === userId) await addRows(betterAuthUsers, [{ id: userId, name: "Back", email: `${userId}@team.test`, emailVerified: true }]);
      return files;
    },
  });
  assert.ok(!run.anonymized.includes(userId));
  const [user] = (await tableRows(users)).filter((u) => u.id === userId);
  assert.equal(user.anonymizedAt, null);
  assert.deepEqual(await filesWritten("delete-public"), []);
});

test("anonymization locks the person's row before its guard reads it, so a sign-in waits for the run or the guard sees it", async (t) => {
  await seedFixture();
  const userId = await deletedMember();
  // Run in the batch right after its first statement: whether this
  // transaction holds the row lock a sign-in's users sync (drizzle/0001) waits on.
  const lockedHere = sql`select ${users.id} as "id", xmax = pg_current_xact_id()::xid as "locked" from ${users} where ${users.id} = ${userId}`;
  let seen: unknown;
  const batch = testDb.batch;
  t.mock.method(testDb, "batch", async (queries: readonly PromiseLike<unknown>[]) => {
    const results = await batch([queries[0], testDb.execute(lockedHere), ...queries.slice(1)]);
    seen = results[1];
    return [results[0], ...results.slice(2)];
  });
  const run = await anonymizeDeletedAccounts(new Date(), databaseAnonymizationStore);
  t.mock.restoreAll();
  assert.ok(run.anonymized.includes(userId));
  assert.deepEqual((seen as { rows: unknown[] }).rows, [{ id: userId, locked: true }]);
});

test("anonymization keeps a photo another row still names", async () => {
  await seedFixture();
  const userId = await deletedMember();
  await addRows(teamPageLayerVersions, [{ version: "published", layer: { ...NO_TEAM_LAYER, leader: { photo: publicUrlOf(MEMBER_FILE) } } }]);
  const run = await anonymizeDeletedAccounts(new Date(), databaseAnonymizationStore);
  assert.ok(run.anonymized.includes(userId));
  assert.deepEqual(await filesWritten("delete-public"), [], "the Team page still shows it");
});

test("anonymization deletes a photo no other row names", async () => {
  await seedFixture();
  const userId = await deletedMember();
  const run = await anonymizeDeletedAccounts(new Date(), databaseAnonymizationStore);
  assert.ok(run.anonymized.includes(userId));
  assert.deepEqual(await filesWritten("delete-public"), [MEMBER_FILE]);
});

// The legacy file route ----------------------------------------------------------------

test("the legacy file route is never cached, names the PDF type with nosniff, and escapes the file name", async () => {
  await seedFixture();
  signInAs("applicant-ma");
  const name = 'cv "final"\r\n.pdf';
  const response = await legacyGET(new NextRequest(`https://site.test/docs/applications/${cvHash(MA)}/x.pdf?download=true`), {
    params: Promise.resolve({ r2key: cvHash(MA), filename: name }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control") ?? "", /\bno-store\b/);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(response.headers.get("Content-Disposition"), `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
});

// A stale content save ---------------------------------------------------------------------

test("a content write is refused when another write replaced the item's rows after it read them", async () => {
  await seedFixture();
  signInAs(accountOf("team leader").userId);
  const [item] = await databaseProjectStore.list();
  const theirs = (await tableRows(projectVersions)).filter((row) => row.projectId === item.id);
  const landed = await writeOverExpected(
    { table: projectVersions, id: projectVersions.id, where: eq(projectVersions.projectId, item.id) },
    async () => {
      // Another save lands between this write's read of the rows and its batch.
      assert.ok((await databaseProjectStore.update(item.id, item.version, item.version)).ok);
      return item;
    },
    item.version,
    (db) => [db.delete(projectVersions).where(eq(projectVersions.projectId, item.id))],
  );
  assert.deepEqual(landed, { ok: false, error: CHANGED_SINCE_READ });
  const stored = (await tableRows(projectVersions)).filter((row) => row.projectId === item.id);
  assert.equal(stored.length, theirs.length, "the refused write deleted nothing: the other save's rows stand");
  assert.notDeepEqual(stored.map((r) => r.id), theirs.map((r) => r.id), "they are the other save's new rows");
});

test("a content write holds its table's guard lock from before its guard to its last write, and lets go at commit", async () => {
  await seedFixture();
  signInAs(accountOf("team leader").userId);
  const [item] = await databaseProjectStore.list();
  // Two overlapping saves of one item: the second one's guard waits on this
  // lock until the first commits, then reads the first one's new rows.
  const held = sql`select count(*)::int as "held" from pg_locks where locktype = 'advisory' and granted`;
  const landed = await writeOverExpected(
    { table: projectVersions, id: projectVersions.id, where: eq(projectVersions.projectId, item.id) },
    async () => item,
    item.version,
    (db) => [db.execute(held)],
  );
  assert.ok(landed.ok, JSON.stringify(landed));
  assert.deepEqual((landed.value.results[0] as { rows: unknown[] }).rows, [{ held: 1 }], "held while the writes run");
  assert.deepEqual((await testDb.execute(held)).rows, [{ held: 0 }], "let go at commit");
});

test("a project save made on a version the store no longer holds is refused before any write", async () => {
  await seedFixture();
  signInAs(accountOf("team leader").userId);
  const [item] = await databaseProjectStore.list();
  const record = versionRows(item.version)[0].content;
  const stale = { state: "draft", draft: { ...record, name: `${record.name} (old)` } } as const;
  assert.deepEqual(await databaseProjectStore.update(item.id, item.version, stale), { ok: false, error: CHANGED_SINCE_READ });
  assert.deepEqual(await databaseWrites(), []);
});
