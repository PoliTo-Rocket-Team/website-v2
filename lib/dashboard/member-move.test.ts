import assert from "node:assert/strict";
import { test } from "node:test";
import { titleOnMove, type MoveTo } from "./member-move";

// The title box of a move (issue #777): Edit details and the Team tree's
// "Move to…" never carry the old unit's title into the new one.

const firmware: MoveTo = { kind: "division", divisionId: 7, as: "member" };
const firmwareLead: MoveTo = { kind: "division", divisionId: 7, as: "lead" };
const engines: MoveTo = { kind: "division", divisionId: 8, as: "member" };
const avionics: MoveTo = { kind: "head", departmentId: 3 };

test("a head of Propulsion moved to Firmware as a member, with nothing typed, carries no title there", () => {
  assert.equal(titleOnMove({ current: "Head of Propulsion", stored: "Head of Propulsion", from: null, to: firmware }), "");
});

test("each new unit empties the box, and back where they are shows the stored title again", () => {
  assert.equal(titleOnMove({ current: "CAD Engineer", stored: "CAD Engineer", from: null, to: firmware }), "");
  assert.equal(titleOnMove({ current: "Firmware Engineer", stored: "CAD Engineer", from: firmware, to: engines }), "");
  assert.equal(titleOnMove({ current: "Firmware Engineer", stored: "CAD Engineer", from: firmware, to: avionics }), "");
  assert.equal(titleOnMove({ current: "Firmware Engineer", stored: "CAD Engineer", from: firmware, to: null }), "CAD Engineer");
  assert.equal(titleOnMove({ current: "", stored: null, from: firmware, to: null }), "");
});

test("lead or member in the one new division keeps what the editor typed", () => {
  assert.equal(titleOnMove({ current: "Firmware Engineer", stored: "CAD Engineer", from: firmware, to: firmwareLead }), "Firmware Engineer");
});
