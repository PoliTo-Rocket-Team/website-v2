import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { groupPhone, groupPhoneEdit, phoneOnEnter, phoneOnLeave } from "./phone";

describe("phone grouping (issue #953)", () => {
  test("groups the digits the country's way, with single spaces only", () => {
    assert.equal(groupPhone("+393891234567"), "+39 389 123 4567");
    assert.equal(groupPhone("+39389"), "+39 389");
    assert.equal(groupPhone("+78005553535"), "+7 800 555 35 35");
    assert.equal(groupPhone("+44 20-7183-8750"), "+44 20 7183 8750");
  });

  test("a phone with no + is left exactly as typed, so the rule can ask for the country code", () => {
    for (const typed of ["3891234567", "389 123 4567", ""]) assert.equal(groupPhone(typed), typed);
  });

  test("typing in the middle keeps the caret after the digit just typed", () => {
    // "+39 389 234 567" with "1" typed after "389 ".
    const edit = groupPhoneEdit("+39 389 234 567", "+39 389 1234 567", 9, null);
    assert.deepEqual(edit, { value: "+39 389 123 4567", caret: 9 });
  });

  test("Backspace over a space takes the digit before it, so the space does not come straight back", () => {
    const edit = groupPhoneEdit("+39 389 123 4567", "+39 389123 4567", 7, "backward");
    assert.deepEqual(edit, { value: "+39 381 234 567", caret: 6 });
  });

  test("an empty field gets its + on entry and is empty again when left at just that", () => {
    assert.equal(phoneOnEnter(""), "+");
    assert.equal(phoneOnEnter("3891234567"), "3891234567");
    assert.equal(phoneOnLeave("+"), "");
    assert.equal(phoneOnLeave(" + "), "");
    assert.equal(phoneOnLeave("+39"), "+39");
  });
});
