import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MAX_PDF_BYTES, parseApplicationForm, pdfProblem } from "./application-form";

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
