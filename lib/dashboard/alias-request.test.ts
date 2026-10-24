import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aliasAnswerNotices,
  aliasAttentionFor,
  aliasPrefill,
  checkAliasAddress,
  checkAliasAnswer,
  memberAliasesFor,
  owedAliasRequests,
  planAliasAnswer,
  planAliasCancel,
  planAliasRequest,
  type AliasRequest,
} from "./alias-request";
import type { TeamPerson } from "./division-edit";
import { attentionOf, noticeOf } from "./notices";
import { membershipsOf, type OrgChart } from "./team";
import { testDeveloperStanding, type ViewerStanding } from "./viewer";

// Team email alias requests (epic #538, issue #541): who may ask, who may
// answer, one open request per member, the prefill and the address check, and
// who each answer tells. The access matrix covers every viewer kind against
// the same rules (./access-matrix.test.ts, ./access-matrix-server.test.ts).

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", code: "AE", kind: "technical" },
    { id: 2, name: "Structures", code: "ST", kind: "technical" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

const person = (id: number, name: string, rest: Partial<Pick<TeamPerson, "memberships" | "beyond">>): TeamPerson => ({
  id,
  name,
  emails: [],
  memberships: rest.memberships ?? membershipsOf([]),
  beyond: rest.beyond ?? [],
});
const lead = (divisionId: number) => membershipsOf([{ divisionId, role: "lead", since: "2023-10-01" }]);
const member = (divisionId: number) => membershipsOf([{ divisionId, role: "member", since: "2024-10-01" }]);

const MARCO = 2; // leads Mission Analysis
const DAVIDE = 3; // a member of Mission Analysis
const LENA = 4; // a member of Optimization and Analysis
const RICCARDO = 5; // a member of Design & Manufacturing
const CHIARA = 15; // Head of Aerodynamics
const ALESSANDRO = 14; // the team leader
const GIULIA = 1; // the operations lead, a member of no division here

const team: TeamPerson[] = [
  person(MARCO, "Marco Bianchi", { memberships: lead(1) }),
  person(DAVIDE, "Davide Russo", { memberships: member(1) }),
  person(LENA, "Lena Fischer", { memberships: member(2) }),
  person(RICCARDO, "Riccardo Lombardi", { memberships: member(3) }),
  person(CHIARA, "Chiara Rinaldi", { beyond: [{ kind: "head", departmentId: 1, title: "" }] }),
  person(ALESSANDRO, "Alessandro Greco", { beyond: [{ kind: "team-leader", title: "" }] }),
  person(GIULIA, "Giulia Rossi", { beyond: [{ kind: "head", departmentId: null, title: "" }] }),
];

const request = (id: number, memberId: number, requesterId: number | null, sentAt = "2026-10-22T09:00:00+02:00"): AliasRequest => ({ id, memberId, requesterId, sentAt });
const ask = (requesterId: number | null, memberId: number, extra: { prtEmail?: string | null; open?: AliasRequest[] } = {}) =>
  planAliasRequest({ requesterId, memberId, team, org, prtEmail: extra.prtEmail ?? null, open: extra.open ?? [] });

test("a lead asks for their division, a head for their department, the team leader for anyone", () => {
  assert.ok(ask(MARCO, DAVIDE).ok);
  assert.equal(ask(MARCO, LENA).ok, false, "a division the lead does not lead");
  assert.ok(ask(CHIARA, DAVIDE).ok);
  assert.ok(ask(CHIARA, LENA).ok);
  assert.equal(ask(CHIARA, RICCARDO).ok, false, "another department");
  for (const id of [DAVIDE, LENA, RICCARDO, MARCO, CHIARA]) assert.ok(ask(ALESSANDRO, id).ok, `team leader for ${id}`);
});

test("nobody else asks: a member, the operations lead without a lead role, nobody for themselves", () => {
  assert.equal(ask(DAVIDE, LENA).ok, false);
  assert.equal(ask(GIULIA, DAVIDE).ok, false);
  assert.equal(ask(ALESSANDRO, ALESSANDRO).ok, false);
  assert.equal(ask(null, DAVIDE).ok, false);
  assert.equal(ask(MARCO, 999).ok, false, "someone not on the team");
});

test("a member with a PRT email or an open request gets no second one", () => {
  assert.deepEqual(ask(MARCO, DAVIDE, { prtEmail: "davide.russo@politorocketteam.it" }), { ok: false, error: "Davide Russo already has a PRT email." });
  assert.deepEqual(ask(MARCO, DAVIDE, { open: [request(1, DAVIDE, null)] }), { ok: false, error: "An alias for Davide Russo is already requested." });
  assert.ok(ask(MARCO, DAVIDE, { open: [request(1, LENA, CHIARA)] }).ok, "another member's request blocks nothing");
});

test("a member whose PRT email was cleared can be requested again, by hand and by the site (issue #563)", () => {
  const created = "davide.russo@politorocketteam.it";
  assert.equal(ask(MARCO, DAVIDE, { prtEmail: created }).ok, false, "while the PRT email is set");
  for (const cleared of [null, "", "  "]) {
    assert.ok(ask(MARCO, DAVIDE, { prtEmail: cleared }).ok, `Request alias once it is ${JSON.stringify(cleared)}`);
  }
  const owed = (addresses: ReadonlyMap<number, string>) => owedAliasRequests({ becoming: [DAVIDE], addresses, open: [] });
  assert.deepEqual(owed(new Map([[DAVIDE, created]])), [], "no automatic request while it is set");
  assert.deepEqual(owed(new Map()), [{ memberId: DAVIDE, requesterId: null }], "an automatic one once it is cleared");
  assert.deepEqual(owed(new Map([[DAVIDE, ""]])), [{ memberId: DAVIDE, requesterId: null }], "an empty PRT email is no address");
  assert.deepEqual(
    memberAliasesFor({ viewerId: MARCO, memberIds: [DAVIDE], team, org, addresses: new Map([[DAVIDE, ""]]), open: [], now: new Date("2026-10-22T12:00:00Z") }),
    { [DAVIDE]: { kind: "none", requestable: true } },
    "the drawer offers Request alias again",
  );
});

test("Cancel request: the sender, or anyone who may ask for the member", () => {
  const sent = request(1, DAVIDE, MARCO);
  assert.ok(planAliasCancel({ viewerId: MARCO, request: sent, team, org }).ok);
  assert.ok(planAliasCancel({ viewerId: CHIARA, request: sent, team, org }).ok);
  assert.equal(planAliasCancel({ viewerId: GIULIA, request: sent, team, org }).ok, false);
  assert.equal(planAliasCancel({ viewerId: LENA, request: sent, team, org }).ok, false);
  assert.ok(planAliasCancel({ viewerId: MARCO, request: request(2, DAVIDE, null), team, org }).ok, "an automatic one too");
});

test("the prefill is firstname.lastname on the team domain", () => {
  assert.equal(aliasPrefill("Davide Russo"), "davide.russo@politorocketteam.it");
  assert.equal(aliasPrefill("Anna De Luca"), "anna.deluca@politorocketteam.it");
  assert.equal(aliasPrefill("Niccolò D'Agostino"), "niccolo.dagostino@politorocketteam.it");
});

test("the address check: the team domain, firstname.lastname, or one word for a special-purpose address", () => {
  assert.deepEqual(checkAliasAddress(" Davide.Russo@PoliToRocketTeam.it "), { ok: true, value: { address: "davide.russo@politorocketteam.it", form: "personal" } });
  assert.deepEqual(checkAliasAddress("sponsoring@politorocketteam.it"), { ok: true, value: { address: "sponsoring@politorocketteam.it", form: "special" } });
  assert.deepEqual(checkAliasAddress("davide.russo@gmail.com"), { ok: false, error: "The alias must end with @politorocketteam.it." });
  assert.deepEqual(checkAliasAddress("davide.russo@politorocketteam.it.evil"), { ok: false, error: "The alias must end with @politorocketteam.it." });
  for (const bad of ["davide_russo", "davide..russo", "a.b.c", ".russo", "", "davide russo"]) {
    assert.equal(checkAliasAddress(`${bad}@politorocketteam.it`).ok, false, bad);
  }
});

test("only the team leader, the operations lead and the IT lead answer", () => {
  const open = request(1, DAVIDE, MARCO);
  const answer = (viewer: ViewerStanding) => planAliasAnswer({ viewer, request: open, answer: { kind: "decline" } }).ok;
  assert.ok(answer(testDeveloperStanding("team-leader")));
  assert.ok(answer(testDeveloperStanding("operations-lead")));
  assert.ok(answer({ kind: "operations-lead", seat: "it-lead", siteContent: false, approveOrders: false }));
  for (const seat of ["project-manager", "chief-engineer", null] as const) {
    assert.equal(answer({ kind: "operations-lead", seat, siteContent: false, approveOrders: false }), false, `seat ${seat}`);
  }
  for (const kind of ["department-head", "division-lead", "member", "alumni", "non-member"] as const) assert.equal(answer(testDeveloperStanding(kind)), false, kind);
});

test("Mark created checks the address on the server and saves it lower-cased", () => {
  const viewer = testDeveloperStanding("team-leader");
  const open = request(1, DAVIDE, MARCO);
  assert.deepEqual(planAliasAnswer({ viewer, request: open, answer: { kind: "created", address: "Davide.Russo@politorocketteam.it" } }), {
    ok: true,
    value: { kind: "created", request: open, address: "davide.russo@politorocketteam.it" },
  });
  assert.equal(planAliasAnswer({ viewer, request: open, answer: { kind: "created", address: "davide@gmail.com" } }).ok, false);
  assert.equal(checkAliasAnswer({ kind: "created" }).ok, false);
  assert.equal(checkAliasAnswer({ kind: "confirm" }).ok, false);
});

test("Mark created and Decline tell the requester; the member gets no notice; an automatic request has no requester", () => {
  const created = { kind: "created", request: request(1, DAVIDE, MARCO), address: "davide.russo@politorocketteam.it" } as const;
  assert.deepEqual(aliasAnswerNotices(created, "Alessandro Greco"), [
    { recipientId: MARCO, notice: { kind: "alias-created", data: { address: "davide.russo@politorocketteam.it" } } },
  ]);
  assert.deepEqual(aliasAnswerNotices({ kind: "decline", request: request(1, DAVIDE, MARCO) }, "Alessandro Greco"), [
    { recipientId: MARCO, notice: { kind: "alias-declined", data: { by: "Alessandro Greco" } } },
  ]);
  assert.deepEqual(aliasAnswerNotices({ ...created, request: request(2, DAVIDE, null) }, "Alessandro Greco"), []);
  assert.deepEqual(aliasAnswerNotices({ kind: "decline", request: request(2, DAVIDE, null) }, "Alessandro Greco"), []);
});

test("the notices read as attention rows", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const read = (kind: string, data: unknown) => attentionOf(noticeOf({ id: 1, kind, subject: "Davide Russo", createdAt: "2026-10-22T10:00:00Z", data })!, now);
  assert.equal(read("alias-created", { address: "davide.russo@politorocketteam.it" }).title, "Davide Russo's email alias is ready");
  assert.equal(read("alias-declined", { by: "Alessandro Greco" }).title, "Alessandro Greco declined the email alias for Davide Russo");
  assert.equal(noticeOf({ id: 1, kind: "alias-created", subject: "x", createdAt: "2026-10-22T10:00:00Z", data: {} }), null);
  assert.equal(noticeOf({ id: 1, kind: "alias-ready", subject: "x", createdAt: "2026-10-22T10:00:00Z", data: { address: "x@politorocketteam.it" } }), null, "an older alias-ready row is not shown");
});

