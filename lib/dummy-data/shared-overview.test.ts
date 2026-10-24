import assert from "node:assert/strict";
import { test } from "node:test";
import type { TeamSideOverview } from "@/lib/dashboard/overview";
import { membershipsIn } from "@/lib/dashboard/team";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { personFor } from "./team";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import type { TestGrant } from "./test-grant";

// One Overview for every seat on the dummy side (issue #593), as on the
// database side: each seat keeps board 52's panels, a member reads the
// division board over their test grant, and the Members figure names the
// scope it counts.

type OnTeam = Exclude<TestViewer, "non-member" | "alumni">;

function overviewOf(view: OnTeam, grant: TestGrant | null = null): Promise<TeamSideOverview> {
  const data = dummyDashboardData(
    view,
    { current: dummyRecruitmentOf(undefined), save: async () => {} },
    { current: EMPTY_DUMMY_STATE, save: async () => {} },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    grant,
  );
  return data.overview();
}

test("every seat gets the personal panels: profile with Edit profile, Your page on the site, and a roster per division", async () => {
  for (const view of ["team-leader", "operations-lead", "department-head", "division-lead", "member"] as const) {
    const overview = await overviewOf(view);
    assert.equal(overview.person.edit?.label, "Edit profile", view);
    assert.equal(overview.checklist.title, "Your page on the site", view);
    for (const roster of overview.rosters) assert.ok(roster.people.some((p) => p.self), `${view}: they are on ${roster.title}`);
  }
  for (const view of ["division-lead", "member"] as const) {
    const divisions = membershipsIn(personFor[view].placement).map((m) => m.divisionId);
    assert.equal((await overviewOf(view)).rosters.length, divisions.length, `${view}: one roster per division they are in`);
  }
});

test("a member reads the division board over their grant: none without one, the Members figure with a Members grant", async () => {
  const plain = await overviewOf("member");
  assert.equal(plain.shape, "division");
  assert.deepEqual(plain.stats, []);
  assert.deepEqual(plain.access, { kind: "hint" });
  const own = await overviewOf("member", "members-view");
  assert.deepEqual(own.stats.map((s) => s.label), ["My division"]);
  assert.deepEqual(own.access.kind === "lines" ? own.access.lines.map((l) => l.area) : own.access.kind, ["members"]);
  const department = await overviewOf("member", "members-edit-department");
  assert.deepEqual(
    department.stats.map((s) => [s.label, s.detail.replace(/^\S+ /, "")]),
    [["Department", "in Aerodynamics"]],
  );
});

test("a Content grant has no figure card and still shows under Your access", async () => {
  const content = await overviewOf("member", "content");
  assert.deepEqual(content.stats, []);
  assert.deepEqual(content.access.kind === "lines" ? content.access.lines.map((l) => l.area) : content.access.kind, ["content"]);
});

test("a lead's Members figure names their own division; a lead with no grant gets no access hint", async () => {
  const lead = await overviewOf("division-lead");
  assert.equal(lead.stats.at(-1)?.label, "My division");
  assert.deepEqual(lead.access, { kind: "none" });
});
