import "@/lib/dashboard/access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applicationFiles, applications } from "@/db/schema";
import { IDS, seedFixture } from "@/lib/dashboard/access-matrix/fixture";
import { signInAs } from "@/lib/dashboard/access-matrix/session";
import { changeRows, databaseWrites, tableRows } from "@/lib/dashboard/access-matrix/test-database";
import { databaseWithdrawnFilesStore } from "@/lib/dashboard/database-withdrawn-files";
import { deleteWithdrawnFiles, type WithdrawnFilesStore } from "@/lib/dashboard/withdrawn-files";
import { setPdfField, type PdfPick } from "./application-form";
import { submitDepsOf } from "./data";
import { databaseApplyData } from "./database";
import { submitApplication } from "./submit";

// One applicant's files are stored once (issue #826), on the real database:
// the migrated in-memory Postgres and the file store fake the access matrix
// uses (lib/dashboard/access-matrix/test-database.ts). The fixture's
// applicant in Mission Analysis applied there with a CV and a letter; the
// roles in the two other divisions are open, ask one question and a letter.

const APPLICANT = "applicant-ma";
const OTHER_APPLICANT = "applicant-oa";
const CV = IDS.cvFile("MA");
const LETTER = IDS.letterFile("MA");
const FIRST = IDS.application("MA");
const OA = IDS.position("OA");
const DM = IDS.position("DM");

const pdf = (text: string, name = "cv.pdf") =>
  new File([new TextEncoder().encode(`%PDF-1.7\n${text}\n%%EOF\n`)], name, { type: "application/pdf" });

function form(cv: PdfPick, letter: PdfPick): FormData {
  const fd = new FormData();
  const fields = {
    firstName: "Applicant",
    lastName: "Rossi",
    politoId: "312456",
    phone: "+39 351 234 5678",
    dateOfBirth: "2004-03-14",
    studyProgramme: "Year 1 Master's",
    degreeProgramme: "Aerospace Engineering",
    gender: "Female",
    origin: "Domestic",
    referral: "Instagram",
  };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  fd.append("answers", "Because.");
  setPdfField(fd, "cv", cv);
  setPdfField(fd, "motivationLetter", letter);
  return fd;
}

const previous = (id: number): PdfPick => ({ kind: "previous", file: { id, name: "x.pdf", size: 1 } });
const upload = (file: File): PdfPick => ({ kind: "upload", file });
const send = (positionId: number, fd: FormData) => submitApplication(positionId, fd, submitDepsOf(databaseApplyData));

const fileRows = async () => (await tableRows(applicationFiles)).map((f) => f.id as number);
const uploads = async () => (await databaseWrites()).filter((w) => w.kind === "upload");
async function applicationOn(positionId: number) {
  const row = (await tableRows(applications)).find((a) => a.applyPositionId === positionId && a.userId === APPLICANT);
  assert.ok(row, `an application on position ${positionId}`);
  return row;
}

