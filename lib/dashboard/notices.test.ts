import assert from "node:assert/strict";
import { test } from "node:test";
import { attentionOf, memberLeftNotices, noticeOf, recruitmentManagerDivision } from "./notices";

const missionAnalysis = { id: 1, name: "Mission Analysis Division" };
const hardware = { id: 9, name: "Hardware Division" };

test("a leaver with roles in two divisions tells the lead of each", () => {
  const leads = [
    { memberId: 20, divisionId: 1 },
    { memberId: 30, divisionId: 9 },
    { memberId: 40, divisionId: 5 }, // leads a division the leaver was not in
  ];
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], [], leads, "Graduating."), [
    { recipientId: 20, notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division"], reason: "Graduating." } } },
    { recipientId: 30, notice: { kind: "member-left", data: { divisions: ["Hardware Division"], reason: "Graduating." } } },
  ]);
});

test("a lead of both divisions gets one notice naming both, and a leaving lead is not told about themselves", () => {
  const leads = [
    { memberId: 20, divisionId: 1 },
    { memberId: 20, divisionId: 9 },
    { memberId: 7, divisionId: 9 },
  ];
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], [], leads, null), [
    { recipientId: 20, notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division", "Hardware Division"], reason: null } } },
  ]);
});

test("a leaver whose division has no lead writes no notice", () => {
  assert.deepEqual(memberLeftNotices(7, [hardware], [], [{ memberId: 20, divisionId: 1 }], null), []);
  assert.deepEqual(memberLeftNotices(7, [], [], [], null), []);
});

// The recruitment manager is the lead of the open Logistics division (#705,
// owner ruling on #194).
const logistics = { id: 15, code: "LGS", closedAt: null };
const team = [
  { id: 1, code: "MSA", closedAt: null },
  { id: 9, code: "HDW", closedAt: null },
  logistics,
];

test("the recruitment manager is the open division with the Logistics code, and none when it is closed or missing", () => {
  assert.equal(recruitmentManagerDivision(team), logistics);
  assert.equal(recruitmentManagerDivision([{ ...logistics, closedAt: "2026-09-30" }]), null);
  assert.equal(recruitmentManagerDivision(team.slice(0, 2)), null);
});

test("every Logistics lead is told, naming every division the leaver was in, though the leaver had no role in Logistics", () => {
  const leads = [
    { memberId: 20, divisionId: 1 },
    { memberId: 50, divisionId: 15 },
    { memberId: 51, divisionId: 15 },
  ];
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], team, leads, "Graduating."), [
    { recipientId: 20, notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division"], reason: "Graduating." } } },
    {
      recipientId: 50,
      notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division", "Hardware Division"], reason: "Graduating." } },
    },
    {
      recipientId: 51,
      notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division", "Hardware Division"], reason: "Graduating." } },
    },
  ]);
});

test("a Logistics lead who also leads one of the leaver's divisions gets one notice, and a leaving Logistics lead is not told", () => {
  const leads = [
    { memberId: 50, divisionId: 9 },
    { memberId: 50, divisionId: 15 },
    { memberId: 7, divisionId: 15 },
  ];
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], team, leads, null), [
    { recipientId: 50, notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division", "Hardware Division"], reason: null } } },
  ]);
  const leaverLeadsLogistics = [{ memberId: 7, divisionId: 15 }];
  assert.deepEqual(memberLeftNotices(7, [{ id: 15, name: "Logistics" }], team, leaverLeadsLogistics, null), []);
});

test("with no Logistics lead, or Logistics closed, the notices are those of the leaver's own leads", () => {
  const ownLeads = [{ memberId: 20, divisionId: 1 }];
  const today = memberLeftNotices(7, [missionAnalysis, hardware], [], ownLeads, null);
  assert.deepEqual(today, [{ recipientId: 20, notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division"], reason: null } } }]);
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], team, ownLeads, null), today);
  const closed = team.map((d) => (d.id === logistics.id ? { ...d, closedAt: "2026-09-30" } : d));
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], closed, [...ownLeads, { memberId: 50, divisionId: 15 }], null), today);
});

test("a stored notice reads as an attention row with Dismiss; an unknown kind or bad data is not shown", () => {
  const row = {
    id: 3,
    kind: "member-left",
    subject: "Valentina Sala",
    createdAt: "2026-10-08T16:20:00Z",
    data: { divisions: ["Mission Analysis Division"], reason: "Internship abroad." },
  };
  const notice = noticeOf(row);
  assert.ok(notice);
  assert.deepEqual(attentionOf(notice, new Date("2026-10-09T12:00:00Z")), {
    kind: "notice",
    title: "Valentina Sala left the team",
    detail: 'Mission Analysis Division · 8 Oct · "Internship abroad."',
    action: { label: "Dismiss", dismissNotice: 3 },
  });
  assert.equal(noticeOf({ ...row, kind: "member-joined" }), null);
  assert.equal(noticeOf({ ...row, data: { divisions: "Mission Analysis" } }), null);
});

test("a promoted notice reads as an attention row naming the person, the division and the mode", () => {
  const row = {
    id: 4,
    kind: "promoted",
    subject: "Sara Conti",
    createdAt: "2026-10-08T16:20:00Z",
    data: { division: "Mission Analysis Division", mode: "together", lead: "Marco Bianchi" },
  };
  const now = new Date("2026-10-09T12:00:00Z");
  const together = noticeOf(row);
  assert.ok(together);
  assert.deepEqual(attentionOf(together, now), {
    kind: "notice",
    title: "Sara Conti now leads Mission Analysis Division",
    detail: "together with Marco Bianchi · 8 Oct",
    action: { label: "Dismiss", dismissNotice: 4 },
  });
  const handOver = noticeOf({ ...row, data: { ...row.data, mode: "hand-over" } });
  assert.ok(handOver);
  assert.equal(attentionOf(handOver, now).detail, "Marco Bianchi handed over · 8 Oct");
  assert.equal(noticeOf({ ...row, data: { ...row.data, mode: "alone" } }), null);
});

test("the alias notices draw the alias request's at-sign tile; other notices keep the notice tile (issue #565)", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const read = (kind: string, data: unknown) => {
    const notice = noticeOf({ id: 5, kind, subject: "Davide Russo", createdAt: "2026-10-22T10:00:00Z", data });
    assert.ok(notice);
    return attentionOf(notice, now);
  };
  assert.equal(read("alias-created", { address: "davide.russo@politorocketteam.it" }).iconKind, "alias-request");
  assert.equal(read("alias-declined", { by: "Andrea Pantano" }).iconKind, "alias-request");
  assert.equal(read("member-left", { divisions: ["Hardware Division"], reason: null }).iconKind, undefined);
});
