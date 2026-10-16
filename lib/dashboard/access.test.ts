import assert from "node:assert/strict";
import { test } from "node:test";
import { canReach, DASHBOARD_PAGES, dashboardLandingFor, landingAfterLeaving, pageTitleFor, sidebarFor, userMenuPageFor, type SidebarFacts } from "./access";
import { FULL_ACCESS_SEATS, testDeveloperStanding as kindOnly, type FullAccessSeat, type ViewerKind, type ViewerStanding } from "./viewer";

/** Each group as its heading and item labels: [heading, [labels]]. */
function shape(viewer: ViewerKind | ViewerStanding, facts: SidebarFacts) {
  return sidebarFor(typeof viewer === "string" ? kindOnly(viewer) : viewer, facts).map((section) => [section.label, section.items.map((item) => item.label)]);
}

const withApplications: SidebarFacts = { counts: {}, hasOwnApplications: true };
const withoutApplications: SidebarFacts = { counts: {}, hasOwnApplications: false };

test("a non-member who has applied sees Overview and My applications (board 50e)", () => {
  assert.deepEqual(shape("non-member", withApplications), [[null, ["Overview", "My applications"]]]);
});

test("a member's sidebar is Overview, My applications, Team tree (board 52)", () => {
  assert.deepEqual(shape("member", withApplications), [[null, ["Overview", "My applications", "Team tree"]]]);
});

test("a division lead's sidebar is Overview, Team tree, then Recruitment and My division (board 56)", () => {
  assert.deepEqual(shape("division-lead", withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Recruitment", ["Positions", "Applications"]],
    ["My division", ["Members", "Access", "Orders"]],
  ]);
});

test("a member sees My applications only once they have applied; a non-member always does, alone until they apply (issue #179)", () => {
  assert.deepEqual(shape("member", withoutApplications), [[null, ["Overview", "Team tree"]]]);
  assert.deepEqual(sidebarFor(kindOnly("non-member"), withoutApplications), [
    {
      group: "main",
      label: null,
      items: [{ key: "my-applications", label: "My applications", href: "/dashboard/my-applications", count: null }],
    },
  ]);
});

test("a division lead sees My applications only once they have applied (issue #183)", () => {
  assert.deepEqual(shape("division-lead", withApplications)[0], [null, ["Overview", "My applications", "Team tree"]]);
  assert.deepEqual(shape("division-lead", withoutApplications)[0], [null, ["Overview", "Team tree"]]);
});

test("the operations lead sees My applications only once they have applied, and always Team tree (issue #183)", () => {
  assert.deepEqual(shape("operations-lead", withApplications)[0], [null, ["Overview", "My applications", "Team tree"]]);
  assert.deepEqual(shape("operations-lead", withoutApplications)[0], [null, ["Overview", "Team tree"]]);
});

/** Full access from each seat, with no scope row and no site-content access (issue #238). */
const fullAccess = (seat: FullAccessSeat | null): ViewerStanding => ({ kind: "operations-lead", seat, siteContent: false });

test("the team leader, the operations lead and the IT lead reach every page of the team (issue #238)", () => {
  // My account is the applicant's page, and the Activity log is the IT lead's alone (below).
  const teamPages = DASHBOARD_PAGES.map((p) => p.key).filter((key) => key !== "my-account" && key !== "activity-log");
  for (const seat of FULL_ACCESS_SEATS) {
    for (const key of teamPages) assert.equal(canReach(fullAccess(seat), key), true, `${seat} ${key}`);
  }
  assert.deepEqual(shape(fullAccess("team-leader"), withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Recruitment", ["Positions", "Applications"]],
    ["Team", ["Members", "Access", "Orders"]],
    ["Content", ["Partners", "Alumni"]],
  ]);
});

test("full access from an admin or org scope row reaches every page of the team too (issue #238)", () => {
  assert.equal(canReach(fullAccess(null), "division-access"), true);
  assert.equal(canReach(fullAccess(null), "orders"), true);
});

test("only the IT lead reaches the Activity log, and no sidebar lists it until the page is built (issue #238)", () => {
  assert.equal(canReach(fullAccess("it-lead"), "activity-log"), true);
  for (const seat of ["team-leader", "operations-lead", null] as const) assert.equal(canReach(fullAccess(seat), "activity-log"), false, String(seat));
  for (const kind of ["department-head", "division-lead", "member", "non-member"] as const) {
    assert.equal(canReach(kindOnly(kind), "activity-log"), false, kind);
  }
  const listed = sidebarFor(fullAccess("it-lead"), withoutApplications).some((s) => s.items.some((item) => item.key === "activity-log"));
  assert.equal(listed, false);
});

test("the Alumni page is for full admins and site-content access, never from a lead's role (issue #234)", () => {
  const reaches: readonly [ViewerStanding, boolean][] = [
    [{ kind: "operations-lead", seat: "operations-lead", siteContent: false }, true],
    [{ kind: "division-lead", siteContent: false }, false],
    [{ kind: "division-lead", siteContent: true }, true],
    [{ kind: "member", siteContent: false }, false],
    [{ kind: "member", siteContent: true }, true],
    [{ kind: "non-member", siteContent: false }, false],
  ];
  for (const [viewer, reached] of reaches) {
    const listed = sidebarFor(viewer, withoutApplications).some((section) => section.items.some((item) => item.key === "alumni"));
    assert.equal(canReach(viewer, "alumni"), reached, JSON.stringify(viewer));
    assert.equal(listed, reached, JSON.stringify(viewer));
  }
  assert.deepEqual(shape({ kind: "member", siteContent: true }, withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Content", ["Partners", "Alumni"]],
  ]);
});

test("/dashboard sends only a non-member who has not applied to My applications", () => {
  assert.equal(dashboardLandingFor("non-member", false), "/dashboard/my-applications");
  assert.equal(dashboardLandingFor("non-member", true), null);
  for (const kind of ["member", "division-lead", "operations-lead"] as const) {
    assert.equal(dashboardLandingFor(kind, false), null, kind);
  }
});

test("someone who leaves the team goes straight to where /dashboard would send them as a non-member", () => {
  assert.equal(landingAfterLeaving(false), "/dashboard/my-applications");
  assert.equal(landingAfterLeaving(true), "/dashboard");
});

test("My profile and My account are in the user menu, never the sidebar", () => {
  for (const kind of ["operations-lead", "division-lead", "member", "non-member"] as const) {
    const labels = sidebarFor(kindOnly(kind), withApplications).flatMap((section) => section.items.map((item) => item.label));
    assert.ok(!labels.includes("My profile") && !labels.includes("My account"), kind);
  }
  assert.equal(userMenuPageFor("non-member")?.label, "My account");
  assert.equal(userMenuPageFor("member")?.label, "My profile");
  assert.equal(userMenuPageFor("division-lead")?.label, "My profile");
  assert.equal(userMenuPageFor("operations-lead")?.label, "My profile");
});

test("the phone top bar names the page by its longest matching address", () => {
  assert.equal(pageTitleFor("/dashboard"), "Overview");
  assert.equal(pageTitleFor("/dashboard/applications"), "Applications");
  assert.equal(pageTitleFor("/dashboard/applications/42"), "Applications");
  assert.equal(pageTitleFor("/dashboard/profile"), "My profile");
  assert.equal(pageTitleFor("/apply"), null);
});
