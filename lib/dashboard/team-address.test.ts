import assert from "node:assert/strict";
import { test } from "node:test";
import type { TeamPerson } from "./division-edit";
import { membershipsOf, type OrgChart } from "./team";
import {
  checkTeamAddress,
  checkTeamAddressRequest,
  memberTeamAddressesFor,
  movesWithOptions,
  planTeamAddressRequest,
  type MovesWith,
  type TeamAddress,
  type TeamAddressRequest,
} from "./team-address";
import { plainSeatStanding, type ViewerStanding } from "./viewer";

// Shared team addresses (epic #578): the Team addresses row of the member
// side view (issue #786, board 102), each address a member holds, sorted by
// address, with the role it moves with as the org chart names it; and
// Request team address (issue #787, board 102b): who may ask, the address
// check, the roles Moves with offers and the duplicate refusals.

const org: OrgChart = {
  departments: [{ id: 7, name: "Operations", code: "OP", kind: "operations" }],
  divisions: [
    { id: 9, name: "Logistics Division", departmentId: 7, code: "LG" },
    { id: 10, name: "Marketing Division", departmentId: 7, code: "MK" },
  ],
};

const person = (id: number, rest: Partial<Pick<TeamPerson, "memberships" | "beyond">> = {}): TeamPerson => ({
  id,
  name: `Person ${id}`,
  emails: [],
  memberships: rest.memberships ?? membershipsOf([]),
  beyond: rest.beyond ?? [],
});

const HOLDER = 1;
const NO_ADDRESS = 2;
const OFF_TEAM = 3;
const LEAD = 4; // leads Logistics
const IN_LOGISTICS = 5;
const IN_MARKETING = 6;
const FULL_ACCESS = 7; // the IT lead
const team = [
  person(HOLDER),
  person(NO_ADDRESS),
  person(LEAD, { memberships: membershipsOf([{ divisionId: 9, role: "lead", since: "2025-10-01" }]) }),
  person(IN_LOGISTICS, { memberships: membershipsOf([{ divisionId: 9, role: "member", since: "2025-10-01" }]) }),
  person(IN_MARKETING, { memberships: membershipsOf([{ divisionId: 10, role: "member", since: "2025-10-01" }]) }),
  person(FULL_ACCESS),
];

const IT_LEAD: ViewerStanding = { kind: "operations-lead", seat: "it-lead", siteContent: false, approveOrders: false };
const NOBODY = { viewerId: null, standing: plainSeatStanding("non-member") } as const;

const held = (address: string, movesWith: MovesWith | null, holderId = HOLDER): TeamAddress => ({ address, purpose: `${address} purpose`, holderId, movesWith });

test("each of the four tie kinds reads as the org chart names the role", () => {
  const cases: readonly [MovesWith, string][] = [
    [{ kind: "team-leader" }, "Team Leader"],
    [{ kind: "full-access-seat", seat: "it-lead" }, "IT Lead"],
    [{ kind: "department-head", departmentId: 7 }, "Head of Operations"],
    [{ kind: "division-lead", divisionId: 9 }, "Logistics Lead"],
  ];
  for (const [tie, label] of cases) {
    const { rows } = memberTeamAddressesFor({ ...NOBODY, memberIds: [HOLDER], team, org, held: [held("logistics@politorocketteam.it", tie)] });
    assert.equal(rows[HOLDER]?.lines[0]?.movesWith, label, tie.kind);
  }
});

test("a member's addresses are listed by address in any letter case, untied ones with no role", () => {
  const { rows } = memberTeamAddressesFor({
    ...NOBODY,
    memberIds: [HOLDER],
    team,
    org,
    held: [held("recruitment@politorocketteam.it", null), held("IT@politorocketteam.it", { kind: "team-leader" }), held("logistics@politorocketteam.it", null)],
  });
  assert.deepEqual(
    rows[HOLDER]?.lines.map((l) => [l.address, l.movesWith]),
    [
      ["IT@politorocketteam.it", "Team Leader"],
      ["logistics@politorocketteam.it", null],
      ["recruitment@politorocketteam.it", null],
    ],
  );
});

