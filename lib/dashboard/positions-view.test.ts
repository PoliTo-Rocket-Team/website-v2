import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_POSITIONS_FILTER, POSITIONS_COLUMNS, POSITIONS_TOOLS, positionsModelOf, shownPositions, type PositionsFilter } from "./positions-view";
import type { PositionRow, PositionsPage } from "./recruitment";

// Issue #417: the team leader, the operations lead, the IT lead, a department
// head and a division lead open one Positions toolbar with the same columns;
// only the rows, and so the options its selects offer, differ. Aerodynamics
// holds Mission Analysis and Optimization; Structures holds Design & Manufacturing.
const MA = "Mission Analysis Division";
const OA = "Optimization and Analysis Division";
const DM = "Design & Manufacturing Division";

function position(id: number, title: string, division: string, department: string, open: boolean, applications: number | null): PositionRow {
  return {
    id,
    ref: String(id),
    title,
    division,
    department,
    open,
    applications: applications === null ? null : { total: applications, fresh: 0, quiet: null },
    updated: "2 days ago",
    code: `X-${id}`,
    content: { title, description: "", required: [], desirable: [], questions: [], motivationLetter: false },
  };
}

// Newest first, as the page reads them.
const trajectory = position(1, "Trajectory Engineer", MA, "Aerodynamics", true, 2);
const cfd = position(2, "CFD Analyst", OA, "Aerodynamics", false, 5);
const composites = position(3, "Composites Technician", DM, "Structures", true, 0);
const all = [trajectory, cfd, composites];
const newPosition = { divisions: [], nextId: 4 };

const wholeTeam: PositionsPage = { scope: "team", positions: all, newPosition };
const aerodynamics = {
  name: "Aerodynamics",
  divisions: [
    { id: 1, name: MA },
    { id: 2, name: OA },
  ],
};

// The full-access seats share the whole team's scope; the head and the lead read their own units.
const byRole: Record<string, PositionsPage> = {
  "team leader": wholeTeam,
  "operations lead": wholeTeam,
  "IT lead": wholeTeam,
  "department head": { scope: "department", department: aerodynamics, positions: [trajectory, cfd], newPosition },
  "division lead": { scope: "division", division: MA, positions: [trajectory], newPosition },
};

const ids = (p: PositionsPage, filter: PositionsFilter = NO_POSITIONS_FILTER) =>
  shownPositions(positionsModelOf(p).units, p.positions, filter).rows.map((r) => r.id);

test("every role that opens Positions gets the same tools and columns", () => {
  for (const [role, p] of Object.entries(byRole)) {
    const model = positionsModelOf(p);
    assert.deepEqual(model.tools, POSITIONS_TOOLS, role);
    assert.deepEqual(model.columns, POSITIONS_COLUMNS, role);
  }
});

test("the selects offer only the departments and divisions the viewer reaches", () => {
  assert.deepEqual(positionsModelOf(byRole["team leader"]).units, [
    { name: "Aerodynamics", divisions: [MA, OA] },
    { name: "Structures", divisions: [DM] },
  ]);
  assert.deepEqual(positionsModelOf(byRole["division lead"]).units, [{ name: "Aerodynamics", divisions: [MA] }]);
  // A head's division with no role yet is still offered, so the Overview's link finds it.
  const empty: PositionsPage = { scope: "department", department: aerodynamics, positions: [trajectory], newPosition };
  assert.deepEqual(positionsModelOf(empty).units, [{ name: "Aerodynamics", divisions: [MA, OA] }]);
});

test("the rows are those the viewer reaches, narrowed by the same toolbar for every role", () => {
  assert.deepEqual(ids(byRole["team leader"]), [1, 2, 3]);
  assert.deepEqual(ids(byRole["department head"]), [1, 2]);
  assert.deepEqual(ids(byRole["division lead"]), [1]);

  const division = { ...NO_POSITIONS_FILTER, division: MA };
  assert.deepEqual(ids(byRole["operations lead"], division), [1]);
  assert.deepEqual(ids(byRole["department head"], division), [1]);

  const search = { ...NO_POSITIONS_FILTER, query: "cfd" };
  assert.deepEqual(ids(byRole["IT lead"], search), [2]);
  assert.deepEqual(ids(byRole["division lead"], search), []);
});

test("a division left chosen outside the department reads as all divisions", () => {
  const p = byRole["team leader"];
  const shown = shownPositions(positionsModelOf(p).units, p.positions, { ...NO_POSITIONS_FILTER, department: "Structures", division: MA });
  assert.equal(shown.division, null);
  assert.deepEqual(
    shown.rows.map((r) => r.id),
    [3],
  );
});

test("the status counts follow the selects and search; the sort orders what is left", () => {
  const p = byRole["team leader"];
  const units = positionsModelOf(p).units;
  const shown = shownPositions(units, p.positions, { ...NO_POSITIONS_FILTER, department: "Aerodynamics", tab: "open" });
  assert.deepEqual(shown.counts, { all: 2, open: 1, closed: 1 });
  assert.deepEqual(
    shown.rows.map((r) => r.id),
    [1],
  );
  const order = (sort: PositionsFilter["sort"]) => ids(p, { ...NO_POSITIONS_FILTER, sort });
  assert.deepEqual(order("newest"), [1, 2, 3]);
  assert.deepEqual(order("oldest"), [3, 2, 1]);
  assert.deepEqual(order("title"), [2, 3, 1]);
  assert.deepEqual(order("applications"), [2, 1, 3]);
});

test("a role whose applications the viewer does not read sorts after every counted one, even one with none (issue #477)", () => {
  const uncounted = position(4, "Avionics Lead", MA, "Aerodynamics", true, null);
  const shown = shownPositions([], [uncounted, trajectory, composites], { ...NO_POSITIONS_FILTER, sort: "applications" });
  assert.deepEqual(
    shown.rows.map((r) => r.id),
    [1, 3, 4],
  );
});
