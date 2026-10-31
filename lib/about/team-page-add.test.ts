import assert from "node:assert/strict";
import { test } from "node:test";
import { arcLayout } from "@/components/about/arc-layout";
import { memoryContentStore } from "@/lib/content/memory";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { SEED_DATA, teamRolesOf } from "@/db/seed/cases";
import { team } from "./team";
import { ARC_LEADERS, NO_TEAM_LAYER, NO_UPLOADS, textOf } from "./team-layer";
import { bindingFor, holdingOf, layoutPageOf, nextSeatId, resolveLayout, sameBinding, snapshot, type TeamLayout } from "./team-layout";
import type { TeamRoles } from "./team-roles";
import { arcVisualOrder, readingIndexOfGap } from "./arc-order";
import {
  arcHasRoom,
  CHOOSE_A_PERSON,
  headBackToRecord,
  headFieldErrors,
  headFieldsOf,
  hideHead,
  isHeadEdited,
  layoutWithHead,
  layoutWithLeader,
  leaderFieldErrors,
  leaderFieldsOf,
  newDepartmentFields,
  newLeaderFields,
  pickedHead,
  pickedLeader,
  teamByName,
  withHeadPerson,
  withLeaderPerson,
  withNewLead,
  type HeadFields,
} from "./team-page-add";
import { editCount, editedTeamPage } from "./team-page-edit";
import { publicTeamPage, teamPageEditor, type TeamPagePhotos } from "./team-page-editor";
import { memoryTeamPageStore } from "./team-page-memory";
import type { StoredTeamPage } from "./team-page-stored";
import { advisorRowsOf } from "./advisors";
import { importedAdvisors } from "./advisors-import";

// What the Team page editor adds on the page (boards 80e, 80f and 80g,
// issues #285 and #851): a leader lands in the gap the editor clicked, on the
// desktop arc and in the phone grid alike, until the arc holds eight; added
// departments, division leads and head-block edits show on the page and the
// save writes the stored version alone. The team is the seeded one, read as
// the Team page reads it, and the layout is the one Reset to team writes.

const roles = teamRolesOf(SEED_DATA);
/** Photos that store nothing: no test here uploads one. */
const NO_PHOTOS: TeamPagePhotos = { put: async () => "/team/stand-in.webp", owns: NO_UPLOADS, adopt: async (photo) => photo, drop: async () => {}, gone: async () => [] };
const record = snapshot(roles, NO_TEAM_LAYER).layout;
const text = textOf(NO_TEAM_LAYER);
const siteContent: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: true, approveOrders: false };
const pageOf = (layout: TeamLayout) => layoutPageOf(roles, layout, text, team);

/** `layout` with a new leader added at `gap`, someone the page does not show on the arc yet, and the page seat id they take. */
function addAt(layout: TeamLayout, gap: number): { layout: TeamLayout; id: number } {
  const shown = new Set(resolveLayout(layout, roles).leaders.map((l) => l.shown.name));
  const person = teamByName(roles).find((p) => !shown.has(p.name))!;
  const fields = pickedLeader({ ...withLeaderPerson(roles, newLeaderFields(gap), person.id), role: "Lead" });
  assert.ok(fields);
  return { layout: layoutWithLeader(roles, layout, null, fields), id: nextSeatId(layout) };
}

/** Someone on the team to pick: the first by name. */
const someone = teamByName(roles)[0].id;

test("the arc's left-to-right order is the one components/about/arc-layout.ts draws", () => {
  for (let count = 1; count <= ARC_LEADERS; count++) {
    const nodes = arcLayout(count);
    const byX = nodes.map((n, i) => ({ x: n.x, i })).sort((a, b) => a.x - b.x).map(({ i }) => i);
    assert.deepEqual(arcVisualOrder(count), byX, `${count} leaders`);
  }
});

test("a leader added at either end or between any two neighbours is drawn at that place on the arc and in the phone grid", () => {
  let layout = record;
  for (let count = resolveLayout(layout, roles).leaders.length; count < ARC_LEADERS; count++) {
    for (let gap = 0; gap <= count; gap++) {
      const added = addAt(layout, gap);
      const leaders = resolveLayout(added.layout, roles).leaders;
      assert.equal(leaders.length, count + 1);
      const onArc = arcVisualOrder(count + 1).map((i) => leaders[i].at);
      assert.equal(onArc.indexOf(added.id), gap, `desktop: ${count} leaders, gap ${gap}`);
      // The phone grid draws reading order: the new leader is at the index the gap names.
      const index = leaders.findIndex((l) => l.at === added.id);
      assert.equal(index, readingIndexOfGap(gap, count), `phone: ${count} leaders, gap ${gap}`);
      assert.equal(editedTeamPage(roles, team, { layout: added.layout, text }).page.orgChart.leaders[index].role, "Lead");
      // Opened again, the panel reads the same place.
      assert.equal(leaderFieldsOf(roles, added.layout, added.id)?.gap, gap);
    }
    layout = addAt(layout, count).layout;
  }
  assert.equal(resolveLayout(layout, roles).leaders.length, ARC_LEADERS);
  assert.equal(arcHasRoom(layout), false, "the add affordances go at eight");
  assert.ok(leaderFieldErrors(layout, null, { person: roles.people[0].id, role: "Lead", gap: 0, photo: null, linkedin: "" }).arc);
});

