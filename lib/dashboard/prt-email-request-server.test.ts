import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import { aliasRequests, members, teamAddresses } from "@/db/schema";
import { addRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { isAnswerAlias, type AnswerAlias, type TeamSideOverview } from "./overview";

// Request PRT email's Personal choice (issue #798) on the migrated in-memory
// Postgres (./access-matrix/test-database.ts): the requester confirms an
// address, edited from the name prefill; the request stores it; the
// approver's row and Mark created start from it; and Mark created saves it as
// the member's PRT email. A request the site made stores none and still
// starts from the name.

const MEMBER = IDS.person("MA"); // "Person MA", whose PRT email is empty
const EDITED = "p.ma@politorocketteam.it";

async function overviewOf(viewer: string): Promise<TeamSideOverview> {
  signInAs(accountOf(viewer).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (await (opening as { data: DashboardData }).data.overview()) as TeamSideOverview;
}

/** The approver's personal request rows, by the request's member. */
async function personalRowsOf(viewer: string): Promise<{ detail: string; action: AnswerAlias }[]> {
  const rows = (await overviewOf(viewer)).attention;
  return rows.flatMap((r) => (r.kind === "prt-email-request" && isAnswerAlias(r.action) ? [{ detail: r.detail, action: r.action }] : []));
}

test("a personal request with an edited address is stored with it, and Mark created starts from it and saves it as the PRT email", async () => {
  await seedFixture();
  signInAs(accountOf("team leader").userId);
  assert.deepEqual(await actions.requestAlias({ memberId: MEMBER, address: " P.MA@politorocketteam.it " }), { ok: true, value: null });

  const stored = (await tableRows(aliasRequests)).filter((r) => r.memberId === MEMBER);
  assert.deepEqual(
    stored.map((r) => [r.address, r.requestedBy, r.outcome]),
    [[EDITED, accountOf("team leader").memberId, null]],
  );

  const row = (await personalRowsOf("operations lead")).find((r) => r.action.answerAlias === stored[0]!.id);
  assert.ok(row !== undefined, "the approver sees the request");
  assert.equal(row.action.prefill, EDITED, "Mark created starts from the address asked for");
  assert.match(row.detail, /^Personal · p\.ma@politorocketteam\.it · from /);
  assert.equal(row.action.signInEmail, "person-ma@mail.test", "and shows the sign-in email it forwards to");

  assert.deepEqual(await actions.answerAlias(row.action.answerAlias, { kind: "created", address: row.action.prefill }), { ok: true, value: null });
  assert.equal((await tableRows(members)).find((r) => r.memberId === MEMBER)?.prtEmail, EDITED);
});

test("a request the site made stores no address, and Mark created starts from the member's name", async () => {
  await seedFixture();
  const automatic = (await tableRows(aliasRequests)).find((r) => r.id === IDS.aliasRequest("MA"));
  assert.equal(automatic?.address, null);
  const row = (await personalRowsOf("IT lead")).find((r) => r.action.answerAlias === IDS.aliasRequest("MA"));
  assert.equal(row?.action.prefill, "lead.ma@politorocketteam.it");
});

test("a personal request with an address off the domain, or one already held, is refused and stores nothing", async () => {
  await seedFixture();
  await addRows(teamAddresses, [{ address: "logistics@politorocketteam.it", purpose: "Logistics", holderId: IDS.person("DM") }]);
  signInAs(accountOf("team leader").userId);
  const before = await tableRows(aliasRequests);
  const offDomain = await actions.requestAlias({ memberId: MEMBER, address: "p.ma@gmail.com" });
  assert.ok(!offDomain.ok && /must end with @politorocketteam\.it/.test(offDomain.error), JSON.stringify(offDomain));
  const held = await actions.requestAlias({ memberId: MEMBER, address: "Logistics@politorocketteam.it" });
  assert.ok(!held.ok && /already a PRT email/.test(held.error), JSON.stringify(held));
  assert.deepEqual(await tableRows(aliasRequests), before);
});
