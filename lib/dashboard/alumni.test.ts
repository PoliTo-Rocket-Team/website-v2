import assert from "node:assert/strict";
import { test } from "node:test";
import { alumniOf, type AlumniRecord, type RecordRole } from "@/lib/about/alumni-record";
import { alumniDirectory, checkAdvisor, checkAlumnusFix } from "./alumni";

// The checks behind boards 78b and 78c (issue #257), run on the server by both data sides.

const person = {
  recordName: "Fabio Meloni",
  lines: [
    { year: 2022, group: "Executive", recordRole: "President", role: "President" },
    { year: 2021, group: "Operations", recordRole: "President · Chief Engineer, Cavour", role: "President · Chief Engineer, Cavour" },
  ],
};

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
    },
    person,
  );
  assert.deepEqual(result, {
    ok: true,
    value: { shown: false, name: null, founder: "founder", fixes: [{ year: 2021, group: "Operations", role: "Founder · President" }] },
  });
});

test("a fix may name only the person's own years and groups", () => {
  const result = checkAlumnusFix({ shown: true, name: "", founder: null, roles: [{ year: 2022, group: "Cavour", role: "Chief Engineer" }] }, person);
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
    { id: 7, who: { kind: "imported", name: "Carla Neri" }, name: null, founder: null, photo: null, shown: true, removed: false, fixes: [] },
    {
      id: 8,
      who: { kind: "advisor", name: "Dario Fo", role: "Advisor", from: 2021, to: 2021 },
      name: null,
      founder: null,
      photo: null,
      shown: true,
      removed: false,
      fixes: [],
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
  const members = alumniDirectory(alumni, 2025).rows.filter((r) => r.kind === "member").map((r) => r.name);
  assert.deepEqual(members, ["Bo Kim"]);
});

test("imported people and external advisors stay in the directory", () => {
  const names = alumniDirectory(alumniOf(record, 2025), 2025).rows.map((r) => r.name);
  assert.ok(names.includes("Carla Neri"));
  assert.ok(names.includes("Dario Fo"));
});

test("the year and group filters come only from the people left in the directory", () => {
  const directory = alumniDirectory(alumniOf(record, 2025), 2025);
  // Ada's years (2022, 2024, 2025) and her Recovery group are not offered: only Bo, Carla and Dario remain.
  assert.deepEqual(directory.years, [2023, 2021]);
  assert.deepEqual(directory.groups, ["Advisors", "Aerodynamics", "Operations"]);
});
