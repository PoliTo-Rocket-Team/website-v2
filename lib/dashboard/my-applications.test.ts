import assert from "node:assert/strict";
import { test } from "node:test";
import { withdrawnOnDelete, type OwnApplication } from "./my-applications";

const application = (overrides: Partial<OwnApplication> & Pick<OwnApplication, "id">): OwnApplication => ({
  status: "received",
  withdrawnAt: null,
  cvFileId: null,
  coverLetterFileId: null,
  ...overrides,
});

test("Delete account withdraws only the open applications and deletes only their files", () => {
  const result = withdrawnOnDelete([
    application({ id: 1, status: "received", cvFileId: 10, coverLetterFileId: 11 }),
    application({ id: 2, status: "interview", cvFileId: 20 }),
    application({ id: 3, status: "rejected", cvFileId: 30, coverLetterFileId: 31 }),
    application({ id: 4, status: "accepted", cvFileId: 40 }),
    application({ id: 5, status: "pending", withdrawnAt: "2026-01-01T00:00:00Z", cvFileId: 50 }),
  ]);
  assert.deepEqual(result.applicationIds, [1, 2]);
  assert.deepEqual(result.fileIds, [10, 11, 20]);
});

test("a file another application still uses stays", () => {
  const result = withdrawnOnDelete([
    application({ id: 1, status: "received", cvFileId: 10 }),
    application({ id: 2, status: "joined", cvFileId: 10 }),
  ]);
  assert.deepEqual(result.applicationIds, [1]);
  assert.deepEqual(result.fileIds, []);
});

test("with no open application, nothing is withdrawn or deleted", () => {
  assert.deepEqual(withdrawnOnDelete([application({ id: 3, status: "rejected", cvFileId: 30 })]), { applicationIds: [], fileIds: [] });
});
