import assert from "node:assert/strict";
import { test } from "node:test";
import { arcLayout } from "@/components/about/arc-layout";
import { memoryContentStore } from "@/lib/content/memory";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyTeamRoles } from "@/lib/dummy-data/team-page";
import { team } from "./team";
import { applyLayer, ARC_LEADERS, nextAddedId, NO_TEAM_LAYER, type AddedRef, type TeamPageLayer } from "./team-layer";
import { arcVisualOrder, readingIndexOfGap } from "./arc-order";
import {
  arcHasRoom,
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
  withNewLead,
  type HeadFields,
} from "./team-page-add";
import { editedTeamPage } from "./team-page-edit";
import { publicTeamPage, teamPageEditor } from "./team-page-editor";
import { memoryTeamPageStore } from "./team-page-memory";
import { advisorRowsOf } from "./advisors";
import { importedAdvisors } from "./advisors-import";
import { teamBuildOf } from "./team-roles";

// What the Team page editor adds on the page (boards 80e, 80f and 80g, issue
// #285): a leader lands in the gap the editor clicked, on the desktop arc and
// in the phone grid alike, until the arc holds eight; added departments,
// division leads and head-block edits show on the page and the save writes
// the layer alone.

const roles = dummyTeamRoles();
const build = teamBuildOf(roles);
const siteContent: ViewerStanding = { kind: "member", siteContent: true, approveOrders: false };

/** `layer` with a new leader added at `gap`, and the ref they take. */
function addAt(layer: TeamPageLayer, gap: number): { layer: TeamPageLayer; ref: AddedRef } {
  const fields = newLeaderFields(build, layer, gap);
  assert.ok(fields);
  return { layer: layerWithLeader(build, layer, null, { ...fields, role: "Lead" }), ref: `added:${nextAddedId(layer)}` };
}

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
  const withLead = withNewLead(build, { ...opened, role: "Chief of Propulsion", department: "Propulsion team", leads: opened.leads.slice(1) });
  const fresh = withLead.leads[withLead.leads.length - 1];
  const fields: HeadFields = { ...withLead, leads: [{ ...fresh, division: "Test bench" }, ...withLead.leads.slice(0, -1)] };
  assert.deepEqual(headFieldErrors(headSpot, fields), {});
  let layer = layerWithHead(build, NO_TEAM_LAYER, headSpot, fields);

  // Add a department with a head and one division lead.
  const added = withNewLead(build, { ...newDepartmentFields(build)!, department: "Payload" });
  assert.ok(headFieldErrors(null, added).leads, "an added lead needs a division");
  const payload: HeadFields = { ...added, leads: added.leads.map((l) => ({ ...l, division: "Experiments" })) };
  layer = layerWithHead(build, layer, null, payload);

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

  const store = memoryContentStore<TeamPageLayer>([]);
  const advisors = memoryContentStore(importedAdvisors());
  const editor = teamPageEditor(siteContent, memoryTeamPageStore(store, advisors), async () => roles, team);
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

  const withDepartment = layerWithHead(build, NO_TEAM_LAYER, null, { ...newDepartmentFields(build)!, department: "Payload" });
  const ref = applyLayer(build, withDepartment).departments.at(-1)!.at as AddedRef;
  assert.deepEqual(hideHead(withDepartment, ref), NO_TEAM_LAYER);
});
