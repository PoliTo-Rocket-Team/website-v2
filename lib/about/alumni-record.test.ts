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

/** The running year, 2026–27, and the newest finished one, the last the page lists (#391). */
const THIS_YEAR = 2026;
const NEWEST_FINISHED = 2025;

const pageYears = (r: AlumniRecord) => alumniYears(alumniOf(r, THIS_YEAR), NEWEST_FINISHED);

function groupsIn(r: AlumniRecord, year: number) {
  const found = pageYears(r).find((y) => y.start === year);
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
  // A role still held runs to the newest finished year.
  assert.deepEqual(groupsIn(record, 2025), [["Recovery", ["Ada Rossi: Parachutes"]]]);
});

test("the years are only finished ones, newest first: the running year is the Team page's", () => {
  const starts = pageYears(record).map((y) => y.start);
  assert.equal(starts[0], NEWEST_FINISHED);
  assert.ok(!starts.includes(THIS_YEAR));
  assert.deepEqual(starts, [...starts].sort((a, b) => b - a));
  // Ada still holds her role in 2026–27, but that year is not listed until it ends.
  assert.ok(alumniOf(record, THIS_YEAR).find((a) => a.key === "m1")!.lines.some((l) => l.year === THIS_YEAR));
  assert.deepEqual(groupsIn(record, THIS_YEAR), []);
});

test("under Leadership the team leader is listed first, ahead of other leads and founders", () => {
  const board: AlumniRecord = {
    ...record,
    roles: [
      ...record.roles,
      // Ann: an earlier name, a leading title and a founder mark, all in Leadership with Bo.
      role(3, { title: "Chief Operating Officer", startedAt: "2024-10-01", leftAt: "2025-09-01" }),
    ],
    people: [...record.people, { memberId: 3, name: "Ann Abate", email: null }],
  };
  const founded = withEntryChange(board, "m3", { founder: "co-founder" });
  assert.deepEqual(groupsIn(founded, 2024)[0], ["Leadership", ["Bo Kim: Team Leader", "Ann Abate: Chief Operating Officer"]]);
});

test("an advisor sits in the department or division they advised, and one with neither in Advisors", () => {
  const advised: AlumniRecord = {
    ...record,
    roles: [
      ...record.roles,
      // Cy advised Wind Tunnel (Aerodynamics) in 2023–24; Di advised the team as a whole.
      role(3, { type: "advisor", title: "Advisor", startedAt: "2023-10-01", leftAt: "2024-09-30", divisionId: 10 }),
      role(4, { type: "advisor", title: "Faculty Advisor", startedAt: "2023-10-01", leftAt: "2024-09-30" }),
    ],
    people: [...record.people, { memberId: 3, name: "Cy Bello", email: null }, { memberId: 4, name: "Di Conte", email: null }],
  };
  assert.deepEqual(groupsIn(advised, 2023), [
    ["Aerodynamics", ["Ada Rossi: Aerodynamicist", "Cy Bello: Advisor"]],
    ["Advisors", ["Di Conte: Faculty Advisor"]],
  ]);
});

test("each row carries the Alumni page's photo, else the member's stored picture, else none", () => {
  const pictured: AlumniRecord = {
    ...record,
    people: [
      { memberId: 1, name: "Ada Rossi", email: null, picture: "https://store.example/photo/1.jpg" },
      { memberId: 2, name: "Bo Kim", email: null, picture: "https://store.example/photo/2.jpg" },
    ],
  };
  const withEntryPhoto = withEntryChange(pictured, "m2", { photo: "/team/bo-kim.jpg" });
  const recovery = pageYears(withEntryPhoto).find((y) => y.start === 2024)!.groups.find((g) => g.name === "Recovery")!;
  assert.deepEqual(
    recovery.entries.map((e) => [e.name, e.photo]),
    [
      ["Ada Rossi", "https://store.example/photo/1.jpg"],
      ["Bo Kim", "/team/bo-kim.jpg"],
    ],
  );
  const nobody = pageYears(record).find((y) => y.start === 2024)!.groups.find((g) => g.name === "Recovery")!;
  assert.ok(nobody.entries.every((e) => !("photo" in e)));
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
  const names = pageYears(changed).flatMap((y) => y.groups.flatMap((g) => g.entries.map((e) => e.name)));
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
