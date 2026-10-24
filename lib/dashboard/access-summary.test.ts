import assert from "node:assert/strict";
import { test } from "node:test";
import { accessLine, accessSummariesOf, type AccessFigures } from "./access-summary";
import { overviewAreasOf } from "./division-overview";
import { viewerStandingOf, type ActiveRoleRef, type ScopeRef, type ScopeTarget } from "./viewer";

// "Your access" on a member's Overview (issue #480): one counts-only line per
// granted area, in GRANT_AREAS order, and nothing for an area not granted.

const core: ActiveRoleRef = { type: "core", divisionId: 3, fullAccess: null };
const grant = (target: ScopeTarget): ScopeRef => ({ scope: "division", target, level: "view" });
const member = (...targets: ScopeTarget[]) => viewerStandingOf({ scopes: targets.map(grant), activeRoles: [core] });

/** Every area read, with the names a reader holds beside the counts. */
const withNames = {
  positions: [
    { open: true, divisionId: 1, title: "Test Engineer" },
    { open: true, divisionId: 2, title: "Propulsion Engineer" },
    { open: true, divisionId: 2, title: "Avionics Engineer" },
    { open: false, divisionId: 3, title: "Closed Role" },
  ],
  applications: {
    positions: [{ newApplications: 5 }, { newApplications: 3 }],
    interviews: [
      { applicant: "Ada Applicant", position: "Test Engineer", state: "booked" as const },
      { applicant: "Ben Booked", position: "Test Engineer", state: "booked" as const },
      { applicant: "Wes Waiting", position: "Test Engineer", state: "waiting" as const },
    ],
  },
  orders: { count: 3, total: 12_000 },
  members: { people: 12, divisions: 2 },
};
// A reader's richer rows are figures too: the names above ride along and must not come out.
const everything: AccessFigures = withNames;

const areasOf = (...targets: ScopeTarget[]) => accessSummariesOf(overviewAreasOf(member(...targets)), everything).map((s) => s.area);

test("a member with no grant gets no access line, whatever was read", () => {
  assert.deepEqual(accessSummariesOf(overviewAreasOf(member()), everything), []);
});

test("a Positions grant adds the Positions line alone", () => {
  assert.deepEqual(areasOf("positions"), ["positions"]);
  const [line] = accessSummariesOf(["positions"], everything);
  assert.equal(accessLine(line), "Positions · 3 open in 2 divisions");
  assert.equal(line.href, "/dashboard/positions");
});

test("an Applications grant adds the Applications line alone, counting booked interviews only", () => {
  assert.deepEqual(areasOf("applications"), ["applications"]);
  const [line] = accessSummariesOf(["applications"], everything);
  assert.equal(accessLine(line), "Applications · 8 new · 2 interviews booked");
  assert.equal(line.href, "/dashboard/applications");
});

test("the lines come in GRANT_AREAS order, and Orders and Members link to their pages", () => {
  assert.deepEqual(areasOf("orders", "applications", "members", "positions"), ["positions", "applications", "members", "orders"]);
  const lines = accessSummariesOf(["members", "orders"], everything);
  assert.deepEqual(lines.map((s) => s.href), ["/dashboard/members", "/dashboard/orders"]);
  assert.equal(accessLine(lines[0]), "Members · 12 people in 2 divisions");
  assert.match(accessLine(lines[1]), /^Orders · 3 waiting · .+ to be placed$/);
});

test("singular counts read in the singular, and one division names no scope", () => {
  const [positions, applications, members] = accessSummariesOf(["positions", "applications", "members"], {
    positions: [{ open: true, divisionId: 1 }],
    applications: { positions: [{ newApplications: 1 }], interviews: [{ state: "booked" }] },
    members: { people: 1, divisions: 1 },
  });
  assert.equal(accessLine(positions), "Positions · 1 open in 1 division");
  assert.equal(accessLine(applications), "Applications · 1 new · 1 interview booked");
  assert.equal(accessLine(members), "Members · 1 person");
});

test("an area left unread adds nothing", () => {
  assert.deepEqual(accessSummariesOf(["positions", "applications", "members", "orders"], {}), []);
});

test("no name read beside the counts reaches a summary", () => {
  const text = JSON.stringify(accessSummariesOf(["positions", "applications", "members", "orders"], everything));
  for (const name of ["Ada Applicant", "Ben Booked", "Wes Waiting", "Test Engineer", "Closed Role"]) {
    assert.equal(text.includes(name), false, name);
  }
});

test("a Content grant adds a Content line last, naming the editors it opens and linking to the first (issue #504)", () => {
  const holder = viewerStandingOf({ scopes: [{ scope: "website", target: "content", level: "edit" }], activeRoles: [core] });
  const [line] = accessSummariesOf(overviewAreasOf(holder), everything, holder.siteContent);
  assert.equal(accessLine(line), "Content · Edit Projects, Outreach, Partners, Alumni, FAQ and Team page");
  assert.equal(line.href, "/dashboard/projects");
  assert.deepEqual(accessSummariesOf(["orders"], everything, true).map((s) => s.area), ["orders", "content"]);
  // The old Alumni row and a Can view row on content add no line (issue #589).
  for (const target of ["all", "content"] as const) {
    const old = viewerStandingOf({ scopes: [{ scope: "website", target, level: "view" }], activeRoles: [core] });
    assert.deepEqual(accessSummariesOf(overviewAreasOf(old), everything, old.siteContent), [], target);
  }
});
