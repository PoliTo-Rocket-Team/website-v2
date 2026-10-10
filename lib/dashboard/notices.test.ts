import assert from "node:assert/strict";
import { test } from "node:test";
import { attentionOf, memberLeftNotices, noticeOf, promotedNotices, untoldOfPromotion, type Promotion } from "./notices";

const missionAnalysis = { id: 1, name: "Mission Analysis Division" };
const hardware = { id: 9, name: "Hardware Division" };

test("a leaver with roles in two divisions tells the lead of each", () => {
  const leads = [
    { memberId: 20, divisionId: 1 },
    { memberId: 30, divisionId: 9 },
    { memberId: 40, divisionId: 5 }, // leads a division the leaver was not in
  ];
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], leads, "Graduating."), [
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
  assert.deepEqual(memberLeftNotices(7, [missionAnalysis, hardware], leads, null), [
    { recipientId: 20, notice: { kind: "member-left", data: { divisions: ["Mission Analysis Division", "Hardware Division"], reason: null } } },
  ]);
});

test("a leaver whose division has no lead writes no notice", () => {
  assert.deepEqual(memberLeftNotices(7, [hardware], [{ memberId: 20, divisionId: 1 }], null), []);
  assert.deepEqual(memberLeftNotices(7, [], [], null), []);
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

// A promotion (#188): Marco (2) promotes Sara (7) in Mission Analysis, a division of Aerodynamics (1).
const promotion: Promotion = {
  personId: 7,
  division: { name: "Mission Analysis Division", departmentId: 1 },
  mode: "together",
  lead: { id: 2, name: "Marco Bianchi" },
};

test("a promotion tells the head of the division's department once, and no other head", () => {
  const heads = [
    { memberId: 15, departmentId: 1 },
    { memberId: 15, departmentId: 1 }, // a second head role in the same department
    { memberId: 16, departmentId: 2 },
  ];
  assert.deepEqual(promotedNotices(promotion, heads), [
    { recipientId: 15, notice: { kind: "promoted", data: { division: "Mission Analysis Division", mode: "together", lead: "Marco Bianchi" } } },
  ]);
});

test("a promotion in a department with no head writes no notice", () => {
  assert.deepEqual(promotedNotices(promotion, [{ memberId: 16, departmentId: 2 }]), []);
  assert.deepEqual(promotedNotices(promotion, []), []);
});

test("the lead who promotes is never told, even when they also head the department", () => {
  const heads = [
    { memberId: 2, departmentId: 1 },
    { memberId: 15, departmentId: 1 },
  ];
  assert.deepEqual(
    promotedNotices({ ...promotion, mode: "hand-over" }, heads).map((n) => n.recipientId),
    [15],
  );
  assert.deepEqual(promotedNotices(promotion, [{ memberId: 2, departmentId: 1 }]), []);
});

test("the person promoted is never told, even when they hold a head role in the department", () => {
  const heads = [
    { memberId: 7, departmentId: 1 },
    { memberId: 15, departmentId: 1 },
  ];
  assert.deepEqual(promotedNotices(promotion, heads).map((n) => n.recipientId), [15]);
  // The database's insert leaves out the same two people (database-notices.ts).
  assert.deepEqual(untoldOfPromotion({ personId: 7, leadId: 2 }), [2, 7]);
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
