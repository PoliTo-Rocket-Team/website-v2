import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAdvisor, checkAlumnusFix } from "./alumni";

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
