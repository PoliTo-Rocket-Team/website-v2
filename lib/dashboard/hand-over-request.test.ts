import assert from "node:assert/strict";
import { test } from "node:test";
import { actingTitleOf } from "./acting-account";
import type { FoundPerson, TeamPerson } from "./division-edit";
import {
  answerNoticeOf,
  approverIdsOf,
  checkHandOverSend,
  handOverAttentionFor,
  handOverOfferOf,
  hasLapsed,
  lapsedBy,
  planHandOverAnswer,
  planHandOverSend,
  roleToHandOver,
  sentWhen,
  type HandOverRequest,
} from "./hand-over-request";
import { attentionOf, noticeOf } from "./notices";
import { membershipsOf, type OrgChart } from "./team";

// Hand over your role from My profile (issue #262): who may send, who answers,
// and what each answer does.

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

const person = (id: number, name: string, rest: Partial<Pick<TeamPerson, "memberships" | "beyond">>): FoundPerson => ({
  id,
  name,
  photoUrl: null,
  emails: [],
  memberships: rest.memberships ?? membershipsOf([]),
  beyond: rest.beyond ?? [],
});
const lead = (divisionId: number) => membershipsOf([{ divisionId, role: "lead", since: "2023-10-01" }]);
const member = (divisionId: number) => membershipsOf([{ divisionId, role: "member", since: "2024-10-01" }]);

const MARCO = 2; // leads Mission Analysis
const PIETRO = 6; // co-leads Mission Analysis
const SARA = 7; // a member of Mission Analysis
const PAOLO = 20; // leads Optimization and Analysis
const CHIARA = 15; // Head of Aerodynamics
const DAVIDE = 16; // Head of Structures
const ALESSANDRO = 14; // the team leader
const RICCARDO = 22; // a member of Design & Manufacturing

const team: FoundPerson[] = [
  person(MARCO, "Marco Bianchi", { memberships: lead(1) }),
  person(PIETRO, "Pietro Ricci", { memberships: lead(1) }),
  person(SARA, "Sara Conti", { memberships: member(1) }),
  person(PAOLO, "Paolo Conti", { memberships: lead(2) }),
  person(CHIARA, "Chiara Rinaldi", { beyond: [{ kind: "head", departmentId: 1, title: "" }] }),
  person(DAVIDE, "Davide Russo", { beyond: [{ kind: "head", departmentId: 2, title: "" }] }),
  person(ALESSANDRO, "Alessandro Greco", { beyond: [{ kind: "team-leader", title: "" }] }),
  person(RICCARDO, "Riccardo Moretti", { memberships: member(3) }),
];

const leadRequest: HandOverRequest = { id: 1, fromId: MARCO, role: { kind: "lead", divisionId: 1 }, toId: SARA, outcome: "advisor", sentAt: "2026-10-16T08:00:00Z" };
const headRequest: HandOverRequest = { id: 2, fromId: CHIARA, role: { kind: "head", departmentId: 1 }, toId: PAOLO, outcome: "leave", sentAt: "2026-10-15T08:00:00Z" };
const now = new Date("2026-10-16T12:00:00Z");

test("My profile offers a lead their division and a head their department; a member and the team leader get none", () => {
  const offer = (id: number) => roleToHandOver(team.find((p) => p.id === id)!);
  assert.deepEqual(offer(MARCO), { kind: "lead", divisionId: 1 });
  assert.deepEqual(offer(CHIARA), { kind: "head", departmentId: 1 });
  assert.equal(offer(SARA), null, "a member with no role keeps Leave the team");
  assert.equal(offer(ALESSANDRO), null, "the team leader hands over from the Team Leader box (board 77i)");
  // A head who also leads a division hands over the department.
  assert.deepEqual(roleToHandOver(person(30, "Both", { memberships: lead(1), beyond: [{ kind: "head", departmentId: 1, title: "" }] })), { kind: "head", departmentId: 1 });
});

test("the offer names the role, who may take over from the unit, and who confirms", () => {
  const marco = handOverOfferOf(team.find((p) => p.id === MARCO)!, team, org, null)!;
  assert.deepEqual([marco.title, marco.unit, marco.approver, marco.waiting], ["Lead of Mission Analysis", "Mission Analysis", "department-head", null]);
  assert.deepEqual(marco.successors.map((s) => [s.name, s.unit]), [["Pietro Ricci", "Mission Analysis"], ["Sara Conti", "Mission Analysis"]]);
  const chiara = handOverOfferOf(team.find((p) => p.id === CHIARA)!, team, org, null)!;
  assert.equal(chiara.approver, "team-leader");
  assert.deepEqual(chiara.successors.map((s) => s.id), [MARCO, PIETRO, SARA, PAOLO], "everyone in the department's divisions");
  const waiting = handOverOfferOf(team.find((p) => p.id === MARCO)!, team, org, leadRequest)!;
  assert.deepEqual(waiting.waiting, { to: "Sara Conti", outcome: "advisor", sentAt: leadRequest.sentAt });
});

