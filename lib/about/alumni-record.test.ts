import assert from "node:assert/strict";
import { test } from "node:test";
import { importedEntries } from "./alumni-import";
import { alumniOf, alumniYears, foundersOf, withEntryChange, type AlumniRecord, type RecordRole } from "./alumni-record";

// The Alumni page built from the record (issue #257).

const role = (memberId: number, over: Partial<RecordRole>): RecordRole => ({
  memberId,
  type: "core",
  title: "Member",
  startedAt: "2024-10-01",
  leftAt: null,
  departmentId: null,
  divisionId: null,
  ...over,
});

const imported = importedEntries(100);

/** Two departments, one division closed since; two members; the import beside them. */
const record: AlumniRecord = {
  units: {
    departments: [
      { id: 1, name: "Aerodynamics" },
      { id: 2, name: "Recovery" },
    ],
    divisions: [
      { id: 10, name: "Wind Tunnel", departmentId: 1 },
      { id: 20, name: "Parachutes", departmentId: 2 },
    ],
  },
  roles: [
    // Ada: in Wind Tunnel (now closed) for 2023–24, then leads Parachutes from 2024–25.
    role(1, { title: "Aerodynamicist", startedAt: "2023-10-01", leftAt: "2024-07-01", divisionId: 10 }),
    role(1, { type: "lead", title: "Division Lead", startedAt: "2024-10-01", divisionId: 20 }),
    // Bo: team leader in 2024–25, and a member of Parachutes.
    role(2, { type: "president", title: "Team Leader", startedAt: "2024-10-01", leftAt: "2025-09-01" }),
    role(2, { title: "Recovery Engineer", startedAt: "2024-10-01", leftAt: "2025-09-01", divisionId: 20 }),
  ],
  people: [
    { memberId: 1, name: "Ada Rossi", email: "ada@example.com" },
    { memberId: 2, name: "Bo Kim", email: "bo@example.com" },
  ],
  entries: imported.entries,
  imported: imported.imported,
};

const THIS_YEAR = 2025;

function groupsIn(r: AlumniRecord, year: number) {
  const found = alumniYears(alumniOf(r, THIS_YEAR)).find((y) => y.start === year);
  return found?.groups.map((g) => [g.name, g.entries.map((e) => `${e.name}: ${e.role}`)]) ?? [];
}

test("each year groups people by the department they were in, a closed division's included", () => {
  assert.deepEqual(groupsIn(record, 2023), [["Aerodynamics", ["Ada Rossi: Aerodynamicist"]]]);
  assert.deepEqual(groupsIn(record, 2024), [
    ["Leadership", ["Bo Kim: Team Leader"]],
    // A lead reads as their division; Ada leads, so she comes first.
    ["Recovery", ["Ada Rossi: Parachutes", "Bo Kim: Recovery Engineer"]],
    // 2024–25's advisors come from the import, after the departments.
    ["Advisors", groupsIn(record, 2024)[2]![1]],
  ]);
  assert.ok((groupsIn(record, 2024)[2]![1] as string[]).includes("Prof. Alfonso Pagani: Primary Faculty Advisor"));
  // A role still held runs to this year.
  assert.deepEqual(groupsIn(record, 2025), [["Recovery", ["Ada Rossi: Parachutes"]]]);
});

test("the imported years keep the old site's groups and order, and its founders", () => {
  const groups2021 = groupsIn(record, 2021).map(([name]) => name);
  assert.deepEqual(groups2021, ["Operations", "Avionics", "Liquid Propulsion", "Recovery & Mission Analysis", "Aerostructures"]);
  assert.ok(groupsIn(record, 2022).some(([name]) => name === "Executive"));
  const founders = foundersOf(alumniOf(record, THIS_YEAR));
  assert.equal(founders[0]?.name, "Fabio Meloni");
  assert.equal(founders[0]?.title, "founder");
  assert.equal(founders.filter((f) => f.title === "co-founder").length, 5);
});

test("a fix changes only the page: roles, units and people stay as they were", () => {
  const fixed = withEntryChange(record, "m1", {
    name: "Ada R.",
    founder: "co-founder",
    fixes: [{ year: 2024, group: "Recovery", role: "Parachutes Lead" }],
  });
  assert.equal(fixed.roles, record.roles);
  assert.equal(fixed.units, record.units);
  assert.equal(fixed.people, record.people);
  assert.deepEqual(groupsIn(fixed, 2024)[1], ["Recovery", ["Ada R.: Parachutes Lead", "Bo Kim: Recovery Engineer"]]);
  // The other years keep the record's text.
  assert.deepEqual(groupsIn(fixed, 2025), [["Recovery", ["Ada R.: Parachutes"]]]);
  const ada = alumniOf(fixed, THIS_YEAR).find((a) => a.key === "m1")!;
  assert.deepEqual([ada.recordName, ada.founder], ["Ada Rossi", "co-founder"]);
});

test("hidden people and people who asked to be removed are on no year and not among the founders", () => {
  const fabio = imported.entries.find((e) => e.who.kind === "imported" && e.who.name === "Fabio Meloni")!;
  const changed = withEntryChange(withEntryChange(record, "m2", { shown: false }), `e${fabio.id}`, { removed: true });
  const names = alumniYears(alumniOf(changed, THIS_YEAR)).flatMap((y) => y.groups.flatMap((g) => g.entries.map((e) => e.name)));
  assert.ok(!names.includes("Bo Kim"));
  assert.ok(!names.includes("Fabio Meloni"));
  assert.ok(names.includes("Ada Rossi"));
  assert.ok(foundersOf(alumniOf(changed, THIS_YEAR)).every((f) => f.name !== "Fabio Meloni"));
});

test("an added advisor shows under Advisors in each year they advised", () => {
  const withAdvisor: AlumniRecord = {
    ...record,
    entries: [
      ...record.entries,
      { id: 900, who: { kind: "advisor", name: "Prof. Ivo Neri", role: "Faculty Advisor", from: 2023, to: 2024 }, name: null, founder: null, photo: null, shown: true, removed: false, fixes: [] },
    ],
  };
  for (const year of [2023, 2024]) {
    const advisors = groupsIn(withAdvisor, year).find(([name]) => name === "Advisors");
    assert.ok(advisors?.[1].includes("Prof. Ivo Neri: Faculty Advisor"), String(year));
  }
  assert.ok(!groupsIn(withAdvisor, 2025).some(([name]) => name === "Advisors"));
});
