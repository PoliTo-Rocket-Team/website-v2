import assert from "node:assert/strict";
import { test } from "node:test";
import { checkNewPosition, divisionField, newPositionCode, type DivisionChoice } from "./new-position";

// The New position drawer (boards 57a, 57b, issue #171).

const msa: DivisionChoice = { id: 1, name: "Mission Analysis Division", department: "Aerodynamics", deptCode: "AER", divCode: "MSA" };
const aoa: DivisionChoice = { id: 2, name: "Optimization and Analysis Division", department: "Aerodynamics", deptCode: "AER", divCode: "AOA" };

test("one division is locked, several are a choice, none is no drawer", () => {
  assert.deepEqual(divisionField([msa]), { kind: "locked", division: msa });
  assert.deepEqual(divisionField([msa, aoa]), { kind: "choose", divisions: [msa, aoa] });
  assert.equal(divisionField([]), null);
});

test("the code is made from the division and the id", () => {
  assert.equal(newPositionCode(msa, 17), "AER-MSA-017");
});

test("a role needs a division, a title, a description and a required skill; it is closed unless opened", () => {
  const errors = checkNewPosition({ title: " ", required: ["", " "] });
  assert.equal(errors.ok, false);
  if (!errors.ok) assert.deepEqual(Object.keys(errors.errors).sort(), ["description", "division", "required", "title"]);

  const checked = checkNewPosition({
    divisionId: 1,
    title: " Trajectory Analyst ",
    description: "You plan and check rocket trajectories.",
    required: ["Orbital mechanics basics", " ", "Python or MATLAB"],
    desirable: ["Experience with OpenRocket or RocketPy"],
    questions: ["Tell us about a simulation you built."],
    motivationLetter: true,
  });
  assert.ok(checked.ok);
  if (checked.ok) {
    assert.equal(checked.position.title, "Trajectory Analyst");
    assert.deepEqual(checked.position.required, ["Orbital mechanics basics", "Python or MATLAB"]);
    assert.equal(checked.position.open, false);
    assert.equal(checked.position.motivationLetter, true);
  }
});
