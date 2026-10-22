import assert from "node:assert/strict";
import { test } from "node:test";
import { alumniMove } from "./alumni-move";

const missionAnalysis = { id: 11, divisionId: 1 };
const hardware = { id: 12, divisionId: 9 };

test("Leaves the team ends every role the person holds, in every division (issue #231)", () => {
  assert.deepEqual(alumniMove([missionAnalysis, hardware]), { ending: [missionAnalysis, hardware] });
});

test("a person with no active role left is not moved", () => {
  assert.equal(alumniMove([]), null);
});
