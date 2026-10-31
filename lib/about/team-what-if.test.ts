import assert from "node:assert/strict";
import { test } from "node:test";
import { arcLayout } from "@/components/about/arc-layout";
import { groupLayout } from "@/components/about/group-layout";
import { inDivisions, NO_MEMBERSHIPS, type Placement } from "@/lib/dashboard/team";
import { arcVisualOrder } from "./arc-order";
import { team } from "./team";
import { SLIDE_MEMBERS, SLIDES, teamPageFromRoles, type TeamPerson, type TeamRoles } from "./team-roles";
import type { DepartmentGroup, DepartmentHead, DivisionAsHead, UpTo } from "./types";

// The Team page's what-if layouts (issue #325): the counts boards 26b, 26d,
// 26e and 26f draw, laid out by the same functions the page renders with.

const since = "2024-10-01";

const headWithLeads = (n: number): DepartmentHead => ({
  kind: "head",
  name: `Head ${n}`,
  role: `Head of Department ${n}`,
  leads: [
    { name: `Lead ${n}a`, division: "Division A" },
    { name: `Lead ${n}b`, division: "Division B" },
  ],
});
const divisionAsHead = (n: number): DivisionAsHead => ({ kind: "division", name: `Person ${n}`, division: `Division ${n}` });
const group = <M extends DepartmentHead | DivisionAsHead>(name: string, members: readonly M[]): DepartmentGroup => ({
  name,
  members: members as unknown as UpTo<M, 10>,
});
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("board 26b: eight leaders sit on one symmetric arc, four each side of the team leader", () => {
  const nodes = arcLayout(8);
  assert.equal(nodes.length, 8);
  // The board's eight-leader size: smaller photos on a wider circle.
  assert.ok(nodes.every((n) => n.photo === 128));
  const leftToRight = arcVisualOrder(8).map((i) => nodes[i]);
  for (let k = 1; k < leftToRight.length; k++) assert.ok(leftToRight[k].x > leftToRight[k - 1].x);
  assert.equal(leftToRight.filter((n) => n.x < 0).length, 4);
  // Mirror pairs: the k-th from the left and from the right at one height.
  for (let k = 0; k < 4; k++) {
    const a = leftToRight[k];
    const b = leftToRight[7 - k];
    assert.ok(Math.abs(a.x + b.x) < 1e-6);
    assert.ok(Math.abs(a.y - b.y) < 1e-6);
  }
  // The four-leader arc of board 26 keeps its own, larger photos.
  assert.ok(arcLayout(4).every((n) => n.photo === 148));
});

test("board 26d, widened by issue #411: nine technical departments fill two wide columns, five rows", () => {
  const layout = groupLayout(group("Technical Departments", range(9).map(headWithLeads)));
  assert.equal(layout.columns, 2);
  assert.equal(layout.width, 1146);
  assert.equal(Math.ceil(9 / layout.columns), 5);
});

test("boards 26e and 26f: five groups each take their own grid in the carousel", () => {
  const groups = [
    group("Technical Departments", range(6).map(headWithLeads)),
    group("Operations", range(5).map(divisionAsHead)),
    group("Business & Sponsorship", range(5).map(divisionAsHead)),
    group("Outreach", range(5).map(divisionAsHead)),
    group("Software", range(5).map(divisionAsHead)),
  ];
  const layouts = groups.map(groupLayout);
  // Every group takes two columns: wide ones for heads with leads (issue #411).
  assert.ok(layouts.every((l) => l.columns === 2));
  assert.deepEqual(
    layouts.map((l) => Math.round(l.width)),
    [1146, 627, 627, 627, 627],
  );
});

test("the role build fills at most five carousel slides of up to ten heads", () => {
  const org: TeamRoles["org"] = {
    departments: range(52).map((id) => ({ id, name: `Department ${id}`, kind: "technical" as const })),
    divisions: range(52).map((id) => ({ id: 1000 + id, name: `Division ${id}`, departmentId: id })),
  };
  const person = (id: number, name: string, placement: Placement): TeamPerson => ({
    id,
    name,
    placement,
    pageTitle: null,
    photo: null,
    linkedin: null,
    teamEmail: null,
  });
  const people: TeamPerson[] = [
    person(1, "Leader", { role: "team-leader", memberships: NO_MEMBERSHIPS }),
    person(2, "Manager", { role: "board", seat: { roleId: 2, title: "Project Manager", flag: "project-manager", type: "core", since }, memberships: NO_MEMBERSHIPS }),
    ...range(52).map((d) =>
      person(100 + d, `Head ${String(d).padStart(2, "0")}`, {
        role: "head",
        departmentId: d,
        title: "",
        memberships: inDivisions([{ divisionId: 1000 + d, role: "lead", since }]).memberships,
      }),
    ),
    person(999, "Core Member", inDivisions([])),
  ];
  const page = teamPageFromRoles({ org, people }, team);
  assert.ok(page !== null);
  const { groups } = page.departments;
  assert.equal(groups.length, SLIDES);
  assert.ok(groups.every((g) => g.members.length === SLIDE_MEMBERS));
  // Ten heads with leads take two wide columns, five rows (issue #411).
  assert.ok(groups.every((g) => groupLayout(g).columns === 2 && groupLayout(g).width === 1146));
});
