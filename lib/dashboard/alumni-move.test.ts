import assert from "node:assert/strict";
import { test } from "node:test";
import { alumniMove } from "./alumni-move";

const missionAnalysis = { id: 11, divisionId: 1 };
const hardware = { id: 12, divisionId: 9 };

test("a division lead ends only the roles in their division; the person stays on the team while another role is left", () => {
  const move = alumniMove([missionAnalysis, hardware], { kind: "division", divisionId: 1 });
  assert.deepEqual(move, { ending: [missionAnalysis], grants: { kind: "division", divisionId: 1 }, leavesTeam: false });
});

test("a division lead moving someone whose only roles are in their division ends the membership", () => {
  assert.equal(alumniMove([missionAnalysis], { kind: "division", divisionId: 1 })?.leavesTeam, true);
});

test("the operations lead ends every role and every grant", () => {
  const move = alumniMove([missionAnalysis, hardware], { kind: "team" });
  assert.deepEqual(move, { ending: [missionAnalysis, hardware], grants: { kind: "team" }, leavesTeam: true });
});

test("a person with no active role in reach is not moved", () => {
  assert.equal(alumniMove([hardware], { kind: "division", divisionId: 1 }), null);
  assert.equal(alumniMove([], { kind: "team" }), null);
});
