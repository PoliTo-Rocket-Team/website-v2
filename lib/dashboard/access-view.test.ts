import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCESS_SORTS, ACCESS_TOOLS, accessModelOf, NO_ACCESS_FILTER, shownAccess, type AccessFilter, type AccessRow } from "./access-view";
import type { AccessPerson, AccessUnit, HeldAccess } from "./division-access";

// Issue #415: the team leader, the operations lead, the IT lead, a department
// head and a division lead of one or several divisions open one Access
// toolbar; only the rows, and so the options its selects offer, differ.
// Aerodynamics holds Mission Analysis and Optimization; Structures holds Design & Manufacturing.
const msa = { id: 1, name: "Mission Analysis Division" };
const aoa = { id: 2, name: "Optimization and Analysis Division" };
const dam = { id: 3, name: "Design & Manufacturing Division" };
const aerodynamics = { id: 1, name: "Aerodynamics" };
const structures = { id: 2, name: "Structures" };
const held: HeldAccess[] = [{ target: "members", level: "edit" }];

const team: AccessUnit = {
  kind: "team",
  departments: [
    { department: aerodynamics, divisions: [msa, aoa] },
    { department: structures, divisions: [dam] },
  ],
};
const head: AccessUnit = { kind: "department", department: aerodynamics, divisions: [msa, aoa] };
const oneDivision: AccessUnit = { kind: "division", divisions: [{ division: msa, held }] };
const twoDivisions: AccessUnit = { kind: "division", divisions: [{ division: msa, held }, { division: aoa, held }] };

// The full-access seats share the whole team's unit; the head and the leads read their own.
const byRole: Record<string, AccessUnit> = {
  "team leader": team,
  "operations lead": team,
  "IT lead": team,
  "department head": head,
  "division lead of one division": oneDivision,
  "division lead of several divisions": twoDivisions,
};

const person = (id: number, name: string, division: AccessPerson["division"]): AccessPerson => ({ id, name, standing: "member", division });
const grants = (p: AccessPerson, givenOn: string, approveOrders = false): AccessRow => ({
  kind: "grants",
  access: {
    person: p,
    approveOrders,
    grants: [{ id: p.id, person: p, place: { kind: "division", division: p.division ?? msa }, target: "members", level: "view", givenBy: "You", givenOn }],
    givenBy: "You",
    givenOn,
  },
});

const seat: AccessRow = {
  kind: "role",
  role: { person: { id: 10, name: "Giulia Ferri", standing: "lead", division: null }, place: { kind: "team" }, seat: "operations-lead", title: "Operations lead" },
};
const sofia = grants(person(1, "Sofia Neri", msa), "2026-10-02");
const carlo = grants(person(2, "Carlo Rossi", aoa), "2026-10-05", true);
const anna = grants(person(3, "Anna Galli", dam), "2026-09-20");
const rows = [seat, sofia, carlo, anna];

const names = (unit: AccessUnit, filter: Partial<AccessFilter> = {}, from: readonly AccessRow[] = rows) =>
  shownAccess(accessModelOf(unit), unit, from, { ...NO_ACCESS_FILTER, ...filter }).rows.map((r) =>
    r.kind === "role" ? r.role.person.name : r.access.person.name,
  );

test("every role that opens Access gets the same tools and views", () => {
  for (const [role, unit] of Object.entries(byRole)) assert.deepEqual(accessModelOf(unit).tools, ACCESS_TOOLS, role);
});

test("the selects offer only the departments and divisions the viewer reaches", () => {
  const options = (unit: AccessUnit) => {
    const model = accessModelOf(unit);
    return { departments: model.departments, divisions: model.divisions.map((d) => d.label) };
  };
  assert.deepEqual(options(team), { departments: ["Aerodynamics", "Structures"], divisions: ["Mission Analysis", "Optimization and Analysis", "Design & Manufacturing"] });
  assert.deepEqual(options(head), { departments: ["Aerodynamics"], divisions: ["Mission Analysis", "Optimization and Analysis"] });
  assert.deepEqual(options(twoDivisions), { departments: [], divisions: ["Mission Analysis", "Optimization and Analysis"] });
  assert.deepEqual(options(oneDivision), { departments: [], divisions: ["Mission Analysis"] });
});

test("the selects, the switch and the search narrow the rows the same way for every role", () => {
  assert.deepEqual(names(team, { department: "Structures" }), ["Anna Galli"]);
  assert.deepEqual(names(team, { division: msa.name }), ["Sofia Neri"]);
  assert.deepEqual(names(head, { division: aoa.name }, [sofia, carlo]), ["Carlo Rossi"]);
  assert.deepEqual(names(twoDivisions, { division: msa.name }, [sofia, carlo]), ["Sofia Neri"]);
  assert.deepEqual(names(team, { show: "full-access" }), ["Giulia Ferri"]);
  assert.deepEqual(names(team, { show: "approve-orders" }), ["Carlo Rossi"]);
  assert.deepEqual(names(oneDivision, { query: "sofia" }, [sofia]), ["Sofia Neri"]);
  assert.deepEqual(names(oneDivision, { query: "carlo" }, [sofia]), []);
});

test("a division left chosen outside the department reads as all divisions", () => {
  const shown = shownAccess(accessModelOf(team), team, rows, { ...NO_ACCESS_FILTER, department: "Structures", division: msa.name });
  assert.equal(shown.division, null);
});

test("the switch's counts follow the selects and search; the sort orders what is left", () => {
  assert.deepEqual(shownAccess(accessModelOf(team), team, rows, { ...NO_ACCESS_FILTER, department: "Aerodynamics" }).counts, {
    everyone: 2,
    "full-access": 0,
    "approve-orders": 1,
  });
  assert.deepEqual(names(team, { sort: "leads-first" }), ["Giulia Ferri", "Sofia Neri", "Carlo Rossi", "Anna Galli"]);
  assert.deepEqual(names(team, { sort: "name" }), ["Anna Galli", "Carlo Rossi", "Giulia Ferri", "Sofia Neri"]);
  assert.deepEqual(names(team, { sort: "recent" }), ["Carlo Rossi", "Sofia Neri", "Anna Galli", "Giulia Ferri"]);
});

// Issue #481: the page opens on the most recently given access, and the sort
// menu shows that default as its first choice.
test("the default filter orders rows by most recently given first", () => {
  assert.deepEqual(names(team), ["Carlo Rossi", "Sofia Neri", "Anna Galli", "Giulia Ferri"]);
  assert.equal(ACCESS_SORTS[0].sort, NO_ACCESS_FILTER.sort);
});
