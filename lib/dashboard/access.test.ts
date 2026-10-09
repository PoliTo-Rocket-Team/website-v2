import assert from "node:assert/strict";
import { test } from "node:test";
import { sidebarFor, userMenuPageFor, type SidebarFacts } from "./access";
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
  assert.deepEqual(shape("division-lead", withApplications), [
    [null, ["Overview", "Team tree"]],
    ["Recruitment", ["Positions", "Applications"]],
    ["My division", ["Members", "Access", "Orders"]],
  ]);
});

test("My applications shows only to a viewer who has sent an application", () => {
  assert.deepEqual(shape("member", withoutApplications), [[null, ["Overview", "Team tree"]]]);
  assert.deepEqual(shape("non-member", withoutApplications), []);
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
