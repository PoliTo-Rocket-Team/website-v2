import assert from "node:assert/strict";
import { test } from "node:test";
import { arcLayout } from "@/components/about/arc-layout";
import { memoryContentStore } from "@/lib/content/memory";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { SEED_DATA, teamRolesOf } from "@/db/seed/cases";
import { team } from "./team";
import { applyLayer, ARC_LEADERS, nextAddedId, NO_TEAM_LAYER, NO_UPLOADS, type AddedRef, type TeamPageLayer } from "./team-layer";
import { arcVisualOrder, readingIndexOfGap } from "./arc-order";
import {
  arcHasRoom,
  CHOOSE_A_PERSON,
  headBackToRecord,
  headFieldErrors,
  headFieldsOf,
  hideHead,
  layerWithHead,
  layerWithLeader,
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
import { editedTeamPage } from "./team-page-edit";
import { publicTeamPage, teamPageEditor, type TeamPagePhotos } from "./team-page-editor";
import { memoryTeamPageStore } from "./team-page-memory";
import type { StoredTeamPage } from "./team-page-stored";
import { advisorRowsOf } from "./advisors";
import { importedAdvisors } from "./advisors-import";
import { teamBuildOf } from "./team-roles";

// What the Team page editor adds on the page (boards 80e, 80f and 80g, issue
// #285): a leader lands in the gap the editor clicked, on the desktop arc and
// in the phone grid alike, until the arc holds eight; added departments,
// division leads and head-block edits show on the page and the save writes
// the layer alone. The team is the seeded one, read as the Team page reads it.

const roles = teamRolesOf(SEED_DATA);
/** Photos that store nothing: no test here uploads one. */
const NO_PHOTOS: TeamPagePhotos = { put: async () => "/team/stand-in.webp", owns: NO_UPLOADS, adopt: async (photo) => photo, drop: async () => {}, gone: async () => [] };
const build = teamBuildOf(roles);
const siteContent: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: true, approveOrders: false };

/** `layer` with a new leader added at `gap`, someone the page does not show on the arc yet, and the ref they take. */
function addAt(layer: TeamPageLayer, gap: number): { layer: TeamPageLayer; ref: AddedRef } {
  const shown = new Set(applyLayer(build, layer).leaders.map((l) => l.shown.name));
  const person = teamByName(build).find((p) => !shown.has(p.name))!;
  const fields = pickedLeader({ ...withLeaderPerson(build, newLeaderFields(gap), person.id), role: "Lead" });
  assert.ok(fields);
  return { layer: layerWithLeader(build, layer, null, fields), ref: `added:${nextAddedId(layer)}` };
}

/** Someone on the team to pick: the first by name. */
const someone = teamByName(build)[0].id;

test("the arc's left-to-right order is the one components/about/arc-layout.ts draws", () => {
  for (let count = 1; count <= ARC_LEADERS; count++) {
    const nodes = arcLayout(count);
    const byX = nodes.map((n, i) => ({ x: n.x, i })).sort((a, b) => a.x - b.x).map(({ i }) => i);
    assert.deepEqual(arcVisualOrder(count), byX, `${count} leaders`);
  }
});

test("a leader added at either end or between any two neighbours is drawn at that place on the arc and in the phone grid", () => {
  let layer = NO_TEAM_LAYER;
  for (let count = applyLayer(build, layer).leaders.length; count < ARC_LEADERS; count++) {
    for (let gap = 0; gap <= count; gap++) {
      const added = addAt(layer, gap);
      const leaders = applyLayer(build, added.layer).leaders;
      assert.equal(leaders.length, count + 1);
      const onArc = arcVisualOrder(count + 1).map((i) => leaders[i].at);
      assert.equal(onArc.indexOf(added.ref), gap, `desktop: ${count} leaders, gap ${gap}`);
      // The phone grid draws reading order: the new leader is at the index the gap names.
      const index = leaders.findIndex((l) => l.at === added.ref);
      assert.equal(index, readingIndexOfGap(gap, count), `phone: ${count} leaders, gap ${gap}`);
      assert.equal(editedTeamPage(build, team, added.layer).page.orgChart.leaders[index].role, "Lead");
      // Opened again, the panel reads the same place.
      assert.equal(leaderFieldsOf(build, added.layer, Number(added.ref.slice(6)))?.gap, gap);
    }
    layer = addAt(layer, count).layer;
  }
  assert.equal(applyLayer(build, layer).leaders.length, ARC_LEADERS);
  assert.equal(arcHasRoom(build, layer), false, "the add affordances go at eight");
  assert.ok(leaderFieldErrors(build, layer, null, { person: build.people[0].id, role: "Lead", gap: 0, photo: null, linkedin: "" }).arc);
});

/** The first department the roles build with at least two leads. */
const department = build.departments.find((d) => d.leads.length >= 2)!;
const headSpot = department.heads[0].spot;