test("Send for confirmation is stored as asked and changes no role; the rules refuse the rest", () => {
  const send = { role: { kind: "lead", divisionId: 1 }, to: SARA, outcome: "advisor" } as const;
  assert.deepEqual(planHandOverSend({ senderId: MARCO, send, team, org, waiting: [] }), { ok: true, value: { send, lapsed: [] } });
  // Planning reads the team and writes nothing: Marco still leads, Sara is still a member.
  assert.equal(team.find((p) => p.id === MARCO)!.memberships[0].role, "lead");
  assert.equal(team.find((p) => p.id === SARA)!.memberships[0].role, "member");
  assert.equal(planHandOverSend({ senderId: MARCO, send, team, org, waiting: [leadRequest] }).ok, false, "one request waits at a time");
  assert.equal(planHandOverSend({ senderId: MARCO, send: { ...send, to: RICCARDO }, team, org, waiting: [] }).ok, false, "not in the division");
  assert.equal(planHandOverSend({ senderId: MARCO, send: { ...send, to: MARCO }, team, org, waiting: [] }).ok, false, "not themselves");
  assert.equal(planHandOverSend({ senderId: SARA, send, team, org, waiting: [] }).ok, false, "a member holds no role to hand over");
  assert.equal(planHandOverSend({ senderId: MARCO, send: { ...send, role: { kind: "lead", divisionId: 2 } }, team, org, waiting: [] }).ok, false, "not their division");
  const headless = team.filter((p) => p.id !== CHIARA);
  assert.equal(planHandOverSend({ senderId: MARCO, send, team: headless, org, waiting: [] }).ok, false, "nobody could confirm it");
  assert.equal(checkHandOverSend({ role: { kind: "lead", divisionId: 1 }, to: SARA }).ok, false, "nothing picked for them");
  assert.equal(checkHandOverSend({ role: { kind: "team-leader" }, to: SARA, outcome: "advisor" }).ok, false);
});

test("only the next level up answers: a head of the lead's department, the team leader for a head", () => {
  assert.deepEqual(approverIdsOf(leadRequest.role, MARCO, team, org), [CHIARA]);
  assert.deepEqual(approverIdsOf(headRequest.role, CHIARA, team, org), [ALESSANDRO]);
  for (const viewerId of [MARCO, PIETRO, SARA, DAVIDE, ALESSANDRO, null]) {
    const refused = planHandOverAnswer({ viewerId, request: leadRequest, answer: "confirm", team, org });
    assert.equal(refused.ok, false, `${viewerId} may not confirm a lead's hand-over`);
    assert.equal(planHandOverAnswer({ viewerId, request: leadRequest, answer: "decline", team, org }).ok, false);
  }
  for (const viewerId of [CHIARA, DAVIDE, MARCO]) {
    assert.equal(planHandOverAnswer({ viewerId, request: headRequest, answer: "confirm", team, org }).ok, false, `${viewerId} may not answer a head's`);
  }
  assert.ok(planHandOverAnswer({ viewerId: ALESSANDRO, request: headRequest, answer: "confirm", team, org }).ok);
  // Nobody answers their own request, even one who heads the department too.
  const both = [...team, person(30, "Both", { memberships: lead(2), beyond: [{ kind: "head", departmentId: 1, title: "" }] })];
  assert.deepEqual(approverIdsOf({ kind: "lead", divisionId: 2 }, 30, both, org), [CHIARA]);
});

