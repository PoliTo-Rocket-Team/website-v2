import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import { applications, applyPositions, scopes } from "@/db/schema";
import { maySiteContent } from "@/lib/content/gate";
import { DashboardRefused, type DashboardData } from "./data";
import { addRows, databaseWrites, tableRows } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { ALL, UNITS, VIEWERS } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";
import { openDashboard } from "./open";
import { isOffTeam } from "./viewer";

// Dashboard rules the removed in-memory copy (lib/dummy-data/, issue #613)
// was the only one to test, now run on the database path: every loader and
// action called for real, as a matrix viewer, against the migrated in-memory
// Postgres of the access tests (./access-matrix/test-database.ts), seeded by
// ./access-matrix/fixture.ts.

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

/** Signs in as `name` (a matrix viewer, or a fixture user id) and opens their dashboard on a freshly seeded database. */
async function open(name: string): Promise<DashboardData> {
  await seedFixture();
  return reopen(name);
}

/** Opens `name`'s dashboard on the database as it is now. */
async function reopen(name: string): Promise<DashboardData> {
  signInAs(VIEWERS.some((v) => v.name === name) ? accountOf(name).userId : name);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  return (opening as { data: DashboardData }).data;
}

async function refused(call: () => Promise<unknown>): Promise<boolean> {
  try {
    const answer = await call();
    return answer === null || (typeof answer === "object" && answer !== null && "ok" in answer && answer.ok === false);
  } catch (error) {
    if (error instanceof DashboardRefused) return true;
    throw error;
  }
}

describe("a viewer out of a page's reach gets none of its data", () => {
  for (const { name, expect } of VIEWERS) {
    test(name, async () => {
      const data = await open(name);
      const offTeam = isOffTeam(data.viewer.kind);
      assert.equal((await data.alumni()).rows.length === 0, !expect.pages.includes("alumni"), "Alumni rows");
      assert.equal(await refused(() => data.overview()), offTeam, "the team's Overview");
      const content = await Promise.all([
        data.partners.list(),
        data.faqs.list(),
        data.teamPage.open(),
        data.teamAdvisors.list(),
        data.outreach.posts.list(),
        data.outreach.tags(),
        data.projects.board(),
        data.projects.list(),
      ]);
      assert.equal(maySiteContent(data.viewer), expect.siteContent);
      for (const [i, read] of content.entries()) assert.equal(read === null, !expect.siteContent, `content read ${i}`);
      assert.equal((await data.myAlumni()) === null, data.viewer.kind !== "alumni", "My alumni");
      assert.equal((await data.myProfile()) === null, offTeam, "My profile");
      assert.equal((await data.myAccount()) === null, !offTeam, "My account");
      if (offTeam) assert.ok(!JSON.stringify(await data.teamTree()).includes("Lead MA"), "off the team, the tree names nobody");
    });
  }
});

describe("New position offers the divisions where the viewer changes Positions", () => {
  for (const { name, expect } of VIEWERS) {
    if (!expect.pages.includes("positions")) continue;
    test(name, async () => {
      const data = await open(name);
      const offered = (await data.positions()).newPosition.divisions.map((d) => d.id);
      const units = new Set<number>(ALL.map((u) => UNITS[u].divisionId));
      const changes = expect.changes.positions.map((u) => UNITS[u].divisionId).sort();
      assert.deepEqual(offered.filter((id) => units.has(id)).sort(), changes, "the matrix's divisions offered are the ones changed");
      // The fixture's spare divisions sit in Structures beside DM: offered only to a viewer changing Positions there.
      if (offered.some((id) => !units.has(id))) assert.ok(expect.changes.positions.includes("DM"), "a spare division offered to a viewer who changes nothing in Structures");
    });
  }
});

