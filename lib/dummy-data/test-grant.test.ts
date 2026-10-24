import assert from "node:assert/strict";
import { test } from "node:test";
import { canReach, sidebarFor } from "@/lib/dashboard/access";
import type { MemberDirectory } from "@/lib/dashboard/team";
import { NO_EDITS } from "./edits";
import { dummyViewer } from "./index";
import { dummyTeamPages } from "./team-pages";
import { TEST_GRANTS, type TestGrant } from "./test-grant";

// Issue #351: the member test viewer holding a Members grant sees the Members
// page as the database side builds it for a grant holder.

function members(grant: TestGrant) {
  return dummyTeamPages("member", NO_EDITS, async () => assert.fail("nothing is saved"), undefined, undefined, undefined, grant);
}

function divisionPage(directory: MemberDirectory) {
  if (directory.scope !== "division") throw new Error(`expected a division page, got ${directory.scope}`);
  return directory;
}

/** The test grants on Members; the Content one is below. */
const MEMBERS_GRANTS = TEST_GRANTS.filter((grant) => grant !== "content");

test("the member holding a Members test grant is granted Members, so their sidebar lists Members and no other grant page (issue #471)", () => {
  for (const grant of MEMBERS_GRANTS) {
    const viewer = dummyViewer("member", [], grant);
    assert.deepEqual(viewer.kind === "member" ? viewer.grantedAreas : null, ["members"], grant);
    const listed = sidebarFor(viewer, { counts: {}, hasShownApplications: false }).flatMap((s) => s.items.map((item) => item.key));
    const grantPages = ["positions", "applications", "members", "division-access", "orders"] as const;
    assert.deepEqual(listed.filter((key) => (grantPages as readonly string[]).includes(key)), ["members"], grant);
    assert.deepEqual(grantPages.filter((key) => canReach(viewer, key)), ["members"], grant);
  }
});

test("the member holding the Content test grant holds Content alone: the Content group with Alumni, and no grant page (issues #504, #589)", () => {
  const viewer = dummyViewer("member", [], "content");
  assert.ok(viewer.kind === "member" && viewer.siteContent && viewer.grantedAreas.length === 0);
  const content = sidebarFor(viewer, { counts: {}, hasShownApplications: false }).find((s) => s.group === "content");
  assert.deepEqual(content?.items.map((item) => item.label), ["Projects", "Outreach", "Partners", "Alumni", "FAQ", "Team page"]);
  for (const key of ["positions", "applications", "members", "division-access", "orders"] as const) assert.equal(canReach(viewer, key), false, key);
});

test("a member with Members at Can view sees their division's people and no action", async () => {
  const view = members("members-view");
  const page = divisionPage(await view.members());
  assert.equal(page.division.id, 1);
  assert.equal(page.editable, false);
  assert.ok(page.people.length > 0);
  assert.ok(page.people.every((p) => p.removal.kind === "not-in-reach" && !p.leave.allowed));
  assert.deepEqual(await view.findForAdd(1, "marco"), { kind: "none" }, "nor may they add anyone");
});

test("a member with Members at Can edit across Aerodynamics changes people in each of its divisions", async () => {
  const view = members("members-edit-department");
  for (const divisionId of [1, 2]) {
    const page = divisionPage(await view.members(divisionId));
    assert.equal(page.division.id, divisionId);
    assert.equal(page.editable, true);
    assert.deepEqual(page.divisions.map((d) => d.id), [1, 2], "the switch lists both divisions");
    assert.ok(page.people.some((p) => p.removal.kind !== "not-in-reach"));
  }
});
