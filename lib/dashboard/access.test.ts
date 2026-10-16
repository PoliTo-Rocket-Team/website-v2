import assert from "node:assert/strict";
import { test } from "node:test";
import { canReach, DASHBOARD_PAGES, pageTitleFor, sidebarFor, userMenuPageFor, type SidebarFacts } from "./access";
import { maySiteContent } from "@/lib/content/gate";
import { FULL_ACCESS_SEATS, testDeveloperStanding as kindOnly, type FullAccessSeat, type ViewerKind, type ViewerStanding } from "./viewer";

/** Each group as its heading and item labels: [heading, [labels]]. */
function shape(viewer: ViewerKind | ViewerStanding, facts: SidebarFacts) {
  return sidebarFor(typeof viewer === "string" ? kindOnly(viewer) : viewer, facts).map((section) => [section.label, section.items.map((item) => item.label)]);
}

const withApplications: SidebarFacts = { counts: {}, hasShownApplications: true };
const withoutApplications: SidebarFacts = { counts: {}, hasShownApplications: false };

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

test("with no application shown, a member and a non-member see no My applications; a non-member sees Overview alone (board 50f, issue #317)", () => {
  assert.deepEqual(shape("member", withoutApplications), [[null, ["Overview", "Team tree"]]]);
  assert.deepEqual(sidebarFor(kindOnly("non-member"), withoutApplications), [
    { group: "main", label: null, items: [{ key: "overview", label: "Overview", href: "/dashboard", count: null }] },
  ]);
});

test("an alumnus sees Overview and My alumni, and My applications only while one is shown (boards 56, 56b, issue #317)", () => {
  assert.deepEqual(shape("alumni", withoutApplications), [[null, ["Overview", "My alumni"]]]);
  assert.deepEqual(shape("alumni", withApplications), [[null, ["Overview", "My alumni", "My applications"]]]);
  assert.equal(userMenuPageFor("alumni")?.label, "My account");
});

