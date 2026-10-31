import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_DATA, teamRolesOf } from "@/db/seed/cases";
import { NO_TEAM_LAYER, textOf } from "./team-layer";
import { parseTeamLayout, snapshot, type TeamLayout } from "./team-layout";
import { team } from "./team";
import { CHOOSE_A_GROUP, headFieldErrors, headFieldsOf, layoutWithHead, newDepartmentFields, pickedHead } from "./team-page-add";
import { editedTeamPage } from "./team-page-edit";
import { blocksIn, groupNameError, withGroupAdded, withGroupMoved, withGroupRenamed, withoutGroup } from "./team-page-groups";

// The Team page editor's department groups (issue #856): a group is added
// before or after any group or at the end, renamed, moved and deleted once
// empty; a department block is put in one group, and one the editor adds
// must be given one. The team is the seeded one; the layout is its snapshot.

const roles = teamRolesOf(SEED_DATA);
const layout = snapshot(roles, NO_TEAM_LAYER).layout;
const [technical, operations] = layout.groups;
const names = (of: TeamLayout) => of.groups.map((g) => g.name);
const headings = (of: TeamLayout) => [...new Set(editedTeamPage(roles, team, { layout: of, text: textOf(NO_TEAM_LAYER) }).page.departments.groups.map((g) => g.name))];

/** The layout a step answers, failing the test on a refusal. */
function done(step: { readonly ok: true; readonly layout: TeamLayout } | { readonly ok: false; readonly error: string }): TeamLayout {
  assert.ok(step.ok, step.ok ? "" : step.error);
  return step.layout;
}

test("a group is added before or after any group, or at the end, and keeps a valid layout", () => {
  assert.deepEqual(names(done(withGroupAdded(layout, { before: technical.id }, "Board"))), ["Board", "Technical Departments", "Operations"]);
  assert.deepEqual(names(done(withGroupAdded(layout, { after: technical.id }, "Board"))), ["Technical Departments", "Board", "Operations"]);
  assert.deepEqual(names(done(withGroupAdded(layout, { before: operations.id }, "Board"))), ["Technical Departments", "Board", "Operations"]);
  assert.deepEqual(names(done(withGroupAdded(layout, { after: operations.id }, "Board"))), ["Technical Departments", "Operations", "Board"]);
  assert.deepEqual(names(done(withGroupAdded(layout, "end", "Board"))), ["Technical Departments", "Operations", "Board"]);
  const added = withGroupAdded(layout, "end", "Board");
  assert.ok(added.ok && !layout.groups.some((g) => g.id === added.id), "a new group takes an id no group holds");
  assert.ok(added.ok && parseTeamLayout(JSON.parse(JSON.stringify(added.layout))) !== null);
  assert.deepEqual(headings(done(added)), headings(layout), "an empty group draws nothing");
});

test("a group is renamed, and the page draws the new name", () => {
  const renamed = withGroupRenamed(layout, technical.id, "Engineering");
  assert.deepEqual(names(renamed), ["Engineering", "Operations"]);
  assert.deepEqual(headings(renamed), ["Engineering", "Operations"]);
  assert.equal(groupNameError(" "), "Enter the group's name.");
  assert.equal(groupNameError("Engineering"), undefined);
  assert.equal(parseTeamLayout(withGroupRenamed(layout, technical.id, " ")), null, "a blank name is never stored");
});

test("a group is moved, and the page draws the groups in their new order", () => {
  const moved = withGroupMoved(layout, operations.id, 0);
  assert.deepEqual(names(moved), ["Operations", "Technical Departments"]);
  assert.deepEqual(headings(moved), ["Operations", "Technical Departments"]);
  assert.deepEqual(names(withGroupMoved(layout, technical.id, 9)), ["Operations", "Technical Departments"], "past the end is the end");
  assert.deepEqual(withGroupMoved(layout, 999, 0), layout, "a group the layout lacks moves nothing");
});

test("an empty group is deleted; one that still holds a department is refused with a message, as is the last group", () => {
  const held = blocksIn(layout, operations.id);
  assert.ok(held > 0, "the seeded Operations group holds a department");
  const refused = withoutGroup(layout, operations.id);
  assert.deepEqual(refused, {
    ok: false,
    error: held === 1 ? "Operations still holds a department. Move it to another group first." : `Operations still holds ${held} departments. Move them to another group first.`,
  });

  const emptied: TeamLayout = { ...layout, departments: layout.departments.map((b) => ({ ...b, group: technical.id })) };
  const deleted = done(withoutGroup(emptied, operations.id));
  assert.deepEqual(names(deleted), ["Technical Departments"]);
  assert.ok(parseTeamLayout(JSON.parse(JSON.stringify(deleted))) !== null);
  assert.deepEqual(withoutGroup({ ...deleted, departments: [] }, technical.id), { ok: false, error: "Keep at least one group." });
});

test("a department block sits under the group its panel picks, and one the editor adds must be given a group", () => {
  const block = layout.departments.find((b) => b.group === technical.id)!;
  const fields = headFieldsOf(roles, layout, block.id)!;
  assert.equal(fields.group, technical.id, "the panel opens on the block's group");
  const movedOver = layoutWithHead(roles, layout, block.id, pickedHead({ ...fields, group: operations.id })!);
  assert.equal(movedOver.departments.find((b) => b.id === block.id)?.group, operations.id);
  assert.equal(movedOver.departments.find((b) => b.id === block.id)?.leadsDrawn, block.leadsDrawn, "it keeps how it draws its leads");

  const person = roles.people[0].id;
  const adding = { ...newDepartmentFields(), person, department: "Outreach" };
  assert.equal(adding.group, null);
  assert.equal(headFieldErrors(true, adding).group, CHOOSE_A_GROUP);
  assert.equal(pickedHead(adding), null, "nothing reaches the page until a group is picked");
  const added = layoutWithHead(roles, layout, null, pickedHead({ ...adding, group: operations.id })!);
  const outreach = added.departments.at(-1)!;
  assert.deepEqual([outreach.name, outreach.group, outreach.leadsDrawn], ["Outreach", operations.id, "under"]);
  assert.equal(headFieldErrors(true, { ...adding, group: operations.id }).group, undefined);
  assert.deepEqual(layoutWithHead(roles, layout, null, pickedHead({ ...adding, group: 999 })!), layout, "a group the layout lacks adds nothing");
});
