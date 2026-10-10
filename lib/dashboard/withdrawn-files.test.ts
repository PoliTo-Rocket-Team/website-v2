import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deleteWithdrawnFiles,
  dueForFileDeletion,
  fileDeletion,
  withdrawnFilesCutoff,
  type CleanupApplication,
  type HeldFile,
  type WithdrawnFilesStore,
} from "./withdrawn-files";

const NOW = new Date("2026-10-10T03:30:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

function application(overrides: Partial<CleanupApplication> = {}): CleanupApplication {
  return { id: 1, withdrawnAt: daysAgo(31), cvFileId: 10, coverLetterFileId: 11, ...overrides };
}

function file(id: number, overrides: Partial<HeldFile> = {}): HeldFile {
  return { id, pathname: `applications/${id}.pdf`, otherHolders: [], ...overrides };
}

/**
 * A store over fixed applications and file rows: it returns every
 * application, so the rule under test is the domain's own. It keeps the rows
 * and objects it holds, so a test reads what is left after the run, the way
 * the database's `ON DELETE SET NULL` clears an application's file ids.
 */
function fakeStore(applications: CleanupApplication[], files: HeldFile[], failingObjects: string[] = []) {
  const rows = new Map(files.map((f) => [f.id, f]));
  const objects = new Set(files.map((f) => f.pathname));
  const storeCalls: string[] = [];
  const store: WithdrawnFilesStore = {
    withdrawnApplications: async () => applications,
    heldFiles: async (a) =>
      [a.cvFileId, a.coverLetterFileId].flatMap((id) => {
        const row = id === null ? undefined : rows.get(id);
        return row === undefined ? [] : [row];
      }),
    deleteStoredFile: async (pathname) => {
      storeCalls.push(pathname);
      if (failingObjects.includes(pathname)) throw new Error("store unavailable");
      objects.delete(pathname);
    },
    deleteFileRow: async (fileId) => {
      rows.delete(fileId);
    },
  };
  const fileIdsAfter = (a: CleanupApplication) => ({
    cvFileId: a.cvFileId !== null && rows.has(a.cvFileId) ? a.cvFileId : null,
    coverLetterFileId: a.coverLetterFileId !== null && rows.has(a.coverLetterFileId) ? a.coverLetterFileId : null,
  });
  return { store, rows, objects, storeCalls, fileIdsAfter };
}

test("the cutoff is 30 days before now", () => {
  assert.equal(withdrawnFilesCutoff(NOW).getTime(), daysAgo(30).getTime());
});

test("withdrawn 29 days ago is not due", () => {
  assert.equal(dueForFileDeletion(application({ withdrawnAt: daysAgo(29) }), NOW), false);
});

test("withdrawn exactly 30 days ago is due", () => {
  assert.equal(dueForFileDeletion(application({ withdrawnAt: daysAgo(30) }), NOW), true);
});

test("withdrawn 31 days ago is due", () => {
  assert.equal(dueForFileDeletion(application({ withdrawnAt: daysAgo(31) }), NOW), true);
});

test("an application that is not withdrawn is not due", () => {
  assert.equal(dueForFileDeletion(application({ withdrawnAt: null }), NOW), false);
});

test("an application already cleaned, both file ids null, is not due", () => {
  assert.equal(dueForFileDeletion(application({ cvFileId: null, coverLetterFileId: null }), NOW), false);
});

test("an application holding only a CV, or only a letter, is due", () => {
  assert.equal(dueForFileDeletion(application({ coverLetterFileId: null }), NOW), true);
  assert.equal(dueForFileDeletion(application({ cvFileId: null }), NOW), true);
});

test("a due application loses every file it points at: object and row, so both file ids read null", async () => {
  const due = application();
  const { store, rows, objects, fileIdsAfter } = fakeStore([due], [file(10), file(11)]);
  assert.deepEqual(await deleteWithdrawnFiles(NOW, store), { deleted: [10, 11], failed: [] });
  assert.equal(rows.size, 0);
  assert.equal(objects.size, 0);
  assert.deepEqual(fileIdsAfter(due), { cvFileId: null, coverLetterFileId: null });
});

test("the cleanup changes no application: it only deletes files", async () => {
  const due = application();
  const before = structuredClone(due);
  const { store } = fakeStore([due], [file(10), file(11)]);
  await deleteWithdrawnFiles(NOW, store);
  assert.deepEqual(due, before);
});

test("files of the same person's other applications, not withdrawn or withdrawn under 30 days ago, are never deleted", async () => {
  const due = application({ id: 1, withdrawnAt: daysAgo(40), cvFileId: 10, coverLetterFileId: 11 });
  const open = application({ id: 2, withdrawnAt: null, cvFileId: 20, coverLetterFileId: 21 });
  const recent = application({ id: 3, withdrawnAt: daysAgo(29), cvFileId: 30, coverLetterFileId: null });
  const { store, rows, objects, storeCalls } = fakeStore(
    [due, open, recent],
    [file(10), file(11), file(20), file(21), file(30)],
  );
  assert.deepEqual(await deleteWithdrawnFiles(NOW, store), { deleted: [10, 11], failed: [] });
  assert.deepEqual([...rows.keys()], [20, 21, 30]);
  assert.deepEqual([...objects], ["applications/20.pdf", "applications/21.pdf", "applications/30.pdf"]);
  assert.deepEqual(storeCalls, ["applications/10.pdf", "applications/11.pdf"]);
});

test("a row another application still needs is kept", () => {
  assert.deepEqual(fileDeletion(file(10, { otherHolders: [null] }), NOW), { kind: "keep", fileId: 10 });
  assert.deepEqual(fileDeletion(file(10, { otherHolders: [daysAgo(29)] }), NOW), { kind: "keep", fileId: 10 });
  assert.equal(fileDeletion(file(10, { otherHolders: [daysAgo(31)] }), NOW).kind, "store-and-row");
});

test("a store delete that throws keeps that file's row and counts it as failed; the other file still goes", async () => {
  const { store, rows, objects } = fakeStore([application()], [file(10), file(11)], ["applications/10.pdf"]);
  assert.deepEqual(await deleteWithdrawnFiles(NOW, store), { deleted: [11], failed: [10] });
  assert.deepEqual([...rows.keys()], [10]);
  assert.deepEqual([...objects], ["applications/10.pdf"]);
});

test("a stored pathname outside the private store's folders loses its row with no store call", async () => {
  const legacy = file(10, { pathname: "legacy-bucket/cv.pdf" });
  assert.deepEqual(fileDeletion(legacy, NOW), { kind: "row-only", fileId: 10 });
  const { store, rows, storeCalls } = fakeStore([application({ coverLetterFileId: null })], [legacy]);
  assert.deepEqual(await deleteWithdrawnFiles(NOW, store), { deleted: [10], failed: [] });
  assert.equal(rows.size, 0);
  assert.deepEqual(storeCalls, []);
});

test("a failed read of an application's files counts its files as failed", async () => {
  const { store } = fakeStore([application()], []);
  store.heldFiles = async () => {
    throw new Error("database unavailable");
  };
  assert.deepEqual(await deleteWithdrawnFiles(NOW, store), { deleted: [], failed: [10, 11] });
});
