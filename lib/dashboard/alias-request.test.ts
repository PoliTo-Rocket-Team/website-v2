import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aliasAnswerNotices,
  aliasAttentionFor,
  aliasPrefill,
  checkAliasAddress,
  checkAliasAnswer,
  checkAliasRequest,
  memberAliasesFor,
  owedAliasRequests,
  planAliasAnswer,
  planAliasCancel,
  planAliasRequest,
  planOwnAliasRequest,
  personalRequestChoice,
  type AliasRequest,
  type AliasTeamPerson,
} from "./alias-request";
import { actingTitleOf } from "./acting-account";
import type { TeamPerson } from "./division-edit";
import { attentionOf, noticeOf } from "./notices";
import { membershipsOf, type OrgChart } from "./team";
import { plainSeatStanding, type ViewerStanding } from "./viewer";

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

const person = (id: number, name: string, rest: Partial<Pick<TeamPerson, "memberships" | "beyond">>): AliasTeamPerson => ({
  id,
  name,
  emails: [],
  signInEmail: `person-${id}@mail.test`,
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
const SARA = 16; // the IT lead, a member of Design & Manufacturing

const team: AliasTeamPerson[] = [
  person(MARCO, "Marco Bianchi", { memberships: lead(1) }),
  person(DAVIDE, "Davide Russo", { memberships: member(1) }),
  person(LENA, "Lena Fischer", { memberships: member(2) }),
  person(RICCARDO, "Riccardo Lombardi", { memberships: member(3) }),
  person(CHIARA, "Chiara Rinaldi", { beyond: [{ kind: "head", departmentId: 1, title: "" }] }),
  person(ALESSANDRO, "Alessandro Greco", { beyond: [{ kind: "team-leader", title: "" }] }),
  person(GIULIA, "Giulia Rossi", { beyond: [{ kind: "head", departmentId: null, title: "" }] }),
  person(SARA, "Sara Conti", { memberships: member(3) }),
];

const IT_LEAD: ViewerStanding = { kind: "operations-lead", seat: "it-lead", siteContent: false, approveOrders: false };

/** Each person's standing as `viewerStandingOf` reads it: full access for the team leader, the operations lead and the IT lead. */
function standingOf(id: number | null): ViewerStanding {
  if (id === ALESSANDRO) return plainSeatStanding("team-leader");
  if (id === GIULIA) return plainSeatStanding("operations-lead");
  if (id === SARA) return IT_LEAD;
  if (id === MARCO) return plainSeatStanding("division-lead");
  if (id === CHIARA) return plainSeatStanding("department-head");
  return plainSeatStanding(id === null ? "non-member" : "member");
}

const request = (id: number, memberId: number, requesterId: number | null, sentAt = "2026-10-22T09:00:00+02:00"): AliasRequest => ({ id, memberId, requesterId, address: null, sentAt });
/** The address a personal request sends unless a test names another: firstname.lastname, as the dialog pre-fills it. */
const NEW_ADDRESS = "new.person@politorocketteam.it";
const ask = (
  requesterId: number | null,
  memberId: number,
  extra: { prtEmail?: string | null; open?: AliasRequest[]; address?: string; taken?: string[] } = {},
) =>
  planAliasRequest({
    requesterId,
    standing: standingOf(requesterId),
    memberId,
    team,
    org,
    prtEmail: extra.prtEmail ?? null,
    open: extra.open ?? [],
    address: extra.address ?? NEW_ADDRESS,
    taken: extra.taken ?? [],
  });

test("a lead asks for their division, a head for their department, the team leader for anyone", () => {
  assert.ok(ask(MARCO, DAVIDE).ok);
  assert.equal(ask(MARCO, LENA).ok, false, "a division the lead does not lead");
  assert.ok(ask(CHIARA, DAVIDE).ok);
  assert.ok(ask(CHIARA, LENA).ok);
  assert.equal(ask(CHIARA, RICCARDO).ok, false, "another department");
  for (const id of [DAVIDE, LENA, RICCARDO, MARCO, CHIARA]) assert.ok(ask(ALESSANDRO, id).ok, `team leader for ${id}`);
});

test("nobody else asks: a member, a lead or head for themselves, nobody for someone off the team", () => {
  const refused = { ok: false, error: "You can request a PRT email only for someone you lead or head." };
  assert.deepEqual(ask(DAVIDE, LENA), refused);
  assert.deepEqual(ask(MARCO, MARCO), refused, "a lead for themselves");
  assert.deepEqual(ask(CHIARA, CHIARA), refused, "a head for themselves");
  assert.deepEqual(ask(null, DAVIDE), refused);
  assert.deepEqual(ask(MARCO, 999), refused, "someone not on the team");
  assert.deepEqual(ask(SARA, 999), refused, "full access, for someone not on the team");
});

test("anyone with full access asks for any member, themselves included (Owner decision, 2026-10-25, issue #721)", () => {
  assert.ok(ask(SARA, DAVIDE).ok, "the IT lead, for a member outside their unit");
  assert.ok(ask(SARA, SARA).ok, "the IT lead, for themselves");
  assert.ok(ask(GIULIA, DAVIDE).ok, "the operations lead without a lead role");
  assert.ok(ask(ALESSANDRO, ALESSANDRO).ok, "the team leader, for themselves");
  for (const seat of ["project-manager", "chief-engineer", null] as const) {
    const standing: ViewerStanding = { kind: "operations-lead", seat, siteContent: false, approveOrders: false };
    assert.ok(planAliasRequest({ requesterId: LENA, standing, memberId: RICCARDO, team, org, prtEmail: null, open: [], address: NEW_ADDRESS, taken: [] }).ok, `seat ${seat}`);
  }
});

test("full access asks for nobody who already has a PRT email or an open request", () => {
  assert.deepEqual(ask(SARA, DAVIDE, { open: [request(1, DAVIDE, null)] }), { ok: false, error: "A personal PRT email for Davide Russo is already requested." });
  assert.deepEqual(
    ask(SARA, DAVIDE, { prtEmail: "", open: [request(1, DAVIDE, MARCO)] }),
    { ok: false, error: "A personal PRT email for Davide Russo is already requested." },
    "an empty PRT email with an open request",
  );
  assert.deepEqual(ask(SARA, DAVIDE, { prtEmail: "davide.russo@politorocketteam.it" }), { ok: false, error: "Davide Russo already has a personal PRT email." });
  assert.equal(ask(ALESSANDRO, ALESSANDRO, { prtEmail: "alessandro.greco@politorocketteam.it" }).ok, false, "themselves, once set");
});

test("a plain division lead is still refused for a member outside their division", () => {
  assert.deepEqual(ask(MARCO, LENA), { ok: false, error: "You can request a PRT email only for someone you lead or head." });
  assert.deepEqual(ask(MARCO, RICCARDO), { ok: false, error: "You can request a PRT email only for someone you lead or head." });
});

const askOwn = (memberId: number, extra: { prtEmail?: string | null; open?: AliasRequest[]; address?: string; taken?: string[] } = {}) =>
  planOwnAliasRequest({
    memberId,
    team,
    prtEmail: extra.prtEmail ?? null,
    open: extra.open ?? [],
    address: extra.address ?? NEW_ADDRESS,
    taken: extra.taken ?? [],
  });

test("any member asks for their own PRT email on My profile, with no lead or full access (issue #921)", () => {
  assert.deepEqual(askOwn(DAVIDE), { ok: true, value: { memberId: DAVIDE, requesterId: DAVIDE, address: NEW_ADDRESS } });
  assert.ok(askOwn(MARCO).ok, "a lead, for themselves");
  assert.equal(ask(DAVIDE, DAVIDE).ok, false, "and Request PRT email still offers a member nothing for themselves");
  assert.deepEqual(askOwn(999), { ok: false, error: "You can request a PRT email only while you are on the team." });
});

test("their own request meets the rules every request meets: one open, none once set, no address held (issue #921)", () => {
  assert.deepEqual(askOwn(DAVIDE, { open: [request(1, DAVIDE, null)] }), { ok: false, error: "A personal PRT email for Davide Russo is already requested." });
  assert.deepEqual(askOwn(DAVIDE, { prtEmail: "davide.russo@politorocketteam.it" }), { ok: false, error: "Davide Russo already has a personal PRT email." });
  assert.deepEqual(askOwn(DAVIDE, { taken: ["New.Person@politorocketteam.it"] }), { ok: false, error: `${NEW_ADDRESS} is already a PRT email.` });
});

test("a member with a PRT email or an open request gets no second one", () => {
  assert.deepEqual(ask(MARCO, DAVIDE, { prtEmail: "davide.russo@politorocketteam.it" }), { ok: false, error: "Davide Russo already has a personal PRT email." });
  assert.deepEqual(ask(MARCO, DAVIDE, { open: [request(1, DAVIDE, null)] }), { ok: false, error: "A personal PRT email for Davide Russo is already requested." });
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
    memberAliasesFor({ viewerId: MARCO, standing: standingOf(MARCO), memberIds: [DAVIDE], team, org, addresses: new Map([[DAVIDE, ""]]), open: [], now: new Date("2026-10-22T12:00:00Z") }),
    { [DAVIDE]: { kind: "none", requestable: true } },
    "the drawer offers Request alias again",
  );
});

test("Cancel request: the sender, or anyone who leads or heads the member", () => {
  const sent = request(1, DAVIDE, MARCO);
  assert.ok(planAliasCancel({ viewerId: MARCO, request: sent, team, org }).ok);
  assert.ok(planAliasCancel({ viewerId: CHIARA, request: sent, team, org }).ok);
  assert.equal(planAliasCancel({ viewerId: GIULIA, request: sent, team, org }).ok, false);
  assert.equal(planAliasCancel({ viewerId: LENA, request: sent, team, org }).ok, false);
  assert.equal(planAliasCancel({ viewerId: SARA, request: sent, team, org }).ok, false, "full access alone cancels no one else's request");
  assert.ok(planAliasCancel({ viewerId: SARA, request: request(3, SARA, SARA), team, org }).ok, "a full-access holder cancels their own");
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
  assert.deepEqual(checkAliasAddress("davide.russo@gmail.com"), { ok: false, error: "The PRT email must end with @politorocketteam.it." });
  assert.deepEqual(checkAliasAddress("davide.russo@politorocketteam.it.evil"), { ok: false, error: "The PRT email must end with @politorocketteam.it." });
  for (const bad of ["davide_russo", "davide..russo", "a.b.c", ".russo", "", "davide russo"]) {
    assert.equal(checkAliasAddress(`${bad}@politorocketteam.it`).ok, false, bad);
  }
});

test("only the team leader, the operations lead and the IT lead answer", () => {
  const open = request(1, DAVIDE, MARCO);
  const answer = (viewer: ViewerStanding) => planAliasAnswer({ viewer, request: open, answer: { kind: "decline" } }).ok;
  assert.ok(answer(plainSeatStanding("team-leader")));
  assert.ok(answer(plainSeatStanding("operations-lead")));
  assert.ok(answer({ kind: "operations-lead", seat: "it-lead", siteContent: false, approveOrders: false }));
  for (const seat of ["project-manager", "chief-engineer", null] as const) {
    assert.equal(answer({ kind: "operations-lead", seat, siteContent: false, approveOrders: false }), false, `seat ${seat}`);
  }
  for (const kind of ["department-head", "division-lead", "member", "alumni", "non-member"] as const) assert.equal(answer(plainSeatStanding(kind)), false, kind);
});

test("Mark created checks the address on the server and saves it lower-cased", () => {
  const viewer = plainSeatStanding("team-leader");
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
  assert.equal(read("alias-created", { address: "davide.russo@politorocketteam.it" }).title, "Davide Russo's PRT email is ready");
  assert.equal(read("alias-declined", { by: "Alessandro Greco" }).title, "Alessandro Greco declined the PRT email for Davide Russo");
  assert.equal(noticeOf({ id: 1, kind: "alias-created", subject: "x", createdAt: "2026-10-22T10:00:00Z", data: {} }), null);
  assert.equal(noticeOf({ id: 1, kind: "alias-ready", subject: "x", createdAt: "2026-10-22T10:00:00Z", data: { address: "x@politorocketteam.it" } }), null, "an older alias-ready row is not shown");
});

test("a Decline made while viewing as the approver names the acting account too; one made outside View as names the approver alone (issue #628)", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const [declined] = aliasAnswerNotices({ kind: "decline", request: request(1, DAVIDE, MARCO) }, "Sara Conti");
  assert.ok(declined);
  const read = (actingTitle: string | null) =>
    attentionOf(noticeOf({ id: 1, kind: declined.notice.kind, subject: "Davide Russo", createdAt: "2026-10-22T10:00:00Z", actingTitle, data: declined.notice.data })!, now)
      .title;
  assert.equal(read(actingTitleOf(["it-lead"], "live")), "IT lead as Sara Conti declined the PRT email for Davide Russo");
  assert.equal(read(actingTitleOf([null], "test")), "Admin tester as Sara Conti declined the PRT email for Davide Russo");
  assert.equal(read(null), "Sara Conti declined the PRT email for Davide Russo");
  const created = aliasAnswerNotices({ kind: "created", request: request(1, DAVIDE, MARCO), address: "davide.russo@politorocketteam.it" }, "Sara Conti");
  const ready = noticeOf({ id: 2, kind: "alias-created", subject: "Davide Russo", createdAt: "2026-10-22T10:00:00Z", actingTitle: "IT lead", data: created[0]!.notice.data });
  assert.equal(attentionOf(ready!, now).title, "Davide Russo's PRT email is ready", "Mark created names no one who acted");
});

