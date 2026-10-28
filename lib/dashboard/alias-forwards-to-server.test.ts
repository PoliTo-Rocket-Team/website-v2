import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { members, users } from "@/db/schema";
import { changeRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { ALL } from "./access-matrix/matrix";
import { signInAs, viewAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { isAnswerAlias, type TeamSideOverview } from "./overview";

// Where the alias forwards to (issue #586): Mark created shows the member's
// sign-in email, their `users.email`, so the approver can copy it into Google
// Workspace. `readAliasAttention` puts it on the row's action, and only the
// three approver seats get alias rows at all. Read through the Overview on the
// migrated in-memory Postgres (./access-matrix/test-database.ts).

const APPROVERS = ["team leader", "operations lead", "IT lead"] as const;
const OTHERS = ["division lead", "department head", "member"] as const;

/** A PRT email on one member, so the test tells it apart from the sign-in email. */
const PRT_EMAIL = "lead.dm@politorocketteam.it";

async function seeded(): Promise<void> {
  await seedFixture();
  await changeRows(members, { memberId: IDS.lead("DM") }, { prtEmail: PRT_EMAIL });
}

async function overviewOf(): Promise<TeamSideOverview> {
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (await (opening as { data: DashboardData }).data.overview()) as TeamSideOverview;
}

/** Each open request's member's sign-in email, by request id, as `users` stores it. */
async function signInEmails(): Promise<Map<number, string>> {
  const rows = await tableRows(users);
  return new Map(
    ALL.map((u) => {
      const email = rows.find((r) => r.member === IDS.lead(u))?.email;
      if (typeof email !== "string" || email === "") throw new Error(`the ${u} lead signs in with no email`);
      return [IDS.aliasRequest(u), email] as const;
    }),
  );
}

describe("Mark created carries the member's sign-in email for the approvers only (issue #586)", () => {
  for (const name of APPROVERS) {
    test(`${name}: every alias row's action carries the member's sign-in email, not their PRT email`, async () => {
      await seeded();
      signInAs(accountOf(name).userId);
      const expected = await signInEmails();
      const actions = (await overviewOf()).attention.flatMap((a) => (a.kind === "prt-email-request" && isAnswerAlias(a.action) ? [a.action] : []));
      assert.equal(actions.length, ALL.length, `${name}: one alias row per open request`);
      for (const action of actions) {
        assert.equal(action.signInEmail, expected.get(action.answerAlias), `${name}: request ${action.answerAlias}`);
        assert.notEqual(action.signInEmail, PRT_EMAIL);
      }
    });
  }

  const viewers = [
    ...OTHERS.map((name) => ({ name, signIn: () => signInAs(accountOf(name).userId) })),
    { name: "team leader viewing as the division lead", signIn: () => viewAs(accountOf("division lead").userId, accountOf("team leader").userId) },
  ];
  for (const { name, signIn } of viewers) {
    test(`${name}: no alias row, and no member's sign-in email, on the Overview`, async () => {
      await seeded();
      signIn();
      const emails = [...(await signInEmails()).values()];
      const overview = await overviewOf();
      assert.deepEqual(
        overview.attention.filter((a) => a.kind === "prt-email-request" && isAnswerAlias(a.action)),
        [],
        `${name}: no alias row`,
      );
      const read = JSON.stringify(overview);
      for (const email of emails) assert.ok(!read.includes(email), `${name}: the Overview holds a member's sign-in email`);
    });
  }
});
