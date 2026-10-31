import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import { aliasRequests, members, teamAddresses } from "@/db/schema";
import { addRows, changeRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { isAnswerAlias, type TeamSideOverview } from "./overview";

// The member's own PRT email on My profile (issue #921), on the migrated
// in-memory Postgres (./access-matrix/test-database.ts): they edit it, checked
// as Request PRT email checks an address and against every address someone
// else holds; and while it is empty they ask for one through the request the
// approvers answer. Both writes show in the activity log.

const MEMBER = "member"; // a plain member, who leads nobody and holds no full access
const OWN = accountOf(MEMBER).memberId!;
const OTHER = IDS.person("DM"); // another member, whose PRT email the tests set

async function dashboardOf(name: string): Promise<DashboardData> {
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  return (opening as { data: DashboardData }).data;
}

const prtEmailOf = async (memberId: number) => (await tableRows(members)).find((m) => m.memberId === memberId)?.prtEmail ?? null;
const openRequestsOf = async (memberId: number) => (await tableRows(aliasRequests)).filter((r) => r.memberId === memberId && r.outcome === null);

/** The sentences the IT lead reads in the activity log. */
async function logSentences(): Promise<string[]> {
  const log = await (await dashboardOf("IT lead")).activityLog();
  return (log?.entries ?? []).flatMap((e) => (e.change.kind === "write" ? [e.change.sentence] : []));
}

describe("a member edits their own PRT email on My profile (issue #921)", () => {
  test("a team-domain address nobody holds saves in lower case, and the activity log shows it", async () => {
    await seedFixture();
    signInAs(accountOf(MEMBER).userId);
    assert.deepEqual(await actions.savePrtEmail(" Viewer.Own@politorocketteam.it "), { ok: true, value: "viewer.own@politorocketteam.it" });
    assert.equal(await prtEmailOf(OWN), "viewer.own@politorocketteam.it");
    const profile = await (await dashboardOf(MEMBER)).myProfile();
    assert.deepEqual(profile?.prtEmail, { kind: "set", address: "viewer.own@politorocketteam.it" });
    assert.ok((await logSentences()).some((s) => s.startsWith("Set the team email of ")), "the log shows the edit");
  });

  test("an address off the team domain, or not firstname.lastname or one word, is refused and writes nothing", async () => {
    await seedFixture();
    signInAs(accountOf(MEMBER).userId);
    const offDomain = await actions.savePrtEmail("viewer.own@gmail.com");
    assert.ok(!offDomain.ok && /must end with @politorocketteam\.it/.test(offDomain.error), JSON.stringify(offDomain));
    const shape = await actions.savePrtEmail("viewer.own.extra@politorocketteam.it");
    assert.ok(!shape.ok && /firstname\.lastname/.test(shape.error), JSON.stringify(shape));
    assert.equal(await prtEmailOf(OWN), null);
  });

  test("another member's PRT email, or a team address, is refused in any letter case", async () => {
    await seedFixture();
    await changeRows(members, { memberId: OTHER }, { prtEmail: "person.dm@politorocketteam.it" });
    await addRows(teamAddresses, [{ address: "logistics@politorocketteam.it", purpose: "Logistics", holderId: OTHER }]);
    signInAs(accountOf(MEMBER).userId);
    const member = await actions.savePrtEmail("Person.DM@politorocketteam.it");
    assert.ok(!member.ok && /already a PRT email/.test(member.error), JSON.stringify(member));
    const team = await actions.savePrtEmail("LOGISTICS@politorocketteam.it");
    assert.ok(!team.ok && /already a PRT email/.test(team.error), JSON.stringify(team));
    assert.equal(await prtEmailOf(OWN), null);
  });

  test("an unchanged PRT email saves whatever its form, and writes nothing", async () => {
    await seedFixture();
    // Stored before the address rule, off its form: an unchanged save never fails on it (the rule of issue #887).
    await changeRows(members, { memberId: OWN }, { prtEmail: "Old_Form@politorocketteam.it" });
    signInAs(accountOf(MEMBER).userId);
    assert.deepEqual(await actions.savePrtEmail("old_form@politorocketteam.it"), { ok: true, value: "Old_Form@politorocketteam.it" });
    assert.equal(await prtEmailOf(OWN), "Old_Form@politorocketteam.it");
  });

  test("a PRT email saved while their request is open closes the request", async () => {
    await seedFixture();
    signInAs(accountOf(MEMBER).userId);
    assert.equal((await actions.requestOwnAlias("viewer.asked@politorocketteam.it")).ok, true);
    assert.equal((await actions.savePrtEmail("viewer.own@politorocketteam.it")).ok, true);
    assert.deepEqual(await openRequestsOf(OWN), [], "no request stays open beside a set PRT email");
    assert.deepEqual((await tableRows(aliasRequests)).filter((r) => r.memberId === OWN).map((r) => r.outcome), ["cancelled"]);
  });
});

describe("a member asks for their own PRT email on My profile (issue #921)", () => {
  test("the request is stored as any other, the approvers see it, My profile reads it as waiting, and the log shows it", async () => {
    await seedFixture();
    const before = await (await dashboardOf(MEMBER)).myProfile();
    assert.equal(before?.prtEmail.kind, "none");
    assert.deepEqual(await actions.requestOwnAlias("Viewer.Asked@politorocketteam.it"), { ok: true, value: null });

    const [stored] = await openRequestsOf(OWN);
    assert.deepEqual([stored?.address, stored?.requestedBy], ["viewer.asked@politorocketteam.it", OWN]);
    assert.deepEqual((await (await dashboardOf(MEMBER)).myProfile())?.prtEmail, { kind: "requested" });

    const overview = (await (await dashboardOf("IT lead")).overview()) as TeamSideOverview;
    const row = overview.attention.find((r) => r.kind === "prt-email-request" && isAnswerAlias(r.action) && r.action.answerAlias === stored!.id);
    assert.ok(row !== undefined, "the IT lead sees it under Needs your attention");
    assert.ok((await logSentences()).some((s) => s.startsWith("Asked for a team email for ")), "the log shows the request");
  });

  test("a second open request is refused, and so is one once their PRT email is set", async () => {
    await seedFixture();
    signInAs(accountOf(MEMBER).userId);
    assert.equal((await actions.requestOwnAlias("viewer.asked@politorocketteam.it")).ok, true);
    const second = await actions.requestOwnAlias("viewer.again@politorocketteam.it");
    assert.ok(!second.ok && /already requested/.test(second.error), JSON.stringify(second));
    assert.equal((await openRequestsOf(OWN)).length, 1);

    await seedFixture();
    await changeRows(members, { memberId: OWN }, { prtEmail: "viewer.own@politorocketteam.it" });
    signInAs(accountOf(MEMBER).userId);
    const set = await actions.requestOwnAlias("viewer.asked@politorocketteam.it");
    assert.ok(!set.ok && /already has a personal PRT email/.test(set.error), JSON.stringify(set));
    assert.deepEqual(await openRequestsOf(OWN), []);
  });
});