test("the approver's rows (board 94c): one per open request, oldest first, the automatic one as its own row", () => {
  const now = new Date("2026-10-22T12:00:00+02:00");
  const open = [request(2, MARCO, null, "2026-10-22T10:00:00+02:00"), request(1, DAVIDE, MARCO, "2026-10-21T10:00:00+02:00")];
  const rows = aliasAttentionFor(plainSeatStanding("team-leader"), open, team, org, now);
  assert.deepEqual(
    rows.map((r) => [r.kind, r.title, r.detail]),
    [
      ["prt-email-request", "PRT email request for Davide Russo", "Personal · from Marco Bianchi · sent yesterday"],
      ["prt-email-request", "PRT email request for Marco Bianchi", "Personal · automatic · became Mission Analysis lead today and has no PRT email"],
    ],
  );
  assert.deepEqual(rows[0].action, {
    answerAlias: 1,
    member: "Davide Russo",
    prefill: "davide.russo@politorocketteam.it",
    signInEmail: `person-${DAVIDE}@mail.test`,
  });
  assert.deepEqual(aliasAttentionFor(plainSeatStanding("department-head"), open, team, org, now), []);
  assert.deepEqual(aliasAttentionFor(plainSeatStanding("team-leader"), [request(3, 999, null)], team, org, now), [], "someone off the team");
});

