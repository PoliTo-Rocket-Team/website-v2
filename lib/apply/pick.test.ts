import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dummyApplyData, SentApplications } from "@/lib/dummy-data/apply";
import type { ApplyData } from "./data";
import { submitDepsOf } from "./data";
import type { DummyModeEnv } from "@/lib/dummy-data/mode";
import { pickApplyData, type ApplySides } from "./pick";
import { submitApplication } from "./submit";

const PRODUCTION: DummyModeEnv = { NODE_ENV: "production", VERCEL_ENV: "production", DATABASE_URL: "postgres://u@h/db" };
const PRODUCTION_NO_DB: DummyModeEnv = { NODE_ENV: "production", VERCEL_ENV: "production" };
const PREVIEW: DummyModeEnv = { NODE_ENV: "production", VERCEL_ENV: "preview" };

/**
 * A database side that logs every touch under the name of the real call it
 * stands in for: each read goes through getDb(), each file through
 * uploadPrivateFile().
 */
function databaseSpy() {
  const calls: string[] = [];
  const db = (name: string) => async () => {
    calls.push(name);
    throw new Error(`${name} called`);
  };
  const side: ApplyData = {
    publicPositions: db("getDb"),
    position: db("getDb"),
    applicant: db("getDb"),
    hasApplied: db("getDb"),
    store: { putPdf: db("uploadPrivateFile"), deletePdf: db("deletePrivateFile"), save: db("getDb"), newFileName: () => "x" },
  };
  return { calls, side };
}

function sides(database: ApplyData, sent = new SentApplications()) {
  const dummyCalls: unknown[][] = [];
  const s: ApplySides = {
    database: () => database,
    dummy: (viewer, selector) => {
      dummyCalls.push([viewer, selector]);
      return dummyApplyData(viewer, selector, sent);
    },
  };
  return { sides: s, dummyCalls };
}

describe("production picks the database side", () => {
  for (const env of [PRODUCTION, PRODUCTION_NO_DB]) {
    test(`and ignores the viewer cookie and the open selector (${env.DATABASE_URL ? "with" : "no"} database)`, () => {
      const { side } = databaseSpy();
      const { sides: s, dummyCalls } = sides(side);
      assert.equal(pickApplyData({ env, viewerCookie: "non-member", openSelector: "0" }, s), side);
      assert.deepEqual(dummyCalls, []);
    });
  }
});

test("a preview picks the dummy side, with the cookie's viewer and the selector", () => {
  const { side } = databaseSpy();
  const { sides: s, dummyCalls } = sides(side);
  assert.notEqual(pickApplyData({ env: PREVIEW, viewerCookie: "non-member", openSelector: "3" }, s), side);
  assert.notEqual(pickApplyData({ env: PREVIEW, viewerCookie: "not-a-viewer", openSelector: undefined }, s), side);
  assert.deepEqual(dummyCalls, [
    ["non-member", "3"],
    [null, null],
  ]);
});

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

function form(): FormData {
  const fd = new FormData();
  const fields = {
    firstName: "Chiara",
    lastName: "Lombardi",
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
  fd.append("answers", "A parachute for a water rocket.");
  fd.set("cv", new File([PDF], "CV.pdf", { type: "application/pdf" }));
  return fd;
}

test("a preview submit records the application in memory and never reaches the database or the file store", async () => {
  const { side, calls } = databaseSpy();
  const sent = new SentApplications();
  const { sides: s } = sides(side, sent);
  const send = (id: number) =>
    submitApplication(id, form(), submitDepsOf(pickApplyData({ env: PREVIEW, viewerCookie: "non-member", openSelector: null }, s)));

  // Position 3 asks one question and no motivation letter.
  assert.deepEqual(await send(3), { ok: true });
  assert.equal(sent.has("test-developer:non-member", 3), true);
  assert.deepEqual(await send(3), { ok: false, reason: "already-applied" });
  assert.deepEqual(calls, [], "getDb() and uploadPrivateFile() are never called");
});