/** The first department block the roles fill with at least two leads. */
const block = record.departments.find((b) => b.head.binding.kind === "department-head" && b.leads.length >= 2)!;
const divisionsOf = (layout: TeamLayout, id: number) =>
  resolveLayout(layout, roles)
    .departments.find((d) => d.at === id)!
    .leads.map((l) => l.shown.division);
const blockLeadIds = (layout: TeamLayout) => layout.departments.find((d) => d.id === block.id)!.leads.map((s) => s.id);

test("added departments, division leads and head-block edits show on the page, and the save writes the stored version alone", async () => {
  const before = structuredClone(roles);

  // Edit a head block: the role and department name on the page, the first lead removed, a lead added at the top.
  const opened = headFieldsOf(roles, record, block.id);
  assert.ok(opened);
  const withLead = withNewLead({ ...opened, role: "Chief of Propulsion", department: "Propulsion team", leads: opened.leads.slice(1) });
  const fresh = withLead.leads[withLead.leads.length - 1];
  const fields: HeadFields = { ...withLead, leads: [{ ...fresh, person: someone, division: "Test bench" }, ...withLead.leads.slice(0, -1)] };
  assert.deepEqual(headFieldErrors(false, fields), {});
  let layout = layoutWithHead(roles, record, block.id, pickedHead(fields)!);

  // Add a department with a head and one division lead.
  const added = withNewLead({ ...withHeadPerson(roles, newDepartmentFields(), someone), department: "Payload" });
  assert.ok(headFieldErrors(true, added).leads, "an added lead needs a division");
  const payload: HeadFields = { ...added, leads: added.leads.map((l) => ({ ...l, person: someone, division: "Experiments" })) };
  layout = layoutWithHead(roles, layout, null, pickedHead(payload)!);

  const shown = resolveLayout(layout, roles).departments;
  const edited = shown.find((d) => d.at === block.id)!;
  assert.equal(edited.name, "Propulsion team");
  assert.equal(edited.heads[0].shown.role, "Chief of Propulsion");
  assert.deepEqual(divisionsOf(layout, block.id), ["Test bench", ...divisionsOf(record, block.id).slice(1)], "the added lead first, the removed one gone");
  const last = shown[shown.length - 1];
  assert.equal(last.name, "Payload");
  assert.equal(last.heads[0].shown.role, "Head of Payload");
  assert.deepEqual(last.leads.map((l) => l.shown.division), ["Experiments"]);
  // Opened again, the panel reads what it wrote.
  assert.deepEqual(headFieldsOf(roles, layout, block.id)?.leads.map((l) => l.division), divisionsOf(layout, block.id));

  const store = memoryContentStore<StoredTeamPage>([]);
  const advisors = memoryContentStore(importedAdvisors());
  const editor = teamPageEditor(siteContent, memoryTeamPageStore(store, advisors), async () => roles, team, NO_PHOTOS);
  assert.ok((await editor.save("publish", { layout, text }, advisorRowsOf(await advisors.list()))).ok);
  const page = publicTeamPage(roles, team, await store.list());
  const heads = page.departments.groups.flatMap((g) => g.members);
  assert.ok(heads.some((m) => m.kind === "head" && m.role === "Chief of Propulsion"));
  assert.ok(heads.some((m) => m.kind === "head" && m.role === "Head of Payload"));
  assert.deepEqual(roles, before, "the team's roles, departments and divisions are untouched");
  assert.equal((await store.list()).length, 1, "one document, nothing else");
});