test("a member holding none whom the viewer may not ask for, or off the team, has no Team addresses row", () => {
  const { rows, movesWith } = memberTeamAddressesFor({
    ...NOBODY,
    memberIds: [HOLDER, NO_ADDRESS, OFF_TEAM],
    team,
    org,
    held: [held("logistics@politorocketteam.it", null), held("events@politorocketteam.it", null, OFF_TEAM)],
  });
  assert.deepEqual(Object.keys(rows).map(Number), [HOLDER]);
  assert.deepEqual(movesWith, [], "nobody to ask for, so no roles to offer");
});

test("Request team address shows for a lead's own division and not outside it, for full access on anyone themselves included, and never for a plain member", () => {
  const requestable = (viewerId: number, standing: ViewerStanding) => {
    const { rows } = memberTeamAddressesFor({ viewerId, standing, memberIds: [IN_LOGISTICS, IN_MARKETING, FULL_ACCESS], team, org, held: [] });
    return Object.entries(rows)
      .filter(([, row]) => row.requestable)
      .map(([id]) => Number(id));
  };
  assert.deepEqual(requestable(LEAD, plainSeatStanding("division-lead")), [IN_LOGISTICS]);
  assert.deepEqual(requestable(FULL_ACCESS, IT_LEAD), [IN_LOGISTICS, IN_MARKETING, FULL_ACCESS]);
  assert.deepEqual(requestable(IN_MARKETING, plainSeatStanding("member")), []);
});

test("Moves with offers the team leader, each full-access seat, each department head and each division lead on the chart", () => {
  assert.deepEqual(
    movesWithOptions(org).map((o) => o.label),
    ["Team Leader", "Operations Lead", "IT Lead", "Project Manager", "Chief Engineer", "Head of Operations", "Logistics Lead", "Marketing Lead"],
  );
});

test("the address is one word or a dotted name on the team domain, read in lower case; anything else is refused with a reason", () => {
  assert.deepEqual(checkTeamAddress(" Recruitment@PoliToRocketTeam.it "), { ok: true, value: "recruitment@politorocketteam.it" });
  assert.deepEqual(checkTeamAddress("team.events@politorocketteam.it"), { ok: true, value: "team.events@politorocketteam.it" });
  for (const refused of ["", "@politorocketteam.it", "recruitment@gmail.com", "recruitment", "two words@politorocketteam.it", "a..b@politorocketteam.it"]) {
    const checked = checkTeamAddress(refused);
    assert.ok(!checked.ok && checked.error.length > 0, JSON.stringify(refused));
  }
});

test("a request names a Moves with role on the current chart or none, and says what it is for", () => {
  const sent = { memberId: IN_LOGISTICS, address: "logistics@politorocketteam.it", purpose: "Logistics", movesWith: "lead:9" };
  const checked = checkTeamAddressRequest(sent, org);
  assert.ok(checked.ok);
  assert.deepEqual(checked.value.movesWith, { kind: "division-lead", divisionId: 9 });
  assert.equal(checkTeamAddressRequest({ ...sent, movesWith: null }, org).ok, true);
  assert.equal(checkTeamAddressRequest({ ...sent, movesWith: "lead:99" }, org).ok, false, "a division the chart does not hold");
  assert.equal(checkTeamAddressRequest({ ...sent, purpose: "  " }, org).ok, false, "no purpose");
  assert.equal(checkTeamAddressRequest({ ...sent, address: "logistics@gmail.com" }, org).ok, false, "off the team domain");
});

test("a request is refused for someone the requester may not ask for, and for an address already held or already requested in any letter case", () => {
  const request: TeamAddressRequest = { memberId: IN_LOGISTICS, address: "logistics@politorocketteam.it", purpose: "Logistics", movesWith: null };
  const plan = (requesterId: number, standing: ViewerStanding, extra: { held?: string[]; open?: string[] } = {}) =>
    planTeamAddressRequest({ requesterId, standing, request, team, org, held: extra.held ?? [], open: extra.open ?? [] });
  assert.ok(plan(LEAD, plainSeatStanding("division-lead")).ok);
  assert.equal(plan(IN_MARKETING, plainSeatStanding("member")).ok, false);
  const taken = plan(LEAD, plainSeatStanding("division-lead"), { held: ["Logistics@PoliToRocketTeam.it"] });
  assert.ok(!taken.ok && /already a team address/.test(taken.error));
  const asked = plan(FULL_ACCESS, IT_LEAD, { open: ["LOGISTICS@politorocketteam.it"] });
  assert.ok(!asked.ok && /already requested/.test(asked.error));
});
