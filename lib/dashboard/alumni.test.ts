import assert from "node:assert/strict";
import { test } from "node:test";
import { alumniOf, alumniYears, withEntryChange, type AlumniRecord, type RecordRole } from "@/lib/about/alumni-record";
import { alumniDirectory, alumnusRow, checkAdvisor, checkAlumnusFix } from "./alumni";

// The checks behind boards 78b and 78c (issue #257), run on the server by both data sides.

const person = {
  recordName: "Fabio Meloni",
  lines: [
    { year: 2022, group: "Executive", recordRole: "President", role: "President", added: null },
    { year: 2021, group: "Operations", recordRole: "President · Chief Engineer, Cavour", role: "President · Chief Engineer, Cavour", added: null },
  ],
};

const ground = { units: { departments: [{ id: 3, name: "Executive" }], divisions: [] }, thisYear: 2025 };

test("a fix keeps only what differs from the record", () => {
  const result = checkAlumnusFix(
    {
      shown: false,
      name: " Fabio  Meloni ",
      founder: "founder",
      roles: [
        { year: 2022, group: "Executive", role: "President" },
        { year: 2021, group: "Operations", role: "Founder · President" },
      ],
      added: [],
    },
    person,
    ground,
  );
  assert.deepEqual(result, {
    ok: true,
    value: { shown: false, name: null, founder: "founder", fixes: [{ year: 2021, group: "Operations", role: "Founder · President" }], added: [] },
  });
});

test("a fix may name only the person's own years and groups", () => {
  const result = checkAlumnusFix({ shown: true, name: "", founder: null, roles: [{ year: 2022, group: "Cavour", role: "Chief Engineer" }], added: [] }, person, ground);
  assert.equal(result.ok, false);
});

test("Add alumni adds to the Advisors group only, and the server refuses any other", () => {
  const advisor = { name: "Flora Punzi", role: "Senior FEA Analyst · Counselor", from: 2022, to: 2023 };
  assert.deepEqual(checkAdvisor({ ...advisor, group: "Advisors" }, 2026), { ok: true, value: advisor });
  for (const group of ["Cavour", "Leadership", "Propulsion", undefined]) {
    assert.equal(checkAdvisor({ ...advisor, group }, 2026).ok, false, String(group));
  }
});

test("an advisor's years run from 2021–22 to this one, first to last", () => {
  const base = { name: "Flora Punzi", role: "Advisor", group: "Advisors" };
  assert.equal(checkAdvisor({ ...base, from: 2020, to: 2022 }, 2026).ok, false);
  assert.equal(checkAdvisor({ ...base, from: 2024, to: 2027 }, 2026).ok, false);
  assert.equal(checkAdvisor({ ...base, from: 2024, to: 2023 }, 2026).ok, false);
});

// Board 78 lists people who have left the team; current members are on Members (#271).

const role = (memberId: number, over: Partial<RecordRole>): RecordRole => ({
  memberId,
  type: "core",
  title: "Member",
  startedAt: "2023-10-01",
  leftAt: null,
  departmentId: 1,
  divisionId: null,
  ...over,
});

const record: AlumniRecord = {
  units: {
    departments: [
      { id: 1, name: "Aerodynamics" },
      { id: 2, name: "Recovery" },
    ],
    divisions: [],
  },
  roles: [
    // Ada left her Aerodynamics role and still holds a Recovery one: on the team.
    role(1, { title: "Aerodynamicist", startedAt: "2022-10-01", leftAt: "2023-07-01" }),
    role(1, { title: "Recovery Engineer", startedAt: "2024-10-01", departmentId: 2 }),
    // Bo left every role: an alumnus.
    role(2, { title: "Aerodynamicist", startedAt: "2023-10-01", leftAt: "2024-06-30" }),
  ],
  people: [
    { memberId: 1, name: "Ada Rossi", email: "ada@example.com" },
    { memberId: 2, name: "Bo Kim", email: "bo@example.com" },
  ],
  entries: [
    { id: 7, who: { kind: "imported", name: "Carla Neri" }, name: null, founder: null, photo: null, shown: true, removed: false, fixes: [], added: [] },
    {
      id: 8,
      who: { kind: "advisor", name: "Dario Fo", role: "Advisor", from: 2021, to: 2021 },
      name: null,
      founder: null,
      photo: null,
      shown: true,
      removed: false,
      fixes: [],
      added: [],
    },
  ],
  imported: [{ entryId: 7, year: 2021, group: "Operations", role: "Logistics", position: 0 }],
};

test("the directory leaves out a member who still holds a role and keeps one who left", () => {
  const alumni = alumniOf(record, 2025);
  assert.deepEqual(
    alumni.filter((a) => a.kind === "member").map((a) => [a.name, a.onTeam]),
    [
      ["Ada Rossi", true],
      ["Bo Kim", false],
    ],
  );
  const members = alumniDirectory(alumni, 2025, record.units).rows.filter((r) => r.kind === "member").map((r) => r.name);
  assert.deepEqual(members, ["Bo Kim"]);
});

test("imported people and external advisors stay in the directory", () => {
  const names = alumniDirectory(alumniOf(record, 2025), 2025, record.units).rows.map((r) => r.name);
  assert.ok(names.includes("Carla Neri"));
  assert.ok(names.includes("Dario Fo"));
});

test("the year and group filters come only from the people left in the directory", () => {
  const directory = alumniDirectory(alumniOf(record, 2025), 2025, record.units);
  // Ada's years (2022, 2024, 2025) and her Recovery group are not offered: only Bo, Carla and Dario remain.
  assert.deepEqual(directory.years, [2023, 2021]);
  assert.deepEqual(directory.groups, ["Advisors", "Aerodynamics", "Operations"]);
});