test("every holder of the seat above answers: each team leader for a head, each head for a lead; never the sender (epic #861)", () => {
  const GIULIA = 23; // a second team leader
  const LUCIA = 24; // a second Head of Aerodynamics
  const coHeld = [
    ...team,
    person(GIULIA, "Giulia Ferri", { beyond: [{ kind: "team-leader", title: "" }] }),
    person(LUCIA, "Lucia Gallo", { beyond: [{ kind: "head", departmentId: 1, title: "" }] }),
  ];
  assert.deepEqual(approverIdsOf(leadRequest.role, MARCO, coHeld, org), [CHIARA, LUCIA]);
  assert.deepEqual(approverIdsOf(headRequest.role, CHIARA, coHeld, org), [ALESSANDRO, GIULIA]);
  // A co-head sends their own head's request: the team leaders answer it, never the other co-head.
  const fromLucia: HandOverRequest = { ...headRequest, id: 3, fromId: LUCIA };
  assert.deepEqual(approverIdsOf(fromLucia.role, LUCIA, coHeld, org), [ALESSANDRO, GIULIA]);
  assert.equal(planHandOverAnswer({ viewerId: CHIARA, request: fromLucia, answer: "decline", team: coHeld, org }).ok, false, "a co-head answers no head's request");
  // A lead who also co-heads the department sends a lead's request: the other head answers, never them.
  const both = [...coHeld, person(30, "Both", { memberships: lead(2), beyond: [{ kind: "head", departmentId: 1, title: "" }] })];
  assert.deepEqual(approverIdsOf({ kind: "lead", divisionId: 2 }, 30, both, org), [CHIARA, LUCIA]);

  for (const [request, approvers] of [
    [leadRequest, [CHIARA, LUCIA]],
    [headRequest, [ALESSANDRO, GIULIA]],
  ] as const) {
    for (const viewerId of approvers) {
      for (const answer of ["confirm", "decline"] as const) {
        assert.ok(planHandOverAnswer({ viewerId, request, answer, team: coHeld, org }).ok, `${viewerId} may ${answer} request ${request.id}`);
      }
      assert.deepEqual(
        handOverAttentionFor(viewerId, [leadRequest, headRequest], coHeld, org, now).map((r) => r.action),
        [{ answerHandOver: request.id }],
        `${viewerId} sees request ${request.id} on their Overview`,
      );
    }
    assert.equal(planHandOverAnswer({ viewerId: request.fromId, request, answer: "confirm", team: coHeld, org }).ok, false, "the sender answers nothing");
  }
});

test("Confirm hands the role over as the sender chose; Decline changes no role; both notify the sender", () => {
  const confirmed = planHandOverAnswer({ viewerId: CHIARA, request: leadRequest, answer: "confirm", team, org });
  assert.ok(confirmed.ok && confirmed.value.answer === "confirm");
  assert.deepEqual(confirmed.value.steppingDown, { kind: "advisor", place: { kind: "division", divisionId: 1 }, access: "ends" });
  const leaving = planHandOverAnswer({ viewerId: ALESSANDRO, request: headRequest, answer: "confirm", team, org });
  assert.ok(leaving.ok && leaving.value.answer === "confirm");
  assert.deepEqual(leaving.value.steppingDown, { kind: "leave" });

  const declined = planHandOverAnswer({ viewerId: CHIARA, request: leadRequest, answer: "decline", team, org });
  assert.deepEqual(declined, { ok: true, value: { answer: "decline", request: leadRequest } });

  assert.deepEqual(answerNoticeOf(confirmed.value, team, org), {
    recipientId: MARCO,
    notice: { kind: "hand-over-answered", data: { role: "Mission Analysis lead", successor: "Sara Conti", answer: "confirmed" } },
  });
  assert.ok(declined.ok);
  const notice = answerNoticeOf(declined.value, team, org);
  assert.equal(notice.recipientId, MARCO);
  const row = noticeOf({ id: 9, kind: notice.notice.kind, subject: "Chiara Rinaldi", createdAt: "2026-10-16T09:00:00Z", data: notice.notice.data });
  assert.ok(row);
  assert.deepEqual(attentionOf(row, now), {
    kind: "notice",
    title: "Chiara Rinaldi declined your hand-over",
    detail: "Mission Analysis lead to Sara Conti · 16 Oct · you keep the role",
    action: { label: "Dismiss", dismissNotice: 9 },
  });
});

test("an answer made while viewing as the approver names the acting account too; one made outside View as names the approver alone (issue #628)", () => {
  const read = (answer: "confirm" | "decline", actingTitle: string | null) => {
    const planned = planHandOverAnswer({ viewerId: CHIARA, request: leadRequest, answer, team, org });
    assert.ok(planned.ok);
    const { notice } = answerNoticeOf(planned.value, team, org);
    const row = noticeOf({ id: 9, kind: notice.kind, subject: "Sara Conti", createdAt: "2026-10-16T09:00:00Z", actingTitle, data: notice.data });
    assert.ok(row);
    return attentionOf(row, now).title;
  };
  assert.equal(read("confirm", actingTitleOf(["it-lead"], "live")), "IT lead as Sara Conti confirmed your hand-over");
  assert.equal(read("decline", actingTitleOf(["it-lead"], "live")), "IT lead as Sara Conti declined your hand-over");
  assert.equal(read("confirm", null), "Sara Conti confirmed your hand-over");
  assert.equal(read("decline", null), "Sara Conti declined your hand-over");
});

