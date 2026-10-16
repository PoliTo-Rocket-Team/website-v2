import assert from "node:assert/strict";
import { test } from "node:test";
import { dummyTeamRoles } from "@/lib/dummy-data/team-page";
import { NO_TEAM_LAYER, type TeamPageLayer } from "./team-layer";
import { team } from "./team";
import { backToTeamRecord, editedTeamPage, editOfFields, personFieldsOf, withPerson, withSpotEdit } from "./team-page-edit";
import { teamBuildOf, teamPageFromRoles } from "./team-roles";

// The Team page editor's Edit person panel (board 80b, issue #284): the
// fields make only the edit that differs from the team record, and Back to
// the team record removes the spot's edit so the spot shows the roles again.

const roles = dummyTeamRoles();
const build = teamBuildOf(roles);
const fromRoles = teamPageFromRoles(roles, team)!;
const arcSpot = build.arc[0].spot;
const someoneElse = build.people.find((p) => p.id !== build.leader?.person.id && p.id !== build.arc[0].person.id)!;

test("the panel's fields make only what differs from the team record: put back as the roles have it, there is no edit", () => {
  const start = personFieldsOf(build, NO_TEAM_LAYER, "leader")!;
  assert.deepEqual(editOfFields(build, "leader", start), {}, "the fields as opened are no edit");

  const renamed = { ...start, role: "President", name: `  ${start.name}  ` };
  assert.deepEqual(editOfFields(build, "leader", renamed), { role: "President" }, "an unchanged name is no edit");

  // The team leader cannot be hidden; a place on the arc can.
  assert.deepEqual(editOfFields(build, "leader", { ...start, shown: false }), {});
  const arc = personFieldsOf(build, NO_TEAM_LAYER, arcSpot)!;
  assert.deepEqual(editOfFields(build, arcSpot, { ...arc, shown: false }), { hidden: true });

  // Another person in the spot takes their own name; the role on the page stays the spot's.
  const swapped = withPerson(build, arc, someoneElse.id);
  assert.deepEqual(editOfFields(build, arcSpot, swapped), { person: someoneElse.id });
  assert.equal(swapped.name, someoneElse.name);
});

test("Back to the team record removes that spot's edits and leaves every other edit", () => {
  const leaderFields = personFieldsOf(build, NO_TEAM_LAYER, "leader")!;
  const arcFields = personFieldsOf(build, NO_TEAM_LAYER, arcSpot)!;
  let layer: TeamPageLayer = { ...NO_TEAM_LAYER, intro: "Edited intro." };
  layer = withSpotEdit(layer, "leader", editOfFields(build, "leader", { ...leaderFields, role: "President" }));
  layer = withSpotEdit(layer, arcSpot, editOfFields(build, arcSpot, withPerson(build, arcFields, someoneElse.id)));
  const edited = editedTeamPage(build, team, layer).page;
  assert.equal(edited.orgChart.leader.role, "President");
  assert.equal(edited.orgChart.leaders[0].name, someoneElse.name);

  const back = backToTeamRecord(layer, arcSpot);
  assert.deepEqual(back.spots, {}, "the spot holds no edit");
  const page = editedTeamPage(build, team, back).page;
  assert.deepEqual(page.orgChart.leaders, fromRoles.orgChart.leaders, "the arc shows the roles again");
  assert.equal(page.orgChart.leader.role, "President", "the leader's edit stays");
  assert.equal(page.header.intro, "Edited intro.");

  assert.deepEqual(backToTeamRecord(back, "leader").leader, {});
});
