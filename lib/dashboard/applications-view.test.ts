import assert from "node:assert/strict";
import { test } from "node:test";
import { APPLICATION_TABS, type ApplicationState } from "./application-flow";
import { BUILT_IN_STATUS_KEYS, type BuiltInStatusKey } from "./application-status";
import { APPLICATIONS_TOOLS, applicationsModelOf, NO_APPLICATIONS_FILTER, panelStepsOf, shownApplications } from "./applications-view";
import type { ApplicationsPage, ApplicationsScope } from "./recruitment";

// Issue #416: the team leader, the operations lead, the IT lead, a department
// head and a division lead open one Applications toolbar; only the rows, and
// so the options its selects offer, differ. Aerodynamics holds Mission
// Analysis and Optimization; Structures holds Design & Manufacturing.
const ma = { ref: "ma-trajectory", title: "Trajectory Engineer", division: "Mission Analysis Division", department: "Aerodynamics" };
const oa = { ref: "oa-cfd", title: "CFD Analyst", division: "Optimization and Analysis Division", department: "Aerodynamics" };
const dm = { ref: "dm-composites", title: "Composites Technician", division: "Design & Manufacturing Division", department: "Structures" };

function page(scope: ApplicationsScope, positions: ApplicationsPage["positions"]): ApplicationsPage {
  return { scope, now: "2026-10-19T09:00:00.000Z", positions, statuses: [], teamLeader: false, statusUses: null, acceptanceEmails: null, applications: [] };
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

function row(id: number, name: string, position: typeof ma, status: BuiltInStatusKey = "new") {
  return { id, state: { status }, applicant: { name, email: `${name.split(" ")[0].toLowerCase()}@studenti.polito.it` }, position };
}

/** The team leader, and any other approver, as the status list's team-leader rule reads them. */
const LEADER = { teamLeader: true };
const APPROVER = { teamLeader: false };

// Newest first, as the page reads them.
const rows = [row(1, "Sara Conti", ma), row(2, "Bruno Ricci", oa, "interview"), row(3, "Anna Moretti", dm), row(4, "Ugo Neri", ma, "rejected_email_to_be_sent")];

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

test("the status counts follow the selects and search; the sort orders what is left", () => {
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

test("a grant holder's line names the grant's reach, never their own division; the other lines stay (issue #577)", () => {
  const intro = (scope: ApplicationsScope) => applicationsModelOf(page(scope, [ma])).intro;
  assert.equal(intro({ kind: "granted", reach: { kind: "team" } }), "Applications for every role in the team.");
  assert.equal(
    intro({ kind: "granted", reach: { kind: "places", places: [{ kind: "department", name: "Propulsion" }] } }),
    "Applications for roles in the Propulsion Department.",
  );
  assert.equal(
    intro({ kind: "granted", reach: { kind: "places", places: [{ kind: "division", name: "Test Bench" }] } }),
    "Applications for roles in the Test Bench.",
  );
  // Full access, a head and a lead read as before.
  assert.equal(applicationsModelOf(byRole["team leader"]).intro, "Applications for the positions you lead.");
  assert.equal(applicationsModelOf(byRole["department head"]).intro, "Applications for Aerodynamics Department roles. Pick a division to narrow the list.");
  assert.equal(applicationsModelOf(byRole["division lead"]).intro, `Applications for ${ma.division} roles.`);
});

test("the tabs follow the status list: no In review tab, and every built-in status counts under one tab (ruling R1.2 on #745)", () => {
  assert.ok(!APPLICATION_TABS.some((t) => t.label === "In review"));
  const p = byRole["team leader"];
  const everyStatus = BUILT_IN_STATUS_KEYS.map((status, i) => row(10 + i, `Person ${i}`, ma, status));
  const { counts } = shownApplications(p, applicationsModelOf(p).units, everyStatus, NO_APPLICATIONS_FILTER);
  const tabs = APPLICATION_TABS.filter((t) => t.tab !== "all");
  assert.equal(
    tabs.reduce((sum, t) => sum + counts[t.tab], 0),
    BUILT_IN_STATUS_KEYS.length,
  );
  assert.ok(tabs.every((t) => counts[t.tab] > 0));
});

test("the panel offers no button on an application the viewer may not move (issue #577)", () => {
  const states: readonly ApplicationState[] = [
    { status: "new" },
    { status: "interview", offered: [], booked: null },
    { status: "nda_received", acceptedAt: "2026-10-18T09:00:00.000Z" },
  ];
  for (const state of states) {
    assert.deepEqual(panelStepsOf({ state, canChange: false }, LEADER), { bar: [], changeTimes: false }, state.status);
    assert.ok(panelStepsOf({ state, canChange: true }, LEADER).bar.length > 0, `${state.status}: the flow offers buttons here`);
  }
});

test("the bottom bar shows the status's buttons, the outlined ones first; Change times sits on the interview card (board 97)", () => {
  const labels = (state: ApplicationState) => panelStepsOf({ state, canChange: true }, LEADER).bar.map((s) => s.label);
  assert.deepEqual(labels({ status: "new" }), ["Reject", "Move to interview"]);
  assert.deepEqual(labels({ status: "interview", offered: [], booked: null }), ["Reject", "Accept"]);
  assert.equal(panelStepsOf({ state: { status: "interview", offered: [], booked: null }, canChange: true }, LEADER).changeTimes, true);
  assert.equal(panelStepsOf({ state: { status: "new" }, canChange: true }, LEADER).changeTimes, false);
  assert.deepEqual(labels({ status: "accepted_email_to_be_sent", acceptedAt: "2026-10-18T09:00:00.000Z" }), ["Withdraw acceptance", "Mark email sent"]);
  assert.deepEqual(labels({ status: "joined", joinedAt: "2026-10-18T09:00:00.000Z" }), []);
});

test("Mark email sent on an acceptance is the team leader's alone; on a refusal anyone who may move it has it (board 97e)", () => {
  const labels = (state: ApplicationState, viewer: typeof LEADER) => panelStepsOf({ state, canChange: true }, viewer).bar.map((s) => s.label);
  const accepted: ApplicationState = { status: "accepted_email_to_be_sent", acceptedAt: "2026-10-18T09:00:00.000Z" };
  assert.deepEqual(labels(accepted, LEADER), ["Withdraw acceptance", "Mark email sent"]);
  assert.deepEqual(labels(accepted, APPROVER), ["Withdraw acceptance"]);
  for (const viewer of [LEADER, APPROVER]) assert.deepEqual(labels({ status: "rejected_email_to_be_sent" }, viewer), ["Mark email sent"]);
});
