import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { submitApplication, type NewApplication, type SubmitDeps, type SubmitPosition } from "./submit";

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const NOT_PDF = new TextEncoder().encode("PK\u0003\u0004 a zip with a .pdf name");

const openPosition: SubmitPosition = {
  id: 7,
  status: true,
  is_deleted: false,
  customQuestions: ["Why safety?"],
  requiresMotivationLetter: true,
};

function form(overrides: { cv?: Uint8Array; letter?: Uint8Array } = {}): FormData {
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
  fd.append("answers", "I ran the lab's waste log.");
  fd.set("cv", new File([overrides.cv ?? PDF], "ROSSI_CV.pdf", { type: "application/pdf" }));
  fd.set("motivationLetter", new File([overrides.letter ?? PDF], "letter.pdf", { type: "application/pdf" }));
  return fd;
}

/** An in-memory file store and database, enforcing one application per user and position as the unique constraint does. */
function fakes(options: { position?: SubmitPosition; recruitmentOpen?: boolean; signedIn?: boolean; saveFails?: boolean } = {}) {
  const files = new Map<string, Uint8Array>();
  const saved: NewApplication[] = [];
  let n = 0;
  const deps: SubmitDeps = {
    applicant: async () => (options.signedIn === false ? null : { id: "user-1", email: "giulia@example.com" }),
    position: async (id) =>
      id === (options.position ?? openPosition).id
        ? { position: options.position ?? openPosition, recruitment: { isOpen: options.recruitmentOpen ?? true } }
        : null,
    hasApplied: async (userId, positionId) => saved.some((a) => a.userId === userId && a.positionId === positionId),
    putPdf: async (key, bytes) => void files.set(key, bytes),
    deletePdf: async (key) => void files.delete(key),
    save: async (application) => {
      if (options.saveFails) throw new Error("batch failed");
      if (saved.some((a) => a.userId === application.userId && a.positionId === application.positionId)) {
        return "already-applied";
      }
      saved.push(application);
      return "saved";
    },
    newFileName: () => `file-${++n}`,
  };
  return { deps, files, saved };
}

describe("submitApplication", () => {
  test("stores the CV and the letter in the private store under applications/, and one application with its file rows", async () => {
    const { deps, files, saved } = fakes();
    assert.deepEqual(await submitApplication(7, form(), deps), { ok: true });

    assert.equal(saved.length, 1);
    const [application] = saved;
    assert.equal(application.userId, "user-1");
    assert.equal(application.positionId, 7);
    assert.deepEqual(application.answers, [{ question: "Why safety?", answer: "I ran the lab's waste log." }]);
    assert.equal(application.cv.filename, "ROSSI_CV.pdf");
    assert.ok(application.motivationLetter);
    assert.deepEqual([...files.keys()].sort(), [application.cv.key, application.motivationLetter.key].sort());
    assert.ok(application.cv.key.startsWith("applications/"));
  });

  test("refuses a second application for the same position, and keeps no new file", async () => {
    const { deps, files, saved } = fakes();
    await submitApplication(7, form(), deps);
    const filesBefore = files.size;

    assert.deepEqual(await submitApplication(7, form(), deps), { ok: false, reason: "already-applied" });
    assert.equal(saved.length, 1);
    assert.equal(files.size, filesBefore);
  });

  test("refuses a second application that races past the first check, and deletes its files", async () => {
    const { deps, files, saved } = fakes();
    deps.hasApplied = async () => false;
    await submitApplication(7, form(), deps);

    assert.deepEqual(await submitApplication(7, form(), deps), { ok: false, reason: "already-applied" });
    assert.equal(saved.length, 1);
    assert.equal(files.size, 2);
  });

  test("refuses a position that is not public: closed, deleted, recruitment off, or missing", async () => {
    const cases = [
      fakes({ position: { ...openPosition, status: false } }),
      fakes({ position: { ...openPosition, is_deleted: true } }),
      fakes({ recruitmentOpen: false }),
    ];
    for (const { deps, files, saved } of cases) {
      assert.deepEqual(await submitApplication(7, form(), deps), { ok: false, reason: "not-public" });
      assert.equal(saved.length, 0);
      assert.equal(files.size, 0);
    }
    assert.deepEqual(await submitApplication(99, form(), fakes().deps), { ok: false, reason: "not-public" });
  });

  test("refuses a file whose bytes are not a PDF, whatever its name and type say", async () => {
    for (const fd of [form({ cv: NOT_PDF }), form({ letter: NOT_PDF })]) {
      const { deps, files, saved } = fakes();
      const result = await submitApplication(7, fd, deps);
      assert.equal(result.ok, false);
      assert.ok(!result.ok && result.reason === "invalid");
      assert.equal(saved.length, 0);
      assert.equal(files.size, 0);
    }
  });

  test("refuses an application with no CV", async () => {
    const { deps, saved } = fakes();
    const fd = form();
    fd.delete("cv");
    const result = await submitApplication(7, fd, deps);
    assert.ok(!result.ok && result.reason === "invalid" && result.errors.cv);
    assert.equal(saved.length, 0);
  });

  test("refuses a signed-out user", async () => {
    const { deps, saved } = fakes({ signedIn: false });
    assert.deepEqual(await submitApplication(7, form(), deps), { ok: false, reason: "signed-out" });
    assert.equal(saved.length, 0);
  });

  test("deletes the uploaded files when the database write fails", async () => {
    const { deps, files } = fakes({ saveFails: true });
    assert.deepEqual(await submitApplication(7, form(), deps), { ok: false, reason: "failed" });
    assert.equal(files.size, 0);
  });
});
