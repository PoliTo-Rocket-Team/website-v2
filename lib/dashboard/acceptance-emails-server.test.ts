import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applications } from "@/db/schema";
import { ACCEPTANCE_EMAILS_HREF } from "./acceptance-emails";
import type { DashboardData } from "./data";
import { overviewOfSections } from "./overview";
import { changeRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { openDashboard } from "./open";

// The team leader's acceptance emails (board 100, issue #744) on the real
// database: the team leader's Applications page carries the box's rows and
// their Overview the row that links to it; a division lead and a department
// head who read the same application are sent neither. It runs against the
// migrated in-memory Postgres the access matrix uses.

const APPLICATION = IDS.application("MA");
const VIEWERS_WITHOUT_BOX = ["division lead", "department head"]; // both read Mission Analysis's applications

async function dashboardOf(name: string): Promise<DashboardData> {
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  return (opening as { data: DashboardData }).data;
}

describe("The team leader's acceptance emails (issue #744)", () => {
  test("only the team leader's page and Overview carry the acceptance emails to send", async () => {
    await seedFixture();
    await changeRows(applications, { id: APPLICATION }, { status: "accepted", statusKey: "accepted_email_to_be_sent", acceptedAt: new Date(Date.now() - 86_400_000).toISOString() });

    const leader = await dashboardOf("team leader");
    const page = await leader.applications();
    assert.deepEqual(
      page.acceptanceEmails?.map((r) => r.id),
      [APPLICATION],
    );
    const overview = await overviewOfSections(leader.overviewSections());
    const row = overview.attention.find((a) => a.kind === "acceptance-emails");
    assert.equal(row?.title, "1 acceptance email to send");
    assert.deepEqual(row?.action, { label: "Open", href: ACCEPTANCE_EMAILS_HREF });

    for (const name of VIEWERS_WITHOUT_BOX) {
      const data = await dashboardOf(name);
      const theirs = await data.applications();
      assert.ok(
        theirs.applications.some((a) => a.id === APPLICATION),
        `${name} reads the application`,
      );
      assert.equal(theirs.acceptanceEmails, null, `${name} is sent no row of the box`);
      const theirOverview = await overviewOfSections(data.overviewSections());
      assert.ok(!theirOverview.attention.some((a) => a.kind === "acceptance-emails"), `${name} gets no Overview row`);
    }
  });

  test("an application with no stored acceptance day shows no date and goes last, not its applied day", async () => {
    await seedFixture();
    const dated = APPLICATION; // applied 3 days ago, accepted yesterday
    const undated = IDS.interview("MA"); // applied 10 days ago, no acceptance day stored
    const acceptedAt = new Date(Date.now() - 86_400_000).toISOString();
    await changeRows(applications, { id: dated }, { status: "accepted", statusKey: "accepted_email_to_be_sent", acceptedAt });
    await changeRows(applications, { id: undated }, { status: "accepted", statusKey: "accepted_email_to_be_sent", acceptedAt: null });

    const page = await (await dashboardOf("team leader")).applications();
    assert.deepEqual(
      page.acceptanceEmails?.map((r) => ({ id: r.id, acceptedAt: r.acceptedAt })),
      [
        { id: dated, acceptedAt },
        { id: undated, acceptedAt: null },
      ],
    );
  });

  test("with no acceptance email to send, the team leader gets an empty box and no Overview row", async () => {
    await seedFixture();
    const leader = await dashboardOf("team leader");
    assert.deepEqual((await leader.applications()).acceptanceEmails, []);
    const overview = await overviewOfSections(leader.overviewSections());
    assert.ok(!overview.attention.some((a) => a.kind === "acceptance-emails"));
  });
});