test("Confirm is refused once the successor left the unit", () => {
  const moved = team.map((p) => (p.id === SARA ? { ...p, memberships: member(3) } : p));
  const result = planHandOverAnswer({ viewerId: CHIARA, request: leadRequest, answer: "confirm", team: moved, org });
  assert.equal(result.ok, false);
  assert.ok(planHandOverAnswer({ viewerId: CHIARA, request: leadRequest, answer: "decline", team: moved, org }).ok, "Decline still answers it");
});

test("the approver's row reads as board 62c, as the top rows, and only for them", () => {
  assert.deepEqual(handOverAttentionFor(CHIARA, [leadRequest, headRequest], team, org, now), [
    {
      kind: "hand-over",
      title: "Marco Bianchi wants to hand over Mission Analysis lead to Sara Conti",
      detail: "Sent today · Marco then becomes an advisor, without access",
      action: { answerHandOver: 1 },
    },
  ]);
  assert.deepEqual(handOverAttentionFor(ALESSANDRO, [leadRequest, headRequest], team, org, now).map((r) => [r.title, r.detail]), [
    ["Chiara Rinaldi wants to hand over Aerodynamics head to Paolo Conti", "Sent yesterday · Chiara then leaves the team"],
  ]);
  assert.deepEqual(handOverAttentionFor(DAVIDE, [leadRequest, headRequest], team, org, now), []);
  // A sender who no longer holds the role leaves no row behind.
  const stepped = team.map((p) => (p.id === MARCO ? { ...p, memberships: member(1) } : p));
  assert.deepEqual(handOverAttentionFor(CHIARA, [leadRequest], stepped, org, now), []);
});

test("when a request was sent reads in the team's time zone", () => {
  assert.equal(sentWhen("2026-10-15T22:30:00Z", new Date("2026-10-16T06:00:00Z")), "today", "00:30 in Rome is the same day");
  assert.equal(sentWhen("2026-10-02T10:00:00Z", now), "2 Oct");
});

test("a request whose sender's roles changed lapses: nobody answers it, it blocks no send, and any role change closes it", () => {
  const removed = team.map((p) => (p.id === MARCO ? { ...p, memberships: member(1) } : p));
  assert.ok(hasLapsed(leadRequest, removed), "removed as lead");
  assert.ok(!hasLapsed(leadRequest, team));
  // Made head of Structures while he still leads: My profile now offers the department, so the lead request lapsed.
  const madeHead = team.map((p) => (p.id === MARCO ? { ...p, beyond: [{ kind: "head" as const, departmentId: 2, title: "" }] } : p));
  assert.ok(hasLapsed(leadRequest, madeHead));
  assert.equal(planHandOverAnswer({ viewerId: CHIARA, request: leadRequest, answer: "decline", team: madeHead, org }).ok, false, "nobody answers it");
  const headSend = { role: { kind: "head", departmentId: 2 }, to: RICCARDO, outcome: "leave" } as const;
  assert.deepEqual(
    planHandOverSend({ senderId: MARCO, send: headSend, team: madeHead, org, waiting: [leadRequest, headRequest] }),
    { ok: true, value: { send: headSend, lapsed: [leadRequest.id] } },
    "the send closes his lapsed request and reads nobody else's",
  );

  // A change to the sender's roles closes the request for good, so making him lead again brings nothing back.
  assert.deepEqual(lapsedBy([leadRequest, headRequest], team, removed), [leadRequest.id]);
  const joined = team.map((p) => (p.id === MARCO ? { ...p, memberships: membershipsOf([...lead(1), ...member(3)]) } : p));
  assert.deepEqual(lapsedBy([leadRequest], team, joined), [leadRequest.id], "any change to his roles");
  const others = team.map((p) => (p.id === SARA ? { ...p, memberships: member(3) } : p));
  assert.deepEqual(lapsedBy([leadRequest], team, others), [], "a change to someone else's roles closes nothing");
  assert.deepEqual(lapsedBy([leadRequest], team, team.filter((p) => p.id !== MARCO)), [leadRequest.id], "the sender left the team");
});