test("the year filter offers finished years only; someone who left this year stays under All years (#391)", () => {
  const leftThisYear: AlumniRecord = {
    ...record,
    // Eva joined in 2024–25 and left during this year, 2025–26.
    roles: [...record.roles, role(5, { title: "Aerodynamicist", startedAt: "2024-10-01", leftAt: "2025-12-01" })],
    people: [...record.people, { memberId: 5, name: "Eva Gallo", email: null }],
  };
  const directory = alumniDirectory(alumniOf(leftThisYear, 2025), 2025, record.units);
  assert.ok(directory.rows.some((r) => r.name === "Eva Gallo" && r.years.includes(2025)));
  assert.deepEqual(directory.years, [2024, 2023, 2021]);
});

// "+ Add a year" in the fix panel (issue #981): a year the record lacks, kept
// for the Alumni page only. Save sends the whole list of added years; the
// record's roles, dates and divisions never change.

const addGround = { units: record.units, thisYear: 2025 };
const bo = () => alumnusRow(alumniOf(record, 2025).find((a) => a.key === "m2")!);

/** Bo's fix panel saved with these added years, then the record as the page reads it after. */
function saved(on: AlumniRecord, added: unknown[]) {
  const row = alumnusRow(alumniOf(on, 2025).find((a) => a.key === "m2")!);
  const checked = checkAlumnusFix({ shown: true, name: "", founder: null, roles: [], added }, row, addGround);
  assert.ok(checked.ok, checked.ok ? "" : checked.error);
  return withEntryChange(on, "m2", { added: checked.value.added });
}

test("an added year shows on the public Alumni page and in the on-the-team span, and the record's roles stay", () => {
  const after = saved(record, [{ year: 2021, unit: { kind: "department", id: 2 }, role: " Recovery  Engineer " }]);
  assert.equal(after.roles, record.roles, "the team record's roles are the same as before");
  assert.equal(after.units, record.units);
  const row = alumnusRow(alumniOf(after, 2025).find((a) => a.key === "m2")!);
  assert.deepEqual([row.from, row.to], [2021, 2024]);
  assert.deepEqual(
    row.lines.map((l) => [l.year, l.group, l.role, l.added?.kind ?? null]),
    [
      [2023, "Aerodynamics", "Aerodynamicist", null],
      [2021, "Recovery", "Recovery Engineer", "department"],
    ],
  );
  const year2021 = alumniYears(alumniOf(after, 2025), 2024).find((y) => y.start === 2021)!;
  const recovery = year2021.groups.find((g) => g.name === "Recovery")!;
  assert.deepEqual(recovery.entries.map((e) => [e.name, e.role]), [["Bo Kim", "Recovery Engineer"]]);
});

test("an added year is edited, then removed, by saving the list again", () => {
  const added = saved(record, [{ year: 2021, unit: { kind: "department", id: 2 }, role: "Recovery Engineer" }]);
  const edited = saved(added, [{ year: 2021, unit: { kind: "department", id: 2 }, role: "Parachutes" }]);
  assert.equal(alumniOf(edited, 2025).find((a) => a.key === "m2")!.lines.find((l) => l.year === 2021)!.role, "Parachutes");
  const removed = saved(edited, []);
  const lines = alumniOf(removed, 2025).find((a) => a.key === "m2")!.lines;
  assert.deepEqual(lines.map((l) => [l.year, l.group]), [[2023, "Aerodynamics"]], "only the record's year is left");
});

test("a year the record has in a unit cannot be added again, nor one year added twice for the same unit", () => {
  const refusal = (added: unknown[], ground = addGround) => {
    const result = checkAlumnusFix({ shown: true, name: "", founder: null, roles: [], added }, bo(), ground);
    return result.ok ? null : result.error;
  };
  // The record lists Bo in Aerodynamics in 2023–24.
  assert.equal(refusal([{ year: 2023, unit: { kind: "department", id: 1 }, role: "Aerodynamicist" }]), "They already have 2023–24 in Aerodynamics.");
  // A division of Aerodynamics sits in the same group on the page.
  const withDivision = { ...addGround, units: { ...record.units, divisions: [{ id: 9, name: "Wind Tunnel", departmentId: 1 }] } };
  assert.equal(refusal([{ year: 2023, unit: { kind: "division", id: 9 }, role: "Tunnel" }], withDivision), "They already have 2023–24 in Aerodynamics.");
  const twice = { year: 2022, unit: { kind: "department", id: 2 }, role: "Recovery" };
  assert.equal(refusal([twice, { ...twice, role: "Other" }]), "They already have 2022–23 in Recovery.");
  // Another year, or another unit that year, is fine.
  assert.equal(refusal([twice, { year: 2022, unit: { kind: "department", id: 1 }, role: "Aero" }]), null);
});

test("a record year can only be retitled: a fix may not name an added year as one of the record's", () => {
  const after = saved(record, [{ year: 2021, unit: { kind: "department", id: 2 }, role: "Recovery Engineer" }]);
  const row = alumnusRow(alumniOf(after, 2025).find((a) => a.key === "m2")!);
  const result = checkAlumnusFix({ shown: true, name: "", founder: null, roles: [{ year: 2021, group: "Recovery", role: "X" }], added: [] }, row, addGround);
  assert.deepEqual(result, { ok: false, error: "That year is not on their record." });
});
