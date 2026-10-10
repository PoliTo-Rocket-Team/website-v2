import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeLinkedin } from "./self";

test("a LinkedIn profile is kept in its short form, whatever way it was pasted", () => {
  for (const pasted of ["linkedin.com/in/elifkaya", "https://www.linkedin.com/in/elifkaya/", "http://it.linkedin.com/in/elifkaya"]) {
    assert.deepEqual(normalizeLinkedin(pasted), { ok: true, value: "linkedin.com/in/elifkaya" }, pasted);
  }
  assert.deepEqual(normalizeLinkedin("  "), { ok: true, value: null });
  assert.equal(normalizeLinkedin("https://example.com/in/elifkaya").ok, false);
  assert.equal(normalizeLinkedin("linkedin.com/company/prt").ok, false);
});
