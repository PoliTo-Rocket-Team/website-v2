import assert from "node:assert/strict";
import { test } from "node:test";
import { canReach, dashboardLandingFor, pageTitleFor, sidebarFor, userMenuPageFor, type SidebarFacts } from "./access";
import type { ViewerKind } from "./viewer";

/** Each group as its heading and item labels: [heading, [labels]]. */
function shape(kind: ViewerKind, facts: SidebarFacts) {
  return sidebarFor(kind, facts).map((section) => [section.label, section.items.map((item) => item.label)]);
}

const withApplications: SidebarFacts = { counts: {}, hasOwnApplications: true };
const withoutApplications: SidebarFacts = { counts: {}, hasOwnApplications: false };

test("a non-member's sidebar is My applications alone (board 51b)", () => {
  assert.deepEqual(shape("non-member", withApplications), [[null, ["My applications"]]]);
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

test("a member sees My applications only once they have applied; a non-member always does (issue #179)", () => {
  assert.deepEqual(shape("member", withoutApplications), [[null, ["Overview", "Team tree"]]]);
  assert.deepEqual(sidebarFor("non-member", withoutApplications), [
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

test("the operations lead does not reach Access or Orders yet (issue #200)", () => {
  assert.equal(canReach("operations-lead", "division-access"), false);
  assert.equal(canReach("operations-lead", "orders"), false);
});

test("/dashboard sends only a non-member who has not applied to My applications", () => {
  assert.equal(dashboardLandingFor("non-member", false), "/dashboard/my-applications");
  assert.equal(dashboardLandingFor("non-member", true), null);
  for (const kind of ["member", "division-lead", "operations-lead"] as const) {
    assert.equal(dashboardLandingFor(kind, false), null, kind);
  }
});

test("My profile and My account are in the user menu, never the sidebar", () => {
  for (const kind of ["operations-lead", "division-lead", "member", "non-member"] as const) {
    const labels = sidebarFor(kind, withApplications).flatMap((section) => section.items.map((item) => item.label));
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