describe("Stored files are reused, on the real database (issue #826)", () => {
  test("the form is offered the applicant's latest CV and letter, and only their own", async () => {
    await seedFixture();
    assert.deepEqual(await databaseApplyData.previousFiles(APPLICANT), {
      cv: { id: CV, name: "cv-ma.pdf", size: 1 },
      motivationLetter: { id: LETTER, name: "letter-ma.pdf", size: 1 },
    });
    assert.deepEqual(await databaseApplyData.previousFiles("interviewee-ma"), { cv: null, motivationLetter: null });
  });

  test("sending the pre-selected files links the stored rows: no upload and no new file row", async () => {
    await seedFixture();
    signInAs(APPLICANT);
    const before = await fileRows();

    assert.deepEqual(await send(OA, form(previous(CV), previous(LETTER))), { ok: true });

    assert.deepEqual(await fileRows(), before);
    assert.deepEqual(await uploads(), []);
    const second = await applicationOn(OA);
    assert.equal(second.cvFileId, CV);
    assert.equal(second.coverLetterFileId, LETTER);
  });

  test("uploading bytes the applicant already stored links that row, and new bytes replace the pre-selection for that application only", async () => {
    await seedFixture();
    signInAs(APPLICANT);

    assert.deepEqual(await send(OA, form(upload(pdf("my cv")), previous(LETTER))), { ok: true });
    const first = await applicationOn(OA);
    assert.notEqual(first.cvFileId, CV, "a new CV gets its own row");
    assert.equal((await uploads()).length, 1);
    const rowsAfterFirst = await fileRows();

    // The same CV bytes again, under another name: no second copy.
    assert.deepEqual(await send(DM, form(upload(pdf("my cv", "renamed.pdf")), previous(LETTER))), { ok: true });
    const second = await applicationOn(DM);
    assert.equal(second.cvFileId, first.cvFileId);
    assert.equal(second.cvName, "renamed.pdf", "the application keeps the name given this time");
    assert.deepEqual(await fileRows(), rowsAfterFirst);
    assert.equal((await uploads()).length, 1);

    // The earliest application keeps its own CV.
    assert.equal((await tableRows(applications)).find((a) => a.id === FIRST)?.cvFileId, CV);
    assert.deepEqual((await databaseApplyData.previousFiles(APPLICANT)).cv?.id, second.cvFileId, "the latest CV is offered next");
  });

  test("another applicant's file is refused, whether named by id or matched by its bytes", async () => {
    await seedFixture();
    signInAs(OTHER_APPLICANT);
    const before = await fileRows();

    const result = await send(DM, form(previous(CV), previous(LETTER)));
    assert.ok(!result.ok && result.reason === "invalid");
    assert.ok(result.errors.cv && result.errors.motivationLetter);
    assert.deepEqual(await fileRows(), before);
    assert.deepEqual(await databaseWrites(), [], "nothing was written");

    // The same bytes as a file applicant-ma stored are this applicant's own copy.
    signInAs(APPLICANT);
    assert.deepEqual(await send(OA, form(upload(pdf("shared bytes")), previous(LETTER))), { ok: true });
    signInAs(OTHER_APPLICANT);
    assert.deepEqual(await send(DM, form(upload(pdf("shared bytes")), upload(pdf("letter")))), { ok: true });
    const theirs = (await tableRows(applications)).find((a) => a.applyPositionId === DM && a.userId === OTHER_APPLICANT);
    const file = (await tableRows(applicationFiles)).find((f) => f.id === theirs?.cvFileId);
    assert.equal(file?.userId, OTHER_APPLICANT);
  });

  test("a shared file is deleted only once no application still links it", async () => {
    await seedFixture();
    signInAs(APPLICANT);
    assert.deepEqual(await send(OA, form(previous(CV), previous(LETTER))), { ok: true });
    const second = (await applicationOn(OA)).id as number;
    const longAgo = new Date(Date.now() - 40 * 86_400_000).toISOString();

    // The first application is withdrawn and past the 30 days; the second still uses its files.
    await changeRows(applications, { id: FIRST }, { withdrawnAt: longAgo });
    assert.deepEqual(await deleteWithdrawnFiles(new Date(), databaseWithdrawnFilesStore), { deleted: [], failed: [] });
    assert.ok((await fileRows()).includes(CV) && (await fileRows()).includes(LETTER));

    // Once the second is withdrawn as long, the files go, blob and row.
    await changeRows(applications, { id: second }, { withdrawnAt: longAgo });
    const run = await deleteWithdrawnFiles(new Date(), databaseWithdrawnFilesStore);
    assert.deepEqual([...run.deleted].sort(), [CV, LETTER].sort());
    assert.ok(!(await fileRows()).includes(CV) && !(await fileRows()).includes(LETTER));
    const deletedBlobs = (await databaseWrites()).filter((w) => w.kind === "delete-file").map((w) => w.table);
    assert.deepEqual(deletedBlobs.sort(), ["applications/cv-ma.pdf", "applications/letter-ma.pdf"]);
    for (const id of [FIRST, second]) {
      const row = (await tableRows(applications)).find((a) => a.id === id);
      assert.equal(row?.cvFileId, null);
      assert.equal(row?.coverLetterFileId, null);
    }
  });

  test("a file an application links after the cleanup read its holders keeps its row, its blob and the new link", async () => {
    await seedFixture();
    const longAgo = new Date(Date.now() - 40 * 86_400_000).toISOString();
    await changeRows(applications, { id: FIRST }, { withdrawnAt: longAgo });

    // The cleanup reads no other holder; the applicant then sends the stored files to a new position.
    const store: WithdrawnFilesStore = {
      ...databaseWithdrawnFilesStore,
      heldFiles: async (application) => {
        const files = await databaseWithdrawnFilesStore.heldFiles(application);
        assert.ok(files.every((f) => f.otherHolders.length === 0), "no other holder when the cleanup read");
        signInAs(APPLICANT);
        assert.deepEqual(await send(OA, form(previous(CV), previous(LETTER))), { ok: true });
        return files;
      },
    };

    assert.deepEqual(await deleteWithdrawnFiles(new Date(), store), { deleted: [], failed: [] });
    assert.ok((await fileRows()).includes(CV) && (await fileRows()).includes(LETTER));
    assert.deepEqual((await databaseWrites()).filter((w) => w.kind === "delete-file"), []);
    const linked = await applicationOn(OA);
    assert.equal(linked.cvFileId, CV);
    assert.equal(linked.coverLetterFileId, LETTER);
  });
});
