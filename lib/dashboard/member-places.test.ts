import assert from "node:assert/strict";
import { test } from "node:test";
import { placeHeaderLine, placesOf } from "./member-places";
import { membershipsOf, type OrgChart } from "./team";

// The member panel's Placement (board 98, issue #647): a head and a
// team-level seat holder hold no division, and are listed by their seat with
// its stored title, never shown an empty section.

const org: OrgChart = {
  departments: [{ id: 1, name: "Operations", kind: "operations", code: "OPS" }],
  divisions: [{ id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" }],
};

const none = { memberships: membershipsOf([]), titles: {}, advising: [] };

test("a department head and a team-level seat holder each get one row, with the stored title", () => {
  const head = placesOf({ ...none, beyondDivisions: [{ kind: "head", departmentId: 1, title: "" }] }, org);
  assert.deepEqual(head, [{ title: "Head of Operations", unit: null, code: "OPS", tag: "head" }]);
  const seat = placesOf({ ...none, beyondDivisions: [{ kind: "board", seat: { roleId: 9, title: "Chief Engineer", flag: "chief-engineer", type: "core", since: "2025-10-01" } }] }, org);
  assert.deepEqual(seat, [{ title: "Chief Engineer", unit: null, code: null, tag: "seat" }]);
});

test("a lead's row carries their stored title and the unit, and heads the panel's line", () => {
  const lead = placesOf({ ...none, memberships: membershipsOf([{ divisionId: 1, role: "lead", since: "2024-10-01" }]), titles: { 1: "Mission Analysis Lead" }, beyondDivisions: [] }, org);
  assert.deepEqual(lead, [{ title: "Mission Analysis Lead", unit: "Operations · Mission Analysis", code: "MA", tag: "lead" }]);
  assert.equal(placeHeaderLine(lead, 2024), "Mission Analysis Lead · member since 2024");
});
