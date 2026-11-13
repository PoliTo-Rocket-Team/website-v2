import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { groupPhone } from "../phone";
import { MAX_PDF_BYTES, parseApplicationForm, pdfProblem, setPdfField } from "./application-form";

const asks = { questions: [], requiresMotivationLetter: false };

/** A PDF of exactly `size` bytes: the header, then padding. */
function pdfOf(size: number): File {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
  return new File([bytes], "cv.pdf", { type: "application/pdf" });
}

function formWith(cv: File): FormData {
  const fd = new FormData();
  const fields = {
    firstName: "Giulia",
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
  fd.set("cv", cv);
  return fd;
}

// Issue #953: the phone field groups the digits as the person types.
test("the form takes a grouped phone, and still asks one without + for the country code", () => {
  const withPhone = (phone: string) => {
    const fd = formWith(pdfOf(10));
    fd.set("phone", phone);
    return parseApplicationForm(fd, asks);
  };
  const grouped = withPhone(groupPhone("+393891234567"));
  assert.ok(grouped.ok);
  assert.equal(grouped.fields.phone, "+39 389 123 4567");

  const bare = withPhone(groupPhone("3891234567"));
  assert.ok(!bare.ok);
  assert.equal(bare.errors.phone, "Start with + and the country code.");
});

describe("the PDF size limit", () => {
  test("the schema accepts a PDF of exactly the limit", () => {
    assert.equal(parseApplicationForm(formWith(pdfOf(MAX_PDF_BYTES)), asks).ok, true);
  });

  test("the schema refuses one byte more, with the 2 MB message on the field", () => {
    const result = parseApplicationForm(formWith(pdfOf(MAX_PDF_BYTES + 1)), asks);
    assert.ok(!result.ok);
    assert.equal(result.errors.cv, "The file is over 2 MB.");
  });

  test("a picked file gets the same answer the submit gives", () => {
    assert.equal(pdfProblem(pdfOf(MAX_PDF_BYTES)), null);
    assert.equal(pdfProblem(pdfOf(MAX_PDF_BYTES + 1)), "The file is over 2 MB.");
  });
});

describe("a file sent before (issue #826)", () => {
  const before = { id: 401, name: "cv-old.pdf", size: 1024 };
  const letterAsks = { questions: [], requiresMotivationLetter: true };

  test("the pre-selected file is sent as a reference to the stored file, and the schema takes it", () => {
    const fd = formWith(pdfOf(10));
    setPdfField(fd, "cv", { kind: "previous", file: before });
    setPdfField(fd, "motivationLetter", { kind: "previous", file: { ...before, id: 501 } });
    const result = parseApplicationForm(fd, letterAsks);
    assert.ok(result.ok);
    assert.deepEqual(result.fields.cv, { storedFileId: 401 });
    assert.deepEqual(result.fields.motivationLetter, { storedFileId: 501 });
  });

  test("a new upload replaces the pre-selection, even when a reference travels beside it", () => {
    const upload = pdfOf(10);
    const fd = formWith(upload);
    setPdfField(fd, "cv", { kind: "upload", file: upload });
    fd.set("cvStored", "401");
    const result = parseApplicationForm(fd, asks);
    assert.ok(result.ok);
    assert.ok(result.fields.cv instanceof File);
  });

  test("a reference that names no file id is no document: the field asks for a PDF", () => {
    for (const ref of ["0", "-3", "abc", "1.5", "9999999999", "99999999999"]) {
      const fd = formWith(pdfOf(10));
      setPdfField(fd, "cv", null);
      fd.set("cvStored", ref);
      const result = parseApplicationForm(fd, asks);
      assert.ok(!result.ok, ref);
      assert.equal(result.errors.cv, "Add a PDF.", ref);
    }
  });
});