test("an alumnus reaches Overview, My alumni and My applications, and no other page (issue #317)", () => {
  const reached = DASHBOARD_PAGES.map((page) => page.key).filter((key) => canReach(kindOnly("alumni"), key));
  assert.deepEqual(reached, ["overview", "my-alumni", "my-applications", "my-account"]);
  for (const kind of ["operations-lead", "member", "non-member"] as const) assert.equal(canReach(kindOnly(kind), "my-alumni"), false, kind);
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
const fullAccess = (seat: FullAccessSeat | null): ViewerStanding => ({ kind: "operations-lead", seat, siteContent: false, approveOrders: false });

test("the team leader, the operations lead and the IT lead reach every page of the team (issue #238)", () => {
  // My account and My alumni are pages off the team, and the Activity log is the IT lead's alone (below).
  const teamPages = DASHBOARD_PAGES.map((p) => p.key).filter((key) => key !== "my-account" && key !== "my-alumni" && key !== "activity-log");
  for (const seat of FULL_ACCESS_SEATS) {
    for (const key of teamPages) assert.equal(canReach(fullAccess(seat), key), true, `${seat} ${key}`);
  }
});

test("the team leader's sidebar is board 72's: Team holds Members, Access and Orders, and Content holds Outreach, Partners, Alumni, FAQ and Team page (issues #252, #256, #258, #284)", () => {
  assert.deepEqual(shape(fullAccess("team-leader"), withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Recruitment", ["Positions", "Applications"]],
    ["Team", ["Members", "Access", "Orders"]],
    ["Content", ["Outreach", "Partners", "Alumni", "FAQ", "Team page"]],
  ]);
});

test("the operations lead's and the IT lead's sidebars keep the content pages under Team, with no Content group (issues #252, #256, #258, #284)", () => {
  for (const seat of ["operations-lead", "it-lead", null] as const) {
    assert.deepEqual(
      shape(fullAccess(seat), withoutApplications),
      [
        [null, ["Overview", "Team tree"]],
        ["Recruitment", ["Positions", "Applications"]],
        ["Team", ["Members", "Outreach", "Partners", "Alumni", "FAQ", "Team page", "Access", "Orders"]],
      ],
      String(seat),
    );
  }
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
    [{ kind: "operations-lead", seat: "operations-lead", siteContent: false, approveOrders: false }, true],
    [{ kind: "division-lead", siteContent: false, approveOrders: false }, false],
    [{ kind: "division-lead", siteContent: true, approveOrders: false }, true],
    [{ kind: "member", siteContent: false, approveOrders: false }, false],
    [{ kind: "member", siteContent: true, approveOrders: false }, true],
    [{ kind: "non-member", siteContent: false, approveOrders: false }, false],
  ];
  for (const [viewer, reached] of reaches) {
    const listed = sidebarFor(viewer, withoutApplications).some((section) => section.items.some((item) => item.key === "alumni"));
    assert.equal(canReach(viewer, "alumni"), reached, JSON.stringify(viewer));
    assert.equal(listed, reached, JSON.stringify(viewer));
  }
  assert.deepEqual(shape({ kind: "member", siteContent: true, approveOrders: false }, withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Team", ["Outreach", "Partners", "Alumni", "FAQ", "Team page"]],
  ]);
});

test("the Outreach and Team page pages are for whoever the site-content gate admits, never from a lead's role, and sit in the team leader's Content group (issues #289, #284)", () => {
  const reaches: readonly [ViewerStanding, boolean][] = [
    [fullAccess("team-leader"), true],
    [fullAccess("operations-lead"), true],
    [fullAccess("it-lead"), true],
    [{ kind: "department-head", siteContent: false, approveOrders: false }, false],
    [{ kind: "division-lead", siteContent: false, approveOrders: false }, false],
    [{ kind: "division-lead", siteContent: true, approveOrders: false }, true],
    [{ kind: "member", siteContent: false, approveOrders: true }, false],
    [{ kind: "member", siteContent: true, approveOrders: false }, true],
    [{ kind: "non-member", siteContent: false, approveOrders: false }, false],
  ];
  for (const [viewer, reached] of reaches) {
    assert.equal(canReach(viewer, "outreach"), reached, JSON.stringify(viewer));
    assert.equal(canReach(viewer, "team-page"), reached, JSON.stringify(viewer));
    assert.equal(maySiteContent(viewer), reached, `the page and the gate agree: ${JSON.stringify(viewer)}`);
  }
  const content = sidebarFor(fullAccess("team-leader"), withoutApplications).find((s) => s.group === "content");
  assert.equal(content?.items.find((item) => item.key === "outreach")?.href, "/dashboard/outreach");
  assert.equal(pageTitleFor("/dashboard/outreach/iress-3rd-edition"), "Outreach");
  assert.equal(content?.items.find((item) => item.key === "team-page")?.href, "/dashboard/team-page");
});

test("\"Approve orders\" alone opens Orders, under Team, and nothing else (issue #270)", () => {
  const holder: ViewerStanding = { kind: "member", siteContent: false, approveOrders: true };
  assert.equal(canReach(holder, "orders"), true);
  assert.deepEqual(shape(holder, withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Team", ["Orders"]],
  ]);
  for (const key of ["positions", "applications", "members", "division-access", "alumni", "activity-log"] as const) {
    assert.equal(canReach(holder, key), false, key);
  }
});

test("a member with no \"Approve orders\" and no Orders access does not reach Orders (issue #270)", () => {
  assert.equal(canReach(kindOnly("member"), "orders"), false);
  assert.equal(canReach({ kind: "member", siteContent: true, approveOrders: false }, "orders"), false);
  assert.equal(canReach(kindOnly("non-member"), "orders"), false);
});

test("a lead who also holds \"Approve orders\" keeps Orders where their role puts it (issue #270)", () => {
  assert.deepEqual(shape({ kind: "division-lead", siteContent: false, approveOrders: true }, withoutApplications).at(-1), [
    "My division",
    ["Members", "Access", "Orders"],
  ]);
});

test("My profile and My account are in the user menu, never the sidebar", () => {
  for (const kind of ["operations-lead", "division-lead", "member", "alumni", "non-member"] as const) {
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
