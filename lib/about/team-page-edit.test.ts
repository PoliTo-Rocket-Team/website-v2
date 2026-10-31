import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_DATA, teamRolesOf } from "@/db/seed/cases";
import { NO_TEAM_LAYER, textOf } from "./team-layer";
import { bindingFor, snapshot, type TeamLayout } from "./team-layout";
import { team } from "./team";
import {
  backToTeamRecord,
  editCount,
  editedTeamPage,
  personFieldsOf,
  seatOfFields,
  spotRecord,
  withPerson,
  withPersonFields,
} from "./team-page-edit";
import type { TeamPageContent } from "./team-page-stored";
import { teamPageFromRoles } from "./team-roles";

// The Team page editor's Edit person panel (board 80b, issues #284 and #851):
// the fields make a page seat with only the overrides that differ from the
// team record, picking someone binds the place to the seat they hold, and
// Back to the team record removes the place's overrides so it shows its
// seat's holder again. The team is the seeded one, read as the Team page
// reads it, and the layout is the one Reset to team writes.

const roles = teamRolesOf(SEED_DATA);
const layout = snapshot(roles, NO_TEAM_LAYER).layout;
const text = textOf(NO_TEAM_LAYER);
const fromRoles = teamPageFromRoles(roles, team)!;
const leaderId = layout.leader!.id;
const arcId = layout.arc[0].id;
const pageOf = (content: TeamPageContent) => editedTeamPage(roles, team, content).page;
const shownIds = new Set([layout.leader!, ...layout.arc].map((seat) => spotRecord(roles, layout, seat.id)!.person.id));
const someoneElse = roles.people.find((p) => !shownIds.has(p.id))!;

test("the layout the editor opens on draws the page the roles build", () => {
  assert.deepEqual(pageOf({ layout, text }), fromRoles);
});

test("the panel's fields make only the overrides that differ from the team record: put back as the record has it, there is none", () => {
  const start = personFieldsOf(roles, layout, leaderId)!;
  assert.deepEqual(seatOfFields(roles, layout, leaderId, start), layout.leader, "the fields as opened change nothing");

  const renamed = { ...start, role: "President", name: `  ${start.name}  ` };
  assert.deepEqual(seatOfFields(roles, layout, leaderId, renamed)?.overrides, { role: "President" }, "an unchanged name is no override");

  // The team leader cannot be taken off the page; a place on the arc can.
  assert.deepEqual(seatOfFields(roles, layout, leaderId, { ...start, shown: false }), layout.leader);
  const arc = personFieldsOf(roles, layout, arcId)!;
  assert.equal(seatOfFields(roles, layout, arcId, { ...arc, shown: false }), null);
  assert.equal(withPersonFields(roles, layout, arcId, { ...arc, shown: false }).arc.length, layout.arc.length - 1);

  // Another person in the place takes their own name, and the place is bound to the seat they hold; the role on the page stays the place's.
  const swapped = withPerson(roles, arc, someoneElse.id);
  assert.equal(swapped.name, someoneElse.name);
  const seat = seatOfFields(roles, layout, arcId, swapped)!;
  assert.deepEqual(seat.binding, bindingFor(someoneElse, roles));
  const page = pageOf({ layout: withPersonFields(roles, layout, arcId, swapped), text });
  assert.equal(page.orgChart.leaders[0]?.name, someoneElse.name);
  assert.equal(page.orgChart.leaders[0]?.role, arc.role);
});

test("a place can be bound to any seat of the team record, a division lead the Team tree draws under a head included", () => {
  const lead = roles.people.find((p) => p.placement.role === "divisions" && p.placement.memberships.some((m) => m.role === "lead"))!;
  const head = roles.people.find((p) => p.placement.role === "head")!;
  for (const person of [lead, head]) {
    const fields = withPerson(roles, personFieldsOf(roles, layout, arcId)!, person.id);
    const seat = seatOfFields(roles, layout, arcId, fields)!;
    assert.equal(seat.binding.kind, person === lead ? "division-lead" : "department-head");
    const edited = withPersonFields(roles, layout, arcId, fields);
    assert.equal(spotRecord(roles, edited, arcId)?.person.id, person.id, "the place shows the seat's holder");
    assert.equal(pageOf({ layout: edited, text }).orgChart.leaders[0]?.name, person.name);
  }
});

test("Reset to team counts an edit whenever the arc, the department blocks or a block's leads hold the record's seats in another order", () => {
  assert.ok(layout.arc.length >= 2 && layout.departments.length >= 2, "the seeded layout has something to reorder");
  const block = layout.departments.find((b) => b.leads.length >= 2)!;
  const reordered: TeamLayout[] = [
    { ...layout, arc: [...layout.arc].reverse() },
    { ...layout, departments: [...layout.departments].reverse() },
    { ...layout, departments: layout.departments.map((b) => (b.id === block.id ? { ...b, leads: [...b.leads].reverse() } : b)) },
  ];
  for (const edited of reordered) {
    assert.notDeepEqual(pageOf({ layout: edited, text }), pageOf({ layout, text }), "Reset to team would change the page");
    assert.ok(editCount(roles, edited, layout) > 0);
  }
});

test("Back to the team record removes that place's overrides and leaves every other edit", () => {
  const leaderFields = personFieldsOf(roles, layout, leaderId)!;
  const arcFields = personFieldsOf(roles, layout, arcId)!;
  const content = { layout, text: { ...text, intro: "Edited intro." } };
  let edited = withPersonFields(roles, content.layout, leaderId, { ...leaderFields, role: "President" });
  edited = withPersonFields(roles, edited, arcId, { ...arcFields, name: "Someone Else", role: "Captain" });
  const page = pageOf({ ...content, layout: edited });
  assert.equal(page.orgChart.leader?.role, "President");
  assert.equal(page.orgChart.leaders[0]?.name, "Someone Else");
  assert.equal(editCount(roles, edited, layout), 2);

  const back = backToTeamRecord(edited, arcId);
  assert.deepEqual(back.arc, layout.arc, "the place holds no override");
  const after = pageOf({ ...content, layout: back });
  assert.deepEqual(after.orgChart.leaders, fromRoles.orgChart.leaders, "the arc shows the roles again");
  assert.equal(after.orgChart.leader?.role, "President", "the leader's edit stays");
  assert.equal(after.header.intro, "Edited intro.");

  // The team leader's place goes back to the team leader, whoever it was bound to.
  const rebound = withPersonFields(roles, back, leaderId, withPerson(roles, leaderFields, someoneElse.id));
  assert.equal(pageOf({ ...content, layout: rebound }).orgChart.leader?.name, someoneElse.name);
  assert.deepEqual(backToTeamRecord(rebound, leaderId), layout);
  assert.equal(editCount(roles, layout, layout), 0);
});
