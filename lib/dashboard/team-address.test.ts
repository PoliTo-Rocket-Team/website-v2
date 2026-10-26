import assert from "node:assert/strict";
import { test } from "node:test";
import type { AliasTeamPerson } from "./alias-request";
import type { TeamPerson } from "./division-edit";
import { attentionOf, noticeOf } from "./notices";
import { membershipsOf, type OrgChart } from "./team";
import {
  checkTeamAddress,
  checkTeamAddressAnswer,
  checkTeamAddressRequest,
  memberTeamAddressesFor,
  movesWithOptions,
  owedTeamAddressReroutes,
  ownTeamAddressesOf,
  planTeamAddressAnswer,
  planTeamAddressRequest,
  planTeamAddressSetUp,
  rerouteTargetNow,
  reroutesNow,
  teamAddressAnswerNotices,
  teamAddressAttentionFor,
  teamAddressCardsOf,
  teamAddressRerouteAttentionFor,
  type MovesWith,
  type OpenTeamAddressRequest,
  type StoredTeamAddressReroute,
  type TeamAddress,
  type TeamAddressAnswer,
  type TeamAddressRequest,
  type TiedRoleChange,
  type TieRoleRow,
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

const person = (id: number, rest: Partial<Pick<TeamPerson, "memberships" | "beyond">> = {}): AliasTeamPerson => ({
  id,
  name: `Person ${id}`,
  signInEmail: `person-${id}@mail.test`,
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

// Decline and Mark created (issue #788) ------------------------------------------------

const open = (id: number, extra: Partial<OpenTeamAddressRequest> = {}): OpenTeamAddressRequest => ({
  id,
  memberId: IN_LOGISTICS,
  address: "logistics@politorocketteam.it",
  purpose: "Logistics",
  movesWith: { kind: "division-lead", divisionId: 9 },
  requesterId: LEAD,
  sentAt: "2026-10-25T10:00:00+01:00",
  ...extra,
});
const answerPlan = (viewer: ViewerStanding, answer: TeamAddressAnswer, extra: { held?: string[]; openElsewhere?: string[] } = {}) =>
  planTeamAddressAnswer({ viewer, request: open(1), answer, held: extra.held ?? [], openElsewhere: extra.openElsewhere ?? [] });

test("only the team leader, the operations lead and the IT lead answer a team address request", () => {
  const answers = (viewer: ViewerStanding) => answerPlan(viewer, { kind: "decline" }).ok;
  assert.ok(answers(plainSeatStanding("team-leader")));
  assert.ok(answers(plainSeatStanding("operations-lead")));
  assert.ok(answers(IT_LEAD));
  for (const seat of ["project-manager", "chief-engineer", null] as const) {
    assert.equal(answers({ kind: "operations-lead", seat, siteContent: false, approveOrders: false }), false, `seat ${seat}`);
  }
  for (const kind of ["department-head", "division-lead", "member"] as const) assert.equal(answers(plainSeatStanding(kind)), false, kind);
});

test("Mark created checks the confirmed address again on the team domain, and refuses one held or asked for by another open request", () => {
  const viewer = plainSeatStanding("team-leader");
  assert.deepEqual(answerPlan(viewer, { kind: "created", address: " Logistics@PoliToRocketTeam.it " }), {
    ok: true,
    value: { kind: "created", request: open(1), address: "logistics@politorocketteam.it" },
  });
  assert.equal(answerPlan(viewer, { kind: "created", address: "logistics@gmail.com" }).ok, false, "off the team domain");
  const held = answerPlan(viewer, { kind: "created", address: "logistics@politorocketteam.it" }, { held: ["LOGISTICS@politorocketteam.it"] });
  assert.ok(!held.ok && /already a team address/.test(held.error));
  const asked = answerPlan(viewer, { kind: "created", address: "logistics@politorocketteam.it" }, { openElsewhere: ["logistics@politorocketteam.it"] });
  assert.ok(!asked.ok && /already requested/.test(asked.error));
  assert.equal(checkTeamAddressAnswer({ kind: "created" }).ok, false);
  assert.equal(checkTeamAddressAnswer({ kind: "confirm" }).ok, false);
});

test("Mark created and Decline each tell the requester, a self-requester included; a request whose requester is gone tells nobody", () => {
  const created = { kind: "created", request: open(1), address: "logistics@politorocketteam.it" } as const;
  assert.deepEqual(teamAddressAnswerNotices(created, "Sara Conti"), [
    { recipientId: LEAD, notice: { kind: "team-address-created", data: { address: "logistics@politorocketteam.it" } } },
  ]);
  assert.deepEqual(teamAddressAnswerNotices({ kind: "decline", request: open(1) }, "Sara Conti"), [
    { recipientId: LEAD, notice: { kind: "team-address-declined", data: { address: "logistics@politorocketteam.it", by: "Sara Conti" } } },
  ]);
  const self = teamAddressAnswerNotices({ ...created, request: open(1, { requesterId: IN_LOGISTICS }) }, "Sara Conti");
  assert.deepEqual(
    self.map((n) => n.recipientId),
    [IN_LOGISTICS],
  );
  assert.deepEqual(teamAddressAnswerNotices({ kind: "decline", request: open(1, { requesterId: null }) }, "Sara Conti"), []);
  const now = new Date("2026-10-26T12:00:00Z");
  const read = (kind: string, data: unknown) =>
    attentionOf(noticeOf({ id: 1, kind, subject: "Person 5", createdAt: "2026-10-26T10:00:00Z", data })!, now).title;
  assert.equal(read("team-address-created", { address: "logistics@politorocketteam.it" }), "logistics@politorocketteam.it is ready for Person 5");
  assert.equal(
    read("team-address-declined", { address: "logistics@politorocketteam.it", by: "Sara Conti" }),
    "Sara Conti declined logistics@politorocketteam.it for Person 5",
  );
});

test("the approver's rows: one per open request, oldest first, with the address, purpose, moves-with role, requester and when; none for anyone else", () => {
  const now = new Date("2026-10-26T12:00:00+01:00");
  const later = open(2, { address: "events@politorocketteam.it", purpose: "Events", movesWith: null, requesterId: FULL_ACCESS, sentAt: "2026-10-26T10:00:00+01:00" });
  const requests = [later, open(1)];
  const rows = teamAddressAttentionFor(plainSeatStanding("team-leader"), requests, team, org, now);
  assert.deepEqual(
    rows.map((r) => [r.kind, r.title, r.detail]),
    [
      ["team-address-request", "Person 4 asks for logistics@politorocketteam.it for Person 5", "Logistics · moves with Logistics Lead · sent yesterday"],
      ["team-address-request", "Person 7 asks for events@politorocketteam.it for Person 5", "Events · sent today"],
    ],
  );
  assert.deepEqual(rows[0]?.action, {
    answerTeamAddress: 1,
    member: "Person 5",
    address: "logistics@politorocketteam.it",
    purpose: "Logistics",
    signInEmail: "person-5@mail.test",
  });
  assert.deepEqual(teamAddressAttentionFor(plainSeatStanding("division-lead"), requests, team, org, now), []);
  assert.deepEqual(teamAddressAttentionFor(IT_LEAD, [open(3, { memberId: OFF_TEAM })], team, org, now), [], "someone off the team");
});

// Routing when a tied role changes hands (issue #789) ------------------------------

test("a role change owes one routing item for each tied address whose holder no longer holds the role, naming the first new holder by id", () => {
  const LOGISTICS_LEAD: MovesWith = { kind: "division-lead", divisionId: 9 };
  const tied = (id: number, movesWith: MovesWith | null, holderId = LEAD) => ({ id, ...held(`a${id}@politorocketteam.it`, movesWith, holderId) });
  const owed = (address: ReturnType<typeof tied>, change: TiedRoleChange, open: { addressId: number; toId: number }[] = []) =>
    owedTeamAddressReroutes({ addresses: [address], changes: [change], open });
  const cases: [string, ReturnType<typeof owed>, ReturnType<typeof owed>][] = [
    [
      "hand-over: the lead is replaced",
      owed(tied(1, LOGISTICS_LEAD), { tie: LOGISTICS_LEAD, becoming: [IN_LOGISTICS], staying: [] }),
      [{ addressId: 1, toId: IN_LOGISTICS, fromId: LEAD }],
    ],
    ["co-lead added: the holder still leads", owed(tied(1, LOGISTICS_LEAD), { tie: LOGISTICS_LEAD, becoming: [IN_LOGISTICS], staying: [LEAD] }), []],
    [
      "vacant role filled: the holder held it no more",
      owed(tied(1, { kind: "team-leader" }, HOLDER), { tie: { kind: "team-leader" }, becoming: [FULL_ACCESS], staying: [] }),
      [{ addressId: 1, toId: FULL_ACCESS, fromId: HOLDER }],
    ],
    ["untied address", owed(tied(1, null), { tie: LOGISTICS_LEAD, becoming: [IN_LOGISTICS], staying: [] }), []],
    ["another role's change", owed(tied(1, { kind: "division-lead", divisionId: 10 }), { tie: LOGISTICS_LEAD, becoming: [IN_LOGISTICS], staying: [] }), []],
    [
      "two new holders in one change",
      owed(tied(1, LOGISTICS_LEAD), { tie: LOGISTICS_LEAD, becoming: [IN_MARKETING, IN_LOGISTICS], staying: [] }),
      [{ addressId: 1, toId: IN_LOGISTICS, fromId: LEAD }],
    ],
    ["the holder is the one made a holder", owed(tied(1, LOGISTICS_LEAD), { tie: LOGISTICS_LEAD, becoming: [LEAD], staying: [] }), []],
    [
      "hand-over to someone who already co-leads: the holder left",
      owed(tied(1, LOGISTICS_LEAD), { tie: LOGISTICS_LEAD, becoming: [IN_LOGISTICS], staying: [IN_MARKETING, IN_LOGISTICS] }),
      [{ addressId: 1, toId: IN_LOGISTICS, fromId: LEAD }],
    ],
    [
      "hand-over between two co-leads beside the holder, who still leads",
      owed(tied(1, LOGISTICS_LEAD), { tie: LOGISTICS_LEAD, becoming: [IN_LOGISTICS], staying: [LEAD, IN_LOGISTICS] }),
      [],
    ],
    [
      "second change: the member the open item names left the role, so it names the new holder",
      owed(tied(1, LOGISTICS_LEAD), { tie: LOGISTICS_LEAD, becoming: [IN_MARKETING], staying: [] }, [{ addressId: 1, toId: IN_LOGISTICS }]),
      [{ addressId: 1, toId: IN_MARKETING, fromId: LEAD }],
    ],
    [
      "second change: a co-lead added beside the member the open item names leaves it as it is",
      owed(tied(1, LOGISTICS_LEAD), { tie: LOGISTICS_LEAD, becoming: [IN_MARKETING], staying: [IN_LOGISTICS] }, [{ addressId: 1, toId: IN_LOGISTICS }]),
      [],
    ],
  ];
  for (const [name, actual, expected] of cases) assert.deepEqual(actual, expected, name);
});

test("an open routing item moves its address to whoever holds the tied role now, never to a member it named earlier", () => {
  const LOGISTICS_LEAD: MovesWith = { kind: "division-lead", divisionId: 9 };
  const A = LEAD;
  const B = IN_LOGISTICS;
  const C = IN_MARKETING;
  const role = (memberId: number, rest: Partial<TieRoleRow> = {}): TieRoleRow => ({
    id: memberId,
    memberId,
    since: "2025-10-01",
    type: "lead",
    departmentId: null,
    divisionId: 9,
    fullAccess: null,
    ...rest,
  });
  const lead = (memberId: number, since?: string): TieRoleRow => role(memberId, since === undefined ? {} : { since });
  const item = (toId: number, movesWith: MovesWith | null = LOGISTICS_LEAD): StoredTeamAddressReroute => ({
    id: 1,
    addressId: 1,
    address: "logistics@politorocketteam.it",
    movesWith,
    holderId: A,
    toId,
    fromId: A,
    createdAt: "2026-10-26T10:00:00Z",
  });
  const cases: [string, number | null, number | null][] = [
    ["A to B: B leads", rerouteTargetNow(item(B), [lead(B)], org), B],
    ["A to B to C before Mark done: the item named B, C leads now", rerouteTargetNow(item(B), [lead(C)], org), C],
    ["B still leads beside a later co-lead", rerouteTargetNow(item(B), [lead(C, "2026-10-26"), lead(B)], org), B],
    ["B left: the newest of the leads now took it over", rerouteTargetNow(item(B), [lead(NO_ADDRESS), lead(C, "2026-10-26")], org), C],
    ["a head row kept on the division is not a lead of it", rerouteTargetNow(item(B), [role(C, { type: "head" })], org), null],
    ["A leads again", rerouteTargetNow(item(B), [lead(A)], org), null],
    ["nobody leads", rerouteTargetNow(item(B), [], org), null],
    ["an address tied to no role", rerouteTargetNow(item(B, null), [lead(C)], org), null],
    ["the team leader by the president row", rerouteTargetNow(item(B, { kind: "team-leader" }), [role(C, { type: "president", divisionId: null })], org), C],
    ["a full-access seat by its flag", rerouteTargetNow(item(B, { kind: "full-access-seat", seat: "it-lead" }), [role(C, { divisionId: 10, fullAccess: "it-lead" })], org), C],
    [
      "a department's head by a head row kept on one of its divisions",
      rerouteTargetNow(item(B, { kind: "department-head", departmentId: 7 }), [role(C, { type: "head", divisionId: 10 })], org),
      C,
    ],
  ];
  for (const [name, actual, expected] of cases) assert.equal(actual, expected, name);

  const [open] = reroutesNow([item(B)], [lead(C)], org);
  assert.equal(open?.toId, C, "the approver's row names C");
  const now = new Date("2026-10-27T10:00:00Z");
  const rows = teamAddressRerouteAttentionFor(IT_LEAD, [open!], team, org, now);
  assert.deepEqual(rows.map((r) => r.title), ["logistics@politorocketteam.it goes to Person 6"]);
  assert.deepEqual(teamAddressRerouteAttentionFor(IT_LEAD, reroutesNow([item(B)], [lead(A)], org), team, org, now), [], "nothing to move: no row");
});

// The holder's ready card (owner finding on PR #794) ---------------------------------

test("the holder reads a ready card per own team address not set up, and sets up only one they hold, once; off the team, none", () => {
  const stored = [
    { id: 2, address: "recruitment@politorocketteam.it", setUpAt: null },
    { id: 1, address: "logistics@politorocketteam.it", setUpAt: "2026-10-26T10:00:00Z" },
  ];
  const own = ownTeamAddressesOf({ kind: "member", held: stored });
  assert.deepEqual(own, [
    { id: 1, address: "logistics@politorocketteam.it", setUp: true },
    { id: 2, address: "recruitment@politorocketteam.it", setUp: false },
  ]);
  assert.deepEqual(
    teamAddressCardsOf(own).map((a) => a.address),
    ["recruitment@politorocketteam.it"],
  );
  assert.deepEqual(planTeamAddressSetUp(own, 2), { ok: true, value: { id: 2, address: "recruitment@politorocketteam.it", setUp: true } });
  assert.equal(planTeamAddressSetUp(own, 1).ok, false, "a second press");
  assert.equal(planTeamAddressSetUp(own, 3).ok, false, "an address they do not hold");
  assert.deepEqual(ownTeamAddressesOf({ kind: "alumni", held: stored }), [], "off the team");
});
