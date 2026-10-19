import assert from "node:assert/strict";
import { test } from "node:test";
import { addMemberDivisions, ALL_TAB, departmentMembers, departmentTabs } from "./department-members";
import { NO_MEMBER_DETAILS } from "./details";
import type { PersonRecord } from "./division-members";
import { membershipsOf, type OrgChart } from "./team";

// Issue #235: a department head's Members page. Aerodynamics holds Mission
// Analysis (1) and Optimization (2); Structures holds Design & Manufacturing (3).
const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Structures", kind: "technical" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

function record(id: number, name: string, list: [divisionId: number, role: "lead" | "member", since: string][]): PersonRecord {
  return {
    id,
    name,
    signInEmail: `${id}@gmail.com`,
    photoUrl: null,
    since: 2024,
    memberships: membershipsOf(list.map(([divisionId, role, since]) => ({ divisionId, role, since }))),
    beyondDivisions: [],
    titles: {},
    advising: [],
    details: NO_MEMBER_DETAILS,
    nda: null,
  };
}

const records = [
  record(1, "Marco Bianchi", [[1, "lead", "2023-10-01"]]),
  record(2, "Lena Fischer", [[1, "member", "2024-10-01"], [2, "member", "2025-10-01"]]),
  record(3, "Davide Russo", [[1, "member", "2024-10-01"], [3, "member", "2023-10-01"]]),
  record(4, "Laura Greco", [[2, "lead", "2023-10-01"]]),
  record(5, "Federica Leone", [[3, "lead", "2023-10-01"]]),
];

const page = departmentMembers({
  records,
  org,
  departmentId: 1,
  actor: { kind: "head", departmentIds: [1] },
  selfId: null,
  waiting: { 1: [{ joinId: 9, email: "elena@x.it", name: null, title: null, details: NO_MEMBER_DETAILS }] },
  joining: {},
})!;

test("All divisions lists everyone in the department once, with Remove from each of their divisions there", () => {
  assert.deepEqual(page.everyone.map((p) => p.name), ["Marco Bianchi", "Laura Greco", "Davide Russo", "Lena Fischer"], "leads first, then by division and name; nobody from Structures only");
  const lena = page.everyone.find((p) => p.name === "Lena Fischer")!;
  assert.deepEqual(lena.removals.map((r) => [r.short, r.removal.kind]), [["Mission Analysis", "offered"], ["Optimization and Analysis", "offered"]]);
  const davide = page.everyone.find((p) => p.name === "Davide Russo")!;
  assert.deepEqual(davide.removals.map((r) => r.short), ["Mission Analysis"], "never a division outside the department");
  assert.deepEqual(davide.chips.map((c) => [c.label, c.code]), [["MA", true], ["Structures", false]], "another department shows its name, not a code");
  assert.equal(page.everyone.find((p) => p.name === "Marco Bianchi")!.removals[0].removal.kind, "only-division");
  assert.deepEqual(departmentTabs(page).map((t) => [t.label, t.count]), [["All divisions", 4], ["Mission Analysis", 4], ["Optimization and Analysis", 2]], "no Closed tab (#251)");
});

test("Add member's Division select lists only the department's divisions and starts on the open tab", () => {
  assert.deepEqual(addMemberDivisions(page, ALL_TAB), { divisions: page.tabs.map((t) => t.division), start: 1 });
  assert.deepEqual(addMemberDivisions(page, ALL_TAB).divisions.map((d) => d.code), ["MA", "OA"]);
  assert.equal(addMemberDivisions(page, { kind: "division", divisionId: 2 }).start, 2);
  assert.equal(addMemberDivisions(page, { kind: "division", divisionId: 3 }).start, 1, "a division outside the department is never the start");
});