test("the member drawer's alias: set, requested, or none with Request alias only for who may ask", () => {
  const now = new Date("2026-10-22T12:00:00+02:00");
  const aliases = memberAliasesFor({
    viewerId: MARCO,
    standing: standingOf(MARCO),
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
  const asMember = memberAliasesFor({ viewerId: LENA, standing: standingOf(LENA), memberIds: [DAVIDE], team, org, addresses: new Map(), open: [], now });
  assert.deepEqual(asMember, { [DAVIDE]: { kind: "none", requestable: false } });
  const asSender = memberAliasesFor({ viewerId: CHIARA, standing: standingOf(CHIARA), memberIds: [LENA], team, org, addresses: new Map(), open: [request(1, LENA, CHIARA, "2026-10-22T08:00:00Z")], now });
  assert.deepEqual(asSender[LENA], { kind: "requested", requestId: 1, line: "by you · 22 Oct", cancellable: true });
});

test("the drawer's Request alias shows exactly when Request alias would be accepted (issue #721)", () => {
  const now = new Date("2026-10-22T12:00:00+02:00");
  const open = [request(1, LENA, CHIARA)];
  const addresses = new Map([[RICCARDO, "riccardo.lombardi@politorocketteam.it"]]);
  const everyone = team.map((p) => p.id);
  for (const viewerId of [...everyone, null]) {
    const aliases = memberAliasesFor({ viewerId, standing: standingOf(viewerId), memberIds: everyone, team, org, addresses, open, now });
    for (const memberId of everyone) {
      const accepted = planAliasRequest({
        requesterId: viewerId,
        standing: standingOf(viewerId),
        memberId,
        team,
        org,
        prtEmail: addresses.get(memberId) ?? null,
        open,
        address: NEW_ADDRESS,
        taken: [...addresses.values()],
      }).ok;
      const alias = aliases[memberId]!;
      assert.equal(alias.kind === "none" && alias.requestable, accepted, `viewer ${viewerId} for ${memberId}`);
    }
  }
  const asItLead = memberAliasesFor({ viewerId: SARA, standing: IT_LEAD, memberIds: [DAVIDE, SARA, LENA, RICCARDO], team, org, addresses, open, now });
  assert.deepEqual(asItLead[DAVIDE], { kind: "none", requestable: true });
  assert.deepEqual(asItLead[SARA], { kind: "none", requestable: true });
  assert.equal(asItLead[LENA]?.kind, "requested");
  assert.equal(asItLead[RICCARDO]?.kind, "set");
});

test("a request sent while viewing as the requester names the acting seat, to the requester too (issue #605)", () => {
  const now = new Date("2026-10-22T12:00:00+02:00");
  const viewedAs: AliasRequest = { ...request(1, LENA, CHIARA, "2026-10-22T08:00:00Z"), requesterActingTitle: "IT lead" };
  for (const viewerId of [CHIARA, MARCO]) {
    const aliases = memberAliasesFor({ viewerId, standing: standingOf(viewerId), memberIds: [LENA], team, org, addresses: new Map(), open: [viewedAs], now });
    assert.equal((aliases[LENA] as { line: string }).line, "by IT lead as Chiara Rinaldi · 22 Oct", `as ${viewerId}`);
  }
  const [row] = aliasAttentionFor(plainSeatStanding("team-leader"), [viewedAs], team, org, now);
  assert.equal(row.detail, "Personal · from IT lead as Chiara Rinaldi · sent today");
});

// Request PRT email's Personal choice (issue #798) ---------------------------

test("a personal request carries the address the requester confirmed, checked and saved in lower case (issue #798)", () => {
  assert.deepEqual(checkAliasRequest({ memberId: DAVIDE, address: " Davide.Russo@PoliToRocketTeam.it " }), {
    ok: true,
    value: { memberId: DAVIDE, address: "davide.russo@politorocketteam.it" },
  });
  assert.deepEqual(checkAliasRequest({ memberId: DAVIDE, address: "davide.russo@gmail.com" }), { ok: false, error: "The PRT email must end with @politorocketteam.it." });
  assert.equal(checkAliasRequest({ memberId: DAVIDE, address: "davide_russo@politorocketteam.it" }).ok, false, "neither firstname.lastname nor one word");
  assert.equal(checkAliasRequest({ memberId: DAVIDE }).ok, false, "no address");
  assert.equal(checkAliasRequest(DAVIDE).ok, false, "a bare member id, as Request alias sent it");
  assert.deepEqual(ask(MARCO, DAVIDE, { address: "d.russo@politorocketteam.it" }), {
    ok: true,
    value: { memberId: DAVIDE, requesterId: MARCO, address: "d.russo@politorocketteam.it" },
  });
});

test("a personal request refuses an address someone already holds, as a PRT email or a special one", () => {
  const address = "davide.russo@politorocketteam.it";
  assert.deepEqual(ask(MARCO, DAVIDE, { address, taken: ["Davide.Russo@politorocketteam.it"] }), { ok: false, error: `${address} is already a PRT email.` });
  assert.equal(ask(MARCO, DAVIDE, { address: "recruitment@politorocketteam.it", taken: ["recruitment@politorocketteam.it"] }).ok, false, "a special one");
  assert.ok(ask(MARCO, DAVIDE, { address, taken: ["lena.fischer@politorocketteam.it"] }).ok, "another address blocks nothing");
});

test("Mark created starts from the address asked for, or from the name when the request stored none (issue #798)", () => {
  const now = new Date("2026-10-22T12:00:00+02:00");
  const asked: AliasRequest = { ...request(1, DAVIDE, MARCO, "2026-10-22T10:00:00+02:00"), address: "d.russo@politorocketteam.it" };
  const [byHand, automatic] = aliasAttentionFor(IT_LEAD, [asked, request(2, LENA, null, "2026-10-22T11:00:00+02:00")], team, org, now);
  assert.equal(byHand.detail, "Personal · d.russo@politorocketteam.it · from Marco Bianchi · sent today");
  assert.equal((byHand.action as { prefill: string }).prefill, "d.russo@politorocketteam.it");
  assert.equal((automatic.action as { prefill: string }).prefill, "lena.fischer@politorocketteam.it", "a request the site made stores no address");
});

test("Request PRT email offers Personal only while there is no personal PRT email and no open personal request (issue #798)", () => {
  assert.deepEqual(personalRequestChoice({ kind: "none", requestable: true }, "Davide Russo"), { allowed: true });
  assert.deepEqual(personalRequestChoice({ kind: "set", address: "davide.russo@politorocketteam.it" }, "Davide Russo"), {
    allowed: false,
    reason: "Davide already has a personal PRT email.",
  });
  assert.deepEqual(personalRequestChoice({ kind: "requested", requestId: 1, line: "by you · 22 Oct", cancellable: true }, "Davide Russo"), {
    allowed: false,
    reason: "A personal PRT email for Davide is already requested.",
  });
  assert.equal(personalRequestChoice(null, "Davide Russo").allowed, false, "an alias that was not read offers nothing");
});
