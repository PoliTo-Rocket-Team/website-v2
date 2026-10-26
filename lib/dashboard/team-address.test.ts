import assert from "node:assert/strict";
import { test } from "node:test";
import type { TeamPerson } from "./division-edit";
import { membershipsOf, type OrgChart } from "./team";
import { memberTeamAddressesFor, type MovesWith, type TeamAddress } from "./team-address";

// The Team addresses row of the member side view (epic #578, issue #786,
// board 102): each address a member holds, sorted by address, with the role
// it moves with as the org chart names it.

const org: OrgChart = {
  departments: [{ id: 7, name: "Operations", code: "OP", kind: "operations" }],
  divisions: [{ id: 9, name: "Logistics Division", departmentId: 7, code: "LG" }],
};

const person = (id: number): TeamPerson => ({ id, name: `Person ${id}`, emails: [], memberships: membershipsOf([]), beyond: [] });

const HOLDER = 1;
const NO_ADDRESS = 2;
const OFF_TEAM = 3;
const team = [person(HOLDER), person(NO_ADDRESS)];

const held = (address: string, movesWith: MovesWith | null, holderId = HOLDER): TeamAddress => ({ address, purpose: `${address} purpose`, holderId, movesWith });

test("each of the four tie kinds reads as the org chart names the role", () => {
  const cases: readonly [MovesWith, string][] = [
    [{ kind: "team-leader" }, "Team Leader"],
    [{ kind: "full-access-seat", seat: "it-lead" }, "IT Lead"],
    [{ kind: "department-head", departmentId: 7 }, "Head of Operations"],
    [{ kind: "division-lead", divisionId: 9 }, "Logistics Lead"],
  ];
  for (const [tie, label] of cases) {
    const rows = memberTeamAddressesFor({ memberIds: [HOLDER], team, org, held: [held("logistics@politorocketteam.it", tie)] });
    assert.equal(rows[HOLDER]?.[0]?.movesWith, label, tie.kind);
  }
});

test("a member's addresses are listed by address in any letter case, untied ones with no role", () => {
  const rows = memberTeamAddressesFor({
    memberIds: [HOLDER],
    team,
    org,
    held: [held("recruitment@politorocketteam.it", null), held("IT@politorocketteam.it", { kind: "team-leader" }), held("logistics@politorocketteam.it", null)],
  });
  assert.deepEqual(
    rows[HOLDER]?.map((l) => [l.address, l.movesWith]),
    [
      ["IT@politorocketteam.it", "Team Leader"],
      ["logistics@politorocketteam.it", null],
      ["recruitment@politorocketteam.it", null],
    ],
  );
});

test("a member holding none, or off the team, has no Team addresses row", () => {
  const rows = memberTeamAddressesFor({
    memberIds: [HOLDER, NO_ADDRESS, OFF_TEAM],
    team,
    org,
    held: [held("logistics@politorocketteam.it", null), held("events@politorocketteam.it", null, OFF_TEAM)],
  });
  assert.deepEqual(Object.keys(rows).map(Number), [HOLDER]);
});
