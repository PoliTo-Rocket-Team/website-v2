import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApplicationStage } from "./application-flow";
import { APPLICATIONS_TOOLS, applicationsModelOf, NO_APPLICATIONS_FILTER, shownApplications } from "./applications-view";
import type { ApplicationsPage, ApplicationsScope } from "./recruitment";

// Issue #416: the team leader, the operations lead, the IT lead, a department
// head and a division lead open one Applications toolbar; only the rows, and
// so the options its selects offer, differ. Aerodynamics holds Mission
// Analysis and Optimization; Structures holds Design & Manufacturing.
const ma = { ref: "ma-trajectory", title: "Trajectory Engineer", division: "Mission Analysis Division", department: "Aerodynamics" };
const oa = { ref: "oa-cfd", title: "CFD Analyst", division: "Optimization and Analysis Division", department: "Aerodynamics" };
const dm = { ref: "dm-composites", title: "Composites Technician", division: "Design & Manufacturing Division", department: "Structures" };

function page(scope: ApplicationsScope, positions: ApplicationsPage["positions"]): ApplicationsPage {
  return { scope, now: "2026-10-19T09:00:00.000Z", positions, applications: [] };
}

const wholeTeam = page({ kind: "team" }, [ma, oa, dm]);
const aerodynamics = {
  name: "Aerodynamics",
  divisions: [
    { id: 1, name: ma.division },
    { id: 2, name: oa.division },
  ],
};

// The full-access seats share the whole team's scope; the head and the lead read their own units.
const byRole = {
  "team leader": wholeTeam,
  "operations lead": wholeTeam,
  "IT lead": wholeTeam,
  "department head": page({ kind: "department", department: aerodynamics }, [ma, oa]),
  "division lead": page({ kind: "division", division: ma.division }, [ma]),
};

function row(id: number, name: string, position: typeof ma, stage: ApplicationStage = "new") {
  return { id, state: { stage }, applicant: { name, email: `${name.split(" ")[0].toLowerCase()}@studenti.polito.it` }, position };
}

// Newest first, as the page reads them.
const rows = [row(1, "Sara Conti", ma), row(2, "Bruno Ricci", oa, "interview"), row(3, "Anna Moretti", dm), row(4, "Ugo Neri", ma, "rejected")];

test("every role that opens Applications gets the same tools and views", () => {
  for (const [role, p] of Object.entries(byRole)) {
    assert.deepEqual(applicationsModelOf(p).tools, APPLICATIONS_TOOLS, role);
  }
});

test("the selects offer only the departments and divisions the viewer's positions sit in", () => {
  assert.deepEqual(applicationsModelOf(byRole["team leader"]).units, [
    { name: "Aerodynamics", divisions: [ma.division, oa.division] },
    { name: "Structures", divisions: [dm.division] },
  ]);
  assert.deepEqual(applicationsModelOf(byRole["department head"]).units, [{ name: "Aerodynamics", divisions: [ma.division, oa.division] }]);
  assert.deepEqual(applicationsModelOf(byRole["division lead"]).units, [{ name: "Aerodynamics", divisions: [ma.division] }]);
});

test("the rows are those the viewer's positions hold, narrowed by the same toolbar for every role", () => {
  const ids = (p: ApplicationsPage, filter = NO_APPLICATIONS_FILTER) =>
    shownApplications(p, applicationsModelOf(p).units, rows, filter).rows.map((r) => r.id);
  assert.deepEqual(ids(byRole["team leader"]), [1, 2, 3, 4]);
  assert.deepEqual(ids(byRole["department head"]), [1, 2, 4]);
  assert.deepEqual(ids(byRole["division lead"]), [1, 4]);

  const division = { ...NO_APPLICATIONS_FILTER, division: ma.division };
  assert.deepEqual(ids(byRole["operations lead"], division), [1, 4]);
  assert.deepEqual(ids(byRole["department head"], division), [1, 4]);

  const search = { ...NO_APPLICATIONS_FILTER, query: "cfd" };
  assert.deepEqual(ids(byRole["IT lead"], search), [2]);
  assert.deepEqual(ids(byRole["division lead"], search), []);
});

test("a division or position left chosen outside the department reads as all", () => {
  const p = byRole["team leader"];
  const shown = shownApplications(p, applicationsModelOf(p).units, rows, {
    ...NO_APPLICATIONS_FILTER,
    department: "Structures",
    division: ma.division,
    position: ma.ref,
  });
  assert.equal(shown.division, null);
  assert.equal(shown.position, null);
  assert.deepEqual(
    shown.rows.map((r) => r.id),
    [3],
  );
});

test("the stage counts follow the selects and search; the sort orders what is left", () => {
  const p = byRole["team leader"];
  const units = applicationsModelOf(p).units;
  const shown = shownApplications(p, units, rows, { ...NO_APPLICATIONS_FILTER, department: "Aerodynamics" });
  assert.equal(shown.counts.all, 3);
  assert.equal(shown.counts.interview, 1);
  const order = (sort: "newest" | "oldest" | "name") => shownApplications(p, units, rows, { ...NO_APPLICATIONS_FILTER, sort }).rows.map((r) => r.id);
  assert.deepEqual(order("newest"), [1, 2, 3, 4]);
  assert.deepEqual(order("oldest"), [4, 3, 2, 1]);
  assert.deepEqual(order("name"), [3, 2, 1, 4]);
});