describe("the Overview and Access of a lead and a head", () => {
  test("a department head's Overview has a row per division of their department, naming its leads", async () => {
    const overview = await (await open("department head")).overview();
    assert.equal(overview.shape, "department");
    if (overview.shape !== "department") return;
    assert.deepEqual(overview.divisions.map((d) => d.id).sort(), [UNITS.MA.divisionId, UNITS.OA.divisionId]);
    assert.ok(overview.divisions.find((d) => d.id === UNITS.MA.divisionId)!.leads.includes("Lead MA"));
    assert.ok(overview.divisions.find((d) => d.id === UNITS.OA.divisionId)!.leads.includes("Lead OA"));
  });

  test("Access lists the other leads with their role's access, never the viewer", async () => {
    const head = (await (await open("department head")).divisionAccess())!;
    const leads = head.roleAccess.map((r) => r.person.id);
    assert.ok(leads.includes(IDS.lead("MA")) && leads.includes(IDS.lead("OA")), JSON.stringify(leads));
    assert.ok(!leads.includes(accountOf("department head").memberId!));

    const lead = (await (await open("division lead")).divisionAccess())!;
    const others = lead.roleAccess.map((r) => r.person.id);
    assert.ok(others.includes(IDS.lead("MA")), "the other lead of their division");
    assert.ok(!others.includes(accountOf("division lead").memberId!), "never the viewer");
  });

  test("the team leader's Access page lists the Content grant, given across the whole team at Can edit", async () => {
    const page = (await (await open("team leader")).divisionAccess())!;
    const content = page.grants.find((g) => g.target === "content" && g.person.id === accountOf("member with a Content grant").memberId);
    assert.ok(content !== undefined, "the Content grant is listed");
    assert.equal(content.place.kind, "team");
    assert.equal(content.level, "edit");
  });
});

describe("closing a division and changing its code reach its positions", () => {
  test("closing an empty division closes its open positions, drops the access given in it, and takes it off the chart", async () => {
    await open("team leader");
    await addRows(applyPositions, [
      { id: 900, status: true, divisionId: EXTRA.emptyDivision, title: "Spare role", description: "x", requiredSkills: ["x"], desirableSkills: [], customQuestions: [], createdAt: daysAgo(5), requiresMotivationLetter: false, isDeleted: false },
    ]);
    await addRows(scopes, [{ id: 901, memberId: IDS.person("DM"), scope: "division", target: "positions", accessLevel: "view", divisionId: EXTRA.emptyDivision }]);
    const answer = await teamActions.closeDivision(EXTRA.emptyDivision);
    assert.ok(answer.ok, JSON.stringify(answer));
    assert.equal((await tableRows(applyPositions)).find((p) => p.id === 900)?.status, false, "its open position is closed, so /apply and its page show it closed");
    assert.equal((await tableRows(scopes)).some((s) => s.id === 901), false, "the access given in it is gone");
    const structure = (await (await reopen("team leader")).teamStructure())!;
    assert.ok(!structure.departments.flatMap((d) => d.divisions).some((d) => d.id === EXTRA.emptyDivision), "off the chart");
    assert.ok(await refused(() => teamActions.closeDivision(UNITS.MA.divisionId)), "a division with people in it stays open");
  });

  test("a division's new code is the one its positions' codes read", async () => {
    const before = await open("team leader");
    const dm = (await before.positions()).positions.find((p) => p.id === IDS.position("DM"))!;
    assert.match(dm.code, /DMA/);
    const answer = await teamActions.saveDivision(UNITS.DM.divisionId, { name: "Design & Manufacturing", code: "DMX", newLeads: [], oldLeads: [], members: [], emails: [] });
    assert.ok(answer.ok, JSON.stringify(answer));
    const after = (await (await reopen("team leader")).positions()).positions.find((p) => p.id === IDS.position("DM"))!;
    assert.match(after.code, /DMX/);
    assert.doesNotMatch(after.code, /DMA/);
  });
});

describe("an applicant's applications", () => {
  test("Accept leaves the person's other applications at their stages", async () => {
    await open("team leader");
    // The person at interview in DM also applied for the MA role, still New there.
    await addRows(applications, [
      { id: 990, applyPositionId: IDS.position("MA"), userId: "interviewee-dm", appliedAt: daysAgo(2), status: "received", customAnswers: [{ question: "Why?", answer: "x" }] },
    ]);
    const before = (await tableRows(applications)).find((a) => a.id === 990);
    const answer = await recruitmentActions.moveApplication(IDS.interview("DM"), { kind: "accept" });
    assert.ok(answer.ok, JSON.stringify(answer));
    assert.equal((await tableRows(applications)).find((a) => a.id === IDS.interview("DM"))?.status, "accepted");
    assert.deepEqual((await tableRows(applications)).find((a) => a.id === 990), before, "the other application is unchanged");
  });

  test("an accepted application cannot be withdrawn, and the refusal writes nothing", async () => {
    await open("joining-dm");
    const writes = (await databaseWrites()).length;
    assert.ok(await refused(() => (async () => (await reopen("joining-dm")).withdrawApplication(IDS.joining("DM")))()));
    assert.equal((await databaseWrites()).length, writes);
  });
});
