import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import type { PersonalOverview, TeamSideOverview } from "./overview";
import { accountOf, MARKERS, seedFixture } from "./access-matrix/fixture";
import { ALL } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";

// A member's Overview on the database path (issue #480): with a grant or
// without one, it is their own page (profile, "Your page on the site", their
// division, their own notices), and each grant adds one counts-only "Your
// access" line. It runs on the access matrix's in-memory database
// (./access-matrix/install.ts), where each unit holds one new application and
// one interview with times offered and none booked.

async function overviewOf(name: string): Promise<PersonalOverview> {
  seedFixture();
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  const board: TeamSideOverview = await (opening as { data: DashboardData }).data.overview();
  assert.equal(board.shape, "personal", `${name}: the member's own Overview`);
  return board as PersonalOverview;
}

/** What a member's own page holds, whoever they are: the parts a grant must leave alone. */
function ownPage(overview: PersonalOverview) {
  return {
    edit: overview.person.edit,
    checklist: overview.checklist?.title,
    roster: overview.roster?.title,
    attention: overview.attention.map((a) => a.kind),
  };
}

/** Every applicant's and every private member detail's marker, in any unit. */
const PRIVATE = ALL.flatMap((u) => [...MARKERS.applications(u), ...MARKERS.members(u)]);

test("a member with no grant sees their own page and the access hint, no access line", async () => {
  const plain = await overviewOf("member");
  assert.deepEqual(plain.access, []);
  assert.equal(ownPage(plain).edit?.label, "Edit profile");
  assert.equal(ownPage(plain).checklist, "Your page on the site");
  assert.notEqual(plain.roster, null);
});

test("a Positions grant keeps the member's page and adds the Positions line alone", async () => {
  const plain = await overviewOf("member");
  const granted = await overviewOf("member with a positions grant across the team");
  assert.deepEqual(ownPage(granted), ownPage(plain));
  assert.deepEqual(granted.access, [{ area: "positions", href: "/dashboard/positions", open: 3, divisions: 3 }]);
});

test("an Applications grant adds the Applications line alone: no attention row and no interview list", async () => {
  const plain = await overviewOf("member");
  const granted = await overviewOf("member with a applications grant across the team");
  assert.deepEqual(ownPage(granted), ownPage(plain));
  assert.deepEqual(granted.access, [{ area: "applications", href: "/dashboard/applications", fresh: 3, booked: 0 }]);
  assert.equal(granted.attention.some((a) => a.kind === "applications" || a.kind === "no-photo"), false);
  assert.equal("interviews" in granted, false);
});

test("no applicant and no private member detail reaches a granted member's Overview", async () => {
  for (const area of ["positions", "applications", "members", "orders"]) {
    const text = JSON.stringify(await overviewOf(`member with a ${area} grant across the team`));
    for (const marker of PRIVATE) assert.equal(text.includes(marker), false, `${area}: ${marker}`);
  }
  const members = await overviewOf("member with a members grant across the team");
  assert.equal(JSON.stringify(members.access).includes("Person"), false, "the Members line counts people, it names none");
});
