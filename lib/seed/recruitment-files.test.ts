import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APPLICANT_CV_FILE_ID,
  APPLICANT_SEAT,
  APPLICATION,
  APPLICATION_FILE_ROWS,
  APPLICATION_ROWS,
  SAMPLE_FILE_ID,
  SEED_APPLICANT_CV,
  SEED_DOCUMENTS,
  SEED_SAMPLE_DOCUMENT,
} from "../../db/seed/recruitment";
import { parsePrivatePathname } from "../storage/pathname";

// The seeded application files (issues #406, #833): one unowned shared sample,
// and one CV the applicant plain seat owns and sends with one application.

const files = APPLICATION_FILE_ROWS.rows;
const fileById = (id: number) => files.find((f) => f.id === id);

test("the applicant seat owns one stored CV at its own private pathname", () => {
  const own = fileById(APPLICANT_CV_FILE_ID);
  assert.ok(own);
  assert.equal(own.userId, APPLICANT_SEAT);
  assert.equal(own.pathname, SEED_APPLICANT_CV.pathname);
  assert.notEqual(own.pathname, SEED_SAMPLE_DOCUMENT.pathname);
  assert.notEqual(parsePrivatePathname(own.pathname), null);
  assert.equal(own.mimeType, "application/pdf");
  assert.equal(own.fileSize, SEED_APPLICANT_CV.bytes.length);
});

test("exactly one of the seat's applications sends its own CV; every other document is the shared sample", () => {
  const seatApplications: readonly number[] = [APPLICATION.applicantSeatTimesOffered, APPLICATION.applicantSeatNew];
  const sending = APPLICATION_ROWS.rows.filter((a) => a.cvFileId === APPLICANT_CV_FILE_ID);
  assert.equal(sending.length, 1);
  assert.ok(seatApplications.includes(sending[0]!.id!));
  assert.equal(sending[0]!.userId, APPLICANT_SEAT);
  for (const a of APPLICATION_ROWS.rows) {
    assert.equal(a.coverLetterFileId, SAMPLE_FILE_ID, `application ${a.id} motivation letter`);
    if (a !== sending[0]) assert.equal(a.cvFileId, SAMPLE_FILE_ID, `application ${a.id} CV`);
  }
});

test("the shared sample stays unowned, and no other seeded file names an owner", () => {
  const sample = fileById(SAMPLE_FILE_ID);
  assert.ok(sample);
  assert.equal(sample.pathname, SEED_SAMPLE_DOCUMENT.pathname);
  assert.equal(sample.userId, null);
  const owned = files.filter((f) => f.userId != null).map((f) => f.id);
  assert.deepEqual(owned, [APPLICANT_CV_FILE_ID]);
});

test("the preview build stores every seeded file's document, each at its row's pathname", () => {
  assert.deepEqual(
    SEED_DOCUMENTS.map((d) => d.pathname).sort(),
    files.map((f) => f.pathname).sort(),
  );
});
