import assert from "node:assert/strict";
import { test } from "node:test";
import { ago, appliedLabels, documentsLine, filterPositions, grantReachOf, placesPhrase, quietDays, type PositionRow } from "./recruitment";
import { grantedAreasOf, type AreaGrant, type AreaReader } from "./viewer";

// Issue #487: a member's Positions page names the places their Positions
// grants cover, never their own division. The member is in Mission Analysis (1),
// in Aerodynamics (1); Propulsion (2) holds Test Bench (3).
const OPEN = {
  departments: [
    { id: 1, name: "Aerodynamics" },
    { id: 2, name: "Propulsion" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis" },
    { id: 3, name: "Test Bench" },
  ],
};
const grantHolder = (...grants: AreaGrant[]): AreaReader => ({
  kind: "member",
  grantedAreas: grantedAreasOf(grants.map((g) => ({ scope: g.unit.kind, target: g.target, level: g.level }))),
  siteContent: false,
  approveOrders: false,
  roles: [{ type: "core", divisionId: 1, departmentId: 1 }],
  grants,
});

test("a member's Positions page names the places their Positions grants cover, not their own division (issue #487)", () => {
  const onPropulsion: AreaGrant = { target: "positions", level: "view", unit: { kind: "department", departmentId: 2 } };
  const onTestBench: AreaGrant = { target: "positions", level: "edit", unit: { kind: "division", divisionId: 3 } };
  const places = (...grants: AreaGrant[]) => grantReachOf(grantHolder(...grants), "positions", OPEN);
  assert.deepEqual(places(onTestBench), { kind: "places", places: [{ kind: "division", name: "Test Bench" }] });
  assert.deepEqual(places(onTestBench, onPropulsion), {
    kind: "places",
    places: [
      { kind: "department", name: "Propulsion" },
      { kind: "division", name: "Test Bench" },
    ],
  });
  // A grant on another area names no place here.
  const onApplications: AreaGrant = { target: "applications", level: "edit", unit: { kind: "department", departmentId: 1 } };
  assert.deepEqual(places(onTestBench, onApplications), { kind: "places", places: [{ kind: "division", name: "Test Bench" }] });
  assert.equal(places(onApplications), null);
});

test("grants that cover every open department reach the whole team (issue #577)", () => {
  // A `team` scope row is a grant in every open department.
  const wholeTeam = (area: "positions" | "applications"): AreaGrant[] =>
    OPEN.departments.map((d) => ({ target: area, level: "view", unit: { kind: "department", departmentId: d.id } }));
  assert.deepEqual(grantReachOf(grantHolder(...wholeTeam("positions")), "positions", OPEN), { kind: "team" });
  assert.deepEqual(grantReachOf(grantHolder(...wholeTeam("applications")), "applications", OPEN), { kind: "team" });
  // One department short of the team names the places it covers.
  const onPropulsion: AreaGrant = { target: "applications", level: "view", unit: { kind: "department", departmentId: 2 } };
  assert.deepEqual(grantReachOf(grantHolder(onPropulsion), "applications", OPEN), { kind: "places", places: [{ kind: "department", name: "Propulsion" }] });
  // The Applications reach is read from the Applications grants alone.
  assert.equal(grantReachOf(grantHolder(...wholeTeam("positions")), "applications", OPEN), null);
});

test("a grant's places are named once, and past two they are counted (issue #577)", () => {
  assert.equal(placesPhrase([{ kind: "department", name: "Propulsion" }]), "the Propulsion Department");
  assert.equal(placesPhrase([{ kind: "division", name: "Test Bench" }]), "the Test Bench");
  assert.equal(
    placesPhrase([
      { kind: "department", name: "Propulsion" },
      { kind: "division", name: "Test Bench" },
    ]),
    "the Propulsion Department and the Test Bench",
  );
  assert.equal(
    placesPhrase([
      { kind: "department", name: "Aerodynamics" },
      { kind: "department", name: "Propulsion" },
      { kind: "department", name: "Structures" },
      { kind: "division", name: "Test Bench" },
    ]),
    "3 departments and 1 division",
  );
});

const row = (title: string, department: string, open: boolean): PositionRow => ({
  id: title.length,
  ref: title,
  title,
  division: `${department} Division`,
  department,
  open,
  applications: { total: 0, fresh: 0, quiet: null },
  canChange: true,
  updated: "",
  code: "",
  content: { title, description: "", required: [], desirable: [], questions: [], motivationLetter: false },
});

const ROWS = [row("Mission Analyst", "Aerodynamics", true), row("Graphic Designer", "Operations", false), row("Safety Officer", "Operations", true)];

test("the positions filter combines the tab, the department and the search", () => {
  const titles = (rows: PositionRow[]) => rows.map((r) => r.title);
  assert.deepEqual(titles(filterPositions(ROWS, { tab: "open", department: null, search: "" })), ["Mission Analyst", "Safety Officer"]);
  assert.deepEqual(titles(filterPositions(ROWS, { tab: "all", department: "Operations", search: "" })), ["Graphic Designer", "Safety Officer"]);
  assert.deepEqual(titles(filterPositions(ROWS, { tab: "closed", department: "Operations", search: "" })), ["Graphic Designer"]);
  assert.deepEqual(titles(filterPositions(ROWS, { tab: "all", department: null, search: "  aero " })), ["Mission Analyst"]);
});

test("the documents column names the CV and the letter the applicant sent", () => {
  const doc = (kind: "cv" | "motivation-letter") => ({ kind, name: "x.pdf", size: null, href: null });
  assert.equal(documentsLine([doc("cv"), doc("motivation-letter")]), "CV + letter");
  assert.equal(documentsLine([doc("cv")]), "CV");
});

test("ages read as the boards word them", () => {
  const now = new Date("2026-10-09T16:00:00+02:00");
  const before = (hours: number) => new Date(now.getTime() - hours * 3600_000);
  assert.equal(ago(before(5), now), "5 hours ago");
  assert.equal(ago(before(48), now), "2 days ago");
  assert.equal(ago(before(24 * 7), now), "1 week ago");
  assert.equal(ago(before(24 * 30), now), "1 month ago");
  assert.deepEqual(appliedLabels(new Date("2026-10-09T14:32:00+02:00"), now), { day: "Today", at: "today, 14:32" });
  // Calendar days in Turin, not 24-hour spans: late last night is yesterday.
  assert.equal(appliedLabels(new Date("2026-10-08T23:30:00+02:00"), now).day, "Yesterday");
  assert.deepEqual(appliedLabels(new Date("2026-10-07T10:05:00+02:00"), now), { day: "2 days ago", at: "7 Oct, 10:05" });
});

test("only an open role 30 days without an application is quiet", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  assert.equal(quietDays(true, daysAgo(30), now), 30);
  assert.equal(quietDays(true, daysAgo(29), now), null);
  assert.equal(quietDays(false, daysAgo(90), now), null);
});
