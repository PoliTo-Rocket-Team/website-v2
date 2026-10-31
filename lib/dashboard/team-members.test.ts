import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_MEMBER_DETAILS, type MemberDetails } from "./details";
import { membersExportRows } from "./members-export";
import { NO_NAME } from "./person-name";
import type { PersonRecord } from "./division-members";
import { membershipsOf, type DivisionRole, type OrgChart, type RoleBeyondDivisions } from "./team";
import {
  clearPicks,
  columnOptions,
  columnValues,
  divisionChoices,
  filterTeam,
  NO_PICKS,
  NO_TEAM_FILTER,
  togglePick,
  wholeTeamLine,
  wholeTeamMembers,
  withPicks,
} from "./team-members";

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Structures", kind: "technical" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 11, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 20, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

let nextId = 1;

function record(
  name: string,
  divisions: readonly (readonly [number, DivisionRole])[],
  options: { beyond?: readonly RoleBeyondDivisions[]; title?: string; details?: Partial<MemberDetails>; nda?: boolean } = {},
): PersonRecord {
  const id = nextId++;
  return {
    id,
    name,
    storedName: NO_NAME,
    signInEmail: `${name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
    photoUrl: null,
    since: 2024,
    memberships: membershipsOf(divisions.map(([divisionId, role]) => ({ divisionId, role, since: "2024-10-01" }))),
    beyondDivisions: options.beyond ?? [],
    titles: Object.fromEntries(divisions.map(([divisionId]) => [divisionId, options.title ?? null])),
    advising: [],
    details: { ...NO_MEMBER_DETAILS, ...options.details },
    nda: options.nda === false ? null : { signedOn: "2024-10-02", confirmedBy: null },
  };
}

const records = [
  record("Zoe Member", [[20, "member"]], { title: "CAD Engineer", details: { programme: "Mechanical Engineering", gender: "Female", country: "Italy" } }),
  record("Anna Villa", [[10, "member"], [11, "member"]], { title: "Mission Analyst", details: { phone: "+39 340 556 1209", gender: "Female", level: "Year 1 Master's" }, nda: false }),
  record("Marco Bianchi", [[10, "lead"]], { details: { gender: "Male", country: "Italy" } }),
  record("Chiara Ferri", [], { beyond: [{ kind: "head", departmentId: 1, title: "Head of Aerodynamics" }], details: { gender: "Female" } }),
  record("Alessandro Greco", [], { beyond: [{ kind: "team-leader", title: "" }] }),
];

const page = wholeTeamMembers({ records, org, selfId: records[4].id });

test("heads and leads come first, then members, by name within each (board 73)", () => {
  assert.deepEqual(
    page.people.map((p) => [p.name, p.roleLabel]),
    [
      ["Alessandro Greco", "Team Leader"],
      ["Chiara Ferri", "Head of Aerodynamics"],
      ["Marco Bianchi", "Division Lead"],
      ["Anna Villa", "Mission Analyst"],
      ["Zoe Member", "CAD Engineer"],
    ],
  );
  assert.equal(wholeTeamLine(page), "Whole team · 5 people in 2 departments");
});

test("the Role column shows a head's and a seat's stored title, and a rename moves nobody (issue #625)", () => {
  const seat = (title: string): RoleBeyondDivisions => ({ kind: "board", seat: { roleId: 28, title, fullAccess: "chief-engineer", type: "core", since: "2025-10-01" } });
  const head = (title: string): RoleBeyondDivisions => ({ kind: "head", departmentId: 1, title });
  const rows = (headTitle: string, seatTitle: string) =>
    wholeTeamMembers({
      records: [...records, record("Federica Moretti", [], { beyond: [seat(seatTitle)] })].map((r) =>
        r.name === "Chiara Ferri" ? { ...r, beyondDivisions: [head(headTitle)] } : r,
      ),
      org,
      selfId: null,
    }).people.map((p) => [p.name, p.role, p.roleLabel, p.departmentIds, p.divisionIds]);
  const before = rows("Head of Aerodynamics", "Chief Engineer");
  const after = rows("Chief of Aerodynamics", "Chief of Propulsion");
  assert.deepEqual(
    after.map(([name, role, label]) => [name, role, label]).slice(0, 3),
    [
      ["Alessandro Greco", "team-leader", "Team Leader"],
      ["Federica Moretti", "board", "Chief of Propulsion"],
      ["Chiara Ferri", "head", "Chief of Aerodynamics"],
    ],
  );
  // Same rank, same department and divisions: only the label changed.
  assert.deepEqual(
    after.map(([name, role, , departments, divisions]) => [name, role, departments, divisions]),
    before.map(([name, role, , departments, divisions]) => [name, role, departments, divisions]),
  );
  // A blank stored title reads the default.
  assert.equal(rows(" ", "")[2][2], "Head of Aerodynamics");
  assert.equal(rows("", "")[1][2], "Chief Engineer");
});

test("Department and Divisions columns: a head sits in the department, everyone else in their own divisions (issue #767)", () => {
  const lead = record("Luca Rossi", [[11, "lead"], [20, "member"]]);
  const people = wholeTeamMembers({ records: [...records, lead], org, selfId: null }).people;
  const row = (name: string) => {
    const p = people.find((x) => x.name === name)!;
    return { department: columnValues(p, "department"), divisions: columnValues(p, "divisions") };
  };
  assert.deepEqual(row("Zoe Member"), { department: ["Structures"], divisions: ["DM"] });
  assert.deepEqual(row("Anna Villa"), { department: ["Aerodynamics"], divisions: ["MA", "OA"] });
  assert.deepEqual(row("Luca Rossi"), { department: ["Aerodynamics", "Structures"], divisions: ["OA", "DM"] });
  assert.deepEqual(row("Chiara Ferri"), { department: ["Aerodynamics"], divisions: [] });
  assert.deepEqual(row("Alessandro Greco"), { department: [], divisions: [] });
  // The division select still counts the head in each division of their department.
  assert.deepEqual(people.find((p) => p.name === "Chiara Ferri")!.divisionIds, [10, 11]);
  // Ticking a department leaves the people in it or heading it.
  const names = (picks: Parameters<typeof withPicks>[1]) => withPicks(people, picks).map((p) => p.name);
  assert.deepEqual(names(togglePick(NO_PICKS, "department", "Aerodynamics")), ["Chiara Ferri", "Luca Rossi", "Marco Bianchi", "Anna Villa"]);
  assert.deepEqual(names(togglePick(NO_PICKS, "department", "Structures")), ["Luca Rossi", "Zoe Member"]);
});

test("the export's Department column sits before Divisions with the table's values; a head's Divisions cell is empty (issue #767)", () => {
  const [header, ...rows] = membersExportRows(page.people);
  assert.deepEqual(header.slice(0, 4), ["Name", "Role", "Department", "Divisions"]);
  const row = (name: string) => rows.find((r) => r[0] === name)!.slice(2, 4);
  assert.deepEqual(row("Chiara Ferri"), ["Aerodynamics", ""]);
  assert.deepEqual(row("Alessandro Greco"), ["", ""]);
  assert.deepEqual(row("Zoe Member"), ["Structures", "Structures · Design & Manufacturing (DM): CAD Engineer"]);
});

test("the department and division selects narrow the rows, a head counting in each division of their department", () => {
  const names = (filter: Parameters<typeof filterTeam>[1]) => filterTeam(page.people, filter).map((p) => p.name);
  assert.deepEqual(names({ ...NO_TEAM_FILTER, departmentId: 1 }), ["Chiara Ferri", "Marco Bianchi", "Anna Villa"]);
  assert.deepEqual(names({ ...NO_TEAM_FILTER, departmentId: 2 }), ["Zoe Member"]);
  assert.deepEqual(names({ ...NO_TEAM_FILTER, divisionId: 11 }), ["Chiara Ferri", "Anna Villa"]);
  assert.deepEqual(names({ ...NO_TEAM_FILTER, departmentId: 1, divisionId: 10 }), ["Chiara Ferri", "Marco Bianchi", "Anna Villa"]);
  assert.deepEqual(names({ ...NO_TEAM_FILTER, query: "556 1209" }), ["Anna Villa"]);
  assert.deepEqual(names({ ...NO_TEAM_FILTER, query: "marco" }), ["Marco Bianchi"]);
  assert.deepEqual(
    divisionChoices(page.departments, 1).map((d) => d.code),
    ["MA", "OA"],
  );
  assert.equal(divisionChoices(page.departments, null).length, 3);
});

test("column filters: any ticked value in a column matches, every filtered column must match (boards 73b, 73c)", () => {
  const names = (picks: Parameters<typeof withPicks>[1]) => withPicks(page.people, picks).map((p) => p.name);
  assert.equal(names(NO_PICKS).length, 5);
  const women = togglePick(NO_PICKS, "gender", "Female");
  assert.deepEqual(names(women), ["Chiara Ferri", "Anna Villa", "Zoe Member"]);
  const womenInOA = togglePick(women, "divisions", "OA");
  assert.deepEqual(names(womenInOA), ["Anna Villa"]);
  assert.deepEqual(names(togglePick(womenInOA, "nda", "Not signed")), ["Anna Villa"]);
  assert.deepEqual(names(togglePick(women, "gender", "Female")), names(NO_PICKS));
  assert.deepEqual(names(clearPicks(womenInOA, "gender")), ["Anna Villa"]);
  assert.deepEqual(names(togglePick(NO_PICKS, "role", "Division Lead")), ["Marco Bianchi"]);
  assert.deepEqual(names(togglePick(NO_PICKS, "level", "Master's · year 1")), ["Anna Villa"]);
});

test("a column's popover counts each value over what the other columns leave, most first (board 73c)", () => {
  assert.deepEqual(columnOptions(page.people, NO_PICKS, "gender"), [
    { value: "Female", count: 3 },
    { value: "Male", count: 1 },
  ]);
  const inMA = togglePick(NO_PICKS, "divisions", "MA");
  assert.deepEqual(columnOptions(page.people, inMA, "gender"), [
    { value: "Female", count: 1 },
    { value: "Male", count: 1 },
  ]);
  // A column's own ticks do not shrink its own list.
  const female = togglePick(NO_PICKS, "gender", "Female");
  assert.equal(columnOptions(page.people, female, "gender").length, 2);
});
