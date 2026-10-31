import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFormDefaults, editableDetailKeys, NO_DETAILS, parseDetailsChange, type YourDetails } from "./details";

// "Your details" on My account and My profile (issues #183, #201): the save
// writes only the fields its editor may, each checked as the apply form
// checks it, and saved details prefill the apply form.

const applicant = {
  firstName: "Chiara",
  lastName: "Lombardi",
  phone: "+39 340 111 2233",
  politoId: "s298765",
  programme: "Mechanical Engineering",
  level: "Year 2 Master's",
  country: "Italy",
  birthDate: "2002-11-05",
  linkedin: "https://www.linkedin.com/in/chiaral/",
};

test("an applicant's save keeps the PoliTo ID's digits and LinkedIn's short form, and refuses a phone with no country code", () => {
  const saved = parseDetailsChange(applicant, "applicant", "");
  assert.ok(saved.ok);
  assert.equal(saved.value.politoId, "298765");
  assert.equal(saved.value.linkedin, "linkedin.com/in/chiaral");
  assert.equal(saved.value.firstName, "Chiara");

  const bad = parseDetailsChange({ ...applicant, phone: "333" }, "applicant", "");
  assert.equal(bad.ok, false);
  assert.ok(!bad.ok && bad.errors.phone !== undefined);
});

// Issue #887: imported phones often have no country code, and a save that leaves the phone alone must not fail on it.
test("Your details keeps an unchanged phone whatever its format, and checks a changed one", () => {
  const opened = "3890247022";
  for (const editor of ["applicant", "member", "lead"] as const) {
    const save = (phone: string) => parseDetailsChange({ ...applicant, phone }, editor, opened);
    const kept = save(` ${opened} `);
    assert.ok(kept.ok, editor);
    assert.equal(kept.value.phone, opened);
    assert.deepEqual(save("3890247023"), { ok: false, errors: { phone: "Start with + and the country code." } }, editor);
    assert.ok(save("+39 389 024 7022").ok, editor);
  }
});

test("a member's save never writes the name their lead set or the LinkedIn the Details card saves", () => {
  const saved = parseDetailsChange({ ...applicant, firstName: "Someone", lastName: "Else", linkedin: "linkedin.com/in/other" }, "member", "");
  assert.ok(saved.ok);
  assert.deepEqual(Object.keys(saved.value).sort(), [...editableDetailKeys("member")].sort());
  for (const key of ["firstName", "lastName", "linkedin"] as const) assert.equal(key in saved.value, false, key);
  assert.equal(saved.value.phone, "+39 340 111 2233");
});

test("saved details prefill the matching fields of the apply form", () => {
  const saved = parseDetailsChange(applicant, "applicant", "");
  assert.ok(saved.ok);
  const details: YourDetails = { ...NO_DETAILS, ...saved.value };
  const defaults = applyFormDefaults(details);
  assert.deepEqual(
    {
      firstName: defaults.firstName,
      lastName: defaults.lastName,
      phone: defaults.phone,
      politoId: defaults.politoId,
      degreeProgramme: defaults.degreeProgramme,
      studyProgramme: defaults.studyProgramme,
      dateOfBirth: defaults.dateOfBirth,
    },
    {
      firstName: "Chiara",
      lastName: "Lombardi",
      phone: "+39 340 111 2233",
      politoId: "298765",
      degreeProgramme: "Mechanical Engineering",
      studyProgramme: "Year 2 Master's",
      dateOfBirth: "2002-11-05",
    },
  );
});
