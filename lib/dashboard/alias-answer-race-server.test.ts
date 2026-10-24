import "./access-matrix/install";

import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { sql } from "drizzle-orm";
import * as actions from "@/app/dashboard/actions";
import { aliasRequests, dashboardNotices, members } from "@/db/schema";
import { changeRows, tableRows, testDb } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";

// An answer whose save fails while a newer request lands (issue #547).
// Decline and Mark created close the request first and then save the rest
// in one batch; when that batch fails the request is opened again. Two
// test-only triggers stand in for the two things that happen at once: one
// makes the notice insert fail, the other stores a newer open request for
// the same member the moment the claim lands. Both run on the migrated
// in-memory Postgres (./access-matrix/test-database.ts), so the
// `alias_requests_one_open` index refuses as it does on the server.

const DM = "DM";
const REQUEST = IDS.aliasRequest(DM);
const MEMBER = IDS.lead(DM); // the member the fixture's open request is for
const APPROVER = accountOf("operations lead").userId;
const REQUESTER = accountOf("team leader").memberId!; // so the answer tells someone, and the batch has a notice to fail
const NEWER = { id: 547, createdAt: "2026-10-25T10:00:00.000Z", requestedBy: accountOf("team leader").memberId! };
const ADDRESS = "lead.dm@politorocketteam.it";

/** The newer open request exactly as the race trigger stores it. */
const NEWER_ROW = {
  id: NEWER.id,
  memberId: MEMBER,
  requestedBy: NEWER.requestedBy,
  requestedByActingAccount: null,
  createdAt: NEWER.createdAt,
  outcome: null,
  answeredBy: null,
  answeredByActingAccount: null,
  answeredAt: null,
};

/** Runs test-only DDL, one statement at a time. */
async function run(...statements: readonly string[]): Promise<void> {
  for (const statement of statements) await testDb.execute(sql.raw(statement));
}

/** The notice insert fails, so the answer's batch fails after the claim. */
const failNotices = () =>
  run(
    `create function test_journal.fail_notice() returns trigger language plpgsql as $$
     begin raise exception 'test: the notice insert fails'; end $$`,
    `create trigger test_fail_notice before insert on public.dashboard_notices for each row execute function test_journal.fail_notice()`,
  );

/** A newer open request for the member is stored the moment the claim lands. */
const newerRequestOnClaim = () =>
  run(
    `create function test_journal.newer_request() returns trigger language plpgsql as $$
     begin
       insert into public.alias_requests (id, member_id, requested_by, created_at)
       values (${NEWER.id}, new.member_id, ${NEWER.requestedBy}, '${NEWER.createdAt}');
       return null;
     end $$`,
    `create trigger test_newer_request after update on public.alias_requests for each row
     when (old.outcome is null and new.outcome is not null) execute function test_journal.newer_request()`,
  );

afterEach(() =>
  run(
    `drop trigger if exists test_fail_notice on public.dashboard_notices`,
    `drop trigger if exists test_newer_request on public.alias_requests`,
    `drop function if exists test_journal.fail_notice()`,
    `drop function if exists test_journal.newer_request()`,
  ),
);

async function seeded(): Promise<void> {
  await seedFixture();
  await changeRows(aliasRequests, { id: REQUEST }, { requestedBy: REQUESTER });
  signInAs(APPROVER);
}

const memberRequests = async () => (await tableRows(aliasRequests)).filter((r) => r.memberId === MEMBER);
const prtEmailOf = async (memberId: number) => (await tableRows(members)).find((r) => r.memberId === memberId)?.prtEmail ?? null;
const noticesAbout = async (memberId: number) => (await tableRows(dashboardNotices)).filter((r) => r.subjectId === memberId);

const ANSWERS = [
  { name: "Mark created", answer: { kind: "created", address: ADDRESS } },
  { name: "Decline", answer: { kind: "decline" } },
] as const;

describe("an answer whose save fails while a newer request for the member lands (issue #547)", () => {
  for (const { name, answer } of ANSWERS) {
    test(`${name}: refused, not thrown; the newer request stays open as it was, and nothing of the answer is kept`, async () => {
      await seeded();
      const prtEmailBefore = await prtEmailOf(MEMBER);
      const noticesBefore = await noticesAbout(MEMBER);
      await failNotices();
      await newerRequestOnClaim();

      const result = await actions.answerAlias(REQUEST, answer);

      assert.equal(result.ok, false, JSON.stringify(result));
      const error = (result as { error: string }).error;
      assert.match(error, /not saved/i, "says the answer was not saved");
      assert.match(error, /newer alias request for this member is open/i, "says a newer request is open");

      const rows = await memberRequests();
      const newer = rows.find((r) => r.id === NEWER.id);
      assert.ok(newer !== undefined, "the newer request is kept");
      // The database answers the time in its own zone; compare the instant.
      assert.deepEqual({ ...newer, createdAt: new Date(String(newer.createdAt)).toISOString() }, NEWER_ROW, "the newer request is open, its row unchanged");
      assert.deepEqual(
        rows.filter((r) => r.outcome === "created" || r.outcome === "declined"),
        [],
        "no request keeps an outcome from the failed answer",
      );
      assert.equal(rows.filter((r) => r.outcome === null).length, 1, "one open request: the newer one");
      assert.equal(await prtEmailOf(MEMBER), prtEmailBefore, "the PRT email holds nothing from the answer");
      assert.deepEqual(await noticesAbout(MEMBER), noticesBefore, "no notice from the answer");
    });
  }
});

describe("an answer whose save fails with no newer request (issue #547)", () => {
  for (const { name, answer } of ANSWERS) {
    test(`${name}: the request is open again and the batch's error is thrown`, async () => {
      await seeded();
      await failNotices();

      await assert.rejects(() => actions.answerAlias(REQUEST, answer), (error: unknown) => {
        for (let e = error; e instanceof Error; e = e.cause) if (/the notice insert fails/.test(e.message)) return true;
        return false;
      });

      const [request] = (await memberRequests()).filter((r) => r.id === REQUEST);
      assert.deepEqual(
        { outcome: request.outcome, answeredBy: request.answeredBy, answeredByActingAccount: request.answeredByActingAccount, answeredAt: request.answeredAt },
        { outcome: null, answeredBy: null, answeredByActingAccount: null, answeredAt: null },
        "the request is open again",
      );
      assert.equal((await memberRequests()).length, 1, "no other request for the member");
    });
  }
});