test("the approver's rows (board 94c): one per open request, oldest first, the automatic one as its own row", () => {
  const now = new Date("2026-10-22T12:00:00+02:00");
  const open = [request(2, MARCO, null, "2026-10-22T10:00:00+02:00"), request(1, DAVIDE, MARCO, "2026-10-21T10:00:00+02:00")];
  const rows = aliasAttentionFor(testDeveloperStanding("team-leader"), open, team, org, now);
  assert.deepEqual(
    rows.map((r) => [r.kind, r.title, r.detail]),
    [
      ["alias-request", "Marco Bianchi asks for an email alias for Davide Russo", "Sent yesterday · create it in Google Workspace, then mark it created"],
      ["alias-request", "Marco Bianchi needs an email alias", "Automatic · became Mission Analysis lead today and has no alias"],
    ],
  );
  assert.deepEqual(rows[0].action, { answerAlias: 1, member: "Davide Russo", prefill: "davide.russo@politorocketteam.it" });
  assert.deepEqual(aliasAttentionFor(testDeveloperStanding("department-head"), open, team, org, now), []);
  assert.deepEqual(aliasAttentionFor(testDeveloperStanding("team-leader"), [request(3, 999, null)], team, org, now), [], "someone off the team");
});

test("the member drawer's alias: set, requested, or none with Request alias only for who may ask", () => {
  const now = new Date("2026-10-22T12:00:00+02:00");
  const aliases = memberAliasesFor({
    viewerId: MARCO,
    memberIds: [DAVIDE, LENA, RICCARDO, 999],
    team,
    org,
    addresses: new Map([[RICCARDO, "riccardo.lombardi@politorocketteam.it"]]),
    open: [request(1, LENA, CHIARA, "2026-10-20T10:00:00+02:00")],
    now,
  });
  assert.deepEqual(aliases, {
    [DAVIDE]: { kind: "none", requestable: true },
    [LENA]: { kind: "requested", requestId: 1, line: "by Chiara Rinaldi · 20 Oct", cancellable: false },
    [RICCARDO]: { kind: "set", address: "riccardo.lombardi@politorocketteam.it" },
  });
  const asMember = memberAliasesFor({ viewerId: LENA, memberIds: [DAVIDE], team, org, addresses: new Map(), open: [], now });
  assert.deepEqual(asMember, { [DAVIDE]: { kind: "none", requestable: false } });
  const asSender = memberAliasesFor({ viewerId: CHIARA, memberIds: [LENA], team, org, addresses: new Map(), open: [request(1, LENA, CHIARA, "2026-10-22T08:00:00Z")], now });
  assert.deepEqual(asSender[LENA], { kind: "requested", requestId: 1, line: "by you · 22 Oct", cancellable: true });
});
