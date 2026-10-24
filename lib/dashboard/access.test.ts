import assert from "node:assert/strict";
import { test } from "node:test";
import { canReach, DASHBOARD_PAGES, pageTitleFor, sidebarFor, userMenuPageFor, type SidebarFacts } from "./access";
import { maySiteContent } from "@/lib/content/gate";
import {
  FULL_ACCESS_SEATS,
  GRANT_AREAS,
  testDeveloperStanding as kindOnly,
  type FullAccessSeat,
  type GrantArea,
  type ViewerKind,
  type ViewerStanding,
} from "./viewer";

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

test("a division lead's sidebar is Overview, Team tree, then Recruitment and Team, as every role's (issue #408)", () => {
  assert.deepEqual(shape("division-lead", withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Recruitment", ["Positions", "Applications"]],
    ["Team", ["Members", "Access", "Orders"]],
  ]);
});

test("a department head's sidebar has the same groups as the team leader's, less the pages they do not reach (issue #408)", () => {
  assert.deepEqual(shape("department-head", withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Recruitment", ["Positions", "Applications"]],
    ["Team", ["Members", "Access", "Orders"]],
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

test("every full-access seat reaches every page of the team (issues #238, #485)", () => {
  // My account and My alumni are pages off the team, and the Activity log is the IT lead's alone (below).
  const teamPages = DASHBOARD_PAGES.map((p) => p.key).filter((key) => key !== "my-account" && key !== "my-alumni" && key !== "activity-log");
  for (const seat of FULL_ACCESS_SEATS) {
    for (const key of teamPages) assert.equal(canReach(fullAccess(seat), key), true, `${seat} ${key}`);
  }
});

test("the team leader's sidebar is board 72's: Team holds Members, Access and Orders, and Content holds Projects, Outreach, Partners, Alumni, FAQ and Team page (issues #252, #256, #258, #284, #289, #297)", () => {
  assert.deepEqual(shape(fullAccess("team-leader"), withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Recruitment", ["Positions", "Applications"]],
    ["Team", ["Members", "Access", "Orders"]],
    ["Content", ["Projects", "Outreach", "Partners", "Alumni", "FAQ", "Team page"]],
  ]);
});

test("the operations lead's, the IT lead's, the Project Manager's and the Chief Engineer's sidebars are the team leader's, Content group included (issues #408, #485)", () => {
  for (const seat of ["operations-lead", "it-lead", "project-manager", "chief-engineer", null] as const) {
    assert.deepEqual(shape(fullAccess(seat), withoutApplications), shape(fullAccess("team-leader"), withoutApplications), String(seat));
  }
});

/** One viewer of each standing a role or grant gives: every way into the dashboard. */
const EVERY_STANDING: readonly [string, ViewerStanding][] = [
  ["team leader", fullAccess("team-leader")],
  ["operations lead", fullAccess("operations-lead")],
  ["IT lead", fullAccess("it-lead")],
  ["Project Manager", fullAccess("project-manager")],
  ["Chief Engineer", fullAccess("chief-engineer")],
  ["full access by scope row", fullAccess(null)],
  ["department head", { kind: "department-head", siteContent: false, approveOrders: false }],
  ["department head with Content", { kind: "department-head", siteContent: true, approveOrders: true }],
  ["division lead", { kind: "division-lead", siteContent: false, approveOrders: false }],
  ["division lead with Content", { kind: "division-lead", siteContent: true, approveOrders: true }],
  ["member", { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false }],
  ["member with a grant on every area", { kind: "member", grantedAreas: GRANT_AREAS, siteContent: false, approveOrders: false }],
  ["member with Content", { kind: "member", grantedAreas: [], siteContent: true, approveOrders: false }],
  ["member with Approve orders", { kind: "member", grantedAreas: [], siteContent: false, approveOrders: true }],
  ["alumni", { kind: "alumni", siteContent: false, approveOrders: false }],
  ["non-member", { kind: "non-member", siteContent: false, approveOrders: false }],
];

test("each dashboard page sits in the same sidebar group for every viewer who reaches it (issue #408)", () => {
  const groupOf = new Map<string, string>();
  for (const [who, viewer] of EVERY_STANDING) {
    for (const section of sidebarFor(viewer, withApplications)) {
      for (const item of section.items) {
        const seen = groupOf.get(item.key);
        assert.ok(seen === undefined || seen === section.group, `${item.key} is under ${section.group} for the ${who}, under ${seen} for another`);
        groupOf.set(item.key, section.group);
      }
    }
  }
  assert.deepEqual(Object.fromEntries(groupOf), {
    overview: "main",
    "my-applications": "main",
    "team-tree": "main",
    "my-alumni": "main",
    positions: "recruitment",
    applications: "recruitment",
    members: "team",
    "division-access": "team",
    orders: "team",
    projects: "content",
    outreach: "content",
    partners: "content",
    alumni: "content",
    faq: "content",
    "team-page": "content",
  });
});

test("the one sidebar structure leaves which pages each viewer reaches as it was (issue #408)", () => {
  const head = ["overview", "my-applications", "team-tree", "positions", "applications", "members", "division-access", "orders", "my-profile"];
  // A Content grant opens the six editors, the Alumni page among them (issues #504, #589).
  const content = ["projects", "outreach", "partners", "alumni", "faq", "team-page"];
  const full = ["overview", "my-applications", "team-tree", "positions", "applications", "members", "projects", "outreach", "partners", "alumni", "faq", "team-page", "division-access", "orders", "my-profile"];
  const order = DASHBOARD_PAGES.map((page) => page.key);
  const inOrder = (keys: readonly string[]) => order.filter((key) => keys.includes(key));
  const expected: Readonly<Record<string, readonly string[]>> = {
    "team leader": full,
    "operations lead": full,
    "IT lead": inOrder([...full, "activity-log"]),
    "Project Manager": full,
    "Chief Engineer": full,
    "full access by scope row": full,
    "department head": head,
    "department head with Content": inOrder([...head, ...content]),
    "division lead": head,
    "division lead with Content": inOrder([...head, ...content]),
    member: ["overview", "my-applications", "team-tree", "my-profile"],
    // Access is no grant area, so a grant never opens it (issue #471).
    "member with a grant on every area": head.filter((key) => key !== "division-access"),
    "member with Content": inOrder(["overview", "my-applications", "team-tree", ...content, "my-profile"]),
    "member with Approve orders": ["overview", "my-applications", "team-tree", "orders", "my-profile"],
    alumni: ["overview", "my-alumni", "my-applications", "my-account"],
    "non-member": ["overview", "my-applications", "my-account"],
  };
  for (const [who, viewer] of EVERY_STANDING) {
    assert.deepEqual(order.filter((key) => canReach(viewer, key)), expected[who], who);
  }
});

test("full access from an admin or org scope row reaches every page of the team too (issue #238)", () => {
  assert.equal(canReach(fullAccess(null), "division-access"), true);
  assert.equal(canReach(fullAccess(null), "orders"), true);
});

test("only the IT lead reaches the Activity log, and no sidebar lists it until the page is built (issue #238)", () => {
  assert.equal(canReach(fullAccess("it-lead"), "activity-log"), true);
  for (const seat of ["team-leader", "operations-lead", "project-manager", "chief-engineer", null] as const) assert.equal(canReach(fullAccess(seat), "activity-log"), false, String(seat));
  for (const kind of ["department-head", "division-lead", "member", "non-member"] as const) {
    assert.equal(canReach(kindOnly(kind), "activity-log"), false, kind);
  }
  const listed = sidebarFor(fullAccess("it-lead"), withoutApplications).some((s) => s.items.some((item) => item.key === "activity-log"));
  assert.equal(listed, false);
});

test("the Alumni page follows the site-content rule: full access and a Content grant, never a lead's role (issues #234, #589)", () => {
  const reaches: readonly [ViewerStanding, boolean][] = [
    [{ kind: "operations-lead", seat: "operations-lead", siteContent: false, approveOrders: false }, true],
    [{ kind: "division-lead", siteContent: false, approveOrders: false }, false],
    [{ kind: "division-lead", siteContent: true, approveOrders: false }, true],
    [{ kind: "member", grantedAreas: [], siteContent: false, approveOrders: false }, false],
    [{ kind: "member", grantedAreas: [], siteContent: true, approveOrders: false }, true],
    [{ kind: "non-member", siteContent: false, approveOrders: false }, false],
  ];
  for (const [viewer, reached] of reaches) {
    const listed = sidebarFor(viewer, withoutApplications).some((section) => section.items.some((item) => item.key === "alumni"));
    assert.equal(canReach(viewer, "alumni"), reached, JSON.stringify(viewer));
    assert.equal(listed, reached, JSON.stringify(viewer));
    assert.equal(maySiteContent(viewer), reached, JSON.stringify(viewer));
  }
  // A Content grant: the Content group with its six editors, Alumni among them.
  assert.deepEqual(shape({ kind: "member", grantedAreas: [], siteContent: true, approveOrders: false }, withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Content", ["Projects", "Outreach", "Partners", "Alumni", "FAQ", "Team page"]],
  ]);
});

test("the Outreach and Team page pages are for whoever the site-content gate admits, never from a lead's role, and sit in the Content group (issues #289, #284)", () => {
  const reaches: readonly [ViewerStanding, boolean][] = [
    [fullAccess("team-leader"), true],
    [fullAccess("operations-lead"), true],
    [fullAccess("it-lead"), true],
    [fullAccess("project-manager"), true],
    [fullAccess("chief-engineer"), true],
    [{ kind: "department-head", siteContent: false, approveOrders: false }, false],
    [{ kind: "division-lead", siteContent: false, approveOrders: false }, false],
    [{ kind: "division-lead", siteContent: true, approveOrders: false }, true],
    [{ kind: "member", grantedAreas: [], siteContent: false, approveOrders: true }, false],
    [{ kind: "member", grantedAreas: [], siteContent: true, approveOrders: false }, true],
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
  const holder: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: false, approveOrders: true };
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
  assert.equal(canReach({ kind: "member", grantedAreas: [], siteContent: true, approveOrders: false }, "orders"), false);
  assert.equal(canReach(kindOnly("non-member"), "orders"), false);
});

test("a lead who also holds \"Approve orders\" keeps Orders once, under Team (issue #270)", () => {
  assert.deepEqual(shape({ kind: "division-lead", siteContent: false, approveOrders: true }, withoutApplications).at(-1), [
    "Team",
    ["Members", "Access", "Orders"],
  ]);
});

/** The pages a lead reaches over their units; a member reaches each only by a grant on its area (issue #471). */
const GRANT_PAGES = ["positions", "applications", "members", "division-access", "orders"] as const;

/** A member granted `areas` and nothing else. */
const granted = (areas: readonly GrantArea[]): ViewerStanding => ({ kind: "member", grantedAreas: areas, siteContent: false, approveOrders: false });

/** The keys of every page the viewer's sidebar lists, in sidebar order. */
const listedKeys = (viewer: ViewerStanding, facts: SidebarFacts = withoutApplications) =>
  sidebarFor(viewer, facts).flatMap((section) => section.items.map((item) => item.key));

const reachedGrantPages = (viewer: ViewerStanding) => GRANT_PAGES.filter((key) => canReach(viewer, key));
const listedGrantPages = (viewer: ViewerStanding) => listedKeys(viewer).filter((key) => (GRANT_PAGES as readonly string[]).includes(key));

test("a member with a Positions-only grant reaches and lists Positions alone among the grant pages (issue #471)", () => {
  const viewer = granted(["positions"]);
  assert.equal(canReach(viewer, "positions"), true);
  for (const key of ["applications", "members", "division-access", "orders"] as const) assert.equal(canReach(viewer, key), false, key);
  assert.deepEqual(listedGrantPages(viewer), ["positions"]);
  assert.deepEqual(shape(viewer, withoutApplications), [
    [null, ["Overview", "Team tree"]],
    ["Recruitment", ["Positions"]],
  ]);
});

test("a member with an Applications-only grant reaches and lists Applications alone among the grant pages (issue #471)", () => {
  const viewer = granted(["applications"]);
  assert.deepEqual(reachedGrantPages(viewer), ["applications"]);
  assert.deepEqual(listedGrantPages(viewer), ["applications"]);
});

test("a Members-only grant reaches and lists Members alone, an Orders-only grant Orders alone (issue #471)", () => {
  for (const area of ["members", "orders"] as const) {
    const viewer = granted([area]);
    assert.deepEqual(reachedGrantPages(viewer), [area], area);
    assert.deepEqual(listedGrantPages(viewer), [area], area);
  }
});

test("a grant on every area reaches and lists Positions, Applications, Members and Orders, and never Access (issue #471)", () => {
  const viewer = granted(GRANT_AREAS);
  assert.deepEqual(reachedGrantPages(viewer), ["positions", "applications", "members", "orders"]);
  assert.deepEqual(listedGrantPages(viewer), ["positions", "applications", "members", "orders"]);
});

test("the Applications badge shows only to a viewer whose sidebar lists Applications (issue #471)", () => {
  const facts: SidebarFacts = { counts: { applications: 8 }, hasShownApplications: false };
  const items = (viewer: ViewerStanding) => sidebarFor(viewer, facts).flatMap((section) => section.items);
  const positionsOnly = items(granted(["positions"]));
  assert.equal(positionsOnly.some((item) => item.key === "applications"), false);
  assert.ok(positionsOnly.every((item) => item.count === null));
  assert.equal(items(granted(["applications"])).find((item) => item.key === "applications")?.count, 8);
});

test("\"Approve orders\" with no area grant still opens Orders; a Content grant with no area grant opens the six editors only (issues #471, #504, #589)", () => {
  const approver: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: false, approveOrders: true };
  assert.deepEqual(reachedGrantPages(approver), ["orders"]);
  const editor: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: true, approveOrders: false };
  assert.deepEqual(reachedGrantPages(editor), []);
  assert.deepEqual(listedKeys(editor), ["overview", "team-tree", "projects", "outreach", "partners", "alumni", "faq", "team-page"]);
});

test("heads, leads and every full-access seat reach and list the pages they did before grant areas, and the user menu is unchanged (issue #471)", () => {
  const lead = ["overview", "team-tree", "positions", "applications", "members", "division-access", "orders"];
  const full = [...lead, "projects", "outreach", "partners", "alumni", "faq", "team-page"];
  const listed: readonly [string, ViewerStanding, readonly string[]][] = [
    ["department head", kindOnly("department-head"), lead],
    ["division lead", kindOnly("division-lead"), lead],
    ["team leader", fullAccess("team-leader"), full],
    ["operations lead", fullAccess("operations-lead"), full],
    ["IT lead", fullAccess("it-lead"), full],
    ["Project Manager", fullAccess("project-manager"), full],
    ["Chief Engineer", fullAccess("chief-engineer"), full],
  ];
  for (const [who, viewer, keys] of listed) {
    assert.deepEqual(listedKeys(viewer), keys, who);
    assert.deepEqual(reachedGrantPages(viewer), GRANT_PAGES, who);
  }
  const menu = Object.fromEntries(
    (["operations-lead", "department-head", "division-lead", "member", "alumni", "non-member"] as const).map((kind) => [kind, userMenuPageFor(kind)?.key]),
  );
  assert.deepEqual(menu, {
    "operations-lead": "my-profile",
    "department-head": "my-profile",
    "division-lead": "my-profile",
    member: "my-profile",
    alumni: "my-account",
    "non-member": "my-account",
  });
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
