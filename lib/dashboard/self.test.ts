import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeLinkedin, profileRoleLine, profileRolesOf } from "./self";

test("a LinkedIn profile is kept in its short form, whatever way it was pasted", () => {
  for (const pasted of ["linkedin.com/in/elifkaya", "https://www.linkedin.com/in/elifkaya/", "http://it.linkedin.com/in/elifkaya"]) {
    assert.deepEqual(normalizeLinkedin(pasted), { ok: true, value: "linkedin.com/in/elifkaya" }, pasted);
  }
  assert.deepEqual(normalizeLinkedin("  "), { ok: true, value: null });
  assert.equal(normalizeLinkedin("https://example.com/in/elifkaya").ok, false);
  assert.equal(normalizeLinkedin("linkedin.com/company/prt").ok, false);
});

test("My profile lists every division the person is in, the primary role first (#185)", () => {
  const member = { title: "Mission Analyst", type: "core" as const, divisionName: "Mission Analysis Division" };
  const lead = { title: "", type: "lead" as const, divisionName: "Optimization and Analysis Division" };
  assert.deepEqual(profileRolesOf(lead, [member, lead]).map(profileRoleLine), [
    "Lead · Optimization and Analysis Division",
    "Mission Analyst · Mission Analysis Division",
  ]);
  assert.deepEqual(profileRolesOf(null, []).map(profileRoleLine), ["Member"], "on the team with no role row");
});