test("added departments, division leads and head-block edits show on the page, and the save writes the layer alone", async () => {
  const before = structuredClone(roles);

  // Edit a head block: the role and department name on the page, the first lead removed, a lead added at the top.
  const opened = headFieldsOf(build, NO_TEAM_LAYER, headSpot);
  assert.ok(opened);
  const withLead = withNewLead({ ...opened, role: "Chief of Propulsion", department: "Propulsion team", leads: opened.leads.slice(1) });
  const fresh = withLead.leads[withLead.leads.length - 1];
  const fields: HeadFields = { ...withLead, leads: [{ ...fresh, person: someone, division: "Test bench" }, ...withLead.leads.slice(0, -1)] };
  assert.deepEqual(headFieldErrors(headSpot, fields), {});
  let layer = layerWithHead(build, NO_TEAM_LAYER, headSpot, pickedHead(fields)!);

  // Add a department with a head and one division lead.
  const added = withNewLead({ ...withHeadPerson(build, newDepartmentFields(), someone), department: "Payload" });
  assert.ok(headFieldErrors(null, added).leads, "an added lead needs a division");
  const payload: HeadFields = { ...added, leads: added.leads.map((l) => ({ ...l, person: someone, division: "Experiments" })) };
  layer = layerWithHead(build, layer, null, pickedHead(payload)!);

  const shown = applyLayer(build, layer).departments;
  const edited = shown.find((d) => d.at === department.id)!;
  assert.equal(edited.name, "Propulsion team");
  assert.equal(edited.heads[0].shown.role, "Chief of Propulsion");
  assert.deepEqual(
    edited.leads.map((l) => l.shown.division),
    ["Test bench", ...department.leads.slice(1).map((l) => l.division)],
    "the added lead first, the removed one gone",
  );
  const last = shown[shown.length - 1];
  assert.equal(last.name, "Payload");
  assert.equal(last.heads[0].shown.role, "Head of Payload");
  assert.deepEqual(last.leads.map((l) => l.shown.division), ["Experiments"]);
  // Opened again, the panel reads what it wrote.
  assert.deepEqual(headFieldsOf(build, layer, headSpot)?.leads.map((l) => l.division), edited.leads.map((l) => l.shown.division));

  const store = memoryContentStore<StoredTeamPage>([]);
  const advisors = memoryContentStore(importedAdvisors());
  const editor = teamPageEditor(siteContent, memoryTeamPageStore(store, advisors), async () => roles, team, NO_PHOTOS);
  assert.ok((await editor.save("publish", layer, advisorRowsOf(await advisors.list()))).ok);
  const page = publicTeamPage(roles, team, await store.list());
  const heads = page.departments.groups.flatMap((g) => g.members);
  assert.ok(heads.some((m) => m.kind === "head" && m.role === "Chief of Propulsion"));
  assert.ok(heads.some((m) => m.kind === "head" && m.role === "Head of Payload"));
  assert.deepEqual(roles, before, "the team's roles, departments and divisions are untouched");
  assert.equal((await store.list()).length, 1, "one layer document, nothing else");
});

test("Hide from page hides a head block or drops an added department; Back to the team record restores the roles' block", () => {
  const opened = headFieldsOf(build, NO_TEAM_LAYER, headSpot)!;
  const layer = layerWithHead(build, NO_TEAM_LAYER, headSpot, { ...opened, department: "Renamed", leads: [] });
  const hidden = hideHead(layer, headSpot);
  assert.equal(applyLayer(build, hidden).departments.find((d) => d.at === department.id)?.heads.length, 0);

  const back = headBackToRecord(build, layer, headSpot);
  assert.deepEqual(back, NO_TEAM_LAYER);

  const withDepartment = layerWithHead(build, NO_TEAM_LAYER, null, pickedHead({ ...withHeadPerson(build, newDepartmentFields(), someone), department: "Payload" })!);
  const ref = applyLayer(build, withDepartment).departments.at(-1)!.at as AddedRef;
  assert.deepEqual(hideHead(withDepartment, ref), NO_TEAM_LAYER);
});

// Issue #618: a person field on the Team page editor starts with nobody
// picked, and a panel with nobody picked is refused with a field error and
// puts nothing on the page.

test("Add leader, Add department and a new lead row start with nobody picked, and are refused on the person field until someone is", () => {
  const leader = newLeaderFields(0);
  assert.equal(leader.person, null, "Add leader picks nobody");
  assert.equal(leaderFieldErrors(build, NO_TEAM_LAYER, null, { ...leader, role: "Lead" }).person, CHOOSE_A_PERSON);
  assert.equal(pickedLeader(leader), null, "nothing reaches the layer");
  const picked = withLeaderPerson(build, leader, someone);
  assert.equal(leaderFieldErrors(build, NO_TEAM_LAYER, null, { ...picked, role: "Lead" }).person, undefined);

  const department = { ...newDepartmentFields(), department: "Payload" };
  assert.equal(department.person, null, "Add department picks no head");
  assert.equal(headFieldErrors(null, department).person, CHOOSE_A_PERSON);
  assert.equal(pickedHead(department), null, "nothing reaches the layer");

  const opened = headFieldsOf(build, NO_TEAM_LAYER, headSpot)!;
  const withRow = withNewLead(opened);
  const row = withRow.leads.at(-1)!;
  assert.equal(row.person, null, "a new lead row picks nobody");
  assert.deepEqual(headFieldErrors(headSpot, { ...withRow, leads: withRow.leads.map((l) => (l.key === row.key ? { ...l, division: "Test bench" } : l)) }).leads, {
    [row.key]: { person: CHOOSE_A_PERSON },
  });
  assert.deepEqual(layerWithHead(build, NO_TEAM_LAYER, headSpot, pickedHead(withRow)!), NO_TEAM_LAYER, "the row with nobody picked is not on the page");
});