test("Hide from page takes a head block off the page or drops an added department; Back to the team record restores the roles' block", () => {
  const opened = headFieldsOf(roles, record, block.id)!;
  const layout = layoutWithHead(roles, record, block.id, { ...opened, department: "Renamed", leads: [] });
  assert.equal(isHeadEdited(roles, layout, block.id), true);
  const hidden = hideHead(layout, block.id);
  assert.equal(resolveLayout(hidden, roles).departments.find((d) => d.at === block.id), undefined);

  const back = headBackToRecord(roles, layout, block.id);
  assert.equal(isHeadEdited(roles, back, block.id), false);
  assert.deepEqual(pageOf(back), pageOf(record));

  const withDepartment = layoutWithHead(roles, record, null, pickedHead({ ...withHeadPerson(roles, newDepartmentFields(), someone), department: "Payload" })!);
  assert.equal(resolveLayout(withDepartment, roles).departments.at(-1)?.name, "Payload");
  assert.deepEqual(hideHead(withDepartment, nextSeatId(record)), record);
});

test("two lead rows picking the same division lead put one binding on the block twice, and Reset to team counts it without throwing", () => {
  const opened = headFieldsOf(roles, record, block.id)!;
  const [first, second, ...rest] = opened.leads;
  const firstSeat = block.leads.find((s) => s.id === first.at)!;
  assert.ok(sameBinding(bindingFor(roles.people.find((p) => p.id === first.person)!, roles), firstSeat.binding), "the first lead's own seat");
  const layout = layoutWithHead(roles, record, block.id, pickedHead({ ...opened, leads: [first, { ...second, person: first.person, division: first.division }, ...rest] })!);
  const [a, b] = layout.departments.find((d) => d.id === block.id)!.leads;
  assert.ok(sameBinding(a.binding, b.binding), "both rows hold one binding");
  assert.ok(editCount(roles, layout, record) > 0, "Reset to team would change the block");
});

test("Back to the team record keeps a lead page seat whose seat has no holder in its place, as Done does", () => {
  // A division with one lead, not the block's first: its seat has no holder once that lead leaves the team.
  const at = block.leads.findIndex(
    (seat, i) => i > 0 && seat.binding.kind === "division-lead" && !block.leads.some((s) => s.binding.kind === "division-lead" && seat.binding.kind === "division-lead" && s.binding.divisionId === seat.binding.divisionId && s.id !== seat.id),
  );
  assert.ok(at > 0, "the seeded block has such a lead");
  const lead = holdingOf(block.leads[at].binding, roles)!.person;
  const vacant: TeamRoles = { ...roles, people: roles.people.filter((p) => p.id !== lead.id) };

  const opened = headFieldsOf(vacant, record, block.id)!;
  const edited = layoutWithHead(vacant, record, block.id, pickedHead({ ...opened, department: "Renamed", leads: [...opened.leads].reverse() })!);
  assert.ok(blockLeadIds(edited).includes(block.leads[at].id), "Done keeps it");

  const back = headBackToRecord(vacant, edited, block.id);
  assert.deepEqual(blockLeadIds(back), block.leads.map((s) => s.id), "in its place, among the record's leads");
  assert.deepEqual(back.departments.find((d) => d.id === block.id)!.leads[at], block.leads[at]);
  assert.deepEqual(layoutPageOf(roles, back, text, team), pageOf(record), "shown again once the seat has a holder");
});

// Issue #618: a person field on the Team page editor starts with nobody
// picked, and a panel with nobody picked is refused with a field error and
// puts nothing on the page.

test("Add leader, Add department and a new lead row start with nobody picked, and are refused on the person field until someone is", () => {
  const leader = newLeaderFields(0);
  assert.equal(leader.person, null, "Add leader picks nobody");
  assert.equal(leaderFieldErrors(record, null, { ...leader, role: "Lead" }).person, CHOOSE_A_PERSON);
  assert.equal(pickedLeader(leader), null, "nothing reaches the layout");
  const picked = withLeaderPerson(roles, leader, someone);
  assert.equal(leaderFieldErrors(record, null, { ...picked, role: "Lead" }).person, undefined);

  const department = { ...newDepartmentFields(), department: "Payload" };
  assert.equal(department.person, null, "Add department picks no head");
  assert.equal(headFieldErrors(true, department).person, CHOOSE_A_PERSON);
  assert.equal(pickedHead(department), null, "nothing reaches the layout");

  const opened = headFieldsOf(roles, record, block.id)!;
  const withRow = withNewLead(opened);
  const row = withRow.leads.at(-1)!;
  assert.equal(row.person, null, "a new lead row picks nobody");
  assert.deepEqual(headFieldErrors(false, { ...withRow, leads: withRow.leads.map((l) => (l.key === row.key ? { ...l, division: "Test bench" } : l)) }).leads, {
    [row.key]: { person: CHOOSE_A_PERSON },
  });
  assert.deepEqual(layoutWithHead(roles, record, block.id, pickedHead(withRow)!), record, "the row with nobody picked is not on the page");
});
